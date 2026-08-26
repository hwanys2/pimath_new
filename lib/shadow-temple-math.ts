/**
 * Math + content model for 「그림자 신전: 여섯 개의 시련」 (중3 · 3.1 삼각비 방탈출).
 *
 * All puzzle parameters come from curated pools so every answer is a clean
 * number under the Korean grade-3 conventions √2 ≈ 1.4, √3 ≈ 1.7.
 */

export const CONTENT_KEY = "g3-u3-1-shadow-temple";

/** Total escape time budget (seconds). */
export const TOTAL_TIME_SEC = 15 * 60;
/** Wrong answer burns extra torch time. */
export const WRONG_TIME_PENALTY_SEC = 20;
/** Max time bonus appended after the final room. */
export const TIME_BONUS_MAX = 100;

export const SQRT2_APPROX = 1.4;
export const SQRT3_APPROX = 1.7;

export type RoomKind =
  | "giantGate"
  | "lavaFloor"
  | "brokenBridge"
  | "guardianShield"
  | "sunAltar"
  | "goldenStar";

export type Clue = {
  id: string;
  /** Short label on the hotspot chip. */
  label: string;
  /** Revealed text once inspected. */
  text: string;
};

export type NumericInput = {
  kind: "numeric";
  /** Expected decimal value, e.g. 5.1 */
  answer: number;
  unit: string;
  /** Exact-form string for the reveal, e.g. "3√3" */
  exact: string;
};

export type ChoiceOption = {
  /** Big label on the artifact (dimensions or area). */
  title: string;
  /** Secondary line (e.g. angle). */
  sub?: string;
};

export type ChoiceInput = {
  kind: "choice";
  options: ChoiceOption[];
  correctIndex: number;
  /** What the artifacts are, for a11y + status text. */
  artifactLabel: string;
};

export type DialInput = {
  kind: "dial";
  /** Two digits 0-9 each: [tens, ones]. */
  code: [number, number];
};

export type PuzzleInput = NumericInput | ChoiceInput | DialInput;

export type Puzzle = {
  /** Question shown above the device. */
  prompt: string;
  /** e.g. "√3 은 1.7 로 계산하세요." */
  approxNote?: string;
  clues: Clue[];
  input: PuzzleInput;
  /** Hint level 1 — Dr. Pita's notebook page (concept). */
  hintConcept: string[];
  /** Hint level 2 — full walkthrough. */
  hintSolve: string[];
  /** Story line shown when solved. */
  solvedLine: string;
  /** Relative score weight (1 = full room). */
  weight: number;
};

export type Room = {
  id: number;
  kind: RoomKind;
  title: string;
  /** Math objective shown small. */
  objective: string;
  enterStory: string[];
  puzzles: Puzzle[];
  /** Scene rendering parameters (room specific). */
  params: Record<string, number>;
};

export type TempleRun = {
  rooms: Room[];
};

/* ---------------------------------------------------------------- score */

/**
 * Award for solving one puzzle. Attempts and hints reduce the award.
 * Six rooms: 5 rooms × 150 + room 5 (two altars × 75) = 900,
 * plus time bonus up to 100 → target ≈ 1000 (progression-system.md).
 */
export function puzzleAward(
  attempt: number,
  hintLevel: 0 | 1 | 2,
  weight: number,
): number {
  const base = attempt <= 1 ? 150 : attempt === 2 ? 110 : attempt === 3 ? 80 : 60;
  const hintPenalty = hintLevel === 0 ? 0 : hintLevel === 1 ? 20 : 50;
  return Math.max(20, Math.round((base - hintPenalty) * weight));
}

export function timeBonus(timeLeftSec: number): number {
  const ratio = Math.max(0, Math.min(1, timeLeftSec / TOTAL_TIME_SEC));
  return Math.round(TIME_BONUS_MAX * ratio);
}

/**
 * Numeric answers are one-decimal cleans (√3 → 1.7 substituted at the end).
 * Accept ±0.25 so a student who substitutes the approximation early
 * (slightly different rounding path) is still counted as correct,
 * while every other pool variant stays clearly out of range.
 */
export function checkNumericAnswer(raw: string, answer: number): boolean {
  const cleaned = raw.replace(/[^\d.\-]/g, "");
  if (!cleaned) return false;
  const value = Number.parseFloat(cleaned);
  if (!Number.isFinite(value)) return false;
  return Math.abs(value - answer) <= 0.25;
}

export function formatClock(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

/* ------------------------------------------------------------- helpers */

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function shuffled<T>(arr: readonly T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** tan of special angles in exact text. */
const TAN_EXACT: Record<number, string> = {
  30: "√3/3",
  45: "1",
  60: "√3",
};

const SIN_EXACT: Record<number, string> = {
  30: "1/2",
  45: "√2/2",
  60: "√3/2",
  90: "1",
  120: "√3/2",
  135: "√2/2",
  150: "1/2",
};

function needsApprox(exact: string): "√2" | "√3" | null {
  if (exact.includes("√3")) return "√3";
  if (exact.includes("√2")) return "√2";
  return null;
}

function approxNoteFor(...exacts: string[]): string | undefined {
  const set = new Set(
    exacts.map((e) => needsApprox(e)).filter((v): v is "√2" | "√3" => !!v),
  );
  if (set.size === 0) return undefined;
  const parts: string[] = [];
  if (set.has("√2")) parts.push(`√2 = ${SQRT2_APPROX}`);
  if (set.has("√3")) parts.push(`√3 = ${SQRT3_APPROX}`);
  return `${parts.join(", ")} 로 계산하세요.`;
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/* -------------------------------------------------- Room 1 · 거인의 문 */
/** h = d · tanθ */

type GateVariant = { d: number; deg: number; exact: string; val: number };

const GATE_POOL: readonly GateVariant[] = [
  { d: 9, deg: 30, exact: "3√3", val: 5.1 },
  { d: 12, deg: 30, exact: "4√3", val: 6.8 },
  { d: 7, deg: 45, exact: "7", val: 7 },
  { d: 9, deg: 45, exact: "9", val: 9 },
  { d: 4, deg: 60, exact: "4√3", val: 6.8 },
  { d: 6, deg: 60, exact: "6√3", val: 10.2 },
];

function buildGateRoom(): Room {
  const v = pick(GATE_POOL);
  const tanExact = TAN_EXACT[v.deg]!;
  return {
    id: 1,
    kind: "giantGate",
    title: "거인의 문",
    objective: "직각삼각형에서 변의 길이 — h = d × tan θ",
    enterStory: [
      "등 뒤에서 석문이 닫히자, 횃불이 하나둘 저절로 타오른다.",
      "눈앞에는 거대한 거인 석상이 첫 번째 문을 막고 서 있다. 이마에서 열쇠 구멍이 희미하게 빛나지만, 너무 높아 닿을 수 없다.",
      "바닥의 낡은 관측 장치… 이 방 어딘가에 단서가 숨어 있다. 빛나는 곳을 모두 조사하자.",
    ],
    puzzles: [
      {
        prompt: "관측 지점에서 열쇠 구멍까지의 높이를 구해 돌 다이얼에 새기세요. (m)",
        approxNote: approxNoteFor(v.exact),
        clues: [
          {
            id: "floor",
            label: "바닥의 표식",
            text: `관측 장치에서 석상 발끝까지의 수평 거리 — ${v.d} m 라고 새겨져 있다.`,
          },
          {
            id: "device",
            label: "관측 장치",
            text: `장치의 눈금이 열쇠 구멍을 올려본각 ${v.deg}° 를 가리키며 멈춰 있다.`,
          },
          {
            id: "mural",
            label: "벽화",
            text: "「높이를 아는 자만이 거인의 눈을 뜨게 하리라.」 — 높이를 구해 입력해야 한다!",
          },
        ],
        input: { kind: "numeric", answer: v.val, unit: "m", exact: v.exact },
        hintConcept: [
          "박사의 수첩 1쪽 —",
          "「올려본각 θ 와 수평 거리 d 를 알면, 높이는 직각삼각형의 tan 으로 구한다.」",
          "tan θ = (높이) ÷ (수평 거리)  →  높이 = d × tan θ",
        ],
        hintSolve: [
          `tan ${v.deg}° = ${tanExact}`,
          `높이 = ${v.d} × ${tanExact} = ${v.exact}`,
          v.exact.includes("√")
            ? `√3 = ${SQRT3_APPROX} 이므로 높이 = ${fmt(v.val)} m`
            : `높이 = ${fmt(v.val)} m`,
        ],
        solvedLine:
          "다이얼이 돌아가자 거인의 두 눈에 푸른 불이 켜진다. 쿠구궁 — 첫 번째 문이 열렸다!",
        weight: 1,
      },
    ],
    params: { d: v.d, deg: v.deg },
  };
}

/* --------------------------------------------- Room 2 · 붕괴하는 바닥 */
/** Two sides + included angle → third side, via perpendicular foot. */

type LavaVariant = { a: number; b: number; deg: 60 | 120; ans: number };

const LAVA_POOL: readonly LavaVariant[] = [
  { a: 8, b: 5, deg: 60, ans: 7 },
  { a: 8, b: 15, deg: 60, ans: 13 },
  { a: 10, b: 16, deg: 60, ans: 14 },
  { a: 8, b: 7, deg: 120, ans: 13 },
  { a: 16, b: 5, deg: 120, ans: 19 },
];

function buildLavaRoom(): Room {
  const v = pick(LAVA_POOL);
  const half = v.a / 2;
  const ah = `${fmt(half)}√3`;
  const ah2 = 3 * half * half; // (a·sin60)² = 3a²/4
  const hb = v.deg === 60 ? Math.abs(v.b - half) : v.b + half;
  const steps =
    v.deg === 60
      ? [
          "A 발판에서 P–B 방향 직선에 수선의 발 H 를 내리자.",
          `PH = ${v.a} × cos 60° = ${fmt(half)},  AH = ${v.a} × sin 60° = ${ah}`,
          `HB = ${v.b} − ${fmt(half)} = ${fmt(hb)}`,
          `AB² = (${ah})² + ${fmt(hb)}² = ${fmt(ah2)} + ${fmt(hb * hb)} = ${fmt(ah2 + hb * hb)}  →  AB = ${v.ans}`,
        ]
      : [
          "∠APB = 120° 라서 수선의 발 H 는 P 바깥쪽에 생긴다. ∠APH = 180° − 120° = 60°.",
          `PH = ${v.a} × cos 60° = ${fmt(half)},  AH = ${v.a} × sin 60° = ${ah}`,
          `HB = ${v.b} + ${fmt(half)} = ${fmt(hb)}`,
          `AB² = (${ah})² + ${fmt(hb)}² = ${fmt(ah2)} + ${fmt(hb * hb)} = ${fmt(ah2 + hb * hb)}  →  AB = ${v.ans}`,
        ];
  return {
    id: 2,
    kind: "lavaFloor",
    title: "붕괴하는 바닥",
    objective: "일반 삼각형 — 두 변과 끼인각으로 나머지 변 구하기 (수선 긋기)",
    enterStory: [
      "문을 지나자 바닥이 스르륵 갈라지며 금빛 용암 함정이 드러난다!",
      "별빛이 「저기 발판으로 건너야 해!」 하고 외친다. 가까스로 좁은 기둥 P 위로 올라섰다.",
      "탈출로는 발판 A 에서 발판 B 로 건너는 고대의 자동 로프. 로프 길이를 정확히 새겨야 발사된다. 단서를 조사하자.",
    ],
    puzzles: [
      {
        prompt: "발판 A 와 발판 B 사이의 직선거리를 구해 로프 발사기에 새기세요. (m)",
        approxNote: undefined,
        clues: [
          {
            id: "ropeA",
            label: "A 쪽 사슬",
            text: `기둥 P 에서 발판 A 까지 늘어진 사슬 — 길이 ${v.a} m.`,
          },
          {
            id: "ropeB",
            label: "B 쪽 사슬",
            text: `기둥 P 에서 발판 B 까지 늘어진 사슬 — 길이 ${v.b} m.`,
          },
          {
            id: "gauge",
            label: "각도 원판",
            text: `기둥 P 의 원판에 두 사슬이 벌어진 각 — ∠APB = ${v.deg}° 가 새겨져 있다.`,
          },
        ],
        input: { kind: "numeric", answer: v.ans, unit: "m", exact: String(v.ans) },
        hintConcept: [
          "박사의 수첩 2쪽 —",
          "「끼인각이 특수각이면 두려워 말라. 한 꼭짓점에서 수선을 내려 직각삼각형 두 개로 쪼개라.」",
          "A 에서 직선 PB 에 수선의 발 H 를 내리면 PH = a·cos θ, AH = a·sin θ. 그다음 피타고라스!",
        ],
        hintSolve: steps,
        solvedLine:
          "로프가 번쩍이며 정확히 발판 B 에 꽂힌다. 별빛이 손을 흔들며 함께 건넌다!",
        weight: 1,
      },
    ],
    params: { a: v.a, b: v.b, deg: v.deg, ans: v.ans },
  };
}

/* ------------------------------------------ Room 3 · 끊어진 지혜의 다리 */
/** Base d with angles α, β at both ends → perpendicular height h. */

type BridgeVariant = {
  alpha: number;
  beta: number;
  d: number;
  exact: string;
  val: number;
};

const BRIDGE_POOL: readonly BridgeVariant[] = [
  { alpha: 30, beta: 60, d: 12, exact: "3√3", val: 5.1 },
  { alpha: 30, beta: 60, d: 16, exact: "4√3", val: 6.8 },
  { alpha: 45, beta: 45, d: 14, exact: "7", val: 7 },
  { alpha: 45, beta: 45, d: 18, exact: "9", val: 9 },
  { alpha: 60, beta: 60, d: 10, exact: "5√3", val: 8.5 },
];

function buildBridgeRoom(): Room {
  const v = pick(BRIDGE_POOL);
  const steps: string[] = [
    "건너편 수정 기둥 C 에서 관측소를 잇는 선분 AB 에 수선의 발 H 를 내리자. CH = h 가 협곡의 폭!",
    `tan ${v.alpha}° = h ÷ AH  →  AH = h ÷ tan ${v.alpha}°,  같은 방법으로 BH = h ÷ tan ${v.beta}°`,
  ];
  if (v.alpha === 30 && v.beta === 60) {
    steps.push(
      "AH = h ÷ (√3/3) = √3·h,  BH = h ÷ √3 = (√3/3)·h",
      `AH + BH = √3h + (√3/3)h = (4√3/3)h = ${v.d}  →  h = ${v.exact} = ${fmt(v.val)} m`,
    );
  } else if (v.alpha === 45) {
    steps.push(
      "tan 45° = 1 이므로 AH = h, BH = h",
      `AH + BH = 2h = ${v.d}  →  h = ${fmt(v.val)} m`,
    );
  } else {
    steps.push(
      "AH = h ÷ √3 = (√3/3)h, BH 도 같다.",
      `AH + BH = (2√3/3)h = ${v.d}  →  h = ${v.exact} = ${fmt(v.val)} m`,
    );
  }
  return {
    id: 3,
    kind: "brokenBridge",
    title: "끊어진 지혜의 다리",
    objective: "일반 삼각형 — 밑변과 양 끝각으로 높이(수직 거리) 구하기",
    enterStory: [
      "이번엔 햇살 가득한 협곡. 다리는 오래전에 끊어져 잔해만 매달려 있다.",
      "건너편 절벽에 빛나는 수정 기둥 — 다리를 다시 놓으려면 이쪽 절벽에서 기둥까지의 수직 거리를 알아야 한다.",
      "절벽 가장자리에 고대의 관측소 두 개가 남아 있다. 조사해 보자.",
    ],
    puzzles: [
      {
        prompt: "이쪽 절벽에서 수정 기둥까지의 수직 거리(협곡의 폭)를 구하세요. (m)",
        approxNote: approxNoteFor(v.exact),
        clues: [
          {
            id: "obsA",
            label: "관측소 A",
            text: `관측소 A 의 망원경 — 수정 기둥과 절벽선이 이루는 각 ${v.alpha}° 에 고정되어 있다.`,
          },
          {
            id: "obsB",
            label: "관측소 B",
            text: `관측소 B 의 망원경 — 수정 기둥과 절벽선이 이루는 각 ${v.beta}° 에 고정되어 있다.`,
          },
          {
            id: "chain",
            label: "측량 사슬",
            text: `두 관측소 사이에 늘어진 측량 사슬 — 길이 ${v.d} m.`,
          },
        ],
        input: { kind: "numeric", answer: v.val, unit: "m", exact: v.exact },
        hintConcept: [
          "박사의 수첩 3쪽 —",
          "「강 건너까지의 거리는 건너지 않고도 알 수 있다. 기둥에서 밑변으로 수선을 내려 두 직각삼각형을 만들라.」",
          "AH + HB = AB 라는 사실이 방정식이 된다.",
        ],
        hintSolve: steps,
        solvedLine:
          "빛의 판자들이 하나씩 허공에 떠올라 협곡을 가로지른다. 지혜의 다리가 복원됐다!",
        weight: 1,
      },
    ],
    params: { alpha: v.alpha, beta: v.beta, d: v.d },
  };
}

/* ------------------------------------------- Room 4 · 수호자의 방패 */
/** Parallelogram area S = ab·sinθ — pick the shield with matching area. */

type Pg = { a: number; b: number; deg: number };

type ShieldVariant = {
  groove: Pg;
  grooveExact: string;
  correct: Pg;
  distractors: Pg[];
};

const SHIELD_POOL: readonly ShieldVariant[] = [
  {
    groove: { a: 6, b: 4, deg: 60 },
    grooveExact: "12√3",
    correct: { a: 8, b: 3, deg: 60 },
    distractors: [
      { a: 6, b: 4, deg: 30 },
      { a: 8, b: 3, deg: 45 },
      { a: 5, b: 4, deg: 90 },
    ],
  },
  {
    groove: { a: 8, b: 5, deg: 30 },
    grooveExact: "20",
    correct: { a: 4, b: 10, deg: 30 },
    distractors: [
      { a: 8, b: 5, deg: 60 },
      { a: 6, b: 5, deg: 45 },
      { a: 7, b: 4, deg: 30 },
    ],
  },
  {
    groove: { a: 6, b: 5, deg: 45 },
    grooveExact: "15√2",
    correct: { a: 10, b: 3, deg: 45 },
    distractors: [
      { a: 6, b: 5, deg: 30 },
      { a: 5, b: 4, deg: 60 },
      { a: 8, b: 4, deg: 45 },
    ],
  },
];

function pgLabel(p: Pg): ChoiceOption {
  return {
    title: `${p.a} × ${p.b}`,
    sub: `끼인각 ${p.deg}°`,
  };
}

function buildShieldRoom(): Room {
  const v = pick(SHIELD_POOL);
  const options = shuffled([
    { option: pgLabel(v.correct), correct: true },
    ...v.distractors.map((d) => ({ option: pgLabel(d), correct: false })),
  ]);
  const correctIndex = options.findIndex((o) => o.correct);
  const g = v.groove;
  const c = v.correct;
  return {
    id: 4,
    kind: "guardianShield",
    title: "수호자의 방패",
    objective: "평행사변형의 넓이 — S = ab × sin θ",
    enterStory: [
      "다리를 건너자 거대한 수호자 동상이 길을 안내하듯 서 있다. 두 눈이 호기심 있게 빛난다.",
      "동상의 가슴에 평행사변형 모양의 홈이 파여 있고, 바닥에는 방패 네 개가 흩어져 있다.",
      "「넓이가 홈과 같은 방패만이 수호자의 심장을 채우리라.」 — 같은 넓이의 방패를 찾아 쥐여 주자.",
    ],
    puzzles: [
      {
        prompt: "가슴의 홈과 넓이가 정확히 같은 방패를 골라 수호자에게 바치세요.",
        approxNote: undefined,
        clues: [
          {
            id: "groove",
            label: "가슴의 홈",
            text: `홈은 두 변이 ${g.a}, ${g.b} 이고 끼인각이 ${g.deg}° 인 평행사변형이다.`,
          },
          {
            id: "script",
            label: "받침돌의 문장",
            text: "「평행사변형의 넓이는 이웃한 두 변과 그 사잇각의 sin 이 정한다.」",
          },
        ],
        input: {
          kind: "choice",
          options: options.map((o) => o.option),
          correctIndex,
          artifactLabel: "방패",
        },
        hintConcept: [
          "박사의 수첩 4쪽 —",
          "「평행사변형은 밑변 × 높이. 높이는 이웃 변 b 와 sin θ 가 만든다.」",
          "S = a × b × sin θ  — 홈의 넓이부터 구한 뒤, 방패들의 넓이와 비교하라.",
        ],
        hintSolve: [
          `홈의 넓이 = ${g.a} × ${g.b} × sin ${g.deg}° = ${v.grooveExact}`,
          `각 방패도 같은 공식으로! 넓이가 ${v.grooveExact} 이 되는 방패는 ${c.a} × ${c.b}, 끼인각 ${c.deg}° 뿐이다.`,
        ],
        solvedLine:
          "방패가 홈에 완벽하게 들어맞자, 수호자가 고개를 숙이며 옆으로 물러선다.",
        weight: 1,
      },
    ],
    params: { a: g.a, b: g.b, deg: g.deg },
  };
}

/* --------------------------------------------- Room 5 · 태양의 제단 */
/** Triangle area S = ½ab·sinθ, acute altar then obtuse altar. */

type AltarVariant = {
  a: number;
  b: number;
  deg: number;
  exact: string;
  distractors: [string, string];
};

const ALTAR_ACUTE_POOL: readonly AltarVariant[] = [
  { a: 8, b: 6, deg: 60, exact: "12√3", distractors: ["24", "12"] },
  { a: 6, b: 4, deg: 45, exact: "6√2", distractors: ["12", "6√3"] },
  { a: 10, b: 4, deg: 30, exact: "10", distractors: ["20", "10√3"] },
];

const ALTAR_OBTUSE_POOL: readonly AltarVariant[] = [
  { a: 10, b: 4, deg: 120, exact: "10√3", distractors: ["20", "10"] },
  { a: 8, b: 6, deg: 135, exact: "12√2", distractors: ["24", "12√3"] },
  { a: 12, b: 5, deg: 150, exact: "15", distractors: ["30", "15√3"] },
];

function buildAltarPuzzle(v: AltarVariant, which: "acute" | "obtuse"): Puzzle {
  const options = shuffled([
    { option: { title: v.exact } satisfies ChoiceOption, correct: true },
    ...v.distractors.map((d) => ({
      option: { title: d } satisfies ChoiceOption,
      correct: false,
    })),
  ]);
  const correctIndex = options.findIndex((o) => o.correct);
  const sinExact = SIN_EXACT[v.deg]!;
  const obtuseSteps =
    which === "obtuse"
      ? [
          `sin ${v.deg}° = sin (180° − ${v.deg}°) = sin ${180 - v.deg}° = ${SIN_EXACT[180 - v.deg]!}`,
        ]
      : [];
  return {
    prompt:
      which === "acute"
        ? "첫 번째 제단 — 넓이가 새겨진 황금 판 중 알맞은 것을 제단 위에 올리세요."
        : "두 번째 제단 — 끼인각이 둔각이다! 알맞은 황금 판을 올리세요.",
    approxNote: undefined,
    clues:
      which === "acute"
        ? [
            {
              id: "altar1",
              label: "제단의 눈금",
              text: `삼각형 제단의 두 변은 ${v.a} 와 ${v.b}, 끼인각은 ${v.deg}° 다.`,
            },
            {
              id: "sun",
              label: "태양 문양",
              text: "「제단의 넓이와 같은 무게의 황금만이 태양을 깨우리라.」",
            },
          ]
        : [
            {
              id: "altar2",
              label: "두 번째 제단",
              text: `이번 제단의 두 변은 ${v.a} 와 ${v.b}, 끼인각은 무려 ${v.deg}° — 둔각이다!`,
            },
            {
              id: "shadow",
              label: "그림자 문양",
              text: "「둔각의 sin 은 그 보각의 sin 과 같다. 그림자는 빛을 기억한다.」",
            },
          ],
    input: {
      kind: "choice",
      options: options.map((o) => o.option),
      correctIndex,
      artifactLabel: "황금 판",
    },
    hintConcept:
      which === "acute"
        ? [
            "박사의 수첩 5쪽 —",
            "「삼각형의 넓이 = ½ × (한 변) × (이웃 변) × sin (끼인각).」",
            "S = ½ × a × b × sin θ",
          ]
        : [
            "박사의 수첩 5쪽 (뒷면) —",
            "「θ 가 둔각이면 sin θ = sin (180° − θ). 공식은 그대로!」",
            "S = ½ × a × b × sin (180° − θ)",
          ],
    hintSolve: [
      ...obtuseSteps,
      `S = ½ × ${v.a} × ${v.b} × ${sinExact} = ${v.exact}`,
    ],
    solvedLine:
      which === "acute"
        ? "황금 판이 제단에 녹아들며 방 절반에 태양빛이 번진다. 하지만 제단이 하나 더…!"
        : "두 번째 판이 빛나자 온 방이 눈부신 태양빛으로 가득 찬다. 숨겨진 통로가 열린다!",
    weight: 0.5,
  };
}

function buildAltarRoom(): Room {
  const acute = pick(ALTAR_ACUTE_POOL);
  const obtuse = pick(ALTAR_OBTUSE_POOL);
  return {
    id: 5,
    kind: "sunAltar",
    title: "태양의 제단",
    objective: "삼각형의 넓이 — S = ½ab × sin θ (둔각이면 보각의 sin)",
    enterStory: [
      "수호자가 비켜 준 길 끝, 비밀의 방 한가운데에 삼각형 제단 두 개가 마주 보고 서 있다.",
      "천장의 틈으로 새벽 별빛이 스며들고, 제단 곁에는 넓이가 새겨진 황금 판들이 놓여 있다.",
      "두 제단을 모두 깨워야 다음 방으로 가는 통로가 열린다.",
    ],
    puzzles: [
      buildAltarPuzzle(acute, "acute"),
      buildAltarPuzzle(obtuse, "obtuse"),
    ],
    params: {
      a1: acute.a,
      b1: acute.b,
      deg1: acute.deg,
      a2: obtuse.a,
      b2: obtuse.b,
      deg2: obtuse.deg,
    },
  };
}

/* ------------------------------------------- Room 6 · 황금의 별 */
/** Quadrilateral area from diagonals: S = ½·d₁·d₂·sinφ → 2-digit dial code. */

type StarVariant = {
  d1: number;
  d2: number;
  deg: number;
  code: number;
  exact: string;
};

const STAR_POOL: readonly StarVariant[] = [
  { d1: 12, d2: 10, deg: 30, code: 30, exact: "30" },
  { d1: 16, d2: 14, deg: 30, code: 56, exact: "56" },
  { d1: 18, d2: 8, deg: 30, code: 36, exact: "36" },
  { d1: 12, d2: 9, deg: 90, code: 54, exact: "54" },
  { d1: 10, d2: 12, deg: 60, code: 51, exact: "30√3" },
];

function buildStarRoom(): Room {
  const v = pick(STAR_POOL);
  const sinExact = SIN_EXACT[v.deg]!;
  const steps: string[] = [
    "두 대각선의 길이가 d₁, d₂ 이고 교각이 φ 인 사각형의 넓이 — S = ½ × d₁ × d₂ × sin φ",
    `S = ½ × ${v.d1} × ${v.d2} × ${sinExact} = ${v.exact}`,
  ];
  if (v.exact.includes("√3")) {
    steps.push(`√3 = ${SQRT3_APPROX} 이므로 S = ${v.code} — 이것이 다이얼 암호!`);
  } else {
    steps.push(`S = ${v.code} — 이것이 다이얼 암호!`);
  }
  return {
    id: 6,
    kind: "goldenStar",
    title: "최후의 암호, 황금의 별",
    objective: "사각형의 넓이 — 두 대각선과 교각으로 S = ½d₁d₂ × sin φ",
    enterStory: [
      "마지막 방. 천장까지 닿는 유리 돔 안에서 「황금의 별」이 눈부시게 빛나고 있다.",
      "돔의 바닥은 불규칙한 사각형 — 두 대각선이 별빛으로 그려져 교차한다.",
      "돔 앞의 거대한 돌 다이얼 두 개. 「바닥의 넓이가 곧 탈출의 암호다.」 시간이 얼마 없다!",
    ],
    puzzles: [
      {
        prompt: "유리 돔 바닥(사각형)의 넓이를 구해 두 자리 다이얼 암호를 맞추세요.",
        approxNote: v.exact.includes("√3")
          ? `√3 = ${SQRT3_APPROX} 로 계산하세요.`
          : undefined,
        clues: [
          {
            id: "diag1",
            label: "첫 번째 별빛 선",
            text: `한 대각선의 길이 — ${v.d1} m. 별빛이 선을 따라 흐른다.`,
          },
          {
            id: "diag2",
            label: "두 번째 별빛 선",
            text: `다른 대각선의 길이 — ${v.d2} m.`,
          },
          {
            id: "cross",
            label: "교차점의 문양",
            text: `두 대각선이 만나는 곳에 새겨진 교각 — ${v.deg}°.`,
          },
        ],
        input: {
          kind: "dial",
          code: [Math.floor(v.code / 10), v.code % 10],
        },
        hintConcept: [
          "박사의 수첩 마지막 쪽 —",
          "「어떤 사각형이든 두 대각선과 교각만 알면 넓이를 알 수 있다.」",
          "S = ½ × d₁ × d₂ × sin φ  (대각선을 따라 삼각형 4개로 쪼개 보면 보인다.)",
        ],
        hintSolve: steps,
        solvedLine:
          "다이얼이 맞물리며 유리 돔이 별빛 가루로 흩어진다. 황금의 별이 손안에 떨어졌다!",
        weight: 1,
      },
    ],
    params: { d1: v.d1, d2: v.d2, deg: v.deg, code: v.code },
  };
}

/* ------------------------------------------------------------ run */

export function generateRun(): TempleRun {
  return {
    rooms: [
      buildGateRoom(),
      buildLavaRoom(),
      buildBridgeRoom(),
      buildShieldRoom(),
      buildAltarRoom(),
      buildStarRoom(),
    ],
  };
}

export const PROLOGUE: string[] = [
  "중3 모험가 별빛과 함께, 실종된 수학자 피타 박사의 마지막 신호를 따라 그림자 신전에 도착했다.",
  "박사가 남긴 별 표지 수첩 첫 장에는 이렇게 적혀 있다.",
  "「이 신전은 여섯 개의 시련으로 잠겨 있다. 열쇠는 검이 아니라 삼각비다.」",
  "별빛이 손을 흔든다. 「괜찮아, 방마다 단서가 있어. 우리가 풀면 돼!」",
  "신전에 발을 들이자 등 뒤에서 석문이 살며시 닫힌다. 횃불이 꺼지기 전에 여섯 방을 모두 풀고 나가자!",
];

export const ESCAPE_STORY: string[] = [
  "황금의 별이 손안에서 반짝이자, 신전 천장이 별빛으로 가득 찬다.",
  "돌문이 열리고 쏟아지는 햇살. 그 안에 피타 박사와 별빛이 손을 흔들고 있다.",
  "「하하, 드디어 풀었구나!」 박사가 활짝 웃는다.",
  "「이 신전은 내가 만든 최종 시험이었단다. 삼각비를 퀘스트처럼 다루는 자, 이제 너는 후계자다.」",
];

export const TRAPPED_STORY: string[] = [
  "마지막 횃불이 깜빡이다 사그라든다. 잠시 어두운 듯했지만 —",
  "별빛이 수정 구슬을 들어 길을 밝힌다. 「오늘은 여기까지! 다음에 다시 오자.」",
  "입구의 돌문이 스르륵 열린다. 수첩에 새 글씨가 번진다.",
  "「신전은 도망가지 않는단다. 더 빠르게, 더 정확하게. 다시 도전하는 자를 기다린다.」",
];
