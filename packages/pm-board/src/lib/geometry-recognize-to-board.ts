import type {
  GeometryRecognizeResult,
  PlaneFigure,
  SolidSpec,
  SolidWidgetState,
} from "../board/geometry-types";
import type { BackgroundId, BoardPoint, Stroke } from "../board/types";
import { clipLineToViewport } from "./board-line-clip";
import {
  mathImageDimensions,
  mathImageToClient,
} from "./board-math-image";
import type { BoardRect } from "./board-stroke-bounds";

function defaultPenColor(background: BackgroundId): string {
  return background === "chalkboard" ? "#ffffff" : "#1f2937";
}

function mapPt(
  x: number,
  y: number,
  rect: BoardRect,
): [number, number] {
  return mathImageToClient(x, y, rect);
}

function lineStroke(
  from: [number, number],
  to: [number, number],
  rect: BoardRect,
  color: string,
  size: number,
  lineKind: "segment" | "infinite",
  vw: number,
  vh: number,
): Stroke {
  let [x0, y0] = mapPt(from[0], from[1], rect);
  let [x1, y1] = mapPt(to[0], to[1], rect);
  if (lineKind === "infinite") {
    const clipped = clipLineToViewport(x0, y0, x1, y1, vw, vh, "infinite");
    x0 = clipped.x0;
    y0 = clipped.y0;
    x1 = clipped.x1;
    y1 = clipped.y1;
  }
  return {
    tool: "line",
    color,
    size,
    points: [x0, y0, x1, y1],
    lineKind,
  };
}

function figureToStrokes(
  fig: PlaneFigure,
  rect: BoardRect,
  color: string,
  size: number,
  vw: number,
  vh: number,
): Stroke[] {
  switch (fig.type) {
    case "segment":
      return [
        lineStroke(fig.from, fig.to, rect, color, size, "segment", vw, vh),
      ];
    case "line":
      return [
        lineStroke(fig.from, fig.to, rect, color, size, "infinite", vw, vh),
      ];
    case "circle": {
      const [cx, cy] = mapPt(fig.center[0], fig.center[1], rect);
      const dims = mathImageDimensions(rect);
      const selW = Math.max(rect.x1 - rect.x0, 1);
      const scale = selW / dims.w;
      const radius = fig.radius * scale;
      return [
        {
          tool: "ellipse",
          color,
          size,
          points: [cx - radius, cy - radius, cx + radius, cy + radius],
        },
      ];
    }
    case "rectangle": {
      const [x0, y0] = mapPt(fig.x, fig.y, rect);
      const dims = mathImageDimensions(rect);
      const selW = Math.max(rect.x1 - rect.x0, 1);
      const selH = Math.max(rect.y1 - rect.y0, 1);
      const w = (fig.width / dims.w) * selW;
      const h = (fig.height / dims.h) * selH;
      return [
        {
          tool: "rect",
          color,
          size,
          points: [x0, y0, x0 + w, y0 + h],
        },
      ];
    }
    case "triangle": {
      const verts = fig.vertices.map((v) => mapPt(v[0], v[1], rect));
      return [
        lineStroke(verts[0], verts[1], rect, color, size, "segment", vw, vh),
        lineStroke(verts[1], verts[2], rect, color, size, "segment", vw, vh),
        lineStroke(verts[2], verts[0], rect, color, size, "segment", vw, vh),
      ];
    }
    case "polygon": {
      const verts = fig.vertices.map((v) => mapPt(v[0], v[1], rect));
      const out: Stroke[] = [];
      for (let i = 0; i < verts.length; i++) {
        const a = verts[i];
        const b = verts[(i + 1) % verts.length];
        out.push(
          lineStroke(a, b, rect, color, size, "segment", vw, vh),
        );
      }
      return out;
    }
    default:
      return [];
  }
}

function solidToWidgetState(solid: SolidSpec): SolidWidgetState {
  const a = solid.params.a ?? 80;
  return {
    type: solid.type,
    unfoldT: 1,
    params: { ...solid.params, a },
    rotationDeg: solid.rotationDeg ?? 0,
  };
}

export function geometryResultToBoard(payload: {
  result: GeometryRecognizeResult;
  rect: BoardRect;
  background: BackgroundId;
  color?: string;
  size?: number;
  viewportW?: number;
  viewportH?: number;
}): {
  strokes: Stroke[];
  points: BoardPoint[];
  solidState?: SolidWidgetState;
} {
  const {
    result,
    rect,
    background,
    color = defaultPenColor(background),
    size = 4,
    viewportW = typeof window !== "undefined" ? window.innerWidth : 1200,
    viewportH = typeof window !== "undefined" ? window.innerHeight : 800,
  } = payload;

  const strokes: Stroke[] = [];
  for (const fig of result.figures) {
    strokes.push(
      ...figureToStrokes(fig, rect, color, size, viewportW, viewportH),
    );
  }

  let solidState: SolidWidgetState | undefined;
  if (result.solid) {
    solidState = solidToWidgetState(result.solid);
  }

  return { strokes, points: [], solidState };
}
