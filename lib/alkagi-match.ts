import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getStudentSessionToken } from "@/lib/student-session";
import {
  chooseAiAlkagiShot,
  opponentColor,
  simulateAlkagiShot,
} from "./alkagi-physics";
import type {
  AlkagiLastShot,
  AlkagiPollState,
  AlkagiQueueScope,
  AlkagiShot,
  AlkagiStone,
} from "./alkagi-types";
import {
  firstRpcRow,
  mapAlkagiPollRow,
  type AlkagiPollRpcRow,
} from "./alkagi-poll-shared";

export type { AlkagiPollState, AlkagiQueueScope } from "./alkagi-types";
export { ALKAGI_TURN_SECONDS } from "./alkagi-types";

function firstRow<T>(data: T | T[] | null): T | null {
  return firstRpcRow(data);
}

async function identityArgs(guestId?: string | null) {
  const token = await getStudentSessionToken();
  return {
    p_session_token: token,
    p_guest_id: guestId?.trim() || null,
  };
}

export async function alkagiJoinQueue(input: {
  scope: AlkagiQueueScope;
  guestId?: string | null;
}) {
  const supabase = await createClient();
  const id = await identityArgs(input.guestId);
  if (!id.p_session_token && !id.p_guest_id) {
    return { error: "게스트 ID 또는 학생 로그인이 필요해요." };
  }

  const { data, error } = await supabase.rpc("pm_alkagi_join_queue", {
    ...id,
    p_scope: input.scope,
  });

  if (error) {
    console.error("[pm] pm_alkagi_join_queue:", error.message);
    return { error: "대기열에 들어가지 못했어요." };
  }

  const row = firstRow(data) as {
    queue_id: string;
    game_id: string | null;
    scope: string;
    status: string;
    player_key: string;
    display_name: string;
    class_id: string | null;
    can_use_class: boolean;
  } | null;

  if (!row) return { error: "대기열 결과가 없어요." };

  return {
    queueId: row.queue_id,
    gameId: row.game_id,
    scope: row.scope === "class" ? ("class" as const) : ("global" as const),
    status: row.status,
    playerKey: row.player_key,
    displayName: row.display_name,
    classId: row.class_id,
    canUseClass: Boolean(row.can_use_class),
  };
}

export async function alkagiExpandGlobal(input: { guestId?: string | null }) {
  const supabase = await createClient();
  const id = await identityArgs(input.guestId);
  const { data, error } = await supabase.rpc(
    "pm_alkagi_expand_queue_global",
    id,
  );

  if (error) {
    console.error("[pm] pm_alkagi_expand_queue_global:", error.message);
    return { error: "전체 대기로 바꾸지 못했어요." };
  }

  const row = firstRow(data) as {
    queue_id: string;
    game_id: string | null;
    scope: string;
    status: string;
  } | null;

  if (!row) return { error: "전체 대기 결과가 없어요." };

  return {
    queueId: row.queue_id,
    gameId: row.game_id,
    scope: "global" as const,
    status: row.status,
  };
}

export async function alkagiLeaveQueue(input: { guestId?: string | null }) {
  const supabase = await createClient();
  const id = await identityArgs(input.guestId);
  if (!id.p_session_token && !id.p_guest_id) return { ok: false };

  const { data, error } = await supabase.rpc("pm_alkagi_leave_queue", id);
  if (error) {
    console.error("[pm] pm_alkagi_leave_queue:", error.message);
    return { ok: false };
  }
  return { ok: Boolean(data) };
}

export async function alkagiPoll(input: {
  guestId?: string | null;
  gameId?: string | null;
}): Promise<AlkagiPollState | { error: string }> {
  const supabase = await createClient();
  const id = await identityArgs(input.guestId);
  if (!id.p_session_token && !id.p_guest_id) {
    return { error: "신원 정보가 없어요." };
  }

  const { data, error } = await supabase.rpc("pm_alkagi_poll", {
    ...id,
    p_game_id: input.gameId ?? null,
  });

  if (error) {
    console.error("[pm] pm_alkagi_poll:", error.message);
    return { error: "상태를 불러오지 못했어요." };
  }

  return mapAlkagiPollRow(
    firstRow(data as AlkagiPollRpcRow | AlkagiPollRpcRow[] | null),
  );
}

export async function alkagiPlaceMove(input: {
  guestId?: string | null;
  gameId: string;
  shot: AlkagiShot;
  currentStones: AlkagiStone[];
}) {
  const supabase = await createClient();
  const id = await identityArgs(input.guestId);
  if (!id.p_session_token && !id.p_guest_id) {
    return { ok: false, error: "no_identity", message: "로그인이 필요해요." };
  }

  const shooter = input.currentStones.find((s) => s.id === input.shot.stoneId);
  if (!shooter || !shooter.alive) {
    return {
      ok: false,
      error: "stone_not_found",
      message: "유효한 바둑알이 아니에요.",
    };
  }

  // Run simulation
  const sim = simulateAlkagiShot(input.currentStones, input.shot);
  const nextTurn = opponentColor(shooter.color);

  const lastShot: AlkagiLastShot = {
    ...input.shot,
    shooterColor: shooter.color,
    fromX: shooter.x,
    fromY: shooter.y,
  };

  const { data, error } = await supabase.rpc("pm_alkagi_place_move", {
    ...id,
    p_game_id: input.gameId,
    p_board: sim.finalStones,
    p_last_shot: lastShot,
    p_new_status: sim.gameStatus,
    p_next_turn: nextTurn,
  });

  if (error) {
    console.error("[pm] pm_alkagi_place_move:", error.message);
    return { ok: false, error: "rpc_failed", message: error.message };
  }

  const row = firstRow(data) as { ok: boolean; error: string | null } | null;
  if (!row || !row.ok) {
    return {
      ok: false,
      error: row?.error ?? "unknown",
      message: row?.error === "not_your_turn" ? "내 턴이 아니에요." : "수를 둘 수 없어요.",
    };
  }

  return {
    ok: true,
    nextTurn,
    gameStatus: sim.gameStatus,
  };
}

export async function alkagiTimeoutMove(input: {
  guestId?: string | null;
  gameId: string;
}) {
  const poll = await alkagiPoll({
    guestId: input.guestId,
    gameId: input.gameId,
  });

  if ("error" in poll) return { ok: false, error: poll.error };
  if (poll.phase !== "playing" || !poll.turn) {
    return { ok: false, error: "game_over", message: "이미 끝난 게임이에요." };
  }
  if (!poll.turnDeadline) {
    return { ok: false, error: "no_deadline", message: "제한 시간이 없어요." };
  }
  if (Date.now() < new Date(poll.turnDeadline).getTime()) {
    return { ok: false, error: "not_expired", message: "아직 시간이 남았어요." };
  }

  const aiShot = chooseAiAlkagiShot(poll.stones, poll.turn);
  return alkagiPlaceMove({
    guestId: input.guestId,
    gameId: input.gameId,
    shot: aiShot,
    currentStones: poll.stones,
  });
}

export async function alkagiForfeitGame(input: {
  guestId?: string | null;
  gameId: string;
}) {
  const supabase = await createClient();
  const id = await identityArgs(input.guestId);
  const { data, error } = await supabase.rpc("pm_alkagi_forfeit_game", {
    ...id,
    p_game_id: input.gameId,
  });

  if (error) {
    console.error("[pm] pm_alkagi_forfeit_game:", error.message);
    return { ok: false };
  }
  return { ok: Boolean(data) };
}

export async function alkagiClaimResult(input: {
  guestId?: string | null;
  gameId: string;
}) {
  const supabase = await createClient();
  const id = await identityArgs(input.guestId);
  const { data, error } = await supabase.rpc("pm_alkagi_claim_result", {
    ...id,
    p_game_id: input.gameId,
  });

  if (error) {
    console.error("[pm] pm_alkagi_claim_result:", error.message);
    return { ok: false };
  }
  return { ok: Boolean(data) };
}

export async function alkagiCanUseClassQueue(): Promise<{
  canUseClass: boolean;
  playerName: string | null;
  sessionToken: string | null;
  classId: string | null;
}> {
  const token = await getStudentSessionToken();
  if (!token) {
    return {
      canUseClass: false,
      playerName: null,
      sessionToken: null,
      classId: null,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pm_alkagi_resolve_identity", {
    p_session_token: token,
    p_guest_id: null,
  });

  if (error) {
    console.error("[pm] pm_alkagi_resolve_identity (canUseClass):", error.message);
    return {
      canUseClass: false,
      playerName: null,
      sessionToken: token,
      classId: null,
    };
  }

  const row = firstRow(data) as {
    o_player_key: string | null;
    o_display_name: string | null;
    o_class_id: string | null;
  } | null;

  return {
    canUseClass: Boolean(row?.o_class_id),
    playerName: row?.o_display_name ?? null,
    sessionToken: token,
    classId: row?.o_class_id ?? null,
  };
}
