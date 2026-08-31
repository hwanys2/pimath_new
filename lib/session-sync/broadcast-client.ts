"use client";

import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { SESSION_SYNC_EVENT, sessionSyncChannelName } from "./channel";

const BROADCAST_SUBSCRIBE_TIMEOUT_MS = 3000;

/**
 * Notify other clients in the same session to refresh (Hybrid Realtime).
 * Failures are non-fatal — peers fall back to slow polling.
 */
export async function notifySessionChanged(sessionId: string): Promise<void> {
  const id = sessionId.trim();
  if (!id) return;

  try {
    const supabase = createBrowserSupabaseClient();
    const channel = supabase.channel(sessionSyncChannelName(id), {
      config: { broadcast: { ack: false, self: false } },
    });

    await new Promise<void>((resolve) => {
      const timeoutId = window.setTimeout(() => {
        void supabase.removeChannel(channel);
        resolve();
      }, BROADCAST_SUBSCRIBE_TIMEOUT_MS);

      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void channel
            .send({
              type: "broadcast",
              event: SESSION_SYNC_EVENT,
              payload: { at: Date.now() },
            })
            .finally(() => {
              window.clearTimeout(timeoutId);
              void supabase.removeChannel(channel);
              resolve();
            });
          return;
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          window.clearTimeout(timeoutId);
          void supabase.removeChannel(channel);
          resolve();
        }
      });
    });
  } catch {
    // fallback poll covers missed notifications
  }
}
