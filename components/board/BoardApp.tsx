"use client";

import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import "katex/dist/katex.min.css";
import type {
  BackgroundId,
  BoardMode,
  BoardOverlays,
  BoardPersisted,
  ClassRoster,
  CompassPose,
  MathCard,
  OverlayId,
  OverlayPose,
  Stroke,
  ToolId,
  WidgetInstance,
  WidgetKind,
} from "./types";
import BoardBackground, { BACKGROUND_DEFS } from "./BoardBackground";
import BoardToolbar from "./BoardToolbar";
import DrawingCanvas from "./DrawingCanvas";
import WidgetWindow from "./WidgetWindow";
import { RulerOverlay, ProtractorOverlay } from "./GeometryOverlays";
import CompassOverlay from "./CompassOverlay";
import MathSelectOverlay from "./MathSelectOverlay";
import MathRecognizePanel from "./MathRecognizePanel";
import MathCardOverlay from "./MathCardOverlay";
import { strokeIndicesInRect, type BoardRect } from "@/lib/board-stroke-bounds";
import { strokesToMathImageDataUrl } from "@/lib/board-math-image";
import { WIDGET_DEFS } from "./widget-config";
import TimerWidget from "./widgets/TimerWidget";
import ClockWidget from "./widgets/ClockWidget";
import PickerWidget from "./widgets/PickerWidget";
import DiceWidget from "./widgets/DiceWidget";
import RandomNumberWidget from "./widgets/RandomNumberWidget";
import TrafficLightWidget from "./widgets/TrafficLightWidget";
import NoiseWidget from "./widgets/NoiseWidget";
import QrWidget from "./widgets/QrWidget";
import TextNoteWidget from "./widgets/TextNoteWidget";
import GraphWidget from "./widgets/GraphWidget";
import CalculatorWidget from "./widgets/CalculatorWidget";

const STORAGE_KEY = "pm-board-v1";
const MAX_HISTORY = 60;
const MAX_SAVED_STROKES = 500;

type DrawState = { strokes: Stroke[]; past: Stroke[][]; future: Stroke[][] };

type DrawAction =
  | { type: "commit"; stroke: Stroke }
  | { type: "deleteIndices"; indices: number[] }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "clear" }
  | { type: "load"; strokes: Stroke[] };

function drawReducer(state: DrawState, action: DrawAction): DrawState {
  switch (action.type) {
    case "commit":
      return {
        strokes: [...state.strokes, action.stroke],
        past: [...state.past.slice(-(MAX_HISTORY - 1)), state.strokes],
        future: [],
      };
    case "deleteIndices": {
      if (action.indices.length === 0) return state;
      const remove = new Set(action.indices);
      const strokes = state.strokes.filter((_, i) => !remove.has(i));
      return {
        strokes,
        past: [...state.past.slice(-(MAX_HISTORY - 1)), state.strokes],
        future: [],
      };
    }
    case "undo": {
      if (state.past.length === 0) return state;
      const past = [...state.past];
      const strokes = past.pop()!;
      return { strokes, past, future: [state.strokes, ...state.future] };
    }
    case "redo": {
      if (state.future.length === 0) return state;
      const [strokes, ...future] = state.future;
      return { strokes, past: [...state.past, state.strokes], future };
    }
    case "clear":
      if (state.strokes.length === 0) return state;
      return {
        strokes: [],
        past: [...state.past.slice(-(MAX_HISTORY - 1)), state.strokes],
        future: [],
      };
    case "load":
      return { strokes: action.strokes, past: [], future: [] };
  }
}

function defaultPenColor(bg: BackgroundId): string {
  return BACKGROUND_DEFS.find((b) => b.id === bg)?.dark ? "#ffffff" : "#1f2937";
}

function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return (
    !!el &&
    (el.tagName === "INPUT" ||
      el.tagName === "TEXTAREA" ||
      el.tagName === "SELECT" ||
      el.isContentEditable)
  );
}

export default function BoardApp({
  rosters,
  isTeacher = false,
}: {
  rosters: ClassRoster[];
  isTeacher?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [background, setBackground] = useState<BackgroundId>("chalkboard");
  const [tool, setTool] = useState<ToolId>("pen");
  const [color, setColor] = useState("#ffffff");
  const [size, setSize] = useState(6);
  const [draw, dispatchDraw] = useReducer(drawReducer, {
    strokes: [],
    past: [],
    future: [],
  });
  const [widgets, setWidgets] = useState<WidgetInstance[]>([]);
  const [overlays, setOverlays] = useState<BoardOverlays>({
    ruler: null,
    protractor: null,
    compass: null,
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [boardMode, setBoardMode] = useState<BoardMode>("draw");
  const [mathCards, setMathCards] = useState<MathCard[]>([]);
  const [recognizeSession, setRecognizeSession] = useState<{
    rect: BoardRect;
    indices: number[];
    imageDataUrl: string;
  } | null>(null);
  const spawnCountRef = useRef(0);

  // ── Load persisted state (async to avoid a sync setState-in-effect) ──
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw) as Partial<BoardPersisted>;
          if (saved.background) setBackground(saved.background);
          if (saved.color) setColor(saved.color);
          if (saved.size) setSize(saved.size);
          if (Array.isArray(saved.strokes)) {
            dispatchDraw({ type: "load", strokes: saved.strokes });
          }
          if (Array.isArray(saved.widgets)) setWidgets(saved.widgets);
          if (Array.isArray(saved.mathCards)) setMathCards(saved.mathCards);
          if (saved.overlays) {
            const compassRaw = saved.overlays.compass as CompassPose | null | undefined;
            setOverlays({
              ruler: saved.overlays.ruler ?? null,
              protractor: saved.overlays.protractor ?? null,
              compass: compassRaw
                ? {
                    cx: compassRaw.cx,
                    cy: compassRaw.cy,
                    radius:
                      typeof compassRaw.radius === "number"
                        ? compassRaw.radius
                        : 168,
                    angle:
                      typeof compassRaw.angle === "number"
                        ? compassRaw.angle
                        : -40,
                  }
                : null,
            });
          }
        }
      } catch {
        // Corrupt saved state: start fresh.
      }
      setReady(true);
    }, 0);
    return () => clearTimeout(id);
  }, []);

  // ── Save (debounced) ─────────────────────────────────────────────
  useEffect(() => {
    if (!ready) return;
    const id = setTimeout(() => {
      const data: BoardPersisted = {
        background,
        color,
        size,
        strokes: draw.strokes.slice(-MAX_SAVED_STROKES),
        widgets,
        overlays,
        mathCards,
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch {
        // Storage full: silently skip.
      }
    }, 400);
    return () => clearTimeout(id);
  }, [ready, background, color, size, draw.strokes, widgets, overlays, mathCards]);

  // ── Body scroll lock while the board is open ─────────────────────
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // ── Fullscreen ───────────────────────────────────────────────────
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      rootRef.current?.requestFullscreen().catch(() => {});
    }
  }, []);

  // ── Keyboard shortcuts ───────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        dispatchDraw({ type: e.shiftKey ? "redo" : "undo" });
      }
      if (e.key === "Escape" && boardMode === "math-select") {
        setBoardMode("draw");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [boardMode]);

  // ── Background change keeps a sensible pen color ─────────────────
  const changeBackground = useCallback(
    (next: BackgroundId) => {
      if (color === defaultPenColor(background)) {
        setColor(defaultPenColor(next));
      }
      setBackground(next);
    },
    [color, background],
  );

  // ── Widget management ────────────────────────────────────────────
  const addWidget = useCallback(
    (kind: WidgetKind, initialState?: Record<string, unknown>) => {
    const def = WIDGET_DEFS[kind];
    const n = spawnCountRef.current++;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const offset = (n % 6) * 28;
    setWidgets((prev) => {
      const maxZ = prev.reduce((m, w) => Math.max(m, w.z), 0);
      return [
        ...prev,
        {
          id: `${kind}-${Date.now().toString(36)}-${n}`,
          kind,
          x: Math.max(12, Math.min(vw / 2 - def.w / 2 + offset - 60, vw - def.w - 12)),
          y: Math.max(12, Math.min(vh / 2 - def.h / 2 + offset - 60, vh - def.h - 12)),
          w: def.w,
          h: def.h,
          z: maxZ + 1,
          state: initialState ?? {},
        },
      ];
    });
  },
    [],
  );

  const patchWidget = useCallback(
    (id: string, patch: Partial<WidgetInstance>) => {
      setWidgets((prev) =>
        prev.map((w) => (w.id === id ? { ...w, ...patch } : w)),
      );
    },
    [],
  );

  const patchWidgetState = useCallback(
    (id: string, patch: Record<string, unknown>) => {
      setWidgets((prev) =>
        prev.map((w) =>
          w.id === id ? { ...w, state: { ...w.state, ...patch } } : w,
        ),
      );
    },
    [],
  );

  const closeWidget = useCallback((id: string) => {
    setWidgets((prev) => prev.filter((w) => w.id !== id));
  }, []);

  const bringToFront = useCallback((id: string) => {
    setWidgets((prev) => {
      const maxZ = prev.reduce((m, w) => Math.max(m, w.z), 0);
      const target = prev.find((w) => w.id === id);
      if (!target || target.z === maxZ) return prev;
      return prev.map((w) => (w.id === id ? { ...w, z: maxZ + 1 } : w));
    });
  }, []);

  const toggleMathSelect = useCallback(() => {
    setBoardMode((m) => (m === "math-select" ? "draw" : "math-select"));
    setRecognizeSession(null);
  }, []);

  const onMathSelectComplete = useCallback(
    (rect: BoardRect) => {
      setBoardMode("draw");
      const indices = strokeIndicesInRect(draw.strokes, rect);
      const imageDataUrl = strokesToMathImageDataUrl(
        draw.strokes,
        indices.length > 0 ? indices : draw.strokes.map((_, i) => i),
        rect,
        background,
      );
      if (!imageDataUrl) return;
      setRecognizeSession({ rect, indices, imageDataUrl });
    },
    [draw.strokes, background],
  );

  const applyMathRecognize = useCallback(
    (payload: {
      latex: string;
      expr: string;
      paramValues: Record<string, number>;
    }) => {
      const session = recognizeSession;
      if (!session) return;
      const { rect, indices } = session;
      if (indices.length > 0) {
        dispatchDraw({ type: "deleteIndices", indices });
      }
      const card: MathCard = {
        id: `math-${Date.now().toString(36)}`,
        x: rect.x0,
        y: rect.y0,
        w: 320,
        h: 280,
        latex: payload.latex,
        expr: payload.expr,
        paramValues: payload.paramValues,
      };
      setMathCards((prev) => [...prev, card]);
      setRecognizeSession(null);
    },
    [recognizeSession],
  );

  const openGraphFromCard = useCallback(
    (expr: string, paramValues: Record<string, number>) => {
      addWidget("graph", {
        exprs: [{ text: expr, color: "#3b82f6" }],
        paramValues,
      });
    },
    [addWidget],
  );

  const toggleOverlay = useCallback((id: OverlayId) => {
    setOverlays((prev) => {
      if (prev[id]) return { ...prev, [id]: null };
      if (id === "compass") {
        return {
          ...prev,
          compass: {
            cx: window.innerWidth / 2,
            cy: window.innerHeight / 2,
            radius: 168,
            angle: -40,
          },
        };
      }
      return {
        ...prev,
        [id]: {
          x: window.innerWidth / 2,
          y: window.innerHeight / 2 - (id === "ruler" ? 80 : -40),
          angle: 0,
        } satisfies OverlayPose,
      };
    });
  }, []);

  const renderWidget = (w: WidgetInstance) => {
    const setState = (patch: Record<string, unknown>) =>
      patchWidgetState(w.id, patch);
    switch (w.kind) {
      case "timer":
        return <TimerWidget state={w.state} setState={setState} />;
      case "clock":
        return <ClockWidget state={w.state} setState={setState} />;
      case "picker":
        return (
          <PickerWidget state={w.state} setState={setState} rosters={rosters} />
        );
      case "dice":
        return <DiceWidget state={w.state} setState={setState} />;
      case "random":
        return <RandomNumberWidget state={w.state} setState={setState} />;
      case "traffic":
        return <TrafficLightWidget state={w.state} setState={setState} />;
      case "noise":
        return <NoiseWidget state={w.state} setState={setState} />;
      case "qr":
        return <QrWidget state={w.state} setState={setState} />;
      case "note":
        return <TextNoteWidget state={w.state} setState={setState} />;
      case "graph":
        return <GraphWidget state={w.state} setState={setState} />;
      case "calculator":
        return <CalculatorWidget state={w.state} setState={setState} />;
    }
  };

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-[60] overflow-hidden overscroll-none bg-[#2a5142]"
    >
      <BoardBackground id={background} />

      {ready ? (
        <>
          <div className="pointer-events-none absolute inset-0 z-10">
            <DrawingCanvas
              tool={tool}
              color={color}
              size={size}
              strokes={draw.strokes}
              disabled={boardMode === "math-select"}
              onCommit={(stroke) => dispatchDraw({ type: "commit", stroke })}
            />
          </div>

          {boardMode === "math-select" ? (
            <MathSelectOverlay
              onComplete={onMathSelectComplete}
              onCancel={() => setBoardMode("draw")}
            />
          ) : null}

          {recognizeSession ? (
            <MathRecognizePanel
              imageDataUrl={recognizeSession.imageDataUrl}
              canUseApi={isTeacher}
              onApply={applyMathRecognize}
              onCancel={() => setRecognizeSession(null)}
            />
          ) : null}

          <div className="pointer-events-none absolute inset-0 z-20">
            {widgets.map((w) => {
              const def = WIDGET_DEFS[w.kind];
              return (
                <WidgetWindow
                  key={w.id}
                  widget={w}
                  title={def.label}
                  accent={def.accent}
                  minW={def.minW}
                  minH={def.minH}
                  onPatch={(patch) => patchWidget(w.id, patch)}
                  onFocus={() => bringToFront(w.id)}
                  onClose={() => closeWidget(w.id)}
                >
                  {renderWidget(w)}
                </WidgetWindow>
              );
            })}
          </div>

          <div className="pointer-events-none absolute inset-0 z-30">
            {overlays.ruler ? (
              <RulerOverlay
                pose={overlays.ruler}
                onChange={(pose) =>
                  setOverlays((prev) => ({ ...prev, ruler: pose }))
                }
                onClose={() =>
                  setOverlays((prev) => ({ ...prev, ruler: null }))
                }
              />
            ) : null}
            {overlays.protractor ? (
              <ProtractorOverlay
                pose={overlays.protractor}
                onChange={(pose) =>
                  setOverlays((prev) => ({ ...prev, protractor: pose }))
                }
                onClose={() =>
                  setOverlays((prev) => ({ ...prev, protractor: null }))
                }
              />
            ) : null}
            {overlays.compass ? (
              <CompassOverlay
                pose={overlays.compass}
                color={color}
                size={size}
                onChange={(pose) =>
                  setOverlays((prev) => ({ ...prev, compass: pose }))
                }
                onCommit={(stroke) =>
                  dispatchDraw({ type: "commit", stroke })
                }
                onClose={() =>
                  setOverlays((prev) => ({ ...prev, compass: null }))
                }
              />
            ) : null}
            {mathCards.map((card) => (
              <MathCardOverlay
                key={card.id}
                card={card}
                onChange={(next) =>
                  setMathCards((prev) =>
                    prev.map((c) => (c.id === card.id ? next : c)),
                  )
                }
                onClose={() =>
                  setMathCards((prev) => prev.filter((c) => c.id !== card.id))
                }
                onOpenGraph={openGraphFromCard}
              />
            ))}
          </div>

          <BoardToolbar
            tool={tool}
            setTool={setTool}
            color={color}
            setColor={setColor}
            size={size}
            setSize={setSize}
            canUndo={draw.past.length > 0}
            canRedo={draw.future.length > 0}
            onUndo={() => dispatchDraw({ type: "undo" })}
            onRedo={() => dispatchDraw({ type: "redo" })}
            onClear={() => dispatchDraw({ type: "clear" })}
            background={background}
            setBackground={changeBackground}
            onAddWidget={addWidget}
            overlaysOn={{
              ruler: overlays.ruler !== null,
              protractor: overlays.protractor !== null,
              compass: overlays.compass !== null,
            }}
            onToggleOverlay={toggleOverlay}
            mathSelectActive={boardMode === "math-select"}
            onToggleMathSelect={toggleMathSelect}
            isFullscreen={isFullscreen}
            onToggleFullscreen={toggleFullscreen}
          />
        </>
      ) : null}
    </div>
  );
}
