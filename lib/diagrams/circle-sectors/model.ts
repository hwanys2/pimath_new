export type LabelMode = "auto" | "x" | "hide" | "custom";

export type MeasLabel = {
  mode: LabelMode;
  custom: string;
  dx: number;
  dy: number;
  lineDx?: number;
  lineDy?: number;
};

export type DiagramStyle = {
  lineWidth: number;
  fontSize: number;
  pointLabelSize: number;
  pointRadius: number;
  dimOffset: number;
  padding: number;
  exportScale: number;
};

export type SectorDraft = {
  id: string;
  startAngleDeg: number;
  centralAngleDeg: number;
  startName: string;
  endName: string;
  startDx?: number;
  startDy?: number;
  endDx?: number;
  endDy?: number;
  showFill: boolean;
  showCentralAngle: boolean;
  showRadius: boolean;
  /** Which radius gets the length 설명선. */
  radiusOn: "start" | "end";
  showArcLength: boolean;
  showArea: boolean;
  showPointNames: boolean;
  angleLabel: MeasLabel;
  radiusLabel: MeasLabel;
  arcLabel: MeasLabel;
  areaLabel: MeasLabel;
};

export type CircleSectorsState = {
  radius: number;
  showCircle: boolean;
  showCenter: boolean;
  centerName: string;
  centerDx?: number;
  centerDy?: number;
  unit: string;
  unknownLetter: string;
  viewRotationDeg: number;
  sectors: SectorDraft[];
  style: DiagramStyle;
};

export const SECTOR_FILL = "rgba(17,17,17,0.08)";

export function emptyLabel(mode: LabelMode = "auto"): MeasLabel {
  return { mode, custom: "", dx: 0, dy: 0, lineDx: 0, lineDy: 0 };
}

export function newSectorId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `s-${Math.random().toString(36).slice(2, 10)}`;
}

const DEFAULT_STYLE: DiagramStyle = {
  lineWidth: 1.7,
  fontSize: 20,
  pointLabelSize: 22,
  pointRadius: 3.2,
  dimOffset: 22,
  padding: 56,
  exportScale: 3,
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function normalizeDeg(deg: number): number {
  let d = deg % 360;
  if (d < 0) d += 360;
  return d;
}

export function clampCentralAngle(deg: number): number {
  return clamp(deg, 1, 359);
}

function sectorDraft(partial: Partial<SectorDraft> = {}): SectorDraft {
  return {
    id: "s-ab",
    startAngleDeg: 0,
    centralAngleDeg: 60,
    startName: "A",
    endName: "B",
    startDx: 0,
    startDy: 0,
    endDx: 0,
    endDy: 0,
    showFill: true,
    showCentralAngle: true,
    showRadius: true,
    radiusOn: "end",
    showArcLength: false,
    showArea: false,
    showPointNames: false,
    angleLabel: emptyLabel("auto"),
    radiusLabel: emptyLabel("auto"),
    arcLabel: emptyLabel("hide"),
    areaLabel: emptyLabel("hide"),
    ...partial,
  };
}

export function normalizeSector(sector: SectorDraft): SectorDraft {
  return {
    ...sector,
    startAngleDeg: normalizeDeg(sector.startAngleDeg),
    centralAngleDeg: clampCentralAngle(sector.centralAngleDeg),
    radiusOn: sector.radiusOn === "end" ? "end" : "start",
    angleLabel: sector.angleLabel ?? emptyLabel("auto"),
    radiusLabel: sector.radiusLabel ?? emptyLabel("auto"),
    arcLabel: sector.arcLabel ?? emptyLabel("hide"),
    areaLabel: sector.areaLabel ?? emptyLabel("hide"),
  };
}

export function normalizeState(state: CircleSectorsState): CircleSectorsState {
  return {
    ...state,
    radius: Math.max(state.radius, 0.01),
    centerName: state.centerName?.trim() ? state.centerName : "O",
    unit: state.unit ?? "cm",
    unknownLetter: state.unknownLetter?.trim() || "x",
    viewRotationDeg: state.viewRotationDeg ?? 0,
    style: { ...DEFAULT_STYLE, ...state.style },
    sectors: (state.sectors ?? []).map(normalizeSector),
  };
}

function baseState(partial: Partial<CircleSectorsState>): CircleSectorsState {
  return normalizeState({
    radius: 6,
    showCircle: true,
    showCenter: true,
    centerName: "O",
    unit: "cm",
    unknownLetter: "x",
    viewRotationDeg: 0,
    sectors: [],
    style: { ...DEFAULT_STYLE },
    ...partial,
  });
}

export const CIRCLE_SECTOR_PRESETS: {
  id: string;
  title: string;
  hint: string;
  state: CircleSectorsState;
}[] = [
  {
    id: "arc-proportion",
    title: "원 · 호 길이 비례",
    hint: "같은 원에서 중심각과 호",
    state: baseState({
      radius: 10,
      showCircle: true,
      sectors: [
        sectorDraft({
          id: "s-ab",
          startAngleDeg: 20,
          centralAngleDeg: 45,
          startName: "A",
          endName: "B",
          showFill: false,
          showRadius: false,
          showArcLength: true,
          showCentralAngle: true,
          showPointNames: false,
          angleLabel: emptyLabel("auto"),
          arcLabel: emptyLabel("x"),
        }),
        sectorDraft({
          id: "s-cd",
          startAngleDeg: 65,
          centralAngleDeg: 135,
          startName: "C",
          endName: "D",
          showFill: false,
          showRadius: false,
          showArcLength: true,
          showCentralAngle: true,
          showPointNames: false,
          angleLabel: emptyLabel("auto"),
          arcLabel: { mode: "custom", custom: "15 cm", dx: 0, dy: 0 },
        }),
      ],
    }),
  },
  {
    id: "sector-area",
    title: "원 · 부채꼴 넓이",
    hint: "색칠한 부채꼴의 넓이",
    state: baseState({
      radius: 10,
      showCircle: true,
      sectors: [
        sectorDraft({
          id: "s-ab",
          startAngleDeg: 115,
          centralAngleDeg: 30,
          startName: "A",
          endName: "B",
          showFill: true,
          showRadius: false,
          showArcLength: false,
          showArea: true,
          showCentralAngle: true,
          showPointNames: false,
          angleLabel: emptyLabel("auto"),
          areaLabel: { mode: "custom", custom: "6 cm²", dx: -28, dy: -8 },
        }),
        sectorDraft({
          id: "s-cd",
          startAngleDeg: 300,
          centralAngleDeg: 120,
          startName: "C",
          endName: "D",
          showFill: true,
          showRadius: false,
          showArcLength: false,
          showArea: true,
          showCentralAngle: true,
          showPointNames: false,
          angleLabel: emptyLabel("auto"),
          areaLabel: emptyLabel("x"),
        }),
      ],
    }),
  },
  {
    id: "sector-acute",
    title: "부채꼴만 · 예각",
    hint: "원 없이 중심각과 반지름",
    state: baseState({
      radius: 6,
      showCircle: false,
      showCenter: true,
      sectors: [
        sectorDraft({
          startAngleDeg: 0,
          centralAngleDeg: 30,
          showFill: true,
          showRadius: true,
          radiusOn: "end",
          showCentralAngle: true,
          showArcLength: false,
          showPointNames: false,
        }),
      ],
    }),
  },
  {
    id: "sector-obtuse",
    title: "부채꼴만 · 둔각",
    hint: "135° 부채꼴",
    state: baseState({
      radius: 4,
      showCircle: false,
      sectors: [
        sectorDraft({
          startAngleDeg: 20,
          centralAngleDeg: 135,
          showFill: true,
          showRadius: true,
          radiusOn: "end",
          showCentralAngle: true,
          showArcLength: false,
          showPointNames: false,
        }),
      ],
    }),
  },
  {
    id: "sector-arc",
    title: "부채꼴 · 호 길이",
    hint: "반지름과 호",
    state: baseState({
      radius: 9,
      showCircle: false,
      sectors: [
        sectorDraft({
          startAngleDeg: 250,
          centralAngleDeg: 60,
          showFill: true,
          showRadius: true,
          radiusOn: "start",
          showCentralAngle: false,
          showArcLength: true,
          showPointNames: false,
          angleLabel: emptyLabel("hide"),
          arcLabel: emptyLabel("auto"),
        }),
      ],
    }),
  },
  {
    id: "sector-major",
    title: "큰 부채꼴 · 호 길이",
    hint: "180°보다 큰 호",
    state: baseState({
      radius: 5,
      showCircle: false,
      sectors: [
        sectorDraft({
          startAngleDeg: 144,
          centralAngleDeg: 288,
          showFill: true,
          showRadius: true,
          radiusOn: "end",
          showCentralAngle: false,
          showArcLength: true,
          showPointNames: false,
          angleLabel: emptyLabel("hide"),
          arcLabel: emptyLabel("auto"),
        }),
      ],
    }),
  },
];

export const DEFAULT_CIRCLE_SECTORS_STATE: CircleSectorsState = structuredClone(
  CIRCLE_SECTOR_PRESETS[0]!.state,
);

export function cloneState(state: CircleSectorsState): CircleSectorsState {
  return structuredClone(state);
}

const NEXT_NAMES = [
  ["A", "B"],
  ["C", "D"],
  ["E", "F"],
  ["G", "H"],
];

export function nextSectorNames(state: CircleSectorsState): {
  start: string;
  end: string;
} {
  const i = state.sectors.length;
  const names = NEXT_NAMES[i] ?? ["P", "Q"];
  return { start: names[0]!, end: names[1]! };
}

export function labelUnknownLetter(label: MeasLabel, fallback: string): string {
  const fromLabel = label.custom.trim();
  if (/^[A-Za-z]$/.test(fromLabel)) return fromLabel;
  return fallback.trim() || "x";
}

export function formatNice(value: number): string {
  if (!Number.isFinite(value)) return "";
  const rounded = Math.round(value * 1000) / 1000;
  if (Math.abs(rounded - Math.round(rounded)) < 1e-6) {
    return String(Math.round(rounded));
  }
  return String(Math.round(rounded * 100) / 100);
}

function formatMeasure(value: number, unit: string): string {
  const n = formatNice(value);
  const u = unit.trim();
  return u ? `${n} ${u}` : n;
}

function nearNice(value: number): boolean {
  if (!Number.isFinite(value)) return false;
  const rounded = Math.round(value * 1000) / 1000;
  if (Math.abs(rounded - Math.round(rounded)) < 1e-6) return true;
  const abs = Math.abs(rounded);
  for (let den = 2; den <= 12; den += 1) {
    const num = Math.round(abs * den);
    if (Math.abs(abs - num / den) < 1e-6) return true;
  }
  return false;
}

function formatPiMeasure(coeffOfPi: number, unit: string): string {
  const n = formatNice(coeffOfPi);
  const u = unit.trim();
  const pi = n === "1" ? "π" : n === "0" ? "0" : `${n}π`;
  if (pi === "0") return formatMeasure(0, u);
  return u ? `${pi} ${u}` : pi;
}

/** Arc length = (θ/360) · 2πr = (θ/180) · πr */
export function arcLength(thetaDeg: number, radius: number): number {
  return (thetaDeg / 180) * Math.PI * radius;
}

/** Area = (θ/360) · πr² */
export function sectorArea(thetaDeg: number, radius: number): number {
  return (thetaDeg / 360) * Math.PI * radius * radius;
}

/** Coefficient k of kπ for arc length. */
export function arcPiCoeff(thetaDeg: number, radius: number): number {
  return (thetaDeg / 180) * radius;
}

/** Coefficient k of kπ for sector area. */
export function areaPiCoeff(thetaDeg: number, radius: number): number {
  return (thetaDeg / 360) * radius * radius;
}

export function formatArcAuto(
  thetaDeg: number,
  radius: number,
  unit: string,
): string {
  const k = arcPiCoeff(thetaDeg, radius);
  if (nearNice(k)) return formatPiMeasure(k, unit);
  return formatMeasure(arcLength(thetaDeg, radius), unit);
}

export function areaUnit(unit: string): string {
  const u = unit.trim();
  return u ? `${u}²` : "";
}

export function formatAreaAuto(
  thetaDeg: number,
  radius: number,
  unit: string,
): string {
  const k = areaPiCoeff(thetaDeg, radius);
  const u = areaUnit(unit);
  if (nearNice(k)) return formatPiMeasure(k, u);
  return formatMeasure(sectorArea(thetaDeg, radius), u);
}

export function resolveLabelText(
  label: MeasLabel,
  autoText: string,
  unit: string,
  unknownLetter: string,
): string | null {
  if (label.mode === "hide") return null;
  if (label.mode === "x") {
    const u = unit.trim();
    const math = `$${labelUnknownLetter(label, unknownLetter)}$`;
    return u ? `${math} ${u}` : math;
  }
  if (label.mode === "custom") {
    const t = label.custom.trim();
    return t.length > 0 ? t : null;
  }
  return autoText;
}

export function resolveAngleText(
  label: MeasLabel,
  autoDeg: number,
  unknownLetter: string,
): string | null {
  if (label.mode === "hide") return null;
  if (label.mode === "x") {
    return `$${labelUnknownLetter(label, unknownLetter)}$°`;
  }
  if (label.mode === "custom") {
    const t = label.custom.trim();
    return t.length > 0 ? t : null;
  }
  return `${formatNice(autoDeg)}°`;
}

export function endAngleDeg(sector: SectorDraft): number {
  return normalizeDeg(sector.startAngleDeg + sector.centralAngleDeg);
}

export function midAngleDeg(sector: SectorDraft): number {
  return normalizeDeg(sector.startAngleDeg + sector.centralAngleDeg / 2);
}
