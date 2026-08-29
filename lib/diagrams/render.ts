import {
  fillRuns,
  type FontFaces,
  type TextRun,
} from "@/lib/diagrams/math-label";
import type { DiagramScene, SceneCmd, SceneText } from "@/lib/diagrams/scene";

const INK = "#111111";

export function paintDiagramScene(
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
    paintCmd(ctx, cmd, fonts, lineWidth);
  }
  ctx.restore();
}

/** @deprecated Use paintDiagramScene */
export const paintCircleChordsScene = paintDiagramScene;

function paintCmd(
  ctx: CanvasRenderingContext2D,
  cmd: SceneCmd,
  fonts: FontFaces,
  defaultWidth: number,
): void {
  switch (cmd.t) {
    case "circle":
      ctx.save();
      applyStroke(ctx, cmd, defaultWidth);
      ctx.beginPath();
      ctx.arc(cmd.x, cmd.y, cmd.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      break;
    case "line":
      ctx.save();
      applyStroke(ctx, cmd, defaultWidth);
      if (cmd.dashed) ctx.setLineDash([4.2, 3.2]);
      if (cmd.id) ctx.lineCap = "butt";
      ctx.beginPath();
      ctx.moveTo(cmd.x1, cmd.y1);
      ctx.lineTo(cmd.x2, cmd.y2);
      ctx.stroke();
      ctx.restore();
      break;
    case "quad":
      ctx.save();
      applyStroke(ctx, cmd, defaultWidth);
      if (cmd.dashed) ctx.setLineDash([4.2, 3.2]);
      if (cmd.id) ctx.lineCap = "butt";
      ctx.beginPath();
      ctx.moveTo(cmd.x1, cmd.y1);
      ctx.quadraticCurveTo(cmd.cx, cmd.cy, cmd.x2, cmd.y2);
      ctx.stroke();
      ctx.restore();
      break;
    case "polyline": {
      if (cmd.pts.length < 2) break;
      ctx.save();
      applyStroke(ctx, cmd, defaultWidth);
      if (cmd.dashed) ctx.setLineDash([4.2, 3.2]);
      if (cmd.id) ctx.lineCap = "butt";
      ctx.beginPath();
      ctx.moveTo(cmd.pts[0]!.x, cmd.pts[0]!.y);
      for (let i = 1; i < cmd.pts.length; i += 1) {
        ctx.lineTo(cmd.pts[i]!.x, cmd.pts[i]!.y);
      }
      ctx.stroke();
      ctx.restore();
      break;
    }
    case "arc":
      ctx.save();
      applyStroke(ctx, cmd, defaultWidth);
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
    case "polygon": {
      if (cmd.points.length < 3) break;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cmd.points[0]!.x, cmd.points[0]!.y);
      for (let i = 1; i < cmd.points.length; i++) {
        ctx.lineTo(cmd.points[i]!.x, cmd.points[i]!.y);
      }
      ctx.closePath();
      ctx.fillStyle = cmd.fill;
      ctx.fill();
      ctx.restore();
      break;
    }
    case "sector": {
      if (cmd.r <= 0) break;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cmd.cx, cmd.cy);
      ctx.arc(cmd.cx, cmd.cy, cmd.r, cmd.a0, cmd.a1, cmd.ccw);
      ctx.closePath();
      ctx.fillStyle = cmd.fill;
      ctx.fill();
      ctx.restore();
      break;
    }
    case "ellipseArc": {
      const pts = ellipseArcPoints(cmd);
      if (pts.length < 2) break;
      ctx.save();
      applyStroke(ctx, cmd, defaultWidth);
      if (cmd.dashed) ctx.setLineDash([4.2, 3.2]);
      if (cmd.id) ctx.lineCap = "butt";
      ctx.beginPath();
      ctx.moveTo(pts[0]!.x, pts[0]!.y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i]!.x, pts[i]!.y);
      }
      ctx.stroke();
      ctx.restore();
      break;
    }
    case "dot":
      ctx.save();
      ctx.fillStyle = cmd.stroke ?? INK;
      ctx.beginPath();
      ctx.arc(cmd.x, cmd.y, cmd.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
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
    case "arrowhead": {
      const pts = arrowheadPoints(cmd);
      ctx.save();
      ctx.fillStyle = cmd.stroke ?? INK;
      ctx.beginPath();
      ctx.moveTo(pts[0]!.x, pts[0]!.y);
      ctx.lineTo(pts[1]!.x, pts[1]!.y);
      ctx.lineTo(pts[2]!.x, pts[2]!.y);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      break;
    }
    case "text": {
      const t = cmd.text;
      if (t.rotate) {
        ctx.save();
        ctx.translate(t.x, t.y);
        ctx.rotate(t.rotate);
        fillRuns(ctx, t.runs, 0, 0, t.size, fonts, t.anchor);
        ctx.restore();
      } else {
        fillRuns(ctx, t.runs, t.x, t.y, t.size, fonts, t.anchor);
      }
      break;
    }
    default:
      break;
  }
}

function applyStroke(
  ctx: CanvasRenderingContext2D,
  cmd: { stroke?: string; width?: number },
  defaultWidth: number,
): void {
  if (cmd.stroke) {
    ctx.strokeStyle = cmd.stroke;
    ctx.fillStyle = cmd.stroke;
  }
  if (cmd.width != null) ctx.lineWidth = cmd.width;
  else ctx.lineWidth = defaultWidth;
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
  ];

  for (const cmd of scene.cmds) {
    if (cmd.t === "polygon") parts.push(polygonToSvg(cmd));
    if (cmd.t === "sector") parts.push(sectorToSvg(cmd));
  }
  parts.push(
    `<g fill="none" stroke="${INK}" stroke-width="${lineWidth}" stroke-linecap="round" stroke-linejoin="round">`,
  );
  for (const cmd of scene.cmds) {
    if (cmd.t === "text" || cmd.t === "polygon" || cmd.t === "sector") continue;
    parts.push(cmdToSvg(cmd, lineWidth));
  }
  parts.push(`</g>`);

  for (const cmd of scene.cmds) {
    if (cmd.t !== "text") continue;
    parts.push(textToSvg(cmd.text, fonts));
  }

  parts.push(`</svg>`);
  return parts.join("\n");
}

function polygonToSvg(cmd: Extract<SceneCmd, { t: "polygon" }>): string {
  if (cmd.points.length < 3) return "";
  const pts = cmd.points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
  return `<polygon points="${pts}" fill="${escapeXml(cmd.fill)}" stroke="none"/>`;
}

function sectorToSvg(cmd: Extract<SceneCmd, { t: "sector" }>): string {
  if (cmd.r <= 0) return "";
  const x0 = cmd.cx + cmd.r * Math.cos(cmd.a0);
  const y0 = cmd.cy + cmd.r * Math.sin(cmd.a0);
  const x1 = cmd.cx + cmd.r * Math.cos(cmd.a1);
  const y1 = cmd.cy + cmd.r * Math.sin(cmd.a1);
  const sweep = arcSweep(cmd.a0, cmd.a1, cmd.ccw);
  const large = sweep > Math.PI ? 1 : 0;
  const sweepFlag = cmd.ccw ? 0 : 1;
  return `<path d="M ${cmd.cx.toFixed(2)} ${cmd.cy.toFixed(2)} L ${x0.toFixed(2)} ${y0.toFixed(2)} A ${cmd.r.toFixed(2)} ${cmd.r.toFixed(2)} 0 ${large} ${sweepFlag} ${x1.toFixed(2)} ${y1.toFixed(2)} Z" fill="${escapeXml(cmd.fill)}" stroke="none"/>`;
}

function ellipseArcPoints(cmd: Extract<SceneCmd, { t: "ellipseArc" }>): {
  x: number;
  y: number;
}[] {
  let a0 = cmd.a0;
  let a1 = cmd.a1;
  while (a1 < a0) a1 += Math.PI * 2;
  const sweep = a1 - a0;
  if (sweep < 1e-9) return [];
  const n = Math.max(12, Math.ceil(sweep / (Math.PI / 24)));
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= n; i++) {
    const t = a0 + (sweep * i) / n;
    pts.push({
      x: cmd.cx + cmd.ux * Math.cos(t) + cmd.vx * Math.sin(t),
      y: cmd.cy + cmd.uy * Math.cos(t) + cmd.vy * Math.sin(t),
    });
  }
  return pts;
}

function strokeAttrs(cmd: {
  stroke?: string;
  width?: number;
  dashed?: boolean;
}): string {
  const parts: string[] = [];
  if (cmd.stroke) parts.push(`stroke="${escapeXml(cmd.stroke)}"`);
  if (cmd.width != null) parts.push(`stroke-width="${cmd.width}"`);
  if (cmd.dashed) parts.push(`stroke-dasharray="4.2 3.2"`);
  return parts.length ? ` ${parts.join(" ")}` : "";
}

function cmdToSvg(cmd: SceneCmd, defaultWidth: number): string {
  switch (cmd.t) {
    case "circle":
      return `<circle cx="${cmd.x}" cy="${cmd.y}" r="${cmd.r}"${strokeAttrs(cmd)}/>`;
    case "line":
      return `<line x1="${cmd.x1}" y1="${cmd.y1}" x2="${cmd.x2}" y2="${cmd.y2}"${strokeAttrs(cmd)}/>`;
    case "quad":
      return `<path d="M ${cmd.x1.toFixed(2)} ${cmd.y1.toFixed(2)} Q ${cmd.cx.toFixed(2)} ${cmd.cy.toFixed(2)} ${cmd.x2.toFixed(2)} ${cmd.y2.toFixed(2)}"${strokeAttrs(cmd)}/>`;
    case "polyline": {
      if (cmd.pts.length < 2) return "";
      const d = cmd.pts
        .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
        .join(" ");
      return `<path d="${d}"${strokeAttrs(cmd)}/>`;
    }
    case "arc": {
      const x0 = cmd.cx + cmd.r * Math.cos(cmd.a0);
      const y0 = cmd.cy + cmd.r * Math.sin(cmd.a0);
      const x1 = cmd.cx + cmd.r * Math.cos(cmd.a1);
      const y1 = cmd.cy + cmd.r * Math.sin(cmd.a1);
      const sweep = arcSweep(cmd.a0, cmd.a1, cmd.ccw);
      const large = sweep > Math.PI ? 1 : 0;
      const sweepFlag = cmd.ccw ? 0 : 1;
      return `<path d="M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${cmd.r.toFixed(2)} ${cmd.r.toFixed(2)} 0 ${large} ${sweepFlag} ${x1.toFixed(2)} ${y1.toFixed(2)}"${strokeAttrs(cmd)}/>`;
    }
    case "ellipseArc": {
      const pts = ellipseArcPoints(cmd);
      if (pts.length < 2) return "";
      const d = pts
        .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
        .join(" ");
      return `<path d="${d}"${strokeAttrs(cmd)}/>`;
    }
    case "dot": {
      const fill = cmd.stroke ?? INK;
      return `<circle cx="${cmd.x}" cy="${cmd.y}" r="${cmd.r}" fill="${fill}" stroke="none"/>`;
    }
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
    case "arrowhead": {
      const pts = arrowheadPoints(cmd);
      const fill = cmd.stroke ?? INK;
      return `<path d="M ${pts[0]!.x.toFixed(2)} ${pts[0]!.y.toFixed(2)} L ${pts[1]!.x.toFixed(2)} ${pts[1]!.y.toFixed(2)} L ${pts[2]!.x.toFixed(2)} ${pts[2]!.y.toFixed(2)} Z" fill="${fill}" stroke="none"/>`;
    }
    default:
      return "";
  }
}

function textToSvg(t: SceneText, fonts: FontFaces): string {
  const transform = t.rotate
    ? ` transform="rotate(${((t.rotate * 180) / Math.PI).toFixed(2)} ${t.x.toFixed(2)} ${t.y.toFixed(2)})"`
    : "";
  const hasFrac = t.runs.some((r) => r.fracNum && r.fracDen);
  if (!hasFrac) {
    const anchor =
      t.anchor === "middle" ? "middle" : t.anchor === "end" ? "end" : "start";
    return `<text x="${t.x.toFixed(2)}" y="${t.y.toFixed(2)}" text-anchor="${anchor}" dominant-baseline="middle" fill="${INK}" font-size="${t.size}"${transform}>${runsToTspans(t.runs, fonts)}</text>`;
  }
  // Approximate frac layout with a group; canvas PNG is the primary export.
  return `<g${transform}>${fracGroupSvg(t, fonts)}</g>`;
}

function fracGroupSvg(t: SceneText, fonts: FontFaces): string {
  // We cannot measure in SVG export without a canvas; place tspans sequentially
  // and draw frac as nested texts. Widths are estimated from character counts.
  const parts: string[] = [];
  const est = estimateRunsWidth(t.runs, t.size);
  let cursor =
    t.anchor === "middle"
      ? t.x - est / 2
      : t.anchor === "end"
        ? t.x - est
        : t.x;
  for (const run of t.runs) {
    const w = estimateRunWidth(run, t.size);
    if (run.fracNum && run.fracDen) {
      const mid = cursor + w / 2;
      const fracSize = t.size * 0.72;
      const lineW = Math.max(w - t.size * 0.1, t.size * 0.4);
      parts.push(
        `<text x="${mid.toFixed(2)}" y="${(t.y - fracSize * 0.58).toFixed(2)}" text-anchor="middle" dominant-baseline="middle" fill="${INK}" font-size="${fracSize}">${runsToTspans(run.fracNum, fonts)}</text>`,
      );
      parts.push(
        `<text x="${mid.toFixed(2)}" y="${(t.y + fracSize * 0.58).toFixed(2)}" text-anchor="middle" dominant-baseline="middle" fill="${INK}" font-size="${fracSize}">${runsToTspans(run.fracDen, fonts)}</text>`,
      );
      parts.push(
        `<line x1="${(mid - lineW / 2).toFixed(2)}" y1="${t.y.toFixed(2)}" x2="${(mid + lineW / 2).toFixed(2)}" y2="${t.y.toFixed(2)}" stroke="${INK}" stroke-width="${Math.max(1, t.size * 0.06)}"/>`,
      );
    } else {
      parts.push(
        `<text x="${cursor.toFixed(2)}" y="${t.y.toFixed(2)}" text-anchor="start" dominant-baseline="middle" fill="${INK}" font-size="${t.size}">${runsToTspans([run], fonts)}</text>`,
      );
    }
    cursor += w;
  }
  return parts.join("");
}

function estimateRunsWidth(runs: TextRun[], size: number): number {
  let w = 0;
  for (const run of runs) w += estimateRunWidth(run, size);
  return w;
}

function estimateRunWidth(run: TextRun, size: number): number {
  if (run.fracNum && run.fracDen) {
    const nw = estimateRunsWidth(run.fracNum, size * 0.72);
    const dw = estimateRunsWidth(run.fracDen, size * 0.72);
    return Math.max(nw, dw, size * 0.45) + size * 0.22;
  }
  const italic = run.italic ? 0.52 : 0.56;
  return Math.max(run.text.length, 0.4) * size * italic;
}

function runsToTspans(runs: TextRun[], fonts: FontFaces): string {
  return runs
    .filter((run) => !run.fracNum)
    .map((run) => {
      const style = run.italic ? "italic" : "normal";
      const family = `'Times New Roman', ${escapeXml(fonts.math)}, ${escapeXml(fonts.korean)}, Batang, serif`;
      return `<tspan font-style="${style}" font-family="${family}">${escapeXml(run.text)}</tspan>`;
    })
    .join("");
}

function arrowheadPoints(cmd: Extract<SceneCmd, { t: "arrowhead" }>): {
  x: number;
  y: number;
}[] {
  const len = Math.hypot(cmd.ux, cmd.uy) || 1;
  const ux = cmd.ux / len;
  const uy = cmd.uy / len;
  const px = -uy;
  const py = ux;
  const half = cmd.size * 0.42;
  const backX = cmd.x - ux * cmd.size;
  const backY = cmd.y - uy * cmd.size;
  return [
    { x: cmd.x, y: cmd.y },
    { x: backX + px * half, y: backY + py * half },
    { x: backX - px * half, y: backY - py * half },
  ];
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
  paintDiagramScene(ctx, scene, fonts, lineWidth);
  return canvas;
}
