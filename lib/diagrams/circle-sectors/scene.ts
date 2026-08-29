import {
  parseMeasureId,
  sectorMath,
} from "@/lib/diagrams/circle-sectors/geometry";
import {
  formatArcAuto,
  formatAreaAuto,
  midAngleDeg,
  resolveAngleText,
  resolveLabelText,
  SECTOR_FILL,
  type CircleSectorsState,
  type MeasLabel,
  type SectorDraft,
} from "@/lib/diagrams/circle-sectors/model";
import { parseMathRuns, parseNameRuns } from "@/lib/diagrams/math-label";
import type {
  DiagramScene as SharedDiagramScene,
  SceneCmd,
  SceneText,
} from "@/lib/diagrams/scene";

export type { SceneCmd, SceneText } from "@/lib/diagrams/scene";
export { hitTestText, sceneTextPlain } from "@/lib/diagrams/scene";

export type Vec = { x: number; y: number };

export type DiagramScene = SharedDiagramScene & {
  layout: SceneLayout;
};

export const SCENE_WIDTH = 480;
export const SCENE_HEIGHT = 520;

export type SceneLayout = {
  origin: Vec;
  visualR: number;
  scale: number;
  viewRot: number;
};

function add(a: Vec, b: Vec): Vec {
  return { x: a.x + b.x, y: a.y + b.y };
}
function sub(a: Vec, b: Vec): Vec {
  return { x: a.x - b.x, y: a.y - b.y };
}
function mul(a: Vec, s: number): Vec {
  return { x: a.x * s, y: a.y * s };
}
function len(a: Vec): number {
  return Math.hypot(a.x, a.y);
}
function norm(a: Vec): Vec {
  const l = len(a);
  if (l < 1e-9) return { x: 1, y: 0 };
  return { x: a.x / l, y: a.y / l };
}
function dot(a: Vec, b: Vec): number {
  return a.x * b.x + a.y * b.y;
}
function perpToward(along: Vec, toward: Vec): Vec {
  const dir = norm(along);
  let p: Vec = { x: -dir.y, y: dir.x };
  if (dot(p, toward) < 0) p = { x: -p.x, y: -p.y };
  return p;
}
function rot(a: Vec, deg: number): Vec {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return { x: a.x * c - a.y * s, y: a.x * s + a.y * c };
}

function polar(radius: number, deg: number): Vec {
  const a = (deg * Math.PI) / 180;
  return { x: radius * Math.cos(a), y: radius * Math.sin(a) };
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function signedHeight(h: number, minAbs = 10, maxAbs = 140): number {
  if (!Number.isFinite(h)) return minAbs;
  const sign = h < 0 ? -1 : 1;
  return sign * clamp(Math.abs(h), minAbs, maxAbs);
}

function normalizeAngle(a: number): number {
  let t = a % (Math.PI * 2);
  if (t < 0) t += Math.PI * 2;
  return t;
}

function ccwSpan(from: number, to: number): number {
  let d = normalizeAngle(to) - normalizeAngle(from);
  if (d < 0) d += Math.PI * 2;
  return d;
}

/** Visual CCW on a Y-down canvas = decreasing atan2. Matches SceneCmd.arc ccw. */
function canvasCcwSpan(from: number, to: number): number {
  let d = normalizeAngle(from) - normalizeAngle(to);
  if (d < 0) d += Math.PI * 2;
  return d;
}

function angleOnArc(ang: number, a0: number, a1: number, ccw: boolean): boolean {
  if (ccw) return canvasCcwSpan(a0, ang) <= canvasCcwSpan(a0, a1) + 1e-6;
  return ccwSpan(a0, ang) <= ccwSpan(a0, a1) + 1e-6;
}

function collectMathPoints(state: CircleSectorsState): Vec[] {
  const r = state.radius;
  const pts: Vec[] = [{ x: 0, y: 0 }];
  if (state.showCircle) {
    pts.push({ x: r, y: 0 }, { x: -r, y: 0 }, { x: 0, y: r }, { x: 0, y: -r });
  }
  for (const sector of state.sectors) {
    const { A, B, start, central } = sectorMath(sector, r);
    pts.push(A, B);
    const steps = Math.max(4, Math.ceil(central / 12));
    for (let i = 0; i <= steps; i += 1) {
      pts.push(polar(r, start + (central * i) / steps));
    }
    const extra = state.showCircle ? 0.22 : 0.38;
    if (sector.showArcLength && sector.arcLabel.mode !== "hide") {
      for (let i = 0; i <= steps; i += 1) {
        pts.push(polar(r * (1 + extra), start + (central * i) / steps));
      }
    }
    if (sector.showRadius && sector.radiusLabel.mode !== "hide") {
      pts.push(polar(r * 0.55, start + 12), polar(r * 0.55, start - 12));
    }
  }
  return pts;
}

export function getSceneLayout(state: CircleSectorsState): SceneLayout {
  const pad = state.style.padding;
  const viewRot = state.viewRotationDeg;
  const pts = collectMathPoints(state).map((p) => rot(p, viewRot));
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
  const bw = Math.max(maxX - minX, state.radius * 0.4);
  const bh = Math.max(maxY - minY, state.radius * 0.4);
  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;
  const scale = Math.min(
    (SCENE_WIDTH - pad * 2) / bw,
    (SCENE_HEIGHT - pad * 2) / bh,
  );
  return {
    origin: {
      x: SCENE_WIDTH / 2 - midX * scale,
      y: SCENE_HEIGHT / 2 + midY * scale,
    },
    visualR: scale * state.radius,
    scale,
    viewRot,
  };
}

export function canvasToMath(p: Vec, layout: SceneLayout): Vec {
  const dx = p.x - layout.origin.x;
  const dy = layout.origin.y - p.y;
  const rad = (-layout.viewRot * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const xr = dx * c - dy * s;
  const yr = dx * s + dy * c;
  return { x: xr / layout.scale, y: yr / layout.scale };
}

export function mathToCanvas(p: Vec, layout: SceneLayout): Vec {
  const q = rot(p, layout.viewRot);
  return { x: layout.origin.x + q.x * layout.scale, y: layout.origin.y - q.y * layout.scale };
}

function pushText(texts: SceneText[], cmds: SceneCmd[], text: SceneText): void {
  texts.push(text);
  cmds.push({ t: "text", text });
}

function sagittaArc(
  a: Vec,
  b: Vec,
  u: Vec,
  sagitta: number,
): { C: Vec; r: number; a0: number; a1: number; ccw: boolean } | null {
  const span = len(sub(b, a));
  const s = sagitta;
  if (span < 2 || Math.abs(s) < 0.75) return null;
  const n = perpToward(sub(b, a), u);
  const mid = mul(add(a, b), 0.5);
  const half = span / 2;
  const r = (half * half + s * s) / (2 * Math.abs(s));
  const C = add(mid, mul(n, s - Math.sign(s) * r));
  const a0 = Math.atan2(a.y - C.y, a.x - C.x);
  const a1 = Math.atan2(b.y - C.y, b.x - C.x);
  const peak = add(mid, mul(n, s));
  const aS = Math.atan2(peak.y - C.y, peak.x - C.x);
  const sOnIncreasing = ccwSpan(a0, aS) <= ccwSpan(a0, a1) + 1e-6;
  const ccw = !sOnIncreasing;
  return { C, r, a0, a1, ccw };
}

function dimArc(
  cmds: SceneCmd[],
  texts: SceneText[],
  a: Vec,
  b: Vec,
  outward: Vec,
  offset: number,
  label: string | null,
  labelId: string,
  meas: MeasLabel,
  fontSize: number,
): void {
  if (!label) return;
  const along = norm(sub(b, a));
  const u = perpToward(along, outward);
  const span = len(sub(b, a));
  const mid = mul(add(a, b), 0.5);
  const margin = Math.min(span * 0.14, 26);
  const maxAlong = Math.max(span / 2 - margin, 0);
  const lineId = `${labelId}:line`;

  const textH = signedHeight(offset + meas.dy);
  const lineH = signedHeight(offset + meas.dy + (meas.lineDy ?? 0));
  const textAlong = clamp(meas.dx, -maxAlong, maxAlong);
  const lineSign = lineH < 0 ? -1 : 1;
  const tick = clamp(Math.abs(lineH) * 0.22, 4.5, 8);
  const aFoot = add(a, mul(u, lineSign * tick));
  const bFoot = add(b, mul(u, lineSign * tick));
  const sag = lineH - lineSign * tick;

  cmds.push({ t: "line", x1: a.x, y1: a.y, x2: aFoot.x, y2: aFoot.y, id: lineId });
  cmds.push({
    t: "line",
    x1: b.x,
    y1: b.y,
    x2: bFoot.x,
    y2: bFoot.y,
    id: lineId,
  });

  const arc = sagittaArc(aFoot, bFoot, u, sag);
  if (arc) {
    cmds.push({
      t: "arc",
      cx: arc.C.x,
      cy: arc.C.y,
      r: arc.r,
      a0: arc.a0,
      a1: arc.a1,
      ccw: arc.ccw,
      dashed: true,
      id: lineId,
    });
  } else {
    cmds.push({
      t: "line",
      x1: aFoot.x,
      y1: aFoot.y,
      x2: bFoot.x,
      y2: bFoot.y,
      dashed: true,
      id: lineId,
    });
  }

  const textSign = textH < 0 ? -1 : 1;
  const onSeg = add(mid, mul(along, textAlong));
  const tp = add(onSeg, mul(u, textH + textSign * fontSize * 0.52));
  pushText(texts, cmds, {
    id: labelId,
    x: tp.x,
    y: tp.y,
    runs: parseMathRuns(label),
    size: fontSize,
    anchor: "middle",
  });
}

function canvasArcAngles(cO: Vec, cA: Vec, cB: Vec): {
  a0: number;
  a1: number;
  ccw: boolean;
} {
  return {
    a0: Math.atan2(cA.y - cO.y, cA.x - cO.x),
    a1: Math.atan2(cB.y - cO.y, cB.x - cO.x),
    ccw: true,
  };
}

function tangentCcw(a: number): Vec {
  return { x: Math.sin(a), y: -Math.cos(a) };
}

function dimArcLength(
  cmds: SceneCmd[],
  texts: SceneText[],
  cO: Vec,
  visualR: number,
  a0: number,
  a1: number,
  offset: number,
  label: string | null,
  labelId: string,
  meas: MeasLabel,
  fontSize: number,
): void {
  if (!label) return;
  const lineId = `${labelId}:line`;
  const lineH = signedHeight(offset + meas.dy + (meas.lineDy ?? 0), 12, 80);
  const textH = signedHeight(offset + meas.dy, 12, 80);
  const lineR = visualR + lineH;
  const textR = visualR + textH + fontSize * 0.55;
  const tick = clamp(Math.abs(lineH) * 0.28, 6, 12);

  const p0 = {
    x: cO.x + visualR * Math.cos(a0),
    y: cO.y + visualR * Math.sin(a0),
  };
  const p1 = {
    x: cO.x + visualR * Math.cos(a1),
    y: cO.y + visualR * Math.sin(a1),
  };
  const f0 = {
    x: cO.x + lineR * Math.cos(a0),
    y: cO.y + lineR * Math.sin(a0),
  };
  const f1 = {
    x: cO.x + lineR * Math.cos(a1),
    y: cO.y + lineR * Math.sin(a1),
  };

  cmds.push({ t: "line", x1: p0.x, y1: p0.y, x2: f0.x, y2: f0.y, id: lineId });
  cmds.push({ t: "line", x1: p1.x, y1: p1.y, x2: f1.x, y2: f1.y, id: lineId });
  cmds.push({
    t: "arc",
    cx: cO.x,
    cy: cO.y,
    r: lineR,
    a0,
    a1,
    ccw: true,
    id: lineId,
  });

  const t0 = tangentCcw(a0);
  const t1 = tangentCcw(a1);
  cmds.push({
    t: "arrowhead",
    x: f0.x,
    y: f0.y,
    ux: -t0.x,
    uy: -t0.y,
    size: tick,
  });
  cmds.push({
    t: "arrowhead",
    x: f1.x,
    y: f1.y,
    ux: t1.x,
    uy: t1.y,
    size: tick,
  });

  const sweep = canvasCcwSpan(a0, a1);
  const midA = a0 - sweep / 2 + meas.dx / Math.max(lineR, 1);
  const tp = {
    x: cO.x + textR * Math.cos(midA),
    y: cO.y + textR * Math.sin(midA),
  };
  pushText(texts, cmds, {
    id: labelId,
    x: tp.x,
    y: tp.y,
    runs: parseMathRuns(label),
    size: fontSize,
    anchor: "middle",
  });
}

export function buildCircleSectorsScene(state: CircleSectorsState): DiagramScene {
  const { style } = state;
  const layout = getSceneLayout(state);
  const map = (p: Vec) => mathToCanvas(p, layout);
  const cmds: SceneCmd[] = [];
  const texts: SceneText[] = [];
  const cO = layout.origin;

  for (const sector of state.sectors) {
    if (!sector.showFill) continue;
    const { A, B } = sectorMath(sector, state.radius);
    const cA = map(A);
    const cB = map(B);
    const { a0, a1, ccw } = canvasArcAngles(cO, cA, cB);
    cmds.push({
      t: "sector",
      cx: cO.x,
      cy: cO.y,
      r: layout.visualR,
      a0,
      a1,
      ccw,
      fill: SECTOR_FILL,
    });
  }

  if (state.showCircle) {
    cmds.push({ t: "circle", x: cO.x, y: cO.y, r: layout.visualR });
  }

  for (const sector of state.sectors) {
    drawSector({ sector, state, map, layout, cmds, texts });
  }

  if (state.showCenter) {
    cmds.push({ t: "dot", x: cO.x, y: cO.y, r: style.pointRadius });
    if (state.centerName.trim()) {
      const away = averageOutward(state.sectors);
      const oPos = add(add(cO, mul(away, 18)), {
        x: state.centerDx ?? 0,
        y: state.centerDy ?? 0,
      });
      pushText(texts, cmds, {
        id: "center-name",
        x: oPos.x,
        y: oPos.y,
        runs: parseNameRuns(state.centerName.trim()),
        size: style.pointLabelSize,
        anchor: "middle",
      });
    }
  }

  return { width: SCENE_WIDTH, height: SCENE_HEIGHT, cmds, texts, layout };
}

function averageOutward(sectors: SectorDraft[]): Vec {
  if (sectors.length === 0) return { x: -1, y: 0.35 };
  let x = 0;
  let y = 0;
  for (const s of sectors) {
    const a = (midAngleDeg(s) * Math.PI) / 180;
    x -= Math.cos(a);
    y += Math.sin(a);
  }
  return norm({ x: x / sectors.length, y: y / sectors.length || 0.3 });
}

function drawSector(args: {
  sector: SectorDraft;
  state: CircleSectorsState;
  map: (p: Vec) => Vec;
  layout: SceneLayout;
  cmds: SceneCmd[];
  texts: SceneText[];
}): void {
  const { sector, state, map, layout, cmds, texts } = args;
  const { style, unit, unknownLetter } = state;
  const { A, B, M, O } = sectorMath(sector, state.radius);
  const cA = map(A);
  const cB = map(B);
  const cM = map(M);
  const cO = map(O);
  const { a0, a1, ccw } = canvasArcAngles(cO, cA, cB);

  cmds.push({ t: "line", x1: cO.x, y1: cO.y, x2: cA.x, y2: cA.y });
  cmds.push({ t: "line", x1: cO.x, y1: cO.y, x2: cB.x, y2: cB.y });

  if (!state.showCircle) {
    cmds.push({
      t: "arc",
      cx: cO.x,
      cy: cO.y,
      r: layout.visualR,
      a0,
      a1,
      ccw,
    });
  }

  if (sector.showPointNames) {
    cmds.push({ t: "dot", x: cA.x, y: cA.y, r: style.pointRadius });
    cmds.push({ t: "dot", x: cB.x, y: cB.y, r: style.pointRadius });
  }

  if (sector.showPointNames && sector.startName.trim()) {
    const radial = norm(sub(cA, cO));
    const p = add(add(cA, mul(radial, 16)), {
      x: sector.startDx ?? 0,
      y: sector.startDy ?? 0,
    });
    pushText(texts, cmds, {
      id: `${sector.id}:startName`,
      x: p.x,
      y: p.y,
      runs: parseNameRuns(sector.startName.trim()),
      size: style.pointLabelSize,
      anchor: "middle",
    });
  }
  if (sector.showPointNames && sector.endName.trim()) {
    const radial = norm(sub(cB, cO));
    const p = add(add(cB, mul(radial, 16)), {
      x: sector.endDx ?? 0,
      y: sector.endDy ?? 0,
    });
    pushText(texts, cmds, {
      id: `${sector.id}:endName`,
      x: p.x,
      y: p.y,
      runs: parseNameRuns(sector.endName.trim()),
      size: style.pointLabelSize,
      anchor: "middle",
    });
  }

  if (sector.showCentralAngle) {
    const markR = clamp(layout.visualR * 0.22, 22, 48);
    cmds.push({
      t: "arc",
      cx: cO.x,
      cy: cO.y,
      r: markR,
      a0,
      a1,
      ccw,
      id: `${sector.id}:angleLabel:line`,
    });
    const angText = resolveAngleText(
      sector.angleLabel,
      sector.centralAngleDeg,
      unknownLetter,
    );
    if (angText) {
      const sweep = canvasCcwSpan(a0, a1);
      const midA = a0 - sweep / 2 + sector.angleLabel.dx / Math.max(markR, 1);
      const labelR = markR + 14 + sector.angleLabel.dy;
      pushText(texts, cmds, {
        id: `${sector.id}:angleLabel`,
        x: cO.x + labelR * Math.cos(midA),
        y: cO.y + labelR * Math.sin(midA),
        runs: parseMathRuns(angText),
        size: style.fontSize,
        anchor: "middle",
      });
    }
  }

  if (sector.showRadius) {
    const rText = resolveLabelText(
      sector.radiusLabel,
      formatNiceRadius(state.radius, unit),
      unit,
      unknownLetter,
    );
    const from = sector.radiusOn === "end" ? cB : cA;
    const other = sector.radiusOn === "end" ? cA : cB;
    dimArc(
      cmds,
      texts,
      cO,
      from,
      sub(other, from),
      style.dimOffset * 0.85,
      rText,
      `${sector.id}:radiusLabel`,
      sector.radiusLabel,
      style.fontSize,
    );
  }

  if (sector.showArcLength) {
    const arcText = resolveLabelText(
      sector.arcLabel,
      formatArcAuto(sector.centralAngleDeg, state.radius, unit),
      unit,
      unknownLetter,
    );
    dimArcLength(
      cmds,
      texts,
      cO,
      layout.visualR,
      a0,
      a1,
      style.dimOffset,
      arcText,
      `${sector.id}:arcLabel`,
      sector.arcLabel,
      style.fontSize,
    );
  }

  if (sector.showArea) {
    const areaText = resolveLabelText(
      sector.areaLabel,
      formatAreaAuto(sector.centralAngleDeg, state.radius, unit),
      areaUnitForResolve(unit),
      unknownLetter,
    );
    if (areaText) {
      const inner = add(cO, mul(norm(sub(cM, cO)), layout.visualR * 0.52));
      const labelPos = add(inner, {
        x: 36 + sector.areaLabel.dx,
        y: -10 + sector.areaLabel.dy,
      });
      const lineId = `${sector.id}:areaLabel:line`;
      cmds.push({
        t: "line",
        x1: inner.x,
        y1: inner.y,
        x2: labelPos.x,
        y2: labelPos.y,
        id: lineId,
      });
      const tip = norm(sub(inner, labelPos));
      cmds.push({
        t: "arrowhead",
        x: inner.x,
        y: inner.y,
        ux: tip.x,
        uy: tip.y,
        size: 7,
      });
      pushText(texts, cmds, {
        id: `${sector.id}:areaLabel`,
        x: labelPos.x,
        y: labelPos.y,
        runs: parseMathRuns(areaText),
        size: style.fontSize,
        anchor: "middle",
      });
    }
  }
}

function formatNiceRadius(radius: number, unit: string): string {
  const n = Number.isInteger(radius)
    ? String(radius)
    : String(Math.round(radius * 100) / 100);
  const u = unit.trim();
  return u ? `${n} ${u}` : n;
}

function areaUnitForResolve(unit: string): string {
  const u = unit.trim();
  return u ? `${u}²` : "";
}

export type FigureHit =
  | { kind: "label"; id: string }
  | { kind: "dimLine"; id: string }
  | { kind: "point"; sectorId: string; which: "start" | "end" }
  | { kind: "center" }
  | { kind: "sector"; sectorId: string }
  | { kind: "circle" };

function measureTargetId(id: string): string {
  return id.endsWith(":line") ? id.slice(0, -5) : id;
}

function distToArc(
  p: Vec,
  cx: number,
  cy: number,
  r: number,
  a0: number,
  a1: number,
  ccw: boolean,
): number {
  const ang = Math.atan2(p.y - cy, p.x - cx);
  if (angleOnArc(ang, a0, a1, ccw)) {
    return Math.abs(Math.hypot(p.x - cx, p.y - cy) - r);
  }
  const p0 = { x: cx + r * Math.cos(a0), y: cy + r * Math.sin(a0) };
  const p1 = { x: cx + r * Math.cos(a1), y: cy + r * Math.sin(a1) };
  return Math.min(
    Math.hypot(p.x - p0.x, p.y - p0.y),
    Math.hypot(p.x - p1.x, p.y - p1.y),
  );
}

function distToSeg(p: Vec, a: Vec, b: Vec): { d: number; t: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-9) return { d: Math.hypot(p.x - a.x, p.y - a.y), t: 0 };
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return { d: Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)), t };
}

type HitCandidate = { hit: FigureHit; d: number; weight: number };

function hitBias(kind: FigureHit["kind"]): number {
  switch (kind) {
    case "point":
    case "center":
      return 0;
    case "label":
      return 8;
    case "dimLine":
      return 18;
    case "sector":
      return 26;
    case "circle":
      return 28;
  }
}

function considerHit(
  best: HitCandidate | null,
  hit: FigureHit,
  d: number,
  max: number,
): HitCandidate | null {
  if (d > max) return best;
  const weight = d + hitBias(hit.kind);
  if (best && weight >= best.weight) return best;
  return { hit, d, weight };
}

export function hitTestFigure(
  state: CircleSectorsState,
  scene: DiagramScene,
  x: number,
  y: number,
  hitScale = 1,
): FigureHit | null {
  const s = Number.isFinite(hitScale) && hitScale > 0 ? hitScale : 1;
  const p = { x, y };
  const layout = scene.layout;
  let best: HitCandidate | null = null;

  for (const text of scene.texts) {
    best = considerHit(
      best,
      { kind: "label", id: text.id },
      Math.hypot(text.x - x, text.y - y),
      18 * s,
    );
  }

  for (const cmd of scene.cmds) {
    if (cmd.t === "arc" && cmd.id) {
      best = considerHit(
        best,
        { kind: "dimLine", id: measureTargetId(cmd.id) },
        distToArc(p, cmd.cx, cmd.cy, cmd.r, cmd.a0, cmd.a1, cmd.ccw),
        12 * s,
      );
    }
    if (cmd.t === "line" && cmd.id && (cmd.dashed || cmd.id.includes("areaLabel"))) {
      best = considerHit(
        best,
        { kind: "dimLine", id: measureTargetId(cmd.id) },
        distToSeg(p, { x: cmd.x1, y: cmd.y1 }, { x: cmd.x2, y: cmd.y2 }).d,
        12 * s,
      );
    }
  }

  for (const sector of state.sectors) {
    const { A, B } = sectorMath(sector, state.radius);
    const cA = mathToCanvas(A, layout);
    const cB = mathToCanvas(B, layout);
    best = considerHit(
      best,
      { kind: "point", sectorId: sector.id, which: "start" },
      Math.hypot(p.x - cA.x, p.y - cA.y),
      26 * s,
    );
    best = considerHit(
      best,
      { kind: "point", sectorId: sector.id, which: "end" },
      Math.hypot(p.x - cB.x, p.y - cB.y),
      26 * s,
    );
    const { a0, a1, ccw } = canvasArcAngles(layout.origin, cA, cB);
    const ang = Math.atan2(p.y - layout.origin.y, p.x - layout.origin.x);
    const d = Math.hypot(p.x - layout.origin.x, p.y - layout.origin.y);
    if (d <= layout.visualR + 8 * s && angleOnArc(ang, a0, a1, ccw)) {
      best = considerHit(best, { kind: "sector", sectorId: sector.id }, 4, 40 * s);
    }
    best = considerHit(
      best,
      { kind: "sector", sectorId: sector.id },
      distToArc(p, layout.origin.x, layout.origin.y, layout.visualR, a0, a1, ccw),
      12 * s,
    );
  }

  best = considerHit(
    best,
    { kind: "center" },
    Math.hypot(p.x - layout.origin.x, p.y - layout.origin.y),
    20 * s,
  );
  best = considerHit(
    best,
    { kind: "circle" },
    Math.abs(Math.hypot(p.x - layout.origin.x, p.y - layout.origin.y) - layout.visualR),
    14 * s,
  );

  return best?.hit ?? null;
}

export function measureFrame(
  state: CircleSectorsState,
  scene: DiagramScene,
  id: string,
): { along: Vec; outward: Vec; halfSpan: number } | null {
  const parsed = parseMeasureId(measureTargetId(id));
  if (!parsed) return null;
  const sector = state.sectors.find((s) => s.id === parsed.sectorId);
  if (!sector) return null;
  const layout = scene.layout;
  const { A, B, M, O } = sectorMath(sector, state.radius);
  const map = (q: Vec) => mathToCanvas(q, layout);
  const cA = map(A);
  const cB = map(B);
  const cM = map(M);
  const cO = map(O);
  function frame(a: Vec, b: Vec, out: Vec) {
    const along = norm(sub(b, a));
    return {
      along,
      outward: perpToward(along, out),
      halfSpan: len(sub(b, a)) / 2,
    };
  }
  if (parsed.key === "radiusLabel") {
    const from = sector.radiusOn === "end" ? cB : cA;
    const other = sector.radiusOn === "end" ? cA : cB;
    return frame(cO, from, sub(other, from));
  }
  if (parsed.key === "arcLabel") {
    const radial = norm(sub(cM, cO));
    const along = { x: -radial.y, y: radial.x };
    return { along, outward: radial, halfSpan: layout.visualR * 0.6 };
  }
  if (parsed.key === "angleLabel") {
    const radial = norm(sub(cM, cO));
    const along = { x: -radial.y, y: radial.x };
    return { along, outward: radial, halfSpan: 28 };
  }
  if (parsed.key === "areaLabel") {
    return { along: { x: 1, y: 0 }, outward: { x: 0, y: 1 }, halfSpan: 80 };
  }
  return null;
}
