"use server";

import { PROBLEM_COUNT } from "@/lib/equation-ops-math";
import type { EquationOpsState } from "@/lib/equation-ops-math";
import { buildRaceDraftPayload } from "@/lib/inquiry-draft-payload";
import {
  CONTENT_KEY,
  gradeEquationOpsStep,
} from "@/lib/inquiry-equation-ops";
import {
  inquiryFinalizeActiveSessionForClass,
  inquiryFinalizeSession,
} from "@/lib/inquiry-finalize";
import {
  inquiryAdvanceStep,
  inquiryCreateSession,
  inquiryFindActiveForStudent,
  inquiryFindActiveForTeacher,
  inquiryJoin,
  inquiryListResponses,
  inquiryStart,
  inquiryStudentPoll,
  inquirySubmitResponse,
  inquiryTeacherPoll,
} from "@/lib/inquiry-session";

const STEP_COUNT = PROBLEM_COUNT;

export async function inquiryCreateSessionAction(input: { classId: string }) {
  const prior = await inquiryFinalizeActiveSessionForClass({
    classId: input.classId,
  });
  if ("error" in prior) return prior;

  const created = await inquiryCreateSession({
    classId: input.classId,
    contentKey: CONTENT_KEY,
    stepCount: STEP_COUNT,
  });
  if ("error" in created) return created;
  return {
    sessionId: created.sessionId,
    recorded: prior.recorded ?? 0,
  };
}

export async function inquiryStartAction(input: { sessionId: string }) {
  return inquiryStart(input);
}

export async function inquiryAdvanceStepAction(input: {
  sessionId: string;
  delta: number;
}) {
  return inquiryAdvanceStep({ ...input, contentKey: CONTENT_KEY });
}

export async function inquiryCloseAction(input: { sessionId: string }) {
  return inquiryFinalizeSession({ ...input, contentKey: CONTENT_KEY });
}

export async function inquiryJoinAction(input: { classId: string }) {
  return inquiryJoin(input);
}

export async function inquiryFindActiveStudentAction(input: {
  classId: string;
}) {
  return inquiryFindActiveForStudent(input);
}

export async function inquiryFindActiveTeacherAction(input: {
  classId: string;
}) {
  return inquiryFindActiveForTeacher(input);
}

export async function inquiryStudentPollAction(input: { sessionId: string }) {
  return inquiryStudentPoll(input);
}

export async function inquiryTeacherPollAction(input: { sessionId: string }) {
  return inquiryTeacherPoll(input);
}

export async function inquiryListResponsesAction(input: { sessionId: string }) {
  return inquiryListResponses(input);
}

export async function inquirySubmitEquationOpsAction(input: {
  sessionId: string;
  stepIndex: number;
  state: EquationOpsState;
  wrongs: number;
  elapsedMs: number;
}) {
  const graded = gradeEquationOpsStep(
    input.stepIndex,
    input.state,
    input.wrongs,
    input.elapsedMs,
  );

  return inquirySubmitResponse({
    sessionId: input.sessionId,
    stepIndex: input.stepIndex,
    response: graded.response,
    result: graded.result,
  });
}

export async function inquirySaveRaceDraftAction(input: {
  sessionId: string;
  stepIndex: number;
  state: EquationOpsState;
  wrongs: number;
  elapsedMs: number;
}) {
  const response = buildRaceDraftPayload(
    input.state,
    input.wrongs,
    input.elapsedMs,
  );
  return inquirySubmitResponse({
    sessionId: input.sessionId,
    stepIndex: input.stepIndex,
    response,
    result: null,
  });
}

export async function inquiryCloseAndScoreAction(input: { sessionId: string }) {
  return inquiryFinalizeSession({ ...input, contentKey: CONTENT_KEY });
}
