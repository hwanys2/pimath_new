/**
 * Math helpers for 「결계 수리공 별빛: 현과 접선」 (중3 · 3.2 원의 성질).
 * Pure functions — no React / DOM.
 */

import { applyScoreGain, SCORE_HARD_MAX, SCORE_SOFT_CAP } from "@/lib/xp";

export { applyScoreGain, SCORE_SOFT_CAP, SCORE_HARD_MAX };

export const CONTENT_KEY = "g3-u3-2-starlight-seal";
export const START_ENERGY = 3;
export const MAX_ENERGY = 3;
export const JUDGE_TIME_SEC = 10;
export const SPEED_BONUS_SEC = 15;
export const SPEED_BONUS_POINTS = 5;
export const TOTAL_SEALS = 12;

/** Pythagorean triples (a,b,c) with a²+b²=c² — used as (leg,leg,hyp) for chords/tangents. */
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

export type SealChapter = 1 | 2 | 3;
export type SealKind = "judge" | "calc";
export type SealSlotId =
  | "longest-chord"
  | "chord-len-from-rd"
  | "chord-r-or-d"
  | "equal-dist-or-nearest"
  | "equal-chord-r"
  | "tangent-equal-or-right"
  | "tangent-pa-from-po-r"
  | "tangent-po-or-r"
  | "tangent-angles"
  | "incircle-tangent"
  | "circum-quad"
  | "right-incircle-r";

export type SealPlanEntry = {
  index: number; // 0-based
  chapter: SealChapter;
  kind: SealKind;
  points: number;
  slotId: SealSlotId;
  title: string;
};

/** 12 seals — total base points = 1000. */
export const SEAL_PLAN: readonly SealPlanEntry[] = [
  {
    index: 0,
    chapter: 1,
    kind: "judge",
    points: 50,
    slotId: "longest-chord",
    title: "가장 긴 봉인선",
  },
  {
    index: 1,
    chapter: 1,
    kind: "calc",
    points: 80,
    slotId: "chord-len-from-rd",
    title: "현의 길이",
  },
  {
    index: 2,
    chapter: 1,
    kind: "calc",
    points: 80,
    slotId: "chord-r-or-d",
    title: "반지름·거리 찾기",
  },
  {
    index: 3,
    chapter: 1,
    kind: "judge",
    points: 50,
    slotId: "equal-dist-or-nearest",
    title: "같은 거리 · 가까운 현",
  },
  {
    index: 4,
    chapter: 1,
    kind: "calc",
    points: 90,
    slotId: "equal-chord-r",
    title: "같은 길이의 현",
  },
  {
    index: 5,
    chapter: 2,
    kind: "judge",
    points: 50,
    slotId: "tangent-equal-or-right",
    title: "접선 성질 판정",
  },
  {
    index: 6,
    chapter: 2,
    kind: "calc",
    points: 80,
    slotId: "tangent-pa-from-po-r",
    title: "접선 길이",
  },
  {
    index: 7,
    chapter: 2,
    kind: "calc",
    points: 80,
    slotId: "tangent-po-or-r",
    title: "PO · 반지름",
  },
  {
    index: 8,
    chapter: 2,
    kind: "calc",
    points: 90,
    slotId: "tangent-angles",
    title: "접선과 각",
  },
  {
    index: 9,
    chapter: 3,
    kind: "calc",
    points: 100,
    slotId: "incircle-tangent",
    title: "내접원 접선 길이",
  },
  {
    index: 10,
    chapter: 3,
    kind: "calc",
    points: 100,
    slotId: "circum-quad",
    title: "외접 사각형",
  },
  {
    index: 11,
    chapter: 3,
    kind: "calc",
    points: 150,
    slotId: "right-incircle-r",
    title: "직각삼각형 내접원",
  },
] as const;

export function sealPlanTotalPoints(): number {
  return SEAL_PLAN.reduce((s, e) => s + e.points, 0);
}

export type Rng = () => number; // [0,1)

export function defaultRng(): Rng {
  return Math.random;
}

function pick<T>(arr: readonly T[], rng: Rng): T {
  return arr[Math.floor(rng() * arr.length) % arr.length]!;
}

function shuffleInPlace<T>(arr: T[], rng: Rng): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

function pickTriple(rng: Rng): Triple {
  return pick(TRIPLES, rng);
}

/** Swap legs randomly so either can be half-chord or distance. */
function orientTriple(t: Triple, rng: Rng): { a: number; b: number; c: number } {
  if (rng() < 0.5) return { a: t[0], b: t[1], c: t[2] };
  return { a: t[1], b: t[0], c: t[2] };
}

export type SceneKind =
  | "chord-perpendicular"
  | "multi-chords"
  | "two-tangents"
  | "incircle-triangle"
  | "circum-quad"
  | "right-incircle";

export type ChordScene = {
  kind: "chord-perpendicular";
  r: number;
  d: number;
  halfChord: number;
  chordLen: number;
  /** Which value the student is solving for (for preview). */
  solveFor: "chordLen" | "r" | "d";
};

export type MultiChordItem = {
  id: string;
  label: string;
  /** Distance from center (smaller = longer chord). */
  dist: number;
  chordLen: number;
};

export type MultiChordsScene = {
  kind: "multi-chords";
  r: number;
  chords: MultiChordItem[];
  mode: "longest" | "nearest" | "equal-pick";
};

export type TwoTangentsScene = {
  kind: "two-tangents";
  r: number;
  po: number;
  pa: number;
  angleApb?: number;
  solveFor: "pa" | "po" | "r" | "angleAob" | "anglePab" | "judge";
  showRightAngle?: boolean;
  showPaLabel?: boolean;
  hidePb?: boolean;
};

export type IncircleTriangleScene = {
  kind: "incircle-triangle";
  /** Side lengths a=BC, b=CA, c=AB */
  sides: [number, number, number];
  /** Tangent lengths opposite vertices A,B,C → x from A, y from B, z from C */
  tangents: [number, number, number];
  solveFor: "side" | "tangent";
  askLabel: string;
};

export type CircumQuadScene = {
  kind: "circum-quad";
  /** Sides AB, BC, CD, DA */
  sides: [number, number, number, number];
  missingIndex: 0 | 1 | 2 | 3;
};

export type RightIncircleScene = {
  kind: "right-incircle";
  a: number;
  b: number;
  c: number;
  r: number;
};

export type SealScene =
  | ChordScene
  | MultiChordsScene
  | TwoTangentsScene
  | IncircleTriangleScene
  | CircumQuadScene
  | RightIncircleScene;

export type JudgeOption = {
  id: string;
  label: string;
};

export type Seal = {
  index: number;
  chapter: SealChapter;
  kind: SealKind;
  points: number;
  slotId: SealSlotId;
  title: string;
  prompt: string;
  answer: number | string;
  /** Unit shown next to number input (calc only). */
  unit?: string;
  options?: JudgeOption[];
  scene: SealScene;
  solution: string;
  /** For preview: map student numeric guess into a scene override. */
  previewKey?: "chordLen" | "r" | "d" | "pa" | "po" | "angle";
};

export function chapterLabel(chapter: SealChapter): string {
  switch (chapter) {
    case 1:
      return "1장 · 봉인선";
    case 2:
      return "2장 · 빛줄기";
    case 3:
      return "3장 · 합체 결계";
  }
}

function genLongestChord(plan: SealPlanEntry, rng: Rng): Seal {
  const t = pickTriple(rng);
  const { a, c } = orientTriple(t, rng);
  const r = c;
  const dNear = Math.max(1, Math.min(a, r - 2));
  const halfNear = Math.round(Math.sqrt(r * r - dNear * dNear));
  const lenNear = 2 * halfNear;
  const dMid = Math.min(r - 1, dNear + 2);
  const halfMid = Math.max(1, halfNear - 2);
  const dFar = Math.min(r - 1, dNear + 4);
  const halfFar = Math.max(1, halfNear - 4);

  const chords: MultiChordItem[] = [
    { id: "AB", label: "AB", dist: dNear, chordLen: lenNear },
    { id: "CD", label: "CD", dist: dMid, chordLen: 2 * halfMid },
    { id: "EF", label: "EF", dist: dFar, chordLen: 2 * halfFar },
  ];
  const longest = chords[0]!;
  shuffleInPlace(chords, rng);

  return {
    ...plan,
    prompt: `원의 중심에서 거리가 표시된 현 중에서 가장 긴 현을 고르세요.`,
    answer: longest.id,
    options: chords.map((ch) => ({
      id: ch.id,
      label: `${ch.label} (거리 ${ch.dist})`,
    })),
    scene: {
      kind: "multi-chords",
      r,
      chords,
      mode: "longest",
    },
    solution: `중심에 가까울수록 현이 깁니다. 거리가 ${longest.dist}인 ${longest.label}이(가) 가장 깁니다.`,
  };
}

function genChordLenFromRd(plan: SealPlanEntry, rng: Rng): Seal {
  const t = pickTriple(rng);
  const { a, b, c } = orientTriple(t, rng);
  const r = c;
  const d = a;
  const half = b;
  const chordLen = 2 * half;
  return {
    ...plan,
    prompt: `반지름이 ${r}, 중심에서 현까지의 거리가 ${d}일 때 현의 길이를 구하세요.`,
    answer: chordLen,
    unit: "",
    scene: {
      kind: "chord-perpendicular",
      r,
      d,
      halfChord: half,
      chordLen,
      solveFor: "chordLen",
    },
    solution: `중심에서 현에 수선을 내리면 현을 이등분합니다. √(${r}²−${d}²)=${half}이므로 현의 길이는 2×${half}=${chordLen}입니다.`,
    previewKey: "chordLen",
  };
}

function genChordROrD(plan: SealPlanEntry, rng: Rng): Seal {
  const t = pickTriple(rng);
  const { a, b, c } = orientTriple(t, rng);
  const r = c;
  const d = a;
  const half = b;
  const chordLen = 2 * half;
  const askR = rng() < 0.5;
  if (askR) {
    return {
      ...plan,
      prompt: `현의 길이가 ${chordLen}, 중심에서 현까지의 거리가 ${d}일 때 반지름을 구하세요.`,
      answer: r,
      unit: "",
      scene: {
        kind: "chord-perpendicular",
        r,
        d,
        halfChord: half,
        chordLen,
        solveFor: "r",
      },
      solution: `현의 절반은 ${half}입니다. 반지름 = √(${half}²+${d}²)=${r}입니다.`,
      previewKey: "r",
    };
  }
  return {
    ...plan,
    prompt: `반지름이 ${r}, 현의 길이가 ${chordLen}일 때 중심에서 현까지의 거리를 구하세요.`,
    answer: d,
    unit: "",
    scene: {
      kind: "chord-perpendicular",
      r,
      d,
      halfChord: half,
      chordLen,
      solveFor: "d",
    },
    solution: `현의 절반은 ${half}입니다. 거리 = √(${r}²−${half}²)=${d}입니다.`,
    previewKey: "d",
  };
}

function genEqualDistOrNearest(plan: SealPlanEntry, rng: Rng): Seal {
  const modeEqual = rng() < 0.5;
  const t = pickTriple(rng);
  const { a, b, c } = orientTriple(t, rng);
  const r = c;

  if (modeEqual) {
    const ab = 2 * b;
    const equalId = "CD";
    const options: JudgeOption[] = shuffleInPlace(
      [
        { id: "CD", label: `CD = ${ab}` },
        { id: "EF", label: `EF = ${ab + 2}` },
        { id: "GH", label: `GH = ${Math.max(2, ab - 2)}` },
      ],
      rng,
    );
    const chords: MultiChordItem[] = [
      { id: "AB", label: "AB", dist: a, chordLen: ab },
      { id: "CD", label: "CD", dist: a, chordLen: ab },
      {
        id: "EF",
        label: "EF",
        dist: Math.max(1, a - 2),
        chordLen: ab + 2,
      },
    ];
    return {
      ...plan,
      prompt: `OM = ON이고 AB = ${ab}일 때, CD의 길이로 알맞은 것을 고르세요. (같은 거리 → 같은 길이)`,
      answer: equalId,
      options,
      scene: {
        kind: "multi-chords",
        r,
        chords,
        mode: "equal-pick",
      },
      solution: `중심에서 같은 거리에 있는 두 현의 길이는 같습니다. 따라서 CD = AB = ${ab}입니다.`,
    };
  }

  // Nearest = uniquely longest chord
  const dNear = Math.max(1, Math.min(a, r - 2));
  const halfNear = Math.round(Math.sqrt(r * r - dNear * dNear));
  const lenNear = 2 * halfNear;
  const chords: MultiChordItem[] = [
    { id: "AB", label: "AB", dist: dNear, chordLen: lenNear },
    {
      id: "CD",
      label: "CD",
      dist: Math.min(r - 1, dNear + 3),
      chordLen: Math.max(2, lenNear - 4),
    },
    {
      id: "EF",
      label: "EF",
      dist: Math.min(r - 1, dNear + 5),
      chordLen: Math.max(2, lenNear - 8),
    },
  ];
  const nearest = chords[0]!;
  shuffleInPlace(chords, rng);
  return {
    ...plan,
    prompt: `길이가 표시된 현 중에서 원의 중심에 가장 가까운 현을 고르세요.`,
    answer: nearest.id,
    options: chords.map((ch) => ({
      id: ch.id,
      label: `${ch.label} (길이 ${ch.chordLen})`,
    })),
    scene: {
      kind: "multi-chords",
      r,
      chords,
      mode: "nearest",
    },
    solution: `현이 길수록 중심에 가깝습니다. 길이가 ${nearest.chordLen}인 ${nearest.label}이(가) 가장 가깝습니다.`,
  };
}

function genEqualChordR(plan: SealPlanEntry, rng: Rng): Seal {
  const t = pickTriple(rng);
  const { a, b, c } = orientTriple(t, rng);
  const r = c;
  const d = a;
  const half = b;
  const chordLen = 2 * half;
  return {
    ...plan,
    prompt: `OM = ON이고 AB = CD = ${chordLen}, OM = ${d}일 때 반지름을 구하세요.`,
    answer: r,
    unit: "",
    scene: {
      kind: "chord-perpendicular",
      r,
      d,
      halfChord: half,
      chordLen,
      solveFor: "r",
    },
    solution: `같은 길이의 현은 중심에서 같은 거리에 있습니다. √(${half}²+${d}²)=${r}입니다.`,
    previewKey: "r",
  };
}

function genTangentEqualOrRight(plan: SealPlanEntry, rng: Rng): Seal {
  const t = pickTriple(rng);
  const { a, b, c } = orientTriple(t, rng);
  const r = a;
  const pa = b;
  const po = c;
  const modeEqual = rng() < 0.5;

  if (modeEqual) {
    const options: JudgeOption[] = shuffleInPlace(
      [
        { id: String(pa), label: String(pa) },
        { id: String(pa + 2), label: String(pa + 2) },
        { id: String(Math.max(1, pa - 1)), label: String(Math.max(1, pa - 1)) },
        { id: String(r), label: String(r) },
      ],
      rng,
    );
    return {
      ...plan,
      prompt: `원 밖의 점 P에서 접점 A, B로 접선을 그었습니다. PA = ${pa}일 때 PB의 길이는?`,
      answer: String(pa),
      options,
      scene: {
        kind: "two-tangents",
        r,
        po,
        pa,
        solveFor: "judge",
        showPaLabel: true,
        hidePb: true,
        showRightAngle: true,
      },
      solution: `원 밖의 한 점에서 그은 두 접선의 길이는 같습니다. 따라서 PB = PA = ${pa}입니다.`,
    };
  }

  const options: JudgeOption[] = shuffleInPlace(
    [
      { id: "90", label: "90°" },
      { id: "45", label: "45°" },
      { id: "60", label: "60°" },
      { id: "180", label: "180°" },
    ],
    rng,
  );
  return {
    ...plan,
    prompt: `접점 A에서 반지름 OA와 접선 PA가 이루는 각 ∠OAP의 크기는?`,
    answer: "90",
    options,
    scene: {
      kind: "two-tangents",
      r,
      po,
      pa,
      solveFor: "judge",
      showRightAngle: false,
      showPaLabel: true,
    },
    solution: `접선은 접점에서 반지름에 수직입니다. ∠OAP = 90°입니다.`,
  };
}

function genTangentPa(plan: SealPlanEntry, rng: Rng): Seal {
  const t = pickTriple(rng);
  const { a, b, c } = orientTriple(t, rng);
  const r = a;
  const pa = b;
  const po = c;
  return {
    ...plan,
    prompt: `PO = ${po}, 반지름 = ${r}일 때 접선 PA의 길이를 구하세요.`,
    answer: pa,
    unit: "",
    scene: {
      kind: "two-tangents",
      r,
      po,
      pa,
      solveFor: "pa",
      showRightAngle: true,
      hidePb: true,
    },
    solution: `접선 ⊥ 반지름이므로 △OAP는 직각삼각형입니다. PA = √(${po}²−${r}²)=${pa}입니다.`,
    previewKey: "pa",
  };
}

function genTangentPoOrR(plan: SealPlanEntry, rng: Rng): Seal {
  const t = pickTriple(rng);
  const { a, b, c } = orientTriple(t, rng);
  const r = a;
  const pa = b;
  const po = c;
  const askPo = rng() < 0.5;
  if (askPo) {
    return {
      ...plan,
      prompt: `접선 PA = ${pa}, 반지름 = ${r}일 때 PO의 길이를 구하세요.`,
      answer: po,
      unit: "",
      scene: {
        kind: "two-tangents",
        r,
        po,
        pa,
        solveFor: "po",
        showRightAngle: true,
        showPaLabel: true,
        hidePb: true,
      },
      solution: `PO = √(${pa}²+${r}²)=${po}입니다.`,
      previewKey: "po",
    };
  }
  return {
    ...plan,
    prompt: `PO = ${po}, 접선 PA = ${pa}일 때 반지름을 구하세요.`,
    answer: r,
    unit: "",
    scene: {
      kind: "two-tangents",
      r,
      po,
      pa,
      solveFor: "r",
      showRightAngle: true,
      showPaLabel: true,
      hidePb: true,
    },
    solution: `반지름 = √(${po}²−${pa}²)=${r}입니다.`,
    previewKey: "r",
  };
}

/** Nice angles where (180-θ)/2 is integer. */
const ANGLE_APB_CHOICES = [40, 50, 60, 70, 80, 100, 120] as const;

function genTangentAngles(plan: SealPlanEntry, rng: Rng): Seal {
  const t = pickTriple(rng);
  const { a, b, c } = orientTriple(t, rng);
  const r = a;
  const pa = b;
  const po = c;
  const theta = pick(ANGLE_APB_CHOICES, rng);
  const askAob = rng() < 0.5;
  if (askAob) {
    const aob = 180 - theta;
    return {
      ...plan,
      prompt: `두 접선이 이루는 각 ∠APB = ${theta}°일 때 ∠AOB의 크기를 구하세요.`,
      answer: aob,
      unit: "°",
      scene: {
        kind: "two-tangents",
        r,
        po,
        pa,
        angleApb: theta,
        solveFor: "angleAob",
        showRightAngle: true,
        showPaLabel: true,
      },
      solution: `사각형 OAPB에서 ∠OAP = ∠OBP = 90°이므로 ∠AOB = 180° − ${theta}° = ${aob}°입니다.`,
      previewKey: "angle",
    };
  }
  const pab = (180 - theta) / 2;
  return {
    ...plan,
    prompt: `두 접선이 이루는 각 ∠APB = ${theta}°일 때 ∠PAB의 크기를 구하세요.`,
    answer: pab,
    unit: "°",
    scene: {
      kind: "two-tangents",
      r,
      po,
      pa,
      angleApb: theta,
      solveFor: "anglePab",
      showRightAngle: true,
      showPaLabel: true,
    },
    solution: `△PAB는 이등변삼각형(PA=PB)이므로 ∠PAB = (180° − ${theta}°)/2 = ${pab}°입니다.`,
    previewKey: "angle",
  };
}

/**
 * Generate positive integer tangent lengths x,y,z and sides
 * a = y+z, b = z+x, c = x+y with triangle inequality (always true if x,y,z > 0).
 */
export function buildIncircleFromTangents(
  x: number,
  y: number,
  z: number,
): { sides: [number, number, number]; tangents: [number, number, number] } | null {
  if (x <= 0 || y <= 0 || z <= 0) return null;
  if (![x, y, z].every((n) => Number.isInteger(n))) return null;
  const sides: [number, number, number] = [y + z, z + x, x + y];
  const [a, b, c] = sides;
  if (a + b <= c || b + c <= a || c + a <= b) return null;
  return { sides, tangents: [x, y, z] };
}

function genIncircleTangent(plan: SealPlanEntry, rng: Rng): Seal {
  const pools = [2, 3, 4, 5, 6, 7, 8, 9, 10];
  let built: ReturnType<typeof buildIncircleFromTangents> = null;
  let x = 3,
    y = 4,
    z = 5;
  for (let i = 0; i < 20 && !built; i++) {
    x = pick(pools, rng);
    y = pick(pools, rng);
    z = pick(pools, rng);
    built = buildIncircleFromTangents(x, y, z);
  }
  if (!built) {
    x = 3;
    y = 5;
    z = 4;
    built = buildIncircleFromTangents(x, y, z)!;
  }
  const { sides, tangents } = built;
  const askSide = rng() < 0.5;
  if (askSide) {
    // Give tangents, ask for one side
    const which = Math.floor(rng() * 3) as 0 | 1 | 2;
    const sideNames = ["BC", "CA", "AB"] as const;
    const answer = sides[which]!;
    return {
      ...plan,
      prompt: `삼각형의 내접원에 대한 접선 길이가 꼭짓점 A쪽에서 ${tangents[0]}, B쪽에서 ${tangents[1]}, C쪽에서 ${tangents[2]}일 때 변 ${sideNames[which]}의 길이를 구하세요.`,
      answer,
      unit: "",
      scene: {
        kind: "incircle-triangle",
        sides,
        tangents,
        solveFor: "side",
        askLabel: sideNames[which],
      },
      solution: `변 ${sideNames[which]} = 두 접선 길이의 합 = ${answer}입니다.`,
    };
  }
  // Give two sides (or sides + one tangent), ask for a tangent
  const which = Math.floor(rng() * 3) as 0 | 1 | 2;
  const tanNames = ["A쪽 접선", "B쪽 접선", "C쪽 접선"] as const;
  const answer = tangents[which]!;
  // s = (a+b+c)/2; tangent from A = s-a etc. But we state sides and ask tangent via s-a
  const [sa, sb, sc] = sides;
  const s = (sa + sb + sc) / 2;
  const formulas = [s - sa, s - sb, s - sc];
  return {
    ...plan,
    prompt: `변의 길이가 BC=${sa}, CA=${sb}, AB=${sc}인 삼각형에 원이 내접합니다. ${tanNames[which]}의 길이를 구하세요.`,
    answer: formulas[which]!,
    unit: "",
    scene: {
      kind: "incircle-triangle",
      sides,
      tangents,
      solveFor: "tangent",
      askLabel: tanNames[which],
    },
    solution: `반둘레 s=${s}이므로 ${tanNames[which]} = s − (맞은편 변) = ${answer}입니다.`,
  };
}

/**
 * Circumscribed quadrilateral: AB+CD = AD+BC.
 * Provide three sides, ask for the fourth.
 */
export function buildCircumQuad(
  ab: number,
  bc: number,
  cd: number,
  da: number,
): boolean {
  if (![ab, bc, cd, da].every((n) => n > 0 && Number.isInteger(n))) return false;
  return ab + cd === da + bc;
}

function genCircumQuad(plan: SealPlanEntry, rng: Rng): Seal {
  // Pick three sides, compute fourth so AB+CD = AD+BC
  const ab = pick([5, 6, 7, 8, 9, 10, 12], rng);
  const bc = pick([4, 5, 6, 7, 8, 9], rng);
  const cd = pick([3, 4, 5, 6, 7, 8, 10], rng);
  // AB + CD = AD + BC → AD = AB + CD - BC
  let da = ab + cd - bc;
  if (da <= 0) {
    da = ab + bc - cd;
    // swap roles if needed — rebuild with different missing
  }
  // Ensure positive
  if (da <= 0) {
    // fallback fixed
    const sides: [number, number, number, number] = [6, 5, 4, 5]; // 6+4=5+5
    const missingIndex = Math.floor(rng() * 4) as 0 | 1 | 2 | 3;
    const labels = ["AB", "BC", "CD", "DA"] as const;
    const shown = sides.map((v, i) =>
      i === missingIndex ? "?" : String(v),
    );
    return {
      ...plan,
      prompt: `원에 외접하는 사각형에서 AB=${shown[0]}, BC=${shown[1]}, CD=${shown[2]}, DA=${shown[3]}일 때 빈칸의 길이를 구하세요. (AB+CD=AD+BC)`,
      answer: sides[missingIndex]!,
      unit: "",
      scene: {
        kind: "circum-quad",
        sides,
        missingIndex,
      },
      solution: `원에 외접하는 사각형은 대변의 합이 같습니다. ${labels[missingIndex]}=${sides[missingIndex]}입니다.`,
    };
  }

  const sides: [number, number, number, number] = [ab, bc, cd, da];
  const missingIndex = Math.floor(rng() * 4) as 0 | 1 | 2 | 3;
  const labels = ["AB", "BC", "CD", "DA"] as const;
  const shown = sides.map((v, i) => (i === missingIndex ? "?" : String(v)));
  return {
    ...plan,
    prompt: `원에 외접하는 사각형에서 AB=${shown[0]}, BC=${shown[1]}, CD=${shown[2]}, DA=${shown[3]}일 때 빈칸의 길이를 구하세요. (AB+CD=AD+BC)`,
    answer: sides[missingIndex]!,
    unit: "",
    scene: {
      kind: "circum-quad",
      sides,
      missingIndex,
    },
    solution: `AB+CD = AD+BC이므로 ${labels[missingIndex]} = ${sides[missingIndex]}입니다.`,
  };
}

function genRightIncircleR(plan: SealPlanEntry, rng: Rng): Seal {
  // Right triangle: r = (a+b-c)/2 must be positive integer
  const candidates = TRIPLES.filter(([a, b, c]) => {
    const r = (a + b - c) / 2;
    return Number.isInteger(r) && r > 0;
  });
  const t = pick(candidates.length ? candidates : TRIPLES, rng);
  const a = t[0];
  const b = t[1];
  const c = t[2];
  const r = (a + b - c) / 2;
  return {
    ...plan,
    prompt: `직각삼각형의 세 변이 ${a}, ${b}, ${c}(빗변)일 때 내접원의 반지름을 구하세요.`,
    answer: r,
    unit: "",
    scene: {
      kind: "right-incircle",
      a,
      b,
      c,
      r,
    },
    solution: `직각삼각형의 내접원 반지름 r = (a+b−c)/2 = (${a}+${b}−${c})/2 = ${r}입니다.`,
    previewKey: "r",
  };
}

export function generateSeal(slotIndex: number, rng: Rng = defaultRng()): Seal {
  const plan = SEAL_PLAN[slotIndex];
  if (!plan) {
    throw new Error(`Invalid seal index: ${slotIndex}`);
  }
  switch (plan.slotId) {
    case "longest-chord":
      return genLongestChord(plan, rng);
    case "chord-len-from-rd":
      return genChordLenFromRd(plan, rng);
    case "chord-r-or-d":
      return genChordROrD(plan, rng);
    case "equal-dist-or-nearest":
      return genEqualDistOrNearest(plan, rng);
    case "equal-chord-r":
      return genEqualChordR(plan, rng);
    case "tangent-equal-or-right":
      return genTangentEqualOrRight(plan, rng);
    case "tangent-pa-from-po-r":
      return genTangentPa(plan, rng);
    case "tangent-po-or-r":
      return genTangentPoOrR(plan, rng);
    case "tangent-angles":
      return genTangentAngles(plan, rng);
    case "incircle-tangent":
      return genIncircleTangent(plan, rng);
    case "circum-quad":
      return genCircumQuad(plan, rng);
    case "right-incircle-r":
      return genRightIncircleR(plan, rng);
  }
}

export function generateAllSeals(rng: Rng = defaultRng()): Seal[] {
  return SEAL_PLAN.map((_, i) => generateSeal(i, rng));
}

export function checkAnswer(seal: Seal, value: number | string): boolean {
  if (typeof seal.answer === "number") {
    const n =
      typeof value === "number" ? value : Number(String(value).trim());
    if (!Number.isFinite(n)) return false;
    return Math.round(n) === Math.round(seal.answer);
  }
  return String(value).trim() === String(seal.answer).trim();
}

/**
 * attempt: 1 = first try, 2 = second try (half points for calc).
 * elapsedSec: time since seal started (for speed bonus on first calc success).
 */
export function pointsFor(
  seal: Seal,
  attempt: 1 | 2,
  elapsedSec: number,
): number {
  let pts = seal.points;
  if (seal.kind === "calc" && attempt === 2) {
    pts = Math.floor(pts / 2);
  }
  if (
    seal.kind === "calc" &&
    attempt === 1 &&
    elapsedSec <= SPEED_BONUS_SEC
  ) {
    pts += SPEED_BONUS_POINTS;
  }
  return pts;
}

export function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(SCORE_HARD_MAX, Math.round(score)));
}

/** Build a preview scene from a student numeric guess (calc only). */
export function sceneWithPreview(
  seal: Seal,
  guess: number | null,
): SealScene {
  if (guess == null || !Number.isFinite(guess) || !seal.previewKey) {
    return seal.scene;
  }
  const g = Math.max(0, Math.round(guess));
  const scene = seal.scene;

  if (scene.kind === "chord-perpendicular") {
    if (seal.previewKey === "chordLen") {
      return { ...scene, chordLen: g, halfChord: g / 2 };
    }
    if (seal.previewKey === "r") {
      return { ...scene, r: Math.max(1, g) };
    }
    if (seal.previewKey === "d") {
      return { ...scene, d: Math.max(0, g) };
    }
  }
  if (scene.kind === "two-tangents") {
    if (seal.previewKey === "pa") {
      return { ...scene, pa: Math.max(0, g) };
    }
    if (seal.previewKey === "po") {
      return { ...scene, po: Math.max(1, g) };
    }
    if (seal.previewKey === "r") {
      return { ...scene, r: Math.max(1, g) };
    }
  }
  if (scene.kind === "right-incircle" && seal.previewKey === "r") {
    return { ...scene, r: Math.max(0, g) };
  }
  return scene;
}

export function isTripleValid(t: Triple): boolean {
  return t[0] * t[0] + t[1] * t[1] === t[2] * t[2];
}
