import {
  addPointAt,
  type CoordPlaneState,
  type CoordPoint,
  type PlaneGraph,
} from "@/lib/diagrams/coordinate-plane/model";
import {
  canvasXFromValue,
  canvasYFromValue,
  snapCoord,
  valueFromCanvasX,
  valueFromCanvasY,
  type CoordPlaneScene,
  type PlaneLayout,
} from "@/lib/diagrams/coordinate-plane/scene";

export type CoordHit =
  | { kind: "label"; id: string; targetId: string }
  | { kind: "point"; pointId: string }
  | { kind: "vertex"; graphId: string; index: number }
  | { kind: "plot" };

export function parsePointLabelId(
  id: string,
): { pointId: string; which: "name" | "axisX" | "axisY" } | null {
  const m = id.match(/^point:([^:]+):(name|axisX|axisY)$/);
  if (!m) return null;
  return { pointId: m[1]!, which: m[2] as "name" | "axisX" | "axisY" };
}

export function parseGraphLabelId(id: string): string | null {
  const m = id.match(/^graph:([^:]+):eq$/);
  return m ? m[1]! : null;
}

type Candidate = { hit: CoordHit; weight: number; d: number };

function consider(
  best: Candidate | null,
  hit: CoordHit,
  d: number,
  max: number,
  bias: number,
): Candidate | null {
  if (d > max) return best;
  const weight = d + bias;
  if (best && weight >= best.weight) return best;
  return { hit, d: 0, weight };
}

export function hitTestCoordPlane(
  state: CoordPlaneState,
  scene: CoordPlaneScene,
  x: number,
  y: number,
  hitScale = 1,
): CoordHit | null {
  const s = Number.isFinite(hitScale) && hitScale > 0 ? hitScale : 1;
  const layout = scene.layout;
  let best: Candidate | null = null;

  for (const text of scene.texts) {
    if (text.id === "origin" || text.id.startsWith("tick-") || text.id.startsWith("axis-")) {
      continue;
    }
    const parsedPoint = parsePointLabelId(text.id);
    const graphId = parseGraphLabelId(text.id);
    if (parsedPoint) {
      best = consider(
        best,
        { kind: "label", id: text.id, targetId: parsedPoint.pointId },
        Math.hypot(text.x - x, text.y - y),
        20 * s,
        3,
      );
    } else if (graphId) {
      best = consider(
        best,
        { kind: "label", id: text.id, targetId: graphId },
        Math.hypot(text.x - x, text.y - y),
        26 * s,
        2,
      );
    }
  }

  for (const point of state.points) {
    const px = canvasXFromValue(point.x, layout);
    const py = canvasYFromValue(point.y, layout);
    best = consider(
      best,
      { kind: "point", pointId: point.id },
      Math.hypot(px - x, py - y),
      14 * s,
      0,
    );
  }

  for (const graph of state.graphs) {
    if (graph.t !== "polyline") continue;
    graph.vertices.forEach((v, index) => {
      const px = canvasXFromValue(v.x, layout);
      const py = canvasYFromValue(v.y, layout);
      best = consider(
        best,
        { kind: "vertex", graphId: graph.id, index },
        Math.hypot(px - x, py - y),
        12 * s,
        1,
      );
    });
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
  state: CoordPlaneState,
  pointId: string,
  dx: number,
  dy: number,
): CoordPlaneState {
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
  state: CoordPlaneState,
  graphId: string,
  dx: number,
  dy: number,
): CoordPlaneState {
  return {
    ...state,
    graphs: state.graphs.map((g) =>
      g.id === graphId
        ? { ...g, labelDx: g.labelDx + dx, labelDy: g.labelDy + dy }
        : g,
    ),
  };
}

export function movePoint(
  state: CoordPlaneState,
  pointId: string,
  x: number,
  y: number,
): CoordPlaneState {
  const nx = snapCoord(
    Math.min(state.xMax, Math.max(state.xMin, x)),
    state.xTick,
  );
  const ny = snapCoord(
    Math.min(state.yMax, Math.max(state.yMin, y)),
    state.yTick,
  );
  return {
    ...state,
    points: state.points.map((p) =>
      p.id === pointId ? { ...p, x: nx, y: ny } : p,
    ),
  };
}

export function moveVertex(
  state: CoordPlaneState,
  graphId: string,
  index: number,
  x: number,
  y: number,
): CoordPlaneState {
  const nx = snapCoord(
    Math.min(state.xMax, Math.max(state.xMin, x)),
    state.xTick / 2,
  );
  const ny = snapCoord(
    Math.min(state.yMax, Math.max(state.yMin, y)),
    state.yTick / 2,
  );
  return {
    ...state,
    graphs: state.graphs.map((g) => {
      if (g.id !== graphId || g.t !== "polyline") return g;
      return {
        ...g,
        vertices: g.vertices.map((v, i) =>
          i === index ? { x: nx, y: ny } : v,
        ),
      };
    }),
  };
}

export function addSnappedPoint(
  state: CoordPlaneState,
  layout: PlaneLayout,
  canvasX: number,
  canvasY: number,
): CoordPlaneState {
  const x = snapCoord(valueFromCanvasX(canvasX, layout), state.xTick);
  const y = snapCoord(valueFromCanvasY(canvasY, layout), state.yTick);
  return addPointAt(state, x, y);
}

export function applyEditedLabel(
  state: CoordPlaneState,
  id: string,
  raw: string,
): CoordPlaneState {
  const pointParsed = parsePointLabelId(id);
  if (pointParsed?.which === "name") {
    return {
      ...state,
      points: state.points.map((p) =>
        p.id === pointParsed.pointId ? { ...p, name: raw.trim() || p.name } : p,
      ),
    };
  }
  const graphId = parseGraphLabelId(id);
  if (graphId) {
    return {
      ...state,
      graphs: state.graphs.map((g) => {
        if (g.id !== graphId) return g;
        const next = raw.trim();
        if (!next) return g;
        return { ...g, labelMode: "custom" as const, custom: next };
      }),
    };
  }
  if (id === "origin") {
    return { ...state, originLabel: raw.trim() || state.originLabel };
  }
  if (id === "axis-x") {
    return { ...state, xAxisLabel: raw };
  }
  if (id === "axis-y") {
    return { ...state, yAxisLabel: raw };
  }
  return state;
}

export function patchPoint(
  state: CoordPlaneState,
  pointId: string,
  patch: Partial<CoordPoint>,
): CoordPlaneState {
  return {
    ...state,
    points: state.points.map((p) =>
      p.id === pointId ? { ...p, ...patch } : p,
    ),
  };
}

export function patchGraph(
  state: CoordPlaneState,
  graphId: string,
  patch: Partial<PlaneGraph>,
): CoordPlaneState {
  return {
    ...state,
    graphs: state.graphs.map((g) => {
      if (g.id !== graphId) return g;
      return { ...g, ...patch } as PlaneGraph;
    }),
  };
}

function distPointToSeg(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  px: number,
  py: number,
): { d: number; t: number } {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-12) {
    return { d: Math.hypot(px - ax, py - ay), t: 0 };
  }
  const t = ((px - ax) * dx + (py - ay) * dy) / len2;
  const clamped = Math.min(1, Math.max(0, t));
  return {
    d: Math.hypot(px - (ax + clamped * dx), py - (ay + clamped * dy)),
    t,
  };
}

export function addPolylineVertex(
  state: CoordPlaneState,
  graphId: string,
  layout: PlaneLayout,
  canvasX: number,
  canvasY: number,
): CoordPlaneState {
  const x = snapCoord(valueFromCanvasX(canvasX, layout), state.xTick / 2);
  const y = snapCoord(valueFromCanvasY(canvasY, layout), state.yTick / 2);
  return {
    ...state,
    graphs: state.graphs.map((g) => {
      if (g.id !== graphId || g.t !== "polyline") return g;
      const verts = g.vertices;
      if (verts.length < 2) {
        return { ...g, vertices: [...verts, { x, y }] };
      }
      let bestSeg = 0;
      let bestD = Infinity;
      for (let i = 0; i < verts.length - 1; i += 1) {
        const a = verts[i]!;
        const b = verts[i + 1]!;
        const { d } = distPointToSeg(a.x, a.y, b.x, b.y, x, y);
        if (d < bestD) {
          bestD = d;
          bestSeg = i;
        }
      }
      const first = verts[0]!;
      const last = verts[verts.length - 1]!;
      const second = verts[1]!;
      const prev = verts[verts.length - 2]!;
      const firstProj = distPointToSeg(first.x, first.y, second.x, second.y, x, y);
      const lastProj = distPointToSeg(prev.x, prev.y, last.x, last.y, x, y);
      let insertAt = bestSeg + 1;
      if (lastProj.t > 1 && Math.hypot(x - last.x, y - last.y) <= bestD + 1e-6) {
        insertAt = verts.length;
      } else if (
        firstProj.t < 0 &&
        Math.hypot(x - first.x, y - first.y) <= bestD + 1e-6
      ) {
        insertAt = 0;
      }
      return {
        ...g,
        vertices: [
          ...verts.slice(0, insertAt),
          { x, y },
          ...verts.slice(insertAt),
        ],
      };
    }),
  };
}
