import { parseMathRuns } from "@/lib/diagrams/math-label";
import type { DiagramScene as SharedDiagramScene, SceneCmd, SceneText } from "@/lib/diagrams/scene";
import {
  edgeKey,
  familyIsRound,
  resolveLabelText,
  type MeasLabel,
  type SolidSketchState,
} from "./model";
import {
  backArcThrough,
  cameraFromView,
  circleFacingCamera,
  fillGray,
  fitProjected,
  hiddenEdgeKeys,
  isFrontFace,
  faceOutward,
  project3,
  projectCircle,
  silhouetteThetas,
  toCanvas,
  type Cam,
  type Fit,
  type Proj,
} from "./project";
import {
  buildSolidMesh,
  circleBasis,
  firstBaseEdgeLength,
  pointOnCircle,
  slantLength,
  type Circle3,
  type SolidMesh,
} from "./solids";
import { add3, mul3, norm3, sub3, type Vec3 } from "./vec3";

export type SolidScene = SharedDiagramScene & {
  layout: SolidLayout;
};

export const SCENE_WIDTH = 520;
export const SCENE_HEIGHT = 520;

export type SolidEdge = {
  key: string;
  a: number;
  b: number;
  hidden: boolean;
};

export type SolidLayout = {
  cam: Cam;
  fit: Fit;
  vertices: { x: number; y: number }[];
  names: string[];
  edges: SolidEdge[];
  centers: { id: string; p: { x: number; y: number } }[];
  mesh: SolidMesh;
};

type Vec = { x: number; y: number };

function add(a: Vec, b: Vec): Vec {
  return { x: a.x + b.x, y: a.y + b.y };
}
function sub(a: Vec, b: Vec): Vec {
  return { x: a.x - b.x, y: a.y - b.y };
}
function mul(a: Vec, s: number): Vec {
  return { x: a.x * s, y: a.y * s };
}
function len(a: Vec): number {
  return Math.hypot(a.x, a.y);
}
function norm(a: Vec): Vec {
  const l = len(a);
  if (l < 1e-9) return { x: 1, y: 0 };
  return { x: a.x / l, y: a.y / l };
}
function dot(a: Vec, b: Vec): number {
  return a.x * b.x + a.y * b.y;
}
function perpToward(along: Vec, toward: Vec): Vec {
  const dir = norm(along);
  let p: Vec = { x: -dir.y, y: dir.x };
  if (dot(p, toward) < 0) p = { x: -p.x, y: -p.y };
  return p;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function signedHeight(h: number, minAbs = 10, maxAbs = 140): number {
  if (!Number.isFinite(h)) return minAbs;
  const sign = h < 0 ? -1 : 1;
  return sign * clamp(Math.abs(h), minAbs, maxAbs);
}

function pushText(texts: SceneText[], cmds: SceneCmd[], text: SceneText): void {
  texts.push(text);
  cmds.push({ t: "text", text });
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
  const n = perpToward(sub(b, a), u);
  const mid = mul(add(a, b), 0.5);
  const half = span / 2;
  const r = (half * half + s * s) / (2 * Math.abs(s));
  const C = add(mid, mul(n, s - Math.sign(s) * r));
  const a0 = Math.atan2(a.y - C.y, a.x - C.x);
  const a1 = Math.atan2(b.y - C.y, b.x - C.x);
  const peak = add(mid, mul(n, s));
  const aS = Math.atan2(peak.y - C.y, peak.x - C.x);
  const ccwSpan = (from: number, to: number) => {
    let d = ((to - from) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    return d;
  };
  const sOnIncreasing = ccwSpan(a0, aS) <= ccwSpan(a0, a1) + 1e-6;
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

function collectFitPoints(mesh: SolidMesh, cam: Cam): Proj[] {
  const pts: Proj[] = mesh.vertices.map((p) => project3(p, cam));
  for (const circle of mesh.circles) {
    pts.push(project3(circle.center, cam));
    for (let i = 0; i < 12; i++) {
      pts.push(project3(pointOnCircle(circle, (i * Math.PI) / 6), cam));
    }
  }
  if (mesh.apexIndex == null && mesh.baseCenter) pts.push(project3(mesh.baseCenter, cam));
  if (mesh.topCenter) pts.push(project3(mesh.topCenter, cam));
  return pts;
}

function canvasMap(fit: Fit) {
  return (p: Proj) => toCanvas(p, fit);
}

function sampleEllipse(
  ellipse: { cx: number; cy: number; ux: number; uy: number; vx: number; vy: number },
  n = 32,
): Vec[] {
  const pts: Vec[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i * Math.PI * 2) / n;
    pts.push({
      x: ellipse.cx + ellipse.ux * Math.cos(t) + ellipse.vx * Math.sin(t),
      y: ellipse.cy + ellipse.uy * Math.cos(t) + ellipse.vy * Math.sin(t),
    });
  }
  return pts;
}

function baseEdgeIndices(mesh: SolidMesh, state: SolidSketchState): [number, number] | null {
  if (mesh.vertices.length < 2) return null;
  if (state.family === "prism" || state.family === "frustum") {
    const n = state.sides;
    return [n, n + 1];
  }
  if (state.family === "pyramid") return [0, 1];
  if (state.family === "platonic") {
    const e = mesh.edges[0];
    return e ? [e[0], e[1]] : [0, 1];
  }
  return null;
}

function radiusPoint(circle: Circle3, cam: Cam): Vec3 {
  const sil = silhouetteThetas(circle, cam);
  if (sil) return pointOnCircle(circle, sil.t0);
  const { u } = circleBasis(circle.normal);
  return add3(circle.center, mul3(u, circle.radius));
}

function drawCircleRim(
  cmds: SceneCmd[],
  circle: Circle3,
  cam: Cam,
  map: (p: Proj) => Vec,
  showHidden: boolean,
  showFill: boolean,
): void {
  const ellipse = projectCircle(circle, cam, map);
  const facing = circleFacingCamera(circle, cam);
  if (showFill && facing) {
    cmds.push({ t: "polygon", points: sampleEllipse(ellipse), fill: fillGray(circle.normal, cam) });
  }
  const sil = silhouetteThetas(circle, cam);
  if (facing || !sil) {
    cmds.push({
      t: "ellipseArc",
      cx: ellipse.cx,
      cy: ellipse.cy,
      ux: ellipse.ux,
      uy: ellipse.uy,
      vx: ellipse.vx,
      vy: ellipse.vy,
      a0: 0,
      a1: Math.PI * 2,
    });
    return;
  }
  const { t0, t1 } = sil;
  const firstIsBack = backArcThrough(circle, cam, t0, t1);
  const back0 = firstIsBack ? t0 : t1;
  const back1 = firstIsBack ? t1 : t0 + Math.PI * 2;
  const front0 = firstIsBack ? t1 : t0;
  const front1 = firstIsBack ? t0 + Math.PI * 2 : t1;
  cmds.push({
    t: "ellipseArc",
    ...ellipse,
    a0: front0,
    a1: front1,
  });
  if (showHidden) {
    cmds.push({
      t: "ellipseArc",
      ...ellipse,
      a0: back0,
      a1: back1,
      dashed: true,
    });
  }
}

function drawGenerators(
  cmds: SceneCmd[],
  mesh: SolidMesh,
  cam: Cam,
  map: (p: Proj) => Vec,
  showFill: boolean,
): void {
  const circles = mesh.circles;
  if (circles.length === 0) return;
  const base = circles.find((c) => c.id === "base") ?? circles[0]!;
  const sil = silhouetteThetas(base, cam);
  if (!sil) return;
  const p0 = pointOnCircle(base, sil.t0);
  const p1 = pointOnCircle(base, sil.t1);
  const q0 =
    mesh.apexIndex != null
      ? mesh.vertices[mesh.apexIndex]!
      : circles.find((c) => c.id === "top")
        ? pointOnCircle(circles.find((c) => c.id === "top")!, sil.t0)
        : null;
  const q1 =
    mesh.apexIndex != null
      ? mesh.vertices[mesh.apexIndex]!
      : circles.find((c) => c.id === "top")
        ? pointOnCircle(circles.find((c) => c.id === "top")!, sil.t1)
        : null;
  if (!q0 || !q1) return;
  const A = map(project3(p0, cam));
  const B = map(project3(p1, cam));
  const C = map(project3(q0, cam));
  const D = map(project3(q1, cam));
  if (showFill) {
    const sideN = mesh.axis ?? { x: 0, y: 1, z: 0 };
    cmds.push({
      t: "polygon",
      points: mesh.apexIndex != null ? [A, B, C] : [A, B, D, C],
      fill: fillGray(sideN, cam),
    });
  }
  cmds.push({ t: "line", x1: A.x, y1: A.y, x2: C.x, y2: C.y });
  cmds.push({ t: "line", x1: B.x, y1: B.y, x2: D.x, y2: D.y });
}

export function buildSolidSketchScene(state: SolidSketchState): SolidScene {
  const width = SCENE_WIDTH;
  const height = SCENE_HEIGHT;
  const cam = cameraFromView(state.azimuthDeg, state.elevationDeg);
  const mesh = buildSolidMesh(state);
  const fit = fitProjected(collectFitPoints(mesh, cam), width, height, state.style.padding);
  const map = canvasMap(fit);
  const verts2 = mesh.vertices.map((p) => map(project3(p, cam)));
  const hidden = hiddenEdgeKeys(mesh, cam);
  const edges: SolidEdge[] = mesh.edges.map(([a, b]) => ({
    key: edgeKey(a, b),
    a,
    b,
    hidden: hidden.has(edgeKey(a, b)),
  }));

  const cmds: SceneCmd[] = [];
  const texts: SceneText[] = [];
  const { style } = state;

  if (state.showFill) {
    for (const face of mesh.faces) {
      const n = faceOutward(mesh.vertices, face);
      if (!isFrontFace(n, cam)) continue;
      cmds.push({
        t: "polygon",
        points: face.map((i) => verts2[i]!),
        fill: fillGray(n, cam),
      });
    }
  }

  if (familyIsRound(state.family)) {
    drawGenerators(cmds, mesh, cam, map, state.showFill);
    for (const circle of mesh.circles) {
      drawCircleRim(cmds, circle, cam, map, state.showHidden, state.showFill);
    }
  }

  const hiddenEdges = edges.filter((e) => e.hidden);
  const visibleEdges = edges.filter((e) => !e.hidden);
  if (state.showHidden) {
    for (const e of hiddenEdges) {
      const a = verts2[e.a]!;
      const b = verts2[e.b]!;
      cmds.push({ t: "line", x1: a.x, y1: a.y, x2: b.x, y2: b.y, dashed: true });
    }
  }
  for (const e of visibleEdges) {
    const a = verts2[e.a]!;
    const b = verts2[e.b]!;
    cmds.push({ t: "line", x1: a.x, y1: a.y, x2: b.x, y2: b.y });
  }

  const centers: { id: string; p: Vec }[] = [];
  const baseC = mesh.baseCenter ? map(project3(mesh.baseCenter, cam)) : null;
  const topC = mesh.topCenter ? map(project3(mesh.topCenter, cam)) : null;
  if (state.showCenter && baseC) {
    cmds.push({ t: "dot", x: baseC.x, y: baseC.y, r: style.pointRadius });
    centers.push({ id: "base", p: baseC });
    pushText(texts, cmds, {
      id: "center-name",
      x: baseC.x - 14,
      y: baseC.y + 14,
      runs: parseMathRuns("O"),
      size: style.pointLabelSize,
      anchor: "middle",
    });
  }

  if (state.showVertexNames) {
    const cloud = verts2.length
      ? {
          x: verts2.reduce((s, p) => s + p.x, 0) / verts2.length,
          y: verts2.reduce((s, p) => s + p.y, 0) / verts2.length,
        }
      : { x: width / 2, y: height / 2 };
    mesh.vertices.forEach((_, i) => {
      const p = verts2[i]!;
      cmds.push({ t: "dot", x: p.x, y: p.y, r: style.pointRadius });
      const name = mesh.names[i]?.trim();
      if (!name) return;
      const away = norm(sub(p, cloud));
      const pos = add(add(p, mul(away, 14)), {
        x: state.nameDx[i] ?? 0,
        y: state.nameDy[i] ?? 0,
      });
      pushText(texts, cmds, {
        id: `vertex:${i}`,
        x: pos.x,
        y: pos.y,
        runs: parseMathRuns(name),
        size: style.pointLabelSize,
        anchor: "middle",
      });
    });
  }

  const outwardUp = { x: 0, y: -1 };
  const unit = state.unit;
  const unk = state.unknownLetter;

  if (state.showHeight && mesh.baseCenter) {
    const top3 =
      mesh.apexIndex != null
        ? mesh.vertices[mesh.apexIndex]!
        : mesh.topCenter;
    if (top3) {
      const a = map(project3(mesh.baseCenter, cam));
      const b = map(project3(top3, cam));
      cmds.push({
        t: "line",
        x1: a.x,
        y1: a.y,
        x2: b.x,
        y2: b.y,
        dashed: true,
        id: "height:line",
      });
      const txt = resolveLabelText(state.heightLabel, state.height, unit, unk);
      dimArc(cmds, texts, a, b, outwardUp, style.dimOffset, txt, "height", state.heightLabel, style.fontSize);
      if (state.showHeightRightAngle && mesh.axis) {
        const { u } = circleBasis(mesh.axis);
        const foot = map(project3(mesh.baseCenter, cam));
        const up2 = sub(map(project3(add3(mesh.baseCenter, norm3(mesh.axis)), cam)), foot);
        const side2 = sub(map(project3(add3(mesh.baseCenter, u), cam)), foot);
        const uu = norm(up2);
        const vv = norm(side2);
        if (len(up2) > 2 && len(side2) > 2) {
          cmds.push({
            t: "rightAngle",
            x: foot.x,
            y: foot.y,
            ux: uu.x,
            uy: uu.y,
            vx: vv.x,
            vy: vv.y,
            size: style.rightAngleSize,
          });
        }
      }
    }
  }

  if (state.showRadius && mesh.circles[0]) {
    const circle = mesh.circles.find((c) => c.id === "base") ?? mesh.circles[0]!;
    const a3 = circle.center;
    const b3 = radiusPoint(circle, cam);
    const a = map(project3(a3, cam));
    const b = map(project3(b3, cam));
    cmds.push({ t: "line", x1: a.x, y1: a.y, x2: b.x, y2: b.y, dashed: true, id: "radius:line" });
    const txt = resolveLabelText(state.radiusLabel, state.radius, unit, unk);
    dimArc(cmds, texts, a, b, outwardUp, style.dimOffset, txt, "radius", state.radiusLabel, style.fontSize);
  }

  if (state.showSlant) {
    const slant = slantLength(state);
    let a3: Vec3 | null = null;
    let b3: Vec3 | null = null;
    if (mesh.apexIndex != null && mesh.circles[0]) {
      a3 = mesh.vertices[mesh.apexIndex]!;
      b3 = radiusPoint(mesh.circles[0], cam);
    } else if (mesh.apexIndex != null && mesh.vertices.length > 1) {
      a3 = mesh.vertices[mesh.apexIndex]!;
      b3 = mesh.vertices[0]!;
    }
    if (a3 && b3) {
      const a = map(project3(a3, cam));
      const b = map(project3(b3, cam));
      cmds.push({ t: "line", x1: a.x, y1: a.y, x2: b.x, y2: b.y, dashed: true, id: "slant:line" });
      const txt = resolveLabelText(state.slantLabel, slant, unit, unk);
      dimArc(cmds, texts, a, b, outwardUp, style.dimOffset, txt, "slant", state.slantLabel, style.fontSize);
    }
  }

  if (state.showBaseEdge) {
    const pair = baseEdgeIndices(mesh, state);
    if (pair) {
      const a = verts2[pair[0]!]!;
      const b = verts2[pair[1]!]!;
      const value = firstBaseEdgeLength(mesh, state);
      const txt = resolveLabelText(state.baseEdgeLabel, value, unit, unk);
      dimArc(cmds, texts, a, b, outwardUp, style.dimOffset, txt, "baseEdge", state.baseEdgeLabel, style.fontSize);
    }
  }

  for (const [key, label] of Object.entries(state.edgeLabels)) {
    const edge = edges.find((e) => e.key === key);
    if (!edge) continue;
    const a = verts2[edge.a]!;
    const b = verts2[edge.b]!;
    const value = edgeLength3(mesh, edge.a, edge.b);
    const txt = resolveLabelText(label, value, unit, unk);
    dimArc(cmds, texts, a, b, outwardUp, style.dimOffset, txt, `edge:${key}`, label, style.fontSize);
  }

  return {
    width,
    height,
    cmds,
    texts,
    layout: {
      cam,
      fit,
      vertices: verts2,
      names: mesh.names,
      edges,
      centers,
      mesh,
    },
  };
}

function edgeLength3(mesh: SolidMesh, a: number, b: number): number {
  const pa = mesh.vertices[a];
  const pb = mesh.vertices[b];
  if (!pa || !pb) return 0;
  return Math.hypot(pa.x - pb.x, pa.y - pb.y, pa.z - pb.z);
}
