"use client";
import { useEffect, useState } from "react";

export interface LiveEventsState {
  connected: boolean;
  lastEventAt: string | null;
}

/**
 * Placeholder live-events hook. Full WS wiring via tRPC subscription can be
 * added later — for now we just track whether the api /health is reachable.
 */
export const useLiveEvents = (): LiveEventsState => {
  const [connected, setConnected] = useState(false);
  const [lastEventAt, setLastEventAt] = useState<string | null>(null);

  useEffect(() => {
    const url =
      (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001") + "/health";
    let cancelled = false;
    const tick = async (): Promise<void> => {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!cancelled) {
          setConnected(res.ok);
          if (res.ok) setLastEventAt(new Date().toISOString());
        }
      } catch {
        if (!cancelled) setConnected(false);
      }
    };
    void tick();
    const id = setInterval(tick, 10_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return { connected, lastEventAt };
};
