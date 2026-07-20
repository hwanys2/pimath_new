/** Math helpers for the sector → rectangle area simulation (중1 · 3.3). */

export const MIN_THETA = 30;
export const MAX_THETA = 360;
export const DEFAULT_THETA = 90;

export const MIN_DIVISIONS = 4;
export const MAX_DIVISIONS = 48;
export const DEFAULT_DIVISIONS = 8;

/** Display / formula radius (symbolic units, not SVG pixels). */
export const DISPLAY_RADIUS = 5;

export function clampTheta(deg: number): number {
  if (!Number.isFinite(deg)) return DEFAULT_THETA;
  return Math.min(MAX_THETA, Math.max(MIN_THETA, Math.round(deg)));
}

/** Force even division count so alternating tip-up / tip-down packs cleanly. */
export function clampDivisions(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_DIVISIONS;
  let v = Math.round(n);
  v = Math.min(MAX_DIVISIONS, Math.max(MIN_DIVISIONS, v));
  if (v % 2 !== 0) v += 1;
  if (v > MAX_DIVISIONS) v = MAX_DIVISIONS;
  return v;
}

/** Arc length ℓ = (θ/360) × 2πr */
export function arcLength(thetaDeg: number, r: number): number {
  return (thetaDeg / 360) * 2 * Math.PI * r;
}

/** Sector area = (θ/360) × πr² = ½ r ℓ */
export function sectorArea(thetaDeg: number, r: number): number {
  return (thetaDeg / 360) * Math.PI * r * r;
}

export function pieceAngle(thetaDeg: number, divisions: number): number {
  return thetaDeg / divisions;
}

/** Approximating rectangle after zigzag rearrange: width ≈ ℓ/2, height ≈ r */
export function rectangleDims(thetaDeg: number, r: number): {
  width: number;
  height: number;
} {
  return {
    width: arcLength(thetaDeg, r) / 2,
    height: r,
  };
}

export function formatNum(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return "—";
  const fixed = n.toFixed(digits);
  return fixed.replace(/\.?0+$/, "");
}

export type WedgePose = {
  /** Apex x */
  ax: number;
  /** Apex y */
  ay: number;
  /** Bisector angle in degrees (0 = east, CCW, screen y-down negated in polar). */
  bisectorDeg: number;
  /** true → tip at bottom (wedge opens upward) */
  tipUp: boolean;
};

/**
 * Sector layout: full sector bisector points upward (90°).
 * Piece i spans [i·α, (i+1)·α] within the sector, centered on the bisector.
 */
export function sectorWedgePose(
  index: number,
  thetaDeg: number,
  divisions: number,
  cx: number,
  cy: number,
): WedgePose {
  const alpha = pieceAngle(thetaDeg, divisions);
  const sectorStart = 90 - thetaDeg / 2;
  const mid = sectorStart + index * alpha + alpha / 2;
  return {
    ax: cx,
    ay: cy,
    bisectorDeg: mid,
    tipUp: true,
  };
}

/**
 * Rectangle zigzag layout.
 * Even indices: apex at bottom (opens up); odd: apex at top (opens down).
 * Total width ≈ ℓ/2 in display units, mapped to SVG via scale.
 */
export function rectWedgePose(
  index: number,
  divisions: number,
  rectLeft: number,
  rectTop: number,
  rectW: number,
  rectH: number,
): WedgePose {
  const slotW = rectW / divisions;
  const cx = rectLeft + index * slotW + slotW / 2;
  const tipUp = index % 2 === 0;
  return {
    ax: cx,
    ay: tipUp ? rectTop + rectH : rectTop,
    bisectorDeg: tipUp ? 90 : 270,
    tipUp,
  };
}

/** Polar helper: 0° = east, CCW, SVG y grows downward. */
export function polar(
  cx: number,
  cy: number,
  deg: number,
  r: number,
): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy - r * Math.sin(rad),
  };
}

/** Wedge path: apex → start ray → arc → end ray → close. */
export function wedgePath(
  ax: number,
  ay: number,
  bisectorDeg: number,
  halfAngleDeg: number,
  r: number,
): string {
  const from = bisectorDeg - halfAngleDeg;
  const to = bisectorDeg + halfAngleDeg;
  const start = polar(ax, ay, from, r);
  const end = polar(ax, ay, to, r);
  const sweep = to - from;
  const large = sweep > 180 ? 1 : 0;
  // SVG arc sweep-flag: with y-down, CCW in math angles needs sweep=0
  // (our polar uses math CCW; screen path from `from` to `to` CCW = sweep 0).
  return [
    `M ${ax} ${ay}`,
    `L ${start.x} ${start.y}`,
    `A ${r} ${r} 0 ${large} 0 ${end.x} ${end.y}`,
    "Z",
  ].join(" ");
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Shortest-path angle lerp in degrees. */
export function lerpAngle(a: number, b: number, t: number): number {
  let d = ((b - a + 540) % 360) - 180;
  return a + d * t;
}

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}
