export type Vec3 = { x: number; y: number; z: number };

export function v3(x: number, y: number, z: number): Vec3 {
  return { x, y, z };
}

export function add3(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function sub3(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function mul3(a: Vec3, s: number): Vec3 {
  return { x: a.x * s, y: a.y * s, z: a.z * s };
}

export function dot3(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function cross3(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function len3(a: Vec3): number {
  return Math.hypot(a.x, a.y, a.z);
}

export function norm3(a: Vec3): Vec3 {
  const l = len3(a);
  if (l < 1e-12) return { x: 1, y: 0, z: 0 };
  return { x: a.x / l, y: a.y / l, z: a.z / l };
}

export function dist3(a: Vec3, b: Vec3): number {
  return len3(sub3(a, b));
}

export function centroid3(pts: Vec3[]): Vec3 {
  if (pts.length === 0) return { x: 0, y: 0, z: 0 };
  let x = 0;
  let y = 0;
  let z = 0;
  for (const p of pts) {
    x += p.x;
    y += p.y;
    z += p.z;
  }
  const n = pts.length;
  return { x: x / n, y: y / n, z: z / n };
}

export function scaleAbout(pts: Vec3[], origin: Vec3, s: number): Vec3[] {
  return pts.map((p) => add3(origin, mul3(sub3(p, origin), s)));
}

export function translate3(pts: Vec3[], d: Vec3): Vec3[] {
  return pts.map((p) => add3(p, d));
}
