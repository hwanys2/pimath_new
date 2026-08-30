import { runsToPlain, type TextRun } from "@/lib/diagrams/math-label";

export type Vec = { x: number; y: number };

export type TextAnchor = "start" | "middle" | "end";

export type SceneText = {
  id: string;
  x: number;
  y: number;
  runs: TextRun[];
  size: number;
  anchor: TextAnchor;
  /** Radians. Rotates around (x, y). */
  rotate?: number;
  fill?: string;
};

export type StrokeOpts = {
  stroke?: string;
  width?: number;
  dashed?: boolean;
  id?: string;
};

export type SceneCmd =
  | ({ t: "circle"; x: number; y: number; r: number } & StrokeOpts)
  | ({
      t: "line";
      x1: number;
      y1: number;
      x2: number;
      y2: number;
    } & StrokeOpts)
  | ({
      t: "quad";
      x1: number;
      y1: number;
      cx: number;
      cy: number;
      x2: number;
      y2: number;
    } & StrokeOpts)
  | ({
      t: "polyline";
      pts: Vec[];
    } & StrokeOpts)
  | ({
      t: "arc";
      cx: number;
      cy: number;
      r: number;
      a0: number;
      a1: number;
      ccw: boolean;
    } & StrokeOpts)
  | ({ t: "dot"; x: number; y: number; r: number } & Pick<StrokeOpts, "stroke">)
  | {
      t: "polygon";
      points: Vec[];
      fill: string;
    }
  | {
      t: "sector";
      cx: number;
      cy: number;
      r: number;
      a0: number;
      a1: number;
      ccw: boolean;
      fill: string;
    }
  | ({
      t: "ellipseArc";
      cx: number;
      cy: number;
      ux: number;
      uy: number;
      vx: number;
      vy: number;
      a0: number;
      a1: number;
    } & StrokeOpts)
  | {
      t: "rightAngle";
      x: number;
      y: number;
      ux: number;
      uy: number;
      vx: number;
      vy: number;
      size: number;
    }
  | {
      t: "arrowhead";
      x: number;
      y: number;
      ux: number;
      uy: number;
      size: number;
      stroke?: string;
    }
  | {
      t: "roundRect";
      x: number;
      y: number;
      w: number;
      h: number;
      r: number;
      fill?: string;
      stroke?: string;
      width?: number;
      dashed?: boolean;
    }
  | { t: "emoji"; x: number; y: number; char: string; size: number }
  | { t: "text"; text: SceneText };

export type DiagramScene = {
  width: number;
  height: number;
  cmds: SceneCmd[];
  texts: SceneText[];
};

export function sceneTextPlain(text: SceneText): string {
  return runsToPlain(text.runs);
}

export function hitTestText(
  scene: DiagramScene,
  x: number,
  y: number,
  radius = 22,
): SceneText | null {
  let best: SceneText | null = null;
  let bestD = radius;
  for (const text of scene.texts) {
    const d = Math.hypot(text.x - x, text.y - y);
    if (d < bestD) {
      best = text;
      bestD = d;
    }
  }
  return best;
}
