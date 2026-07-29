import type { FaceNode } from "./types";
import {
  buildBoxFaceKeyframes,
  lerpMat4,
  type BoxFaceKeyframe,
} from "./box-fold-keyframes";
import {
  evaluateBoxFold,
  expectClosedBox,
  expectCoplanarUnfold,
  mat4TransformPoint,
  rectCornersLocal,
  uniqueVertices,
  type Mat4,
} from "./fold-eval";

/** Legacy hinge tree (prism/pyramid); cube/cuboid use keyframes in the scene. */
export function buildBoxFoldTree(
  width: number,
  depth: number,
  height: number,
): FaceNode {
  const W = width;
  const D = depth;
  const H = height;
  const hw = W / 2;
  const hd = D / 2;
  const hh = H / 2;
  return {
    id: "front",
    shape: "rect",
    size: [W, D],
    children: [
      {
        id: "left",
        shape: "rect",
        size: [H, D],
        hinge: {
          pivot: [-hw, 0, 0],
          axis: [0, 0, 1],
          angleFolded: Math.PI / 2,
          childOffset: [-hh, 0, 0],
        },
        children: [],
      },
    ],
  };
}

export function buildCubeFoldTree(side: number): FaceNode {
  return buildBoxFoldTree(side, side, side);
}

export function evaluateBoxKeyframes(
  width: number,
  depth: number,
  height: number,
  unfoldT: number,
): { id: string; corners: import("./fold-eval").Vec3[] }[] {
  const faces = buildBoxFaceKeyframes(width, depth, height);
  return faces.map((f) => ({
    id: f.id,
    corners: rectCornersLocal(f.size[0], f.size[1]).map((c) =>
      mat4TransformPoint(lerpMat4(f.unfold, f.folded, unfoldT), c),
    ),
  }));
}

export function expectKeyframeCoplanar(
  w: number,
  d: number,
  h: number,
): boolean {
  const faces = evaluateBoxKeyframes(w, d, h, 0);
  for (const f of faces) {
    for (const c of f.corners) {
      if (Math.abs(c[1]) > 0.02) return false;
    }
  }
  return faces.length === 6;
}

export function expectKeyframeClosedBox(
  w: number,
  d: number,
  h: number,
): boolean {
  const faces = evaluateBoxKeyframes(w, d, h, 1);
  const verts = uniqueVertices(faces, 0.08);
  if (verts.length < 8) return false;
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
    maxY = Math.max(maxY, y);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }
  return (
    Math.abs(maxX - minX - w) < 0.03 &&
    Math.abs(maxY - minY - h) < 0.03 &&
    Math.abs(maxZ - minZ - d) < 0.03
  );
}

export type { BoxFaceKeyframe };
