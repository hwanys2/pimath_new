export type TextRun = {
  text: string;
  italic: boolean;
  /** Stacked fraction: draw `fracNum` over `fracDen`. `text` is unused. */
  fracNum?: TextRun[];
  fracDen?: TextRun[];
  /** Square root: vinculum over `sqrtBody`. */
  sqrtBody?: TextRun[];
  /** Superscript after the base `text`. */
  sup?: TextRun[];
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

function readSqrt(
  source: string,
  start: number,
): { body: string; end: number } | null {
  if (!source.startsWith("\\sqrt{", start)) return null;
  const body = readBrace(source, start + 5);
  if (!body) return null;
  return { body: body.inner, end: body.end };
}

/** Turn textbook √ notation into `$…\\sqrt{…}$` for rendering. */
export function normalizeSqrtLabel(text: string): string {
  let s = text;
  s = s.replace(/\$sqrt\{/g, "$\\sqrt{");
  s = s.replace(/(?<!\\)sqrt\{/g, "\\sqrt{");
  s = s.replace(/(\d+)√(\d+)/g, (_, a: string, b: string) => `$${a}\\sqrt{${b}}$`);
  s = s.replace(/(?<!\d)√(\d+)/g, (_, n: string) => `$\\sqrt{${n}}$`);
  return s;
}

/**
 * Textbook-style math labels:
 * Latin variables italic, numbers and units upright, Hangul upright.
 * `$x$` is treated as a math variable so `x cm` looks like a formula.
 * `\frac{24}{x}` becomes a stacked fraction.
 * Point names (A, B, O) use `parseNameRuns` — upright Roman, not italic.
 */
export function parseMathRuns(text: string): TextRun[] {
  return attachSuperscripts(parseMathRunsCore(normalizeSqrtLabel(text)));
}

function emitRestTokens(rest: string, runs: TextRun[]): void {
  let i = 0;
  while (i < rest.length) {
    const sup = rest.slice(i).match(/^(\^\d+|\^\{[^}]+\})/);
    if (sup) {
      runs.push({ text: sup[1]!, italic: false });
      i += sup[1]!.length;
      continue;
    }
    const ch = rest[i]!;
    if (/[0-9.]/.test(ch)) {
      let j = i + 1;
      while (j < rest.length && /[0-9.]/.test(rest[j]!)) j += 1;
      runs.push({ text: rest.slice(i, j), italic: false });
      i = j;
      continue;
    }
    runs.push({ text: ch, italic: false });
    i += 1;
  }
}

function parseMathRunsCore(text: string): TextRun[] {
  const runs: TextRun[] = [];
  const source = text;
  const tokenRe =
    /(\$([^$]*)\$)|(\\frac\{)|(\\sqrt\{)|(\\pi)|(℃|°C)|([A-Za-z]+)|([^A-Za-z$\\]+)|(\$|\\)/g;
  let match: RegExpExecArray | null;
  while ((match = tokenRe.exec(source)) !== null) {
    const mathInner = match[2];
    const fracOpen = match[3];
    const sqrtOpen = match[4];
    const piTok = match[5];
    const degreeC = match[6];
    const word = match[7];
    const rest = match[8] ?? match[9];
    if (mathInner != null) {
      runs.push(...parseMathRunsCore(mathInner));
    } else if (fracOpen) {
      const frac = readFrac(source, match.index);
      if (frac) {
        runs.push({
          text: "",
          italic: false,
          fracNum: parseMathRunsCore(frac.num),
          fracDen: parseMathRunsCore(frac.den),
        });
        tokenRe.lastIndex = frac.end;
      } else {
        runs.push({ text: match[0], italic: false });
      }
    } else if (sqrtOpen) {
      const sqrt = readSqrt(source, match.index);
      if (sqrt) {
        runs.push({
          text: "",
          italic: false,
          sqrtBody: parseMathRunsCore(sqrt.body),
        });
        tokenRe.lastIndex = sqrt.end;
      } else {
        runs.push({ text: match[0], italic: false });
      }
    } else if (piTok) {
      runs.push({ text: "π", italic: false });
    } else if (degreeC) {
      runs.push({ text: degreeC, italic: false });
    } else if (word) {
      runs.push({ text: word, italic: !UNIT_WORDS.has(word) });
    } else if (rest) {
      emitRestTokens(rest, runs);
    }
  }
  return runs;
}

function attachSuperscripts(runs: TextRun[]): TextRun[] {
  const out: TextRun[] = [];
  for (const run of runs) {
    if (run.fracNum || run.sqrtBody) {
      out.push(run);
      continue;
    }

    const inline = run.text.match(/^([\s\S]*?)\^(\{([^}]+)\}|(\d+))([\s\S]*)$/);
    if (inline) {
      const base = inline[1]!;
      const exp = inline[3] ?? inline[4]!;
      const tail = inline[5]!;
      if (base) {
        out.push({
          ...run,
          text: base,
          sup: parseMathRunsCore(exp),
        });
      } else if (out.length > 0) {
        const prev = out[out.length - 1]!;
        out[out.length - 1] = { ...prev, sup: parseMathRunsCore(exp) };
      }
      if (tail) out.push({ ...run, text: tail });
      continue;
    }

    if (/^\^/.test(run.text) && out.length > 0) {
      const lead = run.text.match(/^\^(\{([^}]+)\}|(\d+))([\s\S]*)$/);
      if (lead) {
        const exp = lead[2] ?? lead[3]!;
        const prev = out[out.length - 1]!;
        out[out.length - 1] = { ...prev, sup: parseMathRunsCore(exp) };
        const tail = lead[4]!;
        if (tail) out.push({ ...run, text: tail });
        continue;
      }
    }

    out.push(run);
  }
  return out;
}

function uprightRuns(runs: TextRun[]): TextRun[] {
  return runs.map((run) => ({
    ...run,
    italic: false,
    fracNum: run.fracNum ? uprightRuns(run.fracNum) : undefined,
    fracDen: run.fracDen ? uprightRuns(run.fracDen) : undefined,
    sqrtBody: run.sqrtBody ? uprightRuns(run.sqrtBody) : undefined,
    sup: run.sup ? uprightRuns(run.sup) : undefined,
  }));
}

/** Point names like A, B, O — Times Roman upright, never italic. */
export function parseNameRuns(text: string): TextRun[] {
  return uprightRuns(parseMathRuns(text));
}

export function runsToPlain(runs: TextRun[]): string {
  return runs
    .map((run) => {
      if (run.fracNum && run.fracDen) {
        return `${runsToPlain(run.fracNum)}/${runsToPlain(run.fracDen)}`;
      }
      if (run.sqrtBody) {
        return `√(${runsToPlain(run.sqrtBody)})`;
      }
      const base = run.text;
      if (run.sup) {
        return `${base}^${runsToPlain(run.sup)}`;
      }
      return base;
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

function gcdInt(a: number, b: number): number {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y > 0) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x || 1;
}

/** Small-denominator fraction if it fits; otherwise a decimal. */
export function formatNiceCoeff(value: number): string {
  if (!Number.isFinite(value)) return "";
  if (Math.abs(value - Math.round(value)) < 1e-9) {
    return String(Math.round(value));
  }
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  for (let den = 2; den <= 12; den += 1) {
    const num = Math.round(abs * den);
    if (num > 0 && Math.abs(abs - num / den) < 1e-9) {
      const g = gcdInt(num, den);
      return `${sign}\\frac{${num / g}}{${den / g}}`;
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

function sqrtMetrics(size: number) {
  return {
    bodySize: size * 0.92,
    hookW: size * 0.52,
    tail: size * 0.1,
    bodyNudgeY: size * 0.05,
  };
}

function supMetrics(size: number) {
  return { supSize: size * 0.62, lift: size * 0.42 };
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
  if (run.sqrtBody) {
    const m = sqrtMetrics(size);
    const bodyW = measureRuns(ctx, run.sqrtBody, m.bodySize, fonts);
    return m.hookW + bodyW + m.tail;
  }
  let w = 0;
  if (run.text) {
    ctx.font = canvasFont(run.italic, size, fonts);
    w = ctx.measureText(run.text).width;
  }
  if (run.sup) {
    const { supSize } = supMetrics(size);
    w += measureRuns(ctx, run.sup, supSize, fonts);
  }
  return w;
}

/**
 * Draw √ as a path. Serif √ glyphs (Times) have a mid-stem crossbar
 * that collides with a custom vinculum and looks broken.
 */
function strokeRadical(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  bodyW: number,
  fill: string,
  ascent: number,
  descent: number,
): void {
  const m = sqrtMetrics(size);
  const lw = Math.max(1.2, size * 0.062);
  const bodyY = y + m.bodyNudgeY;
  const inkAscent = Math.min(ascent, m.bodySize * 0.4);
  const inkDescent = Math.min(descent, m.bodySize * 0.32);
  const topY = bodyY - inkAscent - Math.max(1.15, size * 0.035);
  const startX = x + size * 0.04;
  const startY = bodyY - inkAscent * 0.22;
  const dipX = x + m.hookW * 0.3;
  const dipY = bodyY + inkDescent + size * 0.03;
  const joinX = x + m.hookW - size * 0.03;
  const endX = x + m.hookW + bodyW + m.tail * 0.65;

  ctx.save();
  ctx.strokeStyle = fill;
  ctx.lineWidth = lw;
  ctx.lineCap = "round";
  ctx.lineJoin = "miter";
  ctx.miterLimit = 2.4;
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(dipX, dipY);
  ctx.lineTo(joinX, topY);
  ctx.lineTo(endX, topY);
  ctx.stroke();
  ctx.restore();
}

export function canvasFont(
  italic: boolean,
  size: number,
  fonts: FontFaces,
): string {
  const style = italic ? "italic" : "normal";
  const family = `"Times New Roman", ${fonts.math}, ${fonts.korean}, Batang, serif`;
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
  fill = "#111",
): { width: number; left: number } {
  const width = measureRuns(ctx, runs, size, fonts);
  let cursor =
    anchor === "middle" ? x - width / 2 : anchor === "end" ? x - width : x;
  const left = cursor;
  ctx.fillStyle = fill;
  ctx.strokeStyle = fill;
  ctx.textBaseline = "middle";
  for (const run of runs) {
    cursor += fillRun(ctx, run, cursor, y, size, fonts, fill);
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
  fill: string,
): number {
  if (run.fracNum && run.fracDen) {
    const w = measureRun(ctx, run, size, fonts);
    const fracSize = size * 0.72;
    const mid = x + w / 2;
    const gap = size * 0.08;
    fillRuns(
      ctx,
      run.fracNum,
      mid,
      y - fracSize * 0.58 - gap,
      fracSize,
      fonts,
      "middle",
      fill,
    );
    fillRuns(
      ctx,
      run.fracDen,
      mid,
      y + fracSize * 0.58 + gap,
      fracSize,
      fonts,
      "middle",
      fill,
    );
    ctx.save();
    ctx.strokeStyle = fill;
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
  if (run.sqrtBody) {
    const w = measureRun(ctx, run, size, fonts);
    const m = sqrtMetrics(size);
    const bodyW = measureRuns(ctx, run.sqrtBody, m.bodySize, fonts);
    ctx.font = canvasFont(false, m.bodySize, fonts);
    ctx.textBaseline = "middle";
    const tm = ctx.measureText(runsToPlain(run.sqrtBody) || "0");
    const ascent = tm.actualBoundingBoxAscent || m.bodySize * 0.42;
    const descent = tm.actualBoundingBoxDescent || m.bodySize * 0.3;
    strokeRadical(ctx, x, y, size, bodyW, fill, ascent, descent);
    fillRuns(
      ctx,
      run.sqrtBody,
      x + m.hookW,
      y + m.bodyNudgeY,
      m.bodySize,
      fonts,
      "start",
      fill,
    );
    return w;
  }
  ctx.fillStyle = fill;
  ctx.font = canvasFont(run.italic, size, fonts);
  let w = 0;
  if (run.text) {
    ctx.fillText(run.text, x, y);
    w = ctx.measureText(run.text).width;
  }
  if (run.sup) {
    const { supSize, lift } = supMetrics(size);
    fillRuns(ctx, run.sup, x + w, y - lift, supSize, fonts, "start", fill);
    w += measureRuns(ctx, run.sup, supSize, fonts);
  }
  return w;
}
