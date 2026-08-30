import type { TextRun } from "@/lib/diagrams/math-label";
import type { DiagramScene, SceneCmd, SceneText, Vec } from "@/lib/diagrams/scene";
import {
  layoutFromState,
  type RepeatingDecimalState,
} from "@/lib/diagrams/repeating-decimal/model";
import type {
  CircleRole,
  LongDivisionLayout,
} from "@/lib/diagrams/repeating-decimal/division";

export const INK = "#111111";
export const GRAY_ZERO = "#b0b0b0";
export const PINK_FILL = "#f4c5d4";
export const PINK_INK = "#e84a8c";
export const BLUE_FILL = "#c5e4ef";
export const YELLOW_FILL = "#fff4a8";

export type HitRect = { x: number; y: number; w: number; h: number };

export type RepeatingDecimalScene = DiagramScene & {
  quotientHit: HitRect;
};

function run(text: string): TextRun[] {
  return [{ text, italic: false }];
}

function textCmd(
  id: string,
  x: number,
  y: number,
  text: string,
  size: number,
  fill = INK,
  anchor: SceneText["anchor"] = "middle",
): { cmd: SceneCmd; text: SceneText } {
  const sceneText: SceneText = {
    id,
    x,
    y,
    runs: run(text),
    size,
    anchor,
    fill,
  };
  return { cmd: { t: "text", text: sceneText }, text: sceneText };
}

function rect(x: number, y: number, w: number, h: number, fill: string): SceneCmd {
  return {
    t: "polygon",
    points: [
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x, y: y + h },
    ],
    fill,
  };
}

function circleFill(role: CircleRole): string | null {
  if (role === "cycle-start" || role === "cycle-end") return PINK_FILL;
  if (role === "mid") return BLUE_FILL;
  return null;
}

export function buildRepeatingDecimalScene(
  state: RepeatingDecimalState,
): RepeatingDecimalScene {
  const layout = layoutFromState(state);
  if (!layout) return emptyScene();
  return sceneFromLayout(layout, state);
}

function emptyScene(): RepeatingDecimalScene {
  return {
    width: 280,
    height: 180,
    cmds: [],
    texts: [],
    quotientHit: { x: 0, y: 0, w: 0, h: 0 },
  };
}

function sceneFromLayout(
  layout: LongDivisionLayout,
  state: RepeatingDecimalState,
): RepeatingDecimalScene {
  const fontSize = state.style.fontSize;
  const lineW = state.style.lineWidth;
  const digitW = fontSize * 0.62;
  const rowH = fontSize * 1.22;
  const circleR = fontSize * 0.58;
  const showSame = state.showSameMark && layout.canShowSame;
  const showMarks = state.showRemainderMarks;
  const showQuotient = state.showQuotient;
  const showPeriodHighlight = state.showPeriodHighlight;

  let minPlace = 0;
  let maxPlace = 0;
  for (const row of layout.rows) {
    for (const d of row.digits) {
      minPlace = Math.min(minPlace, d.place);
      maxPlace = Math.max(maxPlace, d.place);
    }
  }
  for (const d of layout.quotient) {
    minPlace = Math.min(minPlace, d.place);
    maxPlace = Math.max(maxPlace, d.place);
  }
  if (layout.showEllipsis) maxPlace += 1;

  const divisorStr = layout.divisor;
  const divisorW = Math.max(divisorStr.length, 1) * digitW;
  const arrowGutter = showSame ? fontSize * 1.35 : fontSize * 0.45;
  const padL = 18 + arrowGutter + divisorW + fontSize * 0.55;
  const padR = showSame ? fontSize * 4.4 : fontSize * 1.1;
  const padT = fontSize * 1.55;
  const padB = layout.showVerticalDots ? fontSize * 2.2 : fontSize * 0.9;

  const originX = padL;
  const barY = padT + fontSize * 0.72;
  const firstRowY = barY + fontSize * 0.85;
  const quotientY = padT - fontSize * 0.12;

  function placeX(place: number): number {
    return originX + place * digitW;
  }

  function rowY(index: number): number {
    return firstRowY + index * rowH;
  }

  const lastRowY = rowY(Math.max(layout.rows.length - 1, 0));
  const width = Math.ceil(placeX(maxPlace) + digitW * 0.7 + padR);
  const height = Math.ceil(lastRowY + padB);

  const fills: SceneCmd[] = [];
  const lines: SceneCmd[] = [];
  const texts: SceneText[] = [];
  const cmds: SceneCmd[] = [];

  function pushText(
    id: string,
    x: number,
    y: number,
    text: string,
    size: number,
    fill = INK,
    anchor: SceneText["anchor"] = "middle",
  ) {
    const item = textCmd(id, x, y, text, size, fill, anchor);
    cmds.push(item.cmd);
    texts.push(item.text);
  }

  const periodDigits = layout.quotient.filter((d) => d.inPeriod);
  if (showQuotient && showPeriodHighlight && periodDigits.length > 0) {
    const left = placeX(periodDigits[0]!.place) - digitW * 0.48;
    const right =
      placeX(periodDigits[periodDigits.length - 1]!.place) + digitW * 0.48;
    fills.push(
      rect(
        left,
        quotientY - fontSize * 0.52,
        right - left,
        fontSize * 1.02,
        YELLOW_FILL,
      ),
    );
  }

  if (showMarks) {
    for (let i = 0; i < layout.rows.length; i += 1) {
      const row = layout.rows[i]!;
      if (row.kind !== "working") continue;
      const y = rowY(i);
      for (const d of row.digits) {
        const fill = circleFill(d.circle);
        if (!fill) continue;
        fills.push({
          t: "dot",
          x: placeX(d.place),
          y,
          r: circleR,
          stroke: fill,
        });
      }
    }
  }

  cmds.push(...fills);

  const verticalX = originX + minPlace * digitW - digitW * 0.62;
  const barLeft = verticalX;
  const barRight = placeX(Math.max(maxPlace, 1)) + digitW * 0.35;
  lines.push({
    t: "line",
    x1: barLeft,
    y1: barY,
    x2: barRight,
    y2: barY,
    width: lineW,
  });
  lines.push({
    t: "line",
    x1: verticalX,
    y1: barY,
    x2: verticalX,
    y2: firstRowY + fontSize * 0.42,
    width: lineW,
  });

  for (let i = 0; i < layout.rows.length; i += 1) {
    const row = layout.rows[i]!;
    if (!row.bar || row.digits.length === 0) continue;
    const places = row.digits.map((d) => d.place);
    const prev = layout.rows[i - 1];
    if (prev) {
      for (const d of prev.digits) places.push(d.place);
    }
    const left = placeX(Math.min(...places)) - digitW * 0.42;
    const right = placeX(Math.max(...places)) + digitW * 0.42;
    const y = rowY(i) + fontSize * 0.48;
    lines.push({
      t: "line",
      x1: left,
      y1: y,
      x2: right,
      y2: y,
      width: lineW,
    });
  }

  let startPt: Vec | null = null;
  let endPt: Vec | null = null;
  for (let i = 0; i < layout.rows.length; i += 1) {
    const row = layout.rows[i]!;
    for (const d of row.digits) {
      if (d.gray || !d.circle) continue;
      const pt = { x: placeX(d.place), y: rowY(i) };
      if (d.circle === "cycle-start" && !startPt) startPt = pt;
      if (d.circle === "cycle-end") endPt = pt;
    }
  }

  if (showSame && startPt && endPt) {
    const railX = verticalX - fontSize * 0.95;
    const from = { x: endPt.x - circleR * 0.92, y: endPt.y };
    const to = { x: startPt.x - circleR * 0.95, y: startPt.y };
    lines.push({
      t: "polyline",
      pts: [
        from,
        { x: railX, y: endPt.y },
        { x: railX, y: startPt.y },
        to,
      ],
      stroke: PINK_INK,
      width: Math.max(1.2, lineW),
    });
    cmds.push({
      t: "arrowhead",
      x: to.x,
      y: to.y,
      ux: 1,
      uy: 0,
      size: fontSize * 0.38,
      stroke: PINK_INK,
    });
  }

  cmds.push(...lines);

  const divisorX = verticalX - fontSize * 0.38;
  for (let i = 0; i < divisorStr.length; i += 1) {
    const ch = divisorStr[divisorStr.length - 1 - i]!;
    pushText(
      `div-${i}`,
      divisorX - i * digitW,
      firstRowY,
      ch,
      fontSize,
    );
  }

  if (showQuotient) {
    for (const d of layout.quotient) {
      pushText(`q-${d.place}`, placeX(d.place), quotientY, d.ch, fontSize);
      if (d.overdot) {
        cmds.push({
          t: "dot",
          x: placeX(d.place),
          y: quotientY - fontSize * 0.58,
          r: Math.max(1.6, fontSize * 0.07),
        });
      }
    }
    const hasDecimal = layout.quotient.some((d) => d.place >= 1);
    if (hasDecimal || layout.integerPart === "0") {
      cmds.push({
        t: "dot",
        x: placeX(0) + digitW * 0.5,
        y: quotientY + fontSize * 0.22,
        r: Math.max(1.5, fontSize * 0.068),
      });
    }
    if (layout.showEllipsis) {
      const last = layout.quotient[layout.quotient.length - 1];
      const x = last ? placeX(last.place) + digitW * 0.95 : placeX(maxPlace);
      pushText("ellipsis", x, quotientY, "…", fontSize * 0.9, INK, "start");
    }
  }

  for (let i = 0; i < layout.rows.length; i += 1) {
    const row = layout.rows[i]!;
    const y = rowY(i);
    for (const d of row.digits) {
      const fill = d.gray ? GRAY_ZERO : INK;
      pushText(
        `r${i}-${d.place}`,
        placeX(d.place),
        y,
        d.ch,
        fontSize,
        fill,
      );
    }
  }

  if (layout.showVerticalDots) {
    const lastWorking = lastWorkingIndex(layout);
    const lastRow = layout.rows[lastWorking];
    const lastDigit = lastRow?.digits[lastRow.digits.length - 1];
    const x = lastDigit ? placeX(lastDigit.place) : placeX(0);
    const y0 = rowY(lastWorking) + fontSize * 0.95;
    for (let k = 0; k < 3; k += 1) {
      cmds.push({
        t: "dot",
        x,
        y: y0 + k * fontSize * 0.28,
        r: Math.max(1.4, fontSize * 0.065),
      });
    }
  }

  if (showSame && endPt) {
    const labelX = endPt.x + circleR + fontSize * 0.22;
    pushText(
      "same",
      labelX,
      endPt.y,
      "같다.",
      fontSize * 0.62,
      PINK_INK,
      "start",
    );
    const arrowX = endPt.x + circleR * 0.15;
    cmds.push({
      t: "line",
      x1: labelX - fontSize * 0.12,
      y1: endPt.y,
      x2: arrowX + fontSize * 0.28,
      y2: endPt.y,
      stroke: PINK_INK,
      width: Math.max(1.1, lineW * 0.85),
    });
    cmds.push({
      t: "arrowhead",
      x: arrowX,
      y: endPt.y,
      ux: -1,
      uy: 0,
      size: fontSize * 0.32,
      stroke: PINK_INK,
    });
  }

  const qLeft = placeX(minPlace) - digitW * 0.6;
  const qRight = barRight;
  const quotientHit: HitRect = {
    x: qLeft,
    y: barY - fontSize * 1.35,
    w: qRight - qLeft,
    h: fontSize * 1.5,
  };

  return { width, height, cmds, texts, quotientHit };
}

function lastWorkingIndex(layout: LongDivisionLayout): number {
  for (let i = layout.rows.length - 1; i >= 0; i -= 1) {
    if (layout.rows[i]!.kind === "working") return i;
  }
  return layout.rows.length - 1;
}

export function hitQuotient(
  scene: RepeatingDecimalScene,
  x: number,
  y: number,
): boolean {
  const r = scene.quotientHit;
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}
