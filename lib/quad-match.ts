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
  type QuadShape,
  type RpsChoice,
  type Stone,
} from "@/lib/quadrilateral-maker-math";
import type { QuadGamePhase, QuadPollState, QuadQueueScope } from "@/lib/quad-types";

export type { QuadPollState, QuadQueueScope } from "@/lib/quad-types";
export { QUAD_TURN_SECONDS } from "@/lib/quad-types";

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

function parseShape(s: string | null): QuadShape | null {
  if (
    s === "parallelogram" ||
    s === "rectangle" ||
    s === "rhombus" ||
    s === "square"
  ) {
    return s;
  }
  return null;
}

function parseRps(s: string | null): RpsChoice | null {
  if (s === "rock" || s === "paper" || s === "scissors") return s;
  return null;
}

function parseGamePhase(s: string | null): QuadGamePhase | null {
  if (
    s === "rps" ||
    s === "shape_winner" ||
    s === "shape_loser" ||
    s === "playing"
  ) {
    return s;
  }
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
  opponent_name: string | null;
  turn_deadline: string | null;
  rps_winner_key: string | null;
  shape_black: string | null;
  shape_white: string | null;
  my_rps_choice: string | null;
  opponent_rps_choice: string | null;
  shape_picker_role: string | null;
}): QuadPollState {
  const phase =
    row.phase === "waiting" ||
    row.phase === "rps" ||
    row.phase === "shape_pick" ||
    row.phase === "playing" ||
    row.phase === "ended"
      ? row.phase
      : "idle";

  const myStone =
    row.my_stone === "black" || row.my_stone === "white"
      ? row.my_stone
      : null;

  const shapeBlack = parseShape(row.shape_black);
  const shapeWhite = parseShape(row.shape_white);

  let shapePickerRole: "winner" | "loser" | null = null;
  if (phase === "shape_pick" && row.shape_picker_role === "me") {
    shapePickerRole =
      row.game_phase === "shape_winner" ? "winner" : "loser";
  }

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
    opponentName: row.opponent_name,
    turnDeadline: row.turn_deadline ?? null,
    rpsWinnerKey: row.rps_winner_key,
    shapeBlack,
    shapeWhite,
    myRpsChoice: parseRps(row.my_rps_choice),
    opponentRpsChoice: parseRps(row.opponent_rps_choice),
    shapePickerRole,
    myShape:
      myStone === "black"
        ? shapeBlack
        : myStone === "white"
          ? shapeWhite
          : null,
    opponentShape:
      myStone === "black"
        ? shapeWhite
        : myStone === "white"
          ? shapeBlack
          : null,
  };
}

export async function quadJoinQueue(input: {
  scope: QuadQueueScope;
  guestId?: string | null;
}) {
  const supabase = await createClient();
  const id = await identityArgs(input.guestId);
  if (!id.p_session_token && !id.p_guest_id) {
    return { error: "게스트 ID 또는 학생 로그인이 필요해요." };
  }

  const { data, error } = await supabase.rpc("pm_quad_join_queue", {
    ...id,
    p_scope: input.scope,
  });

  if (error) {
    console.error("[pm] pm_quad_join_queue:", error.message);
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

export async function quadExpandGlobal(input: { guestId?: string | null }) {
  const supabase = await createClient();
  const id = await identityArgs(input.guestId);
  const { data, error } = await supabase.rpc("pm_quad_expand_queue_global", id);

  if (error) {
    console.error("[pm] pm_quad_expand_queue_global:", error.message);
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

export async function quadLeaveQueue(input: { guestId?: string | null }) {
  const supabase = await createClient();
  const id = await identityArgs(input.guestId);
  const { error } = await supabase.rpc("pm_quad_leave_queue", id);
  if (error) {
    console.error("[pm] pm_quad_leave_queue:", error.message);
    return { ok: false, error: "대기 취소를 실패했어요." };
  }
  return { ok: true };
}

export async function quadPoll(input: {
  guestId?: string | null;
  gameId?: string | null;
}): Promise<QuadPollState | { error: string }> {
  const supabase = await createClient();
  const id = await identityArgs(input.guestId);
  if (!id.p_session_token && !id.p_guest_id) {
    return { error: "신원 정보가 없어요." };
  }

  const { data, error } = await supabase.rpc("pm_quad_poll", {
    ...id,
    p_game_id: input.gameId ?? null,
  });

  if (error) {
    console.error("[pm] pm_quad_poll:", error.message);
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
      opponentName: null,
      turnDeadline: null,
      rpsWinnerKey: null,
      shapeBlack: null,
      shapeWhite: null,
      myRpsChoice: null,
      opponentRpsChoice: null,
      shapePickerRole: null,
      myShape: null,
      opponentShape: null,
    };
  }

  return mapPollRow(row as Parameters<typeof mapPollRow>[0]);
}

export async function quadSubmitRps(input: {
  guestId?: string | null;
  gameId: string;
  choice: RpsChoice;
}) {
  const supabase = await createClient();
  const id = await identityArgs(input.guestId);
  const { data, error } = await supabase.rpc("pm_quad_submit_rps", {
    ...id,
    p_game_id: input.gameId,
    p_choice: input.choice,
  });

  if (error) {
    console.error("[pm] pm_quad_submit_rps:", error.message);
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

export async function quadPickShape(input: {
  guestId?: string | null;
  gameId: string;
  shape: QuadShape;
}) {
  const supabase = await createClient();
  const id = await identityArgs(input.guestId);
  const { data, error } = await supabase.rpc("pm_quad_pick_shape", {
    ...id,
    p_game_id: input.gameId,
    p_shape: input.shape,
  });

  if (error) {
    console.error("[pm] pm_quad_pick_shape:", error.message);
    return { ok: false as const, error: "도형을 선택하지 못했어요." };
  }

  const row = firstRow(data) as {
    ok: boolean;
    game_phase: string;
    error_code: string | null;
  } | null;

  if (!row?.ok) {
    return {
      ok: false as const,
      error: row?.error_code ?? "pick_failed",
    };
  }

  return { ok: true as const, gamePhase: row.game_phase };
}

export async function quadPlaceMove(input: {
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
  const poll = await quadPoll({
    guestId: input.guestId,
    gameId: input.gameId,
  });
  if ("error" in poll) return { ok: false, error: poll.error };
  if (poll.phase !== "playing" || !poll.myStone || !poll.turn || !poll.myShape) {
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
  const placed = tryPlace(board, input.x, input.y, poll.myStone, poll.myShape);
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

  const { data, error } = await supabase.rpc("pm_quad_apply_move", {
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
    console.error("[pm] pm_quad_apply_move:", error.message);
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

export async function quadTimeoutMove(input: {
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
  const poll = await quadPoll({
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
  const targetShape =
    stoneToMove === "black" ? poll.shapeBlack : poll.shapeWhite;
  if (!targetShape) {
    return { ok: false, error: "no_shape", message: "도형 정보가 없어요." };
  }

  const board = boardFromObject(poll.board);
  const move = pickRandomLegalMove(board, stoneToMove, targetShape);
  if (!move) {
    return { ok: false, error: "no_move", message: "둘 곳이 없어요." };
  }

  const placed = tryPlace(board, move.x, move.y, stoneToMove, targetShape);
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

  const { data, error } = await supabase.rpc("pm_quad_timeout_apply_move", {
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
    console.error("[pm] pm_quad_timeout_apply_move:", error.message);
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

export async function quadClaimResult(input: {
  guestId?: string | null;
  gameId: string;
}) {
  const supabase = await createClient();
  const id = await identityArgs(input.guestId);
  const { data, error } = await supabase.rpc("pm_quad_claim_result", {
    ...id,
    p_game_id: input.gameId,
  });

  if (error) {
    console.error("[pm] pm_quad_claim_result:", error.message);
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

export async function quadCanUseClassQueue(): Promise<{
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
