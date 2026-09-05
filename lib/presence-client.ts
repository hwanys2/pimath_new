"use client";

import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { getContent } from "@/lib/contents";
import type { GamePresencePhase } from "@/lib/game-dashboard-types";

/** High-frequency game presence ping — browser → Supabase RPC. */
export async function pingGamePresenceClient(input: {
  sessionToken: string;
  contentKey: string;
  phase?: GamePresencePhase;
  liveScore?: number | null;
}): Promise<{ ok: boolean }> {
  const token = input.sessionToken.trim();
  const contentKey = input.contentKey.trim();
  if (!token || !contentKey) return { ok: false };

  const content = getContent(contentKey);
  if (!content || content.type !== "game") return { ok: false };

  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.rpc("pm_ping_game_presence", {
    p_session_token: token,
    p_content_key: contentKey,
    p_phase: input.phase ?? "playing",
    p_live_score:
      typeof input.liveScore === "number" ? Math.max(0, input.liveScore) : null,
    p_meta: {},
  });

  if (error) {
    console.error("[pm] pm_ping_game_presence (client):", error.message);
    return { ok: false };
  }
  return { ok: true };
}

export async function leaveGamePresenceClient(input: {
  sessionToken: string;
  contentKey: string;
}): Promise<void> {
  const token = input.sessionToken.trim();
  const contentKey = input.contentKey.trim();
  if (!token || !contentKey) return;

  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.rpc("pm_leave_game_presence", {
    p_session_token: token,
    p_content_key: contentKey,
  });
  if (error) {
    console.error("[pm] pm_leave_game_presence (client):", error.message);
  }
}
