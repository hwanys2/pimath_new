"use client";

import type { ComponentType, SVGProps } from "react";
import { PALETTE } from "./BoardToolbar";
import {
  CursorIcon,
  EraserIcon,
  HighlighterIcon,
  LineIcon,
  PenIcon,
  PointToolIcon,
  RedoIcon,
  TrashIcon,
  UndoIcon,
} from "./icons";

export type GraphDrawTool =
  | "cursor"
  | "pen"
  | "highlighter"
  | "point"
  | "line"
  | "eraser";

const TOOLS: {
  id: GraphDrawTool;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}[] = [
  { id: "cursor", label: "선택", icon: CursorIcon },
  { id: "pen", label: "펜", icon: PenIcon },
  { id: "highlighter", label: "형광펜", icon: HighlighterIcon },
  { id: "point", label: "점", icon: PointToolIcon },
  { id: "line", label: "선", icon: LineIcon },
  { id: "eraser", label: "지우개", icon: EraserIcon },
];

const COLORS = PALETTE.filter((c) => c !== "#ffffff");

type Props = {
  tool: GraphDrawTool;
  onToolChange: (tool: GraphDrawTool) => void;
  color: string;
  onColorChange: (color: string) => void;
  size: number;
  onSizeChange: (size: number) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
};

export default function GraphDrawToolbar({
  tool,
  onToolChange,
  color,
  onColorChange,
  size,
  onSizeChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClear,
}: Props) {
  return (
    <div
      className="flex shrink-0 flex-col items-center gap-1 rounded-xl border border-wood/20 bg-wood px-1 py-1.5 text-cream shadow"
      onPointerDown={(e) => e.stopPropagation()}
    >
      {TOOLS.map((t) => {
        const Icon = t.icon;
        const active = tool === t.id;
        return (
          <button
            key={t.id}
            type="button"
            title={
              t.id === "point"
                ? "점 — 짧게 누르면 자유점, 길게 누르면 격자에 붙음"
                : t.label
            }
            aria-label={
              t.id === "point"
                ? "점. 짧게 누르면 자유점, 길게 누르면 격자에 붙습니다."
                : t.label
            }
            onClick={() => onToolChange(t.id)}
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
              active
                ? "bg-cream text-wood-dark shadow-[0_2px_0_rgba(0,0,0,0.2)]"
                : "text-cream hover:bg-black/20"
            }`}
          >
            <Icon width={16} height={16} />
          </button>
        );
      })}
      <div className="my-0.5 h-px w-6 bg-white/25" />
      {COLORS.map((c) => (
        <button
          key={c}
          type="button"
          title={c}
          aria-label={`색 ${c}`}
          onClick={() => onColorChange(c)}
          className={`h-4 w-4 rounded-full border ${
            color === c ? "border-white ring-1 ring-white" : "border-black/20"
          }`}
          style={{ background: c }}
        />
      ))}
      <input
        type="range"
        min={2}
        max={12}
        value={size}
        title="굵기"
        aria-label="굵기"
        onChange={(e) => onSizeChange(Number(e.target.value))}
        className="mt-1 h-16 w-6 cursor-pointer appearance-none bg-transparent"
        style={{ writingMode: "vertical-lr", direction: "rtl" }}
      />
      <div className="my-0.5 h-px w-6 bg-white/25" />
      <button
        type="button"
        title="실행 취소"
        aria-label="실행 취소"
        disabled={!canUndo}
        onClick={onUndo}
        className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-black/20 disabled:opacity-35"
      >
        <UndoIcon width={14} height={14} />
      </button>
      <button
        type="button"
        title="다시 실행"
        aria-label="다시 실행"
        disabled={!canRedo}
        onClick={onRedo}
        className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-black/20 disabled:opacity-35"
      >
        <RedoIcon width={14} height={14} />
      </button>
      <button
        type="button"
        title="그리기 지우기"
        aria-label="그리기 지우기"
        onClick={onClear}
        className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-black/20"
      >
        <TrashIcon width={14} height={14} />
      </button>
    </div>
  );
}
