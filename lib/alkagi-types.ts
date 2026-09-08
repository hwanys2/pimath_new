/** Shared alkagi (linear function slope flicking) matchmaking types (safe for client + server). */

export type AlkagiQueueScope = "class" | "global";

export type AlkagiStoneColor = "black" | "white";

export type AlkagiStone = {
  id: string;
  color: AlkagiStoneColor;
  x: number;
  y: number;
  alive: boolean;
};

export type AlkagiShot = {
  stoneId: string;
  slope: number | null;
  isVertical: boolean;
  direction: "left" | "right";
  power: number; // 0.05 to 1.0
};

export type AlkagiLastShot = AlkagiShot & {
  shooterColor: AlkagiStoneColor;
  fromX: number;
  fromY: number;
};

export type AlkagiOutcome = "win" | "loss" | "draw";

/** Board half-extent. Grid is [-ALKAGI_BOUND, ALKAGI_BOUND] */
export const ALKAGI_BOUND = 8;

/** Stone radius in grid units. Diameter is 1.0 */
export const ALKAGI_STONE_RADIUS = 0.5;

/** Maximum initial speed of a shot (in grid units/sec) */
export const ALKAGI_MAX_SPEED = 28;

/** Seconds allowed per PvP turn before an automated move is played */
export const ALKAGI_TURN_SECONDS = 30;

export type AlkagiPollState = {
  phase: "idle" | "waiting" | "playing" | "ended";
  queueId: string | null;
  queueScope: AlkagiQueueScope | null;
  queueStatus: string | null;
  gameId: string | null;
  gameStatus: string | null;
  scope: string | null;
  stones: AlkagiStone[];
  turn: AlkagiStoneColor | null;
  blackKey: string | null;
  whiteKey: string | null;
  blackName: string | null;
  whiteName: string | null;
  myKey: string | null;
  myColor: AlkagiStoneColor | null;
  lastShot: AlkagiLastShot | null;
  moveCount: number;
  myScore: number | null;
  opponentName: string | null;
  turnDeadline: string | null;
};
