/**
 * 높이 재기 탐구 — 탄젠트 도입
 * contentKey: g3-u3-1-tangent-intro
 */

import type { InquiryResult } from "@/lib/inquiry-types";

export const CONTENT_KEY = "g3-u3-1-tangent-intro";
export const PROBLEM_COUNT = 4;
export const TABLE_STEP_INDEX = 3;
export const TABLE_ANGLES = [10, 20, 30, 40, 50, 60, 70, 80] as const;
export type TableAngle = (typeof TABLE_ANGLES)[number];

export const WRONG_PENALTY = 15;
export const MIN_CORRECT_SCORE = 40;
export const MAX_CORRECT_SCORE = 100;
export const HEIGHT_REL_TOLERANCE = 0.12;
export const HEIGHT_ABS_FLOOR_M = 1;
export const RATIO_ABS_FLOOR = 0.08;
export const RATIO_REL_TOLERANCE = 0.12;

export type HeightSceneId = "building" | "tree" | "lighthouse";

export type HeightScene = {
  id: HeightSceneId;
  title: string;
  objectLabel: string;
  prompt: string;
  heightM: number;
  minDistanceM: number;
  maxDistanceM: number;
  defaultDistanceM: number;
};

export const HEIGHT_SCENES: HeightScene[] = [
  {
    id: "building",
    title: "학교 건물",
    objectLabel: "건물",
    prompt:
      "운동장에서 학교 건물 꼭대기를 바라봅니다. 땅(지평선) 위를 눌러 설 자리를 고르세요. 거리와 각만 알려 줍니다. 오른쪽에서 같은 모양의 직각삼각형을 그려 높이를 구해 보세요.",
    heightM: 24,
    minDistanceM: 20,
    maxDistanceM: 70,
    defaultDistanceM: 32,
  },
  {
    id: "tree",
    title: "큰 나무",
    objectLabel: "나무",
    prompt:
      "공원에서 큰 나무 꼭대기를 바라봅니다. 땅 위를 눌러 설 자리를 고르세요. 거리와 각만 보고, 오른쪽에서 비슷한 직각삼각형을 그려 높이를 구해 보세요.",
    heightM: 12,
    minDistanceM: 10,
    maxDistanceM: 40,
    defaultDistanceM: 20,
  },
  {
    id: "lighthouse",
    title: "등대",
    objectLabel: "등대",
    prompt:
      "해변에서 등대 꼭대기를 바라봅니다. 지평선 위를 눌러 설 자리를 고르세요. 거리와 각만 보고, 오른쪽에서 비슷한 직각삼각형을 그려 높이를 구해 보세요.",
    heightM: 36,
    minDistanceM: 25,
    maxDistanceM: 80,
    defaultDistanceM: 45,
  },
];

export type TangentWorkspace = {
  distanceM: number;
  heightText: string;
  ratios: Record<string, string>;
  /** Student explanation of how they calculated the answer. */
  methodText: string;
};

export type HeightResponsePayload = {
  kind: "height";
  sceneId: HeightSceneId;
  distanceM: number;
  angleDeg: number;
  heightM: string;
  methodText: string;
  wrongs: number;
};

export type TableResponsePayload = {
  kind: "table";
  ratios: Record<string, string>;
  methodText: string;
  wrongs: number;
};

export type TangentResponsePayload =
  | HeightResponsePayload
  | TableResponsePayload;

export type TangentStepResult = {
  result: InquiryResult;
  response: TangentResponsePayload;
};

export type SoftNotice = {
  reason: "incomplete" | "incomplete_method" | "invalid" | "wrong";
  wrongAngles?: number[];
};

export function isTableStep(stepIndex: number): boolean {
  return stepIndex >= HEIGHT_SCENES.length;
}

export function heightSceneAt(stepIndex: number): HeightScene | null {
  return HEIGHT_SCENES[stepIndex] ?? null;
}

export function emptyTangentWorkspace(stepIndex: number): TangentWorkspace {
  const scene = heightSceneAt(stepIndex);
  return {
    distanceM: scene?.defaultDistanceM ?? 30,
    heightText: "",
    ratios: Object.fromEntries(TABLE_ANGLES.map((a) => [String(a), ""])),
    methodText: "",
  };
}

export function clampDistance(scene: HeightScene, distanceM: number): number {
  const n = Math.round(distanceM);
  return Math.min(scene.maxDistanceM, Math.max(scene.minDistanceM, n));
}

/** Displayed elevation angle, rounded to 1°. */
export function elevationAngleDeg(heightM: number, distanceM: number): number {
  if (distanceM <= 0) return 90;
  const deg = (Math.atan(heightM / distanceM) * 180) / Math.PI;
  return Math.round(deg);
}

export function tanDeg(deg: number): number {
  return Math.tan((deg * Math.PI) / 180);
}

export function parseStudentNumber(raw: string): number | null {
  const t = raw.trim().replace(/m$/i, "").replace(",", ".").trim();
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

export function heightIsCorrect(
  scene: HeightScene,
  distanceM: number,
  submittedHeight: number,
): boolean {
  if (!(submittedHeight > 0)) return false;
  const d = clampDistance(scene, distanceM);
  const fromTrue = withinTolerance(
    submittedHeight,
    scene.heightM,
    HEIGHT_REL_TOLERANCE,
    HEIGHT_ABS_FLOOR_M,
  );
  const displayed = elevationAngleDeg(scene.heightM, d);
  const fromAngle = withinTolerance(
    submittedHeight,
    d * tanDeg(displayed),
    HEIGHT_REL_TOLERANCE,
    HEIGHT_ABS_FLOOR_M,
  );
  return fromTrue || fromAngle;
}

export function ratioIsCorrect(angleDeg: number, submitted: number): boolean {
  if (!(submitted > 0)) return false;
  const expected = tanDeg(angleDeg);
  return withinTolerance(
    submitted,
    expected,
    RATIO_REL_TOLERANCE,
    RATIO_ABS_FLOOR,
  );
}

export function scoreForAttempts(wrongCount: number): number {
  const w = Math.max(0, Math.floor(wrongCount));
  return Math.max(MIN_CORRECT_SCORE, MAX_CORRECT_SCORE - w * WRONG_PENALTY);
}

export function validateTangentSubmit(
  stepIndex: number,
  workspace: TangentWorkspace,
): SoftNotice | null {
  if (isTableStep(stepIndex)) {
    const wrongAngles: number[] = [];
    let empty = false;
    let invalid = false;
    for (const angle of TABLE_ANGLES) {
      const text = workspace.ratios[String(angle)] ?? "";
      if (!text.trim()) {
        empty = true;
        continue;
      }
      const n = parseStudentNumber(text);
      if (n == null || !(n > 0)) {
        invalid = true;
        wrongAngles.push(angle);
        continue;
      }
      if (!ratioIsCorrect(angle, n)) wrongAngles.push(angle);
    }
    if (empty) return { reason: "incomplete", wrongAngles };
    if (invalid) return { reason: "invalid", wrongAngles };
    if (wrongAngles.length > 0) return { reason: "wrong", wrongAngles };
    if (!workspace.methodText.trim()) return { reason: "incomplete_method" };
    return null;
  }

  const scene = heightSceneAt(stepIndex);
  if (!scene) return { reason: "incomplete" };
  const text = workspace.heightText;
  if (!text.trim()) return { reason: "incomplete" };
  const n = parseStudentNumber(text);
  if (n == null || !(n > 0)) return { reason: "invalid" };
  if (!heightIsCorrect(scene, workspace.distanceM, n)) {
    return { reason: "wrong" };
  }
  if (!workspace.methodText.trim()) return { reason: "incomplete_method" };
  return null;
}

export function gradeTangentStep(
  stepIndex: number,
  workspace: TangentWorkspace,
  wrongs: number,
): TangentStepResult {
  const notice = validateTangentSubmit(stepIndex, workspace);

  if (isTableStep(stepIndex)) {
    const response: TableResponsePayload = {
      kind: "table",
      ratios: { ...workspace.ratios },
      methodText: workspace.methodText.trim(),
      wrongs,
    };
    return {
      result: notice ? "wrong" : "correct",
      response,
    };
  }

  const scene = heightSceneAt(stepIndex) ?? HEIGHT_SCENES[0]!;
  const distanceM = clampDistance(scene, workspace.distanceM);
  const response: HeightResponsePayload = {
    kind: "height",
    sceneId: scene.id,
    distanceM,
    angleDeg: elevationAngleDeg(scene.heightM, distanceM),
    heightM: workspace.heightText,
    methodText: workspace.methodText.trim(),
    wrongs,
  };
  return {
    result: notice ? "wrong" : "correct",
    response,
  };
}

export function aggregateTangentScore(
  responses: Array<{
    stepIndex: number;
    result: InquiryResult | null;
    response: TangentResponsePayload;
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
