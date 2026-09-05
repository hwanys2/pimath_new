"use client";

import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import type { OmokPollState } from "@/lib/omok-types";
import {
  firstRpcRow,
  mapOmokPollRow,
  type OmokPollRpcRow,
} from "@/lib/omok-poll-shared";

function identityArgs(input: {
  sessionToken?: string | null;
  guestId?: string | null;
}) {
  return {
    p_session_token: input.sessionToken?.trim() || null,
    p_guest_id: input.guestId?.trim() || null,
  };
}

/** High-frequency PvP poll — browser → Supabase RPC (skips Next.js). */
export async function omokPollClient(input: {
  sessionToken?: string | null;
  guestId?: string | null;
  gameId?: string | null;
}): Promise<OmokPollState | { error: string }> {
  const id = identityArgs(input);
  if (!id.p_session_token && !id.p_guest_id) {
    return { error: "신원 정보가 없어요." };
  }

  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("pm_omok_poll", {
    ...id,
    p_game_id: input.gameId ?? null,
  });

  if (error) {
    console.error("[pm] pm_omok_poll (client):", error.message);
    return { error: "상태를 불러오지 못했어요." };
  }

  return mapOmokPollRow(firstRpcRow(data as OmokPollRpcRow | OmokPollRpcRow[] | null));
}

/** Presence heartbeat during a live PvP game — browser → Supabase RPC. */
export async function omokTouchGameClient(input: {
  sessionToken?: string | null;
  guestId?: string | null;
  gameId: string;
}): Promise<{ ok: boolean }> {
  const id = identityArgs(input);
  if (!id.p_session_token && !id.p_guest_id) {
    return { ok: false };
  }

  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("pm_omok_touch_game", {
    ...id,
    p_game_id: input.gameId,
  });

  if (error) {
    console.error("[pm] pm_omok_touch_game (client):", error.message);
    return { ok: false };
  }

  return { ok: Boolean(data) };
}
