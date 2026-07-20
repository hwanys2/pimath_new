/** Pure math for the 회전체 (solid of revolution) simulation. */

export type Pt = { x: number; y: number };

export type DrawMode = "grid" | "free" | "preset";

export type PresetId =
  | "rectangle"
  | "triangle"
  | "semicircle"
  | "trapezoid"
  | "circle";

export type PresetMeta = {
  id: PresetId;
  label: string;
  solidName: string;
  hint: string;
  points: Pt[];
};

/** World units: axis at x=0, draw only x >= 0. */
export const WORLD_HALF = 5;
export const GRID_STEP = 0.5;
export const MIN_PROFILE_POINTS = 3;
export const FREE_DRAW_MIN_DIST = 0.12;
export const FREE_DRAW_MAX_POINTS = 80;

export const PRESETS: PresetMeta[] = [
  {
    id: "rectangle",
    label: "직사각형",
    solidName: "원기둥",
    hint: "직사각형을 축을 중심으로 돌리면 원기둥이 됩니다.",
    points: [
      { x: 0, y: -2 },
      { x: 1.5, y: -2 },
      { x: 1.5, y: 2 },
      { x: 0, y: 2 },
    ],
  },
  {
    id: "triangle",
    label: "직각삼각형",
    solidName: "원뿔",
    hint: "직각삼각형을 축을 중심으로 돌리면 원뿔이 됩니다.",
    points: [
      { x: 0, y: -2 },
      { x: 2, y: -2 },
      { x: 0, y: 2 },
    ],
  },
  {
    id: "semicircle",
    label: "반원",
    solidName: "구",
    hint: "반원을 축을 중심으로 돌리면 구가 됩니다.",
    points: semicirclePoints(2, 24),
  },
  {
    id: "trapezoid",
    label: "사다리꼴",
    solidName: "원뿔대",
    hint: "사다리꼴을 축을 중심으로 돌리면 원뿔대가 됩니다.",
    points: [
      { x: 0, y: -2 },
      { x: 1, y: -2 },
      { x: 2, y: 2 },
      { x: 0, y: 2 },
    ],
  },
  {
    id: "circle",
    label: "원",
    solidName: "원환면",
    hint: "축에서 떨어진 원을 돌리면 원환면(도넛 모양)이 됩니다.",
    points: circlePoints(2.5, 0, 1, 32),
  },
];

function semicirclePoints(radius: number, segments: number): Pt[] {
  const pts: Pt[] = [{ x: 0, y: -radius }];
  for (let i = 1; i < segments; i++) {
    const t = (i / segments) * Math.PI - Math.PI / 2;
    pts.push({
      x: radius * Math.cos(t),
      y: radius * Math.sin(t),
    });
  }
  pts.push({ x: 0, y: radius });
  return pts;
}

/** Closed circle centered at (cx, cy) — used for torus preset. */
function circlePoints(
  cx: number,
  cy: number,
  radius: number,
  segments: number,
): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    pts.push({
      x: cx + radius * Math.cos(t),
      y: cy + radius * Math.sin(t),
    });
  }
  return pts.map(clampToRightHalf);
}

export function getPreset(id: PresetId): PresetMeta {
  return PRESETS.find((p) => p.id === id) ?? PRESETS[0];
}

/** Clamp so the profile stays on the axis or to its right. */
export function clampToRightHalf(p: Pt): Pt {
  return {
    x: Math.max(0, Math.min(WORLD_HALF, p.x)),
    y: Math.max(-WORLD_HALF, Math.min(WORLD_HALF, p.y)),
  };
}

export function snapToGrid(p: Pt, step = GRID_STEP): Pt {
  const snapped = {
    x: Math.round(p.x / step) * step,
    y: Math.round(p.y / step) * step,
  };
  return clampToRightHalf(snapped);
}

export function dist(a: Pt, b: Pt): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Keep free-draw strokes sparse enough for LatheGeometry. */
export function appendFreePoint(points: Pt[], next: Pt): Pt[] {
  const p = clampToRightHalf(next);
  if (points.length === 0) return [p];
  const last = points[points.length - 1];
  if (dist(last, p) < FREE_DRAW_MIN_DIST) return points;
  if (points.length >= FREE_DRAW_MAX_POINTS) {
    return [...points.slice(0, -1), p];
  }
  return [...points, p];
}

function dedupeConsecutive(points: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of points) {
    const prev = out[out.length - 1];
    if (!prev || dist(prev, p) > 1e-6) out.push(p);
  }
  return out;
}

/** Close a polygon loop for Lathe without forcing points onto the axis. */
export function closeLoop(points: Pt[]): Pt[] {
  const clamped = dedupeConsecutive(points.map(clampToRightHalf));
  if (clamped.length < 2) return clamped;
  const first = clamped[0];
  const last = clamped[clamped.length - 1];
  if (dist(first, last) > 1e-6) {
    return [...clamped, { x: first.x, y: first.y }];
  }
  return clamped;
}

export function isProfileReady(points: Pt[], closed: boolean): boolean {
  return closed && points.length >= MIN_PROFILE_POINTS;
}

/** Degrees → radians for Three.js LatheGeometry phiLength. */
export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Three.js LatheGeometry at phi=0 places the profile in the +Z (YZ) plane.
 * Start at π/2 so the generating face lies on +X (XY, z=0), matching the yellow ribbon.
 */
export const LATHE_PHI_START = Math.PI / 2;

export function clampAngle(deg: number): number {
  if (!Number.isFinite(deg)) return 0;
  return Math.max(0, Math.min(360, Math.round(deg)));
}

/**
 * Points for LatheGeometry: x = radius (>=0), y = height.
 * Closed loops away from the axis become surfaces of revolution (e.g. torus).
 */
export function toLatheProfile(points: Pt[]): Pt[] {
  return closeLoop(points);
}

export function samePoint(a: Pt, b: Pt, eps = 0.05): boolean {
  return dist(a, b) <= eps;
}

/** Close a grid polygon when the user clicks near the first vertex. */
export function shouldClosePolygon(points: Pt[], next: Pt): boolean {
  if (points.length < 3) return false;
  return samePoint(points[0], next, GRID_STEP * 0.6);
}
