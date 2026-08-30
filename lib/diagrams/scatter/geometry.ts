import {
  addPoint,
  movePoint,
  patchPoint,
  type PointRole,
  type ScatterState,
} from "@/lib/diagrams/scatter/model";
import {
  canvasXFromValue,
  canvasYFromValue,
  frameAtPoint,
  frameForPanel,
  valueFromCanvasX,
  valueFromCanvasY,
  type ScatterScene,
} from "@/lib/diagrams/scatter/scene";

export type ScatterHit =
  | { kind: "label"; id: string; targetId: string }
  | { kind: "point"; id: string }
  | { kind: "plot"; panel: number };

type Candidate = { hit: ScatterHit; weight: number };

function consider(
  best: Candidate | null,
  hit: ScatterHit,
  d: number,
  max: number,
  bias: number,
): Candidate | null {
  if (d > max) return best;
  const weight = d + bias;
  if (best && weight >= best.weight) return best;
  return { hit, weight };
}

export function parsePointLabelId(id: string): string | null {
  const m = id.match(/^point:([^:]+):label$/);
  return m ? m[1]! : null;
}

export function parseAxisId(id: string): "axis-x" | "axis-y" | null {
  if (id === "axis-x" || id.startsWith("axis-x:")) return "axis-x";
  if (id === "axis-y" || id.startsWith("axis-y:")) return "axis-y";
  return null;
}

export function hitTestScatter(
  state: ScatterState,
  scene: ScatterScene,
  x: number,
  y: number,
  hitScale = 1,
): ScatterHit | null {
  const s = Number.isFinite(hitScale) && hitScale > 0 ? hitScale : 1;
  const layout = scene.layout;
  let best: Candidate | null = null;

  for (const text of scene.texts) {
    if (text.id.startsWith("tick-") || text.id.startsWith("origin:") || text.id.startsWith("panel:")) {
      continue;
    }
    if (text.id === "title") {
      const halfW = Math.max(36, state.title.trim().length * (text.size * 0.46));
      const halfH = text.size * 0.7 + 8;
      if (Math.abs(text.x - x) <= halfW * s && Math.abs(text.y - y) <= halfH * s) {
        best = consider(
          best,
          { kind: "label", id: "title", targetId: "title" },
          Math.abs(text.y - y),
          halfH * s,
          1,
        );
      }
      continue;
    }
    const axis = parseAxisId(text.id);
    if (axis) {
      const raw =
        axis === "axis-x" ? state.xAxisLabel.trim() : state.yAxisLabel.trim();
      const w = Math.max(text.size * 1.8, raw.length * text.size * 0.5);
      const hitX = text.anchor === "end" ? text.x - w / 2 : text.x;
      best = consider(
        best,
        { kind: "label", id: axis, targetId: axis },
        Math.hypot(hitX - x, text.y - y),
        Math.max(28, w * 0.55) * s,
        1,
      );
      continue;
    }
    const pointId = parsePointLabelId(text.id);
    if (pointId) {
      best = consider(
        best,
        { kind: "label", id: text.id, targetId: pointId },
        Math.hypot(text.x - x, text.y - y),
        26 * s,
        2,
      );
    }
  }

  for (const p of state.points) {
    const frame = frameForPanel(layout, p.panel);
    if (!frame) continue;
    const px = canvasXFromValue(p.x, frame);
    const py = canvasYFromValue(p.y, frame);
    const r =
      p.role === "mark"
        ? Math.max(12, state.style.markRadius * 2.4)
        : Math.max(9, state.style.pointRadius * 2.6);
    best = consider(
      best,
      { kind: "point", id: p.id },
      Math.hypot(px - x, py - y),
      r * s,
      p.role === "cloud" ? 6 : 0,
    );
  }

  if (best) return best.hit;

  const frame = frameAtPoint(layout, x, y);
  if (frame) return { kind: "plot", panel: frame.panel };
  return null;
}

export function nudgeMovableLabel(
  state: ScatterState,
  id: string,
  dx: number,
  dy: number,
): ScatterState {
  if (id === "axis-x") {
    return {
      ...state,
      xAxisLabelDx: state.xAxisLabelDx + dx,
      xAxisLabelDy: state.xAxisLabelDy + dy,
    };
  }
  if (id === "axis-y") {
    return {
      ...state,
      yAxisLabelDx: state.yAxisLabelDx + dx,
      yAxisLabelDy: state.yAxisLabelDy + dy,
    };
  }
  if (id === "title") {
    return {
      ...state,
      titleDx: state.titleDx + dx,
      titleDy: state.titleDy + dy,
    };
  }
  const pointId = parsePointLabelId(id);
  if (pointId) {
    return patchPoint(state, pointId, {
      labelDx: (state.points.find((p) => p.id === pointId)?.labelDx ?? 0) + dx,
      labelDy: (state.points.find((p) => p.id === pointId)?.labelDy ?? 0) + dy,
    });
  }
  return state;
}

export function applyEditedLabel(
  state: ScatterState,
  id: string,
  raw: string,
): ScatterState {
  if (id === "axis-x") return { ...state, xAxisLabel: raw };
  if (id === "axis-y") return { ...state, yAxisLabel: raw };
  if (id === "title") return { ...state, title: raw };
  const pointId = parsePointLabelId(id);
  if (pointId) return patchPoint(state, pointId, { label: raw });
  return state;
}

export function movePointFromCanvas(
  state: ScatterState,
  pointId: string,
  canvasX: number,
  canvasY: number,
  scene: ScatterScene,
): ScatterState {
  const point = state.points.find((p) => p.id === pointId);
  if (!point) return state;
  const frame = frameForPanel(scene.layout, point.panel);
  if (!frame) return state;
  return movePoint(
    state,
    pointId,
    valueFromCanvasX(canvasX, frame),
    valueFromCanvasY(canvasY, frame),
    true,
  );
}

export function addPointAtCanvas(
  state: ScatterState,
  canvasX: number,
  canvasY: number,
  scene: ScatterScene,
  role: PointRole,
): ScatterState {
  const frame = frameAtPoint(scene.layout, canvasX, canvasY);
  if (!frame) return state;
  return addPoint(state, {
    x: valueFromCanvasX(canvasX, frame),
    y: valueFromCanvasY(canvasY, frame),
    role,
    panel: frame.panel,
  });
}
