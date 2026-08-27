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
      if (cmd.id) ctx.lineCap = "butt";
      ctx.beginPath();
      ctx.moveTo(cmd.x1, cmd.y1);
      ctx.lineTo(cmd.x2, cmd.y2);
      ctx.stroke();
      ctx.restore();
      break;
    case "arc":
      ctx.save();
      if (cmd.dashed) {
        const sweep = arcSweep(cmd.a0, cmd.a1, cmd.ccw);
        const arcLen = Math.max(cmd.r * sweep, 1);
        const n = Math.max(4, Math.round(arcLen / 7.4));
        const period = arcLen / n;
        ctx.setLineDash([period * 0.56, period * 0.44]);
      }
      ctx.lineCap = "butt";
      ctx.beginPath();
      ctx.arc(cmd.cx, cmd.cy, cmd.r, cmd.a0, cmd.a1, cmd.ccw);
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
        const family = run.italic
          ? `'Times New Roman', ${escapeXml(fonts.math)}, serif`
          : `${escapeXml(fonts.math)}, ${escapeXml(fonts.korean)}, 'Times New Roman', Batang, serif`;
        return `<tspan font-style="${style}" font-family="${family}">${escapeXml(run.text)}</tspan>`;
      })
      .join("");
    parts.push(
      `<text x="${t.x.toFixed(2)}" y="${t.y.toFixed(2)}" text-anchor="${anchor}" dominant-baseline="middle" fill="${INK}" font-size="${t.size}">${tspans}</text>`,
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
    case "arc": {
      const x0 = cmd.cx + cmd.r * Math.cos(cmd.a0);
      const y0 = cmd.cy + cmd.r * Math.sin(cmd.a0);
      const x1 = cmd.cx + cmd.r * Math.cos(cmd.a1);
      const y1 = cmd.cy + cmd.r * Math.sin(cmd.a1);
      const sweep = arcSweep(cmd.a0, cmd.a1, cmd.ccw);
      const large = sweep > Math.PI ? 1 : 0;
      const sweepFlag = cmd.ccw ? 0 : 1;
      return `<path d="M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${cmd.r.toFixed(2)} ${cmd.r.toFixed(2)} 0 ${large} ${sweepFlag} ${x1.toFixed(2)} ${y1.toFixed(2)}"${cmd.dashed ? ` ${dash}` : ""}/>`;
    }
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

function arcSweep(a0: number, a1: number, ccw: boolean): number {
  const two = Math.PI * 2;
  const n = (a: number) => ((a % two) + two) % two;
  if (ccw) {
    let m = n(a0) - n(a1);
    if (m < 0) m += two;
    return m;
  }
  let m = n(a1) - n(a0);
  if (m < 0) m += two;
  return m;
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
