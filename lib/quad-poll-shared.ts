import type { QuadShape, RpsChoice, Stone } from "@/lib/quadrilateral-maker-math";
import type { QuadGamePhase, QuadPollState } from "@/lib/quad-types";
import { firstRpcRow } from "@/lib/omok-poll-shared";

export { firstRpcRow };

export type QuadPollRpcRow = {
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
};

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

const IDLE: QuadPollState = {
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

export function mapQuadPollRow(row: QuadPollRpcRow | null): QuadPollState {
  if (!row) return IDLE;

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
