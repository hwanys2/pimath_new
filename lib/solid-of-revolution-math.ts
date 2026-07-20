/** Pure math for the 회전체 (solid of revolution) simulation. */

export type Pt = { x: number; y: number };

export type DrawMode = "grid" | "free" | "preset";

export type PresetId = "rectangle" | "triangle" | "semicircle" | "trapezoid";

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

/**
 * Ensure the profile starts/ends on the axis when possible so Lathe
 * produces a closed solid. Does not mutate if already on axis.
 */
export function sealProfileToAxis(points: Pt[]): Pt[] {
  if (points.length < 2) return points.map(clampToRightHalf);
  const sealed = points.map(clampToRightHalf);
  const first = sealed[0];
  const last = sealed[sealed.length - 1];
  if (first.x > 0.01) {
    sealed.unshift({ x: 0, y: first.y });
  } else {
    sealed[0] = { x: 0, y: first.y };
  }
  if (last.x > 0.01) {
    sealed.push({ x: 0, y: last.y });
  } else {
    sealed[sealed.length - 1] = { x: 0, y: last.y };
  }
  return dedupeConsecutive(sealed);
}

function dedupeConsecutive(points: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of points) {
    const prev = out[out.length - 1];
    if (!prev || dist(prev, p) > 1e-6) out.push(p);
  }
  return out;
}

export function isProfileReady(points: Pt[]): boolean {
  return sealProfileToAxis(points).length >= MIN_PROFILE_POINTS;
}

/** Degrees → radians for Three.js LatheGeometry phiLength. */
export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function clampAngle(deg: number): number {
  if (!Number.isFinite(deg)) return 0;
  return Math.max(0, Math.min(360, Math.round(deg)));
}

/**
 * Points for LatheGeometry: x = radius (>=0), y = height.
 * Input points are already in that convention after sealing.
 */
export function toLatheProfile(points: Pt[]): Pt[] {
  return sealProfileToAxis(points);
}

export function samePoint(a: Pt, b: Pt, eps = 0.05): boolean {
  return dist(a, b) <= eps;
}

/** Close a grid polygon when the user clicks near the first vertex. */
export function shouldClosePolygon(points: Pt[], next: Pt): boolean {
  if (points.length < 3) return false;
  return samePoint(points[0], next, GRID_STEP * 0.6);
}
