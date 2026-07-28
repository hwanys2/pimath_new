"use client";

import Link from "next/link";
import { useEffect, useState, type ComponentType, type SVGProps } from "react";
import type { BackgroundId, OverlayId, ToolId, WidgetKind } from "./types";
import { BACKGROUND_DEFS } from "./BoardBackground";
import { WIDGET_DEFS, WIDGET_ORDER } from "./widget-config";
import {
  ArrowIcon,
  BackgroundIcon,
  CompassIcon,
  CursorIcon,
  EllipseIcon,
  EraserIcon,
  ExitFullscreenIcon,
  FullscreenIcon,
  HighlighterIcon,
  HomeIcon,
  LineIcon,
  PenIcon,
  ProtractorIcon,
  RectIcon,
  RedoIcon,
  RulerIcon,
  TrashIcon,
  UndoIcon,
  WidgetsIcon,
} from "./icons";

export const PALETTE = [
  "#ffffff",
  "#1f2937",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#3b82f6",
  "#a855f7",
  "#ec4899",
];

const SIZES = [3, 6, 10];

const SHAPES: { id: ToolId; label: string; icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { id: "line", label: "직선", icon: LineIcon },
  { id: "arrow", label: "화살표", icon: ArrowIcon },
  { id: "rect", label: "사각형", icon: RectIcon },
  { id: "ellipse", label: "원", icon: EllipseIcon },
];

type Menu = "shapes" | "color" | "size" | "widgets" | "background" | null;

function DockBtn({
  active,
  onClick,
  label,
  disabled,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  label: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
        active
          ? "bg-cream text-wood-dark shadow-[0_3px_0_rgba(0,0,0,0.25)]"
          : "text-cream hover:bg-black/20"
      } ${disabled ? "cursor-not-allowed opacity-35" : ""}`}
    >
      {children}
    </button>
  );
}

type Props = {
  tool: ToolId;
  setTool: (t: ToolId) => void;
  color: string;
  setColor: (c: string) => void;
  size: number;
  setSize: (s: number) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  background: BackgroundId;
  setBackground: (b: BackgroundId) => void;
  onAddWidget: (kind: WidgetKind) => void;
  overlaysOn: Record<OverlayId, boolean>;
  onToggleOverlay: (id: OverlayId) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
};

export default function BoardToolbar({
  tool,
  setTool,
  color,
  setColor,
  size,
  setSize,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClear,
  background,
  setBackground,
  onAddWidget,
  overlaysOn,
  onToggleOverlay,
  isFullscreen,
  onToggleFullscreen,
}: Props) {
  const [menu, setMenu] = useState<Menu>(null);
  const [lastShape, setLastShape] = useState<ToolId>("line");
  const [armClear, setArmClear] = useState(false);

  useEffect(() => {
    if (!armClear) return;
    const id = setTimeout(() => setArmClear(false), 2500);
    return () => clearTimeout(id);
  }, [armClear]);

  const toggleMenu = (m: Menu) => setMenu((cur) => (cur === m ? null : m));
  const isShapeTool = SHAPES.some((s) => s.id === tool);
  const ShapeIcon = SHAPES.find((s) => s.id === (isShapeTool ? tool : lastShape))!.icon;

  return (
    <>
      {menu ? (
        <div
          className="absolute inset-0 z-[45]"
          onPointerDown={() => setMenu(null)}
        />
      ) : null}

      {/* Top-left brand */}
      <div className="pointer-events-none absolute top-3 left-3 z-40 select-none">
        <span className="font-display rounded-xl bg-black/25 px-3 py-1.5 text-sm text-white/85 backdrop-blur-sm">
          수학하는 즐거움 · 전자칠판
        </span>
      </div>

      {/* Top-right control dock */}
      <div className="absolute top-3 right-3 z-50">
        <div className="wood-bar flex items-center gap-1 rounded-2xl px-2 py-1.5">
          <DockBtn
            label="위젯 추가"
            active={menu === "widgets"}
            onClick={() => toggleMenu("widgets")}
          >
            <WidgetsIcon />
          </DockBtn>
          <DockBtn
            label="배경 바꾸기"
            active={menu === "background"}
            onClick={() => toggleMenu("background")}
          >
            <BackgroundIcon />
          </DockBtn>
          <DockBtn
            label="자"
            active={overlaysOn.ruler}
            onClick={() => onToggleOverlay("ruler")}
          >
            <RulerIcon />
          </DockBtn>
          <DockBtn
            label="각도기"
            active={overlaysOn.protractor}
            onClick={() => onToggleOverlay("protractor")}
          >
            <ProtractorIcon />
          </DockBtn>
          <DockBtn
            label="컴퍼스"
            active={overlaysOn.compass}
            onClick={() => onToggleOverlay("compass")}
          >
            <CompassIcon />
          </DockBtn>
          <div className="mx-0.5 h-6 w-px bg-white/20" />
          <DockBtn
            label={isFullscreen ? "전체화면 끝내기" : "전체화면"}
            onClick={onToggleFullscreen}
          >
            {isFullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
          </DockBtn>
          <Link
            href="/"
            title="나가기"
            aria-label="나가기"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-cream transition hover:bg-black/20"
          >
            <HomeIcon />
          </Link>
        </div>

        {menu === "widgets" ? (
          <div className="absolute top-full right-0 z-50 mt-2 grid w-72 grid-cols-3 gap-1.5 rounded-2xl border-2 border-wood/20 bg-cream p-2 shadow-xl">
            {WIDGET_ORDER.map((kind) => {
              const def = WIDGET_DEFS[kind];
              const Icon = def.icon;
              return (
                <button
                  key={kind}
                  type="button"
                  onClick={() => {
                    onAddWidget(kind);
                    setMenu(null);
                  }}
                  className="flex flex-col items-center gap-1 rounded-xl border-2 border-transparent bg-white px-1 py-2.5 text-wood-dark shadow-sm transition hover:border-gold hover:bg-[#fffbef]"
                >
                  <Icon width={22} height={22} />
                  <span className="font-display text-xs">{def.label}</span>
                </button>
              );
            })}
          </div>
        ) : null}

        {menu === "background" ? (
          <div className="absolute top-full right-0 z-50 mt-2 flex w-44 flex-col gap-1 rounded-2xl border-2 border-wood/20 bg-cream p-2 shadow-xl">
            {BACKGROUND_DEFS.map((bg) => (
              <button
                key={bg.id}
                type="button"
                onClick={() => {
                  setBackground(bg.id);
                  setMenu(null);
                }}
                className={`font-display flex items-center gap-2 rounded-xl border-2 px-2 py-1.5 text-sm transition ${
                  background === bg.id
                    ? "border-gold bg-white text-wood-dark"
                    : "border-transparent text-wood hover:bg-white/70"
                }`}
              >
                <span
                  className="h-5 w-7 rounded border border-black/15"
                  style={{
                    background: bg.dark ? "#2a5142" : "#fcfcf8",
                    backgroundImage: bg.id === "grid" || bg.id === "coordinate"
                      ? "linear-gradient(to right, rgba(70,110,160,0.4) 1px, transparent 1px), linear-gradient(to bottom, rgba(70,110,160,0.4) 1px, transparent 1px)"
                      : bg.id === "dots"
                        ? "radial-gradient(circle, rgba(70,110,160,0.6) 1px, transparent 1.5px)"
                        : bg.id === "lined"
                          ? "linear-gradient(to bottom, transparent 5px, rgba(70,110,160,0.5) 6px)"
                          : undefined,
                    backgroundSize: "6px 6px",
                  }}
                />
                {bg.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* Bottom-center drawing dock */}
      <div className="absolute bottom-3 left-1/2 z-50 -translate-x-1/2">
        {menu === "shapes" ? (
          <div className="absolute bottom-full left-1/2 mb-2 flex -translate-x-1/2 gap-1 rounded-2xl border-2 border-wood/20 bg-cream p-1.5 shadow-xl">
            {SHAPES.map((shape) => {
              const Icon = shape.icon;
              return (
                <button
                  key={shape.id}
                  type="button"
                  title={shape.label}
                  onClick={() => {
                    setTool(shape.id);
                    setLastShape(shape.id);
                    setMenu(null);
                  }}
                  className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
                    tool === shape.id
                      ? "bg-wood text-cream"
                      : "text-wood-dark hover:bg-wood/10"
                  }`}
                >
                  <Icon />
                </button>
              );
            })}
          </div>
        ) : null}

        {menu === "color" ? (
          <div className="absolute bottom-full left-1/2 mb-2 grid -translate-x-1/2 grid-cols-5 gap-1.5 rounded-2xl border-2 border-wood/20 bg-cream p-2 shadow-xl">
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`색 ${c}`}
                onClick={() => {
                  setColor(c);
                  setMenu(null);
                  if (tool === "cursor" || tool === "eraser") setTool("pen");
                }}
                className={`h-8 w-8 rounded-full border-2 transition hover:scale-110 ${
                  color === c ? "border-wood-dark ring-2 ring-gold" : "border-black/15"
                }`}
                style={{ background: c }}
              />
            ))}
          </div>
        ) : null}

        {menu === "size" ? (
          <div className="absolute bottom-full left-1/2 mb-2 flex -translate-x-1/2 items-center gap-2 rounded-2xl border-2 border-wood/20 bg-cream p-2 shadow-xl">
            {SIZES.map((s) => (
              <button
                key={s}
                type="button"
                aria-label={`굵기 ${s}`}
                onClick={() => {
                  setSize(s);
                  setMenu(null);
                }}
                className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
                  size === s ? "bg-wood text-cream" : "text-wood-dark hover:bg-wood/10"
                }`}
              >
                <span
                  className="rounded-full bg-current"
                  style={{ width: s + 4, height: s + 4 }}
                />
              </button>
            ))}
          </div>
        ) : null}

        <div className="wood-bar flex items-center gap-1 rounded-2xl px-2 py-1.5">
          <DockBtn label="선택·이동" active={tool === "cursor"} onClick={() => setTool("cursor")}>
            <CursorIcon />
          </DockBtn>
          <DockBtn label="펜" active={tool === "pen"} onClick={() => setTool("pen")}>
            <PenIcon />
          </DockBtn>
          <DockBtn
            label="형광펜"
            active={tool === "highlighter"}
            onClick={() => setTool("highlighter")}
          >
            <HighlighterIcon />
          </DockBtn>
          <DockBtn
            label="지우개"
            active={tool === "eraser"}
            onClick={() => setTool("eraser")}
          >
            <EraserIcon />
          </DockBtn>
          <DockBtn
            label="도형"
            active={isShapeTool || menu === "shapes"}
            onClick={() => {
              if (!isShapeTool) setTool(lastShape);
              toggleMenu("shapes");
            }}
          >
            <ShapeIcon />
          </DockBtn>

          <div className="mx-0.5 h-6 w-px bg-white/20" />

          <button
            type="button"
            title="색"
            aria-label="색 고르기"
            onClick={() => toggleMenu("color")}
            className={`flex h-10 w-10 items-center justify-center rounded-xl transition hover:bg-black/20 ${
              menu === "color" ? "bg-black/25" : ""
            }`}
          >
            <span
              className="h-6 w-6 rounded-full border-2 border-white/70 shadow"
              style={{ background: color }}
            />
          </button>
          <button
            type="button"
            title="굵기"
            aria-label="굵기 고르기"
            onClick={() => toggleMenu("size")}
            className={`flex h-10 w-10 items-center justify-center rounded-xl text-cream transition hover:bg-black/20 ${
              menu === "size" ? "bg-black/25" : ""
            }`}
          >
            <span
              className="rounded-full bg-current"
              style={{ width: size + 4, height: size + 4 }}
            />
          </button>

          <div className="mx-0.5 h-6 w-px bg-white/20" />

          <DockBtn label="실행 취소" onClick={onUndo} disabled={!canUndo}>
            <UndoIcon />
          </DockBtn>
          <DockBtn label="다시 실행" onClick={onRedo} disabled={!canRedo}>
            <RedoIcon />
          </DockBtn>
          <button
            type="button"
            title="모두 지우기"
            aria-label="모두 지우기"
            onClick={() => {
              if (armClear) {
                onClear();
                setArmClear(false);
              } else {
                setArmClear(true);
              }
            }}
            className={`font-display flex h-10 items-center justify-center gap-1 rounded-xl px-2 text-sm transition ${
              armClear
                ? "bg-red-500 text-white"
                : "text-cream hover:bg-black/20"
            }`}
          >
            <TrashIcon />
            {armClear ? "확인" : null}
          </button>
        </div>
      </div>
    </>
  );
}
