/**
 * 높이 재기 탐구 — 탄젠트 도입
 * contentKey: g3-u3-1-tangent-intro
 */

import type { InquiryResult } from "@/lib/inquiry-types";

export const CONTENT_KEY = "g3-u3-1-tangent-intro";
export const PROBLEM_COUNT = 5;
export const TABLE_STEP_INDEX = 3;
export const DEFINE_STEP_INDEX = 4;
export const TABLE_ANGLES = [10, 20, 30, 40, 45, 50, 60, 70, 80] as const;
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
  /** Building only: observer may drag. Tree/lighthouse use a fixed base. */
  distanceAdjustable: boolean;
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
    distanceAdjustable: true,
  },
  {
    id: "tree",
    title: "큰 나무",
    objectLabel: "나무",
    prompt:
      "공원에서 큰 나무 꼭대기를 바라봅니다. 밑변(거리)은 23m로 정해져 있습니다. 각만 보고, 오른쪽에서 비슷한 직각삼각형을 그려 높이를 구해 보세요.",
    heightM: 12,
    minDistanceM: 23,
    maxDistanceM: 23,
    defaultDistanceM: 23,
    distanceAdjustable: false,
  },
  {
    id: "lighthouse",
    title: "등대",
    objectLabel: "등대",
    prompt:
      "해변에서 등대 꼭대기를 바라봅니다. 밑변(거리)은 67m로 정해져 있습니다. 각만 보고, 오른쪽에서 비슷한 직각삼각형을 그려 높이를 구해 보세요.",
    heightM: 36,
    minDistanceM: 67,
    maxDistanceM: 67,
    defaultDistanceM: 67,
    distanceAdjustable: false,
  },
];

export type TangentWorkspace = {
  distanceM: number;
  heightText: string;
  ratios: Record<string, string>;
  /** Student explanation of how they calculated the answer. */
  methodText: string;
  /** Page 5: the name of the ratio (탄젠트 / tangent / tan). */
  nameText: string;
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

export type DefineResponsePayload = {
  kind: "define";
  nameText: string;
  wrongs: number;
};

export type TangentResponsePayload =
  | HeightResponsePayload
  | TableResponsePayload
  | DefineResponsePayload;

export type TangentStepResult = {
  result: InquiryResult;
  response: TangentResponsePayload;
};

export type SoftNotice = {
  reason: "incomplete" | "incomplete_method" | "invalid" | "wrong";
  wrongAngles?: number[];
};

export function isTableStep(stepIndex: number): boolean {
  return stepIndex === TABLE_STEP_INDEX;
}

export function isDefineStep(stepIndex: number): boolean {
  return stepIndex === DEFINE_STEP_INDEX;
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
    nameText: "",
  };
}

export function clampDistance(scene: HeightScene, distanceM: number): number {
  if (!scene.distanceAdjustable) return scene.defaultDistanceM;
  const n = Math.round(distanceM);
  return Math.min(scene.maxDistanceM, Math.max(scene.minDistanceM, n));
}

/** Displayed elevation angle, rounded to 1°. */
export function elevationAngleDeg(heightM: number, distanceM: number): number {
  if (distanceM <= 0) return 90;
  const deg = (Math.atan(heightM / distanceM) * 180) / Math.PI;
  return Math.round(deg);
}

/**
 * SVG layout for the height-measuring scene.
 * Distance (adjacent) and object height (opposite) share one px/m so the
 * on-screen right triangle is similar to the mathematical one. The angle
 * vertex stays on the ground — not at a former observer's eye height.
 */
export const HEIGHT_SCENE_VB_W = 440;
export const HEIGHT_SCENE_VB_H = 268;
export const HEIGHT_SCENE_GROUND_Y = 214;
export const HEIGHT_SCENE_PAD_LEFT = 36;
export const HEIGHT_SCENE_PAD_TOP = 32;
export const HEIGHT_SCENE_GROUND_LINE_END = 424;
export const HEIGHT_SCENE_OBJECT_FACE_X = 346;

export type HeightSceneLayout = {
  distanceM: number;
  heightM: number;
  pxPerM: number;
  observerX: number;
  faceX: number;
  topX: number;
  topY: number;
  groundY: number;
  heightPx: number;
  distancePx: number;
  /** Exact on-screen elevation angle (degrees). */
  visualAngleDeg: number;
  /** Rounded angle shown on the figure. */
  displayedAngleDeg: number;
};

export function heightScenePxPerM(scene: HeightScene): number {
  const availableW =
    HEIGHT_SCENE_OBJECT_FACE_X - HEIGHT_SCENE_PAD_LEFT;
  const availableH = HEIGHT_SCENE_GROUND_Y - HEIGHT_SCENE_PAD_TOP;
  if (scene.maxDistanceM <= 0 || scene.heightM <= 0) return 1;
  return Math.min(
    availableW / scene.maxDistanceM,
    availableH / scene.heightM,
  );
}

export function getHeightSceneLayout(
  scene: HeightScene,
  distanceM: number,
): HeightSceneLayout {
  const d = clampDistance(scene, distanceM);
  const pxPerM = heightScenePxPerM(scene);
  const distancePx = d * pxPerM;
  const heightPx = scene.heightM * pxPerM;
  const faceX = HEIGHT_SCENE_OBJECT_FACE_X;
  const groundY = HEIGHT_SCENE_GROUND_Y;
  return {
    distanceM: d,
    heightM: scene.heightM,
    pxPerM,
    observerX: faceX - distancePx,
    faceX,
    topX: faceX,
    topY: groundY - heightPx,
    groundY,
    heightPx,
    distancePx,
    visualAngleDeg: (Math.atan2(heightPx, distancePx) * 180) / Math.PI,
    displayedAngleDeg: elevationAngleDeg(scene.heightM, d),
  };
}

export function distanceFromSceneX(scene: HeightScene, x: number): number {
  const pxPerM = heightScenePxPerM(scene);
  if (pxPerM <= 0) return clampDistance(scene, scene.defaultDistanceM);
  return clampDistance(scene, (HEIGHT_SCENE_OBJECT_FACE_X - x) / pxPerM);
}

export function tanDeg(deg: number): number {
  return Math.tan((deg * Math.PI) / 180);
}

/** Accept 탄젠트, tangent, or tan (case-insensitive, ignore spaces/punctuation). */
export function tangentNameIsCorrect(raw: string): boolean {
  const letters = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z가-힣]/g, "");
  if (!letters) return false;
  if (letters === "탄젠트" || letters === "tangent" || letters === "tan") {
    return true;
  }
  // "탄젠트(tangent)" / "tangent(탄젠트)" after stripping punctuation
  const withoutHangul = letters.replace("탄젠트", "");
  if (
    letters.includes("탄젠트") &&
    (withoutHangul === "" || withoutHangul === "tangent" || withoutHangul === "tan")
  ) {
    return true;
  }
  return false;
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
  if (isDefineStep(stepIndex)) {
    if (!workspace.nameText.trim()) return { reason: "incomplete" };
    if (!tangentNameIsCorrect(workspace.nameText)) return { reason: "wrong" };
    return null;
  }

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

  if (isDefineStep(stepIndex)) {
    const response: DefineResponsePayload = {
      kind: "define",
      nameText: workspace.nameText.trim(),
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
