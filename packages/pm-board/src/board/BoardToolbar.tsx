"use client";

import { useEffect, useRef, useState, type ComponentType, type SVGProps } from "react";
import type { BackgroundId, BoardBrand, LineKind, OverlayId, ToolId, WidgetKind } from "./types";
import { BACKGROUND_DEFS } from "./BoardBackground";
import { WIDGET_DEFS, WIDGET_ORDER } from "./widget-config";
import {
  BackgroundIcon,
  CompassIcon,
  CursorIcon,
  EllipseIcon,
  EraserIcon,
  ExitFullscreenIcon,
  FullscreenIcon,
  GeometryPerfectIcon,
  HighlighterIcon,
  HomeIcon,
  ImageIcon,
  InfiniteLineIcon,
  LineIcon,
  MathFormulaIcon,
  PenIcon,
  PointToolIcon,
  ProtractorIcon,
  RayLineIcon,
  RectIcon,
  SegmentLineIcon,
  RedoIcon,
  RulerIcon,
  TrashIcon,
  StrokeWidthIcon,
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

const STROKE_SIZE_MIN = 1;
const STROKE_SIZE_MAX = 24;
const ERASER_SIZE_MIN = 2;
const ERASER_SIZE_MAX = 28;
const POINT_SIZE_MIN = 2;
const POINT_SIZE_MAX = 12;
const SIZE_PRESETS = [3, 6, 10];

function WidthSliderPopover({
  value,
  min,
  max,
  onChange,
  variant,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  variant: "stroke" | "eraser" | "point";
}) {
  const trackRef = useRef<HTMLDivElement>(null);

  const valueFromClientY = (clientY: number) => {
    const track = trackRef.current;
    if (!track) return value;
    const rect = track.getBoundingClientRect();
    const t = 1 - (clientY - rect.top) / rect.height;
    return Math.round(min + Math.max(0, Math.min(1, t)) * (max - min));
  };

  const onTrackPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    onChange(valueFromClientY(e.clientY));
  };

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!(e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) return;
    onChange(valueFromClientY(e.clientY));
  };

  const pct = ((value - min) / (max - min)) * 100;
  const preview =
    variant === "eraser"
      ? Math.min(40, value * 2.2 + 4)
      : variant === "point"
        ? value * 2 + 2
        : Math.min(36, value * 1.6 + 2);

  return (
    <div
      className="absolute bottom-full left-1/2 mb-3 flex -translate-x-1/2 flex-col items-center gap-2.5 rounded-2xl border-2 border-wood/20 bg-cream px-3 py-3 shadow-xl"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-inner">
        <span
          className={`rounded-full ${variant === "eraser" ? "bg-wood/40" : "bg-wood-dark"}`}
          style={{ width: preview, height: preview }}
        />
      </div>
      <div
        ref={trackRef}
        className="relative h-40 w-10 touch-none rounded-full bg-gradient-to-b from-wood/10 via-wood/20 to-wood/10 shadow-inner"
        onPointerDown={onTrackPointer}
        onPointerMove={onMove}
      >
        {SIZE_PRESETS.filter((p) => p >= min && p <= max).map((preset) => {
          const presetPct = ((preset - min) / (max - min)) * 100;
          return (
            <span
              key={preset}
              className="pointer-events-none absolute left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-wood/35"
              style={{ bottom: `calc(${presetPct}% - 2px)` }}
            />
          );
        })}
        <div
          className="pointer-events-none absolute left-1/2 h-5 w-5 -translate-x-1/2 rounded-full border-2 border-white bg-wood shadow-[0_2px_6px_rgba(0,0,0,0.25)]"
          style={{ bottom: `calc(${pct}% - 10px)` }}
        />
      </div>
      <span className="font-display text-xs text-wood-dark tabular-nums">{value}px</span>
    </div>
  );
}

const LINE_KINDS: {
  id: LineKind;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}[] = [
  { id: "segment", label: "선분", icon: SegmentLineIcon },
  { id: "ray", label: "반직선", icon: RayLineIcon },
  { id: "infinite", label: "직선", icon: InfiniteLineIcon },
];

const SHAPES: { id: ToolId; label: string; icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { id: "line", label: "선", icon: SegmentLineIcon },
  { id: "rect", label: "사각형", icon: RectIcon },
  { id: "ellipse", label: "원", icon: EllipseIcon },
];

type Menu = "shapes" | "color" | "size" | "pointSize" | "eraserSize" | "widgets" | "background" | null;

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
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${
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
  pointSize: number;
  setPointSize: (s: number) => void;
  eraserSize: number;
  setEraserSize: (s: number) => void;
  lineKind: LineKind;
  setLineKind: (k: LineKind) => void;
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
  onCompassTool: () => void;
  mathSelectActive: boolean;
  onToggleMathSelect: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onPickImageFile: (file: File) => void;
  brand: BoardBrand;
};

export default function BoardToolbar({
  tool,
  setTool,
  color,
  setColor,
  size,
  setSize,
  pointSize,
  setPointSize,
  eraserSize,
  setEraserSize,
  lineKind,
  setLineKind,
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
  onCompassTool,
  mathSelectActive,
  onToggleMathSelect,
  isFullscreen,
  onToggleFullscreen,
  onPickImageFile,
  brand,
}: Props) {
  const [menu, setMenu] = useState<Menu>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [lastShape, setLastShape] = useState<ToolId>("line");
  const [armClear, setArmClear] = useState(false);

  useEffect(() => {
    if (!armClear) return;
    const id = setTimeout(() => setArmClear(false), 2500);
    return () => clearTimeout(id);
  }, [armClear]);

  const toggleMenu = (m: Menu) => setMenu((cur) => (cur === m ? null : m));
  const isShapeTool = SHAPES.some((s) => s.id === tool);
  const lineKindIcon =
    LINE_KINDS.find((k) => k.id === lineKind)?.icon ?? SegmentLineIcon;
  const ShapeIcon = SHAPES.find((s) => s.id === (isShapeTool ? tool : lastShape))?.icon ?? lineKindIcon;
  const showStrokeWidth = tool !== "cursor";
  const strokeWidthLabel =
    tool === "eraser" ? "지우개 크기" : tool === "point" ? "점 크기" : "선 굵기";

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
          {brand.title}
        </span>
      </div>

      {/* Top-right control dock */}
      <div className="absolute top-3 right-3 z-50 max-w-[calc(100vw-1.5rem)] pt-[env(safe-area-inset-top,0px)]">
        <div className="wood-bar flex max-w-full items-center gap-1 overflow-x-auto overscroll-x-contain rounded-2xl px-2 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <DockBtn
            label="이미지 넣기"
            onClick={() => imageInputRef.current?.click()}
          >
            <ImageIcon />
          </DockBtn>
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
            onClick={onCompassTool}
          >
            <CompassIcon />
          </DockBtn>
          <DockBtn
            label="전개도·입체"
            onClick={() => onAddWidget("foldNet")}
          >
            <GeometryPerfectIcon />
          </DockBtn>
          <DockBtn
            label="수식 인식"
            active={mathSelectActive}
            onClick={onToggleMathSelect}
          >
            <MathFormulaIcon />
          </DockBtn>
          <div className="mx-0.5 h-6 w-px bg-white/20" />
          <DockBtn
            label={isFullscreen ? "전체화면 끝내기" : "전체화면"}
            onClick={onToggleFullscreen}
          >
            {isFullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
          </DockBtn>
          <a
            href={brand.homeHref}
            title="나가기"
            aria-label="나가기"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-cream transition hover:bg-black/20"
          >
            <HomeIcon />
          </a>
        </div>

        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onPickImageFile(file);
            e.target.value = "";
          }}
        />

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
      <div className="absolute inset-x-2 bottom-3 z-50 flex justify-center pb-[env(safe-area-inset-bottom,0px)]">
        <div className="relative min-w-0 max-w-full">
        {menu === "shapes" ? (
          <div className="absolute bottom-full left-1/2 mb-2 flex -translate-x-1/2 flex-col gap-1.5 rounded-2xl border-2 border-wood/20 bg-cream p-1.5 shadow-xl">
            <div className="flex gap-1">
              {LINE_KINDS.map((lk) => {
                const Icon = lk.icon;
                return (
                  <button
                    key={lk.id}
                    type="button"
                    title={lk.label}
                    onClick={() => {
                      setLineKind(lk.id);
                      setTool("line");
                      setLastShape("line");
                    }}
                    className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
                      tool === "line" && lineKind === lk.id
                        ? "bg-wood text-cream"
                        : "text-wood-dark hover:bg-wood/10"
                    }`}
                  >
                    <Icon />
                  </button>
                );
              })}
            </div>
            <div className="flex gap-1 border-t border-wood/15 pt-1">
              {SHAPES.filter((s) => s.id !== "line").map((shape) => {
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

        {menu === "pointSize" ? (
          <WidthSliderPopover
            value={pointSize}
            min={POINT_SIZE_MIN}
            max={POINT_SIZE_MAX}
            onChange={setPointSize}
            variant="point"
          />
        ) : null}

        {menu === "eraserSize" ? (
          <WidthSliderPopover
            value={eraserSize}
            min={ERASER_SIZE_MIN}
            max={ERASER_SIZE_MAX}
            onChange={setEraserSize}
            variant="eraser"
          />
        ) : null}

        {menu === "size" ? (
          <WidthSliderPopover
            value={size}
            min={STROKE_SIZE_MIN}
            max={STROKE_SIZE_MAX}
            onChange={setSize}
            variant="stroke"
          />
        ) : null}

        <div className="wood-bar flex max-w-full items-center gap-1 overflow-x-auto overscroll-x-contain rounded-2xl px-2 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
            onClick={() => {
              setTool("eraser");
              setMenu(null);
            }}
          >
            <EraserIcon />
          </DockBtn>
          <DockBtn
            label="점"
            active={tool === "point"}
            onClick={() => {
              setMenu(null);
              setTool("point");
            }}
          >
            <PointToolIcon />
          </DockBtn>
          <DockBtn
            label="도형"
            active={isShapeTool || menu === "shapes"}
            onClick={() => {
              if (!isShapeTool) setTool("line");
              toggleMenu("shapes");
            }}
          >
            {tool === "line" ? (
              (() => {
                const Icon = lineKindIcon;
                return <Icon />;
              })()
            ) : (
              <ShapeIcon />
            )}
          </DockBtn>

          <div className="mx-0.5 h-6 w-px bg-white/20" />

          <button
            type="button"
            title="색"
            aria-label="색 고르기"
            onClick={() => toggleMenu("color")}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition hover:bg-black/20 ${
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
            title={strokeWidthLabel}
            aria-label={strokeWidthLabel}
            disabled={!showStrokeWidth}
            onClick={() => {
              if (!showStrokeWidth) return;
              if (tool === "eraser") toggleMenu("eraserSize");
              else if (tool === "point") toggleMenu("pointSize");
              else toggleMenu("size");
            }}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-cream transition hover:bg-black/20 ${
              menu === "size" || menu === "eraserSize" || menu === "pointSize"
                ? "bg-black/25"
                : ""
            } ${!showStrokeWidth ? "cursor-not-allowed opacity-35" : ""}`}
          >
            <StrokeWidthIcon />
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
            className={`font-display flex h-10 shrink-0 items-center justify-center gap-1 rounded-xl px-2 text-sm transition ${
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
      </div>
    </>
  );
}
