import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getStudentSessionToken } from "@/lib/student-session";
import {
  boardFromObject,
  boardIsFull,
  boardToObject,
  opponent,
  pickRandomLegalMove,
  type BoardMap,
  type RpsChoice,
  type Stone,
} from "@/lib/quadrilateral-maker-math";
import { tryPlaceSquare } from "@/lib/square-maker-math";
import type { SqGamePhase, SqPollState, SqQueueScope } from "@/lib/sq-types";

export type { SqPollState, SqQueueScope } from "@/lib/sq-types";
export { SQ_TURN_SECONDS } from "@/lib/sq-types";

const TARGET_SHAPE = "square" as const;

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

function parseRps(s: string | null): RpsChoice | null {
  if (s === "rock" || s === "paper" || s === "scissors") return s;
  return null;
}

function parseGamePhase(s: string | null): SqGamePhase | null {
  if (s === "rps" || s === "playing") return s;
  return null;
}

function mapPollRow(row: {
  phase: string;
  queue_id: string | null;
  queue_scope: string | null;
  queue_status: string | null;
  game_id: string | null;
  game_status: string | null;
  game_phase: string | null;
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
  winner_area: number | null;
  winner_axis_aligned: boolean | null;
  opponent_name: string | null;
  turn_deadline: string | null;
  rps_winner_key: string | null;
  my_rps_choice: string | null;
  opponent_rps_choice: string | null;
}): SqPollState {
  const phase =
    row.phase === "waiting" ||
    row.phase === "rps" ||
    row.phase === "playing" ||
    row.phase === "ended"
      ? row.phase
      : "idle";

  const myStone =
    row.my_stone === "black" || row.my_stone === "white"
      ? row.my_stone
      : null;

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
    gamePhase: parseGamePhase(row.game_phase),
    scope: row.scope,
    board: row.board ?? {},
    turn: row.turn === "black" || row.turn === "white" ? row.turn : null,
    blackKey: row.black_key,
    whiteKey: row.white_key,
    blackName: row.black_name,
    whiteName: row.white_name,
    myKey: row.my_key,
    myStone,
    lastX: row.last_x,
    lastY: row.last_y,
    moveCount: row.move_count ?? 0,
    myScore: row.my_score,
    winnerArea: row.winner_area,
    winnerAxisAligned: row.winner_axis_aligned,
    opponentName: row.opponent_name,
    turnDeadline: row.turn_deadline ?? null,
    rpsWinnerKey: row.rps_winner_key,
    myRpsChoice: parseRps(row.my_rps_choice),
    opponentRpsChoice: parseRps(row.opponent_rps_choice),
  };
}

export async function sqJoinQueue(input: {
  scope: SqQueueScope;
  guestId?: string | null;
}) {
  const supabase = await createClient();
  const id = await identityArgs(input.guestId);
  if (!id.p_session_token && !id.p_guest_id) {
    return { error: "게스트 ID 또는 학생 로그인이 필요해요." };
  }

  const { data, error } = await supabase.rpc("pm_sq_join_queue", {
    ...id,
    p_scope: input.scope,
  });

  if (error) {
    console.error("[pm] pm_sq_join_queue:", error.message);
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

export async function sqExpandGlobal(input: { guestId?: string | null }) {
  const supabase = await createClient();
  const id = await identityArgs(input.guestId);
  const { data, error } = await supabase.rpc("pm_sq_expand_queue_global", id);

  if (error) {
    console.error("[pm] pm_sq_expand_queue_global:", error.message);
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

export async function sqLeaveQueue(input: { guestId?: string | null }) {
  const supabase = await createClient();
  const id = await identityArgs(input.guestId);
  const { error } = await supabase.rpc("pm_sq_leave_queue", id);
  if (error) {
    console.error("[pm] pm_sq_leave_queue:", error.message);
    return { ok: false, error: "대기 취소를 실패했어요." };
  }
  return { ok: true };
}

export async function sqPoll(input: {
  guestId?: string | null;
  gameId?: string | null;
}): Promise<SqPollState | { error: string }> {
  const supabase = await createClient();
  const id = await identityArgs(input.guestId);
  if (!id.p_session_token && !id.p_guest_id) {
    return { error: "신원 정보가 없어요." };
  }

  const { data, error } = await supabase.rpc("pm_sq_poll", {
    ...id,
    p_game_id: input.gameId ?? null,
  });

  if (error) {
    console.error("[pm] pm_sq_poll:", error.message);
    return { error: "상태를 불러오지 못했어요." };
  }

  const row = firstRow(data);
  if (!row) {
    return {
      phase: "idle",
      queueId: null,
      queueScope: null,
      queueStatus: null,
      gameId: null,
      gameStatus: null,
      gamePhase: null,
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
      winnerArea: null,
      winnerAxisAligned: null,
      opponentName: null,
      turnDeadline: null,
      rpsWinnerKey: null,
      myRpsChoice: null,
      opponentRpsChoice: null,
    };
  }

  return mapPollRow(row as Parameters<typeof mapPollRow>[0]);
}

export async function sqSubmitRps(input: {
  guestId?: string | null;
  gameId: string;
  choice: RpsChoice;
}) {
  const supabase = await createClient();
  const id = await identityArgs(input.guestId);
  const { data, error } = await supabase.rpc("pm_sq_submit_rps", {
    ...id,
    p_game_id: input.gameId,
    p_choice: input.choice,
  });

  if (error) {
    console.error("[pm] pm_sq_submit_rps:", error.message);
    return { ok: false as const, error: "가위바위보를 제출하지 못했어요." };
  }

  const row = firstRow(data) as {
    ok: boolean;
    game_phase: string;
    rps_tie: boolean;
    error_code: string | null;
  } | null;

  if (!row?.ok) {
    return {
      ok: false as const,
      error: row?.error_code ?? "submit_failed",
    };
  }

  return {
    ok: true as const,
    gamePhase: row.game_phase,
    rpsTie: Boolean(row.rps_tie),
  };
}

export async function sqPlaceMove(input: {
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
      winnerArea: number | null;
      winnerAxisAligned: boolean | null;
    }
  | { ok: false; error: string; message?: string }
> {
  const poll = await sqPoll({
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
      message: "상대 차례예요.",
    };
  }

  const board: BoardMap = boardFromObject(poll.board);
  const placed = tryPlaceSquare(board, input.x, input.y, poll.myStone);
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

  const { data, error } = await supabase.rpc("pm_sq_apply_move", {
    ...id,
    p_game_id: input.gameId,
    p_x: input.x,
    p_y: input.y,
    p_board: boardToObject(placed.board),
    p_next_turn: nextTurn,
    p_status: status,
    p_move_count: moveCount,
    p_winner_area: placed.winInfo?.area ?? null,
    p_winner_axis_aligned: placed.winInfo?.axisAligned ?? null,
  });

  if (error) {
    console.error("[pm] pm_sq_apply_move:", error.message);
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
    winnerArea: placed.winInfo?.area ?? null,
    winnerAxisAligned: placed.winInfo?.axisAligned ?? null,
  };
}

export async function sqTimeoutMove(input: {
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
      winnerArea: number | null;
      winnerAxisAligned: boolean | null;
    }
  | { ok: false; error: string; message?: string }
> {
  const poll = await sqPoll({
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
  const move = pickRandomLegalMove(board, stoneToMove, TARGET_SHAPE);
  if (!move) {
    return { ok: false, error: "no_move", message: "둘 곳이 없어요." };
  }

  const placed = tryPlaceSquare(board, move.x, move.y, stoneToMove);
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

  const { data, error } = await supabase.rpc("pm_sq_timeout_apply_move", {
    ...id,
    p_game_id: input.gameId,
    p_x: move.x,
    p_y: move.y,
    p_board: boardToObject(placed.board),
    p_next_turn: nextTurn,
    p_status: status,
    p_move_count: moveCount,
    p_winner_area: placed.winInfo?.area ?? null,
    p_winner_axis_aligned: placed.winInfo?.axisAligned ?? null,
  });

  if (error) {
    console.error("[pm] pm_sq_timeout_apply_move:", error.message);
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
    winnerArea: placed.winInfo?.area ?? null,
    winnerAxisAligned: placed.winInfo?.axisAligned ?? null,
  };
}

export async function sqClaimResult(input: {
  guestId?: string | null;
  gameId: string;
}) {
  const supabase = await createClient();
  const id = await identityArgs(input.guestId);
  const { data, error } = await supabase.rpc("pm_sq_claim_result", {
    ...id,
    p_game_id: input.gameId,
  });

  if (error) {
    console.error("[pm] pm_sq_claim_result:", error.message);
    return { ok: false as const, error: "결과를 확인하지 못했어요." };
  }

  const row = firstRow(data) as {
    ok: boolean;
    my_score: number;
    outcome: string;
    already_claimed: boolean;
    game_status: string;
  } | null;

  if (!row?.ok) {
    return { ok: false as const, error: "아직 대국이 끝나지 않았어요." };
  }

  const outcome =
    row.outcome === "win" || row.outcome === "loss" || row.outcome === "draw"
      ? row.outcome
      : "draw";

  return {
    ok: true as const,
    myScore: row.my_score,
    outcome,
    alreadyClaimed: Boolean(row.already_claimed),
  };
}

export async function sqCanUseClassQueue(): Promise<{
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
