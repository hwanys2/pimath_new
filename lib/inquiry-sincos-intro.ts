/**
 * 사인·코사인 도입 탐구
 * contentKey: g3-u3-1-sincos-intro
 */

import type { InquiryResult } from "@/lib/inquiry-types";

export const CONTENT_KEY = "g3-u3-1-sincos-intro";
export const PROBLEM_COUNT = 5;
export const TABLE_STEP_INDEX = 3;
export const DEFINE_STEP_INDEX = 4;
export const TABLE_ANGLES = [10, 20, 30, 40, 45, 50, 60, 70, 80] as const;
export type TableAngle = (typeof TABLE_ANGLES)[number];

export const WRONG_PENALTY = 15;
export const MIN_CORRECT_SCORE = 40;
export const MAX_CORRECT_SCORE = 100;
export const RATIO_ABS_FLOOR = 0.08;
export const RATIO_REL_TOLERANCE = 0.12;
export const LENGTH_REL_TOLERANCE = 0.12;

export type HypSceneId = "kite" | "ladder" | "tablet";

export type HypScene = {
  id: HypSceneId;
  title: string;
  objectLabel: string;
  prompt: string;
  hyp: number;
  unit: "m" | "cm";
  minAngleDeg: number;
  maxAngleDeg: number;
  defaultAngleDeg: number;
  /** When false, the scene angle is fixed at defaultAngleDeg. */
  angleAdjustable: boolean;
  /** When true, each student starts at a random angle in [min, max]. */
  randomizeInitialAngle: boolean;
  defaultBaseT: number;
  absFloor: number;
};

export const HYP_SCENES: HypScene[] = [
  {
    id: "kite",
    title: "연날리기",
    objectLabel: "연",
    prompt:
      "풀린 연실의 길이가 31m이고, 각은 40°로 고정되어 있습니다. 연과의 수평거리와 높이를 구해 보세요. 오른쪽에서 빗변을 먼저 그리면 점선 원이 생깁니다. 각과 수선으로 비슷한 직각삼각형을 그려 비를 구하세요.",
    hyp: 31,
    unit: "m",
    minAngleDeg: 40,
    maxAngleDeg: 40,
    defaultAngleDeg: 40,
    angleAdjustable: false,
    randomizeInitialAngle: false,
    defaultBaseT: 0.42,
    absFloor: 1,
  },
  {
    id: "ladder",
    title: "사다리 안전거리",
    objectLabel: "사다리",
    prompt:
      "4.7m 길이의 사다리를 벽에 60° 각으로 기대 놓습니다. 사다리 끝이 벽에 닿으려면 밑동을 벽에서 얼마나 떼어야 할까요? 그때 높이는 얼마일까요? 오른쪽에서 같은 모양의 직각삼각형을 그려 구해 보세요.",
    hyp: 4.7,
    unit: "m",
    minAngleDeg: 60,
    maxAngleDeg: 60,
    defaultAngleDeg: 60,
    angleAdjustable: false,
    randomizeInitialAngle: false,
    defaultBaseT: 0.5,
    absFloor: 0.3,
  },
  {
    id: "tablet",
    title: "태블릿 거치대",
    objectLabel: "거치대",
    prompt:
      "길이가 37cm인 태블릿 거치대가 지금 각으로 세워져 있습니다. 거치대가 만드는 높이와 책상 위의 거리는 얼마일까요? 오른쪽에서 빗변을 반지름으로 원을 그리고 직각삼각형을 작도해 보세요.",
    hyp: 37,
    unit: "cm",
    minAngleDeg: 30,
    maxAngleDeg: 70,
    defaultAngleDeg: 50,
    /** Students get a fixed random angle; teachers can still drag in host preview. */
    angleAdjustable: false,
    randomizeInitialAngle: true,
    defaultBaseT: 0.38,
    absFloor: 1,
  },
];

export type SincosWorkspace = {
  angleDeg: number;
  baseT: number;
  adjText: string;
  oppText: string;
  sinRatios: Record<string, string>;
  cosRatios: Record<string, string>;
  methodText: string;
  /** Page 5: names for the height and distance magic numbers. */
  sinNameText: string;
  cosNameText: string;
};

export type SceneResponsePayload = {
  kind: "scene";
  sceneId: HypSceneId;
  hyp: number;
  unit: "m" | "cm";
  angleDeg: number;
  baseT: number;
  adj: string;
  opp: string;
  methodText: string;
  wrongs: number;
};

export type TableResponsePayload = {
  kind: "table";
  sinRatios: Record<string, string>;
  cosRatios: Record<string, string>;
  methodText: string;
  wrongs: number;
};

export type DefineResponsePayload = {
  kind: "define";
  sinNameText: string;
  cosNameText: string;
  wrongs: number;
};

export type SincosResponsePayload =
  | SceneResponsePayload
  | TableResponsePayload
  | DefineResponsePayload;

export type SincosStepResult = {
  result: InquiryResult;
  response: SincosResponsePayload;
};

export type SoftNotice = {
  reason: "incomplete" | "incomplete_method" | "invalid" | "wrong";
  wrongKeys?: string[];
};

export function isTableStep(stepIndex: number): boolean {
  return stepIndex === TABLE_STEP_INDEX;
}

export function isDefineStep(stepIndex: number): boolean {
  return stepIndex === DEFINE_STEP_INDEX;
}

export function hypSceneAt(stepIndex: number): HypScene | null {
  return HYP_SCENES[stepIndex] ?? null;
}

function emptyRatios(): Record<string, string> {
  return Object.fromEntries(TABLE_ANGLES.map((a) => [String(a), ""]));
}

/** Stable integer in [min, max] from a string seed (FNV-1a). */
export function seededAngleDeg(
  seed: string,
  minDeg: number,
  maxDeg: number,
): number {
  const min = Math.round(minDeg);
  const max = Math.round(maxDeg);
  if (max <= min) return min;
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return min + ((h >>> 0) % (max - min + 1));
}

export function initialAngleDeg(
  scene: HypScene,
  seed?: string | null,
): number {
  if (!scene.randomizeInitialAngle) return scene.defaultAngleDeg;
  if (seed) {
    return seededAngleDeg(seed, scene.minAngleDeg, scene.maxAngleDeg);
  }
  const span = scene.maxAngleDeg - scene.minAngleDeg;
  if (span <= 0) return scene.minAngleDeg;
  return (
    scene.minAngleDeg + Math.floor(Math.random() * (span + 1))
  );
}

export function emptySincosWorkspace(
  stepIndex: number,
  opts?: { seed?: string | null },
): SincosWorkspace {
  const scene = hypSceneAt(stepIndex);
  return {
    angleDeg: scene ? initialAngleDeg(scene, opts?.seed) : 45,
    baseT: scene?.defaultBaseT ?? 0.4,
    adjText: "",
    oppText: "",
    sinRatios: emptyRatios(),
    cosRatios: emptyRatios(),
    methodText: "",
    sinNameText: "",
    cosNameText: "",
  };
}

/** Fill missing fields from partial/legacy drafts so UI never reads undefined maps. */
export function normalizeSincosWorkspace(
  stepIndex: number,
  partial: Partial<SincosWorkspace> | null | undefined,
  opts?: { seed?: string | null },
): SincosWorkspace {
  const base = emptySincosWorkspace(stepIndex, opts);
  if (!partial) return base;
  const scene = hypSceneAt(stepIndex);
  return {
    ...base,
    ...partial,
    // Fixed-angle scenes keep the seeded/default angle (ignore stale drafts).
    angleDeg: scene && !scene.angleAdjustable ? base.angleDeg : (partial.angleDeg ?? base.angleDeg),
    sinRatios: { ...base.sinRatios, ...(partial.sinRatios ?? {}) },
    cosRatios: { ...base.cosRatios, ...(partial.cosRatios ?? {}) },
    sinNameText:
      typeof partial.sinNameText === "string" ? partial.sinNameText : base.sinNameText,
    cosNameText:
      typeof partial.cosNameText === "string" ? partial.cosNameText : base.cosNameText,
    methodText:
      typeof partial.methodText === "string" ? partial.methodText : base.methodText,
    adjText: typeof partial.adjText === "string" ? partial.adjText : base.adjText,
    oppText: typeof partial.oppText === "string" ? partial.oppText : base.oppText,
  };
}

export function clampAngle(scene: HypScene, deg: number): number {
  const n = Math.round(deg);
  return Math.min(scene.maxAngleDeg, Math.max(scene.minAngleDeg, n));
}

export function clampBaseT(t: number): number {
  if (!Number.isFinite(t)) return 0.4;
  return Math.min(1, Math.max(0, t));
}

export function sinDeg(deg: number): number {
  return Math.sin((deg * Math.PI) / 180);
}

export function cosDeg(deg: number): number {
  return Math.cos((deg * Math.PI) / 180);
}

export function expectedOpp(scene: HypScene, angleDeg: number): number {
  return scene.hyp * sinDeg(clampAngle(scene, angleDeg));
}

export function expectedAdj(scene: HypScene, angleDeg: number): number {
  return scene.hyp * cosDeg(clampAngle(scene, angleDeg));
}

export function parseStudentNumber(raw: string): number | null {
  const t = raw.trim().replace(/cm$/i, "").replace(/m$/i, "").replace(",", ".").trim();
  if (!t) return null;
  const frac = /^(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)$/.exec(t);
  if (frac) {
    const a = Number(frac[1]);
    const b = Number(frac[2]);
    if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return null;
    return a / b;
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function withinTolerance(
  value: number,
  expected: number,
  rel: number,
  absFloor: number,
): boolean {
  const tol = Math.max(absFloor, rel * Math.abs(expected));
  return Math.abs(value - expected) <= tol;
}

export function lengthIsCorrect(
  scene: HypScene,
  angleDeg: number,
  submitted: number,
  kind: "adj" | "opp",
): boolean {
  if (!(submitted > 0)) return false;
  const expected =
    kind === "adj"
      ? expectedAdj(scene, angleDeg)
      : expectedOpp(scene, angleDeg);
  return withinTolerance(
    submitted,
    expected,
    LENGTH_REL_TOLERANCE,
    scene.absFloor,
  );
}

export function sinRatioIsCorrect(angleDeg: number, submitted: number): boolean {
  if (!(submitted > 0)) return false;
  return withinTolerance(
    submitted,
    sinDeg(angleDeg),
    RATIO_REL_TOLERANCE,
    RATIO_ABS_FLOOR,
  );
}

export function cosRatioIsCorrect(angleDeg: number, submitted: number): boolean {
  if (!(submitted > 0)) return false;
  return withinTolerance(
    submitted,
    cosDeg(angleDeg),
    RATIO_REL_TOLERANCE,
    RATIO_ABS_FLOOR,
  );
}

/** Accept 사인, sine, or sin (case-insensitive, ignore spaces/punctuation). */
export function sinNameIsCorrect(raw: string): boolean {
  const letters = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z가-힣]/g, "");
  if (!letters) return false;
  if (letters === "사인" || letters === "sine" || letters === "sin") {
    return true;
  }
  const withoutHangul = letters.replace("사인", "");
  if (
    letters.includes("사인") &&
    (withoutHangul === "" || withoutHangul === "sine" || withoutHangul === "sin")
  ) {
    return true;
  }
  return false;
}

/** Accept 코사인, cosine, or cos (case-insensitive, ignore spaces/punctuation). */
export function cosNameIsCorrect(raw: string): boolean {
  const letters = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z가-힣]/g, "");
  if (!letters) return false;
  if (letters === "코사인" || letters === "cosine" || letters === "cos") {
    return true;
  }
  const withoutHangul = letters.replace("코사인", "");
  if (
    letters.includes("코사인") &&
    (withoutHangul === "" ||
      withoutHangul === "cosine" ||
      withoutHangul === "cos")
  ) {
    return true;
  }
  return false;
}

export function scoreForAttempts(wrongCount: number): number {
  const w = Math.max(0, Math.floor(wrongCount));
  return Math.max(MIN_CORRECT_SCORE, MAX_CORRECT_SCORE - w * WRONG_PENALTY);
}

function checkRatioCell(
  text: string,
  angle: number,
  kind: "sin" | "cos",
): "empty" | "invalid" | "wrong" | "ok" {
  if (!text.trim()) return "empty";
  const n = parseStudentNumber(text);
  if (n == null || !(n > 0)) return "invalid";
  const ok =
    kind === "sin" ? sinRatioIsCorrect(angle, n) : cosRatioIsCorrect(angle, n);
  return ok ? "ok" : "wrong";
}

export function validateSincosSubmit(
  stepIndex: number,
  workspace: SincosWorkspace,
): SoftNotice | null {
  if (isDefineStep(stepIndex)) {
    const wrongKeys: string[] = [];
    if (!(workspace.sinNameText ?? "").trim()) wrongKeys.push("sinName");
    if (!(workspace.cosNameText ?? "").trim()) wrongKeys.push("cosName");
    if (wrongKeys.length > 0) return { reason: "incomplete", wrongKeys };
    if (!sinNameIsCorrect(workspace.sinNameText ?? "")) wrongKeys.push("sinName");
    if (!cosNameIsCorrect(workspace.cosNameText ?? "")) wrongKeys.push("cosName");
    if (wrongKeys.length > 0) return { reason: "wrong", wrongKeys };
    return null;
  }

  if (isTableStep(stepIndex)) {
    const wrongKeys: string[] = [];
    let empty = false;
    let invalid = false;
    for (const angle of TABLE_ANGLES) {
      const key = String(angle);
      for (const kind of ["sin", "cos"] as const) {
        const text =
          kind === "sin"
            ? (workspace.sinRatios?.[key] ?? "")
            : (workspace.cosRatios?.[key] ?? "");
        const status = checkRatioCell(text, angle, kind);
        if (status === "empty") empty = true;
        else if (status === "invalid") {
          invalid = true;
          wrongKeys.push(`${kind}:${key}`);
        } else if (status === "wrong") {
          wrongKeys.push(`${kind}:${key}`);
        }
      }
    }
    if (empty) return { reason: "incomplete", wrongKeys };
    if (invalid) return { reason: "invalid", wrongKeys };
    if (wrongKeys.length > 0) return { reason: "wrong", wrongKeys };
    if (!workspace.methodText.trim()) return { reason: "incomplete_method" };
    return null;
  }

  const scene = hypSceneAt(stepIndex);
  if (!scene) return { reason: "incomplete" };

  const adjRaw = workspace.adjText;
  const oppRaw = workspace.oppText;
  if (!adjRaw.trim() || !oppRaw.trim()) {
    const wrongKeys: string[] = [];
    if (!adjRaw.trim()) wrongKeys.push("adj");
    if (!oppRaw.trim()) wrongKeys.push("opp");
    return { reason: "incomplete", wrongKeys };
  }

  const adj = parseStudentNumber(adjRaw);
  const opp = parseStudentNumber(oppRaw);
  const wrongKeys: string[] = [];
  let invalid = false;
  if (adj == null || !(adj > 0)) {
    invalid = true;
    wrongKeys.push("adj");
  }
  if (opp == null || !(opp > 0)) {
    invalid = true;
    wrongKeys.push("opp");
  }
  if (invalid) return { reason: "invalid", wrongKeys };

  const angle = clampAngle(scene, workspace.angleDeg);
  if (!lengthIsCorrect(scene, angle, adj!, "adj")) wrongKeys.push("adj");
  if (!lengthIsCorrect(scene, angle, opp!, "opp")) wrongKeys.push("opp");
  if (wrongKeys.length > 0) return { reason: "wrong", wrongKeys };
  if (!workspace.methodText.trim()) return { reason: "incomplete_method" };
  return null;
}

export function gradeSincosStep(
  stepIndex: number,
  workspace: SincosWorkspace,
  wrongs: number,
): SincosStepResult {
  const notice = validateSincosSubmit(stepIndex, workspace);

  if (isDefineStep(stepIndex)) {
    const response: DefineResponsePayload = {
      kind: "define",
      sinNameText: (workspace.sinNameText ?? "").trim(),
      cosNameText: (workspace.cosNameText ?? "").trim(),
      wrongs,
    };
    return {
      result: notice ? "wrong" : "correct",
      response,
    };
  }

  if (isTableStep(stepIndex)) {
    const response: TableResponsePayload = {
      kind: "table",
      sinRatios: { ...(workspace.sinRatios ?? {}) },
      cosRatios: { ...(workspace.cosRatios ?? {}) },
      methodText: (workspace.methodText ?? "").trim(),
      wrongs,
    };
    return {
      result: notice ? "wrong" : "correct",
      response,
    };
  }

  const scene = hypSceneAt(stepIndex) ?? HYP_SCENES[0]!;
  const angleDeg = clampAngle(scene, workspace.angleDeg);
  const response: SceneResponsePayload = {
    kind: "scene",
    sceneId: scene.id,
    hyp: scene.hyp,
    unit: scene.unit,
    angleDeg,
    baseT: clampBaseT(workspace.baseT),
    adj: workspace.adjText,
    opp: workspace.oppText,
    methodText: workspace.methodText.trim(),
    wrongs,
  };
  return {
    result: notice ? "wrong" : "correct",
    response,
  };
}

export function aggregateSincosScore(
  responses: Array<{
    stepIndex: number;
    result: InquiryResult | null;
    response: SincosResponsePayload;
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
    if (row.result === "correct") {
      correctCount += 1;
      score += scoreForAttempts(wrongs);
    }
  }

  return { score, correctCount, totalWrongs };
}
