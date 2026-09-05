import type { RpsChoice, Stone } from "@/lib/quadrilateral-maker-math";
import type { SqGamePhase, SqPollState } from "@/lib/sq-types";
import { firstRpcRow } from "@/lib/omok-poll-shared";

export { firstRpcRow };

export type SqPollRpcRow = {
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
};

function parseRps(s: string | null): RpsChoice | null {
  if (s === "rock" || s === "paper" || s === "scissors") return s;
  return null;
}

function parseGamePhase(s: string | null): SqGamePhase | null {
  if (s === "rps" || s === "playing") return s;
  return null;
}

const IDLE: SqPollState = {
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

export function mapSqPollRow(row: SqPollRpcRow | null): SqPollState {
  if (!row) return IDLE;

  const phase =
    row.phase === "waiting" ||
    row.phase === "rps" ||
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
    gamePhase: parseGamePhase(row.game_phase),
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
    winnerArea: row.winner_area,
    winnerAxisAligned: row.winner_axis_aligned,
    opponentName: row.opponent_name,
    turnDeadline: row.turn_deadline ?? null,
    rpsWinnerKey: row.rps_winner_key,
    myRpsChoice: parseRps(row.my_rps_choice),
    opponentRpsChoice: parseRps(row.opponent_rps_choice),
  };
}
