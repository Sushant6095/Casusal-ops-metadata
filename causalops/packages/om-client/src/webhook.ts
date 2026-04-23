import type { OmClient } from "./client.js";
import {
  WebhookSubscriptionSchema,
  type WebhookSubscription,
} from "./types.js";

/** Register an OM event subscription (webhook target). */
export async function createSubscription(
  client: OmClient,
  sub: Omit<WebhookSubscription, "id">,
): Promise<WebhookSubscription> {
  const res = await client.http.post("/events/subscriptions", sub);
  return WebhookSubscriptionSchema.parse(res.data);
}

/** Delete an OM event subscription by id. */
export async function deleteSubscription(
  client: OmClient,
  id: string,
): Promise<void> {
  await client.http.delete(`/events/subscriptions/${encodeURIComponent(id)}`);
}
