"use server";

import { activityDetailsV1 } from "@/lib/activity-result-schemas";
import { PROBLEM_COUNT } from "@/lib/radical-fill-math";
import {
  aggregateRadicalFillScore,
  gradeRadicalFillStep,
  type RadicalFillResponsePayload,
} from "@/lib/inquiry-radical-fill";
import {
  inquiryAdvanceStep,
  inquiryClose,
  inquiryCreateSession,
  inquiryFindActiveForStudent,
  inquiryFindActiveForTeacher,
  inquiryJoin,
  inquiryListResponses,
  inquiryRecordSessionRuns,
  inquiryStart,
  inquiryStudentPoll,
  inquirySubmitResponse,
  inquiryTeacherPoll,
} from "@/lib/inquiry-session";

const CONTENT_KEY = "g3-u1-radical-fill";
const STEP_COUNT = PROBLEM_COUNT;

export async function inquiryCreateSessionAction(input: { classId: string }) {
  return inquiryCreateSession({
    classId: input.classId,
    contentKey: CONTENT_KEY,
    stepCount: STEP_COUNT,
  });
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
  return inquiryClose(input);
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
  const closeResult = await inquiryClose(input);
  if ("error" in closeResult) return closeResult;

  const { responses } = await inquiryListResponses(input);

  const byStudent = new Map<
    string,
    Array<{
      stepIndex: number;
      result: "correct" | "wrong" | "neutral" | null;
      response: RadicalFillResponsePayload;
    }>
  >();

  for (const r of responses) {
    if (!byStudent.has(r.studentId)) {
      byStudent.set(r.studentId, []);
    }
    byStudent.get(r.studentId)!.push({
      stepIndex: r.stepIndex,
      result: r.result,
      response: r.response as RadicalFillResponsePayload,
    });
  }

  const runs = [...byStudent.entries()].map(([studentId, studentResponses]) => {
    const { score, correctCount, totalWrongs } = aggregateRadicalFillScore(
      studentResponses,
      STEP_COUNT,
    );

    const items = studentResponses.map((r) => ({
      index: r.stepIndex,
      score:
        r.result === "correct" && !r.response.gaveUp
          ? scoreForStep(r.response.wrongs)
          : 0,
      wrongs: r.response.wrongs,
      gaveUp: r.response.gaveUp,
    }));

    return {
      studentId,
      score,
      details: activityDetailsV1(
        {
          correctCount,
          problemCount: STEP_COUNT,
          totalWrongs,
          inquirySession: true,
        },
        items,
      ),
    };
  });

  if (runs.length === 0) {
    return { ok: true as const, recorded: 0 };
  }

  const record = await inquiryRecordSessionRuns({
    sessionId: input.sessionId,
    runs,
  });

  return record;
}

function scoreForStep(wrongs: number): number {
  const w = Math.max(0, Math.floor(wrongs));
  return Math.max(40, 100 - w * 15);
}
