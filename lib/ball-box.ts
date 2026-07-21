/** Pure ball-box guess logic (client + server safe). */

export type BallColorKey =
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "blue"
  | "purple"
  | "black";

export type BallColor = {
  key: BallColorKey;
  label: string;
  /** Fill color for the ball / bar. */
  hex: string;
  /** Readable text color to place on top of `hex`. */
  textOn: string;
};

/** Fixed 7 colors. Order defines display + draw iteration order. */
export const BALL_COLORS: BallColor[] = [
  { key: "red", label: "빨강", hex: "#EF4444", textOn: "#ffffff" },
  { key: "orange", label: "주황", hex: "#F97316", textOn: "#ffffff" },
  { key: "yellow", label: "노랑", hex: "#FACC15", textOn: "#5b4708" },
  { key: "green", label: "초록", hex: "#22C55E", textOn: "#ffffff" },
  { key: "blue", label: "파랑", hex: "#3B82F6", textOn: "#ffffff" },
  { key: "purple", label: "보라", hex: "#A855F7", textOn: "#ffffff" },
  { key: "black", label: "검정", hex: "#374151", textOn: "#ffffff" },
];

export const BALL_COLOR_KEYS: BallColorKey[] = BALL_COLORS.map((c) => c.key);

const COLOR_BY_KEY: Record<string, BallColor> = Object.fromEntries(
  BALL_COLORS.map((c) => [c.key, c]),
);

export function getBallColor(key: string): BallColor | null {
  return COLOR_BY_KEY[key] ?? null;
}

export type BallCounts = Partial<Record<BallColorKey, number>>;

/** Scoring — kept in sync with SQL `pm_ball_box_score`. */
export const SCORE_MAX = 200;
export const SCORE_MIN = 20;
export const DRAW_PENALTY = 1;
export const WRONG_PENALTY = 30;

/** Predicted score for a first-time correct solve. */
export function ballBoxScore(drawCount: number, wrongAttempts: number): number {
  const raw =
    SCORE_MAX -
    DRAW_PENALTY * Math.max(0, drawCount) -
    WRONG_PENALTY * Math.max(0, wrongAttempts);
  return Math.max(SCORE_MIN, Math.min(SCORE_MAX, Math.round(raw)));
}

/** Parse an observed/answer jsonb into a safe counts record. */
export function parseCounts(raw: unknown): BallCounts {
  const out: BallCounts = {};
  if (!raw || typeof raw !== "object") return out;
  for (const key of BALL_COLOR_KEYS) {
    const v = (raw as Record<string, unknown>)[key];
    if (typeof v === "number" && Number.isFinite(v)) {
      out[key] = Math.max(0, Math.floor(v));
    }
  }
  return out;
}

/** Parse the public "answer_colors" list (array of color keys). */
export function parseAnswerColors(raw: unknown): BallColorKey[] {
  if (!Array.isArray(raw)) return [];
  const set = new Set(raw.filter((k): k is string => typeof k === "string"));
  return BALL_COLOR_KEYS.filter((k) => set.has(k));
}

export function totalObserved(observed: BallCounts): number {
  return BALL_COLOR_KEYS.reduce((sum, k) => sum + (observed[k] ?? 0), 0);
}

export const GUEST_NAME_MAX = 20;

/** Trim + length-limit a guest-provided display name. */
export function sanitizeGuestName(raw: string): string {
  return raw.trim().slice(0, GUEST_NAME_MAX);
}
