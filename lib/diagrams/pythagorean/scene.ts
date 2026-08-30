import { parseMathRuns, parseNameRuns } from "@/lib/diagrams/math-label";
import type {
  DiagramScene as SharedDiagramScene,
  SceneCmd,
  SceneText,
} from "@/lib/diagrams/scene";
import {
  add,
  clamp,
  len,
  mul,
  norm,
  sub,
} from "@/lib/diagrams/polygon/geometry";
import {
  emptyLabel,
  type MeasLabel,
  type PythagoreanState,
  type Vec,
} from "./model";
import {
  derivedPoints,
  displayName,
  figureStrokes,
  resolveSegText,
  segLength,
} from "./geometry";

export type SceneLayout = {
  canvas: Record<string, Vec>;
  origin: Vec;
  mid: Vec;
  scale: number;
};

export type PythagoreanScene = SharedDiagramScene & {
  layout: SceneLayout;
};

export const SCENE_WIDTH = 520;
export const SCENE_HEIGHT = 520;

const INK = "#111111";
const GRID = "#c5dff0";
const SQ_PINK = "#f5c6d6";
const SQ_BLUE = "#c5dff0";
const SQ_YELLOW = "#fce88a";
const PROOF_FILL = "#d4e8f5";

function pushText(texts: SceneText[], cmds: SceneCmd[], text: SceneText): void {
  texts.push(text);
  cmds.push({ t: "text", text });
}

function signedHeight(h: number, minAbs = 10, maxAbs = 140): number {
  if (!Number.isFinite(h)) return minAbs;
  const sign = h < 0 ? -1 : 1;
  return sign * clamp(Math.abs(h), minAbs, maxAbs);
}

function perpToward(along: Vec, toward: Vec): Vec {
  const dir = norm(along);
  let p: Vec = { x: -dir.y, y: dir.x };
  if (p.x * toward.x + p.y * toward.y < 0) p = { x: -p.x, y: -p.y };
  return p;
}

function sagittaArc(
  a: Vec,
  b: Vec,
  u: Vec,
  sagitta: number,
): { C: Vec; r: number; a0: number; a1: number; ccw: boolean } | null {
  const span = len(sub(b, a));
  const s = sagitta;
  if (span < 2 || Math.abs(s) < 0.75) return null;
  let n: Vec = { x: -norm(sub(b, a)).y, y: norm(sub(b, a)).x };
  if (n.x * u.x + n.y * u.y < 0) n = { x: -n.x, y: -n.y };
  const mid = mul(add(a, b), 0.5);
  const half = span / 2;
  const r = (half * half + s * s) / (2 * Math.abs(s));
  const C = add(mid, mul(n, s - Math.sign(s) * r));
  const a0 = Math.atan2(a.y - C.y, a.x - C.x);
  const a1 = Math.atan2(b.y - C.y, b.x - C.x);
  const peak = add(mid, mul(n, s));
  const ccwSpan = (from: number, to: number) => {
    let d = to - from;
    while (d < 0) d += Math.PI * 2;
    while (d >= Math.PI * 2) d -= Math.PI * 2;
    return d;
  };
  const sOnIncreasing = ccwSpan(a0, Math.atan2(peak.y - C.y, peak.x - C.x)) <= ccwSpan(a0, a1) + 1e-6;
  return { C, r, a0, a1, ccw: !sOnIncreasing };
}

function dimArc(
  cmds: SceneCmd[],
  texts: SceneText[],
  a: Vec,
  b: Vec,
  outward: Vec,
  offset: number,
  label: string | null,
  labelId: string,
  meas: MeasLabel,
  fontSize: number,
): void {
  if (!label) return;
  const along = norm(sub(b, a));
  const u = perpToward(along, outward);
  const span = len(sub(b, a));
  const mid = mul(add(a, b), 0.5);
  const margin = Math.min(span * 0.14, 26);
  const maxAlong = Math.max(span / 2 - margin, 0);
  const lineId = `${labelId}:line`;
  const textH = signedHeight(offset + meas.dy);
  const lineH = signedHeight(offset + meas.dy + (meas.lineDy ?? 0));
  const textAlong = clamp(meas.dx, -maxAlong, maxAlong);
  const lineSign = lineH < 0 ? -1 : 1;
  const tick = clamp(Math.abs(lineH) * 0.22, 4.5, 8);
  const aFoot = add(a, mul(u, lineSign * tick));
  const bFoot = add(b, mul(u, lineSign * tick));
  const sag = lineH - lineSign * tick;
  cmds.push({ t: "line", x1: a.x, y1: a.y, x2: aFoot.x, y2: aFoot.y, id: lineId });
  cmds.push({ t: "line", x1: b.x, y1: b.y, x2: bFoot.x, y2: bFoot.y, id: lineId });
  const arc = sagittaArc(aFoot, bFoot, u, sag);
  if (arc) {
    cmds.push({
      t: "arc",
      cx: arc.C.x,
      cy: arc.C.y,
      r: arc.r,
      a0: arc.a0,
      a1: arc.a1,
      ccw: arc.ccw,
      dashed: true,
      id: lineId,
    });
  } else {
    cmds.push({
      t: "line",
      x1: aFoot.x,
      y1: aFoot.y,
      x2: bFoot.x,
      y2: bFoot.y,
      dashed: true,
      id: lineId,
    });
  }
  const textSign = textH < 0 ? -1 : 1;
  const onSeg = add(mid, mul(along, textAlong));
  const tp = add(onSeg, mul(u, textH + textSign * fontSize * 0.52));
  pushText(texts, cmds, {
    id: labelId,
    x: tp.x,
    y: tp.y,
    runs: parseMathRuns(label),
    size: fontSize,
    anchor: "middle",
  });
}

function rightAngleSize(vertex: Vec, from: Vec, to: Vec): number {
  return clamp(Math.min(len(sub(from, vertex)), len(sub(to, vertex))) * 0.18, 10, 16);
}

function drawRightAngle(cmds: SceneCmd[], vertex: Vec, from: Vec, to: Vec): void {
  const u = norm(sub(from, vertex));
  const w = norm(sub(to, vertex));
  if (len(u) < 0.5 || len(w) < 0.5) return;
  cmds.push({
    t: "rightAngle",
    x: vertex.x,
    y: vertex.y,
    ux: u.x,
    uy: u.y,
    vx: w.x,
    vy: w.y,
    size: rightAngleSize(vertex, from, to),
  });
}

function squareOnSegment(P: Vec, Q: Vec, awayFrom: Vec): Vec[] {
  const dir = sub(Q, P);
  const side = len(dir);
  if (side < 1e-6) return [P, Q, Q, P];
  const d = norm(dir);
  const perpA = { x: -d.y, y: d.x };
  const perpB = { x: d.y, y: -d.x };
  const mid = mul(add(P, Q), 0.5);
  const toAway = sub(awayFrom, mid);
  const perp =
    perpA.x * toAway.x + perpA.y * toAway.y > 0 ? perpB : perpA;
  const n = norm(perp);
  const Q2 = add(Q, mul(n, side));
  const P2 = add(P, mul(n, side));
  return [P, Q, Q2, P2];
}

function mathPoints(state: PythagoreanState): Record<string, Vec> {
  if (state.kind === "rectangle") {
    const w = state.rectWidth;
    const h = state.rectSquare ? w : state.rectHeight;
    return {
      A: { x: 0, y: 0 },
      B: { x: w, y: 0 },
      C: { x: w, y: h },
      D: { x: 0, y: h },
    };
  }
  if (state.kind === "coordinate") {
    return { A: state.A, B: state.B, C: state.C };
  }
  if (state.kind === "proof") {
    const a = state.proofLegA;
    const b = state.proofLegB;
    return {
      _proofA: a,
      _proofB: b,
    } as unknown as Record<string, Vec>;
  }
  return derivedPoints(state);
}

function squareCornerPoints(state: PythagoreanState): Vec[] {
  const pts = derivedPoints(state);
  const { A, B, C } = pts;
  const interior = mul(add(add(A, B), C), 1 / 3);
  const sqBC = squareOnSegment(B, C, interior);
  const sqAC = squareOnSegment(C, A, interior);
  const sqAB = squareOnSegment(A, B, interior);
  return [...sqBC, ...sqAC, ...sqAB];
}

function mathBBox(state: PythagoreanState): { min: Vec; max: Vec } {
  if (state.kind === "proof") {
    const a = state.proofLegA;
    const b = state.proofLegB;
    const gap = state.proofView === "both" ? 1.2 : 0;
    return {
      min: { x: -0.5, y: -0.5 },
      max: { x: (a + b) * (state.proofView === "both" ? 2 : 1) + gap, y: a + b + 0.5 },
    };
  }
  const pts = Object.values(mathPoints(state));
  if (state.kind === "squares") {
    pts.push(...squareCornerPoints(state));
  }
  if (state.showGrid && state.kind !== "coordinate") {
    const pad = 2;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of pts) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    return {
      min: { x: Math.floor(minX - pad), y: Math.floor(minY - pad) },
      max: { x: Math.ceil(maxX + pad), y: Math.ceil(maxY + pad) },
    };
  }
  if (state.kind === "coordinate") {
    return {
      min: { x: state.coordMin - 0.5, y: state.coordMin - 0.5 },
      max: { x: state.coordMax + 0.5, y: state.coordMax + 0.5 },
    };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const pad = 0.22 * Math.max(maxX - minX, maxY - minY, 1);
  return {
    min: { x: minX - pad, y: minY - pad },
    max: { x: maxX + pad, y: maxY + pad },
  };
}

export function getSceneLayout(state: PythagoreanState): SceneLayout {
  const box = mathBBox(state);
  const mid = {
    x: (box.min.x + box.max.x) / 2,
    y: (box.min.y + box.max.y) / 2,
  };
  const spanX = Math.max(box.max.x - box.min.x, 0.8);
  const spanY = Math.max(box.max.y - box.min.y, 0.8);
  const pad = state.style.padding;
  const scale = Math.min(
    (SCENE_WIDTH - pad * 2) / spanX,
    (SCENE_HEIGHT - pad * 2) / spanY,
  );
  const origin = { x: SCENE_WIDTH / 2, y: SCENE_HEIGHT / 2 };
  const toCanvas = (p: Vec): Vec => ({
    x: origin.x + (p.x - mid.x) * scale,
    y: origin.y - (p.y - mid.y) * scale,
  });
  const canvas: Record<string, Vec> = {};
  for (const [id, p] of Object.entries(mathPoints(state))) {
    if (typeof (p as Vec).x === "number") canvas[id] = toCanvas(p as Vec);
  }
  return { canvas, origin, mid, scale };
}

export function mathToCanvas(p: Vec, layout: SceneLayout): Vec {
  return {
    x: layout.origin.x + (p.x - layout.mid.x) * layout.scale,
    y: layout.origin.y - (p.y - layout.mid.y) * layout.scale,
  };
}

export function canvasToMath(p: Vec, layout: SceneLayout): Vec {
  return {
    x: layout.mid.x + (p.x - layout.origin.x) / layout.scale,
    y: layout.mid.y - (p.y - layout.origin.y) / layout.scale,
  };
}

function gridPitch(span: number): number {
  if (span <= 12) return 1;
  if (span <= 24) return 2;
  return Math.max(5, Math.ceil(span / 12));
}

function appendGrid(cmds: SceneCmd[], layout: SceneLayout, min: number, max: number): void {
  const step = gridPitch(max - min);
  const x0 = Math.floor(min / step) * step;
  const x1 = Math.ceil(max / step) * step;
  for (let x = x0; x <= x1 + 1e-9; x += step) {
    const a = mathToCanvas({ x, y: min }, layout);
    const b = mathToCanvas({ x, y: max }, layout);
    cmds.push({
      t: "line",
      x1: a.x,
      y1: a.y,
      x2: b.x,
      y2: b.y,
      stroke: GRID,
      width: 1,
      id: "grid",
    });
  }
  for (let y = x0; y <= x1 + 1e-9; y += step) {
    const a = mathToCanvas({ x: min, y }, layout);
    const b = mathToCanvas({ x: max, y }, layout);
    cmds.push({
      t: "line",
      x1: a.x,
      y1: a.y,
      x2: b.x,
      y2: b.y,
      stroke: GRID,
      width: 1,
      id: "grid",
    });
  }
}

function drawDissection(
  cmds: SceneCmd[],
  sq: Vec[],
  tri: [Vec, Vec, Vec],
): void {
  const [P, Q, Q2, P2] = sq;
  const [Ta, Tb, Tc] = tri;
  const corners = [P, Q, Q2, P2];
  for (let i = 0; i < 4; i += 1) {
    const c = corners[i]!;
    const t0 = i % 3 === 0 ? Ta : i % 3 === 1 ? Tb : Tc;
    const t1 = i % 3 === 0 ? Tb : i % 3 === 1 ? Tc : Ta;
    cmds.push({
      t: "line",
      x1: c.x,
      y1: c.y,
      x2: t0.x,
      y2: t0.y,
      dashed: true,
      stroke: INK,
      width: 1,
    });
    cmds.push({
      t: "line",
      x1: c.x,
      y1: c.y,
      x2: t1.x,
      y2: t1.y,
      dashed: true,
      stroke: INK,
      width: 1,
    });
  }
}

function appendSquaresFigure(
  state: PythagoreanState,
  layout: SceneLayout,
  cmds: SceneCmd[],
  texts: SceneText[],
): void {
  const pts = derivedPoints(state);
  const { A, B, C } = pts;
  const interior = mul(add(add(A, B), C), 1 / 3);
  const toC = (p: Vec) => mathToCanvas(p, layout);
  const cA = toC(A);
  const cB = toC(B);
  const cC = toC(C);
  const sqBC = squareOnSegment(B, C, interior).map(toC);
  const sqAC = squareOnSegment(C, A, interior).map(toC);
  const sqAB = squareOnSegment(A, B, interior).map(toC);

  if (state.showFill) {
    cmds.push({ t: "polygon", points: sqBC, fill: SQ_PINK });
    cmds.push({ t: "polygon", points: sqAC, fill: SQ_BLUE });
    cmds.push({ t: "polygon", points: sqAB, fill: SQ_YELLOW });
  }
  for (const sq of [sqBC, sqAC, sqAB]) {
    cmds.push({ t: "polyline", pts: [...sq, sq[0]!], stroke: INK });
  }
  cmds.push({ t: "polyline", pts: [cA, cB, cC, cA], stroke: INK });

  if (state.showDissection) {
    drawDissection(cmds, sqAB, [cA, cB, cC]);
  }

  if (state.showRightAngle && state.rightVertex === "C") {
    drawRightAngle(cmds, cC, cB, cA);
  } else if (state.showRightAngle && state.rightVertex === "A") {
    drawRightAngle(cmds, cA, cB, cC);
  } else if (state.showRightAngle && state.rightVertex === "B") {
    drawRightAngle(cmds, cB, cA, cC);
  }

  if (state.showSquareLabels) {
    const labels =
      state.squareLabelMode === "formula"
        ? ["$a^2$", "$b^2$", "$c^2$"]
        : ["ㄱ", "ㄴ", "ㄷ"];
    const centers = [
      mul(add(add(sqBC[0]!, sqBC[2]!), sqBC[1]!), 1 / 3),
      mul(add(add(sqAC[0]!, sqAC[2]!), sqAC[1]!), 1 / 3),
      mul(add(add(sqAB[0]!, sqAB[2]!), sqAB[1]!), 1 / 3),
    ];
    labels.forEach((label, i) => {
      const cen = centers[i]!;
      pushText(texts, cmds, {
        id: `sq:${i}`,
        x: cen.x,
        y: cen.y,
        runs: parseMathRuns(label),
        size: state.style.fontSize,
        anchor: "middle",
      });
    });
  }
}

function appendProofFigure(
  state: PythagoreanState,
  layout: SceneLayout,
  cmds: SceneCmd[],
  texts: SceneText[],
  offsetX: number,
  variant: "inner" | "tiles",
): void {
  const a = state.proofLegA;
  const b = state.proofLegB;
  const c = Math.hypot(a, b);
  const shift = (p: Vec): Vec => ({ x: p.x + offsetX, y: p.y });
  const toC = (p: Vec) => mathToCanvas(shift(p), layout);

  const O = { x: 0, y: 0 };
  const R = { x: a + b, y: 0 };
  const T = { x: a + b, y: a + b };
  const L = { x: 0, y: a + b };

  if (variant === "inner") {
    cmds.push({
      t: "polyline",
      pts: [toC(O), toC(R), toC(T), toC(L), toC(O)],
      stroke: INK,
    });
    const tri = (p0: Vec, p1: Vec, p2: Vec) =>
      cmds.push({ t: "polyline", pts: [toC(p0), toC(p1), toC(p2), toC(p0)], stroke: INK });
    tri(O, { x: a, y: 0 }, { x: 0, y: b });
    tri({ x: a, y: 0 }, R, { x: a + b, y: b });
    tri({ x: a + b, y: b }, T, { x: b, y: a + b });
    tri({ x: b, y: a + b }, L, { x: 0, y: b });
    const inner = [
      toC({ x: a, y: 0 }),
      toC(R),
      toC({ x: a + b, y: b }),
      toC({ x: b, y: a + b }),
    ];
    if (state.showFill) cmds.push({ t: "polygon", points: inner, fill: PROOF_FILL });
    cmds.push({ t: "polyline", pts: [...inner, inner[0]!], stroke: INK });
    if (state.showRightAngle) {
      drawRightAngle(cmds, toC(O), toC({ x: a, y: 0 }), toC({ x: 0, y: b }));
      drawRightAngle(cmds, toC(R), toC({ x: a + b, y: b }), toC({ x: a, y: 0 }));
    }
    dimArc(cmds, texts, toC(O), toC({ x: a, y: 0 }), { x: 0, y: -1 }, state.style.dimOffset, "$a$", "s:proofA", emptyMeas(), state.style.fontSize);
    dimArc(cmds, texts, toC({ x: a, y: 0 }), toC(R), { x: 0, y: -1 }, state.style.dimOffset, "$b$", "s:proofB", emptyMeas(), state.style.fontSize);
    dimArc(cmds, texts, inner[0]!, inner[1]!, { x: 0, y: 1 }, state.style.dimOffset, "$c$", "s:proofC", emptyMeas(), state.style.fontSize);
  } else {
    cmds.push({
      t: "polyline",
      pts: [toC(O), toC(R), toC(T), toC(L), toC(O)],
      stroke: INK,
    });
    if (state.showFill) {
      cmds.push({
        t: "polygon",
        points: [toC(O), toC({ x: a, y: 0 }), toC({ x: a, y: b }), toC({ x: 0, y: b })],
        fill: PROOF_FILL,
      });
      cmds.push({
        t: "polygon",
        points: [toC({ x: a, y: b }), toC({ x: a + b, y: b }), toC({ x: a + b, y: a + b }), toC({ x: b, y: a + b })],
        fill: PROOF_FILL,
      });
    }
    cmds.push({
      t: "line",
      x1: toC({ x: a, y: 0 }).x,
      y1: toC({ x: a, y: 0 }).y,
      x2: toC({ x: a, y: a + b }).x,
      y2: toC({ x: a, y: a + b }).y,
    });
    cmds.push({
      t: "line",
      x1: toC({ x: 0, y: b }).x,
      y1: toC({ x: 0, y: b }).y,
      x2: toC({ x: a + b, y: b }).x,
      y2: toC({ x: a + b, y: b }).y,
    });
    cmds.push({
      t: "line",
      x1: toC(O).x,
      y1: toC(O).y,
      x2: toC({ x: a, y: b }).x,
      y2: toC({ x: a, y: b }).y,
      stroke: INK,
    });
    cmds.push({
      t: "line",
      x1: toC({ x: a + b, y: b }).x,
      y1: toC({ x: a + b, y: b }).y,
      x2: toC({ x: b, y: a + b }).x,
      y2: toC({ x: b, y: a + b }).y,
      stroke: INK,
    });
    if (state.showRightAngle) {
      drawRightAngle(cmds, toC(O), toC({ x: a, y: 0 }), toC({ x: 0, y: b }));
      drawRightAngle(cmds, toC({ x: a, y: 0 }), toC({ x: a, y: b }), toC(O));
    }
  }
}

function emptyMeas(): MeasLabel {
  return emptyLabel("auto");
}

function appendCoordinateFigure(
  state: PythagoreanState,
  layout: SceneLayout,
  cmds: SceneCmd[],
  texts: SceneText[],
): void {
  const min = state.coordMin;
  const max = state.coordMax;
  if (state.showGrid) appendGrid(cmds, layout, min, max);

  const axisColor = INK;
  const xAxisA = mathToCanvas({ x: min, y: 0 }, layout);
  const xAxisB = mathToCanvas({ x: max, y: 0 }, layout);
  const yAxisA = mathToCanvas({ x: 0, y: min }, layout);
  const yAxisB = mathToCanvas({ x: 0, y: max }, layout);
  cmds.push({ t: "line", x1: xAxisA.x, y1: xAxisA.y, x2: xAxisB.x, y2: xAxisB.y, stroke: axisColor });
  cmds.push({ t: "line", x1: yAxisA.x, y1: yAxisA.y, x2: yAxisB.x, y2: yAxisB.y, stroke: axisColor });

  const { A, B, C } = state;
  const cA = mathToCanvas(A, layout);
  const cB = mathToCanvas(B, layout);
  const cC = mathToCanvas(C, layout);
  cmds.push({ t: "polyline", pts: [cA, cB, cC, cA], stroke: INK });

  if (state.showAxisDrops) {
    cmds.push({
      t: "line",
      x1: cA.x,
      y1: cA.y,
      x2: mathToCanvas({ x: A.x, y: 0 }, layout).x,
      y2: mathToCanvas({ x: A.x, y: 0 }, layout).y,
      dashed: true,
      stroke: "#888",
    });
    cmds.push({
      t: "line",
      x1: cC.x,
      y1: cC.y,
      x2: mathToCanvas({ x: 0, y: C.y }, layout).x,
      y2: mathToCanvas({ x: 0, y: C.y }, layout).y,
      dashed: true,
      stroke: "#888",
    });
  }

  const rv = state.rightVertex;
  if (state.showRightAngle) {
    if (rv === "A") drawRightAngle(cmds, cA, cB, cC);
    else if (rv === "B") drawRightAngle(cmds, cB, cA, cC);
    else drawRightAngle(cmds, cC, cB, cA);
  }
}

function centroidOf(ids: string[], canvas: Record<string, Vec>): Vec {
  let x = 0;
  let y = 0;
  let n = 0;
  for (const id of ids) {
    const p = canvas[id];
    if (!p) continue;
    x += p.x;
    y += p.y;
    n += 1;
  }
  if (n === 0) return { x: SCENE_WIDTH / 2, y: SCENE_HEIGHT / 2 };
  return { x: x / n, y: y / n };
}

export function buildPythagoreanScene(state: PythagoreanState): PythagoreanScene {
  const layout = getSceneLayout(state);
  const { canvas } = layout;
  const { style } = state;
  const cmds: SceneCmd[] = [];
  const texts: SceneText[] = [];

  if (state.showGrid && (state.kind === "squares" || state.kind === "triangle")) {
    const box = mathBBox(state);
    appendGrid(cmds, layout, box.min.x, box.max.y);
  }

  if (state.kind === "squares") {
    appendSquaresFigure(state, layout, cmds, texts);
  } else if (state.kind === "proof") {
    if (state.proofView === "both") {
      appendProofFigure(state, layout, cmds, texts, 0, "inner");
      appendProofFigure(state, layout, cmds, texts, state.proofLegA + state.proofLegB + 1.2, "tiles");
    } else if (state.proofView === "inner") {
      appendProofFigure(state, layout, cmds, texts, 0, "inner");
    } else {
      appendProofFigure(state, layout, cmds, texts, 0, "tiles");
    }
  } else if (state.kind === "coordinate") {
    appendCoordinateFigure(state, layout, cmds, texts);
  } else {
    const strokes = figureStrokes(state);
    for (const [a, b] of strokes) {
      const pa = canvas[a];
      const pb = canvas[b];
      if (!pa || !pb) continue;
      cmds.push({ t: "line", x1: pa.x, y1: pa.y, x2: pb.x, y2: pb.y, stroke: INK });
    }

    const rv = state.rightVertex;
    if (state.showRightAngle) {
      if (state.kind === "altitude" && rv === "A") {
        const cA = canvas.A!;
        const cB = canvas.B!;
        const cC = canvas.C!;
        const cD = canvas.D!;
        drawRightAngle(cmds, cA, cB, cC);
        drawRightAngle(cmds, cD, cA, cB);
      } else if (rv === "C" && canvas.C && canvas.B && canvas.A) {
        drawRightAngle(cmds, canvas.C, canvas.B, canvas.A);
      } else if (rv === "A" && canvas.A && canvas.B && canvas.C) {
        drawRightAngle(cmds, canvas.A, canvas.B, canvas.C);
      } else if (rv === "B" && canvas.B && canvas.A && canvas.C) {
        drawRightAngle(cmds, canvas.B, canvas.A, canvas.C);
      }
    }

    if (state.kind === "rectangle" && state.showRightAngle) {
      for (const [v, f, t] of [
        ["A", "B", "D"],
        ["B", "A", "C"],
        ["C", "B", "D"],
        ["D", "A", "C"],
      ] as const) {
        const cv = canvas[v];
        const cf = canvas[f];
        const ct = canvas[t];
        if (cv && cf && ct) drawRightAngle(cmds, cv, cf, ct);
      }
    }
  }

  const faceCenter = centroidOf(["A", "B", "C"], canvas);
  for (const seg of state.segs) {
    if (!seg.show) continue;
    const a = canvas[seg.a];
    const b = canvas[seg.b];
    if (!a || !b) continue;
    const mid = mul(add(a, b), 0.5);
    const outward = sub(mid, faceCenter);
    const label = resolveSegText(state, seg);
    dimArc(
      cmds,
      texts,
      a,
      b,
      outward,
      style.dimOffset,
      label,
      `s:${seg.id}`,
      seg.label,
      style.fontSize,
    );
  }

  for (const id of Object.keys(canvas)) {
    if (id.startsWith("_")) continue;
    const p = canvas[id]!;
    if (state.showDots) {
      cmds.push({ t: "dot", x: p.x, y: p.y, r: style.pointRadius });
    }
    if (!state.showVertexNames) continue;
    const nm = displayName(state, id);
    if (!nm) continue;
    const mark = state.names[id];
    const away = norm(sub(p, faceCenter));
    const lp = add(add(p, mul(away, 16)), { x: mark?.dx ?? 0, y: mark?.dy ?? 0 });
    pushText(texts, cmds, {
      id: `n:${id}`,
      x: lp.x,
      y: lp.y,
      runs: parseNameRuns(nm),
      size: style.pointLabelSize,
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
