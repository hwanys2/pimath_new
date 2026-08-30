import { formatMeasure, normalizeSqrtLabel } from "@/lib/diagrams/math-label";
import {
  add,
  applyEdgeLengthChange,
  applyInteriorAngleChange,
  clamp,
  edgeLength,
  isConvex,
  len,
  mul,
  norm,
  parseAngleInput,
  parseMeasureInput,
  sub,
  vertexAngles,
} from "@/lib/diagrams/polygon/geometry";
import {
  emptyLabel,
  labelUnknownLetter,
  type MeasLabel,
  type Vec,
} from "@/lib/diagrams/polygon/model";
import {
  altitudeTriangleFromLegs,
  findSeg,
  patchSegState,
  triangleForRightVertex,
  wrapRotateDeg,
  type TrigRatiosState,
  type SegMark,
} from "./model";
import {
  rebuildTriangleFromLegs as pythRebuild,
  movePoint as pythMovePoint,
  syncLegFields,
  type PythSelection,
} from "@/lib/diagrams/pythagorean/geometry";
import type { PythagoreanState } from "@/lib/diagrams/pythagorean/model";

export type TrigHit =
  | { kind: "point"; id: string }
  | { kind: "seg"; id: string }
  | { kind: "label"; id: string }
  | { kind: "dimLine"; id: string };

export type TrigSelection = PythSelection | { t: "ang"; id: string };

export function lerp(a: Vec, b: Vec, t: number): Vec {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export function projectT(p: Vec, a: Vec, b: Vec): number {
  const ab = sub(b, a);
  const ap = sub(p, a);
  const l2 = ab.x * ab.x + ab.y * ab.y;
  if (l2 < 1e-12) return 0.5;
  return (ap.x * ab.x + ap.y * ab.y) / l2;
}

export function distToSeg(p: Vec, a: Vec, b: Vec): number {
  const t = clamp(projectT(p, a, b), 0, 1);
  const q = lerp(a, b, t);
  return len(sub(p, q));
}

export function angleDeg(from: Vec, vertex: Vec, to: Vec): number {
  const u = norm(sub(from, vertex));
  const w = norm(sub(to, vertex));
  return (Math.acos(clamp(u.x * w.x + u.y * w.y, -1, 1)) * 180) / Math.PI;
}

export function footToLine(p: Vec, a: Vec, b: Vec): Vec {
  const t = projectT(p, a, b);
  return lerp(a, b, t);
}

export function rotateAround(p: Vec, origin: Vec, deg: number): Vec {
  if (Math.abs(deg) < 1e-9) return p;
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  const v = sub(p, origin);
  return add(origin, { x: v.x * c - v.y * s, y: v.x * s + v.y * c });
}

export function worldRightTriangle(state: TrigRatiosState): { A: Vec; B: Vec; C: Vec } {
  const { A, B, C } = state;
  const deg = wrapRotateDeg(state.rotateDeg);
  if (deg < 1e-9) return { A, B, C };
  const O = mul(add(add(A, B), C), 1 / 3);
  return {
    A: rotateAround(A, O, deg),
    B: rotateAround(B, O, deg),
    C: rotateAround(C, O, deg),
  };
}

export function worldQuadPoints(state: TrigRatiosState): Vec[] {
  const pts = state.quadPoints;
  const deg = wrapRotateDeg(state.rotateDeg);
  if (deg < 1e-9) return pts;
  const O = mul(add(add(pts[0]!, pts[2]!), add(pts[1]!, pts[3]!)), 0.25);
  return pts.map((p) => rotateAround(p, O, deg));
}

export function unitCirclePoints(state: TrigRatiosState): Record<string, Vec> {
  const rad = (state.thetaDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const tan = Math.tan(rad);
  return {
    O: { x: 0, y: 0 },
    A: { x: cos, y: 0 },
    B: { x: cos, y: sin },
    C: { x: 1, y: 0 },
    D: { x: 1, y: tan },
  };
}

export function trianglePoints(state: TrigRatiosState): Record<string, Vec> {
  const { triA: A, triB: B, triC: C } = state;
  const from = state.altitudeFrom;
  let baseA = A;
  let baseB = B;
  let apex = C;
  if (from === "A") {
    baseA = B;
    baseB = C;
    apex = A;
  } else if (from === "B") {
    baseA = A;
    baseB = C;
    apex = B;
  }
  const H = footToLine(apex, baseA, baseB, false);
  return { A, B, C, H };
}

export function isObtuseAtA(state: TrigRatiosState): boolean {
  const { A, B, C } = trianglePoints(state);
  return angleDeg(B, A, C) > 90 + 0.5;
}

export function derivedPoints(state: TrigRatiosState): Record<string, Vec> {
  switch (state.kind) {
    case "right":
      return worldRightTriangle(state);
    case "unit-circle":
      return unitCirclePoints(state);
    case "triangle-area":
      return trianglePoints(state);
    case "quad-area":
      return Object.fromEntries(
        worldQuadPoints(state).map((p, i) => [
          String.fromCharCode(65 + i),
          p,
        ]),
      );
    default:
      return {};
  }
}

export function figureStrokes(state: TrigRatiosState): [string, string][] {
  switch (state.kind) {
    case "right":
      return [
        ["A", "B"],
        ["B", "C"],
        ["A", "C"],
      ];
    case "unit-circle": {
      const pts = unitCirclePoints(state);
      return [
        ["O", "A"],
        ["A", "B"],
        ["O", "B"],
        ["C", "D"],
        ["O", "C"],
        ["O", "D"],
      ].filter(([a, b]) => {
        const pa = pts[a];
        const pb = pts[b];
        return pa && pb;
      });
    }
    case "triangle-area": {
      const segs: [string, string][] = [
        ["A", "B"],
        ["B", "C"],
        ["A", "C"],
      ];
      if (state.showAltitudeHighlight || state.showAltitudeRight) {
        const from = state.altitudeFrom;
        if (from === "A") segs.push(["A", "H"]);
        else if (from === "B") segs.push(["B", "H"]);
        else segs.push(["C", "H"]);
      }
      return segs;
    }
    case "quad-area":
      return [
        ["A", "B"],
        ["B", "C"],
        ["C", "D"],
        ["D", "A"],
      ];
    default:
      return [];
  }
}

export function draggableIds(state: TrigRatiosState): string[] {
  switch (state.kind) {
    case "right":
      return ["A", "B", "C"];
    case "unit-circle":
      return ["B"];
    case "triangle-area":
      return ["A", "B", "C"];
    case "quad-area":
      return ["A", "B", "C", "D"];
    default:
      return [];
  }
}

export function displayName(state: TrigRatiosState, id: string): string {
  if (state.kind === "triangle-area") {
    return state.triNames[id]?.name?.trim() || id;
  }
  if (state.kind === "quad-area") {
    const i = "ABCD".indexOf(id);
    if (i >= 0) return state.quadVertices[i]?.name?.trim() || id;
  }
  return state.names[id]?.name?.trim() || id;
}

export function segDisplayName(state: TrigRatiosState, seg: SegMark): string {
  return `${displayName(state, seg.a)}${displayName(state, seg.b)}`;
}

export function segLength(state: TrigRatiosState, seg: SegMark): number {
  const pts = derivedPoints(state);
  const a = pts[seg.a];
  const b = pts[seg.b];
  if (!a || !b) return 0;
  return len(sub(b, a));
}

function toPythState(state: TrigRatiosState): PythagoreanState {
  return {
    kind: "triangle",
    A: state.A,
    B: state.B,
    C: state.C,
    rightVertex: state.rightVertex,
    legLeft: state.legLeft,
    legRight: state.legRight,
    isoscelesRight: state.isoscelesRight,
    names: state.names,
    segs: state.segs,
    showVertexNames: state.showVertexNames,
    showDots: state.showDots,
    showRightAngle: state.showRightAngle,
    showGrid: false,
    gridCols: 8,
    gridRows: 8,
    gridMargin: 1,
    showFill: false,
    showSquareLabels: false,
    showDissection: false,
    squareLabelMode: "korean",
    proofView: "both",
    proofLegA: 3,
    proofLegB: 4,
    coordXMin: -1,
    coordXMax: 8,
    coordYMin: -1,
    coordYMax: 8,
    coordPadding: 0.5,
    showAxisDrops: false,
    rectWidth: 6,
    rectHeight: 8,
    rectSquare: false,
    showDiagonal: true,
    unit: state.unit,
    unknownLetter: state.unknownLetter,
    style: state.style,
  };
}

function fromPythTriangle(state: TrigRatiosState, p: PythagoreanState): TrigRatiosState {
  return {
    ...state,
    A: p.A,
    B: p.B,
    C: p.C,
    legLeft: p.legLeft,
    legRight: p.legRight,
  };
}

export function rebuildTriangleFromLegs(
  state: TrigRatiosState,
  legLeft: number,
  legRight: number,
): TrigRatiosState {
  return fromPythTriangle(state, pythRebuild(toPythState(state), legLeft, legRight));
}

export function movePoint(state: TrigRatiosState, id: string, pos: Vec): TrigRatiosState {
  switch (state.kind) {
    case "right": {
      const next = fromPythTriangle(state, pythMovePoint(toPythState(state), id, pos));
      return syncLegFields(next as unknown as PythagoreanState) as unknown as TrigRatiosState;
    }
    case "unit-circle": {
      if (id !== "B") return state;
      const ang = (Math.atan2(pos.y, pos.x) * 180) / Math.PI;
      return { ...state, thetaDeg: clamp(ang, 15, 80) };
    }
    case "triangle-area": {
      const key = id as "A" | "B" | "C";
      if (key !== "A" && key !== "B" && key !== "C") return state;
      const patch = { [`tri${key}`]: pos } as Partial<TrigRatiosState>;
      const next = { ...state, ...patch };
      const pts = [next.triA, next.triB, next.triC];
      if (!isConvex(pts) || edgeLength(pts, 0) < 0.4) return state;
      return next;
    }
    case "quad-area": {
      const i = "ABCD".indexOf(id);
      if (i < 0) return state;
      const pts = state.quadPoints.slice();
      pts[i] = pos;
      if (!validQuad(state, pts)) return state;
      return { ...state, quadPoints: pts };
    }
    default:
      return state;
  }
}

function validQuad(state: TrigRatiosState, points: Vec[]): boolean {
  if (points.length !== 4 || !isConvex(points)) return false;
  for (let i = 0; i < 4; i += 1) {
    if (edgeLength(points, i) < 0.4) return false;
  }
  if (state.quadFamily === "parallelogram") {
    const diag1 = sub(points[2]!, points[0]!);
    const diag2 = sub(points[3]!, points[1]!);
    const mid1 = mul(add(points[0]!, points[2]!), 0.5);
    const mid2 = mul(add(points[1]!, points[3]!), 0.5);
    if (len(sub(mid1, mid2)) > 0.15) return false;
    const ab = sub(points[1]!, points[0]!);
    const dc = sub(points[2]!, points[3]!);
    const ad = sub(points[3]!, points[0]!);
    const bc = sub(points[2]!, points[1]!);
    if (Math.abs(cross2(ab, dc)) > 0.2) return false;
    if (Math.abs(cross2(ad, bc)) > 0.2) return false;
  }
  return true;
}

function cross2(a: Vec, b: Vec): number {
  return a.x * b.y - a.y * b.x;
}

export function setRotateDeg(state: TrigRatiosState, deg: number): TrigRatiosState {
  return { ...state, rotateDeg: wrapRotateDeg(deg) };
}

export function setThetaDeg(state: TrigRatiosState, deg: number): TrigRatiosState {
  return { ...state, thetaDeg: clamp(deg, 15, 80) };
}

export function toggleSeg(state: TrigRatiosState, id: string): TrigRatiosState {
  const seg = findSeg(state, id);
  if (!seg) return state;
  return patchSegState(state, id, { show: !seg.show });
}

export function resolveSegText(state: TrigRatiosState, seg: SegMark): string | null {
  if (!seg.show) return null;
  const length = segLength(state, seg);
  const { label } = seg;
  if (label.mode === "hide") return null;
  if (label.mode === "custom") return normalizeSqrtLabel(label.custom.trim());
  if (label.mode === "x") return `$${labelUnknownLetter(label, state.unknownLetter)}$`;
  return formatMeasure(length, state.unit);
}

export function resolveAngleLabel(
  state: TrigRatiosState,
  mark: { label: MeasLabel; vertex: string; from: string; to: string },
  deg: number,
): string | null {
  const { label } = mark;
  if (label.mode === "hide") return null;
  if (label.mode === "custom") return normalizeSqrtLabel(label.custom.trim());
  if (label.mode === "x") return `$${labelUnknownLetter(label, state.unknownLetter)}$`;
  return `${Math.round(deg * 10) / 10}°`;
}

export function applyEditedLabel(
  state: TrigRatiosState,
  labelId: string,
  raw: string,
): TrigRatiosState {
  const trimmed = raw.trim();
  if (labelId.startsWith("s:")) {
    const segId = labelId.slice(2);
    const seg = findSeg(state, segId);
    if (!seg) return state;
    const parsed = parseMeasureInput(trimmed, state.unit);
    if (parsed.mode === "number" && parsed.value != null) {
      return applySegNumeric(state, segId, parsed.value);
    }
    return patchSegState(state, segId, {
      label: {
        ...seg.label,
        mode: parsed.mode,
        custom: parsed.custom ?? trimmed,
      },
    });
  }
  if (labelId.startsWith("a:")) {
    const angId = labelId.slice(2);
    const pool = state.kind === "triangle-area" ? state.triAngles : state.angles;
    const mark = pool.find((a) => a.id === angId);
    if (!mark) return state;
    const parsed = parseAngleInput(trimmed);
    const key = state.kind === "triangle-area" ? "triAngles" : "angles";
    if (parsed.mode === "number" && parsed.value != null) {
      const next = applyAngleNumeric(state, angId, parsed.value);
      return next;
    }
    return {
      ...state,
      [key]: state[key].map((a) =>
        a.id === angId
          ? {
              ...a,
              label: {
                ...a.label,
                mode: parsed.mode,
                custom: parsed.custom ?? trimmed,
              },
            }
          : a,
      ),
    };
  }
  if (labelId.startsWith("v:")) {
    const parts = labelId.split(":");
    const vi = Number(parts[1]);
    const parsed = parseAngleInput(trimmed);
    if (state.kind === "quad-area" && Number.isFinite(vi)) {
      if (parsed.mode === "number" && parsed.value != null) {
        return applyQuadAngleNumeric(state, vi, parsed.value);
      }
      return {
        ...state,
        quadVertices: state.quadVertices.map((v, i) =>
          i === vi
            ? {
                ...v,
                interior: {
                  ...v.interior,
                  mode: parsed.mode,
                  custom: parsed.custom ?? trimmed,
                },
              }
            : v,
        ),
      };
    }
  }
  if (labelId.startsWith("n:")) {
    const id = labelId.slice(2);
    return setPointName(state, id, trimmed);
  }
  if (labelId === "theta") {
    const n = Number(trimmed.replace("°", ""));
    if (Number.isFinite(n)) return setThetaDeg(state, n);
  }
  if (labelId === "axis:Ax") {
    const n = Number(trimmed);
    if (Number.isFinite(n) && n > 0 && n <= 1) {
      return setThetaDeg(state, (Math.acos(n) * 180) / Math.PI);
    }
  }
  if (labelId === "axis:By") {
    const n = Number(trimmed);
    if (Number.isFinite(n) && n > 0 && n <= 1) {
      return setThetaDeg(state, (Math.asin(n) * 180) / Math.PI);
    }
  }
  if (labelId === "axis:Dy") {
    const n = Number(trimmed);
    if (Number.isFinite(n) && n > 0) {
      return setThetaDeg(state, (Math.atan(n) * 180) / Math.PI);
    }
  }
  return state;
}

function applySegNumeric(state: TrigRatiosState, segId: string, value: number): TrigRatiosState {
  if (state.kind === "right") {
    const seg = state.segs.find((s) => s.id === segId);
    if (!seg) return state;
    const { left, right, hyp } = legSides(state);
    const refAng = acuteAngleAtRef(state);
    const hasRefAngle =
      state.angles.find((a) => a.vertex === state.refAngleVertex)?.label.mode === "auto" ||
      state.angles.find((a) => a.vertex === state.refAngleVertex)?.show;
    if (hasRefAngle && refAng > 0 && refAng < 89) {
      const rad = (refAng * Math.PI) / 180;
      if (segId === "AB" || segId === "AC" || segId === "BC") {
        return rebuildFromKnownSide(state, segId, value, rad);
      }
    }
    if (segId === "AB") return rebuildTriangleFromLegs(state, value, right);
    if (segId === "BC") return rebuildTriangleFromLegs(state, left, value);
    if (segId === "AC") {
      const rv = state.rightVertex;
      if (rv === "C") {
        const bc = value;
        const ab = Math.sqrt(Math.max(0, bc * bc - right * right));
        return rebuildTriangleFromLegs(state, right, ab);
      }
    }
    return rebuildTriangleFromLegs(state, left, right);
  }
  if (state.kind === "triangle-area") {
    const pts = [state.triA, state.triB, state.triC];
    const edgeMap: Record<string, [number, number]> = {
      AB: [0, 1],
      BC: [1, 2],
      AC: [0, 2],
      CH: [2, 3],
      AH: [0, 3],
      BH: [1, 3],
    };
    const pair = edgeMap[segId];
    if (!pair) return state;
    const poly = polygonFromTri(state);
    const nextPoly = applyEdgeLengthChange(poly, pair[0], value, pair[1] % 3);
    return fromPolygonTri(state, nextPoly);
  }
  if (state.kind === "quad-area") {
    const edgeIndex = ["AB", "BC", "CD", "DA"].indexOf(segId);
    if (edgeIndex < 0) return state;
    const poly = quadPolygonState(state);
    const nextPoly = applyEdgeLengthChange(poly, edgeIndex, value);
    return fromQuadPolygon(state, nextPoly);
  }
  return state;
}

function legSides(state: TrigRatiosState): { left: number; right: number; hyp: number } {
  const pts = derivedPoints(state);
  const { A, B, C } = pts;
  const rv = state.rightVertex;
  if (rv === "C") {
    return {
      left: len(sub(B!, C!)),
      right: len(sub(A!, C!)),
      hyp: len(sub(A!, B!)),
    };
  }
  if (rv === "A") {
    return {
      left: len(sub(B!, A!)),
      right: len(sub(C!, A!)),
      hyp: len(sub(B!, C!)),
    };
  }
  return {
    left: len(sub(A!, B!)),
    right: len(sub(C!, B!)),
    hyp: len(sub(A!, C!)),
  };
}

function acuteAngleAtRef(state: TrigRatiosState): number {
  const pts = derivedPoints(state);
  const v = state.refAngleVertex;
  if (v === "A") return angleDeg(pts.B!, pts.A!, pts.C!);
  if (v === "B") return angleDeg(pts.A!, pts.B!, pts.C!);
  return angleDeg(pts.A!, pts.C!, pts.B!);
}

function rebuildFromKnownSide(
  state: TrigRatiosState,
  segId: string,
  value: number,
  rad: number,
): TrigRatiosState {
  const rv = state.rightVertex;
  const sin = Math.sin(rad);
  const cos = Math.cos(rad);
  const tan = Math.tan(rad);
  let ll = state.legLeft;
  let lr = state.legRight;
  if (rv === "C") {
    if (segId === "BC") {
      ll = value;
      lr = value * tan;
    } else if (segId === "AC") {
      lr = value;
      ll = value / tan;
    } else {
      const hyp = value;
      ll = hyp * cos;
      lr = hyp * sin;
    }
  } else if (rv === "B") {
    if (segId === "AB") {
      ll = value;
      lr = value / tan;
    } else if (segId === "BC") {
      lr = value;
      ll = value * tan;
    } else {
      const hyp = value;
      ll = hyp * sin;
      lr = hyp * cos;
    }
  }
  return rebuildTriangleFromLegs(state, ll, lr);
}

function applyAngleNumeric(state: TrigRatiosState, angId: string, value: number): TrigRatiosState {
  if (state.kind === "right") {
    const mark = state.angles.find((a) => a.id === angId);
    if (!mark) return state;
    const side = state.segs.find((s) => s.show && s.label.mode === "auto");
    const known = side ? segLength(state, side) : state.legLeft;
    const rad = (value * Math.PI) / 180;
    let ll = known;
    let lr = known * Math.tan(rad);
    if (state.rightVertex === "C") {
      return rebuildTriangleFromLegs(state, lr, ll);
    }
    return rebuildTriangleFromLegs(state, ll, lr);
  }
  if (state.kind === "triangle-area") {
    const poly = polygonFromTri(state);
    const idx = { A: 0, B: 1, C: 2 }[angId as "A" | "B" | "C"] ?? -1;
    if (idx < 0) return state;
    const nextPoly = applyInteriorAngleChange(poly, idx, value);
    return fromPolygonTri(state, nextPoly);
  }
  return state;
}

function applyQuadAngleNumeric(state: TrigRatiosState, vi: number, value: number): TrigRatiosState {
  const poly = quadPolygonState(state);
  const nextPoly = applyInteriorAngleChange(poly, vi, value);
  return fromQuadPolygon(state, nextPoly);
}

function polygonFromTri(state: TrigRatiosState) {
  return {
    points: [state.triA, state.triB, state.triC],
    vertices: state.triVertices.map((v) => ({
      name: v.name,
      nameDx: v.nameDx,
      nameDy: v.nameDy,
      showInterior: v.showInterior,
      showExterior: false,
      fillExterior: false,
      interior: v.interior,
      exterior: emptyLabel("auto"),
    })),
    edges: state.triEdges.map((e) => ({
      showLength: e.showLength,
      length: e.length,
    })),
    diagonals: [] as [number, number][],
    interiorAnglesDeg: [0, 0, 0],
    referenceEdgeLength: edgeLength([state.triA, state.triB, state.triC], 0),
    showVertexNames: state.showVertexNames,
    showDots: state.showDots,
    unit: state.unit,
    unknownLetter: state.unknownLetter,
    style: state.style,
  };
}

function fromPolygonTri(state: TrigRatiosState, poly: ReturnType<typeof polygonFromTri>): TrigRatiosState {
  return {
    ...state,
    triA: poly.points[0]!,
    triB: poly.points[1]!,
    triC: poly.points[2]!,
    triVertices: state.triVertices.map((v, i) => ({
      ...v,
      name: poly.vertices[i]?.name ?? v.name,
    })),
  };
}

function quadPolygonState(state: TrigRatiosState) {
  return {
    points: state.quadPoints,
    vertices: state.quadVertices.map((v) => ({
      name: v.name,
      nameDx: v.nameDx,
      nameDy: v.nameDy,
      showInterior: v.showInterior,
      showExterior: false,
      fillExterior: false,
      interior: v.interior,
      exterior: emptyLabel("auto"),
    })),
    edges: state.quadEdges.map((e) => ({
      showLength: e.showLength,
      length: e.length,
    })),
    diagonals: [] as [number, number][],
    interiorAnglesDeg: [0, 0, 0, 0],
    referenceEdgeLength: edgeLength(state.quadPoints, 0),
    showVertexNames: state.showVertexNames,
    showDots: state.showDots,
    unit: state.unit,
    unknownLetter: state.unknownLetter,
    style: state.style,
  };
}

function fromQuadPolygon(
  state: TrigRatiosState,
  poly: ReturnType<typeof quadPolygonState>,
): TrigRatiosState {
  return { ...state, quadPoints: poly.points.slice(0, 4) };
}

export function setPointName(
  state: TrigRatiosState,
  id: string,
  nameValue: string,
): TrigRatiosState {
  if (state.kind === "triangle-area") {
    const prev = state.triNames[id] ?? { name: id, dx: 0, dy: 0 };
    return {
      ...state,
      triNames: {
        ...state.triNames,
        [id]: { ...prev, name: nameValue.trim() || prev.name },
      },
    };
  }
  if (state.kind === "quad-area") {
    const i = "ABCD".indexOf(id);
    if (i >= 0) {
      return {
        ...state,
        quadVertices: state.quadVertices.map((v, idx) =>
          idx === i ? { ...v, name: nameValue.trim() || v.name } : v,
        ),
      };
    }
  }
  const prev = state.names[id] ?? { name: id, dx: 0, dy: 0 };
  return {
    ...state,
    names: { ...state.names, [id]: { ...prev, name: nameValue.trim() || prev.name } },
  };
}

export function nudgeLabel(state: TrigRatiosState, labelId: string, dx: number, dy: number): TrigRatiosState {
  if (labelId.startsWith("s:")) {
    const segId = labelId.slice(2);
    const seg = findSeg(state, segId);
    if (!seg) return state;
    return patchSegState(state, segId, {
      label: { ...seg.label, dx: seg.label.dx + dx, dy: seg.label.dy + dy },
    });
  }
  if (labelId.startsWith("n:")) {
    const id = labelId.slice(2);
    if (state.kind === "triangle-area") {
      const prev = state.triNames[id] ?? { name: id, dx: 0, dy: 0 };
      return {
        ...state,
        triNames: { ...state.triNames, [id]: { ...prev, dx: prev.dx + dx, dy: prev.dy + dy } },
      };
    }
    const prev = state.names[id] ?? { name: id, dx: 0, dy: 0 };
    return {
      ...state,
      names: { ...state.names, [id]: { ...prev, dx: prev.dx + dx, dy: prev.dy + dy } },
    };
  }
  return state;
}

export function nudgeDimLine(state: TrigRatiosState, labelId: string, dx: number, dy: number): TrigRatiosState {
  if (!labelId.startsWith("s:")) return state;
  const segId = labelId.slice(2);
  const seg = findSeg(state, segId);
  if (!seg) return state;
  return patchSegState(state, segId, {
    label: {
      ...seg.label,
      lineDx: (seg.label.lineDx ?? 0) + dx,
      lineDy: (seg.label.lineDy ?? 0) + dy,
    },
  });
}

export function hitTestTrig(
  canvasPts: Record<string, Vec>,
  texts: { id: string; x: number; y: number }[],
  cmds: { t: string; id?: string; x1?: number; y1?: number; x2?: number; y2?: number }[],
  strokes: [string, string][],
  segs: SegMark[],
  x: number,
  y: number,
  scale: number,
  dragIds: string[],
): TrigHit | null {
  const rLabel = 18 * scale;
  const rPoint = 16 * scale;
  const rSeg = 12 * scale;

  for (const text of texts) {
    if (Math.hypot(text.x - x, text.y - y) < rLabel) {
      return { kind: "label", id: text.id };
    }
  }

  for (const id of dragIds) {
    const p = canvasPts[id];
    if (p && Math.hypot(p.x - x, p.y - y) < rPoint) {
      return { kind: "point", id };
    }
  }

  for (const cmd of cmds) {
    if (cmd.t === "line" && cmd.id?.endsWith(":dim")) {
      const d = distToSeg({ x, y }, { x: cmd.x1!, y: cmd.y1! }, { x: cmd.x2!, y: cmd.y2! });
      if (d < rSeg) return { kind: "dimLine", id: cmd.id.replace(/:dim$/, "") };
    }
  }

  for (const [a, b] of strokes) {
    const pa = canvasPts[a];
    const pb = canvasPts[b];
    if (!pa || !pb) continue;
    if (distToSeg({ x, y }, pa, pb) < rSeg) {
      const id = `${a}${b}`;
      const rev = `${b}${a}`;
      if (segs.some((s) => s.id === id || s.id === rev)) {
        return { kind: "seg", id: segs.find((s) => s.id === id)?.id ?? rev };
      }
      return { kind: "seg", id };
    }
  }

  return null;
}

export function rebuildRightForRightVertex(state: TrigRatiosState, rv: "A" | "B" | "C"): TrigRatiosState {
  const t = triangleForRightVertex(state.legLeft, state.legRight, rv);
  return normalizeRight({
    ...state,
    rightVertex: rv,
    A: t.A,
    B: t.B,
    C: t.C,
    rotateDeg: 0,
  });
}

function normalizeRight(state: TrigRatiosState): TrigRatiosState {
  return syncLegFields(state as unknown as PythagoreanState) as unknown as TrigRatiosState;
}

export function interiorAngleDeg(points: Vec[], i: number): number {
  const n = points.length;
  const prev = points[(i + n - 1) % n]!;
  const cur = points[i]!;
  const next = points[(i + 1) % n]!;
  return angleDeg(prev, cur, next);
}

export function extensionPoint(from: Vec, to: Vec, ext: number): Vec {
  const dir = norm(sub(to, from));
  return add(to, mul(dir, ext));
}

export { findSeg, patchSegState };
