import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "@causalops/api/routers";

export type ApiClient = ReturnType<typeof createTRPCClient<AppRouter>>;

export const createApiClient = (): ApiClient => {
  const base = process.env.API_BASE_URL ?? "http://localhost:3001";
  const token = process.env.API_TOKEN;
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${base}/trpc`,
        headers: () => (token ? { authorization: `Bearer ${token}` } : {}),
      }),
    ],
  });
};
