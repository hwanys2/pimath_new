import {
  boundKeys,
  snapInequalityValue,
  type BoundKey,
  type InequalityState,
} from "@/lib/diagrams/linear-inequality/model";
import {
  canvasXFromValue,
  valueFromCanvasX,
  type InequalityLayout,
  type InequalityScene,
} from "@/lib/diagrams/linear-inequality/scene";
import { rewriteInputRaw } from "@/lib/diagrams/number-line/parse";

export type InequalityHit =
  | { kind: "bound"; which: BoundKey }
  | { kind: "axis"; value: number };

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

type Candidate = { hit: InequalityHit; weight: number };

function consider(
  best: Candidate | null,
  hit: InequalityHit,
  d: number,
  max: number,
  bias: number,
): Candidate | null {
  if (d > max) return best;
  const weight = d + bias;
  if (best && weight >= best.weight) return best;
  return { hit, weight };
}

export function hitTestInequality(
  state: InequalityState,
  scene: InequalityScene,
  x: number,
  y: number,
  hitScale = 1,
): InequalityHit | null {
  const s = Number.isFinite(hitScale) && hitScale > 0 ? hitScale : 1;
  const layout = scene.layout;
  const p = { x, y };
  let best: Candidate | null = null;

  for (const which of boundKeys(state.kind)) {
    const px = canvasXFromValue(state[which].value, layout);
    best = consider(
      best,
      { kind: "bound", which },
      Math.hypot(p.x - px, p.y - layout.axisY),
      18 * s,
      0,
    );
  }

  const axisD = distToSeg(
    p,
    { x: layout.left - 24, y: layout.axisY },
    { x: layout.right + 24, y: layout.axisY },
  );
  best = consider(
    best,
    { kind: "axis", value: valueFromCanvasX(x, layout) },
    axisD,
    14 * s,
    22,
  );

  return best?.hit ?? null;
}

export function nearestBound(
  state: InequalityState,
  value: number,
): BoundKey | null {
  const keys = boundKeys(state.kind);
  if (keys.length === 0) return null;
  if (keys.length === 1) return keys[0]!;
  const dStart = Math.abs(state.start.value - value);
  const dEnd = Math.abs(state.end.value - value);
  return dStart <= dEnd ? "start" : "end";
}

export function applyBoundMove(
  state: InequalityState,
  which: BoundKey,
  value: number,
): InequalityState {
  let snapped = snapInequalityValue(value, state);
  if (state.kind === "segment" || state.kind === "split") {
    const gap = Math.min(state.tickStep / 4, 0.25);
    if (which === "start") {
      snapped = Math.min(snapped, state.end.value - gap);
    } else {
      snapped = Math.max(snapped, state.start.value + gap);
    }
    snapped = Math.min(state.max, Math.max(state.min, snapped));
    snapped = Math.round(snapped * 1000) / 1000;
  }
  return {
    ...state,
    [which]: {
      ...state[which],
      value: snapped,
      inputRaw: rewriteInputRaw(state[which].inputRaw, snapped),
    },
  };
}

export function toggleInclusive(
  state: InequalityState,
  which: BoundKey,
): InequalityState {
  return {
    ...state,
    [which]: {
      ...state[which],
      inclusive: !state[which].inclusive,
    },
  };
}

export { canvasXFromValue, valueFromCanvasX };
export type { InequalityLayout };
