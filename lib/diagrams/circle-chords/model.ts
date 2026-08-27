export type LabelMode = "auto" | "x" | "hide" | "custom";

export type MeasLabel = {
  mode: LabelMode;
  custom: string;
  dx: number;
  dy: number;
};

export type ChordLock = "length" | "distance";

export type Cardinal = "up" | "down" | "left" | "right";

export type ChordDraft = {
  id: string;
  lock: ChordLock;
  length: number;
  distance: number;
  cardinal: Cardinal;
  /** Added to the cardinal angle, degrees. */
  tiltDeg: number;
  /** Preferred source of orientation. Falls back to cardinal + tilt. */
  midAngleDeg?: number;
  startName: string;
  endName: string;
  midName: string;
  startDx?: number;
  startDy?: number;
  endDx?: number;
  endDy?: number;
  midDx?: number;
  midDy?: number;
  showPoints: boolean;
  showMidpoint: boolean;
  showPerp: boolean;
  showRightAngle: boolean;
  showRadiusStart: boolean;
  showRadiusEnd: boolean;
  /** 0 = off, 1–2 = equal-length tick marks on the chord. */
  equalTicks: 0 | 1 | 2;
  showHalf: boolean;
  chordLabel: MeasLabel;
  distLabel: MeasLabel;
  halfLabel: MeasLabel;
  radiusLabel: MeasLabel;
};

export type DiagramStyle = {
  lineWidth: number;
  fontSize: number;
  pointLabelSize: number;
  pointRadius: number;
  rightAngleSize: number;
  dimOffset: number;
  padding: number;
  exportScale: number;
  captionSize: number;
};

export type CircleChordsState = {
  radius: number;
  showCenter: boolean;
  centerName: string;
  centerDx?: number;
  centerDy?: number;
  unit: string;
  unknownLetter: string;
  caption: string;
  showCaption: boolean;
  /** Rotate the whole figure around the center. */
  viewRotationDeg: number;
  chords: ChordDraft[];
  style: DiagramStyle;
};

export const CARDINAL_ANGLE: Record<Cardinal, number> = {
  right: 0,
  up: 90,
  left: 180,
  down: 270,
};

export function emptyLabel(mode: LabelMode = "auto"): MeasLabel {
  return { mode, custom: "", dx: 0, dy: 0 };
}

export function newChordId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `c-${Math.random().toString(36).slice(2, 10)}`;
}

const DEFAULT_STYLE: DiagramStyle = {
  lineWidth: 1.7,
  fontSize: 20,
  pointLabelSize: 22,
  pointRadius: 3.2,
  rightAngleSize: 11,
  dimOffset: 22,
  padding: 52,
  exportScale: 3,
  captionSize: 20,
};

function chordAB(partial: Partial<ChordDraft> = {}): ChordDraft {
  return {
    id: "c-ab",
    lock: "length",
    length: 16,
    distance: 6,
    cardinal: "up",
    tiltDeg: 0,
    startName: "A",
    endName: "B",
    midName: "M",
    startDx: 0,
    startDy: 0,
    endDx: 0,
    endDy: 0,
    midDx: 0,
    midDy: 0,
    showPoints: true,
    showMidpoint: false,
    showPerp: true,
    showRightAngle: true,
    showRadiusStart: false,
    showRadiusEnd: false,
    equalTicks: 0,
    showHalf: false,
    chordLabel: emptyLabel("auto"),
    distLabel: emptyLabel("auto"),
    halfLabel: emptyLabel("hide"),
    radiusLabel: emptyLabel("hide"),
    ...partial,
  };
}

export function snapChordToRadius(chord: ChordDraft, radius: number): ChordDraft {
  const r = Math.max(radius, 0.01);
  const maxLen = r * 2 * 0.995;
  const maxDist = r * 0.995;
  const midAngleDeg = chordAngleDeg(chord);
  if (chord.lock === "length") {
    const length = clamp(chord.length, 0.2, maxLen);
    const half = length / 2;
    const distance = Math.sqrt(Math.max(r * r - half * half, 0));
    return { ...chord, length, distance, midAngleDeg };
  }
  const distance = clamp(chord.distance, 0, maxDist);
  const half = Math.sqrt(Math.max(r * r - distance * distance, 0));
  return { ...chord, distance, length: half * 2, midAngleDeg };
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function withSnappedChords(state: CircleChordsState): CircleChordsState {
  return {
    ...state,
    radius: Math.max(state.radius, 0.01),
    chords: state.chords.map((c) => snapChordToRadius(c, state.radius)),
  };
}

export const CIRCLE_CHORD_PRESETS: {
  id: string;
  title: string;
  hint: string;
  state: CircleChordsState;
}[] = [
  {
    id: "equal-chords",
    title: "같은 길이의 두 현",
    hint: "AB = CD 이므로 중심 거리도 같다",
    state: withSnappedChords({
      radius: 10,
      showCenter: true,
      centerName: "O",
      unit: "cm",
      unknownLetter: "x",
      caption: "x를 구하시오.",
      showCaption: true,
      viewRotationDeg: 0,
      style: { ...DEFAULT_STYLE },
      chords: [
        snapChordToRadius(
          chordAB({
            distLabel: emptyLabel("auto"),
            chordLabel: emptyLabel("auto"),
          }),
          10,
        ),
        snapChordToRadius(
          chordAB({
            id: "c-cd",
            startName: "C",
            endName: "D",
            midName: "N",
            cardinal: "down",
            distLabel: emptyLabel("x"),
          }),
          10,
        ),
      ],
    }),
  },
  {
    id: "radius-visible",
    title: "반지름이 보이는 두 현",
    hint: "반지름·현·거리를 한 그림에",
    state: withSnappedChords({
      radius: 10,
      showCenter: true,
      centerName: "O",
      unit: "cm",
      unknownLetter: "x",
      caption: "",
      showCaption: false,
      viewRotationDeg: 8,
      style: { ...DEFAULT_STYLE },
      chords: [
        snapChordToRadius(
          chordAB({
            showPoints: false,
            distLabel: emptyLabel("x"),
          }),
          10,
        ),
        snapChordToRadius(
          chordAB({
            id: "c-cd",
            startName: "C",
            endName: "D",
            midName: "N",
            cardinal: "down",
            showPoints: false,
            distLabel: emptyLabel("hide"),
            showRadiusEnd: true,
            radiusLabel: emptyLabel("auto"),
          }),
          10,
        ),
      ],
    }),
  },
  {
    id: "pythagoras",
    title: "한 현과 직각삼각형",
    hint: "수선의 발 M, r² = d² + (ℓ/2)²",
    state: withSnappedChords({
      radius: 10,
      showCenter: true,
      centerName: "O",
      unit: "cm",
      unknownLetter: "x",
      caption: "",
      showCaption: false,
      viewRotationDeg: 0,
      style: { ...DEFAULT_STYLE },
      chords: [
        snapChordToRadius(
          chordAB({
            showMidpoint: true,
            showHalf: true,
            showRadiusEnd: true,
            halfLabel: emptyLabel("auto"),
            radiusLabel: emptyLabel("auto"),
            distLabel: emptyLabel("x"),
          }),
          10,
        ),
      ],
    }),
  },
  {
    id: "equal-distance",
    title: "같은 거리의 두 현",
    hint: "중심 거리가 같으면 현의 길이도 같다",
    state: withSnappedChords({
      radius: 10,
      showCenter: true,
      centerName: "O",
      unit: "cm",
      unknownLetter: "x",
      caption: "x를 구하시오.",
      showCaption: true,
      viewRotationDeg: 0,
      style: { ...DEFAULT_STYLE },
      chords: [
        snapChordToRadius(
          chordAB({
            lock: "distance",
            distance: 6,
            tiltDeg: -18,
            chordLabel: emptyLabel("auto"),
            distLabel: emptyLabel("auto"),
          }),
          10,
        ),
        snapChordToRadius(
          chordAB({
            id: "c-cd",
            lock: "distance",
            distance: 6,
            startName: "C",
            endName: "D",
            midName: "N",
            cardinal: "down",
            tiltDeg: 22,
            chordLabel: emptyLabel("x"),
            distLabel: emptyLabel("auto"),
          }),
          10,
        ),
      ],
    }),
  },
];

export const DEFAULT_CIRCLE_CHORDS_STATE: CircleChordsState =
  structuredClone(CIRCLE_CHORD_PRESETS[0]!.state);

export function cloneState(state: CircleChordsState): CircleChordsState {
  return structuredClone(state);
}

const NEXT_NAMES = [
  ["A", "B", "M"],
  ["C", "D", "N"],
  ["E", "F", "P"],
  ["G", "H", "Q"],
];

export function addChord(state: CircleChordsState): CircleChordsState {
  if (state.chords.length >= 4) return state;
  const i = state.chords.length;
  const names = NEXT_NAMES[i] ?? ["P", "Q", "R"];
  const opposite: Cardinal =
    state.chords[0]?.cardinal === "up"
      ? "down"
      : state.chords[0]?.cardinal === "down"
        ? "up"
        : "down";
  const template = state.chords[0];
  const draft = snapChordToRadius(
    chordAB({
      id: newChordId(),
      lock: template?.lock ?? "length",
      length: template?.length ?? 16,
      distance: template?.distance ?? 6,
      cardinal: i === 1 ? opposite : template?.cardinal === "up" ? "right" : "up",
      startName: names[0],
      endName: names[1],
      midName: names[2],
      showPoints: template?.showPoints ?? true,
      distLabel: emptyLabel(i === 1 ? "x" : "auto"),
    }),
    state.radius,
  );
  return { ...state, chords: [...state.chords, draft] };
}

export function chordAngleDeg(chord: ChordDraft): number {
  if (typeof chord.midAngleDeg === "number" && Number.isFinite(chord.midAngleDeg)) {
    return chord.midAngleDeg;
  }
  return CARDINAL_ANGLE[chord.cardinal] + chord.tiltDeg;
}

export function resolveLabelText(
  label: MeasLabel,
  autoValue: number,
  unit: string,
  unknownLetter: string,
): string | null {
  if (label.mode === "hide") return null;
  if (label.mode === "x") {
    const u = unit.trim();
    return u ? `${unknownLetter} ${u}` : unknownLetter;
  }
  if (label.mode === "custom") {
    const t = label.custom.trim();
    return t.length > 0 ? t : null;
  }
  return formatMeasureLabel(autoValue, unit);
}

function formatMeasureLabel(value: number, unit: string): string {
  const n = formatNice(value);
  const u = unit.trim();
  return u ? `${n} ${u}` : n;
}

function formatNice(value: number): string {
  if (!Number.isFinite(value)) return "";
  const rounded = Math.round(value * 1000) / 1000;
  if (Math.abs(rounded - Math.round(rounded)) < 1e-6) {
    return String(Math.round(rounded));
  }
  return String(Math.round(rounded * 100) / 100);
}
