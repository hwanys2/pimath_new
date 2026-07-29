import type { DrawTool, Stroke } from "../board/types";

export function strokeWidth(tool: DrawTool, size: number): number {
  if (tool === "highlighter") return size * 4;
  if (tool === "eraser") return size * 7;
  return size;
}

export function drawStrokeOn(ctx: CanvasRenderingContext2D, s: Stroke) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = strokeWidth(s.tool, s.size);
  ctx.strokeStyle = s.color;
  if (s.tool === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = "rgba(0,0,0,1)";
  } else if (s.tool === "highlighter") {
    ctx.globalAlpha = 0.35;
  }

  const p = s.points;
  ctx.beginPath();
  if (s.tool === "arc") {
    const [cx, cy, r, a0, a1] = p;
    if (r > 0 && Number.isFinite(cx) && Number.isFinite(cy)) {
      const delta = a1 - a0;
      if (
        Math.abs(Math.abs(delta) - Math.PI * 2) < 0.02 ||
        Math.abs(delta) >= Math.PI * 2 - 0.02
      ) {
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
      } else {
        ctx.arc(cx, cy, r, a0, a1, a1 < a0);
      }
      ctx.stroke();
    }
  } else if (s.tool === "pen" || s.tool === "highlighter" || s.tool === "eraser") {
    if (p.length < 4) {
      ctx.beginPath();
      ctx.fillStyle = ctx.strokeStyle as string;
      ctx.arc(p[0], p[1], ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    ctx.moveTo(p[0], p[1]);
    for (let i = 2; i < p.length - 2; i += 2) {
      const mx = (p[i] + p[i + 2]) / 2;
      const my = (p[i + 1] + p[i + 3]) / 2;
      ctx.quadraticCurveTo(p[i], p[i + 1], mx, my);
    }
    ctx.lineTo(p[p.length - 2], p[p.length - 1]);
    ctx.stroke();
  } else {
    const [x0, y0, x1, y1] = [p[0], p[1], p[p.length - 2], p[p.length - 1]];
    if (s.tool === "line" || s.tool === "arrow") {
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      if (s.tool === "arrow") {
        const angle = Math.atan2(y1 - y0, x1 - x0);
        const head = Math.max(14, s.size * 4);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(
          x1 - head * Math.cos(angle - Math.PI / 6),
          y1 - head * Math.sin(angle - Math.PI / 6),
        );
        ctx.moveTo(x1, y1);
        ctx.lineTo(
          x1 - head * Math.cos(angle + Math.PI / 6),
          y1 - head * Math.sin(angle + Math.PI / 6),
        );
        ctx.stroke();
      }
    } else if (s.tool === "rect") {
      ctx.strokeRect(
        Math.min(x0, x1),
        Math.min(y0, y1),
        Math.abs(x1 - x0),
        Math.abs(y1 - y0),
      );
    } else if (s.tool === "ellipse") {
      ctx.ellipse(
        (x0 + x1) / 2,
        (y0 + y1) / 2,
        Math.abs(x1 - x0) / 2,
        Math.abs(y1 - y0) / 2,
        0,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    }
  }
  ctx.restore();
}
