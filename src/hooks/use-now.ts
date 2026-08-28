import { useEffect, useState } from "react";

/**
 * Shared "current time" for render-time computations (staleness, relative times).
 * Ticks periodically so relative displays stay fresh without impure render calls.
 */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function isStaleHeartbeat(heartbeatAt: string | undefined, status: string, now: number): boolean {
  if (!["running", "waiting"].includes(status)) return false;
  if (!heartbeatAt) return false;
  return now - new Date(heartbeatAt).getTime() > 5 * 60_000;
}
