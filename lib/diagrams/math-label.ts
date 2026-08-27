export type TextRun = {
  text: string;
  italic: boolean;
};

const UNIT_WORDS = new Set(["cm", "mm", "m", "km", "CM", "MM"]);

/**
 * Textbook-style math labels:
 * Latin point/variable names italic, numbers and units upright, Hangul upright.
 */
export function parseMathRuns(text: string): TextRun[] {
  const runs: TextRun[] = [];
  const tokenRe = /([A-Za-z]+)|([^A-Za-z]+)/g;
  let match: RegExpExecArray | null;
  while ((match = tokenRe.exec(text)) !== null) {
    const word = match[1];
    const rest = match[2];
    if (word) {
      runs.push({ text: word, italic: !UNIT_WORDS.has(word) });
    } else if (rest) {
      runs.push({ text: rest, italic: false });
    }
  }
  return runs;
}

export function formatNiceNumber(value: number): string {
  if (!Number.isFinite(value)) return "";
  const rounded = Math.round(value * 1000) / 1000;
  if (Math.abs(rounded - Math.round(rounded)) < 1e-6) {
    return String(Math.round(rounded));
  }
  const two = Math.round(rounded * 100) / 100;
  return String(two);
}

export function formatMeasure(value: number, unit: string): string {
  const n = formatNiceNumber(value);
  const u = unit.trim();
  return u ? `${n} ${u}` : n;
}

export type FontFaces = {
  math: string;
  korean: string;
};

export function measureRuns(
  ctx: CanvasRenderingContext2D,
  runs: TextRun[],
  size: number,
  fonts: FontFaces,
): number {
  let width = 0;
  for (const run of runs) {
    ctx.font = canvasFont(run.italic, size, fonts);
    width += ctx.measureText(run.text).width;
  }
  return width;
}

export function canvasFont(
  italic: boolean,
  size: number,
  fonts: FontFaces,
): string {
  const style = italic ? "italic" : "normal";
  return `${style} ${size}px ${fonts.math}, ${fonts.korean}, "Times New Roman", "Batang", serif`;
}

export function fillRuns(
  ctx: CanvasRenderingContext2D,
  runs: TextRun[],
  x: number,
  y: number,
  size: number,
  fonts: FontFaces,
  anchor: "start" | "middle" | "end" = "middle",
): { width: number; left: number } {
  const width = measureRuns(ctx, runs, size, fonts);
  let cursor =
    anchor === "middle" ? x - width / 2 : anchor === "end" ? x - width : x;
  const left = cursor;
  ctx.fillStyle = "#111";
  ctx.textBaseline = "middle";
  for (const run of runs) {
    ctx.font = canvasFont(run.italic, size, fonts);
    ctx.fillText(run.text, cursor, y);
    cursor += ctx.measureText(run.text).width;
  }
  return { width, left };
}
