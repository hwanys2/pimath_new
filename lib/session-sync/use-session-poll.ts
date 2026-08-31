"use client";

import { useEffect, useRef } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { startVisibleInterval } from "@/lib/visible-interval";
import {
  SESSION_SYNC_EVENT,
  SESSION_SYNC_FALLBACK_POLL_MS,
  dashboardSyncChannelName,
  sessionSyncChannelName,
} from "./channel";

type UseBroadcastPollOptions = {
  /** When false, no subscription or polling runs. Default true. */
  enabled?: boolean;
  fallbackMs?: number;
};

function useBroadcastPoll(
  channelName: string | null | undefined,
  tick: () => void | Promise<void>,
  options: UseBroadcastPollOptions = {},
): void {
  const tickRef = useRef(tick);
  tickRef.current = tick;

  const { enabled = true, fallbackMs = SESSION_SYNC_FALLBACK_POLL_MS } = options;

  useEffect(() => {
    const name = channelName?.trim();
    if (!enabled || !name) return;

    const runTick = () => {
      void tickRef.current();
    };

    runTick();

    const stopInterval = startVisibleInterval(runTick, fallbackMs);

    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel(name)
      .on("broadcast", { event: SESSION_SYNC_EVENT }, () => {
        runTick();
      })
      .subscribe();

    return () => {
      stopInterval();
      void supabase.removeChannel(channel);
    };
  }, [enabled, channelName, fallbackMs]);
}

type UseSessionPollOptions = UseBroadcastPollOptions;

/**
 * Event-driven session refresh: Realtime Broadcast + slow fallback poll.
 * Replaces fixed-interval Server Action polling for live classroom sessions.
 */
export function useSessionPoll(
  sessionId: string | null | undefined,
  tick: () => void | Promise<void>,
  options: UseSessionPollOptions = {},
): void {
  useBroadcastPoll(
    sessionId ? sessionSyncChannelName(sessionId) : null,
    tick,
    options,
  );
}

type UseDashboardPollOptions = UseBroadcastPollOptions;

/**
 * Event-driven teacher dashboard refresh for a class + game content pair.
 */
export function useDashboardPoll(
  classId: string | null | undefined,
  contentKey: string | null | undefined,
  tick: () => void | Promise<void>,
  options: UseDashboardPollOptions = {},
): void {
  const channelName =
    classId?.trim() && contentKey?.trim()
      ? dashboardSyncChannelName(classId, contentKey)
      : null;
  useBroadcastPoll(channelName, tick, options);
}
