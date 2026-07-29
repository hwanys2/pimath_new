import type { SolidType } from "../../board/geometry-types";
import type { FaceNode, SolidNetTree } from "./types";
import { buildBoxFaceKeyframes } from "./box-fold-keyframes";

function prismTree(a: number, height: number): FaceNode {
  const triH = (Math.sqrt(3) / 2) * a;
  const ht = triH / 2;
  const ha = a / 2;
  const triVerts: [number, number, number][] = [
    [0, 0, ht],
    [-ha, 0, -ht],
    [ha, 0, -ht],
  ];
  return {
    id: "rect1",
    shape: "rect",
    size: [a, height],
    children: [],
  };
}

export function sceneParamsFromApi(params: {
  a?: number;
  b?: number;
  c?: number;
  height?: number;
  radius?: number;
}): typeof params {
  const norm = (v: number | undefined, fallback: number) => {
    const x = v ?? fallback;
    if (x > 15) return x / 40;
    if (x > 0 && x <= 15) return x;
    return 2;
  };
  const a = norm(params.a, 80);
  return {
    a,
    b: params.b != null ? norm(params.b, params.b) : undefined,
    c: params.c != null ? norm(params.c, params.c) : undefined,
    height:
      params.height != null ? norm(params.height, params.height) : undefined,
    radius:
      params.radius != null ? norm(params.radius, params.radius) : undefined,
  };
}

export function boxDimensionsFromParams(
  type: SolidType,
  params: ReturnType<typeof sceneParamsFromApi>,
): { width: number; depth: number; height: number } | null {
  const a = params.a ?? 2;
  const b = params.b ?? a;
  const c = params.c ?? a;
  const h = params.height ?? a;
  if (type === "cube") {
    return { width: a, depth: a, height: a };
  }
  if (type === "cuboid") {
    return { width: a, depth: b, height: c };
  }
  return null;
}

export function getSolidNetTree(
  type: SolidType,
  params: {
    a?: number;
    b?: number;
    c?: number;
    height?: number;
    radius?: number;
  },
): SolidNetTree {
  const p = sceneParamsFromApi(params);
  const a = p.a ?? 2;
  const h = p.height ?? a;

  const box = boxDimensionsFromParams(type, p);
  if (box) {
    buildBoxFaceKeyframes(box.width, box.depth, box.height);
    return {
      type,
      label: type === "cube" ? "정육면체" : "직육면체",
      root: { id: "front", shape: "rect", size: [box.width, box.depth], children: [] },
      hingeSupported: true,
    };
  }

  switch (type) {
    case "triangular_prism":
      return {
        type,
        label: "삼각기둥",
        root: prismTree(a, h),
        hingeSupported: true,
      };
    case "square_pyramid":
      return {
        type,
        label: "정사각뿔",
        root: prismTree(a, h),
        hingeSupported: true,
      };
    case "cylinder":
      return {
        type,
        label: "원기둥",
        root: { id: "stub", shape: "rect", size: [a, h], children: [] },
        hingeSupported: false,
      };
    case "cone":
      return {
        type,
        label: "원뿔",
        root: { id: "stub", shape: "rect", size: [a, h], children: [] },
        hingeSupported: false,
      };
    default:
      return getSolidNetTree("cube", params);
  }
}

export function getSolidNet(
  type: SolidType,
  params: Parameters<typeof getSolidNetTree>[1],
) {
  const t = getSolidNetTree(type, params);
  return { type: t.type, label: t.label, faces: [] };
}
