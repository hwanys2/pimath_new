export type GraphPointSize = "sm" | "md" | "lg";

export type GraphSettings = {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  step: number;
  integersOnly: boolean;
  /** 학생당 제출 가능한 점 개수 (unlimitedPoints=true이면 무시) */
  maxPointsPerStudent: number;
  /** true면 학생당 점 개수 제한 없음 */
  unlimitedPoints: boolean;
  tolerance: number;
  showWrongOnBoard: boolean;
  showNames: boolean;
  pointSize: GraphPointSize;
  shareBoardWithStudents: boolean;
  hideExpression: boolean;
  /**
   * true면 여러 학생이 같은 좌표를 찍을 수 있음(기본).
   * false면 이미 칠판에 있는 좌표는 다른 학생도 제출 불가.
   */
  allowDuplicatePoints: boolean;
};

export const DEFAULT_GRAPH_SETTINGS: GraphSettings = {
  xMin: -10,
  xMax: 10,
  yMin: -10,
  yMax: 10,
  step: 1,
  integersOnly: false,
  maxPointsPerStudent: 3,
  unlimitedPoints: false,
  tolerance: 0.01,
  showWrongOnBoard: true,
  showNames: true,
  pointSize: "md",
  shareBoardWithStudents: true,
  hideExpression: false,
  allowDuplicatePoints: true,
};

function num(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

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

  const unlimitedPoints = bool(o.unlimitedPoints, d.unlimitedPoints);

  return {
    xMin,
    xMax,
    yMin,
    yMax,
    step,
    integersOnly: bool(o.integersOnly, d.integersOnly),
    unlimitedPoints,
    maxPointsPerStudent: unlimitedPoints
      ? d.maxPointsPerStudent
      : Math.max(
          1,
          Math.min(
            20,
            Math.round(num(o.maxPointsPerStudent, d.maxPointsPerStudent)),
          ),
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
    allowDuplicatePoints: bool(
      o.allowDuplicatePoints,
      d.allowDuplicatePoints,
    ),
  };
}

/** 두 좌표가 같은 점으로 취급되는지 (제출/중복 검사용). */
export function sameGraphCoordinate(
  ax: number,
  ay: number,
  bx: number,
  by: number,
): boolean {
  return Math.abs(ax - bx) < 1e-9 && Math.abs(ay - by) < 1e-9;
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
  title: string;
  status: "live" | "closed";
  joinCode: string | null;
  expression: string;
  expressionDisplay: string;
  expressionLatex: string | null;
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
  expression: string | null;
  expressionDisplay: string | null;
  expressionLatex: string | null;
  participantCount: number;
  myName: string | null;
  points: GraphPoint[];
};

export type GraphSessionSummary = {
  sessionId: string;
  title: string;
  status: "live" | "closed";
  joinCode: string | null;
  expressionDisplay: string;
  expressionLatex: string | null;
  reveal: boolean;
  participantCount: number;
  pointCount: number;
  correctCount: number;
  createdAt: string;
  updatedAt: string;
};

export type GraphSubmitResult =
  | {
      ok: true;
      stored: boolean;
      verdict: "correct" | "wrong" | "undefined_at_x";
    }
  | { ok: false; error: string };
