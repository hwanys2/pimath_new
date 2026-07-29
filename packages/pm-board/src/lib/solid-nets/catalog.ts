import type { SolidType } from "../../board/geometry-types";
import type { FaceNode, SolidNetTree } from "./types";

const HALF_PI = Math.PI / 2;

function rectFace(
  id: string,
  w: number,
  d: number,
  hinge: FaceNode["hinge"],
  children: FaceNode[] = [],
): FaceNode {
  return { id, shape: "rect", size: [w, d], hinge, children };
}

function triFace(
  id: string,
  verts: [number, number, number][],
  hinge: FaceNode["hinge"],
  children: FaceNode[] = [],
): FaceNode {
  return {
    id,
    shape: "triangle",
    size: [0, 0],
    vertices: verts,
    hinge,
    children,
  };
}

/** Cross net: top / left-front-right / bottom / back */
function cubeTree(s: number): FaceNode {
  const h = s / 2;
  const back = rectFace("back", s, s, {
    pivot: [0, 0, h],
    axis: [1, 0, 0],
    angleFolded: HALF_PI,
    childOffset: [0, 0, h],
  });

  const bottom = rectFace(
    "bottom",
    s,
    s,
    {
      pivot: [0, 0, h],
      axis: [-1, 0, 0],
      angleFolded: HALF_PI,
      childOffset: [0, 0, h],
    },
    [back],
  );

  return rectFace("front", s, s, undefined, [
    rectFace("left", s, s, {
      pivot: [-h, 0, 0],
      axis: [0, 0, 1],
      angleFolded: HALF_PI,
      childOffset: [-h, 0, 0],
    }),
    rectFace("right", s, s, {
      pivot: [h, 0, 0],
      axis: [0, 0, -1],
      angleFolded: HALF_PI,
      childOffset: [h, 0, 0],
    }),
    rectFace("top", s, s, {
      pivot: [0, 0, -h],
      axis: [1, 0, 0],
      angleFolded: HALF_PI,
      childOffset: [0, 0, -h],
    }),
    bottom,
  ]);
}

/** a=front width, b=front depth, c=side height (Y when folded). */
function cuboidTree(a: number, b: number, c: number): FaceNode {
  const ha = a / 2;
  const hb = b / 2;
  const hc = c / 2;

  const back = rectFace("back", a, b, {
    pivot: [0, 0, hb],
    axis: [1, 0, 0],
    angleFolded: HALF_PI,
    childOffset: [0, 0, hb],
  });

  const bottom = rectFace(
    "bottom",
    a,
    b,
    {
      pivot: [0, 0, hb],
      axis: [-1, 0, 0],
      angleFolded: HALF_PI,
      childOffset: [0, 0, hb],
    },
    [back],
  );

  return rectFace("front", a, b, undefined, [
    rectFace("left", c, b, {
      pivot: [-ha, 0, 0],
      axis: [0, 0, 1],
      angleFolded: HALF_PI,
      childOffset: [-hc, 0, 0],
    }),
    rectFace("right", c, b, {
      pivot: [ha, 0, 0],
      axis: [0, 0, -1],
      angleFolded: HALF_PI,
      childOffset: [hc, 0, 0],
    }),
    rectFace("top", a, c, {
      pivot: [0, 0, -hb],
      axis: [1, 0, 0],
      angleFolded: HALF_PI,
      childOffset: [0, 0, -hc],
    }),
    bottom,
  ]);
}

/** Equilateral triangle side a, prism height h. */
function triangularPrismTree(a: number, height: number): FaceNode {
  const triH = (Math.sqrt(3) / 2) * a;
  const ht = triH / 2;
  const ha = a / 2;

  const triVerts: [number, number, number][] = [
    [0, 0, ht],
    [-ha, 0, -ht],
    [ha, 0, -ht],
  ];

  const rect3 = rectFace("rect3", a, height, {
    pivot: [ha, 0, 0],
    axis: [0, 0, -1],
    angleFolded: (2 * Math.PI) / 3,
    childOffset: [ha, 0, 0],
  });

  const rect2 = rectFace(
    "rect2",
    a,
    height,
    {
      pivot: [ha, 0, 0],
      axis: [0, 0, -1],
      angleFolded: (2 * Math.PI) / 3,
      childOffset: [ha, 0, 0],
    },
    [rect3],
  );

  const rect1 = rectFace(
    "rect1",
    a,
    height,
    undefined,
    [
      rect2,
      triFace("triTop", triVerts, {
        pivot: [0, 0, -height / 2],
        axis: [1, 0, 0],
        angleFolded: -HALF_PI,
        childOffset: [0, 0, -triH / 2],
      }),
      triFace("triBottom", triVerts, {
        pivot: [0, 0, height / 2],
        axis: [-1, 0, 0],
        angleFolded: HALF_PI,
        childOffset: [0, 0, triH / 2],
      }),
    ],
  );

  return rect1;
}

/** Square base a, apex height h (slant computed). */
function squarePyramidTree(a: number, h: number): FaceNode {
  const half = a / 2;
  const slant = Math.hypot(half, h);

  const triVerts = (flip: boolean): [number, number, number][] => {
    const apexZ = flip ? slant / 2 : -slant / 2;
    const baseZ = flip ? -slant / 2 : slant / 2;
    return [
      [0, 0, apexZ],
      [-half, 0, baseZ],
      [half, 0, baseZ],
    ];
  };

  const foldTri = (id: string, hingeSpec: NonNullable<FaceNode["hinge"]>) =>
    triFace(id, triVerts(false), hingeSpec);

  const t4 = foldTri("t4", {
    pivot: [-half, 0, 0],
    axis: [0, 0, 1],
    angleFolded: Math.atan2(h, half),
    childOffset: [-half, 0, 0],
  });

  const t3 = foldTri("t3", {
    pivot: [0, 0, half],
    axis: [-1, 0, 0],
    angleFolded: Math.atan2(h, half),
    childOffset: [0, 0, half],
  });

  const t2 = foldTri("t2", {
    pivot: [half, 0, 0],
    axis: [0, 0, -1],
    angleFolded: Math.atan2(h, half),
    childOffset: [half, 0, 0],
  });

  const t1 = foldTri("t1", {
    pivot: [0, 0, -half],
    axis: [1, 0, 0],
    angleFolded: Math.atan2(h, half),
    childOffset: [0, 0, -half],
  });

  return rectFace("base", a, a, undefined, [t1, t2, t3, t4]);
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
  const a = params.a ?? 2;
  const b = params.b ?? a;
  const c = params.c ?? a;
  const h = params.height ?? a;

  switch (type) {
    case "cube":
      return {
        type,
        label: "정육면체",
        root: cubeTree(a),
        hingeSupported: true,
      };
    case "cuboid":
      return {
        type,
        label: "직육면체",
        root: cuboidTree(a, b, c),
        hingeSupported: true,
      };
    case "triangular_prism":
      return {
        type,
        label: "삼각기둥",
        root: triangularPrismTree(a, h),
        hingeSupported: true,
      };
    case "square_pyramid":
      return {
        type,
        label: "정사각뿔",
        root: squarePyramidTree(a, h),
        hingeSupported: true,
      };
    case "cylinder":
      return {
        type,
        label: "원기둥",
        root: rectFace("stub", a, h, undefined),
        hingeSupported: false,
      };
    case "cone":
      return {
        type,
        label: "원뿔",
        root: rectFace("stub", a, h, undefined),
        hingeSupported: false,
      };
    default:
      return {
        type: "cube",
        label: "정육면체",
        root: cubeTree(a),
        hingeSupported: true,
      };
  }
}

/** @deprecated use getSolidNetTree */
export function getSolidNet(
  type: SolidType,
  params: Parameters<typeof getSolidNetTree>[1],
) {
  const t = getSolidNetTree(type, params);
  return { type: t.type, label: t.label, faces: [] };
}
