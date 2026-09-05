"use client";

import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import {
  SESSION_SYNC_EVENT,
  dashboardSyncChannelName,
  pvpGameSyncChannelName,
  pvpQueueSyncChannelName,
  sessionSyncChannelName,
} from "./channel";

const BROADCAST_SUBSCRIBE_TIMEOUT_MS = 5000;

async function sendBroadcast(channelName: string): Promise<void> {
  try {
    const supabase = createBrowserSupabaseClient();
    // Unique topic instance so we don't fight an existing subscriber on this tab.
    const channel = supabase.channel(channelName, {
      config: { broadcast: { ack: false, self: false } },
    });

    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeoutId);
        void supabase.removeChannel(channel);
        resolve();
      };

      const sendThenFinish = () => {
        void channel
          .send({
            type: "broadcast",
            event: SESSION_SYNC_EVENT,
            payload: { at: Date.now() },
          })
          .catch(() => undefined)
          .finally(finish);
      };

      const timeoutId = window.setTimeout(() => {
        // Last attempt even if subscribe callback was late/missed.
        sendThenFinish();
      }, BROADCAST_SUBSCRIBE_TIMEOUT_MS);

      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          sendThenFinish();
          return;
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          finish();
        }
      });
    });
  } catch {
    // fallback poll covers missed notifications
  }
}

/**
 * Notify other clients in the same session to refresh (Hybrid Realtime).
 * Failures are non-fatal — peers fall back to slow polling.
 */
export async function notifySessionChanged(sessionId: string): Promise<void> {
  const id = sessionId.trim();
  if (!id) return;
  await sendBroadcast(sessionSyncChannelName(id));
}

/**
 * Notify teacher game dashboard subscribers for a class + content activity.
 */
export async function notifyDashboardChanged(
  classId: string,
  contentKey: string,
): Promise<void> {
  const cid = classId.trim();
  const key = contentKey.trim();
  if (!cid || !key) return;
  await sendBroadcast(dashboardSyncChannelName(cid, key));
}

/**
 * Notify clients subscribed to a live 1:1 PvP game.
 */
export async function notifyPvpGameChanged(gameId: string): Promise<void> {
  const id = gameId.trim();
  if (!id) return;
  await sendBroadcast(pvpGameSyncChannelName(id));
}

/**
 * Notify clients waiting in the same PvP matchmaking queue.
 */
export async function notifyPvpQueueChanged(
  contentKey: string,
  scope: "class" | "global",
  classId?: string | null,
): Promise<void> {
  const channel = pvpQueueSyncChannelName(contentKey, scope, classId);
  if (!channel) return;
  await sendBroadcast(channel);
}
