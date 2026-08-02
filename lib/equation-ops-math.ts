/**
 * 일차방정식 레이스 — 연산 선택형 탐구
 * contentKey: g1-u2-2-linear-equation-race
 */

import {
  applyZeroPairs,
  canScaleDivide,
  canScaleMultiply,
  emptyTileWorkspace,
  isBalancedWs,
  isSolved,
  scaleDivideBothSides,
  scaleMultiplyBothSides,
  type BalanceState,
  type PanExpr,
  type TileWorkspace,
  workspaceFromBalance,
  workspaceToBalance,
} from "@/lib/linear-equation-balance-math";

export const CONTENT_KEY = "g1-u2-2-linear-equation-race";
export const PROBLEM_COUNT = 10;
export const TIME_CAP_MS = 90_000;
export const MIN_SCORE = 40;
export const MAX_SCORE = 100;

export type OpKind = "add" | "subtract" | "multiply" | "divide";
export type OpTarget = "constant" | "x";

export type TrailEntry = {
  latex: string;
  label: string;
};

export type EquationOpsProblem = {
  id: string;
  title: string;
  instruction: string;
  targetLatex: string;
  xValue: number;
  initial: BalanceState;
  hints: string[];
};

export type EquationOpsState = {
  balance: BalanceState;
  trail: TrailEntry[];
  opCount: number;
};

export type OpInput = {
  kind: OpKind;
  target: OpTarget;
  value: number;
};

export type OpValidation =
  | { ok: true }
  | { ok: false; message: string };

export const PROBLEMS: EquationOpsProblem[] = [
  {
    id: "race-0",
    title: "상수 빼기",
    instruction: "양변에 같은 수를 빼며 x를 구해 보세요.",
    targetLatex: "x + 3 = 8",
    xValue: 5,
    initial: { left: { x: 1, unit: 3 }, right: { x: 0, unit: 8 } },
    hints: ["양변에 3을 빼 보세요.", "x = 5"],
  },
  {
    id: "race-1",
    title: "상수 더하기",
    instruction: "양변에 같은 수를 더하며 x를 구해 보세요.",
    targetLatex: "x - 4 = 2",
    xValue: 6,
    initial: { left: { x: 1, unit: -4 }, right: { x: 0, unit: 2 } },
    hints: ["양변에 4를 더해 보세요.", "x = 6"],
  },
  {
    id: "race-2",
    title: "양변 나누기",
    instruction: "양변을 같은 수로 나누며 x를 구해 보세요.",
    targetLatex: "2x = 6",
    xValue: 3,
    initial: { left: { x: 2, unit: 0 }, right: { x: 0, unit: 6 } },
    hints: ["양변을 2로 나누어 보세요.", "x = 3"],
  },
  {
    id: "race-3",
    title: "x항 옮기기",
    instruction: "x항을 한쪽으로 모은 뒤 나누어 보세요.",
    targetLatex: "3x = x + 8",
    xValue: 4,
    initial: { left: { x: 3, unit: 0 }, right: { x: 1, unit: 8 } },
    hints: ["양변에서 x를 1씩 빼 보세요.", "2x = 8 → 2로 나누면 x = 4"],
  },
  {
    id: "race-4",
    title: "x항과 상수",
    instruction: "x를 모은 뒤 상수를 정리해 보세요.",
    targetLatex: "2x + 1 = x + 4",
    xValue: 3,
    initial: { left: { x: 2, unit: 1 }, right: { x: 1, unit: 4 } },
    hints: ["양변에서 x를 1씩 빼 보세요.", "x + 1 = 4 → x = 3"],
  },
  {
    id: "race-5",
    title: "나누기 종합",
    instruction: "상수를 정리한 뒤 나누어 보세요.",
    targetLatex: "3x - 2 = 7",
    xValue: 3,
    initial: { left: { x: 3, unit: -2 }, right: { x: 0, unit: 7 } },
    hints: ["양변에 2를 더한 뒤 3으로 나누어 보세요.", "x = 3"],
  },
  {
    id: "race-6",
    title: "½x",
    instruction: "양변을 곱해 x 막대로 바꿔 보세요.",
    targetLatex: "\\frac{1}{2}x = 3",
    xValue: 6,
    initial: { left: { x: 0.5, unit: 0 }, right: { x: 0, unit: 3 } },
    hints: ["양변에 2를 곱해 보세요.", "x = 6"],
  },
  {
    id: "race-7",
    title: "음수 계수",
    instruction: "나눈 뒤 부호를 바꿔 보세요.",
    targetLatex: "-2x = 6",
    xValue: -3,
    initial: { left: { x: -2, unit: 0 }, right: { x: 0, unit: 6 } },
    hints: ["양변을 2로 나누어 보세요.", "−x = 3 → 부호 바꾸기"],
  },
  {
    id: "race-8",
    title: "종합 1",
    instruction: "연산을 골라 빠르게 x를 구해 보세요.",
    targetLatex: "2x + 5 = x + 12",
    xValue: 7,
    initial: { left: { x: 2, unit: 5 }, right: { x: 1, unit: 12 } },
    hints: ["x를 한쪽으로 모아 보세요.", "x = 7"],
  },
  {
    id: "race-9",
    title: "종합 2",
    instruction: "마지막 문제! 연산을 조합해 풀어 보세요.",
    targetLatex: "3x - 4 = x + 8",
    xValue: 6,
    initial: { left: { x: 3, unit: -4 }, right: { x: 1, unit: 8 } },
    hints: ["x를 모은 뒤 상수를 정리해 보세요.", "x = 6"],
  },
];

export function problemAt(stepIndex: number): EquationOpsProblem {
  return PROBLEMS[stepIndex] ?? PROBLEMS[0]!;
}

function panSideToLatex(expr: PanExpr): string {
  const parts: string[] = [];
  if (expr.x !== 0) {
    const ax = Math.abs(expr.x);
    let xs: string;
    if (ax === 1) xs = "x";
    else if (ax === 0.5) xs = "\\frac{1}{2}x";
    else if (Number.isInteger(ax)) xs = `${ax}x`;
    else xs = `${ax}x`;
    parts.push(expr.x < 0 ? `-${xs.replace(/^-/, "")}` : xs);
  }
  if (expr.unit !== 0) {
    if (expr.unit > 0) {
      parts.push(parts.length > 0 ? `+ ${expr.unit}` : `${expr.unit}`);
    } else {
      parts.push(`- ${Math.abs(expr.unit)}`);
    }
  }
  if (parts.length === 0) return "0";
  return parts.join(" ");
}

export function balanceToLatex(state: BalanceState): string {
  return `${panSideToLatex(state.left)} = ${panSideToLatex(state.right)}`;
}

export function initialState(stepIndex: number): EquationOpsState {
  const problem = problemAt(stepIndex);
  return {
    balance: {
      left: { ...problem.initial.left },
      right: { ...problem.initial.right },
    },
    trail: [{ latex: problem.targetLatex, label: "시작" }],
    opCount: 0,
  };
}

export function workspaceFromState(
  state: EquationOpsState,
  seed = "",
): TileWorkspace {
  const ws = workspaceFromBalance(state.balance, seed);
  return applyZeroPairs(ws);
}

export function parseOpValue(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  return n;
}

export type ParsedOpTerm =
  | { target: "constant"; value: number }
  | { target: "x"; coeff: number };

/** Parse a term like `3`, `-3`, `x`, `-x`, `3x`, `-3x`. Returns null for invalid input. */
export function parseOpTerm(raw: string): ParsedOpTerm | null {
  const s = raw.trim().replace(/\s+/g, "");
  if (!s) return null;

  const xMatch = /^([+-]?)(\d*)x$/i.exec(s);
  if (xMatch) {
    const sign = xMatch[1] === "-" ? -1 : 1;
    const digits = xMatch[2];
    const coeff = digits ? parseInt(digits, 10) * sign : sign;
    if (!Number.isInteger(coeff) || coeff === 0) return null;
    return { target: "x", coeff };
  }

  const n = Number(s);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n === 0) return null;
  return { target: "constant", value: n };
}

export function termHasX(term: ParsedOpTerm): boolean {
  return term.target === "x";
}

export function formatTermDisplay(term: ParsedOpTerm): string {
  if (term.target === "constant") return String(term.value);
  if (term.coeff === 1) return "x";
  if (term.coeff === -1) return "-x";
  return `${term.coeff}x`;
}

export type BuildOpResult =
  | { ok: true; op: OpInput }
  | { ok: false; message: string };

export function buildOpInput(kind: OpKind, term: ParsedOpTerm): BuildOpResult {
  if (kind === "multiply" || kind === "divide") {
    if (term.target === "x") {
      return { ok: false, message: "x가 있으면 더하기·빼기만 할 수 있어요." };
    }
    if (term.value === 0) {
      return { ok: false, message: "0은 넣을 수 없어요." };
    }
    return { ok: true, op: { kind, target: "constant", value: term.value } };
  }

  const signed = term.target === "constant" ? term.value : term.coeff;
  const net = kind === "add" ? signed : -signed;
  const target: OpTarget = term.target === "x" ? "x" : "constant";

  if (net >= 0) {
    return { ok: true, op: { kind: "add", target, value: net } };
  }
  return { ok: true, op: { kind: "subtract", target, value: Math.abs(net) } };
}

const VERB_LABELS: Record<OpKind, string> = {
  add: "더한다",
  subtract: "뺀다",
  multiply: "곱한다",
  divide: "나눈다",
};

export function previewOpSentence(kind: OpKind, term: ParsedOpTerm): string {
  const display = formatTermDisplay(term);
  if (kind === "divide") {
    const particle = Math.abs(
      term.target === "constant" ? term.value : term.coeff,
    ).toString().endsWith("2")
      ? "로"
      : "으로";
    return `양변을 ${display}${particle} 나눕니다`;
  }
  if (kind === "multiply") {
    return `양변에 ${display}을 곱합니다`;
  }
  if (kind === "add") {
    return `양변에 ${display}을 더합니다`;
  }
  return `양변에 ${display}을 뺍니다`;
}

export { VERB_LABELS };

export function formatOpLabel(op: OpInput): string {
  const v = op.value;
  const abs = Math.abs(v);
  switch (op.kind) {
    case "add":
      if (op.target === "x") {
        return v === 1 ? "양변에 x 더하기" : `양변에 ${v}x 더하기`;
      }
      return `양변에 ${v} 더하기`;
    case "subtract":
      if (op.target === "x") {
        return v === 1 ? "양변에서 x 빼기" : `양변에서 ${v}x 빼기`;
      }
      return `양변에서 ${v} 빼기`;
    case "multiply":
      return `양변에 ${v} 곱하기`;
    case "divide":
      return `양변을 ${v}로 나누기`;
  }
}

export function validateOp(
  state: EquationOpsState,
  op: OpInput,
): OpValidation {
  if (op.value === 0 && (op.kind === "multiply" || op.kind === "divide")) {
    return { ok: false, message: "0은 넣을 수 없어요." };
  }
  if (!Number.isInteger(op.value)) {
    return { ok: false, message: "정수만 넣을 수 있어요." };
  }

  if (op.kind === "multiply" || op.kind === "divide") {
    const ws = workspaceFromState(state);
    if (ws.left.length === 0 || ws.right.length === 0) {
      return { ok: false, message: "양쪽에 막대가 있어야 해요." };
    }
    const check =
      op.kind === "multiply"
        ? canScaleMultiply(ws, op.value)
        : canScaleDivide(ws, op.value);
    if (!check.ok) {
      const msg =
        check.reason === "not_divisible"
          ? "나누어떨어지지 않아요."
          : check.reason === "too_many_tiles"
            ? "막대가 너무 많아져요."
            : check.reason === "zero"
              ? "0은 넣을 수 없어요."
              : "적용할 수 없어요.";
      return { ok: false, message: msg };
    }
    return { ok: true };
  }

  return { ok: true };
}

function addToBothSides(
  balance: BalanceState,
  target: OpTarget,
  delta: number,
): BalanceState {
  if (target === "constant") {
    return {
      left: { ...balance.left, unit: balance.left.unit + delta },
      right: { ...balance.right, unit: balance.right.unit + delta },
    };
  }
  return {
    left: { ...balance.left, x: balance.left.x + delta },
    right: { ...balance.right, x: balance.right.x + delta },
  };
}

export function applyOp(
  state: EquationOpsState,
  op: OpInput,
): EquationOpsState {
  let balance = state.balance;

  if (op.kind === "add") {
    balance = addToBothSides(balance, op.target, op.value);
  } else if (op.kind === "subtract") {
    balance = addToBothSides(balance, op.target, -op.value);
  } else {
    let ws = workspaceFromBalance(balance, "op");
    if (op.kind === "multiply") {
      ws = scaleMultiplyBothSides(ws, op.value);
    } else {
      ws = scaleDivideBothSides(ws, op.value);
    }
    balance = workspaceToBalance(ws);
  }

  const latex = balanceToLatex(balance);
  const label = formatOpLabel(op);

  return {
    balance,
    trail: [...state.trail, { latex, label }],
    opCount: state.opCount + 1,
  };
}

export function isStateSolved(state: EquationOpsState, xValue: number): boolean {
  const ws = workspaceFromState(state);
  return isSolved(ws, xValue);
}

export function isStateBalanced(
  state: EquationOpsState,
  xValue: number,
): boolean {
  const ws = workspaceFromState(state);
  return isBalancedWs(ws, xValue);
}

export function scoreForTime(elapsedMs: number): number {
  const t = Math.max(0, Math.min(elapsedMs, TIME_CAP_MS));
  const ratio = 1 - t / TIME_CAP_MS;
  return Math.max(MIN_SCORE, Math.round(MIN_SCORE + (MAX_SCORE - MIN_SCORE) * ratio));
}

export function projectedScore(elapsedMs: number): number {
  return scoreForTime(elapsedMs);
}

export function assertAllProblemsBalanced(): void {
  for (const p of PROBLEMS) {
    const ws = emptyTileWorkspace(
      {
        id: p.id,
        title: p.title,
        instruction: p.instruction,
        targetLatex: p.targetLatex,
        xValue: p.xValue,
        initial: p.initial,
        hints: p.hints,
        allowNegatives: true,
      },
      p.id,
    );
    if (!isBalancedWs(ws, p.xValue)) {
      throw new Error(`Problem ${p.id} not balanced`);
    }
  }
}
