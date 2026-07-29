import type { SolidType } from "../../board/geometry-types";
import type { SolidNetDef } from "./types";

function cubeNet(s: number): SolidNetDef {
  return {
    type: "cube",
    label: "정육면체",
    faces: [
      { id: "top", ux: s, uy: 0, w: s, h: s, foldAxis: "x", foldAngle: -90 },
      { id: "left", ux: 0, uy: s, w: s, h: s, foldAxis: "y", foldAngle: 90, parentId: "front" },
      { id: "front", ux: s, uy: s, w: s, h: s, foldAxis: "x", foldAngle: 0 },
      { id: "right", ux: s * 2, uy: s, w: s, h: s, foldAxis: "y", foldAngle: -90, parentId: "front" },
      { id: "bottom", ux: s, uy: s * 2, w: s, h: s, foldAxis: "x", foldAngle: 90, parentId: "front" },
      { id: "back", ux: s, uy: s * 3, w: s, h: s, foldAxis: "x", foldAngle: 180, parentId: "bottom" },
    ],
  };
}

function cuboidNet(a: number, b: number, c: number): SolidNetDef {
  return {
    type: "cuboid",
    label: "직육면체",
    faces: [
      { id: "top", ux: a, uy: 0, w: a, h: c, foldAxis: "x", foldAngle: -90 },
      { id: "left", ux: 0, uy: c, w: b, h: c, foldAxis: "y", foldAngle: 90, parentId: "front" },
      { id: "front", ux: b, uy: c, w: a, h: c, foldAxis: "x", foldAngle: 0 },
      { id: "right", ux: b + a, uy: c, w: b, h: c, foldAxis: "y", foldAngle: -90, parentId: "front" },
      { id: "bottom", ux: b, uy: c * 2, w: a, h: c, foldAxis: "x", foldAngle: 90, parentId: "front" },
      { id: "back", ux: b, uy: c * 3, w: a, h: c, foldAxis: "x", foldAngle: 180, parentId: "bottom" },
    ],
  };
}

function prismNet(a: number, h: number): SolidNetDef {
  const triH = (Math.sqrt(3) / 2) * a;
  return {
    type: "triangular_prism",
    label: "삼각기둥",
    faces: [
      { id: "rect1", ux: 0, uy: triH, w: a, h: h, foldAxis: "y", foldAngle: 0 },
      { id: "rect2", ux: a, uy: triH, w: a, h: h, foldAxis: "y", foldAngle: -120, parentId: "rect1" },
      { id: "rect3", ux: a * 2, uy: triH, w: a, h: h, foldAxis: "y", foldAngle: -120, parentId: "rect2" },
      { id: "tri1", ux: a * 0.5, uy: 0, w: a, h: triH, foldAxis: "x", foldAngle: -90 },
      { id: "tri2", ux: a * 0.5, uy: triH + h, w: a, h: triH, foldAxis: "x", foldAngle: 90, parentId: "rect1" },
    ],
  };
}

function pyramidNet(a: number, h: number): SolidNetDef {
  const slant = Math.hypot(a / 2, h);
  return {
    type: "square_pyramid",
    label: "정사각뿔",
    faces: [
      { id: "base", ux: slant, uy: slant, w: a, h: a, foldAxis: "x", foldAngle: 0 },
      { id: "t1", ux: slant, uy: 0, w: a, h: slant, foldAxis: "x", foldAngle: -70, parentId: "base" },
      { id: "t2", ux: slant + a, uy: slant, w: slant, h: a, foldAxis: "y", foldAngle: -70, parentId: "base" },
      { id: "t3", ux: slant, uy: slant + a, w: a, h: slant, foldAxis: "x", foldAngle: 70, parentId: "base" },
      { id: "t4", ux: 0, uy: slant, w: slant, h: a, foldAxis: "y", foldAngle: 70, parentId: "base" },
    ],
  };
}

function cylinderNet(r: number, h: number): SolidNetDef {
  const wrap = Math.PI * 2 * r;
  return {
    type: "cylinder",
    label: "원기둥",
    faces: [
      { id: "wrap", ux: 0, uy: r * 2, w: wrap, h: h, foldAxis: "x", foldAngle: 0 },
      { id: "top", ux: wrap / 2 - r, uy: 0, w: r * 2, h: r * 2, foldAxis: "x", foldAngle: -90, parentId: "wrap" },
      { id: "bottom", ux: wrap / 2 - r, uy: r * 2 + h, w: r * 2, h: r * 2, foldAxis: "x", foldAngle: 90, parentId: "wrap" },
    ],
  };
}

function coneNet(r: number, slant: number): SolidNetDef {
  const sector = Math.PI * r * 2;
  return {
    type: "cone",
    label: "원뿔",
    faces: [
      { id: "base", ux: sector / 2 - r, uy: slant + r, w: r * 2, h: r * 2, foldAxis: "x", foldAngle: 0 },
      {
        id: "sector",
        ux: 0,
        uy: 0,
        w: sector,
        h: slant,
        foldAxis: "x",
        foldAngle: -360,
        parentId: "base",
      },
    ],
  };
}

export function getSolidNet(
  type: SolidType,
  params: { a?: number; b?: number; c?: number; height?: number; radius?: number },
): SolidNetDef {
  const a = params.a ?? 72;
  const b = params.b ?? a;
  const c = params.c ?? a;
  const h = params.height ?? a;
  const r = params.radius ?? a / 2;
  switch (type) {
    case "cube":
      return cubeNet(a);
    case "cuboid":
      return cuboidNet(a, b, c);
    case "triangular_prism":
      return prismNet(a, h);
    case "square_pyramid":
      return pyramidNet(a, h);
    case "cylinder":
      return cylinderNet(r, h);
    case "cone":
      return coneNet(r, h);
    default:
      return cubeNet(a);
  }
}
