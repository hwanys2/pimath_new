/** Shared quadrilateral-maker matchmaking types (safe for client + server). */

import type { QuadShape, RpsChoice, Stone } from "@/lib/quadrilateral-maker-math";

export type QuadQueueScope = "class" | "global";

/** Seconds allowed per PvP turn before a random legal move is forced. */
export const QUAD_TURN_SECONDS = 20;

export type QuadGamePhase =
  | "rps"
  | "shape_winner"
  | "shape_loser"
  | "playing";

export type QuadPollState = {
  phase: "idle" | "waiting" | "rps" | "shape_pick" | "playing" | "ended";
  queueId: string | null;
  queueScope: QuadQueueScope | null;
  queueStatus: string | null;
  gameId: string | null;
  gameStatus: string | null;
  gamePhase: QuadGamePhase | null;
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
  turnDeadline: string | null;
  rpsWinnerKey: string | null;
  shapeBlack: QuadShape | null;
  shapeWhite: QuadShape | null;
  myRpsChoice: RpsChoice | null;
  opponentRpsChoice: RpsChoice | null;
  /** Who must pick shape now: winner or loser (null if not shape_pick). */
  shapePickerRole: "winner" | "loser" | null;
  myShape: QuadShape | null;
  opponentShape: QuadShape | null;
};
