import type { ComponentType, SVGProps } from "react";
import type { WidgetKind } from "./types";
import {
  CalculatorIcon,
  ClockIcon,
  DiceIcon,
  GeometryPerfectIcon,
  GraphIcon,
  NoiseIcon,
  NoteIcon,
  PickerIcon,
  QrIcon,
  RandomIcon,
  TimerIcon,
  TrafficIcon,
} from "./icons";

export type WidgetDef = {
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  w: number;
  h: number;
  minW: number;
  minH: number;
  accent: string;
};

export const WIDGET_DEFS: Record<WidgetKind, WidgetDef> = {
  timer: {
    label: "타이머",
    icon: TimerIcon,
    w: 330,
    h: 320,
    minW: 260,
    minH: 260,
    accent: "#ffd76a",
  },
  clock: {
    label: "시계",
    icon: ClockIcon,
    w: 330,
    h: 300,
    minW: 250,
    minH: 230,
    accent: "#a8d8ff",
  },
  picker: {
    label: "학생 뽑기",
    icon: PickerIcon,
    w: 380,
    h: 430,
    minW: 300,
    minH: 340,
    accent: "#ffd76a",
  },
  dice: {
    label: "주사위",
    icon: DiceIcon,
    w: 350,
    h: 290,
    minW: 270,
    minH: 230,
    accent: "#9de8c8",
  },
  random: {
    label: "랜덤 숫자",
    icon: RandomIcon,
    w: 310,
    h: 300,
    minW: 260,
    minH: 250,
    accent: "#9de8c8",
  },
  traffic: {
    label: "신호등",
    icon: TrafficIcon,
    w: 210,
    h: 400,
    minW: 180,
    minH: 330,
    accent: "#ffc9a8",
  },
  noise: {
    label: "소음 측정",
    icon: NoiseIcon,
    w: 340,
    h: 280,
    minW: 280,
    minH: 240,
    accent: "#ffc9a8",
  },
  qr: {
    label: "QR 코드",
    icon: QrIcon,
    w: 320,
    h: 370,
    minW: 250,
    minH: 290,
    accent: "#d4c4ff",
  },
  note: {
    label: "메모·수식",
    icon: NoteIcon,
    w: 400,
    h: 310,
    minW: 280,
    minH: 220,
    accent: "#ffe8a0",
  },
  graph: {
    label: "함수 그래프",
    icon: GraphIcon,
    w: 440,
    h: 460,
    minW: 330,
    minH: 350,
    accent: "#a8d8ff",
  },
  calculator: {
    label: "계산기",
    icon: CalculatorIcon,
    w: 300,
    h: 430,
    minW: 250,
    minH: 350,
    accent: "#d4c4ff",
  },
  foldNet: {
    label: "전개도·입체",
    icon: GeometryPerfectIcon,
    w: 720,
    h: 560,
    minW: 560,
    minH: 420,
    accent: "#7dd3fc",
  },
};

export const WIDGET_ORDER: WidgetKind[] = [
  "timer",
  "clock",
  "picker",
  "dice",
  "random",
  "traffic",
  "noise",
  "qr",
  "note",
  "graph",
  "calculator",
  "foldNet",
];
