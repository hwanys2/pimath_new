/**
 * 「현·접선 거리 챌린지」— drag-to-match game math (중3 · 3.2).
 * Core verb: DRAG a chord/point until a target length or distance locks.
 */

import { applyScoreGain, SCORE_HARD_MAX, SCORE_SOFT_CAP } from "@/lib/xp";

export { applyScoreGain, SCORE_SOFT_CAP, SCORE_HARD_MAX };

export const CONTENT_KEY = "g3-u3-2-starlight-seal";
export const START_LIVES = 3;
export const MAX_LIVES = 3;
export const TOTAL_ROUNDS = 12;
/** Absolute tolerance on continuous values for a successful lock. */
export const LOCK_TOL = 0.55;
/** Quick-tap rounds time limit (sec). */
export const TAP_TIME_SEC = 6;
/** Speed bonus if locked within this many seconds. */
export const SPEED_BONUS_SEC = 8;
export const SPEED_BONUS_POINTS = 8;

export const TRIPLES = [
  [3, 4, 5],
  [5, 12, 13],
  [6, 8, 10],
  [8, 15, 17],
  [7, 24, 25],
  [9, 12, 15],
  [12, 16, 20],
  [20, 21, 29],
] as const;

export type Triple = readonly [number, number, number];
export type Rng = () => number;

export type RoundKind =
  | "chord-length" // drag d → match chord length
  | "chord-dist" // drag d → match distance from center
  | "chord-equal" // drag movable chord → match fixed chord length
  | "tap-longest" // tap the longest of 3
  | "tangent-length" // drag PO → match PA
  | "tangent-equal"; // one PA shown; tap which equals PB (or drag twin)

export type RoundPlan = {
  index: number;
  kind: RoundKind;
  points: number;
  title: string;
};

/** 12 rounds → base 1000 pts. */
export const ROUND_PLAN: readonly RoundPlan[] = [
  { index: 0, kind: "chord-length", points: 70, title: "현 길이 맞추기" },
  { index: 1, kind: "chord-length", points: 70, title: "현 길이 맞추기" },
  { index: 2, kind: "tap-longest", points: 60, title: "가장 긴 현!" },
  { index: 3, kind: "chord-dist", points: 80, title: "거리 맞추기" },
  { index: 4, kind: "chord-length", points: 80, title: "현 길이 맞추기" },
  { index: 5, kind: "chord-equal", points: 80, title: "같은 길이로" },
  { index: 6, kind: "tap-longest", points: 60, title: "가장 긴 현!" },
  { index: 7, kind: "tangent-length", points: 90, title: "접선 길이 맞추기" },
  { index: 8, kind: "tangent-length", points: 90, title: "접선 길이 맞추기" },
  { index: 9, kind: "tangent-equal", points: 80, title: "두 접선은 같다" },
  { index: 10, kind: "chord-dist", points: 90, title: "거리 맞추기" },
  { index: 11, kind: "tangent-length", points: 150, title: "보스 · 접선 잠금" },
] as const;

export function planTotalPoints(): number {
  return ROUND_PLAN.reduce((s, r) => s + r.points, 0);
}

export function defaultRng(): Rng {
  return Math.random;
}

function pick<T>(arr: readonly T[], rng: Rng): T {
  return arr[Math.floor(rng() * arr.length) % arr.length]!;
}

function shuffleInPlace<T>(arr: T[], rng: Rng): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = t;
  }
  return arr;
}

function orient(t: Triple, rng: Rng): { a: number; b: number; c: number } {
  return rng() < 0.5
    ? { a: t[0], b: t[1], c: t[2] }
    : { a: t[1], b: t[0], c: t[2] };
}

export function chordLength(r: number, d: number): number {
  const dd = Math.min(Math.max(0, d), r);
  return 2 * Math.sqrt(Math.max(0, r * r - dd * dd));
}

export function tangentLength(po: number, r: number): number {
  if (po <= r) return 0;
  return Math.sqrt(po * po - r * r);
}

export type TapChord = {
  id: string;
  label: string;
  dist: number;
  length: number;
};

export type Round = {
  index: number;
  kind: RoundKind;
  points: number;
  title: string;
  prompt: string;
  tip: string;
  r: number;
  /** Correct distance from center (chord rounds). */
  targetDist: number;
  /** Correct chord length (chord rounds). */
  targetLength: number;
  /** Correct PO (tangent rounds). */
  targetPo: number;
  /** Correct PA (tangent rounds). */
  targetPa: number;
  /** Starting drag value (dist or po). */
  startValue: number;
  /** Drag min/max for the primary control. */
  dragMin: number;
  dragMax: number;
  /** Fixed chord for equal mode. */
  fixedDist?: number;
  fixedLength?: number;
  /** Tap options. */
  tapChords?: TapChord[];
  tapAnswerId?: string;
  /** Shown PA for tangent-equal (always equals PB). */
  shownPa?: number;
  equalOptions?: { id: string; label: string }[];
  equalAnswerId?: string;
};

function startOffset(correct: number, min: number, max: number, rng: Rng): number {
  // Start clearly away from the answer
  const span = max - min;
  let v =
    rng() < 0.5
      ? min + span * (0.1 + rng() * 0.25)
      : max - span * (0.1 + rng() * 0.25);
  if (Math.abs(v - correct) < span * 0.2) {
    v = correct < (min + max) / 2 ? max - span * 0.15 : min + span * 0.15;
  }
  return Math.min(max, Math.max(min, v));
}

function genChordLength(plan: RoundPlan, rng: Rng): Round {
  const { a, b, c } = orient(pick(TRIPLES, rng), rng);
  const r = c;
  const targetDist = a;
  const targetLength = 2 * b;
  const dragMin = 0.5;
  const dragMax = Math.max(dragMin + 1, r - 0.5);
  return {
    ...plan,
    prompt: `현의 길이를 ${targetLength}에 맞추세요. 현을 위·아래로 끌어 보세요!`,
    tip: "중심에 가까울수록 현이 길어져요",
    r,
    targetDist,
    targetLength,
    targetPo: 0,
    targetPa: 0,
    startValue: startOffset(targetDist, dragMin, dragMax, rng),
    dragMin,
    dragMax,
  };
}

function genChordDist(plan: RoundPlan, rng: Rng): Round {
  const { a, b, c } = orient(pick(TRIPLES, rng), rng);
  const r = c;
  const targetDist = a;
  const targetLength = 2 * b;
  const dragMin = 0.5;
  const dragMax = Math.max(dragMin + 1, r - 0.5);
  return {
    ...plan,
    prompt: `중심에서 현까지의 거리를 ${targetDist}에 맞추세요.`,
    tip: `지금 현의 길이가 실시간으로 보여요 · 목표 길이 참고 ≈ ${targetLength}`,
    r,
    targetDist,
    targetLength,
    targetPo: 0,
    targetPa: 0,
    startValue: startOffset(targetDist, dragMin, dragMax, rng),
    dragMin,
    dragMax,
  };
}

function genChordEqual(plan: RoundPlan, rng: Rng): Round {
  const { a, b, c } = orient(pick(TRIPLES, rng), rng);
  const r = c;
  const targetDist = a;
  const targetLength = 2 * b;
  const dragMin = 0.5;
  const dragMax = Math.max(dragMin + 1, r - 0.5);
  return {
    ...plan,
    prompt: `고정된 현 AB와 같은 길이가 되도록 현 CD를 끌어 맞추세요.`,
    tip: "같은 길이 ↔ 중심에서 같은 거리",
    r,
    targetDist,
    targetLength,
    targetPo: 0,
    targetPa: 0,
    fixedDist: a,
    fixedLength: targetLength,
    startValue: startOffset(targetDist, dragMin, dragMax, rng),
    dragMin,
    dragMax,
  };
}

function genTapLongest(plan: RoundPlan, rng: Rng): Round {
  const { a, c } = orient(pick(TRIPLES, rng), rng);
  const r = c;
  const near = Math.max(1, Math.min(a, r - 3));
  const lenNear = chordLength(r, near);
  const chords: TapChord[] = [
    { id: "AB", label: "AB", dist: near, length: lenNear },
    {
      id: "CD",
      label: "CD",
      dist: Math.min(r - 1, near + 2),
      length: chordLength(r, Math.min(r - 1, near + 2)),
    },
    {
      id: "EF",
      label: "EF",
      dist: Math.min(r - 1, near + 4),
      length: chordLength(r, Math.min(r - 1, near + 4)),
    },
  ];
  // Ensure AB is uniquely longest
  chords[0] = {
    id: "AB",
    label: "AB",
    dist: near,
    length: Math.max(chords[0]!.length, chords[1]!.length + 1, chords[2]!.length + 1),
  };
  const answer = chords[0]!;
  shuffleInPlace(chords, rng);
  return {
    ...plan,
    prompt: "거리에 표시된 현 중 가장 긴 것을 빠르게 고르세요!",
    tip: "가까울수록 길다",
    r,
    targetDist: answer.dist,
    targetLength: answer.length,
    targetPo: 0,
    targetPa: 0,
    startValue: 0,
    dragMin: 0,
    dragMax: r,
    tapChords: chords,
    tapAnswerId: answer.id,
  };
}

function genTangentLength(plan: RoundPlan, rng: Rng): Round {
  const { a, b, c } = orient(pick(TRIPLES, rng), rng);
  // a = r, b = PA, c = PO
  const r = a;
  const targetPa = b;
  const targetPo = c;
  const dragMin = r + 0.5;
  const dragMax = Math.max(dragMin + 2, c + Math.max(4, c * 0.4));
  return {
    ...plan,
    prompt: `접선 길이 PA를 ${targetPa}에 맞추세요. 점 P를 끌어 거리를 바꿔 보세요!`,
    tip: "접선 ⊥ 반지름 · PA = √(PO² − r²)",
    r,
    targetDist: 0,
    targetLength: 0,
    targetPo,
    targetPa,
    startValue: startOffset(targetPo, dragMin, dragMax, rng),
    dragMin,
    dragMax,
  };
}

function genTangentEqual(plan: RoundPlan, rng: Rng): Round {
  const { a, b, c } = orient(pick(TRIPLES, rng), rng);
  const r = a;
  const pa = b;
  const po = c;
  const options = shuffleInPlace(
    [
      { id: String(pa), label: String(pa) },
      { id: String(pa + 2), label: String(pa + 2) },
      { id: String(Math.max(1, pa - 2)), label: String(Math.max(1, pa - 2)) },
      { id: String(r), label: `반지름 ${r}` },
    ],
    rng,
  );
  return {
    ...plan,
    prompt: `PA = ${pa}일 때, PB의 길이는? (원 밖 한 점에서 두 접선)`,
    tip: "두 접선의 길이는 서로 같아요",
    r,
    targetDist: 0,
    targetLength: 0,
    targetPo: po,
    targetPa: pa,
    shownPa: pa,
    startValue: po,
    dragMin: po,
    dragMax: po,
    equalOptions: options,
    equalAnswerId: String(pa),
  };
}

export function generateRound(index: number, rng: Rng = defaultRng()): Round {
  const plan = ROUND_PLAN[index];
  if (!plan) throw new Error(`bad round ${index}`);
  switch (plan.kind) {
    case "chord-length":
      return genChordLength(plan, rng);
    case "chord-dist":
      return genChordDist(plan, rng);
    case "chord-equal":
      return genChordEqual(plan, rng);
    case "tap-longest":
      return genTapLongest(plan, rng);
    case "tangent-length":
      return genTangentLength(plan, rng);
    case "tangent-equal":
      return genTangentEqual(plan, rng);
  }
}

export function generateAllRounds(rng: Rng = defaultRng()): Round[] {
  return ROUND_PLAN.map((_, i) => generateRound(i, rng));
}

export function isDragRound(kind: RoundKind): boolean {
  return (
    kind === "chord-length" ||
    kind === "chord-dist" ||
    kind === "chord-equal" ||
    kind === "tangent-length"
  );
}

export function liveMetric(round: Round, value: number): number {
  if (
    round.kind === "chord-length" ||
    round.kind === "chord-equal"
  ) {
    return chordLength(round.r, value);
  }
  if (round.kind === "chord-dist") {
    return value;
  }
  if (round.kind === "tangent-length") {
    return tangentLength(value, round.r);
  }
  return value;
}

export function targetMetric(round: Round): number {
  if (round.kind === "chord-length" || round.kind === "chord-equal") {
    return round.targetLength;
  }
  if (round.kind === "chord-dist") {
    return round.targetDist;
  }
  if (round.kind === "tangent-length") {
    return round.targetPa;
  }
  return 0;
}

export function isInLockZone(round: Round, value: number): boolean {
  if (!isDragRound(round.kind)) return false;
  const live = liveMetric(round, value);
  const target = targetMetric(round);
  return Math.abs(live - target) <= LOCK_TOL;
}

export function checkTap(round: Round, id: string): boolean {
  return round.tapAnswerId === id;
}

export function checkEqual(round: Round, id: string): boolean {
  return round.equalAnswerId === id;
}

export function pointsForLock(
  round: Round,
  elapsedSec: number,
  perfect: boolean,
): number {
  let pts = round.points;
  if (elapsedSec <= SPEED_BONUS_SEC) pts += SPEED_BONUS_POINTS;
  if (perfect) pts += 5;
  return pts;
}

export function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(SCORE_HARD_MAX, Math.round(score)));
}

export function isTripleValid(t: Triple): boolean {
  return t[0] * t[0] + t[1] * t[1] === t[2] * t[2];
}

/** Map pointer Y in SVG user space → drag value (chord distance from top). */
export function distFromSvgY(
  svgY: number,
  cy: number,
  pr: number,
  dragMin: number,
  dragMax: number,
): number {
  // d=0 at center, d=max near bottom of circle
  const t = (svgY - cy) / pr; // -1..1-ish
  const norm = Math.min(1, Math.max(0, t)); // 0 at center, 1 at bottom
  return dragMin + norm * (dragMax - dragMin);
}

/** Map pointer → PO along vertical below circle. */
export function poFromSvgY(
  svgY: number,
  cy: number,
  pr: number,
  dragMin: number,
  dragMax: number,
): number {
  const start = cy + pr + 10;
  const end = cy + pr + 110;
  const t = (svgY - start) / Math.max(1, end - start);
  const norm = Math.min(1, Math.max(0, t));
  return dragMin + norm * (dragMax - dragMin);
}
