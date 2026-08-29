import { parseMathRuns, parseNameRuns } from "@/lib/diagrams/math-label";
import type { DiagramScene as SharedDiagramScene, SceneCmd, SceneText } from "@/lib/diagrams/scene";
import {
  edgeKey,
  familyIsSmooth,
  familyIsSphere,
  resolveLabelText,
  vertexNameVisible,
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
  silRadial,
  thetaFromWorld,
  toCanvas,
  type Cam,
  type Fit,
  type Proj,
} from "./project";
import {
  buildSolidMesh,
  circleBasis,
  firstBaseEdgeLength,
  faceHeightLength,
  pointOnCircle,
  slantLength,
  type Circle3,
  type Hemisphere3,
  type SideBand,
  type SolidMesh,
} from "./solids";
import { add3, centroid3, cross3, dot3, mul3, norm3, sub3, type Vec3 } from "./vec3";

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

function pushRightAngle(
  cmds: SceneCmd[],
  origin: Vec3,
  dirU: Vec3,
  dirV: Vec3,
  cam: Cam,
  map: (p: Proj) => Vec,
  size: number,
): void {
  const foot = map(project3(origin, cam));
  const u2 = sub(map(project3(add3(origin, dirU), cam)), foot);
  const v2 = sub(map(project3(add3(origin, dirV), cam)), foot);
  if (len(u2) <= 2 || len(v2) <= 2) return;
  const uu = norm(u2);
  const vv = norm(v2);
  cmds.push({
    t: "rightAngle",
    x: foot.x,
    y: foot.y,
    ux: uu.x,
    uy: uu.y,
    vx: vv.x,
    vy: vv.y,
    size,
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
  if (mesh.sphereRadius != null && mesh.baseCenter) {
    const sil: Circle3 = {
      id: "base",
      center: mesh.baseCenter,
      normal: cam.eye,
      radius: mesh.sphereRadius,
    };
    for (let i = 0; i < 12; i++) {
      pts.push(project3(pointOnCircle(sil, (i * Math.PI) / 6), cam));
    }
  }
  for (const hemi of mesh.hemispheres ?? []) {
    pts.push(project3(add3(hemi.center, mul3(hemi.axis, hemi.radius)), cam));
    const sil: Circle3 = {
      id: "base",
      center: hemi.center,
      normal: cam.eye,
      radius: hemi.radius,
    };
    for (let i = 0; i < 12; i++) {
      pts.push(project3(pointOnCircle(sil, (i * Math.PI) / 6), cam));
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
  t0 = 0,
  t1 = Math.PI * 2,
): Vec[] {
  const pts: Vec[] = [];
  for (let i = 0; i <= n; i++) {
    const t = n === 0 ? t0 : t0 + ((t1 - t0) * i) / n;
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
  const dir = silRadial(circle.normal, cam);
  if (dir) return add3(circle.center, mul3(dir, circle.radius));
  const { u } = circleBasis(circle.normal);
  return add3(circle.center, mul3(u, circle.radius));
}

function slantEndpoints(
  state: SolidSketchState,
  mesh: SolidMesh,
  cam: Cam,
): { a3: Vec3; b3: Vec3 } | null {
  if (mesh.apexIndex != null && mesh.circles.length) {
    const rim =
      mesh.circles.find((c) => c.id === "join") ??
      mesh.circles.find((c) => c.id === "base") ??
      mesh.circles[0]!;
    return {
      a3: mesh.vertices[mesh.apexIndex]!,
      b3: radiusPoint(rim, cam),
    };
  }
  if (mesh.apexIndex != null && mesh.vertices.length > 1) {
    return { a3: mesh.vertices[mesh.apexIndex]!, b3: mesh.vertices[0]! };
  }
  if (state.family === "frustum") {
    const n = state.sides;
    const top = mesh.vertices[0];
    const bot = mesh.vertices[n];
    if (top && bot) return { a3: top, b3: bot };
  }
  if (state.family === "coneFrustum") {
    const base = mesh.circles.find((c) => c.id === "base");
    const top = mesh.circles.find((c) => c.id === "top");
    if (!base || !top) return null;
    const dir = silRadial(mesh.axis ?? base.normal, cam) ?? circleBasis(base.normal).u;
    return {
      a3: add3(base.center, mul3(dir, base.radius)),
      b3: add3(top.center, mul3(dir, top.radius)),
    };
  }
  return null;
}

function mid3(a: Vec3, b: Vec3): Vec3 {
  return mul3(add3(a, b), 0.5);
}

type FaceHeightSeg = {
  lower: Vec3;
  upper: Vec3;
  baseDir: Vec3;
  topDir: Vec3 | null;
  outward: Vec3;
};

function faceHeightSegment(
  state: SolidSketchState,
  mesh: SolidMesh,
  cam: Cam,
): FaceHeightSeg | null {
  if (state.family !== "pyramid" && state.family !== "frustum") return null;
  const n = state.sides;
  const verts = mesh.vertices;
  if (state.family === "pyramid" && (mesh.apexIndex == null || verts.length < n + 1)) {
    return null;
  }
  if (state.family === "frustum" && verts.length < n * 2) return null;

  let best: FaceHeightSeg | null = null;
  let bestDot = -Infinity;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    let pts: Vec3[];
    let lower: Vec3;
    let upper: Vec3;
    let baseDir: Vec3;
    let topDir: Vec3 | null;
    if (state.family === "pyramid") {
      const a = verts[i]!;
      const b = verts[j]!;
      const apex = verts[mesh.apexIndex!]!;
      pts = [apex, a, b];
      lower = mid3(a, b);
      upper = apex;
      baseDir = sub3(b, a);
      topDir = null;
    } else {
      const t0 = verts[i]!;
      const t1 = verts[j]!;
      const b0 = verts[n + i]!;
      const b1 = verts[n + j]!;
      pts = [t0, t1, b1, b0];
      lower = mid3(b0, b1);
      upper = mid3(t0, t1);
      baseDir = sub3(b1, b0);
      topDir = sub3(t1, t0);
    }
    let nrm = norm3(cross3(sub3(pts[1]!, pts[0]!), sub3(pts[2]!, pts[0]!)));
    const c = centroid3(pts);
    const radial = { x: c.x, y: 0, z: c.z };
    if (dot3(nrm, radial) < 0) nrm = mul3(nrm, -1);
    const d = dot3(nrm, cam.eye);
    if (d > bestDot) {
      bestDot = d;
      best = { lower, upper, baseDir, topDir, outward: nrm };
    }
  }
  return best;
}

function fillCircleDisk(
  cmds: SceneCmd[],
  circle: Circle3,
  cam: Cam,
  map: (p: Proj) => Vec,
): void {
  const ellipse = projectCircle(circle, cam, map);
  cmds.push({
    t: "polygon",
    points: sampleEllipse(ellipse),
    fill: fillGray(circle.normal, cam),
  });
}

function drawCircleRim(
  cmds: SceneCmd[],
  circle: Circle3,
  cam: Cam,
  map: (p: Proj) => Vec,
  showHidden: boolean,
  axis: Vec3 | null,
  splitHidden = false,
): void {
  const ellipse = projectCircle(circle, cam, map);
  const facing = circleFacingCamera(circle, cam);
  const dir = silRadial(axis ?? circle.normal, cam);
  if ((facing && !splitHidden) || !dir) {
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
  const t0 = thetaFromWorld(circle, add3(circle.center, mul3(dir, circle.radius)));
  const t1 = thetaFromWorld(circle, add3(circle.center, mul3(dir, -circle.radius)));
  let a0 = t0;
  let a1 = t1;
  while (a1 < a0) a1 += Math.PI * 2;
  if (a1 - a0 > Math.PI) {
    const tmp = a0;
    a0 = t1;
    a1 = t0 + Math.PI * 2;
  }
  const firstIsBack = backArcThrough(circle, cam, a0, a1);
  const back0 = firstIsBack ? a0 : a1;
  const back1 = firstIsBack ? a1 : a0 + Math.PI * 2;
  const front0 = firstIsBack ? a1 : a0;
  const front1 = firstIsBack ? a0 + Math.PI * 2 : a1;
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

function generatorCorners(
  mesh: SolidMesh,
  cam: Cam,
  map: (p: Proj) => Vec,
  band?: SideBand,
): { A: Vec; B: Vec; C: Vec; D: Vec; axis: Vec3; triangle: boolean } | null {
  const circles = mesh.circles;
  if (circles.length === 0) return null;
  const axis = mesh.axis ?? circles[0]!.normal;
  const dir = silRadial(axis, cam);
  if (!dir) return null;

  const silOf = (id: SideBand["lower"] | "apex"): [Vec3, Vec3] | null => {
    if (id === "apex") {
      if (mesh.apexIndex == null) return null;
      const p = mesh.vertices[mesh.apexIndex]!;
      return [p, p];
    }
    const circle = circles.find((c) => c.id === id) ?? (id === "base" ? circles[0] : undefined);
    if (!circle) return null;
    return [
      add3(circle.center, mul3(dir, circle.radius)),
      add3(circle.center, mul3(dir, -circle.radius)),
    ];
  };

  let lowerId: SideBand["lower"] | "apex" = "base";
  let upperId: SideBand["upper"] = mesh.apexIndex != null ? "apex" : "top";
  if (band) {
    lowerId = band.lower;
    upperId = band.upper;
  }
  const lo = silOf(lowerId);
  const hi = silOf(upperId);
  if (!lo || !hi) return null;
  return {
    A: map(project3(lo[0], cam)),
    B: map(project3(lo[1], cam)),
    C: map(project3(hi[0], cam)),
    D: map(project3(hi[1], cam)),
    axis,
    triangle: upperId === "apex" || lowerId === "apex",
  };
}

function meshBands(mesh: SolidMesh): SideBand[] {
  if (mesh.bands && mesh.bands.length > 0) return mesh.bands;
  if (mesh.circles.length === 0) return [];
  if (mesh.apexIndex != null) return [{ lower: "base", upper: "apex" }];
  if (mesh.circles.some((c) => c.id === "top")) return [{ lower: "base", upper: "top" }];
  return [];
}

function isHemiEquator(mesh: SolidMesh, circle: Circle3): boolean {
  return (mesh.hemispheres ?? []).some(
    (h) => Math.hypot(h.center.x - circle.center.x, h.center.y - circle.center.y, h.center.z - circle.center.z) < 1e-6,
  );
}

function fillRoundSolids(
  cmds: SceneCmd[],
  mesh: SolidMesh,
  cam: Cam,
  map: (p: Proj) => Vec,
): void {
  const skip = (c: Circle3) => c.id === "join" || isHemiEquator(mesh, c);
  const back = mesh.circles.filter((c) => !skip(c) && !circleFacingCamera(c, cam));
  const front = mesh.circles.filter((c) => !skip(c) && circleFacingCamera(c, cam));
  for (const circle of back) fillCircleDisk(cmds, circle, cam, map);
  for (const band of meshBands(mesh)) {
    const corners = generatorCorners(mesh, cam, map, band);
    if (!corners) continue;
    cmds.push({
      t: "polygon",
      points: corners.triangle
        ? [corners.A, corners.B, corners.C]
        : [corners.A, corners.B, corners.D, corners.C],
      fill: fillGray(corners.axis, cam),
    });
  }
  for (const circle of front) fillCircleDisk(cmds, circle, cam, map);
}

function drawGeneratorLines(
  cmds: SceneCmd[],
  mesh: SolidMesh,
  cam: Cam,
  map: (p: Proj) => Vec,
): void {
  for (const band of meshBands(mesh)) {
    const corners = generatorCorners(mesh, cam, map, band);
    if (!corners) continue;
    cmds.push({ t: "line", x1: corners.A.x, y1: corners.A.y, x2: corners.C.x, y2: corners.C.y });
    cmds.push({ t: "line", x1: corners.B.x, y1: corners.B.y, x2: corners.D.x, y2: corners.D.y });
  }
}

function hemisphereArcSpan(axis: Vec3, cam: Cam): { t0: number; t1: number } | null {
  const { u, v } = circleBasis(cam.eye);
  const a = dot3(u, axis);
  const b = dot3(v, axis);
  if (Math.hypot(a, b) < 1e-6) return null;
  const phi = Math.atan2(b, a);
  return { t0: phi - Math.PI / 2, t1: phi + Math.PI / 2 };
}

function drawHemisphere(
  cmds: SceneCmd[],
  hemi: Hemisphere3,
  cam: Cam,
  map: (p: Proj) => Vec,
  showFill: boolean,
  showHidden: boolean,
  equator: Circle3 | undefined,
): void {
  const sil: Circle3 = {
    id: "base",
    center: hemi.center,
    normal: cam.eye,
    radius: hemi.radius,
  };
  const ellipse = projectCircle(sil, cam, map);
  const span = hemisphereArcSpan(hemi.axis, cam);
  if (showFill) {
    if (equator) fillCircleDisk(cmds, equator, cam, map);
    if (span) {
      cmds.push({
        t: "polygon",
        points: sampleEllipse(ellipse, 24, span.t0, span.t1),
        fill: fillGray(hemi.axis, cam),
      });
    }
  }
  if (equator) {
    drawCircleRim(cmds, equator, cam, map, showHidden, equator.normal, true);
  }
  if (span) {
    cmds.push({
      t: "ellipseArc",
      cx: ellipse.cx,
      cy: ellipse.cy,
      ux: ellipse.ux,
      uy: ellipse.uy,
      vx: ellipse.vx,
      vy: ellipse.vy,
      a0: span.t0,
      a1: span.t1,
    });
  }
}

function drawSphere(
  cmds: SceneCmd[],
  mesh: SolidMesh,
  cam: Cam,
  map: (p: Proj) => Vec,
  showFill: boolean,
  showHidden: boolean,
): void {
  if (mesh.sphereRadius == null || !mesh.baseCenter) return;
  const sil: Circle3 = {
    id: "base",
    center: mesh.baseCenter,
    normal: cam.eye,
    radius: mesh.sphereRadius,
  };
  const ellipse = projectCircle(sil, cam, map);
  if (showFill) {
    cmds.push({
      t: "polygon",
      points: sampleEllipse(ellipse),
      fill: fillGray(cam.eye, cam),
    });
  }
  const equator = mesh.circles.find((c) => c.id === "base");
  if (equator) {
    drawCircleRim(cmds, equator, cam, map, showHidden, equator.normal, true);
  }
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

  if (familyIsSphere(state.family)) {
    drawSphere(cmds, mesh, cam, map, state.showFill, state.showHidden);
  } else if (familyIsSmooth(state.family)) {
    if (state.showFill) fillRoundSolids(cmds, mesh, cam, map);
    drawGeneratorLines(cmds, mesh, cam, map);
    for (const circle of mesh.circles) {
      if (isHemiEquator(mesh, circle)) continue;
      drawCircleRim(
        cmds,
        circle,
        cam,
        map,
        state.showHidden,
        mesh.axis,
        circle.id === "join",
      );
    }
    for (const hemi of mesh.hemispheres ?? []) {
      const equator = mesh.circles.find((c) => isHemiEquator(mesh, c));
      drawHemisphere(cmds, hemi, cam, map, state.showFill, state.showHidden, equator);
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
      runs: parseNameRuns("O"),
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
      if (!vertexNameVisible(state, i)) return;
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
        runs: parseNameRuns(name),
        size: style.pointLabelSize,
        anchor: "middle",
      });
    });
  }

  const outwardUp = { x: 0, y: -1 };
  const unit = state.unit;
  const unk = state.unknownLetter;

  if (state.showHeight && mesh.baseCenter) {
    const from3 = mesh.heightFrom ?? mesh.baseCenter;
    const top3 =
      mesh.heightTo ??
      mesh.topCenter ??
      (mesh.apexIndex != null ? mesh.vertices[mesh.apexIndex] : null);
    if (from3 && top3) {
      const a = map(project3(from3, cam));
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
        const foot = map(project3(from3, cam));
        const up2 = sub(map(project3(add3(from3, norm3(mesh.axis)), cam)), foot);
        const side2 = sub(map(project3(add3(from3, u), cam)), foot);
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

  if (state.showFaceHeight) {
    const seg = faceHeightSegment(state, mesh, cam);
    if (seg) {
      const a = map(project3(seg.lower, cam));
      const b = map(project3(seg.upper, cam));
      cmds.push({
        t: "line",
        x1: a.x,
        y1: a.y,
        x2: b.x,
        y2: b.y,
        id: "faceHeight:line",
      });
      const origin = mid3(seg.lower, seg.upper);
      const n2 = sub(
        map(project3(add3(origin, seg.outward), cam)),
        map(project3(origin, cam)),
      );
      const outward = len(n2) > 2 ? n2 : outwardUp;
      const txt = resolveLabelText(
        state.faceHeightLabel,
        faceHeightLength(state),
        unit,
        unk,
      );
      dimArc(
        cmds,
        texts,
        a,
        b,
        outward,
        style.dimOffset,
        txt,
        "faceHeight",
        state.faceHeightLabel,
        style.fontSize,
      );
      const alt = norm3(sub3(seg.upper, seg.lower));
      pushRightAngle(cmds, seg.lower, alt, norm3(seg.baseDir), cam, map, style.rightAngleSize);
      if (seg.topDir) {
        pushRightAngle(
          cmds,
          seg.upper,
          mul3(alt, -1),
          norm3(seg.topDir),
          cam,
          map,
          style.rightAngleSize,
        );
      }
    }
  }

  if (state.showRadius && mesh.circles[0]) {
    const circle =
      mesh.circles.find((c) => c.id === "join") ??
      mesh.circles.find((c) => c.id === "base") ??
      mesh.circles[0]!;
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
    const ends = slantEndpoints(state, mesh, cam);
    if (ends) {
      const a = map(project3(ends.a3, cam));
      const b = map(project3(ends.b3, cam));
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
