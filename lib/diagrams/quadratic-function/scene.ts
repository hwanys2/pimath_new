import { parseMathRuns, parseNameRuns } from "@/lib/diagrams/math-label";
import {
  graphStrokeWidth,
  interceptLabel,
  isHorizontal,
  isMinimum,
  quadraticEquationText,
  vertexOf,
  xAtY,
  xIntercepts,
  yIntercept,
  yOnParabola,
  toPlaneBackdrop,
  type QuadraticFunctionState,
  type QuadraticGraph,
  type Translation,
  EXTREMA_HIGHLIGHT,
} from "@/lib/diagrams/quadratic-function/model";
import {
  buildCoordPlaneScene,
  canvasXFromValue,
  canvasYFromValue,
  dataYMin,
  SCENE_HEIGHT,
  SCENE_WIDTH,
  type CoordPlaneScene,
  type PlaneLayout,
} from "@/lib/diagrams/coordinate-plane/scene";
import type { SceneCmd, SceneText, Vec } from "@/lib/diagrams/scene";

export { SCENE_HEIGHT, SCENE_WIDTH } from "@/lib/diagrams/coordinate-plane/scene";
export type { PlaneLayout } from "@/lib/diagrams/coordinate-plane/scene";

export type QuadraticFunctionScene = CoordPlaneScene;

function pushText(
  texts: SceneText[],
  cmds: SceneCmd[],
  text: SceneText,
): void {
  texts.push(text);
  cmds.push({ t: "text", text });
}

function inRange(v: number, lo: number, hi: number): boolean {
  return v >= lo - 1e-8 && v <= hi + 1e-8;
}

function clampYForDraw(y: number, layout: PlaneLayout): number | null {
  if (layout.yBreak && y + 1e-9 < layout.yBreakTo) return null;
  if (y < layout.yMin - 1e-6 || y > layout.yMax + 1e-6) return null;
  return canvasYFromValue(y, layout);
}

export function sampleParabola(
  graph: QuadraticGraph,
  layout: PlaneLayout,
): Vec[][] {
  if (isHorizontal(graph)) return [];
  const yLo = dataYMin(layout);
  const yHi = layout.yMax;
  const xLo = layout.xMin;
  const xHi = layout.xMax;
  const n = 320;
  const branches: Vec[][] = [];
  let current: Vec[] = [];

  function flush() {
    if (current.length >= 2) branches.push(current);
    current = [];
  }

  for (let i = 0; i <= n; i += 1) {
    const x = xLo + ((xHi - xLo) * i) / n;
    const y = yOnParabola(graph, x);
    if (!Number.isFinite(y) || y < yLo - (yHi - yLo) || y > yHi + (yHi - yLo)) {
      flush();
      continue;
    }
    const cy = clampYForDraw(y, layout);
    if (cy == null) {
      flush();
      continue;
    }
    current.push({ x: canvasXFromValue(x, layout), y: cy });
  }
  flush();
  return branches;
}

export function clipHorizontal(
  q: number,
  layout: PlaneLayout,
): Vec[] | null {
  const yLo = dataYMin(layout);
  if (!inRange(q, yLo, layout.yMax)) return null;
  return [
    {
      x: canvasXFromValue(layout.xMin, layout),
      y: canvasYFromValue(q, layout),
    },
    {
      x: canvasXFromValue(layout.xMax, layout),
      y: canvasYFromValue(q, layout),
    },
  ];
}

function defaultGraphLabelPos(
  graph: QuadraticGraph,
  layout: PlaneLayout,
): Vec {
  if (isHorizontal(graph)) {
    return {
      x: layout.plotRight - 40,
      y: canvasYFromValue(graph.q, layout) - 14,
    };
  }
  const branches = sampleParabola(graph, layout);
  const pts = branches.flat();
  if (pts.length === 0) {
    return {
      x: (layout.plotLeft + layout.plotRight) / 2,
      y: layout.plotTop + 20,
    };
  }
  const t = 0.55;
  const idx = Math.min(pts.length - 1, Math.floor(pts.length * t));
  const p = pts[idx]!;
  const next = pts[Math.min(pts.length - 1, idx + 1)] ?? p;
  const dx = next.x - p.x;
  const dy = next.y - p.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const side = graph.a >= 0 ? -1 : 1;
  return {
    x: p.x + nx * 16 * side,
    y: p.y + ny * 16 * side,
  };
}

function pushArrow(
  cmds: SceneCmd[],
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  width: number,
  head = 8,
): void {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 2) return;
  const ux = dx / len;
  const uy = dy / len;
  const shorten = Math.min(head * 0.85, len * 0.4);
  cmds.push({
    t: "line",
    x1,
    y1,
    x2: x2 - ux * shorten,
    y2: y2 - uy * shorten,
    stroke: color,
    width,
  });
  cmds.push({
    t: "arrowhead",
    x: x2,
    y: y2,
    ux,
    uy,
    size: head,
    stroke: color,
  });
}

function tickCovers(
  value: number,
  tick: number,
  every: number,
  show: boolean,
): boolean {
  if (!show || Math.abs(value) < 1e-9) return false;
  const k = Math.round(value / tick);
  if (Math.abs(k * tick - value) > 1e-6) return false;
  return k % every === 0;
}

function drawTranslation(
  trans: Translation,
  from: QuadraticGraph,
  to: QuadraticGraph,
  state: QuadraticFunctionState,
  layout: PlaneLayout,
  cmds: SceneCmd[],
  texts: SceneText[],
): void {
  const yLo = dataYMin(layout);
  if (trans.kind === "vertex") {
    const v1 = vertexOf(from);
    const v2 = vertexOf(to);
    const cx1 = canvasXFromValue(v1.x, layout);
    const cy1 = canvasYFromValue(v1.y, layout);
    const cx2 = canvasXFromValue(v2.x, layout);
    const cy2 = canvasYFromValue(v2.y, layout);
    const midY = canvasYFromValue(v1.y, layout);
    pushArrow(cmds, cx1, cy1, cx2, midY, trans.color, 1.55, 7.5);
    pushArrow(cmds, cx2, midY, cx2, cy2, trans.color, 1.55, 7.5);
    if (trans.showDelta) {
      const dp = v2.x - v1.x;
      const dq = v2.y - v1.y;
      if (Math.abs(dp) > 1e-6) {
        pushText(texts, cmds, {
          id: `trans:${trans.id}:dp`,
          x: (cx1 + cx2) / 2 + trans.deltaDx,
          y: midY - 12 + trans.deltaDy,
          runs: parseMathRuns(interceptLabel(dp)),
          size: state.style.fontSize,
          anchor: "middle",
          fill: trans.color,
        });
      }
      if (Math.abs(dq) > 1e-6) {
        pushText(texts, cmds, {
          id: `trans:${trans.id}:dq`,
          x: cx2 + 14 + trans.deltaDx,
          y: (midY + cy2) / 2 + trans.deltaDy,
          runs: parseMathRuns(interceptLabel(dq)),
          size: state.style.fontSize,
          anchor: "start",
          fill: trans.color,
        });
      }
    }
    return;
  }

  if (trans.kind === "horizontal") {
    for (const y of trans.values) {
      if (!inRange(y, yLo, layout.yMax)) continue;
      for (const branch of ["left", "right"] as const) {
        const x1 = xAtY(from, y, branch);
        const x2 = xAtY(to, y, branch);
        if (x1 == null || x2 == null) continue;
        if (!inRange(x1, layout.xMin, layout.xMax)) continue;
        if (!inRange(x2, layout.xMin, layout.xMax)) continue;
        const px1 = canvasXFromValue(x1, layout);
        const px2 = canvasXFromValue(x2, layout);
        const py = canvasYFromValue(y, layout);
        pushArrow(cmds, px1, py, px2, py, trans.color, 1.55, 7.5);
      }
    }
    if (trans.showDelta && trans.values.length > 0) {
      const y = trans.values[Math.floor(trans.values.length / 2)]!;
      const x1 = xAtY(from, y, "right");
      const x2 = xAtY(to, y, "right");
      if (x1 != null && x2 != null) {
        const dp = x2 - x1;
        pushText(texts, cmds, {
          id: `trans:${trans.id}:delta`,
          x:
            (canvasXFromValue(x1, layout) + canvasXFromValue(x2, layout)) / 2 +
            trans.deltaDx,
          y: canvasYFromValue(y, layout) + 16 + trans.deltaDy,
          runs: parseMathRuns(interceptLabel(dp)),
          size: state.style.fontSize,
          anchor: "middle",
          fill: trans.color,
        });
      }
    }
    return;
  }

  for (const x of trans.values) {
    if (!inRange(x, layout.xMin, layout.xMax)) continue;
    const y1 = yOnParabola(from, x);
    const y2 = yOnParabola(to, x);
    if (!inRange(y1, yLo, layout.yMax) || !inRange(y2, yLo, layout.yMax)) {
      continue;
    }
    pushArrow(
      cmds,
      canvasXFromValue(x, layout),
      canvasYFromValue(y1, layout),
      canvasXFromValue(x, layout),
      canvasYFromValue(y2, layout),
      trans.color,
      1.55,
      7.5,
    );
  }
  if (trans.showDelta && trans.values.length > 0) {
    const midX = trans.values[Math.floor(trans.values.length / 2)]!;
    const y1 = yOnParabola(from, midX);
    const y2 = yOnParabola(to, midX);
    const label = interceptLabel(y2 - y1);
    pushText(texts, cmds, {
      id: `trans:${trans.id}:delta`,
      x: canvasXFromValue(midX, layout) + 12 + trans.deltaDx,
      y:
        (canvasYFromValue(y1, layout) + canvasYFromValue(y2, layout)) / 2 +
        trans.deltaDy,
      runs: parseMathRuns(label),
      size: state.style.fontSize,
      anchor: "start",
      fill: trans.color,
    });
  }
}

export function buildQuadraticFunctionScene(
  state: QuadraticFunctionState,
): QuadraticFunctionScene {
  const backdrop = buildCoordPlaneScene(toPlaneBackdrop(state));
  const layout = backdrop.layout;
  const cmds: SceneCmd[] = [...backdrop.cmds];
  const texts: SceneText[] = [...backdrop.texts];
  const ox = layout.originX;
  const oy = layout.originY;
  const dash = "#888888";

  for (const point of state.points) {
    const graph = state.graphs.find((g) => g.id === point.graphId);
    if (!graph) continue;
    const y = isHorizontal(graph) ? graph.q : yOnParabola(graph, point.x);
    const px = canvasXFromValue(point.x, layout);
    const py = canvasYFromValue(y, layout);
    if (point.dropX) {
      cmds.push({
        t: "line",
        x1: px,
        y1: py,
        x2: px,
        y2: oy,
        dashed: true,
        stroke: dash,
        width: 1.15,
      });
    }
    if (point.dropY) {
      cmds.push({
        t: "line",
        x1: px,
        y1: py,
        x2: ox,
        y2: py,
        dashed: true,
        stroke: dash,
        width: 1.15,
      });
    }
  }

  for (const graph of state.graphs) {
    const width = graphStrokeWidth(graph, state.style.graphWidth);
    if (isHorizontal(graph)) {
      const seg = clipHorizontal(graph.q, layout);
      if (seg) cmds.push({ t: "polyline", pts: seg, stroke: graph.color, width });
    } else {
      for (const branch of sampleParabola(graph, layout)) {
        cmds.push({ t: "polyline", pts: branch, stroke: graph.color, width });
      }
    }
  }

  for (const graph of state.graphs) {
    if (isHorizontal(graph)) continue;
    if (graph.showAxisOfSymmetry && inRange(graph.p, layout.xMin, layout.xMax)) {
      const px = canvasXFromValue(graph.p, layout);
      cmds.push({
        t: "line",
        x1: px,
        y1: layout.plotTop,
        x2: px,
        y2: layout.plotBottom,
        dashed: true,
        stroke: dash,
        width: 1.15,
      });
    }
    if (graph.showExtrema) {
      const yLo = dataYMin(layout);
      if (inRange(graph.q, yLo, layout.yMax)) {
        cmds.push({
          t: "line",
          x1: canvasXFromValue(layout.xMin, layout),
          y1: canvasYFromValue(graph.q, layout),
          x2: canvasXFromValue(layout.xMax, layout),
          y2: canvasYFromValue(graph.q, layout),
          dashed: true,
          stroke: graph.color,
          width: 1.2,
        });
      }
    }
  }

  for (const trans of state.translations) {
    const from = state.graphs.find((g) => g.id === trans.fromGraphId);
    const to = state.graphs.find((g) => g.id === trans.toGraphId);
    if (!from || !to) continue;
    drawTranslation(trans, from, to, state, layout, cmds, texts);
  }

  for (const graph of state.graphs) {
    if (isHorizontal(graph)) continue;
    const v = vertexOf(graph);
    const vx = canvasXFromValue(v.x, layout);
    const vy = canvasYFromValue(v.y, layout);
    if (graph.showVertexDrop) {
      cmds.push({
        t: "line",
        x1: vx,
        y1: vy,
        x2: vx,
        y2: oy,
        dashed: true,
        stroke: dash,
        width: 1.15,
      });
      cmds.push({
        t: "line",
        x1: vx,
        y1: vy,
        x2: ox,
        y2: vy,
        dashed: true,
        stroke: dash,
        width: 1.15,
      });
    }
  }

  for (const point of state.points) {
    const graph = state.graphs.find((g) => g.id === point.graphId);
    if (!graph) continue;
    const y = isHorizontal(graph) ? graph.q : yOnParabola(graph, point.x);
    const px = canvasXFromValue(point.x, layout);
    const py = canvasYFromValue(y, layout);
    if (point.showDot) {
      cmds.push({ t: "dot", x: px, y: py, r: state.style.pointRadius });
    }
    if (point.showName && point.name.trim()) {
      pushText(texts, cmds, {
        id: `point:${point.id}:name`,
        x: px + point.labelDx,
        y: py + point.labelDy,
        runs: parseNameRuns(point.name.trim()),
        size: state.style.pointLabelSize,
        anchor: "middle",
      });
    }
    if (point.axisMarkX) {
      if (
        !tickCovers(point.x, state.xTick, state.xLabelEvery, state.showTickLabels)
      ) {
        pushText(texts, cmds, {
          id: `point:${point.id}:axisX`,
          x: px,
          y: oy + 14,
          runs: parseMathRuns(interceptLabel(point.x)),
          size: state.style.fontSize,
          anchor: "middle",
        });
      }
    }
    if (point.axisMarkY && !isHorizontal(graph)) {
      if (
        !tickCovers(y, state.yTick, state.yLabelEvery, state.showTickLabels)
      ) {
        pushText(texts, cmds, {
          id: `point:${point.id}:axisY`,
          x: ox - 10,
          y: py,
          runs: parseMathRuns(interceptLabel(y)),
          size: state.style.fontSize,
          anchor: "end",
        });
      }
    }
  }

  for (const graph of state.graphs) {
    if (isHorizontal(graph)) continue;
    const v = vertexOf(graph);
    const vx = canvasXFromValue(v.x, layout);
    const vy = canvasYFromValue(v.y, layout);
    if (graph.showVertex) {
      cmds.push({ t: "dot", x: vx, y: vy, r: state.style.pointRadius });
    }
    if (graph.showVertexMarks) {
      if (
        Math.abs(v.x) > 1e-6 &&
        !tickCovers(v.x, state.xTick, state.xLabelEvery, state.showTickLabels)
      ) {
        pushText(texts, cmds, {
          id: `graph:${graph.id}:pMark`,
          x: vx + graph.pMarkDx,
          y: oy + graph.pMarkDy,
          runs: parseMathRuns(interceptLabel(v.x)),
          size: state.style.fontSize,
          anchor: "middle",
        });
      }
      if (
        Math.abs(v.y) > 1e-6 &&
        !tickCovers(v.y, state.yTick, state.yLabelEvery, state.showTickLabels)
      ) {
        if (graph.showExtrema) {
          cmds.push({
            t: "roundRect",
            x: ox + graph.qMarkDx - 18,
            y: vy + graph.qMarkDy - 14,
            w: 36,
            h: 28,
            r: 14,
            fill: EXTREMA_HIGHLIGHT,
          });
        }
        pushText(texts, cmds, {
          id: `graph:${graph.id}:qMark`,
          x: ox + graph.qMarkDx,
          y: vy + graph.qMarkDy,
          runs: parseMathRuns(interceptLabel(v.y)),
          size: state.style.fontSize,
          anchor: "end",
        });
      }
    }
    const xis = xIntercepts(graph);
    if (graph.showXIntercept) {
      for (let i = 0; i < xis.length; i += 1) {
        const xi = xis[i]!;
        if (Math.abs(xi) < 1e-6) continue;
        if (!inRange(xi, layout.xMin, layout.xMax)) continue;
        if (
          tickCovers(xi, state.xTick, state.xLabelEvery, state.showTickLabels)
        ) {
          continue;
        }
        pushText(texts, cmds, {
          id: `graph:${graph.id}:xi:${i}`,
          x: canvasXFromValue(xi, layout) + graph.xiLabelDx,
          y: oy + 14 + graph.xiLabelDy,
          runs: parseMathRuns(interceptLabel(xi)),
          size: state.style.fontSize,
          anchor: "middle",
        });
      }
    }
    const yi = yIntercept(graph);
    if (
      graph.showYIntercept &&
      yi != null &&
      Math.abs(yi) > 1e-6 &&
      inRange(0, layout.xMin, layout.xMax) &&
      inRange(yi, dataYMin(layout), layout.yMax)
    ) {
      pushText(texts, cmds, {
        id: `graph:${graph.id}:yi`,
        x: ox + 10 + graph.yiLabelDx,
        y: canvasYFromValue(yi, layout) + graph.yiLabelDy,
        runs: parseMathRuns(interceptLabel(yi)),
        size: state.style.fontSize,
        anchor: "start",
      });
    }
  }

  for (const graph of state.graphs) {
    const eq = quadraticEquationText(graph);
    if (!eq) continue;
    const pos = defaultGraphLabelPos(graph, layout);
    pushText(texts, cmds, {
      id: `graph:${graph.id}:eq`,
      x: pos.x + graph.labelDx,
      y: pos.y + graph.labelDy,
      runs: parseMathRuns(eq),
      size: state.style.equationSize,
      anchor: "middle",
    });
  }

  return {
    width: SCENE_WIDTH,
    height: SCENE_HEIGHT,
    cmds,
    texts,
    layout,
  };
}

export function nearestPointOnParabola(
  graph: QuadraticGraph,
  layout: PlaneLayout,
  canvasX: number,
  canvasY: number,
): { x: number; y: number; d: number } | null {
  if (isHorizontal(graph)) {
    const y = graph.q;
    const py = canvasYFromValue(y, layout);
    return {
      x: layout.xMin,
      y,
      d: Math.abs(py - canvasY),
    };
  }
  const x = layout.xMin;
  let bestX = x;
  let bestD = Infinity;
  const n = 200;
  for (let i = 0; i <= n; i += 1) {
    const tx =
      layout.xMin + ((layout.xMax - layout.xMin) * i) / n;
    const ty = yOnParabola(graph, tx);
    const px = canvasXFromValue(tx, layout);
    const py = canvasYFromValue(ty, layout);
    const d = Math.hypot(px - canvasX, py - canvasY);
    if (d < bestD) {
      bestD = d;
      bestX = tx;
    }
  }
  return { x: bestX, y: yOnParabola(graph, bestX), d: bestD };
}
