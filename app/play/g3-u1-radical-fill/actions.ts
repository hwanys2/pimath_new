"use server";

import { gradeRadicalFillStep } from "@/lib/inquiry-radical-fill";
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
import { PROBLEM_COUNT } from "@/lib/radical-fill-math";

const CONTENT_KEY = "g3-u1-radical-fill";
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

export async function inquirySubmitRadicalFillAction(input: {
  sessionId: string;
  stepIndex: number;
  texts: Array<{ coeff: string; radicand: string }>;
  wrongs: number;
  gaveUp: boolean;
}) {
  const graded = gradeRadicalFillStep(
    input.stepIndex,
    input.texts,
    input.wrongs,
    input.gaveUp,
  );

  return inquirySubmitResponse({
    sessionId: input.sessionId,
    stepIndex: input.stepIndex,
    response: graded.response,
    result: graded.result,
  });
}

export async function inquiryCloseAndScoreAction(input: { sessionId: string }) {
  return inquiryFinalizeSession({ ...input, contentKey: CONTENT_KEY });
}
