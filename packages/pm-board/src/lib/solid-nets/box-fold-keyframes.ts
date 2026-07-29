import type { Mat4 } from "./fold-eval";
import {
  mat4FromAxisAngle,
  mat4FromTranslation,
  mat4Identity,
  mat4Multiply,
} from "./fold-eval";

export type BoxFaceId =
  | "front"
  | "back"
  | "left"
  | "right"
  | "top"
  | "bottom";

export type BoxFaceKeyframe = {
  id: BoxFaceId;
  /** width along local X, depth along local Z (face in XZ when unfolded) */
  size: [number, number];
  unfold: Mat4;
  folded: Mat4;
};

function T(x: number, y: number, z: number): Mat4 {
  return mat4FromTranslation(x, y, z);
}

function Rx(a: number): Mat4 {
  return mat4FromAxisAngle(1, 0, 0, a);
}

function Ry(a: number): Mat4 {
  return mat4FromAxisAngle(0, 1, 0, a);
}

function Rz(a: number): Mat4 {
  return mat4FromAxisAngle(0, 0, 1, a);
}

const HALF_PI = Math.PI / 2;

function faceToNormal(nx: number, ny: number, nz: number): Mat4 {
  if (Math.abs(ny - 1) < 1e-6 && Math.abs(nx) < 1e-6 && Math.abs(nz) < 1e-6) {
    return mat4Identity();
  }
  if (Math.abs(ny + 1) < 1e-6) {
    return Rx(Math.PI);
  }
  if (Math.abs(nz - 1) < 1e-6) {
    return Rx(HALF_PI);
  }
  if (Math.abs(nz + 1) < 1e-6) {
    return Rx(-HALF_PI);
  }
  if (Math.abs(nx - 1) < 1e-6) {
    return Rz(HALF_PI);
  }
  if (Math.abs(nx + 1) < 1e-6) {
    return Rz(-HALF_PI);
  }
  const y: [number, number, number] = [0, 1, 0];
  const t: [number, number, number] = [nx, ny, nz];
  const cx = y[1] * t[2] - y[2] * t[1];
  const cy = y[2] * t[0] - y[0] * t[2];
  const cz = y[0] * t[1] - y[1] * t[0];
  const s = Math.hypot(cx, cy, cz);
  const c = y[0] * t[0] + y[1] * t[1] + y[2] * t[2];
  if (s < 1e-8) {
    return c < 0 ? Rx(Math.PI) : mat4Identity();
  }
  const angle = Math.atan2(s, c);
  return mat4FromAxisAngle(cx / s, cy / s, cz / s, angle);
}

/**
 * Cross net keyframes for box width×depth×height (full edge lengths).
 * Folded box centered at origin.
 */
export function buildBoxFaceKeyframes(
  width: number,
  depth: number,
  height: number,
): BoxFaceKeyframe[] {
  const W = width;
  const D = depth;
  const H = height;
  const hw = W / 2;
  const hd = D / 2;
  const hh = H / 2;

  const unfoldFront = T(0, 0, 0);
  const unfoldLeft = T(-(hw + hh), 0, 0);
  const unfoldRight = T(hw + hh, 0, 0);
  const unfoldTop = T(0, 0, -(hd + hd));
  const unfoldBottom = T(0, 0, hd + hd);
  const unfoldBack = T(0, 0, hd + hd + hd);

  const foldedFront = mat4Multiply(T(0, 0, hd), faceToNormal(0, 0, 1));
  const foldedBack = mat4Multiply(T(0, 0, -hd), faceToNormal(0, 0, -1));
  const foldedLeft = mat4Multiply(T(-hw, 0, 0), faceToNormal(-1, 0, 0));
  const foldedRight = mat4Multiply(T(hw, 0, 0), faceToNormal(1, 0, 0));
  const foldedTop = mat4Multiply(T(0, hh, 0), faceToNormal(0, 1, 0));
  const foldedBottom = mat4Multiply(T(0, -hh, 0), faceToNormal(0, -1, 0));

  return [
    { id: "front", size: [W, D], unfold: unfoldFront, folded: foldedFront },
    { id: "left", size: [H, D], unfold: unfoldLeft, folded: foldedLeft },
    { id: "right", size: [H, D], unfold: unfoldRight, folded: foldedRight },
    { id: "top", size: [W, D], unfold: unfoldTop, folded: foldedTop },
    { id: "bottom", size: [W, D], unfold: unfoldBottom, folded: foldedBottom },
    { id: "back", size: [W, D], unfold: unfoldBack, folded: foldedBack },
  ];
}

export function lerpMat4(a: Mat4, b: Mat4, t: number): Mat4 {
  const out = new Array<number>(16);
  for (let i = 0; i < 16; i++) {
    out[i] = a[i] + (b[i] - a[i]) * t;
  }
  return out;
}
