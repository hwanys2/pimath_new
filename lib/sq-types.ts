/** Shared square-maker matchmaking types (safe for client + server). */

import type { RpsChoice, Stone } from "@/lib/quadrilateral-maker-math";

export type SqQueueScope = "class" | "global";

/** Seconds allowed per PvP turn before a random legal move is forced. */
export const SQ_TURN_SECONDS = 20;

export type SqGamePhase = "rps" | "playing";

export type SqPollState = {
  phase: "idle" | "waiting" | "rps" | "playing" | "ended";
  queueId: string | null;
  queueScope: SqQueueScope | null;
  queueStatus: string | null;
  gameId: string | null;
  gameStatus: string | null;
  gamePhase: SqGamePhase | null;
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
  winnerArea: number | null;
  winnerAxisAligned: boolean | null;
  opponentName: string | null;
  turnDeadline: string | null;
  rpsWinnerKey: string | null;
  myRpsChoice: RpsChoice | null;
  opponentRpsChoice: RpsChoice | null;
};
