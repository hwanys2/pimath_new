import {
  clampCentralAngle,
  emptyLabel,
  endAngleDeg,
  newSectorId,
  nextSectorNames,
  normalizeDeg,
  normalizeSector,
  type CircleSectorsState,
  type MeasLabel,
  type SectorDraft,
} from "@/lib/diagrams/circle-sectors/model";

export type Vec = { x: number; y: number };

export function polar(radius: number, deg: number): Vec {
  const a = (deg * Math.PI) / 180;
  return { x: radius * Math.cos(a), y: radius * Math.sin(a) };
}

export function sectorMath(sector: SectorDraft, radius: number) {
  const start = normalizeDeg(sector.startAngleDeg);
  const central = clampCentralAngle(sector.centralAngleDeg);
  const end = normalizeDeg(start + central);
  const mid = normalizeDeg(start + central / 2);
  return {
    start,
    end,
    mid,
    central,
    A: polar(radius, start),
    B: polar(radius, end),
    M: polar(radius, mid),
    O: { x: 0, y: 0 } as Vec,
  };
}

export function ccwSpanDeg(from: number, to: number): number {
  let d = normalizeDeg(to) - normalizeDeg(from);
  if (d < 0) d += 360;
  if (d < 0.5) d = 0.5;
  if (d > 359) d = 359;
  return d;
}

export function projectOnCircle(p: Vec, radius: number): Vec {
  const l = Math.hypot(p.x, p.y);
  if (l < 1e-9) return { x: radius, y: 0 };
  const s = radius / l;
  return { x: p.x * s, y: p.y * s };
}

export function angleDegOf(p: Vec): number {
  return normalizeDeg((Math.atan2(p.y, p.x) * 180) / Math.PI);
}

export function sectorFromTwoPoints(
  a: Vec,
  b: Vec,
  radius: number,
  names: { start: string; end: string },
): SectorDraft | null {
  const A = projectOnCircle(a, radius);
  const B = projectOnCircle(b, radius);
  const start = angleDegOf(A);
  const central = ccwSpanDeg(start, angleDegOf(B));
  if (central < 8) return null;
  return normalizeSector({
    id: newSectorId(),
    startAngleDeg: start,
    centralAngleDeg: central,
    startName: names.start,
    endName: names.end,
    startDx: 0,
    startDy: 0,
    endDx: 0,
    endDy: 0,
    showFill: true,
    showCentralAngle: true,
    showRadius: false,
    radiusOn: "start",
    showArcLength: false,
    showArea: false,
    showPointNames: false,
    angleLabel: emptyLabel("auto"),
    radiusLabel: emptyLabel("hide"),
    arcLabel: emptyLabel("hide"),
    areaLabel: emptyLabel("hide"),
  });
}

/** Drag an endpoint; the other radius stays put. */
export function rotateSectorEndpoint(
  sector: SectorDraft,
  target: Vec,
  which: "start" | "end",
): SectorDraft {
  if (Math.hypot(target.x, target.y) < 1e-6) return sector;
  const to = angleDegOf(target);
  if (which === "start") {
    const end = endAngleDeg(sector);
    return normalizeSector({
      ...sector,
      startAngleDeg: to,
      centralAngleDeg: ccwSpanDeg(to, end),
    });
  }
  return normalizeSector({
    ...sector,
    centralAngleDeg: ccwSpanDeg(sector.startAngleDeg, to),
  });
}

/** Rotate the whole sector around O. */
export function rotateSector(sector: SectorDraft, deltaDeg: number): SectorDraft {
  return normalizeSector({
    ...sector,
    startAngleDeg: sector.startAngleDeg + deltaDeg,
  });
}

export function mapSector(
  state: CircleSectorsState,
  id: string,
  fn: (sector: SectorDraft) => SectorDraft,
): CircleSectorsState {
  return {
    ...state,
    sectors: state.sectors.map((s) => (s.id === id ? fn(s) : s)),
  };
}

export function cycleLabelMode(label: MeasLabel): MeasLabel {
  if (label.mode === "auto") return { ...label, mode: "x" };
  if (label.mode === "x") return { ...label, mode: "hide" };
  return { ...label, mode: "auto" };
}

export function toggleMeasure(
  label: MeasLabel,
  currentlyShown: boolean,
): { shown: boolean; label: MeasLabel } {
  if (currentlyShown) return { shown: false, label };
  return {
    shown: true,
    label: label.mode === "hide" ? { ...label, mode: "auto" } : label,
  };
}

const MEASURE_KEYS = new Set([
  "angleLabel",
  "radiusLabel",
  "arcLabel",
  "areaLabel",
]);

export function isMeasureKey(key: string): boolean {
  return MEASURE_KEYS.has(key);
}

export function parseMeasureId(id: string): {
  sectorId: string;
  key: string;
  part: "text" | "line";
} | null {
  if (id === "center-name") return null;
  let part: "text" | "line" = "text";
  let rest = id;
  if (rest.endsWith(":line")) {
    part = "line";
    rest = rest.slice(0, -5);
  }
  const sep = rest.lastIndexOf(":");
  if (sep <= 0) return null;
  const key = rest.slice(sep + 1);
  if (
    !isMeasureKey(key) &&
    key !== "startName" &&
    key !== "endName"
  ) {
    return null;
  }
  return { sectorId: rest.slice(0, sep), key, part };
}

function clampNum(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function nudgeMeasureLabel(
  label: MeasLabel,
  canvasDx: number,
  canvasDy: number,
  along: Vec,
  outward: Vec,
  halfSpan: number,
): MeasLabel {
  const alongAmt = canvasDx * along.x + canvasDy * along.y;
  const perpAmt = canvasDx * outward.x + canvasDy * outward.y;
  const maxAlong = Math.max(halfSpan - 18, 4);
  return {
    ...label,
    dx: clampNum(label.dx + alongAmt, -maxAlong, maxAlong),
    dy: clampNum(label.dy + perpAmt, -160, 160),
  };
}

export function nudgeMeasureLine(
  label: MeasLabel,
  canvasDx: number,
  canvasDy: number,
  _along: Vec,
  outward: Vec,
  _halfSpan: number,
): MeasLabel {
  const perpAmt = canvasDx * outward.x + canvasDy * outward.y;
  return {
    ...label,
    lineDy: clampNum((label.lineDy ?? 0) + perpAmt, -160, 160),
  };
}

export function nudgeById(
  state: CircleSectorsState,
  id: string,
  dx: number,
  dy: number,
): CircleSectorsState {
  if (id === "center-name") {
    return {
      ...state,
      centerDx: (state.centerDx ?? 0) + dx,
      centerDy: (state.centerDy ?? 0) + dy,
    };
  }
  const sep = id.lastIndexOf(":");
  if (sep < 0) return state;
  const sectorId = id.slice(0, sep);
  const key = id.slice(sep + 1);
  return {
    ...state,
    sectors: state.sectors.map((s) => {
      if (s.id !== sectorId) return s;
      if (key === "startName") {
        return { ...s, startDx: (s.startDx ?? 0) + dx, startDy: (s.startDy ?? 0) + dy };
      }
      if (key === "endName") {
        return { ...s, endDx: (s.endDx ?? 0) + dx, endDy: (s.endDy ?? 0) + dy };
      }
      const labelKeys = new Set([
        "angleLabel",
        "radiusLabel",
        "arcLabel",
        "areaLabel",
      ]);
      if (!labelKeys.has(key)) return s;
      const label = s[key as "angleLabel"] as MeasLabel;
      return { ...s, [key]: { ...label, dx: label.dx + dx, dy: label.dy + dy } };
    }),
  };
}

export function parseMeasureInput(text: string): {
  kind: "number" | "unknown" | "pi" | "text";
  value?: number;
  unknown?: string;
  raw: string;
} {
  const raw = text.trim();
  if (!raw) return { kind: "text", raw };
  const unknown = raw.match(/^([A-Za-z])(?:\s*(?:cm²|cm\^2|cm|mm|°)?)?$/);
  if (unknown && unknown[1]!.toLowerCase() !== "pi") {
    return { kind: "unknown", unknown: unknown[1], raw };
  }
  const pi = raw.match(
    /^(-?\d+(?:\.\d+)?)?\s*(?:π|\\pi|pi)\s*(?:cm²|cm\^2|cm|mm)?$/i,
  );
  if (pi) {
    const coef = pi[1] == null || pi[1] === "" ? 1 : Number(pi[1]);
    return { kind: "pi", value: coef, raw };
  }
  const num = raw.match(/^(-?\d+(?:\.\d+)?)\s*(?:cm²|cm\^2|cm|mm|°)?$/i);
  if (num) {
    return { kind: "number", value: Number(num[1]), raw };
  }
  return { kind: "text", raw };
}

function labelFromParse(
  parsed: ReturnType<typeof parseMeasureInput>,
  text: string,
  prev: MeasLabel,
): MeasLabel {
  if (parsed.kind === "unknown") {
    return { ...prev, mode: "x", custom: parsed.unknown ?? "x" };
  }
  if (parsed.kind === "number" && parsed.value != null) {
    // Keep 직접 mode: show exactly what was typed (no forced unit).
    return { ...prev, mode: "custom", custom: text.trim() || String(parsed.value) };
  }
  if (parsed.kind === "pi") {
    // π forms stay on auto so the sector label can follow the computed π text.
    return { ...prev, mode: "auto", custom: "" };
  }
  if (!text.trim()) {
    return { ...prev, mode: "hide", custom: "" };
  }
  return { ...prev, mode: "custom", custom: text.trim() };
}

function angleFromArcLength(arc: number, radius: number): number {
  const r = Math.max(radius, 0.01);
  return clampCentralAngle((arc * 180) / (Math.PI * r));
}

function angleFromArcPi(coeff: number, radius: number): number {
  const r = Math.max(radius, 0.01);
  return clampCentralAngle((coeff * 180) / r);
}

function angleFromArea(area: number, radius: number): number {
  const r2 = Math.max(radius, 0.01) ** 2;
  return clampCentralAngle((area * 360) / (Math.PI * r2));
}

function angleFromAreaPi(coeff: number, radius: number): number {
  const r2 = Math.max(radius, 0.01) ** 2;
  return clampCentralAngle((coeff * 360) / r2);
}

export function applyEditedLabel(
  state: CircleSectorsState,
  id: string,
  text: string,
): CircleSectorsState {
  const parsed = parseMeasureInput(text);
  if (id === "center-name") {
    return { ...state, centerName: text.trim() || "O" };
  }
  const sep = id.lastIndexOf(":");
  if (sep < 0) return state;
  const sectorId = id.slice(0, sep);
  const key = id.slice(sep + 1);

  if (key === "startName" || key === "endName") {
    return {
      ...state,
      sectors: state.sectors.map((s) =>
        s.id === sectorId ? { ...s, [key]: text.trim() } : s,
      ),
    };
  }

  const labelKeys = new Set([
    "angleLabel",
    "radiusLabel",
    "arcLabel",
    "areaLabel",
  ]);
  if (!labelKeys.has(key)) return state;

  let nextRadius = state.radius;
  if (key === "radiusLabel" && parsed.kind === "number" && parsed.value != null) {
    nextRadius = Math.max(parsed.value, 0.01);
  }

  return {
    ...state,
    radius: nextRadius,
    sectors: state.sectors.map((s) => {
      if (s.id !== sectorId) return s;
      const prev = s[key as "angleLabel"] as MeasLabel;
      const label = labelFromParse(parsed, text, prev);
      let next: SectorDraft = { ...s, [key]: label };
      if (key === "angleLabel" && parsed.kind === "number" && parsed.value != null) {
        next = { ...next, centralAngleDeg: clampCentralAngle(Math.abs(parsed.value)) };
      }
      if (key === "arcLabel") {
        if (parsed.kind === "number" && parsed.value != null) {
          next = {
            ...next,
            centralAngleDeg: angleFromArcLength(Math.abs(parsed.value), nextRadius),
          };
        }
        if (parsed.kind === "pi" && parsed.value != null) {
          next = {
            ...next,
            centralAngleDeg: angleFromArcPi(Math.abs(parsed.value), nextRadius),
          };
        }
      }
      if (key === "areaLabel") {
        if (parsed.kind === "number" && parsed.value != null) {
          next = {
            ...next,
            centralAngleDeg: angleFromArea(Math.abs(parsed.value), nextRadius),
          };
        }
        if (parsed.kind === "pi" && parsed.value != null) {
          next = {
            ...next,
            centralAngleDeg: angleFromAreaPi(Math.abs(parsed.value), nextRadius),
          };
        }
      }
      return normalizeSector(next);
    }),
  };
}

export function addSectorFromDrag(
  state: CircleSectorsState,
  a: Vec,
  b: Vec,
): { state: CircleSectorsState; id: string } | null {
  if (state.sectors.length >= 4) return null;
  const draft = sectorFromTwoPoints(a, b, state.radius, nextSectorNames(state));
  if (!draft) return null;
  return {
    state: { ...state, sectors: [...state.sectors, draft] },
    id: draft.id,
  };
}
