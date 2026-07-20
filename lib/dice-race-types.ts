/** Shared dice-sum race session types (client + server safe). */

import type { SumCounts } from "@/lib/dice-race-math";

export type DiceRacePhase =
  | "lobby"
  | "picking"
  | "rolling"
  | "round_end"
  | "closed";

export type DiceRacePlayerRow = {
  studentId: string;
  displayName: string;
  pick: number | null;
  sessionScore: number;
  roundScore: number;
  xpClaimedRound: number;
  isMe: boolean;
};

export type DiceRacePollState = {
  sessionId: string | null;
  classId: string | null;
  className: string | null;
  phase: DiceRacePhase | "idle";
  roundNumber: number;
  counts: SumCounts;
  winningSum: number | null;
  lastD1: number | null;
  lastD2: number | null;
  lastSum: number | null;
  rollCount: number;
  players: DiceRacePlayerRow[];
  myPick: number | null;
  mySessionScore: number;
  myRoundScore: number;
  myXpClaimedRound: number;
};

export const DICE_RACE_POLL_MS = 1200;
