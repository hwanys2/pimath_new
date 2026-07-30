/**
 * 일차방정식 대수막대·저울 탐구 — 문제 정의 · 채점 · 타일 변환
 * contentKey: g1-u2-2-linear-equation-balance
 */

export const CONTENT_KEY = "g1-u2-2-linear-equation-balance";
export const PROBLEM_COUNT = 10;

export type TileKind = "x" | "neg_x" | "one" | "neg_one";

export type PanExpr = { x: number; unit: number };

export type BalanceState = { left: PanExpr; right: PanExpr };

export type BalanceGoal = "balanced" | "isolate_x";

export type BalanceProblem = {
  id: string;
  title: string;
  instruction: string;
  targetLatex: string;
  initial: BalanceState;
  goal: BalanceGoal;
  /** isolate_x 일 때 우변 상수 목표 */
  targetX?: number;
  hints: string[];
  allowNegatives: boolean;
  /** neutral = 제출만 정답 처리 (관찰 단계) */
  gradingMode: "auto" | "neutral";
};

export type CheckReason = "ok" | "unbalanced" | "wrong" | "incomplete";

export type CheckResult = {
  ok: boolean;
  reason: CheckReason;
};

export const WRONG_PENALTY = 15;
export const MIN_CORRECT_SCORE = 40;
export const MAX_CORRECT_SCORE = 100;

export function scoreForAttempts(wrongs: number): number {
  const w = Math.max(0, Math.floor(wrongs));
  return Math.max(MIN_CORRECT_SCORE, MAX_CORRECT_SCORE - w * WRONG_PENALTY);
}

export function exprFromTiles(tiles: TileKind[]): PanExpr {
  let x = 0;
  let unit = 0;
  for (const t of tiles) {
    switch (t) {
      case "x":
        x += 1;
        break;
      case "neg_x":
        x -= 1;
        break;
      case "one":
        unit += 1;
        break;
      case "neg_one":
        unit -= 1;
        break;
    }
  }
  return { x, unit };
}

export function tilesFromExpr(expr: PanExpr): TileKind[] {
  const tiles: TileKind[] = [];
  for (let i = 0; i < Math.abs(expr.x); i++) {
    tiles.push(expr.x >= 0 ? "x" : "neg_x");
  }
  for (let i = 0; i < Math.abs(expr.unit); i++) {
    tiles.push(expr.unit >= 0 ? "one" : "neg_one");
  }
  return tiles;
}

export function panWeight(expr: PanExpr): number {
  return Math.abs(expr.x) * 4 + Math.abs(expr.unit);
}

export function isBalanced(state: BalanceState): boolean {
  return state.left.x === state.right.x && state.left.unit === state.right.unit;
}

export function isIsolatedX(state: BalanceState, targetX: number): boolean {
  return (
    isBalanced(state) &&
    state.left.x === 1 &&
    state.left.unit === 0 &&
    state.right.x === 0 &&
    state.right.unit === targetX
  );
}

export function checkAnswer(
  problem: BalanceProblem,
  state: BalanceState,
): CheckResult {
  if (problem.gradingMode === "neutral") {
    if (isBalanced(state)) return { ok: true, reason: "ok" };
    return { ok: false, reason: "unbalanced" };
  }

  if (!isBalanced(state)) {
    return { ok: false, reason: "unbalanced" };
  }

  if (problem.goal === "balanced") {
    return { ok: true, reason: "ok" };
  }

  const target = problem.targetX;
  if (target == null) {
    return { ok: false, reason: "incomplete" };
  }

  if (isIsolatedX(state, target)) {
    return { ok: true, reason: "ok" };
  }

  return { ok: false, reason: "wrong" };
}

export function formatExpr(expr: PanExpr): string {
  const parts: string[] = [];
  if (expr.x !== 0) {
    if (expr.x === 1) parts.push("x");
    else if (expr.x === -1) parts.push("-x");
    else parts.push(`${expr.x}x`);
  }
  if (expr.unit !== 0) {
    if (expr.unit > 0) {
      parts.push(expr.unit === 1 ? "+1" : `+${expr.unit}`);
    } else {
      parts.push(expr.unit === -1 ? "-1" : `${expr.unit}`);
    }
  }
  if (parts.length === 0) return "0";
  return parts.join("").replace(/^\+/, "");
}

export function emptyWorkspaceState(problem: BalanceProblem): BalanceState {
  return {
    left: { ...problem.initial.left },
    right: { ...problem.initial.right },
  };
}

export const PROBLEMS: BalanceProblem[] = [
  {
    id: "step-0",
    title: "저울과 등식",
    instruction:
      "양팔저울이 균형을 이루면 등식이 성립해요. 지금 저울이 균형인지 확인하고 제출해 보세요.",
    targetLatex: "2 + 2 = 4",
    initial: { left: { x: 0, unit: 4 }, right: { x: 0, unit: 4 } },
    goal: "balanced",
    hints: [
      "양쪽 팬에 같은 무게가 있으면 저울이 수평이에요.",
      "등식은 '=' 양변의 값이 같다는 뜻이에요.",
    ],
    allowNegatives: false,
    gradingMode: "neutral",
  },
  {
    id: "step-1",
    title: "x가 뭘까?",
    instruction:
      "x 막대는 아직 모르는 수예요. 양변에서 같은 수를 빼서 x만 남겨 보세요.",
    targetLatex: "x + 3 = 7",
    initial: { left: { x: 1, unit: 3 }, right: { x: 0, unit: 7 } },
    goal: "isolate_x",
    targetX: 4,
    hints: [
      "양변에서 1을 3개씩 빼 보세요. 「양변에 −1」 버튼을 3번 눌러도 돼요.",
      "왼쪽에 x만, 오른쪽에 4만 남으면 x = 4예요.",
    ],
    allowNegatives: false,
    gradingMode: "auto",
  },
  {
    id: "step-2",
    title: "등식의 성질 — 더하기",
    instruction:
      "x − 2 = 5 를 풀어 보세요. 양변에 같은 수를 더해도 등식은 성립해요.",
    targetLatex: "x - 2 = 5",
    initial: { left: { x: 1, unit: -2 }, right: { x: 0, unit: 5 } },
    goal: "isolate_x",
    targetX: 7,
    hints: [
      "양변에 +1을 2번 더하면 왼쪽의 −2가 사라져요.",
      "x = 7이 되면 성공이에요.",
    ],
    allowNegatives: true,
    gradingMode: "auto",
  },
  {
    id: "step-3",
    title: "양변에 같은 막대",
    instruction: "x + 1 = 4 를 풀어 x의 값을 구해 보세요.",
    targetLatex: "x + 1 = 4",
    initial: { left: { x: 1, unit: 1 }, right: { x: 0, unit: 4 } },
    goal: "isolate_x",
    targetX: 3,
    hints: [
      "양변에서 1을 하나씩 빼 보세요.",
      "등식의 성질: 양변에 같은 수를 더하거나 빼도 등식은 유지돼요.",
    ],
    allowNegatives: true,
    gradingMode: "auto",
  },
  {
    id: "step-4",
    title: "음수 막대",
    instruction:
      "빨간 막대는 음수를 나타내요. x − 4 = 1 을 풀어 보세요.",
    targetLatex: "x - 4 = 1",
    initial: { left: { x: 1, unit: -4 }, right: { x: 0, unit: 1 } },
    goal: "isolate_x",
    targetX: 5,
    hints: [
      "양변에 +1을 4번 더해 보세요.",
      "왼쪽에 x만 남기면 x = 5예요.",
    ],
    allowNegatives: true,
    gradingMode: "auto",
  },
  {
    id: "step-5",
    title: "x 막대 합치기",
    instruction:
      "x + x = 2x 와 같아요. 2x = 6 에서 x의 값을 구해 보세요.",
    targetLatex: "x + x = 6",
    initial: { left: { x: 2, unit: 0 }, right: { x: 0, unit: 6 } },
    goal: "isolate_x",
    targetX: 3,
    hints: [
      "x 막대 2개는 2x를 뜻해요.",
      "양변을 똑같이 나누려면, 양변에서 x 막대를 하나씩 빼 보세요.",
    ],
    allowNegatives: true,
    gradingMode: "auto",
  },
  {
    id: "step-6",
    title: "계수와 상수",
    instruction: "2x + 3 = 11 을 풀어 보세요.",
    targetLatex: "2x + 3 = 11",
    initial: { left: { x: 2, unit: 3 }, right: { x: 0, unit: 11 } },
    goal: "isolate_x",
    targetX: 4,
    hints: [
      "먼저 양변에서 3을 빼 보세요.",
      "그다음 양변에서 x 막대를 하나씩 빼면 x = 4예요.",
    ],
    allowNegatives: true,
    gradingMode: "auto",
  },
  {
    id: "step-7",
    title: "양변에 x",
    instruction: "3x + 2 = x + 10 에서 x의 값을 구해 보세요.",
    targetLatex: "3x + 2 = x + 10",
    initial: { left: { x: 3, unit: 2 }, right: { x: 1, unit: 10 } },
    goal: "isolate_x",
    targetX: 4,
    hints: [
      "양변에서 x 막대를 하나씩 빼 보세요.",
      "그다음 양변에서 2를 빼면 2x = 8, x = 4예요.",
    ],
    allowNegatives: true,
    gradingMode: "auto",
  },
  {
    id: "step-8",
    title: "검산해 보기",
    instruction:
      "2x + 1 = 7 의 해는 x = 3이에요. 막대를 옮겨 x = 3 형태로 만들어 검산해 보세요.",
    targetLatex: "2x + 1 = 7",
    initial: { left: { x: 2, unit: 1 }, right: { x: 0, unit: 7 } },
    goal: "isolate_x",
    targetX: 3,
    hints: [
      "먼저 2x + 1 = 7 을 x = 3 으로 정리해 보세요.",
      "x = 3이 맞는지, 2×3 + 1 = 7 인지 생각해 보세요.",
    ],
    allowNegatives: true,
    gradingMode: "auto",
  },
  {
    id: "step-9",
    title: "도전",
    instruction: "4x − 1 = 2x + 7 을 풀어 보세요.",
    targetLatex: "4x - 1 = 2x + 7",
    initial: { left: { x: 4, unit: -1 }, right: { x: 2, unit: 7 } },
    goal: "isolate_x",
    targetX: 4,
    hints: [
      "양변에서 x 막대를 2개씩 빼 보세요.",
      "양변에 +1을 더한 뒤, x 막대를 나누어 보세요.",
    ],
    allowNegatives: true,
    gradingMode: "auto",
  },
];

export function problemAt(stepIndex: number): BalanceProblem {
  return PROBLEMS[stepIndex] ?? PROBLEMS[0]!;
}

/** 양변에 같은 타일 추가 */
export function applyBothSides(
  state: BalanceState,
  tile: TileKind,
): BalanceState {
  const delta = tileDelta(tile);
  return {
    left: addExpr(state.left, delta),
    right: addExpr(state.right, delta),
  };
}

function tileDelta(tile: TileKind): PanExpr {
  switch (tile) {
    case "x":
      return { x: 1, unit: 0 };
    case "neg_x":
      return { x: -1, unit: 0 };
    case "one":
      return { x: 0, unit: 1 };
    case "neg_one":
      return { x: 0, unit: -1 };
  }
}

function addExpr(a: PanExpr, b: PanExpr): PanExpr {
  return { x: a.x + b.x, unit: a.unit + b.unit };
}

export function balanceTiltDeg(state: BalanceState): number {
  const leftW = panWeight(state.left);
  const rightW = panWeight(state.right);
  const diff = rightW - leftW;
  return Math.max(-12, Math.min(12, diff * 2.5));
}
