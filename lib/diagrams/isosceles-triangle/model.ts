import {
  DEFAULT_STYLE,
  emptyLabel,
  resolveAngleText,
  resolveLengthText,
  type DiagramStyle,
  type MeasLabel,
  type PolygonState,
  type Vec,
} from "@/lib/diagrams/polygon/model";
import { add, len, mul, norm, sub } from "@/lib/diagrams/polygon/geometry";

export type { DiagramStyle, MeasLabel, Vec };
export { emptyLabel, resolveAngleText, resolveLengthText, DEFAULT_STYLE };

/** Apex of the equal sides. `"A"` means AB = AC. */
export type EqualApex = "none" | "A" | "B" | "C";

/** Cevian from this vertex to the opposite side. */
export type CevianFrom = "A" | "B" | "C";

export type CevianRole = "free" | "midpoint" | "altitude" | "bisector";

export const DEFAULT_FOOT_NAME: Record<CevianFrom, string> = {
  A: "D",
  B: "E",
  C: "F",
};

export type TickCount = 0 | 1 | 2 | 3;

export type ExtraArcs = 0 | 1 | 2;

export type IsoVertex = {
  name: string;
  nameDx: number;
  nameDy: number;
  showInterior: boolean;
  fillInterior: boolean;
  showExterior: boolean;
  fillExterior: boolean;
  interior: MeasLabel;
  exterior: MeasLabel;
  extraArcs: ExtraArcs;
  showDot: boolean;
};

export type IsoEdge = {
  showLength: boolean;
  length: MeasLabel;
  ticks: TickCount;
};

export type WedgeMark = {
  show: boolean;
  fill: boolean;
  label: MeasLabel;
  extraArcs: ExtraArcs;
  showDot: boolean;
};

export type CevianState = {
  from: CevianFrom;
  role: CevianRole;
  /** 0–1 along the opposite side, used when role is `free`. */
  t: number;
  name: string;
  nameDx: number;
  nameDy: number;
  showName: boolean;
  /** Right-angle box at the foot (typical for an altitude). */
  showRightAtD: boolean;
  /** Matching arcs on the two halves of the vertex angle. */
  showBisectorMarks: boolean;
  /** Equal-length ticks on the two parts of the opposite side. */
  showMidpointTicks: boolean;
  length: { show: boolean; label: MeasLabel };
  leftLen: { show: boolean; label: MeasLabel };
  rightLen: { show: boolean; label: MeasLabel };
  apexLeft: WedgeMark;
  apexRight: WedgeMark;
  footLeft: WedgeMark;
  footRight: WedgeMark;
};

export type IsoscelesState = {
  points: Vec[];
  vertices: IsoVertex[];
  edges: IsoEdge[];
  interiorAnglesDeg: number[];
  referenceEdgeLength: number;
  equalApex: EqualApex;
  lockEqual: boolean;
  cevians: CevianState[];
  showVertexNames: boolean;
  showDots: boolean;
  unit: string;
  unknownLetter: string;
  style: DiagramStyle;
};

export type IsoscelesPreset = {
  id: string;
  title: string;
  hint: string;
  state: IsoscelesState;
};

export const APEX_INDEX: Record<Exclude<EqualApex, "none">, 0 | 1 | 2> = {
  A: 0,
  B: 1,
  C: 2,
};

export const CEVIAN_INDEX: Record<CevianFrom, 0 | 1 | 2> = {
  A: 0,
  B: 1,
  C: 2,
};

export function vertexLetter(i: number): "A" | "B" | "C" {
  return i === 1 ? "B" : i === 2 ? "C" : "A";
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function interiorAngleAt(points: Vec[], i: number): number {
  const n = points.length;
  const p = points[i]!;
  const prev = points[(i - 1 + n) % n]!;
  const next = points[(i + 1) % n]!;
  const ux = prev.x - p.x;
  const uy = prev.y - p.y;
  const wx = next.x - p.x;
  const wy = next.y - p.y;
  const lu = Math.hypot(ux, uy) || 1;
  const lw = Math.hypot(wx, wy) || 1;
  const dot = (ux / lu) * (wx / lw) + (uy / lu) * (wy / lw);
  return (Math.acos(Math.min(1, Math.max(-1, dot))) * 180) / Math.PI;
}

function edgeLen(points: Vec[], i: number): number {
  const a = points[i]!;
  const b = points[(i + 1) % points.length]!;
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function emptyWedge(): WedgeMark {
  return {
    show: false,
    fill: false,
    label: emptyLabel("auto"),
    extraArcs: 0,
    showDot: false,
  };
}

function makeVertex(i: number, patch: Partial<IsoVertex> = {}): IsoVertex {
  return {
    name: vertexLetter(i),
    nameDx: 0,
    nameDy: 0,
    showInterior: false,
    fillInterior: false,
    showExterior: false,
    fillExterior: false,
    interior: emptyLabel("auto"),
    exterior: emptyLabel("auto"),
    extraArcs: 0,
    showDot: false,
    ...patch,
  };
}

function makeEdge(patch: Partial<IsoEdge> = {}): IsoEdge {
  return { showLength: false, length: emptyLabel("auto"), ticks: 0, ...patch };
}

export function makeCevian(patch: Partial<CevianState> & { from: CevianFrom }): CevianState {
  const from = patch.from;
  return {
    role: "free",
    t: 0.5,
    name: DEFAULT_FOOT_NAME[from],
    nameDx: 0,
    nameDy: 0,
    showName: true,
    showRightAtD: false,
    showBisectorMarks: false,
    showMidpointTicks: false,
    length: { show: false, label: emptyLabel("auto") },
    leftLen: { show: false, label: emptyLabel("auto") },
    rightLen: { show: false, label: emptyLabel("auto") },
    apexLeft: emptyWedge(),
    apexRight: emptyWedge(),
    footLeft: emptyWedge(),
    footRight: emptyWedge(),
    ...patch,
    from,
  };
}

function mergeWedge(prev: WedgeMark | undefined, patch?: Partial<WedgeMark>): WedgeMark {
  const base = prev ?? emptyWedge();
  return {
    ...base,
    ...patch,
    label: patch?.label ? { ...emptyLabel("auto"), ...patch.label } : { ...base.label },
  };
}

function isCevianFrom(value: unknown): value is CevianFrom {
  return value === "A" || value === "B" || value === "C";
}

function normalizeOneCevian(raw: Partial<CevianState> | undefined): CevianState | null {
  if (!raw || !isCevianFrom(raw.from)) return null;
  const merged = makeCevian({
    ...raw,
    from: raw.from,
    apexLeft: mergeWedge(raw.apexLeft),
    apexRight: mergeWedge(raw.apexRight),
    footLeft: mergeWedge(raw.footLeft),
    footRight: mergeWedge(raw.footRight),
    length: raw.length
      ? { show: raw.length.show, label: { ...emptyLabel("auto"), ...raw.length.label } }
      : undefined,
    leftLen: raw.leftLen
      ? { show: raw.leftLen.show, label: { ...emptyLabel("auto"), ...raw.leftLen.label } }
      : undefined,
    rightLen: raw.rightLen
      ? { show: raw.rightLen.show, label: { ...emptyLabel("auto"), ...raw.rightLen.label } }
      : undefined,
  });
  merged.t = clamp(merged.t, 0.08, 0.92);
  if (
    merged.role !== "free" &&
    merged.role !== "midpoint" &&
    merged.role !== "altitude" &&
    merged.role !== "bisector"
  ) {
    merged.role = "free";
  }
  if (!merged.name.trim()) merged.name = DEFAULT_FOOT_NAME[merged.from];
  return merged;
}

function collectCevians(state: Partial<IsoscelesState> & { cevian?: Partial<CevianState> }): CevianState[] {
  const seen = new Set<CevianFrom>();
  const out: CevianState[] = [];
  const rawList = Array.isArray(state.cevians) ? state.cevians : null;
  if (rawList) {
    for (const item of rawList) {
      const next = normalizeOneCevian(item);
      if (!next || seen.has(next.from)) continue;
      seen.add(next.from);
      out.push(next);
    }
    return out;
  }
  const legacy = state.cevian;
  const next = normalizeOneCevian(legacy);
  return next ? [next] : [];
}

/** Triangle ABC with given angles (°) and base BC. y-up. */
export function triangleFromAngles(
  degA: number,
  degB: number,
  degC: number,
  sideBC = 5,
): Vec[] {
  const A = (degA * Math.PI) / 180;
  const B = (degB * Math.PI) / 180;
  const a = sideBC;
  const ab = a * (Math.sin((degC * Math.PI) / 180) / Math.sin(A));
  return [
    { x: ab * Math.cos(B), y: ab * Math.sin(B) },
    { x: 0, y: 0 },
    { x: a, y: 0 },
  ];
}

/** Isosceles with equal sides from `apex`, vertex angle `vertexDeg`. */
export function isoscelesFromVertex(
  apex: 0 | 1 | 2,
  vertexDeg: number,
  base = 5,
): Vec[] {
  const baseAng = (180 - vertexDeg) / 2;
  const angles: [number, number, number] = [baseAng, baseAng, baseAng];
  angles[apex] = vertexDeg;
  const pts = triangleFromAngles(angles[0]!, angles[1]!, angles[2]!, base);
  if (apex === 0) return pts;
  if (apex === 1) {
    return triangleFromAngles(baseAng, vertexDeg, baseAng, base);
  }
  return triangleFromAngles(baseAng, baseAng, vertexDeg, base);
}

function nestedCevianPoints(): { points: Vec[]; t: number } {
  const BD = 4;
  const angB = (28 * Math.PI) / 180;
  const angD = (124 * Math.PI) / 180;
  const BC = (BD * Math.sin(angD)) / Math.sin(angB);
  const x = BC / 2;
  const y = Math.sqrt(Math.max(0, BD * BD - x * x));
  const B: Vec = { x: 0, y: 0 };
  const C: Vec = { x: BC, y: 0 };
  const D: Vec = { x, y };
  const u = norm(sub(D, B));
  const w = sub(D, C);
  const qb = 2 * (w.x * u.x + w.y * u.y);
  const qc = w.x * w.x + w.y * w.y - BD * BD;
  const disc = Math.max(0, qb * qb - 4 * qc);
  const k1 = (-qb + Math.sqrt(disc)) / 2;
  const k2 = (-qb - Math.sqrt(disc)) / 2;
  const k = Math.max(k1, k2, 0.2);
  const A = add(D, mul(u, k));
  const ab = len(sub(B, A)) || 1;
  const t = clamp(len(sub(D, A)) / ab, 0.08, 0.92);
  return { points: [A, B, C], t };
}

export function cloneState(state: IsoscelesState): IsoscelesState {
  return structuredClone(state);
}

export function toPolygonState(state: IsoscelesState): PolygonState {
  return {
    points: state.points,
    vertices: state.vertices.map((v) => ({
      name: v.name,
      nameDx: v.nameDx,
      nameDy: v.nameDy,
      showInterior: v.showInterior,
      showExterior: v.showExterior,
      fillExterior: v.fillExterior,
      interior: v.interior,
      exterior: v.exterior,
    })),
    edges: state.edges.map((e) => ({
      showLength: e.showLength,
      length: e.length,
    })),
    diagonals: [],
    dashedDiagonals: false,
    interiorAnglesDeg: state.interiorAnglesDeg,
    referenceEdgeLength: state.referenceEdgeLength,
    showVertexNames: state.showVertexNames,
    showDots: state.showDots,
    unit: state.unit,
    unknownLetter: state.unknownLetter,
    style: state.style,
  };
}

export function fromPolygonState(
  poly: PolygonState,
  prev: IsoscelesState,
): IsoscelesState {
  return normalizeState({
    ...prev,
    points: poly.points,
    vertices: prev.vertices.map((v, i) => {
      const pv = poly.vertices[i];
      if (!pv) return v;
      return {
        ...v,
        name: pv.name,
        nameDx: pv.nameDx,
        nameDy: pv.nameDy,
        showInterior: pv.showInterior,
        showExterior: pv.showExterior,
        fillExterior: pv.fillExterior,
        interior: pv.interior,
        exterior: pv.exterior,
      };
    }),
    edges: prev.edges.map((e, i) => {
      const pe = poly.edges[i];
      if (!pe) return e;
      return { ...e, showLength: pe.showLength, length: pe.length };
    }),
    interiorAnglesDeg: poly.interiorAnglesDeg,
    referenceEdgeLength: poly.referenceEdgeLength,
    showVertexNames: poly.showVertexNames,
    showDots: poly.showDots,
    unit: poly.unit,
    unknownLetter: poly.unknownLetter,
    style: poly.style,
  });
}

export function normalizeState(
  state:
    | (Partial<IsoscelesState> &
        Pick<IsoscelesState, "points"> & { cevian?: Partial<CevianState> })
    | IsoscelesState,
): IsoscelesState {
  let points = (state.points ?? []).slice(0, 3);
  if (points.length < 3) {
    points = isoscelesFromVertex(0, 50, 5);
  }
  const vertices = [0, 1, 2].map((i) => makeVertex(i, state.vertices?.[i]));
  const edges = [0, 1, 2].map((i) => makeEdge(state.edges?.[i]));
  const cevians = collectCevians(state);
  const equalApex =
    state.equalApex === "A" || state.equalApex === "B" || state.equalApex === "C"
      ? state.equalApex
      : "none";
  const style = { ...DEFAULT_STYLE, ...state.style };
  return {
    points,
    vertices,
    edges,
    interiorAnglesDeg: points.map((_, i) => interiorAngleAt(points, i)),
    referenceEdgeLength: clamp(
      state.referenceEdgeLength != null && Number.isFinite(state.referenceEdgeLength)
        ? state.referenceEdgeLength
        : edgeLen(points, 0),
      0.5,
      40,
    ),
    equalApex,
    lockEqual: state.lockEqual !== false,
    cevians,
    showVertexNames: state.showVertexNames !== false,
    showDots: state.showDots !== false,
    unit: state.unit?.trim() ? state.unit : "cm",
    unknownLetter:
      state.unknownLetter && /^[A-Za-z]$/.test(state.unknownLetter)
        ? state.unknownLetter
        : "x",
    style: {
      ...style,
      lineWidth: clamp(style.lineWidth, 1, 3.5),
      fontSize: clamp(style.fontSize, 12, 64),
      pointLabelSize: clamp(style.pointLabelSize, 14, 72),
      pointRadius: clamp(style.pointRadius, 2, 10),
      dimOffset: clamp(style.dimOffset, 10, 48),
      padding: clamp(style.padding, 36, 90),
      exportScale: clamp(style.exportScale, 2, 4),
    },
  };
}

function baseState(points: Vec[], patch: Partial<IsoscelesState> = {}): IsoscelesState {
  return normalizeState({
    points,
    vertices: [0, 1, 2].map((i) => makeVertex(i)),
    edges: [0, 1, 2].map(() => makeEdge()),
    equalApex: "none",
    lockEqual: true,
    cevians: [],
    showVertexNames: true,
    showDots: true,
    unit: "cm",
    unknownLetter: "x",
    style: { ...DEFAULT_STYLE },
    ...patch,
  });
}

function ticksOnLegsFrom(apex: 0 | 1 | 2, count: TickCount = 2): IsoEdge[] {
  const legs = new Set([apex, (apex + 2) % 3]);
  return [0, 1, 2].map((i) => makeEdge({ ticks: legs.has(i) ? count : 0 }));
}

export const ISO_PRESETS: IsoscelesPreset[] = [
  {
    id: "base-angle",
    title: "밑각 구하기",
    hint: "꼭지각 50° · x",
    state: baseState(isoscelesFromVertex(0, 50, 5), {
      equalApex: "A",
      lockEqual: true,
      edges: ticksOnLegsFrom(0, 2),
      vertices: [
        makeVertex(0, {
          showInterior: true,
          interior: { ...emptyLabel("custom"), custom: "50°" },
        }),
        makeVertex(1, {
          showInterior: true,
          fillInterior: true,
          interior: { ...emptyLabel("x"), custom: "x" },
        }),
        makeVertex(2),
      ],
    }),
  },
  {
    id: "exterior",
    title: "꼭지각·외각",
    hint: "외각 130° · x",
    state: baseState(isoscelesFromVertex(0, 80, 5), {
      equalApex: "A",
      lockEqual: true,
      edges: ticksOnLegsFrom(0, 2),
      vertices: [
        makeVertex(0, {
          showInterior: true,
          fillInterior: true,
          interior: { ...emptyLabel("x"), custom: "x" },
        }),
        makeVertex(1),
        makeVertex(2, {
          showExterior: true,
          exterior: { ...emptyLabel("custom"), custom: "130°" },
        }),
      ],
    }),
  },
  {
    id: "altitude",
    title: "꼭짓점 수선",
    hint: "BAD 35° · BD 3 cm",
    state: baseState(isoscelesFromVertex(0, 70, 6), {
      equalApex: "A",
      lockEqual: true,
      edges: ticksOnLegsFrom(0, 2),
      vertices: [
        makeVertex(0),
        makeVertex(1),
        makeVertex(2, {
          showInterior: true,
          fillInterior: true,
          interior: emptyLabel("auto"),
        }),
      ],
      cevians: [
        makeCevian({
          from: "A",
          role: "altitude",
          t: 0.5,
          showRightAtD: true,
          leftLen: {
            show: true,
            label: emptyLabel("auto"),
          },
          apexLeft: {
            show: true,
            fill: false,
            extraArcs: 0,
            showDot: false,
            label: { ...emptyLabel("custom"), custom: "35°" },
          },
        }),
      ],
    }),
  },
  {
    id: "by-angles",
    title: "각으로 이등변",
    hint: "55°·70° · x cm",
    state: baseState(triangleFromAngles(55, 55, 70, 6), {
      equalApex: "none",
      lockEqual: false,
      vertices: [
        makeVertex(0, {
          showInterior: true,
          interior: { ...emptyLabel("custom"), custom: "55°" },
        }),
        makeVertex(1),
        makeVertex(2, {
          showInterior: true,
          interior: { ...emptyLabel("custom"), custom: "70°" },
        }),
      ],
      edges: [
        makeEdge(),
        makeEdge({
          showLength: true,
          length: { ...emptyLabel("x"), custom: "x" },
        }),
        makeEdge({
          showLength: true,
          length: emptyLabel("auto"),
        }),
      ],
    }),
  },
  {
    id: "nested",
    title: "이등변 이어서",
    hint: "28°·28°·56° · x cm",
    state: (() => {
      const { points, t } = nestedCevianPoints();
      return baseState(points, {
        equalApex: "none",
        lockEqual: false,
        vertices: [
          makeVertex(0, {
            showInterior: true,
            interior: { ...emptyLabel("custom"), custom: "56°" },
          }),
          makeVertex(1, {
            showInterior: true,
            interior: { ...emptyLabel("custom"), custom: "28°" },
          }),
          makeVertex(2),
        ],
        edges: [
          makeEdge(),
          makeEdge(),
          makeEdge({
            showLength: true,
            length: { ...emptyLabel("x"), custom: "x" },
          }),
        ],
        cevians: [
          makeCevian({
            from: "C",
            role: "free",
            t,
            rightLen: {
              show: true,
              label: emptyLabel("auto"),
            },
            apexRight: {
              show: true,
              fill: false,
              extraArcs: 0,
              showDot: false,
              label: { ...emptyLabel("custom"), custom: "28°" },
            },
          }),
        ],
      });
    })(),
  },
  {
    id: "golden",
    title: "밑각 이등분선",
    hint: "36° · 점 표시 · 5 cm",
    state: baseState(isoscelesFromVertex(0, 36, 5), {
      equalApex: "A",
      lockEqual: true,
      vertices: [
        makeVertex(0, {
          showInterior: true,
          interior: { ...emptyLabel("custom"), custom: "36°" },
        }),
        makeVertex(1),
        makeVertex(2),
      ],
      edges: [
        makeEdge(),
        makeEdge({
          showLength: true,
          length: emptyLabel("auto"),
        }),
        makeEdge(),
      ],
      cevians: [
        makeCevian({
          from: "B",
          role: "bisector",
          t: 0.5,
          showBisectorMarks: true,
          apexLeft: {
            show: true,
            fill: false,
            extraArcs: 0,
            showDot: true,
            label: emptyLabel("hide"),
          },
          apexRight: {
            show: true,
            fill: false,
            extraArcs: 0,
            showDot: true,
            label: emptyLabel("hide"),
          },
          footLeft: {
            show: true,
            fill: true,
            extraArcs: 0,
            showDot: false,
            label: emptyLabel("hide"),
          },
        }),
      ],
    }),
  },
];

export const DEFAULT_ISO_STATE: IsoscelesState = ISO_PRESETS[0]!.state;

export function equalSideEdges(apex: 0 | 1 | 2): [number, number] {
  return [apex, (apex + 2) % 3];
}

export function setEqualApex(state: IsoscelesState, apex: EqualApex): IsoscelesState {
  if (apex === "none") {
    const edges = state.edges.map((e) => ({ ...e, ticks: 0 as TickCount }));
    return normalizeState({ ...state, equalApex: "none", lockEqual: false, edges });
  }
  const idx = APEX_INDEX[apex];
  const [e0, e1] = equalSideEdges(idx);
  const edges = state.edges.map((e, i) => {
    if (i === e0 || i === e1) {
      const ticks: TickCount = e.ticks === 0 ? 2 : e.ticks;
      return { ...e, ticks };
    }
    return { ...e, ticks: 0 as TickCount };
  });
  return normalizeState({ ...state, equalApex: apex, lockEqual: true, edges });
}

export function setCevianFrom(state: IsoscelesState, from: CevianFrom | "none"): IsoscelesState {
  if (from === "none") {
    return normalizeState({ ...state, cevians: [] });
  }
  return toggleCevian(state, from).state;
}

export function getCevian(state: IsoscelesState, from: CevianFrom): CevianState | undefined {
  return state.cevians.find((c) => c.from === from);
}

export function mapCevian(
  state: IsoscelesState,
  from: CevianFrom,
  fn: (c: CevianState) => CevianState,
): IsoscelesState {
  return {
    ...state,
    cevians: state.cevians.map((c) => (c.from === from ? fn(c) : c)),
  };
}

export function toggleCevian(
  state: IsoscelesState,
  from: CevianFrom,
): { state: IsoscelesState; enabled: boolean } {
  if (getCevian(state, from)) {
    return {
      state: normalizeState({
        ...state,
        cevians: state.cevians.filter((c) => c.from !== from),
      }),
      enabled: false,
    };
  }
  return {
    state: normalizeState({
      ...state,
      cevians: [...state.cevians, makeCevian({ from, showName: true })],
    }),
    enabled: true,
  };
}

export function setCevianRole(
  state: IsoscelesState,
  from: CevianFrom,
  role: CevianRole,
): IsoscelesState {
  return mapCevian(state, from, (c) => ({
    ...c,
    role,
    showRightAtD: role === "altitude" ? true : c.showRightAtD,
    showBisectorMarks: role === "bisector" ? true : c.showBisectorMarks,
    showMidpointTicks: role === "midpoint" ? true : c.showMidpointTicks,
  }));
}
