import {
  resolveBands,
  tickValues,
  type NumberLinePoint,
  type NumberLineState,
} from "@/lib/diagrams/number-line/model";
import { isNearInteger } from "@/lib/diagrams/number-line/parse";
import {
  canvasXFromValue,
  valueFromCanvasX,
  type NumberLineLayout,
  type NumberLineScene,
} from "@/lib/diagrams/number-line/scene";

export type NumberLineHit =
  | { kind: "label"; id: string; pointId: string }
  | { kind: "point"; pointId: string }
  | { kind: "axis"; value: number };

export function parsePointLabelId(
  id: string,
): { pointId: string; which: "name" | "value" } | null {
  const m = id.match(/^point:([^:]+):(name|value)$/);
  if (!m) return null;
  return { pointId: m[1]!, which: m[2] as "name" | "value" };
}

function distToSeg(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-9) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

type Candidate = { hit: NumberLineHit; d: number; weight: number };

function consider(
  best: Candidate | null,
  hit: NumberLineHit,
  d: number,
  max: number,
  bias: number,
): Candidate | null {
  if (d > max) return best;
  const weight = d + bias;
  if (best && weight >= best.weight) return best;
  return { hit, d, weight };
}

export function hitTestNumberLine(
  state: NumberLineState,
  scene: NumberLineScene,
  x: number,
  y: number,
  hitScale = 1,
): NumberLineHit | null {
  const s = Number.isFinite(hitScale) && hitScale > 0 ? hitScale : 1;
  const p = { x, y };
  const layout = scene.layout;
  let best: Candidate | null = null;

  for (const text of scene.texts) {
    const parsed = parsePointLabelId(text.id);
    if (!parsed) continue;
    best = consider(
      best,
      { kind: "label", id: text.id, pointId: parsed.pointId },
      Math.hypot(text.x - x, text.y - y),
      18 * s,
      4,
    );
  }

  for (const point of state.points) {
    const px = canvasXFromValue(point.value, layout);
    best = consider(
      best,
      { kind: "point", pointId: point.id },
      Math.hypot(p.x - px, p.y - layout.axisY),
      16 * s,
      0,
    );
  }

  const axisD = distToSeg(
    p,
    { x: layout.left - 24, y: layout.axisY },
    { x: layout.right + 24, y: layout.axisY },
  );
  const axisValue = valueFromCanvasX(x, layout);
  best = consider(
    best,
    { kind: "axis", value: axisValue },
    axisD,
    14 * s,
    22,
  );

  return best?.hit ?? null;
}

export function snapValue(value: number, state: NumberLineState): number {
  const clamped = Math.min(state.max, Math.max(state.min, value));
  const candidates: number[] = [];
  for (const t of tickValues(state.min, state.max, state.tickStep)) {
    candidates.push(t);
  }
  for (const band of resolveBands(state)) {
    for (let i = 0; i <= band.n; i += 1) {
      candidates.push(band.start + i / band.n);
    }
  }
  for (let n = 2; n <= 8; n += 1) {
    const start = Math.floor(clamped);
    for (let i = 0; i <= n; i += 1) {
      candidates.push(start + i / n);
    }
  }
  let best = clamped;
  let bestD = Infinity;
  for (const c of candidates) {
    if (c < state.min - 1e-9 || c > state.max + 1e-9) continue;
    const d = Math.abs(c - clamped);
    if (d < bestD) {
      best = c;
      bestD = d;
    }
  }
  const snapRadius = Math.min(state.tickStep / 8, 0.08);
  if (bestD > snapRadius && bestD > 0.04) return roundNice(clamped);
  return roundNice(best);
}

function roundNice(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function applyEditedLabel(
  state: NumberLineState,
  id: string,
  next: string,
): NumberLineState {
  const parsed = parsePointLabelId(id);
  if (!parsed) return state;
  return {
    ...state,
    points: state.points.map((p) => {
      if (p.id !== parsed.pointId) return p;
      if (parsed.which === "name") return { ...p, name: next.trim() || p.name };
      return p;
    }),
  };
}

export function nudgePointLabel(
  state: NumberLineState,
  pointId: string,
  dx: number,
  dy: number,
): NumberLineState {
  return {
    ...state,
    points: state.points.map((p) =>
      p.id === pointId
        ? {
            ...p,
            labelDx: p.labelDx + dx,
            labelDy: p.labelDy + dy,
          }
        : p,
    ),
  };
}

export function movePointValue(
  state: NumberLineState,
  pointId: string,
  value: number,
): NumberLineState {
  const snapped = snapValue(value, state);
  return {
    ...state,
    points: state.points.map((p) =>
      p.id === pointId
        ? {
            ...p,
            value: snapped,
            inputRaw: isNearInteger(snapped)
              ? String(Math.round(snapped))
              : p.inputRaw,
          }
        : p,
    ),
  };
}

export function mapPoint(
  state: NumberLineState,
  pointId: string,
  fn: (p: NumberLinePoint) => NumberLinePoint,
): NumberLineState {
  return {
    ...state,
    points: state.points.map((p) => (p.id === pointId ? fn(p) : p)),
  };
}

export function removePoint(
  state: NumberLineState,
  pointId: string,
): NumberLineState {
  return { ...state, points: state.points.filter((p) => p.id !== pointId) };
}

export { canvasXFromValue, valueFromCanvasX };
export type { NumberLineLayout };
