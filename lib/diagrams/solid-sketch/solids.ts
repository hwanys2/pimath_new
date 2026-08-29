import {
  defaultVertexNames,
  familyHasSlant,
  familyIsRound,
  type SolidSketchState,
} from "./model";
import {
  add3,
  centroid3,
  cross3,
  dist3,
  dot3,
  len3,
  mul3,
  norm3,
  sub3,
  v3,
  type Vec3,
} from "./vec3";

export type Circle3 = {
  id: "base" | "top";
  center: Vec3;
  normal: Vec3;
  radius: number;
};

export type SolidMesh = {
  vertices: Vec3[];
  names: string[];
  faces: number[][];
  edges: [number, number][];
  circles: Circle3[];
  apexIndex: number | null;
  baseCenter: Vec3 | null;
  topCenter: Vec3 | null;
  axis: Vec3 | null;
  sphereRadius: number | null;
};

const PHI = (1 + Math.sqrt(5)) / 2;

function circumRFromSide(n: number, side: number): number {
  return side / (2 * Math.sin(Math.PI / n));
}

function regularNgon(n: number, radius: number, y: number): Vec3[] {
  const pts: Vec3[] = [];
  for (let i = 0; i < n; i++) {
    const th = Math.PI + (2 * Math.PI * i) / n;
    pts.push(v3(radius * Math.sin(th), y, radius * Math.cos(th)));
  }
  return pts;
}

function rect4(width: number, depth: number, y: number): Vec3[] {
  const hw = width / 2;
  const hd = depth / 2;
  return [
    v3(-hw, y, -hd),
    v3(-hw, y, hd),
    v3(hw, y, hd),
    v3(hw, y, -hd),
  ];
}

function uniqueEdges(faces: number[][]): [number, number][] {
  const seen = new Set<string>();
  const edges: [number, number][] = [];
  for (const face of faces) {
    for (let i = 0; i < face.length; i++) {
      const a = face[i]!;
      const b = face[(i + 1) % face.length]!;
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push(a < b ? [a, b] : [b, a]);
    }
  }
  return edges;
}

function faceNormal(verts: Vec3[], face: number[]): Vec3 {
  const a = verts[face[0]!]!;
  const b = verts[face[1]!]!;
  const c = verts[face[2]!]!;
  return norm3(cross3(sub3(b, a), sub3(c, a)));
}

function orderFace(verts: Vec3[], indices: number[], outward: Vec3): number[] {
  const pts = indices.map((i) => verts[i]!);
  const c = centroid3(pts);
  const u = norm3(sub3(pts[0]!, c));
  const w = norm3(cross3(outward, u));
  const ordered = indices
    .map((i) => {
      const p = sub3(verts[i]!, c);
      return { i, ang: Math.atan2(dot3(p, w), dot3(p, u)) };
    })
    .sort((a, b) => a.ang - b.ang)
    .map((item) => item.i);
  const n = faceNormal(verts, ordered);
  if (dot3(n, outward) < 0) ordered.reverse();
  return ordered;
}

export function convexHullFaces(verts: Vec3[]): number[][] {
  const n = verts.length;
  if (n < 3) return [];
  const scale = verts.reduce((m, p) => Math.max(m, Math.abs(p.x), Math.abs(p.y), Math.abs(p.z)), 1);
  const eps = 1e-7 * (1 + scale);
  const cloud = centroid3(verts);
  const planeKeys = new Map<string, { indices: number[]; outward: Vec3 }>();

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      for (let k = j + 1; k < n; k++) {
        const a = verts[i]!;
        const nrm = cross3(sub3(verts[j]!, a), sub3(verts[k]!, a));
        if (len3(nrm) < eps) continue;
        const on: number[] = [];
        let pos = 0;
        let neg = 0;
        for (let t = 0; t < n; t++) {
          const d = dot3(nrm, sub3(verts[t]!, a));
          if (d > eps) pos += 1;
          else if (d < -eps) neg += 1;
          else on.push(t);
        }
        if (pos > 0 && neg > 0) continue;
        if (on.length < 3) continue;
        let outward = norm3(nrm);
        if (dot3(outward, sub3(cloud, a)) > 0) outward = mul3(outward, -1);
        const key = [...on].sort((x, y) => x - y).join(",");
        if (!planeKeys.has(key)) {
          planeKeys.set(key, { indices: on, outward });
        }
      }
    }
  }

  return [...planeKeys.values()].map((face) =>
    orderFace(verts, face.indices, face.outward),
  );
}

function meshFromVertices(
  vertices: Vec3[],
  names: string[],
    extra: Partial<Pick<SolidMesh, "circles" | "apexIndex" | "baseCenter" | "topCenter" | "axis" | "sphereRadius">> = {},
): SolidMesh {
  const faces = convexHullFaces(vertices);
  return {
    vertices,
    names,
    faces,
    edges: uniqueEdges(faces),
    circles: extra.circles ?? [],
    apexIndex: extra.apexIndex ?? null,
    baseCenter: extra.baseCenter ?? null,
    topCenter: extra.topCenter ?? null,
    axis: extra.axis ?? null,
    sphereRadius: extra.sphereRadius ?? null,
  };
}

function pickNames(state: SolidSketchState, count: number): string[] {
  const fallback = defaultVertexNames(count);
  return fallback.map((name, i) => {
    const custom = state.vertexNames[i]?.trim();
    return custom && custom.length > 0 ? custom : name;
  });
}

function scaleToEdge(verts: Vec3[], edgeLength: number): Vec3[] {
  let min = Infinity;
  for (let i = 0; i < verts.length; i++) {
    for (let j = i + 1; j < verts.length; j++) {
      const d = dist3(verts[i]!, verts[j]!);
      if (d > 1e-6 && d < min) min = d;
    }
  }
  if (!Number.isFinite(min) || min < 1e-9) return verts;
  const s = edgeLength / min;
  return verts.map((p) => mul3(p, s));
}

function platonicVertices(kind: SolidSketchState["platonic"]): Vec3[] {
  if (kind === "tetrahedron") {
    return [v3(1, 1, 1), v3(1, -1, -1), v3(-1, 1, -1), v3(-1, -1, 1)];
  }
  if (kind === "cube") {
    return [
      v3(-1, 1, -1),
      v3(-1, 1, 1),
      v3(1, 1, 1),
      v3(1, 1, -1),
      v3(-1, -1, -1),
      v3(-1, -1, 1),
      v3(1, -1, 1),
      v3(1, -1, -1),
    ];
  }
  if (kind === "octahedron") {
    return [
      v3(0, 1, 0),
      v3(1, 0, 0),
      v3(0, 0, 1),
      v3(-1, 0, 0),
      v3(0, 0, -1),
      v3(0, -1, 0),
    ];
  }
  if (kind === "icosahedron") {
    const pts: Vec3[] = [];
    for (const a of [-1, 1]) {
      for (const b of [-1, 1]) {
        pts.push(v3(0, a, b * PHI));
        pts.push(v3(a, b * PHI, 0));
        pts.push(v3(a * PHI, 0, b));
      }
    }
    return pts;
  }
  const inv = 1 / PHI;
  const pts: Vec3[] = [];
  for (const x of [-1, 1]) {
    for (const y of [-1, 1]) {
      for (const z of [-1, 1]) pts.push(v3(x, y, z));
    }
  }
  for (const a of [-1, 1]) {
    for (const b of [-1, 1]) {
      pts.push(v3(0, a * inv, b * PHI));
      pts.push(v3(a * inv, b * PHI, 0));
      pts.push(v3(a * PHI, 0, b * inv));
    }
  }
  return pts;
}

function cubeMesh(state: SolidSketchState): SolidMesh {
  const a = state.edgeLength / 2;
  const vertices = platonicVertices("cube").map((p) => mul3(p, a));
  return meshFromVertices(vertices, pickNames(state, 8), {
    baseCenter: v3(0, -a, 0),
    topCenter: v3(0, a, 0),
    axis: v3(0, 1, 0),
  });
}

export function buildSolidMesh(state: SolidSketchState): SolidMesh {
  const family = state.family;
  if (family === "prism") {
    const n = state.sides;
    const h = state.height;
    const top =
      n === 4
        ? rect4(state.width, state.depth, h)
        : regularNgon(n, circumRFromSide(n, state.baseSize), h);
    const bot =
      n === 4
        ? rect4(state.width, state.depth, 0)
        : regularNgon(n, circumRFromSide(n, state.baseSize), 0);
    const vertices = [...top, ...bot];
    return meshFromVertices(vertices, pickNames(state, vertices.length), {
      baseCenter: v3(0, 0, 0),
      topCenter: v3(0, h, 0),
      axis: v3(0, 1, 0),
    });
  }

  if (family === "pyramid") {
    const n = state.sides;
    const h = state.height;
    const base = regularNgon(n, circumRFromSide(n, state.baseSize), 0);
    const apex = v3(0, h, 0);
    const vertices = [...base, apex];
    return meshFromVertices(vertices, pickNames(state, vertices.length), {
      apexIndex: n,
      baseCenter: v3(0, 0, 0),
      axis: v3(0, 1, 0),
    });
  }

  if (family === "frustum") {
    const n = state.sides;
    const h = state.height;
    const top = regularNgon(n, circumRFromSide(n, state.topSize), h);
    const bot = regularNgon(n, circumRFromSide(n, state.baseSize), 0);
    const vertices = [...top, ...bot];
    return meshFromVertices(vertices, pickNames(state, vertices.length), {
      baseCenter: v3(0, 0, 0),
      topCenter: v3(0, h, 0),
      axis: v3(0, 1, 0),
    });
  }

  if (family === "platonic") {
    if (state.platonic === "cube") return cubeMesh(state);
    const raw = platonicVertices(state.platonic);
    const vertices = scaleToEdge(raw, state.edgeLength);
    return meshFromVertices(vertices, pickNames(state, vertices.length), {
      baseCenter: centroid3(vertices),
    });
  }

  if (family === "cylinder") {
    return roundCylinder(state);
  }
  if (family === "cone") {
    return roundCone(state, false);
  }
  if (family === "coneFrustum") {
    return roundCone(state, true);
  }
  return roundSphere(state);
}

function roundCylinder(state: SolidSketchState): SolidMesh {
  const r = state.radius;
  const h = state.height;
  const lie = state.cylinderLie === "horizontal";
  if (lie) {
    const a = v3(-h / 2, 0, 0);
    const b = v3(h / 2, 0, 0);
    return {
      vertices: [],
      names: pickNames(state, 0),
      faces: [],
      edges: [],
      circles: [
        { id: "base", center: a, normal: v3(-1, 0, 0), radius: r },
        { id: "top", center: b, normal: v3(1, 0, 0), radius: r },
      ],
      apexIndex: null,
      baseCenter: a,
      topCenter: b,
      axis: v3(1, 0, 0),
      sphereRadius: null,
    };
  }
  const bot = v3(0, 0, 0);
  const top = v3(0, h, 0);
  return {
    vertices: [],
    names: pickNames(state, 0),
    faces: [],
    edges: [],
    circles: [
      { id: "base", center: bot, normal: v3(0, -1, 0), radius: r },
      { id: "top", center: top, normal: v3(0, 1, 0), radius: r },
    ],
    apexIndex: null,
    baseCenter: bot,
    topCenter: top,
    axis: v3(0, 1, 0),
    sphereRadius: null,
  };
}

function roundCone(state: SolidSketchState, frustum: boolean): SolidMesh {
  const r = state.radius;
  const h = state.height;
  const bot = v3(0, 0, 0);
  const topC = v3(0, h, 0);
  const circles: Circle3[] = [
    { id: "base", center: bot, normal: v3(0, -1, 0), radius: r },
  ];
  const vertices: Vec3[] = [];
  let apexIndex: number | null = null;
  if (frustum) {
    circles.push({
      id: "top",
      center: topC,
      normal: v3(0, 1, 0),
      radius: state.topRadius,
    });
  } else {
    vertices.push(topC);
    apexIndex = 0;
  }
  return {
    vertices,
    names: pickNames(state, vertices.length),
    faces: [],
    edges: [],
    circles,
    apexIndex,
    baseCenter: bot,
    topCenter: frustum ? topC : null,
    axis: v3(0, 1, 0),
    sphereRadius: null,
  };
}

function roundSphere(state: SolidSketchState): SolidMesh {
  const r = state.radius;
  const center = v3(0, 0, 0);
  return {
    vertices: [],
    names: pickNames(state, 0),
    faces: [],
    edges: [],
    circles: [{ id: "base", center, normal: v3(0, 1, 0), radius: r }],
    apexIndex: null,
    baseCenter: center,
    topCenter: null,
    axis: v3(0, 1, 0),
    sphereRadius: r,
  };
}

export function circleBasis(normal: Vec3): { u: Vec3; v: Vec3 } {
  const n = norm3(normal);
  const helper = Math.abs(n.y) < 0.9 ? v3(0, 1, 0) : v3(1, 0, 0);
  const u = norm3(cross3(helper, n));
  const v = cross3(n, u);
  return { u, v };
}

export function pointOnCircle(circle: Circle3, theta: number): Vec3 {
  const { u, v } = circleBasis(circle.normal);
  return add3(
    circle.center,
    add3(mul3(u, circle.radius * Math.cos(theta)), mul3(v, circle.radius * Math.sin(theta))),
  );
}

export function firstBaseEdgeLength(mesh: SolidMesh, state: SolidSketchState): number {
  if (state.family === "prism" && state.sides === 4) return state.width;
  if (state.family === "platonic") return state.edgeLength;
  if (familyIsRound(state.family)) return state.radius;
  return state.baseSize;
}

/** 모선(옆면 모서리)이 밑면과 이루는 수평 거리. */
export function slantSpan(state: SolidSketchState): number {
  if (state.family === "cone") return state.radius;
  if (state.family === "coneFrustum") {
    return Math.abs(state.radius - state.topRadius);
  }
  if (state.family === "pyramid") {
    return circumRFromSide(state.sides, state.baseSize);
  }
  if (state.family === "frustum") {
    return Math.abs(
      circumRFromSide(state.sides, state.baseSize) -
        circumRFromSide(state.sides, state.topSize),
    );
  }
  return 0;
}

export function slantLength(state: SolidSketchState): number {
  if (!familyHasSlant(state.family)) return state.height;
  return Math.hypot(slantSpan(state), state.height);
}

export function heightFromSlant(state: SolidSketchState, slant: number): number {
  const gap = slantSpan(state);
  const s = Math.max(slant, gap + 0.1, 0.5);
  return Math.min(40, Math.sqrt(Math.max(0.25, s * s - gap * gap)));
}

export function withSlantLength(
  state: SolidSketchState,
  slant: number,
): SolidSketchState {
  if (!familyHasSlant(state.family)) return state;
  return { ...state, height: heightFromSlant(state, slant) };
}

export function isLateralEdge(
  state: SolidSketchState,
  a: number,
  b: number,
): boolean {
  const n = state.sides;
  if (state.family === "pyramid") return a === n || b === n;
  if (state.family === "frustum" || state.family === "prism") {
    return Math.abs(a - b) === n;
  }
  return false;
}
