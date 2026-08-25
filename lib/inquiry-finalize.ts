import "server-only";

import { activityDetailsV1 } from "@/lib/activity-result-schemas";
import {
  PROBLEM_COUNT as RACE_COUNT,
  scoreForTime,
} from "@/lib/equation-ops-math";
import {
  isInquiryContentKey,
  type InquiryContentKey,
} from "@/lib/inquiry-content-registry";
import {
  aggregateEquationOpsScore,
  type EquationOpsResponsePayload,
} from "@/lib/inquiry-equation-ops";
import {
  aggregateBalanceScore,
  type BalanceFillResponsePayload,
} from "@/lib/inquiry-linear-equation-balance";
import {
  aggregateRadicalFillScore,
  type RadicalFillResponsePayload,
} from "@/lib/inquiry-radical-fill";
import {
  inquiryClose,
  inquiryFindActiveForTeacher,
  inquiryListResponses,
  inquiryRecordSessionRuns,
  inquiryTeacherPoll,
} from "@/lib/inquiry-session";
import {
  aggregateSincosScore,
  PROBLEM_COUNT as SINCOS_COUNT,
  type SincosResponsePayload,
} from "@/lib/inquiry-sincos-intro";
import {
  aggregateTangentScore,
  PROBLEM_COUNT as TANGENT_COUNT,
  type TangentResponsePayload,
} from "@/lib/inquiry-tangent-intro";
import { PROBLEM_COUNT as BALANCE_COUNT } from "@/lib/linear-equation-balance-math";
import { PROBLEM_COUNT as RADICAL_COUNT } from "@/lib/radical-fill-math";
import type { InquiryResult } from "@/lib/inquiry-types";

export type InquiryFinalizeResult =
  | { ok: true; recorded: number; closed: boolean }
  | { error: string; recorded?: number };

type RunPayload = {
  studentId: string;
  score: number;
  details: Record<string, unknown>;
};

function safeScoreForAttempts(wrongs: unknown): number {
  const w =
    typeof wrongs === "number" && Number.isFinite(wrongs)
      ? Math.max(0, Math.floor(wrongs))
      : 0;
  return Math.max(40, 100 - w * 15);
}

function groupByStudent<T extends { studentId: string }>(
  rows: T[],
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const list = map.get(row.studentId) ?? [];
    list.push(row);
    map.set(row.studentId, list);
  }
  return map;
}

function buildRadicalRuns(
  responses: Array<{
    studentId: string;
    stepIndex: number;
    result: InquiryResult | null;
    response: Record<string, unknown>;
  }>,
): RunPayload[] {
  const byStudent = groupByStudent(
    responses.map((r) => ({
      studentId: r.studentId,
      stepIndex: r.stepIndex,
      result: r.result,
      response: r.response as RadicalFillResponsePayload,
    })),
  );

  return [...byStudent.entries()].map(([studentId, studentResponses]) => {
    const { score, correctCount, totalWrongs } = aggregateRadicalFillScore(
      studentResponses,
      RADICAL_COUNT,
    );
    const items = studentResponses.map((r) => ({
      index: r.stepIndex,
      score:
        r.result === "correct" && !r.response.gaveUp
          ? safeScoreForAttempts(r.response.wrongs)
          : 0,
      wrongs: r.response.wrongs ?? 0,
      gaveUp: Boolean(r.response.gaveUp),
    }));
    return {
      studentId,
      score,
      details: activityDetailsV1(
        {
          correctCount,
          problemCount: RADICAL_COUNT,
          totalWrongs,
          inquirySession: true,
        },
        items,
      ),
    };
  });
}

function buildBalanceRuns(
  responses: Array<{
    studentId: string;
    stepIndex: number;
    result: InquiryResult | null;
    response: Record<string, unknown>;
  }>,
): RunPayload[] {
  const byStudent = groupByStudent(
    responses.map((r) => ({
      studentId: r.studentId,
      stepIndex: r.stepIndex,
      result: r.result,
      response: r.response as BalanceFillResponsePayload,
    })),
  );

  return [...byStudent.entries()].map(([studentId, studentResponses]) => {
    const { score, correctCount, totalWrongs } = aggregateBalanceScore(
      studentResponses,
      BALANCE_COUNT,
    );
    const items = studentResponses.map((r) => ({
      index: r.stepIndex,
      score:
        r.result === "correct" && !r.response.gaveUp
          ? safeScoreForAttempts(r.response.wrongs)
          : r.result === "neutral"
            ? safeScoreForAttempts(0)
            : 0,
      wrongs: r.response.wrongs ?? 0,
      gaveUp: Boolean(r.response.gaveUp),
    }));
    return {
      studentId,
      score,
      details: activityDetailsV1(
        {
          correctCount,
          problemCount: BALANCE_COUNT,
          totalWrongs,
          inquirySession: true,
        },
        items,
      ),
    };
  });
}

function buildRaceRuns(
  responses: Array<{
    studentId: string;
    stepIndex: number;
    result: InquiryResult | null;
    response: Record<string, unknown>;
  }>,
): RunPayload[] {
  const byStudent = groupByStudent(
    responses.map((r) => ({
      studentId: r.studentId,
      stepIndex: r.stepIndex,
      result: r.result,
      response: r.response as EquationOpsResponsePayload,
    })),
  );

  return [...byStudent.entries()].map(([studentId, studentResponses]) => {
    const { score, correctCount, totalTimeMs, avgScorePerProblem } =
      aggregateEquationOpsScore(studentResponses, RACE_COUNT);
    const items = studentResponses.map((r) => ({
      index: r.stepIndex,
      score:
        r.result === "correct"
          ? scoreForTime(r.response.elapsedMs ?? 0)
          : 0,
      elapsedMs: r.response.elapsedMs ?? 0,
      opCount: r.response.opCount ?? 0,
      wrongs: r.response.wrongs ?? 0,
    }));
    return {
      studentId,
      score,
      details: activityDetailsV1(
        {
          correctCount,
          problemCount: RACE_COUNT,
          totalTimeMs,
          avgScorePerProblem,
          inquirySession: true,
        },
        items,
      ),
    };
  });
}

function buildTangentRuns(
  responses: Array<{
    studentId: string;
    stepIndex: number;
    result: InquiryResult | null;
    response: Record<string, unknown>;
  }>,
): RunPayload[] {
  const byStudent = groupByStudent(
    responses.map((r) => ({
      studentId: r.studentId,
      stepIndex: r.stepIndex,
      result: r.result,
      response: r.response as TangentResponsePayload,
    })),
  );

  return [...byStudent.entries()].map(([studentId, studentResponses]) => {
    const { score, correctCount, totalWrongs } = aggregateTangentScore(
      studentResponses,
      TANGENT_COUNT,
    );
    const items = studentResponses.map((r) => {
      if (r.response.kind === "define") {
        return {
          index: r.stepIndex,
          kind: "define",
          nameText: r.response.nameText ?? "",
          score:
            r.result === "correct"
              ? safeScoreForAttempts(r.response.wrongs)
              : 0,
          wrongs: r.response.wrongs ?? 0,
        };
      }
      if (r.response.kind === "table") {
        const ratios = r.response.ratios ?? {};
        const filled = Object.values(ratios).filter(
          (v) => typeof v === "string" && v.trim(),
        ).length;
        return {
          index: r.stepIndex,
          kind: "table",
          filled,
          methodText: r.response.methodText ?? "",
          score:
            r.result === "correct"
              ? safeScoreForAttempts(r.response.wrongs)
              : 0,
          wrongs: r.response.wrongs ?? 0,
        };
      }
      return {
        index: r.stepIndex,
        kind: "height",
        height: r.response.kind === "height" ? r.response.heightM : "",
        distanceM: r.response.kind === "height" ? r.response.distanceM : null,
        angleDeg: r.response.kind === "height" ? r.response.angleDeg : null,
        methodText: r.response.kind === "height" ? r.response.methodText : "",
        score:
          r.result === "correct"
            ? safeScoreForAttempts(r.response.wrongs)
            : 0,
        wrongs: r.response.wrongs ?? 0,
      };
    });
    return {
      studentId,
      score,
      details: activityDetailsV1(
        {
          correctCount,
          problemCount: TANGENT_COUNT,
          totalWrongs,
          inquirySession: true,
        },
        items,
      ),
    };
  });
}

function buildSincosRuns(
  responses: Array<{
    studentId: string;
    stepIndex: number;
    result: InquiryResult | null;
    response: Record<string, unknown>;
  }>,
): RunPayload[] {
  const byStudent = groupByStudent(
    responses.map((r) => ({
      studentId: r.studentId,
      stepIndex: r.stepIndex,
      result: r.result,
      response: r.response as SincosResponsePayload,
    })),
  );

  return [...byStudent.entries()].map(([studentId, studentResponses]) => {
    const { score, correctCount, totalWrongs } = aggregateSincosScore(
      studentResponses,
      SINCOS_COUNT,
    );
    const items = studentResponses.map((r) => {
      if (r.response.kind === "define") {
        return {
          index: r.stepIndex,
          kind: "define",
          sinNameText: r.response.sinNameText ?? "",
          cosNameText: r.response.cosNameText ?? "",
          score:
            r.result === "correct"
              ? safeScoreForAttempts(r.response.wrongs)
              : 0,
          wrongs: r.response.wrongs ?? 0,
        };
      }
      if (r.response.kind === "table") {
        const sinRatios = r.response.sinRatios ?? {};
        const cosRatios = r.response.cosRatios ?? {};
        const filled =
          Object.values(sinRatios).filter(
            (v) => typeof v === "string" && v.trim(),
          ).length +
          Object.values(cosRatios).filter(
            (v) => typeof v === "string" && v.trim(),
          ).length;
        return {
          index: r.stepIndex,
          kind: "table",
          filled,
          methodText: r.response.methodText ?? "",
          score:
            r.result === "correct"
              ? safeScoreForAttempts(r.response.wrongs)
              : 0,
          wrongs: r.response.wrongs ?? 0,
        };
      }
      return {
        index: r.stepIndex,
        kind: "scene",
        adj: r.response.kind === "scene" ? r.response.adj : "",
        opp: r.response.kind === "scene" ? r.response.opp : "",
        hyp: r.response.kind === "scene" ? r.response.hyp : null,
        unit: r.response.kind === "scene" ? r.response.unit : null,
        angleDeg: r.response.kind === "scene" ? r.response.angleDeg : null,
        methodText: r.response.kind === "scene" ? r.response.methodText : "",
        score:
          r.result === "correct"
            ? safeScoreForAttempts(r.response.wrongs)
            : 0,
        wrongs: r.response.wrongs ?? 0,
      };
    });
    return {
      studentId,
      score,
      details: activityDetailsV1(
        {
          correctCount,
          problemCount: SINCOS_COUNT,
          totalWrongs,
          inquirySession: true,
        },
        items,
      ),
    };
  });
}

export function inquiryBuildRunsForContent(
  contentKey: InquiryContentKey,
  responses: Array<{
    studentId: string;
    stepIndex: number;
    result: InquiryResult | null;
    response: Record<string, unknown>;
  }>,
): RunPayload[] {
  switch (contentKey) {
    case "g3-u1-radical-fill":
      return buildRadicalRuns(responses);
    case "g1-u2-2-linear-equation-balance":
      return buildBalanceRuns(responses);
    case "g1-u2-2-linear-equation-race":
      return buildRaceRuns(responses);
    case "g3-u3-1-tangent-intro":
      return buildTangentRuns(responses);
    case "g3-u3-1-sincos-intro":
      return buildSincosRuns(responses);
  }
}

/**
 * Score participants into pm_game_runs, then close the session.
 * Recording happens before close so a close failure cannot wipe scores.
 */
export async function inquiryFinalizeSession(input: {
  sessionId: string;
  contentKey?: string | null;
}): Promise<InquiryFinalizeResult> {
  try {
    let contentKey = input.contentKey ?? null;
    if (!contentKey || !isInquiryContentKey(contentKey)) {
      const state = await inquiryTeacherPoll({ sessionId: input.sessionId });
      contentKey = state.contentKey;
    }
    if (!contentKey || !isInquiryContentKey(contentKey)) {
      const closeOnly = await inquiryClose({ sessionId: input.sessionId });
      if ("error" in closeOnly) {
        return { error: closeOnly.error ?? "수업을 종료하지 못했어요." };
      }
      return { ok: true, recorded: 0, closed: true };
    }

    const { responses } = await inquiryListResponses({
      sessionId: input.sessionId,
    });
    const runs = inquiryBuildRunsForContent(contentKey, responses);

    let recorded = 0;
    if (runs.length > 0) {
      const record = await inquiryRecordSessionRuns({
        sessionId: input.sessionId,
        runs,
      });
      if ("error" in record && record.error) {
        return { error: record.error, recorded: record.recorded ?? 0 };
      }
      recorded = record.recorded ?? 0;
      if (recorded === 0) {
        return {
          error:
            "학생 응답은 있었지만 점수를 저장하지 못했어요. 잠시 후 다시 수업 종료를 눌러 주세요.",
          recorded: 0,
        };
      }
    }

    const closeResult = await inquiryClose({ sessionId: input.sessionId });
    if ("error" in closeResult) {
      return {
        error:
          recorded > 0
            ? `점수는 ${recorded}명 저장됐지만 세션을 닫지 못했어요.`
            : (closeResult.error ?? "수업을 종료하지 못했어요."),
        recorded,
      };
    }

    return { ok: true, recorded, closed: true };
  } catch (err) {
    console.error("[pm] inquiryFinalizeSession failed:", err);
    return { error: "결과 저장 중 오류가 났어요." };
  }
}

/** If this class still has a live/setup session, score it before opening a new one. */
export async function inquiryFinalizeActiveSessionForClass(input: {
  classId: string;
}): Promise<InquiryFinalizeResult | { ok: true; recorded: 0; closed: false }> {
  const active = await inquiryFindActiveForTeacher({ classId: input.classId });
  if (!active.sessionId) {
    return { ok: true, recorded: 0, closed: false };
  }
  return inquiryFinalizeSession({ sessionId: active.sessionId });
}
