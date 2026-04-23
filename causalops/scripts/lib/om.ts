import { OmApiError, type OmClient } from "@causalops/om-client";

interface AxiosLikeError {
  isAxiosError?: boolean;
  message: string;
  response?: { status?: number };
}

export type UpsertOutcome = "created" | "exists" | "updated";

export interface UpsertResult<T> {
  outcome: UpsertOutcome;
  data: T;
}

const isOmError = (e: unknown): e is OmApiError => e instanceof OmApiError;

/**
 * OM-style upsert via PUT. OM returns 201 on create, 200 on update.
 * We collapse 200 → "exists" for idempotent-seed reporting.
 */
export async function putUpsert<T>(
  client: OmClient,
  path: string,
  body: unknown,
): Promise<UpsertResult<T>> {
  const res = await client.http.put<T>(path, body, {
    validateStatus: (s) => s >= 200 && s < 300,
  });
  const outcome: UpsertOutcome = res.status === 201 ? "created" : "exists";
  return { outcome, data: res.data };
}

/** POST but treat 4xx "already exists" as idempotent. */
export async function postOrExists<T>(
  client: OmClient,
  path: string,
  body: unknown,
): Promise<UpsertResult<T>> {
  try {
    const res = await client.http.post<T>(path, body);
    return { outcome: "created", data: res.data };
  } catch (err) {
    if (isOmError(err) && (err.status === 409 || err.status === 400)) {
      return { outcome: "exists", data: body as T };
    }
    throw err;
  }
}

/** GET by name; returns null on 404. */
export async function getByNameOrNull<T>(
  client: OmClient,
  path: string,
): Promise<T | null> {
  try {
    const res = await client.http.get<T>(path);
    return res.data;
  } catch (err) {
    if (isOmError(err) && err.status === 404) return null;
    throw err;
  }
}

/** DELETE with hardDelete flag; 404 treated as success. */
export async function hardDelete(
  client: OmClient,
  path: string,
): Promise<void> {
  try {
    await client.http.delete(path, {
      params: { hardDelete: true, recursive: true },
    });
  } catch (err) {
    if (isOmError(err) && err.status === 404) return;
    throw err;
  }
}

export const formatAxiosMessage = (err: unknown): string => {
  if (isOmError(err)) {
    return `[${err.status}] ${err.message}`;
  }
  const ax = err as AxiosLikeError;
  if (ax && ax.isAxiosError) {
    return `[${ax.response?.status ?? 0}] ${ax.message}`;
  }
  return err instanceof Error ? err.message : String(err);
};
