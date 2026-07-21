"use server";

import { submitGameRun } from "@/app/adventure/actions";
import {
  diceRaceClaimRoundXp,
  diceRaceClose,
  diceRaceCreateGuestSession,
  diceRaceCreateSession,
  diceRaceFindActiveForStudent,
  diceRaceFindActiveForTeacher,
  diceRaceFindByCode,
  diceRaceGuestJoin,
  diceRaceGuestPick,
  diceRaceGuestPoll,
  diceRaceJoin,
  diceRaceNextRound,
  diceRaceOpenPicking,
  diceRacePick,
  diceRaceRoll,
  diceRaceStartRolling,
  diceRaceStudentPoll,
  diceRaceTeacherFindGuest,
  diceRaceTeacherPoll,
} from "@/lib/dice-race-match";

const CONTENT_KEY = "g2-u4-dice-sum-race";

export async function diceRaceCreateSessionAction(input: { classId: string }) {
  return diceRaceCreateSession(input);
}

export async function diceRaceOpenPickingAction(input: { sessionId: string }) {
  return diceRaceOpenPicking(input);
}

export async function diceRaceJoinAction(input: { classId: string }) {
  return diceRaceJoin(input);
}

export async function diceRacePickAction(input: {
  sessionId: string;
  pick: number;
}) {
  return diceRacePick(input);
}

export async function diceRaceStartRollingAction(input: { sessionId: string }) {
  return diceRaceStartRolling(input);
}

export async function diceRaceRollAction(input: { sessionId: string }) {
  return diceRaceRoll(input);
}

export async function diceRaceNextRoundAction(input: { sessionId: string }) {
  return diceRaceNextRound(input);
}

export async function diceRaceCloseAction(input: { sessionId: string }) {
  return diceRaceClose(input);
}

export async function diceRaceStudentPollAction(input: { sessionId: string }) {
  return diceRaceStudentPoll(input);
}

export async function diceRaceTeacherPollAction(input: { sessionId: string }) {
  return diceRaceTeacherPoll(input);
}

export async function diceRaceFindActiveStudentAction(input: {
  classId: string;
}) {
  return diceRaceFindActiveForStudent(input);
}

export async function diceRaceFindActiveTeacherAction(input: {
  classId: string;
}) {
  return diceRaceFindActiveForTeacher(input);
}

export async function diceRaceClaimRoundXpAction(input: { sessionId: string }) {
  const claim = await diceRaceClaimRoundXp(input);
  if ("error" in claim) return claim;
  if (claim.alreadyClaimed || claim.roundScore <= 0) {
    return {
      claim,
      xp: null,
    };
  }

  const xp = await submitGameRun({
    contentKey: CONTENT_KEY,
    score: claim.roundScore,
  });

  return { claim, xp };
}

// ---------------------------------------------------------------------------
// Guest (QR, no class) actions
// ---------------------------------------------------------------------------

export async function diceRaceCreateGuestSessionAction() {
  return diceRaceCreateGuestSession();
}

export async function diceRaceTeacherFindGuestAction() {
  return diceRaceTeacherFindGuest();
}

export async function diceRaceFindByCodeAction(input: { joinCode: string }) {
  return diceRaceFindByCode(input);
}

export async function diceRaceGuestJoinAction(input: {
  joinCode: string;
  guestKey: string;
  name: string;
}) {
  return diceRaceGuestJoin(input);
}

export async function diceRaceGuestPickAction(input: {
  guestKey: string;
  sessionId: string;
  pick: number;
}) {
  return diceRaceGuestPick(input);
}

export async function diceRaceGuestPollAction(input: {
  guestKey: string;
  sessionId: string;
}) {
  return diceRaceGuestPoll(input);
}
