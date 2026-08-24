/**
 * 사인·코사인 도입 탐구
 * contentKey: g3-u3-1-sincos-intro
 */

import type { InquiryResult } from "@/lib/inquiry-types";

export const CONTENT_KEY = "g3-u3-1-sincos-intro";
export const PROBLEM_COUNT = 4;
export const TABLE_STEP_INDEX = 3;
export const TABLE_ANGLES = [10, 20, 30, 40, 50, 60, 70, 80] as const;
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
  defaultBaseT: number;
  absFloor: number;
};

export const HYP_SCENES: HypScene[] = [
  {
    id: "kite",
    title: "연날리기",
    objectLabel: "연",
    prompt:
      "풀린 연실의 길이가 30m입니다. 연실의 양 끝점을 움직여 각을 바꾼 뒤, 연과의 수평거리와 높이를 구해 보세요. 오른쪽에서 빗변을 먼저 그리면 점선 원이 생깁니다. 각과 수선으로 비슷한 직각삼각형을 그려 비를 구하세요.",
    hyp: 30,
    unit: "m",
    minAngleDeg: 15,
    maxAngleDeg: 75,
    defaultAngleDeg: 40,
    defaultBaseT: 0.42,
    absFloor: 1,
  },
  {
    id: "ladder",
    title: "사다리 안전거리",
    objectLabel: "사다리",
    prompt:
      "5m 길이의 사다리를 벽에 기대 놓습니다. 사다리 끝이 벽에 닿으려면 밑동을 벽에서 얼마나 떼어야 할까요? 그때 높이는 얼마일까요? 끝점을 움직여 각을 바꾼 뒤, 오른쪽에서 같은 모양의 직각삼각형을 그려 구해 보세요.",
    hyp: 5,
    unit: "m",
    minAngleDeg: 15,
    maxAngleDeg: 75,
    defaultAngleDeg: 60,
    defaultBaseT: 0.5,
    absFloor: 0.3,
  },
  {
    id: "tablet",
    title: "태블릿 거치대",
    objectLabel: "거치대",
    prompt:
      "길이가 30cm인 태블릿 거치대의 각도를 바꾸며 세웁니다. 지금 각에서 거치대가 만드는 높이와 책상 위의 거리는 얼마일까요? 오른쪽에서 빗변을 반지름으로 원을 그리고 직각삼각형을 작도해 보세요.",
    hyp: 30,
    unit: "cm",
    minAngleDeg: 15,
    maxAngleDeg: 75,
    defaultAngleDeg: 50,
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

export type SincosResponsePayload = SceneResponsePayload | TableResponsePayload;

export type SincosStepResult = {
  result: InquiryResult;
  response: SincosResponsePayload;
};

export type SoftNotice = {
  reason: "incomplete" | "incomplete_method" | "invalid" | "wrong";
  wrongKeys?: string[];
};

export function isTableStep(stepIndex: number): boolean {
  return stepIndex >= HYP_SCENES.length;
}

export function hypSceneAt(stepIndex: number): HypScene | null {
  return HYP_SCENES[stepIndex] ?? null;
}

function emptyRatios(): Record<string, string> {
  return Object.fromEntries(TABLE_ANGLES.map((a) => [String(a), ""]));
}

export function emptySincosWorkspace(stepIndex: number): SincosWorkspace {
  const scene = hypSceneAt(stepIndex);
  return {
    angleDeg: scene?.defaultAngleDeg ?? 45,
    baseT: scene?.defaultBaseT ?? 0.4,
    adjText: "",
    oppText: "",
    sinRatios: emptyRatios(),
    cosRatios: emptyRatios(),
    methodText: "",
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
  if (isTableStep(stepIndex)) {
    const wrongKeys: string[] = [];
    let empty = false;
    let invalid = false;
    for (const angle of TABLE_ANGLES) {
      const key = String(angle);
      for (const kind of ["sin", "cos"] as const) {
        const text =
          kind === "sin"
            ? (workspace.sinRatios[key] ?? "")
            : (workspace.cosRatios[key] ?? "");
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

  if (isTableStep(stepIndex)) {
    const response: TableResponsePayload = {
      kind: "table",
      sinRatios: { ...workspace.sinRatios },
      cosRatios: { ...workspace.cosRatios },
      methodText: workspace.methodText.trim(),
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
