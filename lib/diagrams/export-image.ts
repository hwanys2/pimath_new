export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

/** Scene-space margin kept around ink when cropping a download. */
export const EXPORT_INK_PAD = 12;

/**
 * Trim a rendered white-background diagram to the ink, with a small
 * even margin so the figure fills an exam-paper PNG.
 */
export function cropCanvasToInk(
  canvas: HTMLCanvasElement,
  paddingPx: number,
): HTMLCanvasElement {
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const { width, height } = canvas;
  if (width < 2 || height < 2) return canvas;
  const { data } = ctx.getImageData(0, 0, width, height);
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    const row = y * width * 4;
    for (let x = 0; x < width; x += 1) {
      const i = row + x * 4;
      const a = data[i + 3] ?? 0;
      if (a < 10) continue;
      const r = data[i] ?? 255;
      const g = data[i + 1] ?? 255;
      const b = data[i + 2] ?? 255;
      if (r > 248 && g > 248 && b > 248) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < minX) return canvas;
  const pad = Math.max(0, Math.round(paddingPx));
  const sx = Math.max(0, minX - pad);
  const sy = Math.max(0, minY - pad);
  const ex = Math.min(width, maxX + 1 + pad);
  const ey = Math.min(height, maxY + 1 + pad);
  const sw = ex - sx;
  const sh = ey - sy;
  if (sw >= width - 1 && sh >= height - 1) return canvas;
  const out = document.createElement("canvas");
  out.width = sw;
  out.height = sh;
  const octx = out.getContext("2d");
  if (!octx) return canvas;
  octx.fillStyle = "#ffffff";
  octx.fillRect(0, 0, sw, sh);
  octx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
  return out;
}

export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("이미지를 만들지 못했어요."));
    }, "image/png");
  });
}

export async function copyPngToClipboard(blob: Blob): Promise<void> {
  await navigator.clipboard.write([
    new ClipboardItem({ "image/png": blob }),
  ]);
}
