"use server";

import { getStudentSessionToken } from "@/lib/student-session";
import { createClient } from "@/lib/supabase/server";
import { getContent } from "@/lib/contents";
import type { GamePresencePhase } from "@/lib/game-dashboard-types";

export async function pingGamePresence(input: {
  contentKey: string;
  phase?: GamePresencePhase;
  liveScore?: number | null;
}): Promise<{ ok: boolean }> {
  const token = await getStudentSessionToken();
  if (!token) return { ok: false };

  const contentKey = input.contentKey.trim();
  const content = getContent(contentKey);
  if (!content || content.type !== "game") return { ok: false };

  const supabase = await createClient();
  const { error } = await supabase.rpc("pm_ping_game_presence", {
    p_session_token: token,
    p_content_key: contentKey,
    p_phase: input.phase ?? "playing",
    p_live_score:
      typeof input.liveScore === "number" ? Math.max(0, input.liveScore) : null,
    p_meta: {},
  });

  if (error) {
    console.error("[pm] pm_ping_game_presence failed:", error.message);
    return { ok: false };
  }
  return { ok: true };
}

export async function leaveGamePresence(input: {
  contentKey: string;
}): Promise<void> {
  const token = await getStudentSessionToken();
  if (!token) return;

  const contentKey = input.contentKey.trim();
  if (!contentKey) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("pm_leave_game_presence", {
    p_session_token: token,
    p_content_key: contentKey,
  });
  if (error) {
    console.error("[pm] pm_leave_game_presence failed:", error.message);
  }
}
