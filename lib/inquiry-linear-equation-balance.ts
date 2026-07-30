import {
  checkAnswer,
  emptyTileWorkspace,
  isBalancedWs,
  isSolved,
  problemAt,
  PROBLEM_COUNT,
  scoreForAttempts,
  workspaceToBalance,
  type CheckReason,
  type TileWorkspace,
} from "@/lib/linear-equation-balance-math";
import type { InquiryResult } from "@/lib/inquiry-types";

export const CONTENT_KEY = "g1-u2-2-linear-equation-balance";
export { PROBLEM_COUNT, problemAt as balanceProblemAt };

export type BalanceFillResponsePayload = {
  left: { x: number; unit: number };
  right: { x: number; unit: number };
  solved: boolean;
  balanced: boolean;
  moves: number;
  gaveUp: boolean;
  wrongs: number;
};

export type BalanceStepResult = {
  result: InquiryResult;
  response: BalanceFillResponsePayload;
};

export type SoftNotice = {
  reason: Exclude<CheckReason, "ok" | "incomplete">;
};

export function emptyBalanceWorkspace(
  stepIndex: number,
  seed = "",
): TileWorkspace {
  return emptyTileWorkspace(problemAt(stepIndex), seed);
}

export function validateBalanceSubmit(
  stepIndex: number,
  workspace: TileWorkspace,
): SoftNotice | null {
  const problem = problemAt(stepIndex);
  const result = checkAnswer(problem, workspace);
  if (result.ok) return null;
  if (result.reason === "ok" || result.reason === "incomplete") return null;
  return { reason: result.reason };
}

export function gradeBalanceStep(
  stepIndex: number,
  workspace: TileWorkspace,
  wrongs: number,
  gaveUp: boolean,
  moves = 0,
): BalanceStepResult {
  const problem = problemAt(stepIndex);
  const state = workspaceToBalance(workspace);
  const response: BalanceFillResponsePayload = {
    left: { ...state.left },
    right: { ...state.right },
    solved: isSolved(workspace, problem.xValue),
    balanced: isBalancedWs(workspace, problem.xValue),
    moves,
    gaveUp,
    wrongs,
  };

  if (gaveUp) {
    return { result: "wrong", response };
  }

  const check = checkAnswer(problem, workspace);
  if (check.ok) {
    return { result: "correct", response };
  }

  return { result: "wrong", response };
}

export function aggregateBalanceScore(
  responses: Array<{
    stepIndex: number;
    result: InquiryResult | null;
    response: BalanceFillResponsePayload;
  }>,
  stepCount: number,
): { score: number; correctCount: number; totalWrongs: number } {
  let score = 0;
  let correctCount = 0;
  let totalWrongs = 0;

  for (let i = 0; i < stepCount; i++) {
    const row = responses.find((r) => r.stepIndex === i);
    if (!row) continue;

    const wrongs = row.response.wrongs ?? 0;
    totalWrongs += wrongs;

    if (row.response.gaveUp) continue;

    if (row.result === "correct") {
      correctCount += 1;
      score += scoreForAttempts(wrongs);
    }
  }

  return { score, correctCount, totalWrongs };
}
