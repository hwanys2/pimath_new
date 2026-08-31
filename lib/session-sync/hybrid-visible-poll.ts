"use client";

import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { startVisibleInterval } from "@/lib/visible-interval";
import { SESSION_SYNC_EVENT, SESSION_SYNC_FALLBACK_POLL_MS } from "./channel";

type HybridVisiblePollOptions = {
  fallbackMs?: number;
};

/**
 * Visible-interval poll plus Realtime Broadcast subscription (imperative API).
 * Used by PvP games that manage start/stop poll lifecycle manually.
 */
export function startHybridVisiblePoll(
  channelName: string | null | undefined,
  tick: () => void | Promise<void>,
  options: HybridVisiblePollOptions = {},
): () => void {
  const fallbackMs = options.fallbackMs ?? SESSION_SYNC_FALLBACK_POLL_MS;
  const name = channelName?.trim();
  const runTick = () => {
    void tick();
  };

  runTick();
  const stopInterval = startVisibleInterval(runTick, fallbackMs);

  if (!name) {
    return stopInterval;
  }

  const supabase = createBrowserSupabaseClient();
  const channel = supabase
    .channel(name)
    .on("broadcast", { event: SESSION_SYNC_EVENT }, runTick)
    .subscribe();

  return () => {
    stopInterval();
    void supabase.removeChannel(channel);
  };
}
