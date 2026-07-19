import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getStudentSessionToken } from "@/lib/student-session";
import {
  boardFromObject,
  boardIsFull,
  boardToObject,
  opponent,
  tryPlace,
  type BoardMap,
  type Stone,
} from "@/lib/ordered-pair-omok-math";

export type OmokQueueScope = "class" | "global";

export type OmokPollState = {
  phase: "idle" | "waiting" | "playing" | "ended";
  queueId: string | null;
  queueScope: OmokQueueScope | null;
  queueStatus: string | null;
  gameId: string | null;
  gameStatus: string | null;
  scope: string | null;
  board: Record<string, Stone>;
  turn: Stone | null;
  blackKey: string | null;
  whiteKey: string | null;
  blackName: string | null;
  whiteName: string | null;
  myKey: string | null;
  myStone: Stone | null;
  lastX: number | null;
  lastY: number | null;
  moveCount: number;
  myScore: number | null;
  opponentName: string | null;
};

function firstRow<T>(data: T | T[] | null): T | null {
  if (!data) return null;
  return Array.isArray(data) ? (data[0] ?? null) : data;
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

  const row = firstRow(data) as {
    phase: string;
    queue_id: string | null;
    queue_scope: string | null;
    queue_status: string | null;
    game_id: string | null;
    game_status: string | null;
    scope: string | null;
    board: Record<string, Stone> | null;
    turn: string | null;
    black_key: string | null;
    white_key: string | null;
    black_name: string | null;
    white_name: string | null;
    my_key: string | null;
    my_stone: string | null;
    last_x: number | null;
    last_y: number | null;
    move_count: number | null;
    my_score: number | null;
    opponent_name: string | null;
  } | null;

  if (!row) {
    return {
      phase: "idle",
      queueId: null,
      queueScope: null,
      queueStatus: null,
      gameId: null,
      gameStatus: null,
      scope: null,
      board: {},
      turn: null,
      blackKey: null,
      whiteKey: null,
      blackName: null,
      whiteName: null,
      myKey: null,
      myStone: null,
      lastX: null,
      lastY: null,
      moveCount: 0,
      myScore: null,
      opponentName: null,
    };
  }

  const phase =
    row.phase === "waiting" ||
    row.phase === "playing" ||
    row.phase === "ended"
      ? row.phase
      : "idle";

  return {
    phase,
    queueId: row.queue_id,
    queueScope:
      row.queue_scope === "class"
        ? "class"
        : row.queue_scope === "global"
          ? "global"
          : null,
    queueStatus: row.queue_status,
    gameId: row.game_id,
    gameStatus: row.game_status,
    scope: row.scope,
    board: row.board ?? {},
    turn: row.turn === "black" || row.turn === "white" ? row.turn : null,
    blackKey: row.black_key,
    whiteKey: row.white_key,
    blackName: row.black_name,
    whiteName: row.white_name,
    myKey: row.my_key,
    myStone:
      row.my_stone === "black" || row.my_stone === "white"
        ? row.my_stone
        : null,
    lastX: row.last_x,
    lastY: row.last_y,
    moveCount: row.move_count ?? 0,
    myScore: row.my_score,
    opponentName: row.opponent_name,
  };
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
      myScore: number | null;
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
  } | null;

  if (!row?.ok) {
    return {
      ok: false,
      error: row?.error_code ?? "apply_failed",
      message: "수를 반영하지 못했어요.",
    };
  }

  let myScore: number | null = null;
  if (row.status === "black_win") {
    myScore = poll.myStone === "black" ? 300 : 100;
  } else if (row.status === "white_win") {
    myScore = poll.myStone === "white" ? 300 : 100;
  } else if (row.status === "draw") {
    myScore = 150;
  }

  return {
    ok: true,
    board: row.board ?? boardToObject(placed.board),
    turn: (row.turn === "white" ? "white" : "black") as Stone,
    status: row.status,
    lastX: row.last_x,
    lastY: row.last_y,
    moveCount: row.move_count,
    myScore,
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

/** Whether the current visitor can use class matchmaking. */
export async function omokCanUseClassQueue(): Promise<{
  canUseClass: boolean;
  displayName: string | null;
}> {
  const token = await getStudentSessionToken();
  if (!token) return { canUseClass: false, displayName: null };

  const { getStudentSession } = await import("@/lib/student-session");
  const session = await getStudentSession();
  return {
    canUseClass: Boolean(session?.classId),
    displayName: session?.displayName ?? null,
  };
}
