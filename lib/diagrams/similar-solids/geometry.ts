import { formatNiceNumber } from "@/lib/diagrams/math-label";
import { hitTestText } from "@/lib/diagrams/scene";
import {
  applyEditedLabel,
  hitTestSolid,
  nudgeMeasure,
  orbitView,
  parseMeasureInput,
  toggleEdgeMeasure,
  type SolidHit,
} from "@/lib/diagrams/solid-sketch/geometry";
import {
  applyMeasureMarks,
  extractMeasureMarks,
  keepGeometry,
  normalizeSimilarState,
  pairSolidStates,
  patchSource,
  similarityScale,
  type SimilarSolidsState,
} from "./model";
import { sideSolidScene, type SimilarSolidsScene } from "./scene";

export type PairHit =
  | (SolidHit & { side: "left" | "right" })
  | { kind: "figure"; which: "left" | "right" };

export function stripPairPrefix(id: string): { side: "left" | "right"; id: string } {
  if (id.startsWith("L:")) return { side: "left", id: id.slice(2) };
  if (id.startsWith("R:")) return { side: "right", id: id.slice(2) };
  return { side: "left", id };
}

export function pairHitId(hit: PairHit): string {
  if (hit.kind === "figure") return hit.which === "right" ? "figure:right" : "figure:left";
  if (hit.kind === "vertex") {
    const prefix = hit.side === "right" ? "R:" : "L:";
    return `${prefix}vertex:${hit.index}`;
  }
  if (hit.kind === "label" || hit.kind === "dimLine") {
    const prefix = hit.side === "right" ? "R:" : "L:";
    return `${prefix}${hit.id}`;
  }
  const prefix = hit.side === "right" ? "R:" : "L:";
  if (hit.kind === "edge") return `${prefix}edge:${hit.key}`;
  return `${prefix}center-name`;
}

export function hitTestPair(
  state: SimilarSolidsState,
  scene: SimilarSolidsScene,
  x: number,
  y: number,
  scale = 1,
): PairHit | null {
  const labelR = 22 * Math.max(scale, 0.85);
  const text = hitTestText(scene, x, y, labelR);
  if (text?.id === "figure:left") return { kind: "figure", which: "left" };
  if (text?.id === "figure:right") return { kind: "figure", which: "right" };

  if (text) {
    const parsed = stripPairPrefix(text.id);
    if (text.id.endsWith(":line")) {
      return { kind: "dimLine", id: parsed.id.slice(0, -5), side: parsed.side };
    }
    return { kind: "label", id: parsed.id, side: parsed.side };
  }

  const leftHit = hitTestSolid(
    state.source,
    sideSolidScene(scene, "left"),
    x,
    y,
    scale,
  );
  const rightHit = hitTestSolid(
    pairSolidStates(state).right,
    sideSolidScene(scene, "right"),
    x,
    y,
    scale,
  );

  const ranked: { hit: PairHit; d: number }[] = [];
  if (leftHit?.kind === "vertex") {
    const p = scene.left.vertices[leftHit.index];
    if (p) {
      ranked.push({
        hit: { ...leftHit, side: "left" },
        d: Math.hypot(p.x - x, p.y - y),
      });
    }
  }
  if (rightHit?.kind === "vertex") {
    const p = scene.right.vertices[rightHit.index];
    if (p) {
      ranked.push({
        hit: { ...rightHit, side: "right" },
        d: Math.hypot(p.x - x, p.y - y),
      });
    }
  }
  if (leftHit && leftHit.kind !== "vertex" && leftHit.kind !== "edge") {
    ranked.push({ hit: { ...leftHit, side: "left" }, d: 1 });
  }
  if (rightHit && rightHit.kind !== "vertex" && rightHit.kind !== "edge") {
    ranked.push({ hit: { ...rightHit, side: "right" }, d: 1 });
  }
  if (leftHit?.kind === "edge") {
    ranked.push({ hit: { ...leftHit, side: "left" }, d: 4 });
  }
  if (rightHit?.kind === "edge") {
    ranked.push({ hit: { ...rightHit, side: "right" }, d: 4 });
  }
  ranked.sort((a, b) => a.d - b.d);
  return ranked[0]?.hit ?? null;
}

export function applyPairEditedLabel(
  state: SimilarSolidsState,
  rawId: string,
  text: string,
): SimilarSolidsState {
  if (rawId === "figure:left") {
    return normalizeSimilarState({
      ...state,
      leftFigureLabel: text.trim() || "A",
    });
  }
  if (rawId === "figure:right") {
    return normalizeSimilarState({
      ...state,
      rightFigureLabel: text.trim() || "B",
    });
  }

  const { side, id } = stripPairPrefix(rawId);
  if (id.startsWith("vertex:") && side === "right") {
    const i = Number(id.slice(7));
    if (!Number.isFinite(i) || i < 0) return state;
    const rightVertexNames = [...state.rightVertexNames];
    while (rightVertexNames.length <= i) rightVertexNames.push("");
    rightVertexNames[i] = text.trim();
    return normalizeSimilarState({ ...state, rightVertexNames });
  }

  if (side === "left") {
    return patchSource(state, (s) => applyEditedLabel(s, id, text));
  }

  const parsed = parseMeasureInput(text);
  const k = similarityScale(state);
  const { right } = pairSolidStates(state);
  let source = state.source;
  if (parsed.kind === "number" && parsed.value != null && k > 1e-9) {
    const geomNext = applyEditedLabel(
      state.source,
      id,
      formatNiceNumber(parsed.value / k),
    );
    source = keepGeometry(geomNext, state.source);
  }
  const labeled = applyEditedLabel(right, id, text);
  return normalizeSimilarState({
    ...state,
    source,
    rightMarks: extractMeasureMarks(labeled),
  });
}

export function nudgePairById(
  state: SimilarSolidsState,
  scene: SimilarSolidsScene,
  rawId: string,
  dx: number,
  dy: number,
  lineOnly: boolean,
): SimilarSolidsState {
  if (rawId === "figure:left") {
    return normalizeSimilarState({
      ...state,
      leftFigureDx: state.leftFigureDx + dx,
      leftFigureDy: state.leftFigureDy + dy,
    });
  }
  if (rawId === "figure:right") {
    return normalizeSimilarState({
      ...state,
      rightFigureDx: state.rightFigureDx + dx,
      rightFigureDy: state.rightFigureDy + dy,
    });
  }
  const { side, id } = stripPairPrefix(rawId);
  const { left, right } = pairSolidStates(state);
  const sideSolid = side === "right" ? right : left;
  const nudged = nudgeMeasure(
    sideSolid,
    sideSolidScene(scene, side),
    id,
    dx,
    dy,
    lineOnly,
  );
  const marks = extractMeasureMarks(nudged);
  if (side === "left") {
    return patchSource(state, applyMeasureMarks(state.source, marks));
  }
  return normalizeSimilarState({ ...state, rightMarks: marks });
}

export function togglePairEdge(
  state: SimilarSolidsState,
  key: string,
  side: "left" | "right" = "left",
): SimilarSolidsState {
  if (side === "left") {
    return patchSource(state, (s) => toggleEdgeMeasure(s, key));
  }
  const { right } = pairSolidStates(state);
  return normalizeSimilarState({
    ...state,
    rightMarks: extractMeasureMarks(toggleEdgeMeasure(right, key)),
  });
}

export function orbitPairView(
  state: SimilarSolidsState,
  dx: number,
  dy: number,
): SimilarSolidsState {
  return normalizeSimilarState({
    ...state,
    source: orbitView(state.source, dx, dy),
  });
}
