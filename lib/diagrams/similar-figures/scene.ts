import type {
  DiagramScene as SharedDiagramScene,
  SceneCmd,
  SceneText,
} from "@/lib/diagrams/scene";
import { edgeLength } from "@/lib/diagrams/polygon/geometry";
import { appendPolygonFigure } from "@/lib/diagrams/polygon/scene";
import {
  autoLengthB,
  toPolygonA,
  toPolygonB,
  type SimilarFiguresState,
  type Vec,
} from "./model";
import { bbox, figureBPoints } from "./geometry";

export const SCENE_WIDTH = 760;
export const SCENE_HEIGHT = 440;

const GRID = "#c5dff0";

export type SceneLayout = {
  canvasA: Vec[];
  canvasB: Vec[];
  origin: Vec;
  mid: Vec;
  scale: number;
};

export type SimilarScene = SharedDiagramScene & {
  layout: SceneLayout;
};

export function mathToCanvas(p: Vec, layout: SceneLayout): Vec {
  return {
    x: layout.origin.x + (p.x - layout.mid.x) * layout.scale,
    y: layout.origin.y - (p.y - layout.mid.y) * layout.scale,
  };
}

export function canvasToMath(p: Vec, layout: SceneLayout): Vec {
  return {
    x: layout.mid.x + (p.x - layout.origin.x) / layout.scale,
    y: layout.mid.y - (p.y - layout.origin.y) / layout.scale,
  };
}

function mathBBox(state: SimilarFiguresState, ptsB: Vec[]): { min: Vec; max: Vec } {
  const box = bbox([...state.points, ...ptsB]);
  const span = Math.max(box.maxX - box.minX, box.maxY - box.minY, 1);
  const pad = 0.22 * span;
  return {
    min: { x: box.minX - pad, y: box.minY - pad },
    max: { x: box.maxX + pad, y: box.maxY + pad },
  };
}

export function getSceneLayout(state: SimilarFiguresState): SceneLayout {
  const ptsB = figureBPoints(state);
  const box = mathBBox(state, ptsB);
  const mid = {
    x: (box.min.x + box.max.x) / 2,
    y: (box.min.y + box.max.y) / 2,
  };
  const spanX = Math.max(box.max.x - box.min.x, 0.8);
  const spanY = Math.max(box.max.y - box.min.y, 0.8);
  const pad = state.style.padding;
  const scale = Math.min(
    (SCENE_WIDTH - pad * 2) / spanX,
    (SCENE_HEIGHT - pad * 2) / spanY,
  );
  const origin = { x: SCENE_WIDTH / 2, y: SCENE_HEIGHT / 2 };
  const toCanvas = (p: Vec): Vec => ({
    x: origin.x + (p.x - mid.x) * scale,
    y: origin.y - (p.y - mid.y) * scale,
  });
  return {
    canvasA: state.points.map(toCanvas),
    canvasB: ptsB.map(toCanvas),
    origin,
    mid,
    scale,
  };
}

function appendGrid(cmds: SceneCmd[], layout: SceneLayout): void {
  const { scale, origin, mid } = layout;
  if (scale < 1e-6) return;
  const mathLeft = mid.x - origin.x / scale;
  const mathRight = mid.x + (SCENE_WIDTH - origin.x) / scale;
  const mathTop = mid.y + origin.y / scale;
  const mathBottom = mid.y - (SCENE_HEIGHT - origin.y) / scale;
  const x0 = Math.floor(mathLeft);
  const x1 = Math.ceil(mathRight);
  const y0 = Math.floor(mathBottom);
  const y1 = Math.ceil(mathTop);
  const maxLines = 80;
  if (x1 - x0 > maxLines || y1 - y0 > maxLines) return;

  for (let x = x0; x <= x1; x += 1) {
    const a = mathToCanvas({ x, y: mathBottom }, layout);
    const b = mathToCanvas({ x, y: mathTop }, layout);
    cmds.push({
      t: "line",
      x1: a.x,
      y1: a.y,
      x2: b.x,
      y2: b.y,
      stroke: GRID,
      width: 1,
      id: "grid",
    });
  }
  for (let y = y0; y <= y1; y += 1) {
    const a = mathToCanvas({ x: mathLeft, y }, layout);
    const b = mathToCanvas({ x: mathRight, y }, layout);
    cmds.push({
      t: "line",
      x1: a.x,
      y1: a.y,
      x2: b.x,
      y2: b.y,
      stroke: GRID,
      width: 1,
      id: "grid",
    });
  }
}

export function buildSimilarFiguresScene(state: SimilarFiguresState): SimilarScene {
  const layout = getSceneLayout(state);
  const cmds: SceneCmd[] = [];
  const texts: SceneText[] = [];
  if (state.showGrid) appendGrid(cmds, layout);

  const toCanvas = (p: Vec) => mathToCanvas(p, layout);
  const polyA = toPolygonA(state);
  const ptsB = figureBPoints(state);
  const polyB = toPolygonB(state, ptsB);

  appendPolygonFigure(polyA, layout.canvasA, toCanvas, cmds, texts, {
    idPrefix: "a:",
  });
  appendPolygonFigure(polyB, layout.canvasB, toCanvas, cmds, texts, {
    idPrefix: "b:",
    lengthAt: (i) => autoLengthB(state, i, edgeLength(ptsB, i)),
  });

  return {
    width: SCENE_WIDTH,
    height: SCENE_HEIGHT,
    cmds,
    texts,
    layout,
  };
}
