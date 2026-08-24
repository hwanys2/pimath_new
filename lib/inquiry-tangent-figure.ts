/**
 * SVG helpers for the tangent naming figure.
 *
 * SVG y grows *downward*. School-math "counterclockwise from +x" is therefore
 * the opposite of SVG's sweep-flag. Getting sweep wrong puts the angle mark
 * *under* the ground — a mistake this figure has made before.
 *
 * Interior angle sitting *above* a horizontal base:
 * - vertex on the LEFT (base runs +x): start on +x, sweep=0 (visually up)
 * - vertex on the RIGHT (base runs −x): start on −x, sweep=1 (visually up)
 */

export type GroundAngleArc = {
  d: string;
  sweep: 0 | 1;
  start: { x: number; y: number };
  end: { x: number; y: number };
};

export function groundElevationArc(input: {
  vx: number;
  vy: number;
  /** +1 = adjacent base goes right from the vertex; −1 = left. */
  baseDir: 1 | -1;
  radius: number;
  angleDeg: number;
}): GroundAngleArc {
  const { vx, vy, baseDir, radius, angleDeg } = input;
  const rad = (Math.max(1, Math.min(89, angleDeg)) * Math.PI) / 180;
  const start = { x: vx + baseDir * radius, y: vy };
  const end = {
    x: vx + baseDir * radius * Math.cos(rad),
    y: vy - radius * Math.sin(rad),
  };
  const sweep: 0 | 1 = baseDir === 1 ? 0 : 1;
  return {
    sweep,
    start,
    end,
    d: `M ${start.x} ${start.y} A ${radius} ${radius} 0 0 ${sweep} ${end.x} ${end.y}`,
  };
}
