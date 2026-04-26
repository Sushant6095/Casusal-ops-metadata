import { NextRequest, NextResponse } from "next/server";

/**
 * Thin proxy from Next → apps/api tRPC endpoint.
 * Avoids CORS pre-flights when the app is served from the same origin.
 */
const apiUrl = (): string =>
  process.env.API_INTERNAL_URL ?? "http://localhost:3001";

const forward = async (req: NextRequest): Promise<NextResponse> => {
  const target = `${apiUrl()}/trpc${req.nextUrl.pathname.replace(/^\/api\/trpc/, "")}${req.nextUrl.search}`;
  const headers = new Headers(req.headers);
  headers.delete("host");
  const init: RequestInit = { method: req.method, headers };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.text();
  }
  const res = await fetch(target, init);
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
  });
};

export const GET = forward;
export const POST = forward;
