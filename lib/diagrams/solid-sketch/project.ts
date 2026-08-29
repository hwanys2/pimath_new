import { type Circle3, type SolidMesh, circleBasis } from "./solids";
import {
  add3,
  cross3,
  dot3,
  len3,
  mul3,
  norm3,
  sub3,
  type Vec3,
} from "./vec3";

export type Cam = {
  eye: Vec3;
  right: Vec3;
  up: Vec3;
};

export type Proj = { x: number; y: number; z: number };

export function cameraFromView(azimuthDeg: number, elevationDeg: number): Cam {
  const az = (azimuthDeg * Math.PI) / 180;
  const el = (elevationDeg * Math.PI) / 180;
  const eye = {
    x: Math.cos(el) * Math.sin(az),
    y: Math.sin(el),
    z: Math.cos(el) * Math.cos(az),
  };
  const forward = { x: -eye.x, y: -eye.y, z: -eye.z };
  const worldUp = { x: 0, y: 1, z: 0 };
  let right = cross3(forward, worldUp);
  if (len3(right) < 1e-8) {
    right = { x: 1, y: 0, z: 0 };
  } else {
    right = norm3(right);
  }
  const up = norm3(cross3(right, forward));
  return { eye: norm3(eye), right, up };
}

export function project3(p: Vec3, cam: Cam): Proj {
  return {
    x: dot3(p, cam.right),
    y: dot3(p, cam.up),
    z: dot3(p, cam.eye),
  };
}

export function faceOutward(verts: Vec3[], face: number[]): Vec3 {
  const a = verts[face[0]!]!;
  const b = verts[face[1]!]!;
  const c = verts[face[2]!]!;
  return norm3(cross3(sub3(b, a), sub3(c, a)));
}

export function isFrontFace(normal: Vec3, cam: Cam): boolean {
  return dot3(normal, cam.eye) > 1e-6;
}

export function hiddenEdgeKeys(mesh: SolidMesh, cam: Cam): Set<string> {
  const adj = new Map<string, number[]>();
  const add = (a: number, b: number, fi: number) => {
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    const list = adj.get(key) ?? [];
    list.push(fi);
    adj.set(key, list);
  };
  const front = mesh.faces.map((face) =>
    isFrontFace(faceOutward(mesh.vertices, face), cam),
  );
  mesh.faces.forEach((face, fi) => {
    for (let i = 0; i < face.length; i++) {
      add(face[i]!, face[(i + 1) % face.length]!, fi);
    }
  });
  const hidden = new Set<string>();
  for (const [key, faces] of adj) {
    const anyFront = faces.some((fi) => front[fi]);
    if (!anyFront) hidden.add(key);
  }
  return hidden;
}

export function fillGray(normal: Vec3, cam: Cam): string {
  const light = norm3({ x: 0.35, y: 0.82, z: 0.45 });
  const lit = 0.5 + 0.5 * Math.max(0, dot3(normal, light));
  const toward = 0.5 + 0.5 * Math.max(0, dot3(normal, cam.eye));
  const t = 0.55 * lit + 0.45 * toward;
  const g = Math.round(232 + t * 18);
  const hex = g.toString(16).padStart(2, "0");
  return `#${hex}${hex}${hex}`;
}

export type Ellipse2 = {
  cx: number;
  cy: number;
  ux: number;
  uy: number;
  vx: number;
  vy: number;
};

export function projectCircle(circle: Circle3, cam: Cam, map: (p: Proj) => { x: number; y: number }): Ellipse2 {
  const { u, v } = circleBasis(circle.normal);
  const c = project3(circle.center, cam);
  const pu = project3(add3(circle.center, mul3(u, circle.radius)), cam);
  const pv = project3(add3(circle.center, mul3(v, circle.radius)), cam);
  const C = map(c);
  const U = map(pu);
  const V = map(pv);
  return {
    cx: C.x,
    cy: C.y,
    ux: U.x - C.x,
    uy: U.y - C.y,
    vx: V.x - C.x,
    vy: V.y - C.y,
  };
}

export function silRadial(axis: Vec3, cam: Cam): Vec3 | null {
  const radial = cross3(axis, cam.eye);
  if (len3(radial) < 1e-6) return null;
  return norm3(radial);
}

export function thetaFromWorld(circle: Circle3, world: Vec3): number {
  const { u, v } = circleBasis(circle.normal);
  const d = sub3(world, circle.center);
  return Math.atan2(dot3(d, v), dot3(d, u));
}

export function circleFacingCamera(circle: Circle3, cam: Cam): boolean {
  return dot3(norm3(circle.normal), cam.eye) > 1e-6;
}

export function backArcThrough(circle: Circle3, cam: Cam, t0: number, t1: number): boolean {
  const mid = (t0 + t1) / 2;
  const { u, v } = circleBasis(circle.normal);
  const radial = add3(mul3(u, Math.cos(mid)), mul3(v, Math.sin(mid)));
  return dot3(radial, cam.eye) < 0;
}

export type Fit = {
  scale: number;
  ox: number;
  oy: number;
};

export function fitProjected(
  pts: { x: number; y: number }[],
  width: number,
  height: number,
  padding: number,
): Fit {
  if (pts.length === 0) {
    return { scale: 1, ox: width / 2, oy: height / 2 };
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
  const bw = Math.max(maxX - minX, 1e-6);
  const bh = Math.max(maxY - minY, 1e-6);
  const scale = Math.min((width - padding * 2) / bw, (height - padding * 2) / bh);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return {
    scale,
    ox: width / 2 - cx * scale,
    oy: height / 2 + cy * scale,
  };
}

export function toCanvas(p: Proj, fit: Fit): { x: number; y: number } {
  return { x: fit.ox + p.x * fit.scale, y: fit.oy - p.y * fit.scale };
}
