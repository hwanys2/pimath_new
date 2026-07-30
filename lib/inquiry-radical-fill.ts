import {
  checkAnswer,
  parseRational,
  PROBLEMS,
  scoreForAttempts,
  type RadicalProblem,
  type TermFill,
} from "@/lib/radical-fill-math";
import type { InquiryResult } from "@/lib/inquiry-types";

export type RadicalFillResponsePayload = {
  fills: Array<{ coeff: string; radicand: string }>;
  gaveUp: boolean;
  wrongs: number;
};

export type RadicalFillStepResult = {
  result: InquiryResult;
  response: RadicalFillResponsePayload;
};

export function textsToFills(
  problem: RadicalProblem,
  texts: Array<{ coeff: string; radicand: string }>,
): TermFill[] {
  return problem.terms.map((term, i) => {
    const t = texts[i] ?? { coeff: "", radicand: "" };
    return {
      coeff: term.hasCoeff
        ? parseRational(t.coeff, { allowNegative: true })
        : null,
      radicand: parseRational(t.radicand, { allowNegative: false }),
    };
  });
}

export function gradeRadicalFillStep(
  stepIndex: number,
  texts: Array<{ coeff: string; radicand: string }>,
  wrongs: number,
  gaveUp: boolean,
): RadicalFillStepResult {
  const problem = PROBLEMS[stepIndex] ?? PROBLEMS[0]!;
  const fills = textsToFills(problem, texts);
  const response: RadicalFillResponsePayload = {
    fills: texts,
    gaveUp,
    wrongs,
  };

  if (gaveUp) {
    return { result: "wrong", response };
  }

  const check = checkAnswer(problem, fills);
  if (check.ok) {
    return { result: "correct", response };
  }

  return { result: "wrong", response };
}

export function aggregateRadicalFillScore(
  responses: Array<{
    stepIndex: number;
    result: InquiryResult | null;
    response: RadicalFillResponsePayload;
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

export function radicalFillProblemAt(stepIndex: number): RadicalProblem {
  return PROBLEMS[stepIndex] ?? PROBLEMS[0]!;
}
