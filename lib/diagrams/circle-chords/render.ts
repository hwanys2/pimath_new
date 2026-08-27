import {
  fillRuns,
  type FontFaces,
} from "@/lib/diagrams/math-label";
import type { DiagramScene, SceneCmd } from "@/lib/diagrams/circle-chords/scene";

const INK = "#111111";

export function paintCircleChordsScene(
  ctx: CanvasRenderingContext2D,
  scene: DiagramScene,
  fonts: FontFaces,
  lineWidth: number,
): void {
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, scene.width, scene.height);
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (const cmd of scene.cmds) {
    paintCmd(ctx, cmd, fonts);
  }
  ctx.restore();
}

function paintCmd(
  ctx: CanvasRenderingContext2D,
  cmd: SceneCmd,
  fonts: FontFaces,
): void {
  switch (cmd.t) {
    case "circle":
      ctx.beginPath();
      ctx.arc(cmd.x, cmd.y, cmd.r, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case "line":
      ctx.save();
      if (cmd.dashed) ctx.setLineDash([4.2, 3.2]);
      ctx.beginPath();
      ctx.moveTo(cmd.x1, cmd.y1);
      ctx.lineTo(cmd.x2, cmd.y2);
      ctx.stroke();
      ctx.restore();
      break;
    case "quad":
      ctx.save();
      if (cmd.dashed) ctx.setLineDash([4.2, 3.2]);
      ctx.beginPath();
      ctx.moveTo(cmd.x1, cmd.y1);
      ctx.quadraticCurveTo(cmd.cx, cmd.cy, cmd.x2, cmd.y2);
      ctx.stroke();
      ctx.restore();
      break;
    case "dot":
      ctx.beginPath();
      ctx.arc(cmd.x, cmd.y, cmd.r, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "rightAngle": {
      const s = cmd.size;
      ctx.beginPath();
      ctx.moveTo(cmd.x + cmd.ux * s, cmd.y + cmd.uy * s);
      ctx.lineTo(
        cmd.x + cmd.ux * s + cmd.vx * s,
        cmd.y + cmd.uy * s + cmd.vy * s,
      );
      ctx.lineTo(cmd.x + cmd.vx * s, cmd.y + cmd.vy * s);
      ctx.stroke();
      break;
    }
    case "text":
      fillRuns(
        ctx,
        cmd.text.runs,
        cmd.text.x,
        cmd.text.y,
        cmd.text.size,
        fonts,
        cmd.text.anchor,
      );
      break;
    default:
      break;
  }
}

export function sceneToSvg(
  scene: DiagramScene,
  fonts: FontFaces,
  lineWidth: number,
): string {
  const parts: string[] = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${scene.width}" height="${scene.height}" viewBox="0 0 ${scene.width} ${scene.height}">`,
    `<rect width="100%" height="100%" fill="#ffffff"/>`,
    `<g fill="none" stroke="${INK}" stroke-width="${lineWidth}" stroke-linecap="round" stroke-linejoin="round">`,
  ];

  for (const cmd of scene.cmds) {
    if (cmd.t === "text") continue;
    parts.push(cmdToSvg(cmd));
  }
  parts.push(`</g>`);

  for (const cmd of scene.cmds) {
    if (cmd.t !== "text") continue;
    const t = cmd.text;
    const anchor =
      t.anchor === "middle" ? "middle" : t.anchor === "end" ? "end" : "start";
    const tspans = t.runs
      .map((run) => {
        const style = run.italic ? "italic" : "normal";
        return `<tspan font-style="${style}">${escapeXml(run.text)}</tspan>`;
      })
      .join("");
    parts.push(
      `<text x="${t.x.toFixed(2)}" y="${t.y.toFixed(2)}" text-anchor="${anchor}" dominant-baseline="middle" fill="${INK}" font-size="${t.size}" font-family="${escapeXml(fonts.math)}, ${escapeXml(fonts.korean)}, 'Times New Roman', Batang, serif">${tspans}</text>`,
    );
  }

  parts.push(`</svg>`);
  return parts.join("\n");
}

function cmdToSvg(cmd: SceneCmd): string {
  const dash = "stroke-dasharray=\"4.2 3.2\"";
  switch (cmd.t) {
    case "circle":
      return `<circle cx="${cmd.x}" cy="${cmd.y}" r="${cmd.r}"/>`;
    case "line":
      return `<line x1="${cmd.x1}" y1="${cmd.y1}" x2="${cmd.x2}" y2="${cmd.y2}"${cmd.dashed ? ` ${dash}` : ""}/>`;
    case "quad":
      return `<path d="M ${cmd.x1} ${cmd.y1} Q ${cmd.cx} ${cmd.cy} ${cmd.x2} ${cmd.y2}"${cmd.dashed ? ` ${dash}` : ""}/>`;
    case "dot":
      return `<circle cx="${cmd.x}" cy="${cmd.y}" r="${cmd.r}" fill="${INK}" stroke="none"/>`;
    case "rightAngle": {
      const s = cmd.size;
      const x1 = cmd.x + cmd.ux * s;
      const y1 = cmd.y + cmd.uy * s;
      const x2 = cmd.x + cmd.ux * s + cmd.vx * s;
      const y2 = cmd.y + cmd.uy * s + cmd.vy * s;
      const x3 = cmd.x + cmd.vx * s;
      const y3 = cmd.y + cmd.vy * s;
      return `<path d="M ${x1} ${y1} L ${x2} ${y2} L ${x3} ${y3}"/>`;
    }
    default:
      return "";
  }
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderSceneToCanvas(
  scene: DiagramScene,
  fonts: FontFaces,
  lineWidth: number,
  scale: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(scene.width * scale);
  canvas.height = Math.round(scene.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.scale(scale, scale);
  paintCircleChordsScene(ctx, scene, fonts, lineWidth);
  return canvas;
}
