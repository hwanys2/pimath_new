"use client";

import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import type { AlkagiPollState } from "@/lib/alkagi-types";
import {
  firstRpcRow,
  mapAlkagiPollRow,
  type AlkagiPollRpcRow,
} from "@/lib/alkagi-poll-shared";

function identityArgs(input: {
  sessionToken?: string | null;
  guestId?: string | null;
}) {
  return {
    p_session_token: input.sessionToken?.trim() || null,
    p_guest_id: input.guestId?.trim() || null,
  };
}

/** High-frequency PvP poll — browser → Supabase RPC (skips Next.js server). */
export async function alkagiPollClient(input: {
  sessionToken?: string | null;
  guestId?: string | null;
  gameId?: string | null;
}): Promise<AlkagiPollState | { error: string }> {
  const id = identityArgs(input);
  if (!id.p_session_token && !id.p_guest_id) {
    return { error: "신원 정보가 없어요." };
  }

  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("pm_alkagi_poll", {
    ...id,
    p_game_id: input.gameId ?? null,
  });

  if (error) {
    console.error("[pm] pm_alkagi_poll (client):", error.message);
    return { error: "상태를 불러오지 못했어요." };
  }

  return mapAlkagiPollRow(
    firstRpcRow(data as AlkagiPollRpcRow | AlkagiPollRpcRow[] | null),
  );
}
