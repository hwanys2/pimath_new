/** Math helpers for 「삼각비 다리 놓기」 (중3 · 3.1 삼각비). */

import { applyScoreGain, SCORE_HARD_MAX, SCORE_SOFT_CAP } from "@/lib/xp";

export const CONTENT_KEY = "g3-u3-1-trig-builder";
export const STAGE_COUNT = 8;
/** Base points per stage before wrong-attempt penalties. 8 × 125 = 1000. */
export const BASE_POINTS_PER_STAGE = 125;
/** Floor after wrong-attempt penalties on a single stage. */
export const MIN_POINTS_PER_STAGE = 40;
/** Points deducted per wrong "확인" on a stage. */
export const WRONG_PENALTY = 28;
/** Relative tolerance when comparing expression value to target length. */
export const VALUE_TOLERANCE = 0.02;

export type SideKind = "hyp" | "adj" | "opp";
export type TrigFn = "sin" | "cos" | "tan";

export type LengthBlock = {
  id: string;
  kind: "length";
  value: number;
  label: string;
};

export type TrigBlock = {
  id: string;
  kind: "trig";
  value: TrigFn;
  label: string;
};

export type AngleBlock = {
  id: string;
  kind: "angle";
  value: number;
  label: string;
};

export type Block = LengthBlock | TrigBlock | AngleBlock;
export type SlotKind = "length" | "trig" | "angle";

export type ExpressionSlots = {
  length: LengthBlock | null;
  trig: TrigBlock | null;
  angle: AngleBlock | null;
};

/**
 * Geometric layout of the right triangle in the SVG scene.
 * - rightAt: where the right angle sits
 * - thetaAt: which acute vertex holds the reference angle θ
 * - unknown: which side is the broken bridge (x)
 * - given: which side shows the known length label
 */
export type TriangleLayout =
  | "floor-right" // right∠ bottom-left; θ bottom-right; hyp diagonal up-right
  | "floor-left" // mirrored: right∠ bottom-right; θ bottom-left
  | "wall-up" // right∠ top-left; climb up a cliff face
  | "wall-down" // right∠ bottom-left; drop down
  | "roof" // right∠ top-right; overhang
  | "lean-left"; // flipped lean

export type StageDef = {
  id: number;
  /** Reference acute angle in degrees (non-special angles preferred). */
  theta: number;
  givenSide: SideKind;
  givenLength: number;
  unknownSide: SideKind;
  layout: TriangleLayout;
  /** Distractor lengths / angles / trigs shown in the inventory. */
  distractors: {
    lengths?: number[];
    angles?: number[];
    trigs?: TrigFn[];
  };
  hint: string;
};

export const STAGES: readonly StageDef[] = [
  {
    id: 1,
    theta: 30,
    givenSide: "hyp",
    givenLength: 12,
    unknownSide: "opp",
    layout: "floor-right",
    distractors: { lengths: [15], angles: [60], trigs: ["cos", "tan"] },
    hint: "빗변이 주어졌고 x는 대변이에요. sin을 떠올려 보세요.",
  },
  {
    id: 2,
    theta: 40,
    givenSide: "hyp",
    givenLength: 10,
    unknownSide: "adj",
    layout: "floor-left",
    distractors: { lengths: [8], angles: [50], trigs: ["sin", "tan"] },
    hint: "빗변이 주어졌고 x는 인접변이에요.",
  },
  {
    id: 3,
    theta: 35,
    givenSide: "adj",
    givenLength: 8,
    unknownSide: "opp",
    layout: "wall-up",
    distractors: { lengths: [12], angles: [55], trigs: ["sin", "cos"] },
    hint: "인접변이 주어졌고 x는 대변이에요. tan!",
  },
  {
    id: 4,
    theta: 23,
    givenSide: "hyp",
    givenLength: 15,
    unknownSide: "opp",
    layout: "roof",
    distractors: {
      lengths: [10, 20],
      angles: [67, 30],
      trigs: ["cos", "tan"],
    },
    hint: "삼각형이 뒤집혀도 기준각 θ만 잘 찾으면 돼요.",
  },
  {
    id: 5,
    theta: 52,
    givenSide: "hyp",
    givenLength: 14,
    unknownSide: "adj",
    layout: "lean-left",
    distractors: {
      lengths: [9, 18],
      angles: [38, 45],
      trigs: ["sin", "tan"],
    },
    hint: "여각(90°−θ)과 헷갈리지 않게 기준각을 확인하세요.",
  },
  {
    id: 6,
    theta: 18,
    givenSide: "adj",
    givenLength: 20,
    unknownSide: "opp",
    layout: "wall-down",
    distractors: {
      lengths: [12, 25],
      angles: [72, 30],
      trigs: ["sin", "cos"],
    },
    hint: "인접변 × tan(기준각) = 대변",
  },
  {
    id: 7,
    theta: 37,
    givenSide: "hyp",
    givenLength: 9,
    unknownSide: "opp",
    layout: "floor-right",
    distractors: {
      lengths: [7, 11, 16],
      angles: [53, 45, 60],
      trigs: ["cos", "tan"],
    },
    hint: "sin(θ) = cos(90°−θ) 도 같은 값이에요.",
  },
  {
    id: 8,
    theta: 28,
    givenSide: "adj",
    givenLength: 11,
    unknownSide: "opp",
    layout: "wall-up",
    distractors: {
      lengths: [8, 14, 17],
      angles: [62, 32, 45],
      trigs: ["sin", "cos"],
    },
    hint: "마지막 다리! 기준각·인접변·대변 관계를 점검하세요.",
  },
];

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function evalTrig(fn: TrigFn, deg: number): number {
  const r = degToRad(deg);
  switch (fn) {
    case "sin":
      return Math.sin(r);
    case "cos":
      return Math.cos(r);
    case "tan":
      return Math.tan(r);
  }
}

/** True geometric length of the unknown side for a stage. */
export function targetLength(stage: StageDef): number {
  const { theta, givenSide, givenLength, unknownSide } = stage;
  const s = Math.sin(degToRad(theta));
  const c = Math.cos(degToRad(theta));
  const t = Math.tan(degToRad(theta));

  if (givenSide === "hyp") {
    if (unknownSide === "opp") return givenLength * s;
    if (unknownSide === "adj") return givenLength * c;
  }
  if (givenSide === "adj") {
    if (unknownSide === "opp") return givenLength * t;
    if (unknownSide === "hyp") return givenLength / c;
  }
  if (givenSide === "opp") {
    if (unknownSide === "adj") return givenLength / t;
    if (unknownSide === "hyp") return givenLength / s;
  }
  // Unsupported combo for this game (multiply-only set)
  return givenLength;
}

export function evaluateExpression(slots: ExpressionSlots): number | null {
  if (!slots.length || !slots.trig || !slots.angle) return null;
  const trigVal = evalTrig(slots.trig.value, slots.angle.value);
  if (!Number.isFinite(trigVal)) return null;
  return slots.length.value * trigVal;
}

/** Ratio of current expression length to target (1 = exact). Null if incomplete. */
export function bridgeRatio(slots: ExpressionSlots, stage: StageDef): number | null {
  const value = evaluateExpression(slots);
  if (value === null) return null;
  const target = targetLength(stage);
  if (target <= 0) return null;
  return value / target;
}

export function isExpressionCorrect(
  slots: ExpressionSlots,
  stage: StageDef,
): boolean {
  const value = evaluateExpression(slots);
  if (value === null) return false;
  const target = targetLength(stage);
  if (target <= 0) return false;
  const absTol = Math.max(0.05, Math.abs(target) * VALUE_TOLERANCE);
  return Math.abs(value - target) <= absTol;
}

export function pointsForStage(wrongAttempts: number): number {
  const raw = BASE_POINTS_PER_STAGE - wrongAttempts * WRONG_PENALTY;
  return Math.max(MIN_POINTS_PER_STAGE, Math.round(raw));
}

export function buildInventory(stage: StageDef): Block[] {
  const blocks: Block[] = [];
  const lengthSet = new Set<number>([
    stage.givenLength,
    ...(stage.distractors.lengths ?? []),
  ]);
  const angleSet = new Set<number>([
    stage.theta,
    90 - stage.theta,
    ...(stage.distractors.angles ?? []),
  ]);
  const trigSet = new Set<TrigFn>([
    "sin",
    "cos",
    "tan",
    ...(stage.distractors.trigs ?? []),
  ]);

  for (const v of lengthSet) {
    blocks.push({
      id: `L-${stage.id}-${v}`,
      kind: "length",
      value: v,
      label: String(v),
    });
  }
  for (const fn of trigSet) {
    blocks.push({
      id: `T-${stage.id}-${fn}`,
      kind: "trig",
      value: fn,
      label: fn,
    });
  }
  for (const a of angleSet) {
    if (a <= 0 || a >= 90) continue;
    blocks.push({
      id: `A-${stage.id}-${a}`,
      kind: "angle",
      value: a,
      label: `${a}°`,
    });
  }

  // Stable but mixed order: lengths → trigs → angles (UI can shuffle display)
  return blocks;
}

export function emptySlots(): ExpressionSlots {
  return { length: null, trig: null, angle: null };
}

export function expressionLatex(slots: ExpressionSlots): string {
  const L = slots.length ? String(slots.length.value) : "\\square";
  const T = slots.trig ? `\\${slots.trig.value}` : "\\square";
  const A = slots.angle ? `${slots.angle.value}^\\circ` : "\\square";
  return `${L}\\times ${T}\\!(${A})`;
}

export function sideLabelKo(side: SideKind): string {
  switch (side) {
    case "hyp":
      return "빗변";
    case "adj":
      return "인접변";
    case "opp":
      return "대변";
  }
}

export { applyScoreGain, SCORE_HARD_MAX, SCORE_SOFT_CAP };
