"use server";

import { activityDetailsV1 } from "@/lib/activity-result-schemas";
import { PROBLEM_COUNT } from "@/lib/equation-ops-math";
import type { EquationOpsState } from "@/lib/equation-ops-math";
import {
  aggregateEquationOpsScore,
  CONTENT_KEY,
  gradeEquationOpsStep,
  type EquationOpsResponsePayload,
} from "@/lib/inquiry-equation-ops";
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
import { scoreForTime } from "@/lib/equation-ops-math";

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

export async function inquiryCloseAndScoreAction(input: { sessionId: string }) {
  const closeResult = await inquiryClose(input);
  if ("error" in closeResult) return closeResult;

  const { responses } = await inquiryListResponses(input);

  const byStudent = new Map<
    string,
    Array<{
      stepIndex: number;
      result: "correct" | "wrong" | "neutral" | null;
      response: EquationOpsResponsePayload;
    }>
  >();

  for (const r of responses) {
    if (!byStudent.has(r.studentId)) {
      byStudent.set(r.studentId, []);
    }
    byStudent.get(r.studentId)!.push({
      stepIndex: r.stepIndex,
      result: r.result,
      response: r.response as EquationOpsResponsePayload,
    });
  }

  const runs = [...byStudent.entries()].map(([studentId, studentResponses]) => {
    const { score, correctCount, totalTimeMs, avgScorePerProblem } =
      aggregateEquationOpsScore(studentResponses, STEP_COUNT);

    const items = studentResponses.map((r) => ({
      index: r.stepIndex,
      score:
        r.result === "correct"
          ? scoreForTime(r.response.elapsedMs ?? 0)
          : 0,
      elapsedMs: r.response.elapsedMs,
      opCount: r.response.opCount,
      wrongs: r.response.wrongs,
    }));

    return {
      studentId,
      score,
      details: activityDetailsV1(
        {
          correctCount,
          problemCount: STEP_COUNT,
          totalTimeMs,
          avgScorePerProblem,
          inquirySession: true,
        },
        items,
      ),
    };
  });

  if (runs.length === 0) {
    return { ok: true as const, recorded: 0 };
  }

  return inquiryRecordSessionRuns({
    sessionId: input.sessionId,
    runs,
  });
}
