"use server";

import { submitGameRun } from "@/app/adventure/actions";
import {
  ballBoxClose,
  ballBoxCreateGuestSession,
  ballBoxCreateSession,
  ballBoxDraw,
  ballBoxFindActiveForStudent,
  ballBoxFindActiveForTeacher,
  ballBoxFindByCode,
  ballBoxGuess,
  ballBoxGuestDraw,
  ballBoxGuestGuess,
  ballBoxGuestJoin,
  ballBoxGuestPoll,
  ballBoxJoin,
  ballBoxNextRound,
  ballBoxReveal,
  ballBoxStart,
  ballBoxStudentPoll,
  ballBoxTeacherFindGuest,
  ballBoxTeacherPoll,
} from "@/lib/ball-box-match";

const CONTENT_KEY = "g2-u4-ball-box-guess";

export async function ballBoxCreateSessionAction(input: { classId: string }) {
  return ballBoxCreateSession(input);
}

export async function ballBoxStartAction(input: {
  sessionId: string;
  answer: Record<string, number>;
}) {
  return ballBoxStart(input);
}

export async function ballBoxRevealAction(input: { sessionId: string }) {
  return ballBoxReveal(input);
}

export async function ballBoxNextRoundAction(input: {
  sessionId: string;
  answer: Record<string, number>;
}) {
  return ballBoxNextRound(input);
}

export async function ballBoxCloseAction(input: { sessionId: string }) {
  return ballBoxClose(input);
}

export async function ballBoxJoinAction(input: { classId: string }) {
  return ballBoxJoin(input);
}

export async function ballBoxDrawAction(input: { sessionId: string }) {
  return ballBoxDraw(input);
}

export async function ballBoxStudentPollAction(input: { sessionId: string }) {
  return ballBoxStudentPoll(input);
}

export async function ballBoxTeacherPollAction(input: { sessionId: string }) {
  return ballBoxTeacherPoll(input);
}

export async function ballBoxFindActiveStudentAction(input: {
  classId: string;
}) {
  return ballBoxFindActiveForStudent(input);
}

export async function ballBoxFindActiveTeacherAction(input: {
  classId: string;
}) {
  return ballBoxFindActiveForTeacher(input);
}

export async function ballBoxGuessAction(input: {
  sessionId: string;
  guess: Record<string, number>;
}) {
  const result = await ballBoxGuess(input);
  if ("error" in result) {
    return { error: result.error, result: null, xp: null };
  }

  // XP + ranking only on a first-time correct solve with a positive score.
  if (!result.correct || result.alreadySolved || result.score <= 0) {
    return { error: null, result, xp: null };
  }

  const xp = await submitGameRun({
    contentKey: CONTENT_KEY,
    score: result.score,
  });

  return { error: null, result, xp };
}

// ---------------------------------------------------------------------------
// Guest (QR, no class) actions
// ---------------------------------------------------------------------------

export async function ballBoxCreateGuestSessionAction() {
  return ballBoxCreateGuestSession();
}

export async function ballBoxTeacherFindGuestAction() {
  return ballBoxTeacherFindGuest();
}

export async function ballBoxFindByCodeAction(input: { joinCode: string }) {
  return ballBoxFindByCode(input);
}

export async function ballBoxGuestJoinAction(input: {
  joinCode: string;
  guestKey: string;
  name: string;
}) {
  return ballBoxGuestJoin(input);
}

export async function ballBoxGuestDrawAction(input: {
  guestKey: string;
  sessionId: string;
}) {
  return ballBoxGuestDraw(input);
}

export async function ballBoxGuestPollAction(input: {
  guestKey: string;
  sessionId: string;
}) {
  return ballBoxGuestPoll(input);
}

export async function ballBoxGuestGuessAction(input: {
  guestKey: string;
  sessionId: string;
  guess: Record<string, number>;
}) {
  // Guests never earn XP; grading only.
  const result = await ballBoxGuestGuess(input);
  if ("error" in result) return { error: result.error, result: null };
  return { error: null, result };
}
