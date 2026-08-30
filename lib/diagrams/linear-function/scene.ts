import { parseMathRuns, parseNameRuns } from "@/lib/diagrams/math-label";
import {
  graphStrokeWidth,
  interceptLabel,
  isVertical,
  linearEquationText,
  pointCoords,
  toPlaneBackdrop,
  yOnLine,
  xIntercept,
  yIntercept,
  type LinearFunctionState,
  type LinearGraph,
  type SlopeStep,
} from "@/lib/diagrams/linear-function/model";
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

export type LinearFunctionScene = CoordPlaneScene;

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

export function clipLinear(
  a: number,
  b: number,
  layout: PlaneLayout,
): Vec[] | null {
  const yLo = dataYMin(layout);
  const yHi = layout.yMax;
  const xLo = layout.xMin;
  const xHi = layout.xMax;
  const pts: { x: number; y: number }[] = [];

  function consider(x: number, y: number) {
    if (!inRange(x, xLo, xHi) || !inRange(y, yLo, yHi)) return;
    if (pts.some((p) => Math.hypot(p.x - x, p.y - y) < 1e-6)) return;
    pts.push({ x, y });
  }

  consider(xLo, a * xLo + b);
  consider(xHi, a * xHi + b);
  if (Math.abs(a) > 1e-12) {
    consider((yLo - b) / a, yLo);
    consider((yHi - b) / a, yHi);
  } else {
    consider(xLo, b);
    consider(xHi, b);
  }

  if (pts.length < 2) return null;
  pts.sort((p, q) => p.x - q.x || p.y - q.y);
  return [
    {
      x: canvasXFromValue(pts[0]!.x, layout),
      y: canvasYFromValue(pts[0]!.y, layout),
    },
    {
      x: canvasXFromValue(pts[pts.length - 1]!.x, layout),
      y: canvasYFromValue(pts[pts.length - 1]!.y, layout),
    },
  ];
}

export function clipGraph(
  graph: LinearGraph,
  layout: PlaneLayout,
): Vec[] | null {
  if (isVertical(graph)) {
    if (!inRange(graph.c, layout.xMin, layout.xMax)) return null;
    const yLo = dataYMin(layout);
    return [
      {
        x: canvasXFromValue(graph.c, layout),
        y: canvasYFromValue(yLo, layout),
      },
      {
        x: canvasXFromValue(graph.c, layout),
        y: canvasYFromValue(layout.yMax, layout),
      },
    ];
  }
  return clipLinear(graph.a, graph.b, layout);
}

function defaultGraphLabelPos(graph: LinearGraph, layout: PlaneLayout): Vec {
  const seg = clipGraph(graph, layout);
  if (!seg) {
    return {
      x: (layout.plotLeft + layout.plotRight) / 2,
      y: layout.plotTop + 20,
    };
  }
  if (isVertical(graph)) {
    return {
      x: seg[0]!.x + 16,
      y: seg[1]!.y + (seg[0]!.y - seg[1]!.y) * 0.18,
    };
  }
  if (Math.abs(graph.a) < 1e-9) {
    return {
      x: seg[0]!.x + (seg[1]!.x - seg[0]!.x) * 0.62,
      y: seg[0]!.y - 14,
    };
  }
  const t = 0.72;
  const x = seg[0]!.x + (seg[1]!.x - seg[0]!.x) * t;
  const y = seg[0]!.y + (seg[1]!.y - seg[0]!.y) * t;
  const dx = seg[1]!.x - seg[0]!.x;
  const dy = seg[1]!.y - seg[0]!.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const side = nx > 0 ? 1 : -1;
  return { x: x + nx * 14 * side, y: y + ny * 14 * side };
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

function slopeDelta(step: SlopeStep, graph: LinearGraph) {
  const y1 = yOnLine(graph, step.x1);
  const y2 = yOnLine(graph, step.x2);
  return { dx: step.x2 - step.x1, dy: y2 - y1, y1, y2 };
}

export function buildLinearFunctionScene(
  state: LinearFunctionState,
): LinearFunctionScene {
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
    const coords = pointCoords(graph, point);
    const px = canvasXFromValue(coords.x, layout);
    const py = canvasYFromValue(coords.y, layout);
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
    const seg = clipGraph(graph, layout);
    if (seg) {
      cmds.push({ t: "polyline", pts: seg, stroke: graph.color, width });
    }
  }

  for (const trans of state.translations) {
    const from = state.graphs.find((g) => g.id === trans.fromGraphId);
    const to = state.graphs.find((g) => g.id === trans.toGraphId);
    if (!from || !to || isVertical(from) || isVertical(to)) continue;
    const yLo = dataYMin(layout);
    for (const x of trans.xs) {
      const y1 = yOnLine(from, x);
      const y2 = yOnLine(to, x);
      if (!inRange(x, layout.xMin, layout.xMax)) continue;
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
    if (trans.showDelta && trans.xs.length > 0) {
      const midX = trans.xs[Math.floor(trans.xs.length / 2)]!;
      const y1 = yOnLine(from, midX);
      const y2 = yOnLine(to, midX);
      const label = interceptLabel(to.b - from.b);
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

  for (const step of state.slopeSteps) {
    const graph = state.graphs.find((g) => g.id === step.graphId);
    if (!graph || isVertical(graph)) continue;
    const { dx, dy, y1, y2 } = slopeDelta(step, graph);
    const p1x = canvasXFromValue(step.x1, layout);
    const p1y = canvasYFromValue(y1, layout);
    const cornerX = canvasXFromValue(step.x2, layout);
    const cornerY = canvasYFromValue(y1, layout);
    const p2x = canvasXFromValue(step.x2, layout);
    const p2y = canvasYFromValue(y2, layout);
    if (Math.abs(dx) > 1e-6) {
      pushArrow(cmds, p1x, p1y, cornerX, cornerY, step.color, 1.7, 8);
    }
    if (Math.abs(dy) > 1e-6) {
      pushArrow(cmds, cornerX, cornerY, p2x, p2y, step.color, 1.7, 8);
    }
    if (step.showDx && Math.abs(dx) > 1e-6) {
      const above = dy <= 0;
      pushText(texts, cmds, {
        id: `slope:${step.id}:dx`,
        x: (p1x + cornerX) / 2 + step.dxLabelDx,
        y: p1y + (above ? -12 : 14) + step.dxLabelDy,
        runs: parseMathRuns(interceptLabel(dx)),
        size: state.style.fontSize + 1,
        anchor: "middle",
        fill: step.color,
      });
    }
    if (step.showDy && Math.abs(dy) > 1e-6) {
      const right = dx >= 0;
      pushText(texts, cmds, {
        id: `slope:${step.id}:dy`,
        x: p2x + (right ? 12 : -12) + step.dyLabelDx,
        y: (cornerY + p2y) / 2 + step.dyLabelDy,
        runs: parseMathRuns(interceptLabel(dy)),
        size: state.style.fontSize + 1,
        anchor: right ? "start" : "end",
        fill: step.color,
      });
    }
  }

  for (const point of state.points) {
    const graph = state.graphs.find((g) => g.id === point.graphId);
    if (!graph) continue;
    const coords = pointCoords(graph, point);
    const px = canvasXFromValue(coords.x, layout);
    const py = canvasYFromValue(coords.y, layout);
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
      if (!tickCovers(coords.x, state.xTick, state.xLabelEvery, state.showTickLabels)) {
        pushText(texts, cmds, {
          id: `point:${point.id}:axisX`,
          x: px,
          y: oy + 14,
          runs: parseMathRuns(interceptLabel(coords.x)),
          size: state.style.fontSize,
          anchor: "middle",
        });
      }
    }
    if (point.axisMarkY) {
      if (!tickCovers(coords.y, state.yTick, state.yLabelEvery, state.showTickLabels)) {
        pushText(texts, cmds, {
          id: `point:${point.id}:axisY`,
          x: ox - 10,
          y: py,
          runs: parseMathRuns(interceptLabel(coords.y)),
          size: state.style.fontSize,
          anchor: "end",
        });
      }
    }
  }

  for (const graph of state.graphs) {
    const xi = xIntercept(graph);
    if (
      graph.showXIntercept &&
      xi != null &&
      Math.abs(xi) > 1e-6 &&
      inRange(xi, layout.xMin, layout.xMax)
    ) {
      if (!tickCovers(xi, state.xTick, state.xLabelEvery, state.showTickLabels)) {
        pushText(texts, cmds, {
          id: `graph:${graph.id}:xi`,
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
        runs: parseMathRuns(interceptLabel(graph.b)),
        size: state.style.fontSize,
        anchor: "start",
      });
    }
  }

  for (const graph of state.graphs) {
    const eq = linearEquationText(graph);
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
