import type { ShapeKind, Vec2 } from "./types";

export type ShapeDef = {
  kind: ShapeKind;
  label: string;
  color: string;
  /** Local verts around origin; typical "side" ~1 for regulars. */
  local: Vec2[];
};

function regularPolygon(n: number, radius = 1): Vec2[] {
  const out: Vec2[] = [];
  // Squares stay axis-aligned (Polypad-like); others point a vertex up.
  const start = n === 4 ? Math.PI / 4 : -Math.PI / 2;
  for (let i = 0; i < n; i++) {
    const a = start + (i * 2 * Math.PI) / n;
    out.push({ x: radius * Math.cos(a), y: radius * Math.sin(a) });
  }
  // Normalize so mean edge length ≈ 1
  let edgeSum = 0;
  for (let i = 0; i < n; i++) {
    const a = out[i];
    const b = out[(i + 1) % n];
    edgeSum += Math.hypot(b.x - a.x, b.y - a.y);
  }
  const mean = edgeSum / n || 1;
  return out.map((p) => ({ x: p.x / mean, y: p.y / mean }));
}

function sideLength(verts: Vec2[], i: number): number {
  const a = verts[i];
  const b = verts[(i + 1) % verts.length];
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Center polygon at origin. */
function recenter(verts: Vec2[]): Vec2[] {
  const cx = verts.reduce((s, p) => s + p.x, 0) / verts.length;
  const cy = verts.reduce((s, p) => s + p.y, 0) / verts.length;
  return verts.map((p) => ({ x: p.x - cx, y: p.y - cy }));
}

const EQ_TRI = regularPolygon(3);
const SQUARE = regularPolygon(4);
const PENT = regularPolygon(5);
const HEX = regularPolygon(6);
const HEPT = regularPolygon(7);
const OCT = regularPolygon(8);

/** Isosceles trapezoid: bases 1.6 & 1, height ~0.75 */
const TRAPEZOID = recenter([
  { x: -0.8, y: 0.4 },
  { x: 0.8, y: 0.4 },
  { x: 0.5, y: -0.35 },
  { x: -0.5, y: -0.35 },
]);

/** Parallelogram */
const PARALLELOGRAM = recenter([
  { x: -0.7, y: 0.35 },
  { x: 0.5, y: 0.35 },
  { x: 0.7, y: -0.35 },
  { x: -0.5, y: -0.35 },
]);

/** Rhombus (side 1) */
const RHOMBUS = recenter([
  { x: 0, y: 0.55 },
  { x: 0.7, y: 0 },
  { x: 0, y: -0.55 },
  { x: -0.7, y: 0 },
]);

/** Rectangle 1.5 × 1 */
const RECTANGLE = recenter([
  { x: -0.75, y: 0.5 },
  { x: 0.75, y: 0.5 },
  { x: 0.75, y: -0.5 },
  { x: -0.75, y: -0.5 },
]);

/** Right triangle legs 1,1 */
const RIGHT_TRI = recenter([
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
]);

/** Scalene acute-ish */
const SCALENE = recenter([
  { x: 0, y: 0 },
  { x: 1.2, y: 0 },
  { x: 0.35, y: 0.85 },
]);

export const SHAPE_DEFS: Record<ShapeKind, ShapeDef> = {
  equilateralTriangle: {
    kind: "equilateralTriangle",
    label: "정삼각형",
    color: "#f0a04b",
    local: EQ_TRI,
  },
  square: {
    kind: "square",
    label: "정사각형",
    color: "#4da3ff",
    local: SQUARE,
  },
  regularPentagon: {
    kind: "regularPentagon",
    label: "정오각형",
    color: "#5ecf6a",
    local: PENT,
  },
  regularHexagon: {
    kind: "regularHexagon",
    label: "정육각형",
    color: "#e85aad",
    local: HEX,
  },
  regularHeptagon: {
    kind: "regularHeptagon",
    label: "정칠각형",
    color: "#2ec4b6",
    local: HEPT,
  },
  regularOctagon: {
    kind: "regularOctagon",
    label: "정팔각형",
    color: "#9b6bff",
    local: OCT,
  },
  isoscelesTrapezoid: {
    kind: "isoscelesTrapezoid",
    label: "등변사다리꼴",
    color: "#e85d4c",
    local: TRAPEZOID,
  },
  parallelogram: {
    kind: "parallelogram",
    label: "평행사변형",
    color: "#4d8dff",
    local: PARALLELOGRAM,
  },
  rhombus: {
    kind: "rhombus",
    label: "마름모",
    color: "#b4d645",
    local: RHOMBUS,
  },
  rectangle: {
    kind: "rectangle",
    label: "직사각형",
    color: "#7ec8f5",
    local: RECTANGLE,
  },
  rightTriangle: {
    kind: "rightTriangle",
    label: "직각삼각형",
    color: "#4caf7a",
    local: RIGHT_TRI,
  },
  scaleneTriangle: {
    kind: "scaleneTriangle",
    label: "부등변삼각형",
    color: "#f08a4b",
    local: SCALENE,
  },
};

export const SHAPE_PALETTE_ORDER: ShapeKind[] = [
  "equilateralTriangle",
  "square",
  "regularPentagon",
  "regularHexagon",
  "regularHeptagon",
  "regularOctagon",
  "isoscelesTrapezoid",
  "parallelogram",
  "rhombus",
  "rectangle",
  "rightTriangle",
  "scaleneTriangle",
];

export const DEFAULT_TILE_SCALE = 64;

export function unitEdgeLengths(kind: ShapeKind): number[] {
  const local = SHAPE_DEFS[kind].local;
  return local.map((_, i) => sideLength(local, i));
}

export function edgeCount(kind: ShapeKind): number {
  return SHAPE_DEFS[kind].local.length;
}
