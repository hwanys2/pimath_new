import type { OmokPollState, OmokStone } from "@/lib/omok-types";

export function firstRpcRow<T>(data: T | T[] | null): T | null {
  if (!data) return null;
  return Array.isArray(data) ? (data[0] ?? null) : data;
}

export type OmokPollRpcRow = {
  phase: string;
  queue_id: string | null;
  queue_scope: string | null;
  queue_status: string | null;
  game_id: string | null;
  game_status: string | null;
  scope: string | null;
  board: Record<string, OmokStone> | null;
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
};

const IDLE_POLL: OmokPollState = {
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
  turnDeadline: null,
};

export function mapOmokPollRow(
  row: OmokPollRpcRow | null,
): OmokPollState {
  if (!row) return IDLE_POLL;

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
    turnDeadline: row.turn_deadline ?? null,
  };
}
