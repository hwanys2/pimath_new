import type { FaceNode, FoldTree, SolidMatch } from "./types";

const HALF_PI = Math.PI / 2;
/** Tetrahedron dihedral ≈ arccos(1/3) */
const TET_DIHEDRAL = Math.acos(1 / 3);
/** Square pyramid side-to-base ≈ for height≈0.9a */
const PYR_BASE = Math.PI / 2 - 0.15;
const PYR_SIDE = Math.PI / 2 - 0.25;

function equilateralVerts(side: number): [number, number, number][] {
  const h = (Math.sqrt(3) / 2) * side;
  return [
    [-side / 2, 0, -h / 3],
    [side / 2, 0, -h / 3],
    [0, 0, (2 * h) / 3],
  ];
}

function buildTetrahedronTree(side: number): FaceNode {
  const verts = equilateralVerts(side);
  const h = (Math.sqrt(3) / 2) * side;
  return {
    id: "base",
    shape: "polygon",
    size: [side, h],
    vertices: verts,
    color: "#f0a04b",
    children: [
      {
        id: "a",
        shape: "polygon",
        size: [side, h],
        vertices: verts,
        color: "#4da3ff",
        hinge: {
          pivot: [0, 0, -h / 3],
          axis: [1, 0, 0],
          angleFolded: Math.PI - TET_DIHEDRAL,
          childOffset: [0, 0, h / 3],
        },
        children: [],
      },
      {
        id: "b",
        shape: "polygon",
        size: [side, h],
        vertices: verts,
        color: "#5ecf6a",
        hinge: {
          pivot: [-side / 4, 0, h / 6],
          axis: [Math.cos(Math.PI / 6), 0, Math.sin(Math.PI / 6)],
          angleFolded: Math.PI - TET_DIHEDRAL,
          childOffset: [0, 0, h / 3],
        },
        children: [],
      },
      {
        id: "c",
        shape: "polygon",
        size: [side, h],
        vertices: verts,
        color: "#e85aad",
        hinge: {
          pivot: [side / 4, 0, h / 6],
          axis: [-Math.cos(Math.PI / 6), 0, Math.sin(Math.PI / 6)],
          angleFolded: Math.PI - TET_DIHEDRAL,
          childOffset: [0, 0, h / 3],
        },
        children: [],
      },
    ],
  };
}

function buildSquarePyramidTree(base: number, height: number): FaceNode {
  const hw = base / 2;
  const slant = Math.hypot(hw, height);
  const triH = Math.sqrt(slant * slant - hw * hw) || base * 0.8;
  const triVerts: [number, number, number][] = [
    [-hw, 0, 0],
    [hw, 0, 0],
    [0, 0, triH],
  ];
  return {
    id: "base",
    shape: "rect",
    size: [base, base],
    color: "#4da3ff",
    children: (
      [
        ["n", [0, 0, -hw], [1, 0, 0], "#5ecf6a"],
        ["s", [0, 0, hw], [1, 0, 0], "#f0a04b"],
        ["w", [-hw, 0, 0], [0, 0, 1], "#e85aad"],
        ["e", [hw, 0, 0], [0, 0, 1], "#2ec4b6"],
      ] as const
    ).map(([id, pivot, axis, color]) => ({
      id,
      shape: "polygon" as const,
      size: [base, triH] as [number, number],
      vertices: triVerts,
      color,
      hinge: {
        pivot: pivot as [number, number, number],
        axis: axis as [number, number, number],
        angleFolded: PYR_BASE,
        childOffset: [0, 0, triH / 3] as [number, number, number],
      },
      children: [],
    })),
  };
}

function buildTriangularPrismTree(side: number, length: number): FaceNode {
  const h = (Math.sqrt(3) / 2) * side;
  const verts = equilateralVerts(side);
  return {
    id: "bottom",
    shape: "rect",
    size: [side, length],
    color: "#4da3ff",
    children: [
      {
        id: "left",
        shape: "rect",
        size: [side, length],
        color: "#5ecf6a",
        hinge: {
          pivot: [-side / 2, 0, 0],
          axis: [0, 0, 1],
          angleFolded: (2 * Math.PI) / 3,
          childOffset: [-side / 2, 0, 0],
        },
        children: [],
      },
      {
        id: "right",
        shape: "rect",
        size: [side, length],
        color: "#f0a04b",
        hinge: {
          pivot: [side / 2, 0, 0],
          axis: [0, 0, 1],
          angleFolded: -(2 * Math.PI) / 3,
          childOffset: [side / 2, 0, 0],
        },
        children: [],
      },
      {
        id: "front",
        shape: "polygon",
        size: [side, h],
        vertices: verts,
        color: "#e85aad",
        hinge: {
          pivot: [0, 0, length / 2],
          axis: [1, 0, 0],
          angleFolded: HALF_PI,
          childOffset: [0, 0, h / 3],
        },
        children: [],
      },
      {
        id: "back",
        shape: "polygon",
        size: [side, h],
        vertices: verts,
        color: "#9b6bff",
        hinge: {
          pivot: [0, 0, -length / 2],
          axis: [1, 0, 0],
          angleFolded: -HALF_PI,
          childOffset: [0, 0, -h / 3],
        },
        children: [],
      },
    ],
  };
}

export function buildFoldTreeFromMatch(match: SolidMatch): FoldTree {
  const a = Math.max(0.4, match.dims.a);
  if (match.type === "cube") {
    return {
      type: "cube",
      label: match.label,
      root: { id: "root", shape: "rect", size: [a, a], children: [] },
      useBoxKeyframes: true,
      boxSize: [a, a, a],
    };
  }
  if (match.type === "cuboid") {
    const b = Math.max(0.4, match.dims.b ?? a);
    const c = Math.max(0.4, match.dims.c ?? a);
    return {
      type: "cuboid",
      label: match.label,
      root: { id: "root", shape: "rect", size: [a, b], children: [] },
      useBoxKeyframes: true,
      boxSize: [a, b, c],
    };
  }
  if (match.type === "tetrahedron") {
    return {
      type: "tetrahedron",
      label: match.label,
      root: buildTetrahedronTree(a),
    };
  }
  if (match.type === "squarePyramid") {
    const height = Math.max(0.3, match.dims.height ?? a * 0.9);
    return {
      type: "squarePyramid",
      label: match.label,
      root: buildSquarePyramidTree(a, height),
    };
  }
  const length = Math.max(0.4, match.dims.height ?? a * 1.2);
  return {
    type: "triangularPrism",
    label: match.label,
    root: buildTriangularPrismTree(a, length),
  };
}

void PYR_SIDE;
