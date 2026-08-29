import type { TextRun } from "@/lib/diagrams/math-label";

export type Vec = { x: number; y: number };

export type TextAnchor = "start" | "middle" | "end";

export type SceneText = {
  id: string;
  x: number;
  y: number;
  runs: TextRun[];
  size: number;
  anchor: TextAnchor;
};

export type SceneCmd =
  | { t: "circle"; x: number; y: number; r: number }
  | {
      t: "line";
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      dashed?: boolean;
      id?: string;
    }
  | {
      t: "quad";
      x1: number;
      y1: number;
      cx: number;
      cy: number;
      x2: number;
      y2: number;
      dashed?: boolean;
      id?: string;
    }
  | {
      t: "arc";
      cx: number;
      cy: number;
      r: number;
      a0: number;
      a1: number;
      ccw: boolean;
      dashed?: boolean;
      id?: string;
    }
  | { t: "dot"; x: number; y: number; r: number }
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
    }
  | { t: "text"; text: SceneText };

export type DiagramScene = {
  width: number;
  height: number;
  cmds: SceneCmd[];
  texts: SceneText[];
};

export function sceneTextPlain(text: SceneText): string {
  return text.runs.map((run) => run.text).join("");
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
