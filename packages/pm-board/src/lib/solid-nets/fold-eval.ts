import type { FaceNode, Hinge } from "./types";
import { hingeAngleRad } from "./fold-math";

export type Vec3 = [number, number, number];
export type Mat4 = readonly number[];

const EPS = 1e-5;

export function mat4Identity(): Mat4 {
  return [
    1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
  ];
}

export function mat4Multiply(a: Mat4, b: Mat4): Mat4 {
  const out = new Array<number>(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] =
        a[0 * 4 + r] * b[c * 4 + 0] +
        a[1 * 4 + r] * b[c * 4 + 1] +
        a[2 * 4 + r] * b[c * 4 + 2] +
        a[3 * 4 + r] * b[c * 4 + 3];
    }
  }
  return out;
}

export function mat4FromTranslation(x: number, y: number, z: number): Mat4 {
  return [
    1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1,
  ];
}

export function mat4FromAxisAngle(
  ax: number,
  ay: number,
  az: number,
  angle: number,
): Mat4 {
  const len = Math.hypot(ax, ay, az) || 1;
  const x = ax / len;
  const y = ay / len;
  const z = az / len;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const t = 1 - c;
  return [
    t * x * x + c,
    t * x * y + s * z,
    t * x * z - s * y,
    0,
    t * x * y - s * z,
    t * y * y + c,
    t * y * z + s * x,
    0,
    t * x * z + s * y,
    t * y * z - s * x,
    t * z * z + c,
    0,
    0,
    0,
    0,
    1,
  ];
}

export function mat4TransformPoint(m: Mat4, p: Vec3): Vec3 {
  const x = p[0];
  const y = p[1];
  const z = p[2];
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ];
}

/** Rect face corners in local XZ (matches PlaneGeometry + rotateX(-π/2)). */
export function rectCornersLocal(w: number, d: number): Vec3[] {
  const hw = w / 2;
  const hd = d / 2;
  return [
    [-hw, 0, hd],
    [hw, 0, hd],
    [hw, 0, -hd],
    [-hw, 0, -hd],
  ];
}

function traverseFaces(
  node: FaceNode,
  world: Mat4,
  unfoldT: number,
  out: { id: string; corners: Vec3[]; normal: Vec3 }[],
): void {
  if (node.shape === "rect") {
    const [w, d] = node.size;
    const corners = rectCornersLocal(w, d).map((c) => mat4TransformPoint(world, c));
    const normal = mat4TransformPoint(world, [0, 1, 0]);
    const origin = mat4TransformPoint(world, [0, 0, 0]);
    const n: Vec3 = [
      normal[0] - origin[0],
      normal[1] - origin[1],
      normal[2] - origin[2],
    ];
    const len = Math.hypot(n[0], n[1], n[2]) || 1;
    out.push({
      id: node.id,
      corners,
      normal: [n[0] / len, n[1] / len, n[2] / len],
    });
  }

  for (const child of node.children) {
    const hinge = child.hinge;
    if (!hinge) continue;
    const angle = hingeAngleRad(hinge, unfoldT);
    const chain = mat4Multiply(
      world,
      mat4Multiply(
        mat4FromTranslation(...hinge.pivot),
        mat4Multiply(
          mat4FromAxisAngle(...hinge.axis, angle),
          mat4FromTranslation(...hinge.childOffset),
        ),
      ),
    );
    traverseFaces(child, chain, unfoldT, out);
  }
}

export function evaluateBoxFold(
  root: FaceNode,
  unfoldT: number,
  options?: { rootTiltX?: number },
): { id: string; corners: Vec3[]; normal: Vec3 }[] {
  const tilt = options?.rootTiltX ?? 0;
  const rootMat =
    tilt === 0
      ? mat4Identity()
      : mat4FromAxisAngle(1, 0, 0, tilt * unfoldT);
  const out: { id: string; corners: Vec3[]; normal: Vec3 }[] = [];
  traverseFaces(root, rootMat, unfoldT, out);
  return out;
}

export function uniqueVertices(
  faces: { corners: Vec3[] }[],
  tol = 1e-4,
): Vec3[] {
  const pts: Vec3[] = [];
  for (const f of faces) {
    for (const c of f.corners) {
      if (!pts.some((p) => dist(p, c) < tol)) pts.push(c);
    }
  }
  return pts;
}

function dist(a: Vec3, b: Vec3) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

export function expectCoplanarUnfold(
  root: FaceNode,
  unfoldT = 0,
): boolean {
  const faces = evaluateBoxFold(root, unfoldT);
  if (faces.length !== 6) return false;
  for (const f of faces) {
    if (Math.abs(f.normal[1] - 1) > 0.01) return false;
    for (const c of f.corners) {
      if (Math.abs(c[1]) > 0.01) return false;
    }
  }
  return true;
}

/** Closed box axis-aligned bounds check at unfoldT=1. */
export function expectClosedBox(
  root: FaceNode,
  width: number,
  depth: number,
  height: number,
  unfoldT = 1,
): boolean {
  const faces = evaluateBoxFold(root, unfoldT);
  const verts = uniqueVertices(faces, 1e-3);
  if (verts.length !== 8) return false;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const [x, y, z] of verts) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }

  const w = maxX - minX;
  const h = maxY - minY;
  const d = maxZ - minZ;
  const ok =
    Math.abs(w - width) < 0.02 &&
    Math.abs(h - height) < 0.02 &&
    Math.abs(d - depth) < 0.02;
  return ok;
}

export function nearlyEqual(a: number, b: number, tol = EPS) {
  return Math.abs(a - b) < tol;
}
