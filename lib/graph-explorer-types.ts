export type GraphPointSize = "sm" | "md" | "lg";

export type GraphSettings = {
  /** 좌표평면 표시 범위 */
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  /** 눈금(격자) 간격 */
  step: number;
  /** 정수 순서쌍만 허용 (중1 순서쌍 도입 단계) */
  integersOnly: boolean;
  /** 학생당 제출 가능한 점 개수 */
  maxPointsPerStudent: number;
  /** 정오 판정 허용오차 |f(x) - y| */
  tolerance: number;
  /** 오답 점도 칠판에 (회색으로) 표시할지. false면 오답은 저장하지 않고 학생만 재도전 */
  showWrongOnBoard: boolean;
  /** 점 옆에 학생 이름 표시 */
  showNames: boolean;
  /** 점 크기 (투사 환경 대응) */
  pointSize: GraphPointSize;
  /** 학생 화면에도 전체 점을 공개 */
  shareBoardWithStudents: boolean;
  /** 학생에게 함수식 숨기기 (역탐구 모드) */
  hideExpression: boolean;
};

export const DEFAULT_GRAPH_SETTINGS: GraphSettings = {
  xMin: -10,
  xMax: 10,
  yMin: -10,
  yMax: 10,
  step: 1,
  integersOnly: false,
  maxPointsPerStudent: 3,
  tolerance: 0.01,
  showWrongOnBoard: true,
  showNames: true,
  pointSize: "md",
  shareBoardWithStudents: true,
  hideExpression: false,
};

function num(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

/** DB jsonb → 안전한 설정 객체 (범위 보정 포함) */
export function parseGraphSettings(raw: unknown): GraphSettings {
  const d = DEFAULT_GRAPH_SETTINGS;
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;

  let xMin = num(o.xMin, d.xMin);
  let xMax = num(o.xMax, d.xMax);
  let yMin = num(o.yMin, d.yMin);
  let yMax = num(o.yMax, d.yMax);

  xMin = Math.max(-1000, Math.min(1000, xMin));
  xMax = Math.max(-1000, Math.min(1000, xMax));
  yMin = Math.max(-1000, Math.min(1000, yMin));
  yMax = Math.max(-1000, Math.min(1000, yMax));
  if (xMax - xMin < 1) xMax = xMin + 1;
  if (yMax - yMin < 1) yMax = yMin + 1;

  let step = num(o.step, d.step);
  if (!(step > 0)) step = d.step;
  step = Math.max(step, (xMax - xMin) / 100, (yMax - yMin) / 100);

  const pointSize: GraphPointSize =
    o.pointSize === "sm" || o.pointSize === "lg" ? o.pointSize : "md";

  return {
    xMin,
    xMax,
    yMin,
    yMax,
    step,
    integersOnly: bool(o.integersOnly, d.integersOnly),
    maxPointsPerStudent: Math.max(
      1,
      Math.min(20, Math.round(num(o.maxPointsPerStudent, d.maxPointsPerStudent))),
    ),
    tolerance: Math.max(0, Math.min(1, num(o.tolerance, d.tolerance))),
    showWrongOnBoard: bool(o.showWrongOnBoard, d.showWrongOnBoard),
    showNames: bool(o.showNames, d.showNames),
    pointSize,
    shareBoardWithStudents: bool(
      o.shareBoardWithStudents,
      d.shareBoardWithStudents,
    ),
    hideExpression: bool(o.hideExpression, d.hideExpression),
  };
}

export type GraphPoint = {
  id: string;
  participantId: string | null;
  participantName: string | null;
  x: number;
  y: number;
  isCorrect: boolean;
  isMe: boolean;
  createdAt: string | null;
};

export type GraphParticipant = {
  id: string;
  name: string;
  joinedAt: string | null;
  pointCount: number;
  correctCount: number;
};

export type GraphTeacherState = {
  sessionId: string;
  status: "live" | "closed";
  joinCode: string | null;
  expression: string;
  expressionDisplay: string;
  reveal: boolean;
  settings: GraphSettings;
  participants: GraphParticipant[];
  points: GraphPoint[];
};

export type GraphStudentState = {
  sessionId: string;
  status: "live" | "closed";
  reveal: boolean;
  settings: GraphSettings;
  /** 개형 공개 시에만 채워짐 (곡선 그리기용) */
  expression: string | null;
  /** 식 숨기기 모드에서 미공개면 null */
  expressionDisplay: string | null;
  participantCount: number;
  myName: string | null;
  points: GraphPoint[];
};

export type GraphSubmitResult =
  | {
      ok: true;
      stored: boolean;
      verdict: "correct" | "wrong" | "undefined_at_x";
    }
  | { ok: false; error: string };
