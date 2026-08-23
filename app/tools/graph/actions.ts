"use server";

import {
  graphAnonFindActive,
  graphClearPoints,
  graphClose,
  graphCreateAnonSession,
  graphCreateSession,
  graphDeleteOwnPoint,
  graphFindByCode,
  graphFindMyActive,
  graphGuestJoin,
  graphGuestPoll,
  graphListTeacherSessions,
  graphRemovePoint,
  graphSetReveal,
  graphSubmitPoint,
  graphTeacherPoll,
  graphUpdateExpression,
  graphUpdateSettings,
} from "@/lib/graph-explorer";
import type { GraphSettings } from "@/lib/graph-explorer-types";

// 로그인 교사 ----------------------------------------------------------------

export async function graphCreateSessionAction(input: {
  title: string;
  expressionRaw: string;
  settings: Partial<GraphSettings>;
}) {
  return graphCreateSession(input);
}

export async function graphListTeacherSessionsAction() {
  return graphListTeacherSessions();
}

export async function graphFindMyActiveAction() {
  return graphFindMyActive();
}

export async function graphUpdateSettingsAction(input: {
  sessionId: string;
  settings: Partial<GraphSettings>;
  guestTeacherKey?: string | null;
}) {
  return graphUpdateSettings(input);
}

export async function graphUpdateExpressionAction(input: {
  sessionId: string;
  expressionRaw: string;
  guestTeacherKey?: string | null;
}) {
  return graphUpdateExpression(input);
}

export async function graphSetRevealAction(input: {
  sessionId: string;
  reveal: boolean;
  guestTeacherKey?: string | null;
}) {
  return graphSetReveal(input);
}

export async function graphClearPointsAction(input: {
  sessionId: string;
  guestTeacherKey?: string | null;
}) {
  return graphClearPoints(input);
}

export async function graphRemovePointAction(input: {
  sessionId: string;
  pointId: string;
  guestTeacherKey?: string | null;
}) {
  return graphRemovePoint(input);
}

export async function graphCloseAction(input: {
  sessionId: string;
  guestTeacherKey?: string | null;
}) {
  return graphClose(input);
}

export async function graphTeacherPollAction(input: {
  sessionId: string;
  guestTeacherKey?: string | null;
}) {
  return graphTeacherPoll(input);
}

// 익명 교사 ------------------------------------------------------------------

export async function graphCreateAnonSessionAction(input: {
  guestTeacherKey: string;
  expressionRaw: string;
  settings: Partial<GraphSettings>;
}) {
  return graphCreateAnonSession(input);
}

export async function graphAnonFindActiveAction(input: {
  guestTeacherKey: string;
}) {
  return graphAnonFindActive(input);
}

// 학생 (익명) ----------------------------------------------------------------

export async function graphFindByCodeAction(input: { joinCode: string }) {
  return graphFindByCode(input);
}

export async function graphGuestJoinAction(input: {
  joinCode: string;
  guestKey: string;
  name: string;
}) {
  return graphGuestJoin(input);
}

export async function graphSubmitPointAction(input: {
  sessionId: string;
  guestKey: string;
  xRaw: string;
  yRaw: string;
}) {
  return graphSubmitPoint(input);
}

export async function graphDeleteOwnPointAction(input: {
  sessionId: string;
  guestKey: string;
  pointId: string;
}) {
  return graphDeleteOwnPoint(input);
}

export async function graphGuestPollAction(input: {
  sessionId: string;
  guestKey: string;
}) {
  return graphGuestPoll(input);
}
