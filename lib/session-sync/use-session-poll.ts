"use client";

import { useEffect, useRef } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { startVisibleInterval } from "@/lib/visible-interval";
import {
  SESSION_SYNC_EVENT,
  SESSION_SYNC_FALLBACK_POLL_MS,
  sessionSyncChannelName,
} from "./channel";

type UseSessionPollOptions = {
  /** When false, no subscription or polling runs. Default true. */
  enabled?: boolean;
  fallbackMs?: number;
};

/**
 * Event-driven session refresh: Realtime Broadcast + slow fallback poll.
 * Replaces fixed-interval Server Action polling for live classroom sessions.
 */
export function useSessionPoll(
  sessionId: string | null | undefined,
  tick: () => void | Promise<void>,
  options: UseSessionPollOptions = {},
): void {
  const tickRef = useRef(tick);
  tickRef.current = tick;

  const { enabled = true, fallbackMs = SESSION_SYNC_FALLBACK_POLL_MS } = options;

  useEffect(() => {
    const id = sessionId?.trim();
    if (!enabled || !id) return;

    const runTick = () => {
      void tickRef.current();
    };

    runTick();

    const stopInterval = startVisibleInterval(runTick, fallbackMs);

    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel(sessionSyncChannelName(id))
      .on("broadcast", { event: SESSION_SYNC_EVENT }, () => {
        runTick();
      })
      .subscribe();

    return () => {
      stopInterval();
      void supabase.removeChannel(channel);
    };
  }, [enabled, sessionId, fallbackMs]);
}
