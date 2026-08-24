"use server";

import { activityDetailsV1 } from "@/lib/activity-result-schemas";
import {
  CONTENT_KEY,
  PROBLEM_COUNT,
  aggregateTangentScore,
  gradeTangentStep,
  type TangentResponsePayload,
  type TangentWorkspace,
} from "@/lib/inquiry-tangent-intro";
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

export async function inquirySubmitTangentAction(input: {
  sessionId: string;
  stepIndex: number;
  workspace: TangentWorkspace;
  wrongs: number;
}) {
  const graded = gradeTangentStep(
    input.stepIndex,
    input.workspace,
    input.wrongs,
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
      response: TangentResponsePayload;
    }>
  >();

  for (const r of responses) {
    if (!byStudent.has(r.studentId)) {
      byStudent.set(r.studentId, []);
    }
    byStudent.get(r.studentId)!.push({
      stepIndex: r.stepIndex,
      result: r.result,
      response: r.response as TangentResponsePayload,
    });
  }

  const runs = [...byStudent.entries()].map(([studentId, studentResponses]) => {
    const { score, correctCount, totalWrongs } = aggregateTangentScore(
      studentResponses,
      STEP_COUNT,
    );

    const items = studentResponses.map((r) => {
      if (r.response.kind === "define") {
        return {
          index: r.stepIndex,
          kind: "define",
          nameText: r.response.nameText,
          score:
            r.result === "correct" ? scoreForStep(r.response.wrongs) : 0,
          wrongs: r.response.wrongs,
        };
      }
      if (r.response.kind === "table") {
        const filled = Object.values(r.response.ratios).filter((v) =>
          v.trim(),
        ).length;
        return {
          index: r.stepIndex,
          kind: "table",
          filled,
          methodText: r.response.methodText,
          score:
            r.result === "correct" ? scoreForStep(r.response.wrongs) : 0,
          wrongs: r.response.wrongs,
        };
      }
      return {
        index: r.stepIndex,
        kind: "height",
        height: r.response.heightM,
        distanceM: r.response.distanceM,
        angleDeg: r.response.angleDeg,
        methodText: r.response.methodText,
        score: r.result === "correct" ? scoreForStep(r.response.wrongs) : 0,
        wrongs: r.response.wrongs,
      };
    });

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
