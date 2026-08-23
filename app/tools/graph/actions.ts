"use server";

import {
  graphClearPoints,
  graphClose,
  graphCreateSession,
  graphDeleteOwnPoint,
  graphFindByCode,
  graphFindMyActive,
  graphGuestJoin,
  graphGuestPoll,
  graphRemovePoint,
  graphSetReveal,
  graphSubmitPoint,
  graphTeacherPoll,
  graphUpdateExpression,
  graphUpdateSettings,
} from "@/lib/graph-explorer";
import type { GraphSettings } from "@/lib/graph-explorer-types";

// 교사 --------------------------------------------------------------------

export async function graphCreateSessionAction(input: {
  expressionRaw: string;
  settings: Partial<GraphSettings>;
}) {
  return graphCreateSession(input);
}

export async function graphFindMyActiveAction() {
  return graphFindMyActive();
}

export async function graphUpdateSettingsAction(input: {
  sessionId: string;
  settings: Partial<GraphSettings>;
}) {
  return graphUpdateSettings(input);
}

export async function graphUpdateExpressionAction(input: {
  sessionId: string;
  expressionRaw: string;
}) {
  return graphUpdateExpression(input);
}

export async function graphSetRevealAction(input: {
  sessionId: string;
  reveal: boolean;
}) {
  return graphSetReveal(input);
}

export async function graphClearPointsAction(input: { sessionId: string }) {
  return graphClearPoints(input);
}

export async function graphRemovePointAction(input: {
  sessionId: string;
  pointId: string;
}) {
  return graphRemovePoint(input);
}

export async function graphCloseAction(input: { sessionId: string }) {
  return graphClose(input);
}

export async function graphTeacherPollAction(input: { sessionId: string }) {
  return graphTeacherPoll(input);
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
