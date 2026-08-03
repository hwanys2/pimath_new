import {
  mat4FromAxisAngle,
  mat4FromTranslation,
  mat4Identity,
  mat4Multiply,
  type Mat4,
} from "./mat4";

export type BoxFaceId =
  | "front"
  | "back"
  | "left"
  | "right"
  | "top"
  | "bottom";

export type BoxFaceKeyframe = {
  id: BoxFaceId;
  size: [number, number];
  unfold: Mat4;
  folded: Mat4;
  color: string;
};

function T(x: number, y: number, z: number): Mat4 {
  return mat4FromTranslation(x, y, z);
}
function Rx(a: number): Mat4 {
  return mat4FromAxisAngle(1, 0, 0, a);
}
function Rz(a: number): Mat4 {
  return mat4FromAxisAngle(0, 0, 1, a);
}

const HALF_PI = Math.PI / 2;

function faceToNormal(nx: number, ny: number, nz: number): Mat4 {
  if (Math.abs(ny - 1) < 1e-6 && Math.abs(nx) < 1e-6 && Math.abs(nz) < 1e-6) {
    return mat4Identity();
  }
  if (Math.abs(ny + 1) < 1e-6) return Rx(Math.PI);
  if (Math.abs(nz - 1) < 1e-6) return Rx(HALF_PI);
  if (Math.abs(nz + 1) < 1e-6) return Rx(-HALF_PI);
  if (Math.abs(nx - 1) < 1e-6) return Rz(HALF_PI);
  if (Math.abs(nx + 1) < 1e-6) return Rz(-HALF_PI);
  return mat4Identity();
}

const COLORS: Record<BoxFaceId, string> = {
  front: "#4da3ff",
  back: "#4da3ff",
  left: "#7ec8f5",
  right: "#7ec8f5",
  top: "#5ecf6a",
  bottom: "#5ecf6a",
};

/** Cross-net keyframes; folded box centered at origin. */
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

  return [
    {
      id: "front",
      size: [W, D],
      color: COLORS.front,
      unfold: T(0, 0, 0),
      folded: mat4Multiply(T(0, 0, hd), faceToNormal(0, 0, 1)),
    },
    {
      id: "left",
      size: [H, D],
      color: COLORS.left,
      unfold: T(-(hw + hh), 0, 0),
      folded: mat4Multiply(T(-hw, 0, 0), faceToNormal(-1, 0, 0)),
    },
    {
      id: "right",
      size: [H, D],
      color: COLORS.right,
      unfold: T(hw + hh, 0, 0),
      folded: mat4Multiply(T(hw, 0, 0), faceToNormal(1, 0, 0)),
    },
    {
      id: "top",
      size: [W, D],
      color: COLORS.top,
      unfold: T(0, 0, -(hd + hd)),
      folded: mat4Multiply(T(0, hh, 0), faceToNormal(0, 1, 0)),
    },
    {
      id: "bottom",
      size: [W, D],
      color: COLORS.bottom,
      unfold: T(0, 0, hd + hd),
      folded: mat4Multiply(T(0, -hh, 0), faceToNormal(0, -1, 0)),
    },
    {
      id: "back",
      size: [W, D],
      color: COLORS.back,
      unfold: T(0, 0, hd + hd + hd),
      folded: mat4Multiply(T(0, 0, -hd), faceToNormal(0, 0, -1)),
    },
  ];
}
