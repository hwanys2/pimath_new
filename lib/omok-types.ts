/** Shared omok matchmaking types (safe for client + server). */

export type OmokQueueScope = "class" | "global";

export type OmokStone = "black" | "white";

/** Seconds allowed per PvP turn before a random legal move is forced. */
export const OMOK_TURN_SECONDS = 20;

export type OmokPollState = {
  phase: "idle" | "waiting" | "playing" | "ended";
  queueId: string | null;
  queueScope: OmokQueueScope | null;
  queueStatus: string | null;
  gameId: string | null;
  gameStatus: string | null;
  scope: string | null;
  board: Record<string, OmokStone>;
  turn: OmokStone | null;
  blackKey: string | null;
  whiteKey: string | null;
  blackName: string | null;
  whiteName: string | null;
  myKey: string | null;
  myStone: OmokStone | null;
  lastX: number | null;
  lastY: number | null;
  moveCount: number;
  myScore: number | null;
  opponentName: string | null;
  /** ISO timestamp when current turn expires (PvP). */
  turnDeadline: string | null;
};
