/** Shared ball-box guess session types (client + server safe). */

import type { BallColorKey, BallCounts } from "@/lib/ball-box";

export type BallBoxPhase = "lobby" | "playing" | "revealed" | "closed";

export type BallBoxPlayerRow = {
  /** Stable identity across students + guests (student id or "g:"+guestKey). */
  pid: string;
  studentId: string | null;
  displayName: string;
  drawCount: number;
  solved: boolean;
  score: number;
  /** Cumulative score across rounds/sets in this session. */
  sessionScore: number;
  isMe: boolean;
};

export type BallBoxPollState = {
  sessionId: string | null;
  classId: string | null;
  className: string | null;
  phase: BallBoxPhase | "idle";
  roundNumber: number;
  total: number;
  /** Colors students must guess (public — keys only). */
  answerColors: BallColorKey[];
  /** Full composition, only present when phase === "revealed". */
  revealedAnswer: BallCounts | null;
  /** Guest join code (teacher/guest poll only). */
  joinCode: string | null;
  players: BallBoxPlayerRow[];
  /** My own state. */
  myObserved: BallCounts;
  myDrawCount: number;
  myWrongAttempts: number;
  mySolved: boolean;
  myScore: number;
  mySessionScore: number;
};

export const BALL_BOX_POLL_MS = 1200;
