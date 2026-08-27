import {
  CARDINAL_ANGLE,
  chordAngleDeg,
  emptyLabel,
  newChordId,
  snapChordToRadius,
  type Cardinal,
  type ChordDraft,
  type CircleChordsState,
  type MeasLabel,
} from "@/lib/diagrams/circle-chords/model";

export type Vec = { x: number; y: number };

export function normalizeDeg(deg: number): number {
  let d = deg % 360;
  if (d < 0) d += 360;
  return d;
}

export function withMidAngle(chord: ChordDraft, deg: number): ChordDraft {
  const midAngleDeg = normalizeDeg(deg);
  const cardinals: Cardinal[] = ["right", "up", "left", "down"];
  let best: Cardinal = "up";
  let bestDiff = 999;
  for (const c of cardinals) {
    const diff = angularDiff(midAngleDeg, CARDINAL_ANGLE[c]);
    if (diff < bestDiff) {
      best = c;
      bestDiff = diff;
    }
  }
  let tilt = midAngleDeg - CARDINAL_ANGLE[best];
  if (tilt > 180) tilt -= 360;
  if (tilt < -180) tilt += 360;
  return { ...chord, midAngleDeg, cardinal: best, tiltDeg: tilt };
}

function angularDiff(a: number, b: number): number {
  let d = Math.abs(normalizeDeg(a) - normalizeDeg(b));
  if (d > 180) d = 360 - d;
  return d;
}

export function chordMath(chord: ChordDraft, radius: number) {
  const ang = (chordAngleDeg(chord) * Math.PI) / 180;
  const u: Vec = { x: Math.cos(ang), y: Math.sin(ang) };
  const v: Vec = { x: -u.y, y: u.x };
  const d = chord.distance;
  const half = chord.length / 2;
  const M: Vec = { x: u.x * d, y: u.y * d };
  const A: Vec = { x: M.x + v.x * -half, y: M.y + v.y * -half };
  const B: Vec = { x: M.x + v.x * half, y: M.y + v.y * half };
  return { A, B, M, u, v, half, d, ang };
}

/** Slide the chord around the circle, keeping length. */
export function rotateChordToPoint(
  chord: ChordDraft,
  radius: number,
  target: Vec,
  which: "start" | "end",
): ChordDraft {
  if (Math.hypot(target.x, target.y) < radius * 0.12) return chord;
  const { A, B } = chordMath(chord, radius);
  const from = which === "start" ? A : B;
  const fromAng = Math.atan2(from.y, from.x);
  const toAng = Math.atan2(target.y, target.x);
  const delta = ((toAng - fromAng) * 180) / Math.PI;
  return withMidAngle({ ...chord, lock: "length" }, chordAngleDeg(chord) + delta);
}

/** Move toward/away from the center. Length follows. Negative = other side. */
export function moveChordDistance(
  chord: ChordDraft,
  radius: number,
  target: Vec,
): ChordDraft {
  const ang = (chordAngleDeg(chord) * Math.PI) / 180;
  const u: Vec = { x: Math.cos(ang), y: Math.sin(ang) };
  let signed = target.x * u.x + target.y * u.y;
  const max = radius * 0.995;
  if (signed > max) signed = max;
  if (signed < -max) signed = -max;
  let mid = chordAngleDeg(chord);
  let d = signed;
  if (d < 0) {
    mid += 180;
    d = -d;
  }
  return snapChordToRadius(
    withMidAngle({ ...chord, lock: "distance", distance: d }, mid),
    radius,
  );
}

export function chordFromTwoPoints(
  a: Vec,
  b: Vec,
  radius: number,
  names: { start: string; end: string; mid: string },
): ChordDraft {
  const A = projectOnCircle(a, radius);
  const B = projectOnCircle(b, radius);
  const Mx = (A.x + B.x) / 2;
  const My = (A.y + B.y) / 2;
  const d = Math.hypot(Mx, My);
  const length = Math.hypot(B.x - A.x, B.y - A.y);
  const mid =
    d < 1e-6
      ? (Math.atan2(A.y, A.x) * 180) / Math.PI + 90
      : (Math.atan2(My, Mx) * 180) / Math.PI;
  return snapChordToRadius(
    withMidAngle(
      {
        id: newChordId(),
        lock: "length",
        length: Math.max(length, 0.2),
        distance: d,
        cardinal: "up",
        tiltDeg: 0,
        midAngleDeg: mid,
        startName: names.start,
        endName: names.end,
        midName: names.mid,
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
      },
      mid,
    ),
    radius,
  );
}

export function projectOnCircle(p: Vec, radius: number): Vec {
  const l = Math.hypot(p.x, p.y);
  if (l < 1e-9) return { x: radius, y: 0 };
  const s = radius / l;
  return { x: p.x * s, y: p.y * s };
}

const NEXT_NAMES = [
  ["A", "B", "M"],
  ["C", "D", "N"],
  ["E", "F", "P"],
  ["G", "H", "Q"],
];

export function nextChordNames(state: CircleChordsState): {
  start: string;
  end: string;
  mid: string;
} {
  const i = state.chords.length;
  const names = NEXT_NAMES[i] ?? ["P", "Q", "R"];
  return { start: names[0]!, end: names[1]!, mid: names[2]! };
}

export function parseMeasureInput(text: string): {
  kind: "number" | "unknown" | "text";
  value?: number;
  unknown?: string;
  raw: string;
} {
  const raw = text.trim();
  if (!raw) return { kind: "text", raw };
  const unknown = raw.match(/^([A-Za-z])(?:\s*(?:cm|mm))?$/);
  if (unknown) {
    return { kind: "unknown", unknown: unknown[1], raw };
  }
  const num = raw.match(/^(-?\d+(?:\.\d+)?)\s*(?:cm|mm)?$/i);
  if (num) {
    return { kind: "number", value: Number(num[1]), raw };
  }
  return { kind: "text", raw };
}

export function applyEditedLabel(
  state: CircleChordsState,
  id: string,
  text: string,
): CircleChordsState {
  const parsed = parseMeasureInput(text);
  if (id === "center-name") {
    return { ...state, centerName: text.trim() || "O" };
  }
  if (id === "caption") {
    return { ...state, caption: text, showCaption: text.trim().length > 0 };
  }
  const sep = id.lastIndexOf(":");
  if (sep < 0) return state;
  const chordId = id.slice(0, sep);
  const key = id.slice(sep + 1);

  if (key === "startName" || key === "endName" || key === "midName") {
    return {
      ...state,
      chords: state.chords.map((c) =>
        c.id === chordId ? { ...c, [key]: text.trim() } : c,
      ),
    };
  }

  const labelKeys = new Set([
    "chordLabel",
    "distLabel",
    "halfLabel",
    "radiusLabel",
  ]);
  if (!labelKeys.has(key)) return state;

  return {
    ...state,
    radius:
      key === "radiusLabel" && parsed.kind === "number" && parsed.value
        ? Math.max(parsed.value, 0.01)
        : state.radius,
    unknownLetter:
      parsed.kind === "unknown" && parsed.unknown
        ? parsed.unknown
        : state.unknownLetter,
    chords: state.chords.map((c) => {
      if (c.id !== chordId) {
        if (key === "radiusLabel" && parsed.kind === "number" && parsed.value) {
          return snapChordToRadius(c, Math.max(parsed.value, 0.01));
        }
        return c;
      }
      const prev = c[key as "chordLabel"] as MeasLabel;
      const label = labelFromParse(parsed, text, prev);
      let next: ChordDraft = { ...c, [key]: label };
      const r =
        key === "radiusLabel" && parsed.kind === "number" && parsed.value
          ? Math.max(parsed.value, 0.01)
          : state.radius;
      if (key === "chordLabel" && parsed.kind === "number" && parsed.value != null) {
        next = { ...next, lock: "length", length: Math.abs(parsed.value) };
      }
      if (key === "distLabel" && parsed.kind === "number" && parsed.value != null) {
        next = { ...next, lock: "distance", distance: Math.abs(parsed.value) };
      }
      if (key === "halfLabel" && parsed.kind === "number" && parsed.value != null) {
        next = { ...next, lock: "length", length: Math.abs(parsed.value) * 2 };
      }
      return snapChordToRadius(next, r);
    }),
  };
}

function labelFromParse(
  parsed: ReturnType<typeof parseMeasureInput>,
  text: string,
  prev: MeasLabel,
): MeasLabel {
  if (parsed.kind === "unknown") {
    return { ...prev, mode: "x", custom: "" };
  }
  if (parsed.kind === "number") {
    return { ...prev, mode: "auto", custom: "" };
  }
  if (!text.trim()) {
    return { ...prev, mode: "hide", custom: "" };
  }
  return { ...prev, mode: "custom", custom: text.trim() };
}

export function cycleLabelMode(label: MeasLabel): MeasLabel {
  if (label.mode === "auto") return { ...label, mode: "x", custom: "" };
  if (label.mode === "x") return { ...label, mode: "hide", custom: "" };
  return { ...label, mode: "auto", custom: "" };
}

export function mapChord(
  state: CircleChordsState,
  id: string,
  fn: (chord: ChordDraft) => ChordDraft,
): CircleChordsState {
  return {
    ...state,
    chords: state.chords.map((c) => (c.id === id ? fn(c) : c)),
  };
}

function clampNum(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function nudgeMeasureLabel(
  label: MeasLabel,
  canvasDx: number,
  canvasDy: number,
  along: Vec,
  outward: Vec,
  halfSpan: number,
): MeasLabel {
  const alongAmt = canvasDx * along.x + canvasDy * along.y;
  const perpAmt = canvasDx * outward.x + canvasDy * outward.y;
  const maxAlong = Math.max(halfSpan - 18, 4);
  return {
    ...label,
    dx: clampNum(label.dx + alongAmt, -maxAlong, maxAlong),
    dy: clampNum(label.dy + perpAmt, -80, 110),
  };
}

export function isMeasureKey(key: string): boolean {
  return (
    key === "chordLabel" ||
    key === "distLabel" ||
    key === "halfLabel" ||
    key === "radiusLabel"
  );
}

export function nudgeById(
  state: CircleChordsState,
  id: string,
  dx: number,
  dy: number,
): CircleChordsState {
  if (id === "center-name") {
    return {
      ...state,
      centerDx: (state.centerDx ?? 0) + dx,
      centerDy: (state.centerDy ?? 0) + dy,
    };
  }
  if (id === "caption") return state;
  const sep = id.lastIndexOf(":");
  if (sep < 0) return state;
  const chordId = id.slice(0, sep);
  const key = id.slice(sep + 1);
  return {
    ...state,
    chords: state.chords.map((c) => {
      if (c.id !== chordId) return c;
      if (key === "startName") {
        return { ...c, startDx: (c.startDx ?? 0) + dx, startDy: (c.startDy ?? 0) + dy };
      }
      if (key === "endName") {
        return { ...c, endDx: (c.endDx ?? 0) + dx, endDy: (c.endDy ?? 0) + dy };
      }
      if (key === "midName") {
        return { ...c, midDx: (c.midDx ?? 0) + dx, midDy: (c.midDy ?? 0) + dy };
      }
      const labelKeys = new Set([
        "chordLabel",
        "distLabel",
        "halfLabel",
        "radiusLabel",
      ]);
      if (!labelKeys.has(key)) return c;
      const label = c[key as "chordLabel"] as MeasLabel;
      return { ...c, [key]: { ...label, dx: label.dx + dx, dy: label.dy + dy } };
    }),
  };
}
