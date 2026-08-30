import {
  addPointOnGraph,
  isHorizontal,
  isVertical,
  pointCoords,
  xIntercept,
  yOnLine,
  type LinearFunctionState,
  type LinearGraph,
  type LinearPoint,
  type SlopeStep,
  type Translation,
} from "@/lib/diagrams/linear-function/model";
import {
  clipGraph,
  type LinearFunctionScene,
} from "@/lib/diagrams/linear-function/scene";
import {
  canvasXFromValue,
  canvasYFromValue,
  snapCoord,
  valueFromCanvasX,
  valueFromCanvasY,
  type PlaneLayout,
} from "@/lib/diagrams/coordinate-plane/scene";

export type LinearHit =
  | { kind: "label"; id: string; targetId: string }
  | { kind: "point"; pointId: string }
  | { kind: "slopeEnd"; stepId: string; which: 1 | 2 }
  | { kind: "intercept"; graphId: string; which: "x" | "y" }
  | { kind: "transArrow"; transId: string; index: number }
  | { kind: "graph"; graphId: string }
  | { kind: "plot" };

export function parsePointLabelId(
  id: string,
): { pointId: string; which: "name" | "axisX" | "axisY" } | null {
  const m = id.match(/^point:([^:]+):(name|axisX|axisY)$/);
  if (!m) return null;
  return { pointId: m[1]!, which: m[2] as "name" | "axisX" | "axisY" };
}

export function parseGraphLabelId(
  id: string,
): { graphId: string; which: "eq" | "xi" | "yi" } | null {
  const m = id.match(/^graph:([^:]+):(eq|xi|yi)$/);
  if (!m) return null;
  return { graphId: m[1]!, which: m[2] as "eq" | "xi" | "yi" };
}

export function parseSlopeLabelId(
  id: string,
): { stepId: string; which: "dx" | "dy" } | null {
  const m = id.match(/^slope:([^:]+):(dx|dy)$/);
  if (!m) return null;
  return { stepId: m[1]!, which: m[2] as "dx" | "dy" };
}

export function parseTransLabelId(id: string): string | null {
  const m = id.match(/^trans:([^:]+):delta$/);
  return m ? m[1]! : null;
}

type Candidate = { hit: LinearHit; weight: number };

function consider(
  best: Candidate | null,
  hit: LinearHit,
  d: number,
  max: number,
  bias: number,
): Candidate | null {
  if (d > max) return best;
  const weight = d + bias;
  if (best && weight >= best.weight) return best;
  return { hit, weight };
}

function distPointToSeg(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  px: number,
  py: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-12) return Math.hypot(px - ax, py - ay);
  const t = Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export function hitTestLinearFunction(
  state: LinearFunctionState,
  scene: LinearFunctionScene,
  x: number,
  y: number,
  hitScale = 1,
): LinearHit | null {
  const s = Number.isFinite(hitScale) && hitScale > 0 ? hitScale : 1;
  const layout = scene.layout;
  let best: Candidate | null = null;

  for (const text of scene.texts) {
    if (text.id === "origin" || text.id.startsWith("tick-")) continue;
    if (text.id === "axis-x" || text.id === "axis-y") {
      const hitX =
        text.anchor === "end" ? text.x - text.size * 0.7 : text.x;
      best = consider(
        best,
        { kind: "label", id: text.id, targetId: text.id },
        Math.hypot(hitX - x, text.y - y),
        28 * s,
        1,
      );
      continue;
    }
    const parsedPoint = parsePointLabelId(text.id);
    const parsedGraph = parseGraphLabelId(text.id);
    const parsedSlope = parseSlopeLabelId(text.id);
    const transId = parseTransLabelId(text.id);
    if (parsedPoint) {
      best = consider(
        best,
        { kind: "label", id: text.id, targetId: parsedPoint.pointId },
        Math.hypot(text.x - x, text.y - y),
        20 * s,
        3,
      );
    } else if (parsedGraph) {
      best = consider(
        best,
        { kind: "label", id: text.id, targetId: parsedGraph.graphId },
        Math.hypot(text.x - x, text.y - y),
        26 * s,
        2,
      );
    } else if (parsedSlope) {
      best = consider(
        best,
        { kind: "label", id: text.id, targetId: parsedSlope.stepId },
        Math.hypot(text.x - x, text.y - y),
        22 * s,
        2,
      );
    } else if (transId) {
      best = consider(
        best,
        { kind: "label", id: text.id, targetId: transId },
        Math.hypot(text.x - x, text.y - y),
        22 * s,
        2,
      );
    }
  }

  for (const point of state.points) {
    const graph = state.graphs.find((g) => g.id === point.graphId);
    if (!graph) continue;
    const coords = pointCoords(graph, point);
    const px = canvasXFromValue(coords.x, layout);
    const py = canvasYFromValue(coords.y, layout);
    best = consider(
      best,
      { kind: "point", pointId: point.id },
      Math.hypot(px - x, py - y),
      14 * s,
      0,
    );
  }

  for (const step of state.slopeSteps) {
    const graph = state.graphs.find((g) => g.id === step.graphId);
    if (!graph) continue;
    const a = {
      x: canvasXFromValue(step.x1, layout),
      y: canvasYFromValue(yOnLine(graph, step.x1), layout),
    };
    const b = {
      x: canvasXFromValue(step.x2, layout),
      y: canvasYFromValue(yOnLine(graph, step.x2), layout),
    };
    best = consider(
      best,
      { kind: "slopeEnd", stepId: step.id, which: 1 },
      Math.hypot(a.x - x, a.y - y),
      13 * s,
      0.4,
    );
    best = consider(
      best,
      { kind: "slopeEnd", stepId: step.id, which: 2 },
      Math.hypot(b.x - x, b.y - y),
      13 * s,
      0.4,
    );
  }

  for (const graph of state.graphs) {
    const xi = xIntercept(graph);
    if (graph.showXIntercept && xi != null && Math.abs(xi) > 1e-6) {
      const px = canvasXFromValue(xi, layout);
      const py = canvasYFromValue(0, layout);
      best = consider(
        best,
        { kind: "intercept", graphId: graph.id, which: "x" },
        Math.hypot(px - x, py - y),
        12 * s,
        1.2,
      );
    }
    if (graph.showYIntercept && !isVertical(graph) && Math.abs(graph.b) > 1e-6) {
      const px = canvasXFromValue(0, layout);
      const py = canvasYFromValue(graph.b, layout);
      best = consider(
        best,
        { kind: "intercept", graphId: graph.id, which: "y" },
        Math.hypot(px - x, py - y),
        12 * s,
        1.2,
      );
    }
  }

  for (const trans of state.translations) {
    const from = state.graphs.find((g) => g.id === trans.fromGraphId);
    const to = state.graphs.find((g) => g.id === trans.toGraphId);
    if (!from || !to) continue;
    trans.xs.forEach((tx, index) => {
      const y1 = canvasYFromValue(yOnLine(from, tx), layout);
      const y2 = canvasYFromValue(yOnLine(to, tx), layout);
      const px = canvasXFromValue(tx, layout);
      best = consider(
        best,
        { kind: "transArrow", transId: trans.id, index },
        distPointToSeg(px, y1, px, y2, x, y),
        10 * s,
        1.5,
      );
    });
  }

  for (const graph of state.graphs) {
    const seg = clipGraph(graph, layout);
    if (!seg) continue;
    best = consider(
      best,
      { kind: "graph", graphId: graph.id },
      distPointToSeg(seg[0]!.x, seg[0]!.y, seg[1]!.x, seg[1]!.y, x, y),
      8 * s,
      4,
    );
  }

  if (best) return best.hit;

  if (
    x >= layout.plotLeft - 8 &&
    x <= layout.plotRight + 8 &&
    y >= layout.plotTop - 8 &&
    y <= layout.plotBottom + 8
  ) {
    return { kind: "plot" };
  }
  return null;
}

export function nudgePointLabel(
  state: LinearFunctionState,
  pointId: string,
  dx: number,
  dy: number,
): LinearFunctionState {
  return {
    ...state,
    points: state.points.map((p) =>
      p.id === pointId
        ? { ...p, labelDx: p.labelDx + dx, labelDy: p.labelDy + dy }
        : p,
    ),
  };
}

export function nudgeGraphLabel(
  state: LinearFunctionState,
  graphId: string,
  labelId: string,
  dx: number,
  dy: number,
): LinearFunctionState {
  const parsed = parseGraphLabelId(labelId);
  return {
    ...state,
    graphs: state.graphs.map((g) => {
      if (g.id !== graphId) return g;
      if (parsed?.which === "xi") {
        return { ...g, xiLabelDx: g.xiLabelDx + dx, xiLabelDy: g.xiLabelDy + dy };
      }
      if (parsed?.which === "yi") {
        return { ...g, yiLabelDx: g.yiLabelDx + dx, yiLabelDy: g.yiLabelDy + dy };
      }
      return { ...g, labelDx: g.labelDx + dx, labelDy: g.labelDy + dy };
    }),
  };
}

export function nudgeSlopeLabel(
  state: LinearFunctionState,
  stepId: string,
  labelId: string,
  dx: number,
  dy: number,
): LinearFunctionState {
  const parsed = parseSlopeLabelId(labelId);
  return {
    ...state,
    slopeSteps: state.slopeSteps.map((s) => {
      if (s.id !== stepId) return s;
      if (parsed?.which === "dy") {
        return { ...s, dyLabelDx: s.dyLabelDx + dx, dyLabelDy: s.dyLabelDy + dy };
      }
      return { ...s, dxLabelDx: s.dxLabelDx + dx, dxLabelDy: s.dxLabelDy + dy };
    }),
  };
}

export function nudgeTransLabel(
  state: LinearFunctionState,
  transId: string,
  dx: number,
  dy: number,
): LinearFunctionState {
  return {
    ...state,
    translations: state.translations.map((t) =>
      t.id === transId
        ? { ...t, deltaDx: t.deltaDx + dx, deltaDy: t.deltaDy + dy }
        : t,
    ),
  };
}

export function nudgeAxisLabel(
  state: LinearFunctionState,
  id: string,
  dx: number,
  dy: number,
): LinearFunctionState {
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
  return state;
}

export function movePointOnLine(
  state: LinearFunctionState,
  pointId: string,
  x: number,
  y: number,
): LinearFunctionState {
  const point = state.points.find((p) => p.id === pointId);
  if (!point) return state;
  const graph = state.graphs.find((g) => g.id === point.graphId);
  if (graph && isVertical(graph)) {
    const ny = snapCoord(
      Math.min(state.yMax, Math.max(state.yMin, y)),
      state.yTick,
    );
    return {
      ...state,
      points: state.points.map((p) =>
        p.id === pointId ? { ...p, x: graph.c, y: ny } : p,
      ),
    };
  }
  const nx = snapCoord(
    Math.min(state.xMax, Math.max(state.xMin, x)),
    state.xTick,
  );
  return {
    ...state,
    points: state.points.map((p) => (p.id === pointId ? { ...p, x: nx } : p)),
  };
}

export function moveSlopeEnd(
  state: LinearFunctionState,
  stepId: string,
  which: 1 | 2,
  x: number,
): LinearFunctionState {
  const nx = snapCoord(
    Math.min(state.xMax, Math.max(state.xMin, x)),
    state.xTick,
  );
  return {
    ...state,
    slopeSteps: state.slopeSteps.map((s) => {
      if (s.id !== stepId) return s;
      return which === 1 ? { ...s, x1: nx } : { ...s, x2: nx };
    }),
  };
}

export function moveIntercept(
  state: LinearFunctionState,
  graphId: string,
  which: "x" | "y",
  value: number,
): LinearFunctionState {
  return {
    ...state,
    graphs: state.graphs.map((g) => {
      if (g.id !== graphId) return g;
      if (isVertical(g)) {
        if (which === "y") return g;
        const c = snapCoord(
          Math.min(state.xMax, Math.max(state.xMin, value)),
          state.xTick,
        );
        return { ...g, c };
      }
      if (which === "y") {
        const b = snapCoord(
          Math.min(state.yMax, Math.max(state.yMin, value)),
          state.yTick,
        );
        const xi = xIntercept(g);
        if (xi != null && Math.abs(xi) > 1e-6) {
          return { ...g, a: -b / xi, b };
        }
        return { ...g, b };
      }
      const x = snapCoord(
        Math.min(state.xMax, Math.max(state.xMin, value)),
        state.xTick,
      );
      if (Math.abs(x) < 1e-6) return g;
      if (Math.abs(g.b) > 1e-6) {
        return { ...g, a: -g.b / x };
      }
      return g;
    }),
  };
}

export function moveTransArrow(
  state: LinearFunctionState,
  transId: string,
  index: number,
  x: number,
): LinearFunctionState {
  const nx = snapCoord(
    Math.min(state.xMax, Math.max(state.xMin, x)),
    state.xTick,
  );
  return {
    ...state,
    translations: state.translations.map((t) => {
      if (t.id !== transId) return t;
      return {
        ...t,
        xs: t.xs.map((v, i) => (i === index ? nx : v)),
      };
    }),
  };
}

export function addSnappedPointOnGraph(
  state: LinearFunctionState,
  graphId: string,
  layout: PlaneLayout,
  canvasX: number,
  canvasY: number,
): LinearFunctionState {
  const graph = state.graphs.find((g) => g.id === graphId);
  if (graph && isVertical(graph)) {
    const y = snapCoord(valueFromCanvasY(canvasY, layout), state.yTick);
    return addPointOnGraph(state, graphId, graph.c, y);
  }
  const x = snapCoord(valueFromCanvasX(canvasX, layout), state.xTick);
  return addPointOnGraph(state, graphId, x);
}

export function shiftAxisLine(
  state: LinearFunctionState,
  graphId: string,
  x: number,
  y: number,
): LinearFunctionState {
  return {
    ...state,
    graphs: state.graphs.map((g) => {
      if (g.id !== graphId) return g;
      if (isVertical(g)) {
        return {
          ...g,
          c: snapCoord(Math.min(state.xMax, Math.max(state.xMin, x)), state.xTick),
        };
      }
      if (isHorizontal(g)) {
        return {
          ...g,
          b: snapCoord(Math.min(state.yMax, Math.max(state.yMin, y)), state.yTick),
        };
      }
      return g;
    }),
  };
}

export function nearestGraphId(
  state: LinearFunctionState,
  layout: PlaneLayout,
  canvasX: number,
  canvasY: number,
): string | null {
  let bestId: string | null = null;
  let bestD = 14;
  for (const graph of state.graphs) {
    const seg = clipGraph(graph, layout);
    if (!seg) continue;
    const d = distPointToSeg(
      seg[0]!.x,
      seg[0]!.y,
      seg[1]!.x,
      seg[1]!.y,
      canvasX,
      canvasY,
    );
    if (d < bestD) {
      bestD = d;
      bestId = graph.id;
    }
  }
  return bestId;
}

export function applyEditedLabel(
  state: LinearFunctionState,
  id: string,
  raw: string,
): LinearFunctionState {
  const pointParsed = parsePointLabelId(id);
  if (pointParsed?.which === "name") {
    return {
      ...state,
      points: state.points.map((p) =>
        p.id === pointParsed.pointId ? { ...p, name: raw.trim() || p.name } : p,
      ),
    };
  }
  const graphParsed = parseGraphLabelId(id);
  if (graphParsed?.which === "eq") {
    const next = raw.trim();
    if (!next) return state;
    return {
      ...state,
      graphs: state.graphs.map((g) =>
        g.id === graphParsed.graphId
          ? { ...g, labelMode: "custom" as const, custom: next }
          : g,
      ),
    };
  }
  if (id === "axis-x") return { ...state, xAxisLabel: raw };
  if (id === "axis-y") return { ...state, yAxisLabel: raw };
  if (id === "origin") {
    return { ...state, originLabel: raw.trim() || state.originLabel };
  }
  return state;
}

export function patchPoint(
  state: LinearFunctionState,
  pointId: string,
  patch: Partial<LinearPoint>,
): LinearFunctionState {
  return {
    ...state,
    points: state.points.map((p) =>
      p.id === pointId ? { ...p, ...patch } : p,
    ),
  };
}

export function patchGraph(
  state: LinearFunctionState,
  graphId: string,
  patch: Partial<LinearGraph>,
): LinearFunctionState {
  return {
    ...state,
    graphs: state.graphs.map((g) =>
      g.id === graphId ? { ...g, ...patch } : g,
    ),
  };
}

export function patchSlope(
  state: LinearFunctionState,
  stepId: string,
  patch: Partial<SlopeStep>,
): LinearFunctionState {
  return {
    ...state,
    slopeSteps: state.slopeSteps.map((s) =>
      s.id === stepId ? { ...s, ...patch } : s,
    ),
  };
}

export function patchTranslation(
  state: LinearFunctionState,
  transId: string,
  patch: Partial<Translation>,
): LinearFunctionState {
  return {
    ...state,
    translations: state.translations.map((t) =>
      t.id === transId ? { ...t, ...patch } : t,
    ),
  };
}

export { valueFromCanvasX, valueFromCanvasY, canvasXFromValue, canvasYFromValue };
