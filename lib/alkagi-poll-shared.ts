import type {
  AlkagiLastShot,
  AlkagiPollState,
  AlkagiStone,
  AlkagiStoneColor,
} from "./alkagi-types";
import { firstRpcRow } from "@/lib/omok-poll-shared";

export { firstRpcRow };

export type AlkagiPollRpcRow = {
  phase: string;
  queue_id: string | null;
  queue_scope: string | null;
  queue_status: string | null;
  game_id: string | null;
  game_status: string | null;
  scope: string | null;
  board: AlkagiStone[] | null;
  turn: string | null;
  black_key: string | null;
  white_key: string | null;
  black_name: string | null;
  white_name: string | null;
  my_key: string | null;
  my_color: string | null;
  last_shot: AlkagiLastShot | null;
  move_count: number | null;
  my_score: number | null;
  opponent_name: string | null;
  turn_deadline: string | null;
};

const IDLE: AlkagiPollState = {
  phase: "idle",
  queueId: null,
  queueScope: null,
  queueStatus: null,
  gameId: null,
  gameStatus: null,
  scope: null,
  stones: [],
  turn: null,
  blackKey: null,
  whiteKey: null,
  blackName: null,
  whiteName: null,
  myKey: null,
  myColor: null,
  lastShot: null,
  moveCount: 0,
  myScore: null,
  opponentName: null,
  turnDeadline: null,
};

export function mapAlkagiPollRow(row: AlkagiPollRpcRow | null): AlkagiPollState {
  if (!row) return IDLE;

  const phase =
    row.phase === "waiting" || row.phase === "playing" || row.phase === "ended"
      ? row.phase
      : "idle";

  const turn: AlkagiStoneColor | null =
    row.turn === "black" || row.turn === "white" ? row.turn : null;
  const myColor: AlkagiStoneColor | null =
    row.my_color === "black" || row.my_color === "white" ? row.my_color : null;

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
    stones: Array.isArray(row.board) ? row.board : [],
    turn,
    blackKey: row.black_key,
    whiteKey: row.white_key,
    blackName: row.black_name,
    whiteName: row.white_name,
    myKey: row.my_key,
    myColor,
    lastShot: row.last_shot,
    moveCount: row.move_count ?? 0,
    myScore: row.my_score,
    opponentName: row.opponent_name,
    turnDeadline: row.turn_deadline ?? null,
  };
}
