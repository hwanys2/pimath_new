import {
  isStateSolved,
  problemAt,
  scoreForTime,
  type EquationOpsState,
  type TrailEntry,
} from "@/lib/equation-ops-math";
import type { BalanceState } from "@/lib/linear-equation-balance-math";
import type { InquiryResult } from "@/lib/inquiry-types";

export const CONTENT_KEY = "g1-u2-2-linear-equation-race";

export function equationOpsProblemAt(stepIndex: number) {
  return problemAt(stepIndex);
}

export type EquationOpsResponsePayload = {
  trail: TrailEntry[];
  opCount: number;
  elapsedMs: number;
  wrongs: number;
  /** Balance after last submit — used to restore workspace on refresh. */
  balance: BalanceState;
};

export type EquationOpsStepResult = {
  result: InquiryResult;
  response: EquationOpsResponsePayload;
  stepScore: number;
};

export function gradeEquationOpsStep(
  stepIndex: number,
  state: EquationOpsState,
  wrongs: number,
  elapsedMs: number,
): EquationOpsStepResult {
  const problem = problemAt(stepIndex);
  const response: EquationOpsResponsePayload = {
    trail: state.trail,
    opCount: state.opCount,
    elapsedMs,
    wrongs,
    balance: {
      left: { ...state.balance.left },
      right: { ...state.balance.right },
    },
  };

  if (isStateSolved(state, problem.xValue)) {
    return {
      result: "correct",
      response,
      stepScore: scoreForTime(elapsedMs),
    };
  }

  return { result: "wrong", response, stepScore: 0 };
}

export function aggregateEquationOpsScore(
  responses: Array<{
    stepIndex: number;
    result: InquiryResult | null;
    response: EquationOpsResponsePayload;
  }>,
  stepCount: number,
): {
  score: number;
  correctCount: number;
  totalTimeMs: number;
  avgScorePerProblem: number;
} {
  let score = 0;
  let correctCount = 0;
  let totalTimeMs = 0;

  for (let i = 0; i < stepCount; i++) {
    const row = responses.find((r) => r.stepIndex === i);
    if (!row) continue;

    if (row.result === "correct") {
      correctCount += 1;
      const stepScore = scoreForTime(row.response.elapsedMs ?? 0);
      score += stepScore;
      totalTimeMs += row.response.elapsedMs ?? 0;
    }
  }

  const avgScorePerProblem =
    correctCount > 0 ? Math.round(score / correctCount) : 0;

  return { score, correctCount, totalTimeMs, avgScorePerProblem };
}

export function buildLiveRanking(
  responses: Array<{
    studentId: string;
    displayName: string;
    stepIndex: number;
    result: InquiryResult | null;
    response: EquationOpsResponsePayload;
  }>,
  stepCount: number,
): Array<{
  studentId: string;
  displayName: string;
  sessionScore: number;
  correctCount: number;
  totalTimeMs: number;
}> {
  const byStudent = new Map<
    string,
    { displayName: string; rows: typeof responses }
  >();

  for (const r of responses) {
    if (!byStudent.has(r.studentId)) {
      byStudent.set(r.studentId, { displayName: r.displayName, rows: [] });
    }
    byStudent.get(r.studentId)!.rows.push(r);
  }

  const ranking = [...byStudent.entries()].map(([studentId, { displayName, rows }]) => {
    const agg = aggregateEquationOpsScore(
      rows.map((r) => ({
        stepIndex: r.stepIndex,
        result: r.result,
        response: r.response,
      })),
      stepCount,
    );
    return {
      studentId,
      displayName,
      sessionScore: agg.score,
      correctCount: agg.correctCount,
      totalTimeMs: agg.totalTimeMs,
    };
  });

  ranking.sort((a, b) => {
    if (b.sessionScore !== a.sessionScore) return b.sessionScore - a.sessionScore;
    if (a.totalTimeMs !== b.totalTimeMs) return a.totalTimeMs - b.totalTimeMs;
    return a.displayName.localeCompare(b.displayName, "ko");
  });

  return ranking;
}
