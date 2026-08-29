import {
  MAX_PERIOD_DIGITS,
  parseDivisionInputs,
  type LongDivisionLayout,
} from "@/lib/diagrams/repeating-decimal/division";

export type RepeatingDecimalStyle = {
  lineWidth: number;
  fontSize: number;
  exportScale: number;
};

export type RepeatingDecimalState = {
  dividendInput: string;
  divisorInput: string;
  showQuotient: boolean;
  showRemainderMarks: boolean;
  showSameMark: boolean;
  style: RepeatingDecimalStyle;
};

export type RepeatingDecimalPreset = {
  id: string;
  title: string;
  hint: string;
  state: RepeatingDecimalState;
};

const DEFAULT_STYLE: RepeatingDecimalStyle = {
  lineWidth: 1.5,
  fontSize: 22,
  exportScale: 3,
};

export const DEFAULT_REPEATING_DECIMAL_STATE: RepeatingDecimalState = {
  dividendInput: "1",
  divisorInput: "7",
  showQuotient: true,
  showRemainderMarks: true,
  showSameMark: true,
  style: { ...DEFAULT_STYLE },
};

function makeState(
  patch: Partial<RepeatingDecimalState> &
    Pick<RepeatingDecimalState, "dividendInput" | "divisorInput">,
): RepeatingDecimalState {
  return normalizeState({
    ...DEFAULT_REPEATING_DECIMAL_STATE,
    ...patch,
    style: { ...DEFAULT_STYLE, ...patch.style },
  });
}

export const REPEATING_DECIMAL_PRESETS: RepeatingDecimalPreset[] = [
  {
    id: "one-seventh",
    title: "1÷7",
    hint: "순순환 6자리",
    state: makeState({ dividendInput: "1", divisorInput: "7" }),
  },
  {
    id: "one-sixth",
    title: "1÷6",
    hint: "혼합순환",
    state: makeState({ dividendInput: "1", divisorInput: "6" }),
  },
  {
    id: "one-third",
    title: "1÷3",
    hint: "마디 한 자리",
    state: makeState({ dividendInput: "1", divisorInput: "3" }),
  },
  {
    id: "one-half",
    title: "1÷2",
    hint: "유한소수",
    state: makeState({ dividendInput: "1", divisorInput: "2" }),
  },
  {
    id: "two-eleventh",
    title: "2÷11",
    hint: "0.18…",
    state: makeState({ dividendInput: "2", divisorInput: "11" }),
  },
  {
    id: "twenty-two-seventh",
    title: "22÷7",
    hint: "정수 있음",
    state: makeState({ dividendInput: "22", divisorInput: "7" }),
  },
];

export function cloneState(
  state: RepeatingDecimalState,
): RepeatingDecimalState {
  return {
    ...state,
    style: { ...state.style },
  };
}

export function normalizeState(
  state: RepeatingDecimalState,
): RepeatingDecimalState {
  const fontSize = Math.min(40, Math.max(14, Math.round(state.style.fontSize)));
  const lineWidth = Math.min(3.5, Math.max(1, state.style.lineWidth));
  const exportScale = [2, 3, 4].includes(state.style.exportScale)
    ? state.style.exportScale
    : 3;
  return {
    dividendInput: String(state.dividendInput ?? "1"),
    divisorInput: String(state.divisorInput ?? "7"),
    showQuotient: state.showQuotient !== false,
    showRemainderMarks: state.showRemainderMarks !== false,
    showSameMark: state.showSameMark !== false,
    style: { lineWidth, fontSize, exportScale },
  };
}

export function layoutFromState(
  state: RepeatingDecimalState,
): LongDivisionLayout | null {
  const parsed = parseDivisionInputs(state.dividendInput, state.divisorInput);
  return parsed.ok ? parsed.layout : null;
}

export { MAX_PERIOD_DIGITS };
