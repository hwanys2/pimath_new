import { hitTestText } from "@/lib/diagrams/scene";
import { emptyLabel, familyHasSlant, type MeasLabel, type SolidSketchState } from "./model";
import type { SolidScene } from "./scene";
import { isLateralEdge, withFaceHeight, withSlantLength } from "./solids";

export type SolidHit =
  | { kind: "vertex"; index: number }
  | { kind: "label"; id: string }
  | { kind: "dimLine"; id: string }
  | { kind: "edge"; key: string }
  | { kind: "center" };

function distToSeg(
  x: number,
  y: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): { d: number; t: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-8) return { d: Math.hypot(x - x1, y - y1), t: 0 };
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / len2));
  return { d: Math.hypot(x - (x1 + dx * t), y - (y1 + dy * t)), t };
}

export function hitTestSolid(
  state: SolidSketchState,
  scene: SolidScene,
  x: number,
  y: number,
  scale = 1,
): SolidHit | null {
  const labelR = 22 * Math.max(scale, 0.85);
  const text = hitTestText(scene, x, y, labelR);
  if (text) {
    if (text.id.endsWith(":line")) {
      return { kind: "dimLine", id: text.id.slice(0, -5) };
    }
    return { kind: "label", id: text.id };
  }

  const pointR = 12 * Math.max(scale, 0.85);
  if (state.vertexDisplay !== "hidden") {
    let bestI = -1;
    let bestD = pointR;
    scene.layout.vertices.forEach((p, i) => {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bestD) {
        bestD = d;
        bestI = i;
      }
    });
    if (bestI >= 0) return { kind: "vertex", index: bestI };
  }

  for (const c of scene.layout.centers) {
    if (Math.hypot(c.p.x - x, c.p.y - y) < pointR) return { kind: "center" };
  }

  const dimR = 10 * Math.max(scale, 0.85);
  let bestDim: SolidHit | null = null;
  let bestDimD = dimR;
  for (const cmd of scene.cmds) {
    if (!("id" in cmd) || !cmd.id || !cmd.id.endsWith(":line")) continue;
    const id = cmd.id.slice(0, -5);
    if (cmd.t === "line") {
      const { d } = distToSeg(x, y, cmd.x1, cmd.y1, cmd.x2, cmd.y2);
      if (d < bestDimD) {
        bestDimD = d;
        bestDim = { kind: "dimLine", id };
      }
    } else if (cmd.t === "arc") {
      const ang = Math.atan2(y - cmd.cy, x - cmd.cx);
      const px = cmd.cx + cmd.r * Math.cos(ang);
      const py = cmd.cy + cmd.r * Math.sin(ang);
      const d = Math.hypot(x - px, y - py);
      if (d < bestDimD) {
        bestDimD = d;
        bestDim = { kind: "dimLine", id };
      }
    }
  }
  if (bestDim) return bestDim;

  const edgeR = 8 * Math.max(scale, 0.85);
  let bestEdge: SolidHit | null = null;
  let bestEdgeD = edgeR;
  for (const e of scene.layout.edges) {
    const a = scene.layout.vertices[e.a]!;
    const b = scene.layout.vertices[e.b]!;
    const { d } = distToSeg(x, y, a.x, a.y, b.x, b.y);
    if (d < bestEdgeD) {
      bestEdgeD = d;
      bestEdge = { kind: "edge", key: e.key };
    }
  }
  return bestEdge;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function nudgeVertexLabel(
  state: SolidSketchState,
  index: number,
  dx: number,
  dy: number,
): SolidSketchState {
  const nameDx = [...state.nameDx];
  const nameDy = [...state.nameDy];
  while (nameDx.length <= index) nameDx.push(0);
  while (nameDy.length <= index) nameDy.push(0);
  nameDx[index] = clamp((nameDx[index] ?? 0) + dx, -80, 80);
  nameDy[index] = clamp((nameDy[index] ?? 0) + dy, -80, 80);
  return { ...state, nameDx, nameDy };
}

function alongOutward(
  scene: SolidScene,
  a: { x: number; y: number },
  b: { x: number; y: number },
): { along: { x: number; y: number }; outward: { x: number; y: number } } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l = Math.hypot(dx, dy) || 1;
  const along = { x: dx / l, y: dy / l };
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const cloud = {
    x: scene.width / 2,
    y: scene.height / 2,
  };
  let outward = { x: -along.y, y: along.x };
  if ((mid.x - cloud.x) * outward.x + (mid.y - cloud.y) * outward.y < 0) {
    outward = { x: -outward.x, y: -outward.y };
  }
  return { along, outward };
}

function nudgeMeas(
  label: MeasLabel,
  dx: number,
  dy: number,
  along: { x: number; y: number },
  outward: { x: number; y: number },
  lineOnly: boolean,
): MeasLabel {
  const alongAmt = dx * along.x + dy * along.y;
  const perpAmt = dx * outward.x + dy * outward.y;
  if (lineOnly) {
    return { ...label, lineDy: clamp((label.lineDy ?? 0) + perpAmt, -160, 160) };
  }
  return {
    ...label,
    dx: clamp(label.dx + alongAmt, -80, 80),
    dy: clamp(label.dy + perpAmt, -160, 160),
  };
}

export function nudgeMeasure(
  state: SolidSketchState,
  scene: SolidScene,
  id: string,
  dx: number,
  dy: number,
  lineOnly: boolean,
): SolidSketchState {
  const verts = scene.layout.vertices;
  if (id.startsWith("vertex:")) {
    const i = Number(id.slice(7));
    return nudgeVertexLabel(state, i, dx, dy);
  }
  if (id === "center-name") return state;

  const apply = (label: MeasLabel, a: { x: number; y: number }, b: { x: number; y: number }) =>
    nudgeMeas(label, dx, dy, alongOutward(scene, a, b).along, alongOutward(scene, a, b).outward, lineOnly);

  if (id === "height" && scene.layout.mesh.baseCenter) {
    const a = scene.texts.find((t) => t.id === "height");
    void a;
    const mesh = scene.layout.mesh;
    const foot = verts[0];
    const top =
      mesh.apexIndex != null ? verts[mesh.apexIndex] : verts[Math.max(0, verts.length - 1)];
    if (foot && top) {
      return { ...state, heightLabel: apply(state.heightLabel, foot, top) };
    }
  }
  if (id === "radius") {
    return { ...state, radiusLabel: nudgeMeas(state.radiusLabel, dx, dy, { x: 1, y: 0 }, { x: 0, y: -1 }, lineOnly) };
  }
  if (id === "slant") {
    return { ...state, slantLabel: nudgeMeas(state.slantLabel, dx, dy, { x: 1, y: 0 }, { x: 0, y: -1 }, lineOnly) };
  }
  if (id === "faceHeight") {
    return {
      ...state,
      faceHeightLabel: nudgeMeas(state.faceHeightLabel, dx, dy, { x: 1, y: 0 }, { x: 0, y: -1 }, lineOnly),
    };
  }
  if (id === "baseEdge") {
    return { ...state, baseEdgeLabel: nudgeMeas(state.baseEdgeLabel, dx, dy, { x: 1, y: 0 }, { x: 0, y: -1 }, lineOnly) };
  }
  if (id.startsWith("edge:")) {
    const key = id.slice(5);
    const edge = scene.layout.edges.find((e) => e.key === key);
    const label = state.edgeLabels[key];
    if (!edge || !label) return state;
    const a = verts[edge.a]!;
    const b = verts[edge.b]!;
    return {
      ...state,
      edgeLabels: { ...state.edgeLabels, [key]: apply(label, a, b) },
    };
  }
  return state;
}

export function toggleEdgeMeasure(state: SolidSketchState, key: string): SolidSketchState {
  const next = { ...state.edgeLabels };
  if (next[key] && next[key]!.mode !== "hide") {
    delete next[key];
    return { ...state, edgeLabels: next };
  }
  next[key] = emptyLabel("auto");
  return { ...state, edgeLabels: next };
}

export function parseMeasureInput(text: string): {
  kind: "number" | "unknown" | "text";
  value?: number;
  unknown?: string;
  raw: string;
} {
  const raw = text.trim();
  if (!raw) return { kind: "text", raw };
  const unknown = raw.match(/^([A-Za-z])(?:\s*(?:cm|mm))?$/);
  if (unknown) return { kind: "unknown", unknown: unknown[1], raw };
  const num = raw.match(/^(-?\d+(?:\.\d+)?)\s*(?:cm|mm)?$/i);
  if (num) return { kind: "number", value: Number(num[1]), raw };
  return { kind: "text", raw };
}

function labelFromParse(
  parsed: ReturnType<typeof parseMeasureInput>,
  text: string,
  prev: MeasLabel,
): MeasLabel {
  if (parsed.kind === "unknown") {
    return { ...prev, mode: "x", custom: parsed.unknown ?? "x" };
  }
  if (parsed.kind === "number") {
    return { ...prev, mode: "auto", custom: "" };
  }
  if (!text.trim()) return { ...prev, mode: "hide", custom: "" };
  return { ...prev, mode: "custom", custom: text.trim() };
}

function parseEdgeKey(key: string): [number, number] | null {
  const dash = key.indexOf("-");
  if (dash < 1) return null;
  const a = Number(key.slice(0, dash));
  const b = Number(key.slice(dash + 1));
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return [a, b];
}

export function applyEditedLabel(
  state: SolidSketchState,
  id: string,
  text: string,
): SolidSketchState {
  if (id === "center-name") return state;
  if (id.startsWith("vertex:")) {
    const i = Number(id.slice(7));
    if (!Number.isFinite(i) || i < 0) return state;
    const vertexNames = [...state.vertexNames];
    while (vertexNames.length <= i) vertexNames.push("");
    vertexNames[i] = text.trim();
    return { ...state, vertexNames };
  }
  const parsed = parseMeasureInput(text);
  if (id === "height") {
    const heightLabel = labelFromParse(parsed, text, state.heightLabel);
    const height =
      parsed.kind === "number" && parsed.value != null
        ? Math.max(parsed.value, 0.5)
        : state.height;
    return { ...state, heightLabel, height };
  }
  if (id === "radius") {
    const radiusLabel = labelFromParse(parsed, text, state.radiusLabel);
    const radius =
      parsed.kind === "number" && parsed.value != null
        ? Math.max(parsed.value, 0.4)
        : state.radius;
    return { ...state, radiusLabel, radius };
  }
  if (id === "slant") {
    const slantLabel = labelFromParse(parsed, text, state.slantLabel);
    if (parsed.kind === "number" && parsed.value != null) {
      return { ...withSlantLength(state, parsed.value), slantLabel };
    }
    return { ...state, slantLabel };
  }
  if (id === "faceHeight") {
    const faceHeightLabel = labelFromParse(parsed, text, state.faceHeightLabel);
    if (parsed.kind === "number" && parsed.value != null) {
      return { ...withFaceHeight(state, parsed.value), faceHeightLabel };
    }
    return { ...state, faceHeightLabel };
  }
  if (id === "baseEdge") {
    const baseEdgeLabel = labelFromParse(parsed, text, state.baseEdgeLabel);
    if (parsed.kind === "number" && parsed.value != null) {
      const v = Math.max(parsed.value, 0.5);
      if (state.family === "platonic") return { ...state, baseEdgeLabel, edgeLength: v };
      if (state.family === "prism" && state.sides === 4) {
        return { ...state, baseEdgeLabel, width: v };
      }
      return { ...state, baseEdgeLabel, baseSize: v };
    }
    return { ...state, baseEdgeLabel };
  }
  if (id.startsWith("edge:")) {
    const key = id.slice(5);
    const prev = state.edgeLabels[key] ?? emptyLabel("auto");
    const nextLabel = labelFromParse(parsed, text, prev);
    const next: SolidSketchState = {
      ...state,
      edgeLabels: { ...state.edgeLabels, [key]: nextLabel },
    };
    if (parsed.kind === "number" && parsed.value != null) {
      const pair = parseEdgeKey(key);
      if (pair && isLateralEdge(state, pair[0], pair[1])) {
        if (familyHasSlant(state.family)) {
          return withSlantLength(next, parsed.value);
        }
        if (state.family === "prism") {
          return { ...next, height: Math.max(0.5, Math.min(40, parsed.value)) };
        }
      }
    }
    return next;
  }
  return state;
}

export function orbitView(
  state: SolidSketchState,
  dx: number,
  dy: number,
): SolidSketchState {
  return {
    ...state,
    azimuthDeg: state.azimuthDeg - dx * 0.42,
    elevationDeg: Math.min(82, Math.max(6, state.elevationDeg + dy * 0.32)),
  };
}
