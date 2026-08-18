export type CalcOp = "+" | "-" | "*" | "/";

export type CalcState = {
  display: string;
  acc: number | null;
  op: CalcOp | null;
  waiting: boolean;
  error: boolean;
};

export const INITIAL_CALC: CalcState = {
  display: "0",
  acc: null,
  op: null,
  waiting: false,
  error: false,
};

export function formatCalc(n: number): string {
  if (!Number.isFinite(n)) return "오류";
  const rounded = Number(n.toPrecision(12));
  if (Object.is(rounded, -0)) return "0";
  let s = String(rounded);
  if (s.includes("e")) {
    s = Math.abs(rounded) < 1
      ? rounded.toFixed(10).replace(/\.?0+$/, "")
      : rounded.toPrecision(8);
  }
  if (s.length > 14) s = rounded.toPrecision(8);
  return s;
}

export function applyOp(a: number, op: CalcOp, b: number): number | null {
  switch (op) {
    case "+":
      return a + b;
    case "-":
      return a - b;
    case "*":
      return a * b;
    case "/":
      return b === 0 ? null : a / b;
  }
}

export function calcDigit(state: CalcState, digit: string): CalcState {
  if (state.error) {
    return { ...INITIAL_CALC, display: digit };
  }
  if (state.waiting) {
    return { ...state, display: digit, waiting: false };
  }
  const body = state.display.replace("-", "").replace(".", "");
  if (body.length >= 12) return state;
  if (state.display === "0") return { ...state, display: digit };
  if (state.display === "-0") return { ...state, display: `-${digit}` };
  return { ...state, display: state.display + digit };
}

export function calcDot(state: CalcState): CalcState {
  if (state.error) return { ...INITIAL_CALC, display: "0." };
  if (state.waiting) return { ...state, display: "0.", waiting: false };
  if (state.display.includes(".")) return state;
  return { ...state, display: `${state.display}.` };
}

export function calcOp(state: CalcState, op: CalcOp): CalcState {
  if (state.error) return INITIAL_CALC;
  const n = Number(state.display);
  if (!Number.isFinite(n)) return { ...INITIAL_CALC, display: "오류", error: true };
  if (state.acc != null && state.op && !state.waiting) {
    const r = applyOp(state.acc, state.op, n);
    if (r == null) return { ...INITIAL_CALC, display: "오류", error: true };
    return {
      display: formatCalc(r),
      acc: r,
      op,
      waiting: true,
      error: false,
    };
  }
  return { ...state, acc: n, op, waiting: true };
}

export function calcEq(state: CalcState): CalcState {
  if (state.error || state.op == null || state.acc == null) return state;
  const n = Number(state.display);
  if (!Number.isFinite(n)) return { ...INITIAL_CALC, display: "오류", error: true };
  const r = applyOp(state.acc, state.op, n);
  if (r == null) return { ...INITIAL_CALC, display: "오류", error: true };
  return {
    display: formatCalc(r),
    acc: null,
    op: null,
    waiting: true,
    error: false,
  };
}

export function calcClear(): CalcState {
  return INITIAL_CALC;
}

export function calcBack(state: CalcState): CalcState {
  if (state.error) return INITIAL_CALC;
  if (state.waiting) return state;
  const next = state.display.slice(0, -1);
  if (next === "" || next === "-") return { ...state, display: "0" };
  return { ...state, display: next };
}
