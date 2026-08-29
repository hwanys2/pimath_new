export type TextRun = {
  text: string;
  italic: boolean;
  /** Stacked fraction: draw `fracNum` over `fracDen`. `text` is unused. */
  fracNum?: TextRun[];
  fracDen?: TextRun[];
};

const UNIT_WORDS = new Set(["cm", "mm", "m", "km", "CM", "MM"]);

function readBrace(
  source: string,
  openIdx: number,
): { inner: string; end: number } | null {
  if (source[openIdx] !== "{") return null;
  let depth = 0;
  for (let i = openIdx; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return { inner: source.slice(openIdx + 1, i), end: i + 1 };
      }
    }
  }
  return null;
}

function readFrac(
  source: string,
  start: number,
): { num: string; den: string; end: number } | null {
  if (!source.startsWith("\\frac{", start)) return null;
  const num = readBrace(source, start + 5);
  if (!num) return null;
  const den = readBrace(source, num.end);
  if (!den) return null;
  return { num: num.inner, den: den.inner, end: den.end };
}

/**
 * Textbook-style math labels:
 * Latin point/variable names italic, numbers and units upright, Hangul upright.
 * `$x$` is treated as a math variable so `x cm` looks like a formula.
 * `\frac{24}{x}` becomes a stacked fraction.
 */
export function parseMathRuns(text: string): TextRun[] {
  const runs: TextRun[] = [];
  const tokenRe =
    /(\$([^$]*)\$)|(\\frac\{)|(℃|°C)|([A-Za-z]+)|([^A-Za-z$\\]+)|(\$|\\)/g;
  let match: RegExpExecArray | null;
  while ((match = tokenRe.exec(text)) !== null) {
    const mathInner = match[2];
    const fracOpen = match[3];
    const degreeC = match[4];
    const word = match[5];
    const rest = match[6] ?? match[7];
    if (mathInner != null) {
      runs.push(...parseMathRuns(mathInner));
    } else if (fracOpen) {
      const frac = readFrac(text, match.index);
      if (frac) {
        runs.push({
          text: "",
          italic: false,
          fracNum: parseMathRuns(frac.num),
          fracDen: parseMathRuns(frac.den),
        });
        tokenRe.lastIndex = frac.end;
      } else {
        runs.push({ text: match[0], italic: false });
      }
    } else if (degreeC) {
      runs.push({ text: degreeC, italic: false });
    } else if (word) {
      runs.push({ text: word, italic: !UNIT_WORDS.has(word) });
    } else if (rest) {
      runs.push({ text: rest, italic: false });
    }
  }
  return runs;
}

export function runsToPlain(runs: TextRun[]): string {
  return runs
    .map((run) => {
      if (run.fracNum && run.fracDen) {
        return `${runsToPlain(run.fracNum)}/${runsToPlain(run.fracDen)}`;
      }
      return run.text;
    })
    .join("");
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

/** Small-denominator fraction if it fits; otherwise a decimal. */
export function formatNiceCoeff(value: number): string {
  if (!Number.isFinite(value)) return "";
  const rounded = Math.round(value * 1000) / 1000;
  if (Math.abs(rounded - Math.round(rounded)) < 1e-6) {
    return String(Math.round(rounded));
  }
  const sign = rounded < 0 ? "-" : "";
  const abs = Math.abs(rounded);
  for (let den = 2; den <= 12; den += 1) {
    const num = Math.round(abs * den);
    if (Math.abs(abs - num / den) < 1e-6) {
      return `${sign}\\frac{${num}}{${den}}`;
    }
  }
  return formatNiceNumber(value);
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
    width += measureRun(ctx, run, size, fonts);
  }
  return width;
}

function measureRun(
  ctx: CanvasRenderingContext2D,
  run: TextRun,
  size: number,
  fonts: FontFaces,
): number {
  if (run.fracNum && run.fracDen) {
    const fracSize = size * 0.72;
    const nw = measureRuns(ctx, run.fracNum, fracSize, fonts);
    const dw = measureRuns(ctx, run.fracDen, fracSize, fonts);
    return Math.max(nw, dw, size * 0.45) + size * 0.22;
  }
  ctx.font = canvasFont(run.italic, size, fonts);
  return ctx.measureText(run.text).width;
}

export function canvasFont(
  italic: boolean,
  size: number,
  fonts: FontFaces,
): string {
  const style = italic ? "italic" : "normal";
  const family = italic
    ? `"Times New Roman", ${fonts.math}, ${fonts.korean}, serif`
    : `${fonts.math}, ${fonts.korean}, "Times New Roman", Batang, serif`;
  return `${style} ${size}px ${family}`;
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
  ctx.strokeStyle = "#111";
  ctx.textBaseline = "middle";
  for (const run of runs) {
    cursor += fillRun(ctx, run, cursor, y, size, fonts);
  }
  return { width, left };
}

function fillRun(
  ctx: CanvasRenderingContext2D,
  run: TextRun,
  x: number,
  y: number,
  size: number,
  fonts: FontFaces,
): number {
  if (run.fracNum && run.fracDen) {
    const w = measureRun(ctx, run, size, fonts);
    const fracSize = size * 0.72;
    const mid = x + w / 2;
    const gap = size * 0.08;
    fillRuns(ctx, run.fracNum, mid, y - fracSize * 0.58 - gap, fracSize, fonts, "middle");
    fillRuns(ctx, run.fracDen, mid, y + fracSize * 0.58 + gap, fracSize, fonts, "middle");
    ctx.save();
    ctx.strokeStyle = "#111";
    ctx.lineWidth = Math.max(1, size * 0.06);
    ctx.lineCap = "butt";
    const lineW = Math.max(w - size * 0.1, size * 0.4);
    ctx.beginPath();
    ctx.moveTo(mid - lineW / 2, y);
    ctx.lineTo(mid + lineW / 2, y);
    ctx.stroke();
    ctx.restore();
    return w;
  }
  ctx.fillStyle = "#111";
  ctx.font = canvasFont(run.italic, size, fonts);
  ctx.fillText(run.text, x, y);
  return ctx.measureText(run.text).width;
}
