import { parseNameRuns } from "@/lib/diagrams/math-label";
import type { DiagramScene as SharedDiagramScene, SceneCmd, SceneText } from "@/lib/diagrams/scene";
import { cameraFromView, fitProjected, toCanvas, type Cam, type Fit } from "@/lib/diagrams/solid-sketch/project";
import {
  buildSolidSketchScene,
  collectFitPoints,
  type SolidLayout,
  type SolidScene,
} from "@/lib/diagrams/solid-sketch/scene";
import { buildSolidMesh, meshExtentX, transformMesh } from "@/lib/diagrams/solid-sketch/solids";
import { add3, v3 } from "@/lib/diagrams/solid-sketch/vec3";
import {
  pairSolidStates,
  type SimilarSolidsState,
} from "./model";

export const SCENE_WIDTH = 840;
export const SCENE_HEIGHT = 480;

export type SimilarSolidsScene = SharedDiagramScene & {
  left: SolidLayout;
  right: SolidLayout;
  cam: Cam;
  fit: Fit;
};

function canvasBounds(layout: SolidLayout, cam: Cam, fit: Fit): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  cx: number;
} {
  const pts = collectFitPoints(layout.mesh, cam).map((p) => toCanvas(p, fit));
  if (pts.length === 0) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0, cx: SCENE_WIDTH / 2 };
  }
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, maxX, minY, maxY, cx: (minX + maxX) / 2 };
}

function placeMeshesSideBySide(
  leftMesh: ReturnType<typeof buildSolidMesh>,
  rightMesh: ReturnType<typeof buildSolidMesh>,
) {
  const leftExt = meshExtentX(leftMesh);
  const rightExt = meshExtentX(rightMesh);
  const leftW = Math.max(leftExt.max - leftExt.min, 0.4);
  const rightW = Math.max(rightExt.max - rightExt.min, 0.4);
  const gap = Math.max(1.1, 0.22 * (leftW + rightW));
  const leftDx = -gap / 2 - leftExt.max;
  const rightDx = gap / 2 - rightExt.min;
  return {
    left: transformMesh(leftMesh, (p) => add3(p, v3(leftDx, 0, 0))),
    right: transformMesh(rightMesh, (p) => add3(p, v3(rightDx, 0, 0))),
  };
}

export function buildSimilarSolidsScene(state: SimilarSolidsState): SimilarSolidsScene {
  const width = SCENE_WIDTH;
  const height = SCENE_HEIGHT;
  const { left, right } = pairSolidStates(state);
  const cam = cameraFromView(left.azimuthDeg, left.elevationDeg);
  const placed = placeMeshesSideBySide(buildSolidMesh(left), buildSolidMesh(right));
  const pad = left.style.padding + (state.showFigureLabels ? 40 : 8);
  const fit = fitProjected(
    [...collectFitPoints(placed.left, cam), ...collectFitPoints(placed.right, cam)],
    width,
    height,
    pad,
  );

  const leftScene = buildSolidSketchScene(left, {
    width,
    height,
    cam,
    fit,
    mesh: placed.left,
    idPrefix: "L:",
  });
  const rightScene = buildSolidSketchScene(right, {
    width,
    height,
    cam,
    fit,
    mesh: placed.right,
    idPrefix: "R:",
  });

  const cmds: SceneCmd[] = [...leftScene.cmds, ...rightScene.cmds];
  const texts: SceneText[] = [...leftScene.texts, ...rightScene.texts];

  if (state.showFigureLabels) {
    const size = Math.max(left.style.pointLabelSize, 26);
    const addFigure = (
      layout: SolidLayout,
      label: string,
      id: string,
      dx: number,
      dy: number,
    ) => {
      const name = label.trim();
      if (!name) return;
      const box = canvasBounds(layout, cam, fit);
      const x = box.cx + dx;
      const y = box.maxY + size * 0.9 + dy;
      const text: SceneText = {
        id,
        x,
        y,
        runs: parseNameRuns(name),
        size,
        anchor: "middle",
      };
      texts.push(text);
      cmds.push({ t: "text", text });
    };
    addFigure(
      leftScene.layout,
      state.leftFigureLabel,
      "figure:left",
      state.leftFigureDx,
      state.leftFigureDy,
    );
    addFigure(
      rightScene.layout,
      state.rightFigureLabel,
      "figure:right",
      state.rightFigureDx,
      state.rightFigureDy,
    );
  }

  return {
    width,
    height,
    cmds,
    texts,
    left: leftScene.layout,
    right: rightScene.layout,
    cam,
    fit,
  };
}

export function sideSolidScene(
  pair: SimilarSolidsScene,
  side: "left" | "right",
): SolidScene {
  const prefix = side === "left" ? "L:" : "R:";
  const other = side === "left" ? "R:" : "L:";
  const strip = (id: string) => (id.startsWith(prefix) ? id.slice(prefix.length) : id);
  return {
    width: pair.width,
    height: pair.height,
    cmds: pair.cmds.flatMap((cmd): SceneCmd[] => {
      if (cmd.t === "text") {
        if (cmd.text.id.startsWith(other) || cmd.text.id.startsWith("figure:")) {
          return [];
        }
        if (cmd.text.id.startsWith(prefix)) {
          return [{ ...cmd, text: { ...cmd.text, id: strip(cmd.text.id) } }];
        }
        return [cmd];
      }
      if ("id" in cmd && typeof cmd.id === "string" && cmd.id.length > 0) {
        if (cmd.id.startsWith(other) || cmd.id.startsWith("figure:")) return [];
        if (cmd.id.startsWith(prefix)) return [{ ...cmd, id: strip(cmd.id) }];
      }
      return [cmd];
    }),
    texts: pair.texts
      .filter((t) => t.id.startsWith(prefix))
      .map((t) => ({ ...t, id: t.id.slice(prefix.length) })),
    layout: side === "left" ? pair.left : pair.right,
  };
}
