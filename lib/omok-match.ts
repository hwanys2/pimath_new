import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getStudentSessionToken } from "@/lib/student-session";
import {
  boardFromObject,
  boardIsFull,
  boardToObject,
  opponent,
  pickRandomLegalMove,
  tryPlace,
  type BoardMap,
  type Stone,
} from "@/lib/ordered-pair-omok-math";
import type { OmokPollState, OmokQueueScope } from "@/lib/omok-types";
import {
  firstRpcRow,
  mapOmokPollRow,
  type OmokPollRpcRow,
} from "@/lib/omok-poll-shared";

export type { OmokPollState, OmokQueueScope } from "@/lib/omok-types";
export { OMOK_TURN_SECONDS } from "@/lib/omok-types";

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

export async function omokJoinQueue(input: {
  scope: OmokQueueScope;
  guestId?: string | null;
}): Promise<
  | {
      queueId: string;
      gameId: string | null;
      scope: OmokQueueScope;
      status: string;
      playerKey: string;
      displayName: string;
      classId: string | null;
      canUseClass: boolean;
    }
  | { error: string }
> {
  const supabase = await createClient();
  const id = await identityArgs(input.guestId);
  if (!id.p_session_token && !id.p_guest_id) {
    return { error: "게스트 ID 또는 학생 로그인이 필요해요." };
  }

  const { data, error } = await supabase.rpc("pm_omok_join_queue", {
    ...id,
    p_scope: input.scope,
  });

  if (error) {
    console.error("[pm] pm_omok_join_queue:", error.message);
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
    scope: row.scope === "class" ? "class" : "global",
    status: row.status,
    playerKey: row.player_key,
    displayName: row.display_name,
    classId: row.class_id,
    canUseClass: Boolean(row.can_use_class),
  };
}

export async function omokExpandGlobal(input: {
  guestId?: string | null;
}): Promise<
  | { queueId: string; gameId: string | null; scope: OmokQueueScope; status: string }
  | { error: string }
> {
  const supabase = await createClient();
  const id = await identityArgs(input.guestId);
  const { data, error } = await supabase.rpc("pm_omok_expand_queue_global", id);

  if (error) {
    console.error("[pm] pm_omok_expand_queue_global:", error.message);
    return { error: "전체 대기로 바꾸지 못했어요." };
  }

  const row = firstRow(data) as {
    queue_id: string;
    game_id: string | null;
    scope: string;
    status: string;
  } | null;

  if (!row) return { error: "대기열 결과가 없어요." };

  return {
    queueId: row.queue_id,
    gameId: row.game_id,
    scope: row.scope === "class" ? "class" : "global",
    status: row.status,
  };
}

export async function omokLeaveQueue(input: {
  guestId?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const id = await identityArgs(input.guestId);
  const { error } = await supabase.rpc("pm_omok_leave_queue", id);
  if (error) {
    console.error("[pm] pm_omok_leave_queue:", error.message);
    return { ok: false, error: "대기 취소를 실패했어요." };
  }
  return { ok: true };
}

export async function omokForfeitGame(input: {
  guestId?: string | null;
  gameId?: string | null;
}): Promise<
  | { ok: true; gameId: string | null; gameStatus: string | null }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const id = await identityArgs(input.guestId);
  if (!id.p_session_token && !id.p_guest_id) {
    return { ok: false, error: "신원 정보가 없어요." };
  }

  const { data, error } = await supabase.rpc("pm_omok_forfeit_game", {
    ...id,
    p_game_id: input.gameId ?? null,
  });

  if (error) {
    console.error("[pm] pm_omok_forfeit_game:", error.message);
    return { ok: false, error: "기권 처리를 실패했어요." };
  }

  const row = firstRow(data) as {
    ok: boolean;
    game_id: string | null;
    game_status: string | null;
    error_code: string | null;
  } | null;

  if (!row?.ok) {
    return { ok: false, error: "기권 처리를 실패했어요." };
  }

  return {
    ok: true,
    gameId: row.game_id,
    gameStatus: row.game_status,
  };
}

export async function omokTouchGame(input: {
  guestId?: string | null;
  gameId: string;
}): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const id = await identityArgs(input.guestId);
  if (!id.p_session_token && !id.p_guest_id) {
    return { ok: false };
  }

  const { data, error } = await supabase.rpc("pm_omok_touch_game", {
    ...id,
    p_game_id: input.gameId,
  });

  if (error) {
    console.error("[pm] pm_omok_touch_game:", error.message);
    return { ok: false };
  }

  return { ok: Boolean(data) };
}

export async function omokPoll(input: {
  guestId?: string | null;
  gameId?: string | null;
}): Promise<OmokPollState | { error: string }> {
  const supabase = await createClient();
  const id = await identityArgs(input.guestId);
  if (!id.p_session_token && !id.p_guest_id) {
    return { error: "신원 정보가 없어요." };
  }

  const { data, error } = await supabase.rpc("pm_omok_poll", {
    ...id,
    p_game_id: input.gameId ?? null,
  });

  if (error) {
    console.error("[pm] pm_omok_poll:", error.message);
    return { error: "상태를 불러오지 못했어요." };
  }

  return mapOmokPollRow(
    firstRow(data as OmokPollRpcRow | OmokPollRpcRow[] | null),
  );
}

export async function omokPlaceMove(input: {
  guestId?: string | null;
  gameId: string;
  x: number;
  y: number;
}): Promise<
  | {
      ok: true;
      board: Record<string, Stone>;
      turn: Stone;
      status: string;
      lastX: number;
      lastY: number;
      moveCount: number;
      outcome: "win" | "loss" | "draw" | null;
      turnDeadline: string | null;
    }
  | { ok: false; error: string; message?: string }
> {
  const poll = await omokPoll({
    guestId: input.guestId,
    gameId: input.gameId,
  });
  if ("error" in poll) return { ok: false, error: poll.error };
  if (poll.phase !== "playing" || !poll.myStone || !poll.turn) {
    return { ok: false, error: "game_over", message: "이미 끝난 대국이에요." };
  }
  if (poll.turn !== poll.myStone) {
    return {
      ok: false,
      error: "not_your_turn",
      message: "상대 차례예요. 순서쌍을 잠시만 기다려 주세요.",
    };
  }

  const board: BoardMap = boardFromObject(poll.board);
  const placed = tryPlace(board, input.x, input.y, poll.myStone);
  if (!placed.ok) {
    return { ok: false, error: placed.error, message: placed.message };
  }

  let status = "playing";
  let nextTurn: Stone = opponent(poll.myStone);
  if (placed.won) {
    status = poll.myStone === "black" ? "black_win" : "white_win";
  } else if (boardIsFull(placed.board)) {
    status = "draw";
  }

  const moveCount = poll.moveCount + 1;
  const supabase = await createClient();
  const id = await identityArgs(input.guestId);

  const { data, error } = await supabase.rpc("pm_omok_apply_move", {
    ...id,
    p_game_id: input.gameId,
    p_x: input.x,
    p_y: input.y,
    p_board: boardToObject(placed.board),
    p_next_turn: nextTurn,
    p_status: status,
    p_move_count: moveCount,
  });

  if (error) {
    console.error("[pm] pm_omok_apply_move:", error.message);
    return { ok: false, error: "apply_failed", message: "수를 반영하지 못했어요." };
  }

  const row = firstRow(data) as {
    ok: boolean;
    board: Record<string, Stone>;
    turn: string;
    status: string;
    last_x: number;
    last_y: number;
    move_count: number;
    error_code: string | null;
    turn_deadline?: string | null;
  } | null;

  if (!row?.ok) {
    return {
      ok: false,
      error: row?.error_code ?? "apply_failed",
      message: "수를 반영하지 못했어요.",
    };
  }

  let outcome: "win" | "loss" | "draw" | null = null;
  if (row.status === "black_win") {
    outcome = poll.myStone === "black" ? "win" : "loss";
  } else if (row.status === "white_win") {
    outcome = poll.myStone === "white" ? "win" : "loss";
  } else if (row.status === "draw") {
    outcome = "draw";
  }

  return {
    ok: true,
    board: row.board ?? boardToObject(placed.board),
    turn: (row.turn === "white" ? "white" : "black") as Stone,
    status: row.status,
    lastX: row.last_x,
    lastY: row.last_y,
    moveCount: row.move_count,
    outcome,
    turnDeadline: row.turn_deadline ?? null,
  };
}

/**
 * After turn_deadline, any participant may place a random legal move
 * for whoever's turn it is (AFK / closed tab recovery).
 */
export async function omokTimeoutMove(input: {
  guestId?: string | null;
  gameId: string;
}): Promise<
  | {
      ok: true;
      board: Record<string, Stone>;
      turn: Stone;
      status: string;
      lastX: number;
      lastY: number;
      moveCount: number;
      outcome: "win" | "loss" | "draw" | null;
      turnDeadline: string | null;
      autoX: number;
      autoY: number;
      autoStone: Stone;
    }
  | { ok: false; error: string; message?: string }
> {
  const poll = await omokPoll({
    guestId: input.guestId,
    gameId: input.gameId,
  });
  if ("error" in poll) return { ok: false, error: poll.error };
  if (poll.phase !== "playing" || !poll.turn) {
    return { ok: false, error: "game_over", message: "이미 끝난 대국이에요." };
  }
  if (!poll.turnDeadline) {
    return { ok: false, error: "no_deadline", message: "제한 시간이 없어요." };
  }
  if (Date.now() < new Date(poll.turnDeadline).getTime()) {
    return { ok: false, error: "not_expired", message: "아직 시간이 남았어요." };
  }

  const stoneToMove = poll.turn;
  const board = boardFromObject(poll.board);
  const move = pickRandomLegalMove(board, stoneToMove);
  if (!move) {
    return { ok: false, error: "no_move", message: "둘 곳이 없어요." };
  }

  const placed = tryPlace(board, move.x, move.y, stoneToMove);
  if (!placed.ok) {
    return { ok: false, error: placed.error, message: placed.message };
  }

  let status = "playing";
  let nextTurn: Stone = opponent(stoneToMove);
  if (placed.won) {
    status = stoneToMove === "black" ? "black_win" : "white_win";
  } else if (boardIsFull(placed.board)) {
    status = "draw";
  }

  const moveCount = poll.moveCount + 1;
  const supabase = await createClient();
  const id = await identityArgs(input.guestId);

  const { data, error } = await supabase.rpc("pm_omok_timeout_apply_move", {
    ...id,
    p_game_id: input.gameId,
    p_x: move.x,
    p_y: move.y,
    p_board: boardToObject(placed.board),
    p_next_turn: nextTurn,
    p_status: status,
    p_move_count: moveCount,
  });

  if (error) {
    console.error("[pm] pm_omok_timeout_apply_move:", error.message);
    return { ok: false, error: "apply_failed", message: "자동 수를 반영하지 못했어요." };
  }

  const row = firstRow(data) as {
    ok: boolean;
    board: Record<string, Stone>;
    turn: string;
    status: string;
    last_x: number;
    last_y: number;
    move_count: number;
    error_code: string | null;
    turn_deadline: string | null;
  } | null;

  if (!row?.ok) {
    return {
      ok: false,
      error: row?.error_code ?? "apply_failed",
      message:
        row?.error_code === "not_expired"
          ? "아직 시간이 남았어요."
          : "자동 수를 반영하지 못했어요.",
    };
  }

  let outcome: "win" | "loss" | "draw" | null = null;
  if (poll.myStone) {
    if (row.status === "black_win") {
      outcome = poll.myStone === "black" ? "win" : "loss";
    } else if (row.status === "white_win") {
      outcome = poll.myStone === "white" ? "win" : "loss";
    } else if (row.status === "draw") {
      outcome = "draw";
    }
  }

  return {
    ok: true,
    board: row.board ?? boardToObject(placed.board),
    turn: (row.turn === "white" ? "white" : "black") as Stone,
    status: row.status,
    lastX: row.last_x,
    lastY: row.last_y,
    moveCount: row.move_count,
    outcome,
    turnDeadline: row.turn_deadline ?? null,
    autoX: move.x,
    autoY: move.y,
    autoStone: stoneToMove,
  };
}

export async function omokClaimResult(input: {
  guestId?: string | null;
  gameId: string;
}): Promise<
  | {
      ok: true;
      myScore: number;
      outcome: "win" | "loss" | "draw";
      alreadyClaimed: boolean;
    }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const id = await identityArgs(input.guestId);
  const { data, error } = await supabase.rpc("pm_omok_claim_result", {
    ...id,
    p_game_id: input.gameId,
  });

  if (error) {
    console.error("[pm] pm_omok_claim_result:", error.message);
    return { ok: false, error: "결과를 확인하지 못했어요." };
  }

  const row = firstRow(data) as {
    ok: boolean;
    my_score: number;
    outcome: string;
    already_claimed: boolean;
    game_status: string;
  } | null;

  if (!row?.ok) return { ok: false, error: "아직 대국이 끝나지 않았어요." };

  const outcome =
    row.outcome === "win" || row.outcome === "loss" || row.outcome === "draw"
      ? row.outcome
      : "draw";

  return {
    ok: true,
    myScore: row.my_score,
    outcome,
    alreadyClaimed: Boolean(row.already_claimed),
  };
}

/** Lobby bootstrap: class queue eligibility + opaque session token for client RPC polls. */
export async function omokCanUseClassQueue(): Promise<{
  canUseClass: boolean;
  displayName: string | null;
  sessionToken: string | null;
  classId: string | null;
}> {
  const token = await getStudentSessionToken();
  if (!token) {
    return {
      canUseClass: false,
      displayName: null,
      sessionToken: null,
      classId: null,
    };
  }

  const { getStudentSession } = await import("@/lib/student-session");
  const session = await getStudentSession();
  return {
    canUseClass: Boolean(session?.classId),
    displayName: session?.displayName ?? null,
    sessionToken: token,
    classId: session?.classId ?? null,
  };
}
