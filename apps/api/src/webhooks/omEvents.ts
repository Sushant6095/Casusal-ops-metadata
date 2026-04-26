import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { sql } from "drizzle-orm";
import { changeEvents } from "@causalops/ingestor/db/schema";
import type { AppDeps } from "../context.js";
import { logger } from "../logger.js";

interface OmWebhookBody {
  id?: string;
  eventType?: string;
  entityType?: string;
  entityFullyQualifiedName?: string;
  timestamp?: number;
  changeDescription?: Record<string, unknown>;
  [k: string]: unknown;
}

const verifySignature = (
  secret: string,
  body: string,
  signature: string,
): boolean => {
  const hmac = createHmac("sha256", secret).update(body).digest();
  const provided = Buffer.from(signature, "hex");
  if (provided.length !== hmac.length) return false;
  return timingSafeEqual(hmac, provided);
};

export const registerWebhooks = async (
  app: FastifyInstance,
  deps: AppDeps,
): Promise<void> => {
  app.post(
    "/webhook/om",
    {
      config: { rawBody: true },
    },
    async (req, reply) => {
      const secret = process.env.OM_WEBHOOK_SECRET;
      const signature =
        typeof req.headers["x-om-signature"] === "string"
          ? req.headers["x-om-signature"]
          : null;
      const raw =
        typeof (req as unknown as { rawBody?: unknown }).rawBody === "string"
          ? (req as unknown as { rawBody: string }).rawBody
          : JSON.stringify(req.body ?? {});

      if (secret && signature) {
        if (!verifySignature(secret, raw, signature)) {
          logger.warn({ sig: signature.slice(0, 8) }, "webhook bad signature");
          reply.code(401);
          return { ok: false };
        }
      }

      const body = req.body as OmWebhookBody;
      if (!body?.id || !body.entityFullyQualifiedName || !body.timestamp) {
        reply.code(400);
        return { ok: false, reason: "missing fields" };
      }

      const row = {
        id: body.id,
        timestamp: new Date(body.timestamp),
        entityFqn: body.entityFullyQualifiedName,
        entityType: body.entityType ?? "unknown",
        eventType: body.eventType ?? "unknown",
        changeFields: (body.changeDescription ?? {}) as Record<string, unknown>,
        raw: body as unknown as Record<string, unknown>,
      };

      try {
        await deps.db
          .insert(changeEvents)
          .values(row)
          .onConflictDoUpdate({
            target: [changeEvents.id, changeEvents.timestamp],
            set: {
              changeFields: sql`EXCLUDED.change_fields`,
              raw: sql`EXCLUDED.raw`,
            },
          });

        deps.events.emit("om.event", {
          id: row.id,
          entityFqn: row.entityFqn,
          entityType: row.entityType,
          eventType: row.eventType,
          timestamp: row.timestamp.toISOString(),
        });

        logger.info(
          { id: row.id, entity: row.entityFqn, type: row.eventType },
          "webhook event accepted",
        );
        return { ok: true };
      } catch (err) {
        logger.error({ err }, "webhook insert failed");
        reply.code(500);
        return { ok: false };
      }
    },
  );
};
