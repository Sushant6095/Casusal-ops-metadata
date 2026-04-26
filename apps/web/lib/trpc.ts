import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import type { AppRouter } from "@causalops/api/routers";

export const trpc = createTRPCReact<AppRouter>();

export const apiBaseUrl = (): string => {
  if (typeof window !== "undefined") {
    return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  }
  return process.env.API_INTERNAL_URL ?? "http://localhost:3001";
};

export const trpcLinks = () => [
  httpBatchLink({
    url: `${apiBaseUrl()}/trpc`,
    headers: () => {
      const token =
        typeof window !== "undefined"
          ? (window as unknown as { __API_TOKEN__?: string }).__API_TOKEN__
          : process.env.API_TOKEN;
      return token ? { authorization: `Bearer ${token}` } : {};
    },
  }),
];
