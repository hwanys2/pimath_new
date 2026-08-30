import {
  addPointOnGraph,
  applyEquationToGraph,
  isHorizontal,
  vertexOf,
  yOnParabola,
  type QuadraticFunctionState,
  type QuadraticGraph,
  type QuadraticPoint,
  type Translation,
} from "@/lib/diagrams/quadratic-function/model";
import {
  buildQuadraticFunctionScene,
  nearestPointOnParabola,
  sampleParabola,
  clipHorizontal,
  type QuadraticFunctionScene,
} from "@/lib/diagrams/quadratic-function/scene";
import {
  canvasXFromValue,
  canvasYFromValue,
  snapCoord,
  valueFromCanvasX,
  valueFromCanvasY,
  type PlaneLayout,
} from "@/lib/diagrams/coordinate-plane/scene";

export type QuadraticHit =
  | { kind: "label"; id: string; targetId: string }
  | { kind: "point"; pointId: string }
  | { kind: "vertex"; graphId: string }
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
): { graphId: string; which: "eq" | "pMark" | "qMark" | "xi" | "yi" } | null {
  const m = id.match(/^graph:([^:]+):(eq|pMark|qMark|xi|yi)/);
  if (!m) return null;
  return { graphId: m[1]!, which: m[2] as "eq" | "pMark" | "qMark" | "xi" | "yi" };
}

export function parseTransLabelId(id: string): string | null {
  const m = id.match(/^trans:([^:]+):(delta|dp|dq)$/);
  return m ? m[1]! : null;
}

type Candidate = { hit: QuadraticHit; weight: number };

function consider(
  best: Candidate | null,
  hit: QuadraticHit,
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

function distToGraph(
  graph: QuadraticGraph,
  layout: PlaneLayout,
  x: number,
  y: number,
): number {
  if (isHorizontal(graph)) {
    const seg = clipHorizontal(graph.q, layout);
    if (!seg) return Infinity;
    return distPointToSeg(seg[0]!.x, seg[0]!.y, seg[1]!.x, seg[1]!.y, x, y);
  }
  let best = Infinity;
  for (const branch of sampleParabola(graph, layout)) {
    for (let i = 0; i < branch.length - 1; i += 1) {
      const a = branch[i]!;
      const b = branch[i + 1]!;
      best = Math.min(best, distPointToSeg(a.x, a.y, b.x, b.y, x, y));
    }
  }
  return best;
}

export function hitTestQuadraticFunction(
  state: QuadraticFunctionState,
  scene: QuadraticFunctionScene,
  x: number,
  y: number,
  hitScale = 1,
): QuadraticHit | null {
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
    const py = isHorizontal(graph)
      ? graph.q
      : yOnParabola(graph, point.x);
    const px = canvasXFromValue(point.x, layout);
    const cy = canvasYFromValue(py, layout);
    best = consider(
      best,
      { kind: "point", pointId: point.id },
      Math.hypot(px - x, cy - y),
      14 * s,
      0,
    );
  }

  for (const graph of state.graphs) {
    if (isHorizontal(graph)) continue;
    const v = vertexOf(graph);
    const vx = canvasXFromValue(v.x, layout);
    const vy = canvasYFromValue(v.y, layout);
    best = consider(
      best,
      { kind: "vertex", graphId: graph.id },
      Math.hypot(vx - x, vy - y),
      14 * s,
      0.5,
    );
  }

  for (const trans of state.translations) {
    const from = state.graphs.find((g) => g.id === trans.fromGraphId);
    const to = state.graphs.find((g) => g.id === trans.toGraphId);
    if (!from || !to) continue;
    if (trans.kind === "vertical") {
      trans.values.forEach((tx, index) => {
        const y1 = canvasYFromValue(yOnParabola(from, tx), layout);
        const y2 = canvasYFromValue(yOnParabola(to, tx), layout);
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
  }

  for (const graph of state.graphs) {
    best = consider(
      best,
      { kind: "graph", graphId: graph.id },
      distToGraph(graph, layout, x, y),
      10 * s,
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
  state: QuadraticFunctionState,
  pointId: string,
  dx: number,
  dy: number,
): QuadraticFunctionState {
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
  state: QuadraticFunctionState,
  graphId: string,
  labelId: string,
  dx: number,
  dy: number,
): QuadraticFunctionState {
  const parsed = parseGraphLabelId(labelId);
  return {
    ...state,
    graphs: state.graphs.map((g) => {
      if (g.id !== graphId) return g;
      if (parsed?.which === "pMark") {
        return { ...g, pMarkDx: g.pMarkDx + dx, pMarkDy: g.pMarkDy + dy };
      }
      if (parsed?.which === "qMark") {
        return { ...g, qMarkDx: g.qMarkDx + dx, qMarkDy: g.qMarkDy + dy };
      }
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

export function nudgeTransLabel(
  state: QuadraticFunctionState,
  transId: string,
  dx: number,
  dy: number,
): QuadraticFunctionState {
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
  state: QuadraticFunctionState,
  id: string,
  dx: number,
  dy: number,
): QuadraticFunctionState {
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

export function movePointOnGraph(
  state: QuadraticFunctionState,
  pointId: string,
  x: number,
): QuadraticFunctionState {
  const nx = snapCoord(
    Math.min(state.xMax, Math.max(state.xMin, x)),
    state.xTick,
  );
  return {
    ...state,
    points: state.points.map((p) =>
      p.id === pointId ? { ...p, x: nx } : p,
    ),
  };
}

export function moveVertex(
  state: QuadraticFunctionState,
  graphId: string,
  p: number,
  q: number,
): QuadraticFunctionState {
  return {
    ...state,
    graphs: state.graphs.map((g) =>
      g.id === graphId
        ? {
            ...g,
            p: snapCoord(
              Math.min(state.xMax, Math.max(state.xMin, p)),
              state.xTick,
            ),
            q: snapCoord(
              Math.min(state.yMax, Math.max(state.yMin, q)),
              state.yTick,
            ),
          }
        : g,
    ),
  };
}

export function moveParabolaShape(
  state: QuadraticFunctionState,
  graphId: string,
  x: number,
  y: number,
): QuadraticFunctionState {
  const graph = state.graphs.find((g) => g.id === graphId);
  if (!graph || isHorizontal(graph)) return state;
  const denom = (x - graph.p) ** 2;
  if (Math.abs(denom) < 1e-6) return state;
  const a = (y - graph.q) / denom;
  return {
    ...state,
    graphs: state.graphs.map((g) =>
      g.id === graphId ? { ...g, a } : g,
    ),
  };
}

export function shiftGraph(
  state: QuadraticFunctionState,
  graphId: string,
  p: number,
  q: number,
): QuadraticFunctionState {
  return moveVertex(state, graphId, p, q);
}

export function moveHorizontalLine(
  state: QuadraticFunctionState,
  graphId: string,
  q: number,
): QuadraticFunctionState {
  const nq = snapCoord(
    Math.min(state.yMax, Math.max(state.yMin, q)),
    state.yTick,
  );
  return {
    ...state,
    graphs: state.graphs.map((g) =>
      g.id === graphId && isHorizontal(g) ? { ...g, q: nq } : g,
    ),
  };
}

export function moveTransValue(
  state: QuadraticFunctionState,
  transId: string,
  index: number,
  value: number,
): QuadraticFunctionState {
  return {
    ...state,
    translations: state.translations.map((t) => {
      if (t.id !== transId) return t;
      if (t.kind === "horizontal") {
        const ny = snapCoord(
          Math.min(state.yMax, Math.max(state.yMin, value)),
          state.yTick,
        );
        return {
          ...t,
          values: t.values.map((v, i) => (i === index ? ny : v)),
        };
      }
      const nx = snapCoord(
        Math.min(state.xMax, Math.max(state.xMin, value)),
        state.xTick,
      );
      return {
        ...t,
        values: t.values.map((v, i) => (i === index ? nx : v)),
      };
    }),
  };
}

export function addSnappedPointOnGraph(
  state: QuadraticFunctionState,
  graphId: string,
  layout: PlaneLayout,
  canvasX: number,
  canvasY: number,
): QuadraticFunctionState {
  const graph = state.graphs.find((g) => g.id === graphId);
  if (!graph) return state;
  if (isHorizontal(graph)) {
    const x = snapCoord(valueFromCanvasX(canvasX, layout), state.xTick);
    return addPointOnGraph(state, graphId, x);
  }
  const nearest = nearestPointOnParabola(graph, layout, canvasX, canvasY);
  const x = snapCoord(
    nearest?.x ?? valueFromCanvasX(canvasX, layout),
    state.xTick,
  );
  return addPointOnGraph(state, graphId, x);
}

export function nearestGraphId(
  state: QuadraticFunctionState,
  layout: PlaneLayout,
  canvasX: number,
  canvasY: number,
): string | null {
  let bestId: string | null = null;
  let bestD = 14;
  for (const graph of state.graphs) {
    const d = distToGraph(graph, layout, canvasX, canvasY);
    if (d < bestD) {
      bestD = d;
      bestId = graph.id;
    }
  }
  return bestId;
}

export function applyEditedLabel(
  state: QuadraticFunctionState,
  id: string,
  raw: string,
): QuadraticFunctionState {
  const pointParsed = parsePointLabelId(id);
  if (pointParsed?.which === "name") {
    return {
      ...state,
      points: state.points.map((p) =>
        p.id === pointParsed.pointId
          ? { ...p, name: raw.trim() || p.name }
          : p,
      ),
    };
  }
  const graphParsed = parseGraphLabelId(id);
  if (graphParsed?.which === "eq") {
    const next = raw.trim();
    if (!next) return state;
    const applied = applyEquationToGraph(state, graphParsed.graphId, next);
    if (applied) return applied;
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
  state: QuadraticFunctionState,
  pointId: string,
  patch: Partial<QuadraticPoint>,
): QuadraticFunctionState {
  return {
    ...state,
    points: state.points.map((p) =>
      p.id === pointId ? { ...p, ...patch } : p,
    ),
  };
}

export function patchGraph(
  state: QuadraticFunctionState,
  graphId: string,
  patch: Partial<QuadraticGraph>,
): QuadraticFunctionState {
  return {
    ...state,
    graphs: state.graphs.map((g) =>
      g.id === graphId ? { ...g, ...patch } : g,
    ),
  };
}

export function patchTranslation(
  state: QuadraticFunctionState,
  transId: string,
  patch: Partial<Translation>,
): QuadraticFunctionState {
  return {
    ...state,
    translations: state.translations.map((t) =>
      t.id === transId ? { ...t, ...patch } : t,
    ),
  };
}

export {
  valueFromCanvasX,
  valueFromCanvasY,
  canvasXFromValue,
  canvasYFromValue,
};
