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
  BoardAppProps,
  BoardBrand,
  BoardImage,
  BoardMode,
  BoardOverlays,
  BoardPersisted,
  BoardPoint,
  ClassRoster,
  CompassPose,
  LineKind,
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
import BoardPointsLayer from "./BoardPointsLayer";
import { snapBoardPoint } from "../lib/board-geometry-snap";
import WidgetWindow from "./WidgetWindow";
import { RulerOverlay, ProtractorOverlay } from "./GeometryOverlays";
import CompassOverlay from "./CompassOverlay";
import MathSelectOverlay from "./MathSelectOverlay";
import MathRecognizePanel from "./MathRecognizePanel";
import MathCardOverlay from "./MathCardOverlay";
import BoardImageOverlay from "./BoardImageOverlay";
import { strokeIndicesInRect, type BoardRect } from "../lib/board-stroke-bounds";
import {
  blobToImageBlob,
  clampPlacement,
  clipboardItemToBlob,
  defaultPlacementSize,
  fileToImageBlob,
} from "../lib/board-image";
import {
  deleteImage,
  getImage,
  pruneImages,
  putImage,
} from "../lib/board-image-store";
import { strokesToMathImageDataUrl, mathImageDimensions } from "../lib/board-math-image";
import { geometryResultToBoard } from "../lib/geometry-recognize-to-board";
import GeometryPerfectPanel from "./GeometryPerfectPanel";
import type { GeometryApplyPayload } from "./geometry-types";
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
import Solid3DWidget from "./widgets/Solid3DWidget";

const DEFAULT_STORAGE_KEY = "pm-board-v1";
const MAX_HISTORY = 60;
const MAX_SAVED_STROKES = 500;

type SketchSnapshot = { strokes: Stroke[]; boardPoints: BoardPoint[] };

type DrawState = {
  strokes: Stroke[];
  boardPoints: BoardPoint[];
  past: SketchSnapshot[];
  future: SketchSnapshot[];
};

type DrawAction =
  | { type: "commit"; stroke: Stroke }
  | { type: "addPoint"; point: BoardPoint }
  | { type: "deleteIndices"; indices: number[] }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "clear" }
  | { type: "load"; strokes: Stroke[]; boardPoints?: BoardPoint[] };

function snapshot(state: DrawState): SketchSnapshot {
  return { strokes: state.strokes, boardPoints: state.boardPoints };
}

function drawReducer(state: DrawState, action: DrawAction): DrawState {
  switch (action.type) {
    case "commit":
      return {
        strokes: [...state.strokes, action.stroke],
        boardPoints: state.boardPoints,
        past: [...state.past.slice(-(MAX_HISTORY - 1)), snapshot(state)],
        future: [],
      };
    case "addPoint":
      return {
        strokes: state.strokes,
        boardPoints: [...state.boardPoints, action.point],
        past: [...state.past.slice(-(MAX_HISTORY - 1)), snapshot(state)],
        future: [],
      };
    case "deleteIndices": {
      if (action.indices.length === 0) return state;
      const remove = new Set(action.indices);
      const strokes = state.strokes.filter((_, i) => !remove.has(i));
      return {
        strokes,
        boardPoints: state.boardPoints,
        past: [...state.past.slice(-(MAX_HISTORY - 1)), snapshot(state)],
        future: [],
      };
    }
    case "undo": {
      if (state.past.length === 0) return state;
      const past = [...state.past];
      const prev = past.pop()!;
      return {
        strokes: prev.strokes,
        boardPoints: prev.boardPoints,
        past,
        future: [snapshot(state), ...state.future],
      };
    }
    case "redo": {
      if (state.future.length === 0) return state;
      const [next, ...future] = state.future;
      return {
        strokes: next.strokes,
        boardPoints: next.boardPoints,
        past: [...state.past, snapshot(state)],
        future,
      };
    }
    case "clear":
      if (state.strokes.length === 0 && state.boardPoints.length === 0)
        return state;
      return {
        strokes: [],
        boardPoints: [],
        past: [...state.past.slice(-(MAX_HISTORY - 1)), snapshot(state)],
        future: [],
      };
    case "load":
      return {
        strokes: action.strokes,
        boardPoints: action.boardPoints ?? [],
        past: [],
        future: [],
      };
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

export type { BoardBrand, BoardAppProps } from "./types";

export default function BoardApp({
  brand,
  storageKey = DEFAULT_STORAGE_KEY,
  apiBase = "",
  getApiAuthHeaders,
  rosters,
  isTeacher = false,
}: BoardAppProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [background, setBackground] = useState<BackgroundId>("chalkboard");
  const [tool, setTool] = useState<ToolId>("pen");
  const [color, setColor] = useState("#ffffff");
  const [size, setSize] = useState(6);
  const [eraserSize, setEraserSize] = useState(6);
  const [pointSize, setPointSize] = useState(4);
  const [lineKind, setLineKind] = useState<LineKind>("segment");
  const [draw, dispatchDraw] = useReducer(drawReducer, {
    strokes: [],
    boardPoints: [],
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
  const [boardImages, setBoardImages] = useState<BoardImage[]>([]);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [recognizeSession, setRecognizeSession] = useState<{
    rect: BoardRect;
    indices: number[];
    imageDataUrl: string;
  } | null>(null);
  const [geometrySession, setGeometrySession] = useState<{
    rect: BoardRect;
    indices: number[];
    imageDataUrl: string;
    imageContext: { width: number; height: number };
  } | null>(null);
  const spawnCountRef = useRef(0);
  const lastPointerRef = useRef({
    x: typeof window !== "undefined" ? window.innerWidth / 2 : 400,
    y: typeof window !== "undefined" ? window.innerHeight / 2 : 300,
  });
  const imageUrlsRef = useRef<Record<string, string>>({});

  useEffect(() => {
    imageUrlsRef.current = imageUrls;
  }, [imageUrls]);

  // ── Load persisted state (async to avoid a sync setState-in-effect) ──
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          const saved = JSON.parse(raw) as Partial<BoardPersisted>;
          if (saved.background) setBackground(saved.background);
          if (saved.color) setColor(saved.color);
          if (saved.size) setSize(saved.size);
          if (typeof saved.eraserSize === "number") setEraserSize(saved.eraserSize);
          if (typeof saved.pointSize === "number") setPointSize(saved.pointSize);
          if (saved.lineKind) setLineKind(saved.lineKind);
          if (Array.isArray(saved.strokes)) {
            dispatchDraw({
              type: "load",
              strokes: saved.strokes,
              boardPoints: Array.isArray(saved.boardPoints)
                ? saved.boardPoints
                : [],
            });
          }
          if (Array.isArray(saved.widgets)) setWidgets(saved.widgets);
          if (Array.isArray(saved.mathCards)) {
            setMathCards(
              saved.mathCards.map((c) => ({
                ...c,
                kind: c.kind ?? "display",
                showGraph: c.showGraph ?? true,
                showSolution: c.showSolution ?? false,
                zIndex: c.zIndex ?? 1,
                graphSettings: c.graphSettings,
              })),
            );
          }
          if (Array.isArray(saved.boardImages)) {
            const imgs = saved.boardImages.map((i) => ({
              ...i,
              zIndex: i.zIndex ?? 1,
              naturalW: i.naturalW ?? i.w,
              naturalH: i.naturalH ?? i.h,
            }));
            setBoardImages(imgs);
            void (async () => {
              const urls: Record<string, string> = {};
              for (const img of imgs) {
                try {
                  const blob = await getImage(img.id);
                  if (blob) urls[img.id] = URL.createObjectURL(blob);
                } catch {
                  // skip missing blob
                }
              }
              setImageUrls(urls);
            })();
          }
          if (saved.overlays) {
            const compassRaw = saved.overlays.compass as CompassPose | null | undefined;
            setOverlays({
              ruler: saved.overlays.ruler
                ? {
                    x: saved.overlays.ruler.x,
                    y: saved.overlays.ruler.y,
                    angle: saved.overlays.ruler.angle ?? 0,
                    length:
                      typeof saved.overlays.ruler.length === "number"
                        ? saved.overlays.ruler.length
                        : undefined,
                  }
                : null,
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
  }, [storageKey]);

  // ── Save (debounced) ─────────────────────────────────────────────
  useEffect(() => {
    if (!ready) return;
    const id = setTimeout(() => {
      const data: BoardPersisted = {
        background,
        color,
        size,
        eraserSize,
        pointSize,
        lineKind,
        strokes: draw.strokes.slice(-MAX_SAVED_STROKES),
        boardPoints: draw.boardPoints,
        widgets,
        overlays,
        mathCards,
        boardImages,
      };
      try {
        localStorage.setItem(storageKey, JSON.stringify(data));
        void pruneImages(boardImages.map((i) => i.id));
      } catch {
        // Storage full: silently skip.
      }
    }, 400);
    return () => clearTimeout(id);
  }, [ready, background, color, size, eraserSize, pointSize, lineKind, draw.strokes, draw.boardPoints, widgets, overlays, mathCards, boardImages, storageKey]);

  useEffect(() => {
    return () => {
      for (const url of Object.values(imageUrlsRef.current)) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

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
      if (e.key === "Escape" && boardMode === "geometry-select") {
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
    setGeometrySession(null);
  }, []);

  const toggleGeometrySelect = useCallback(() => {
    setBoardMode((m) => (m === "geometry-select" ? "draw" : "geometry-select"));
    setRecognizeSession(null);
    setGeometrySession(null);
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

  const onGeometrySelectComplete = useCallback(
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
      const dims = mathImageDimensions(rect);
      setGeometrySession({
        rect,
        indices,
        imageDataUrl,
        imageContext: { width: dims.w, height: dims.h },
      });
    },
    [draw.strokes, background],
  );

  const applyGeometryRecognize = useCallback(
    (payload: GeometryApplyPayload) => {
      const session = geometrySession;
      if (!session) return;
      const { rect, indices } = session;
      if (indices.length > 0) {
        dispatchDraw({ type: "deleteIndices", indices });
      }
      const { strokes, points, solidState } = geometryResultToBoard({
        result: payload.result,
        rect,
        background,
        color,
        size: Math.max(3, size - 1),
      });
      for (const stroke of strokes) {
        dispatchDraw({ type: "commit", stroke });
      }
      for (const pt of points) {
        dispatchDraw({ type: "addPoint", point: pt });
      }
      if (solidState) {
        addWidget("solid3d", solidState as unknown as Record<string, unknown>);
      }
      setGeometrySession(null);
    },
    [geometrySession, background, color, size, addWidget],
  );

  const applyMathRecognize = useCallback(
    (payload: import("./MathRecognizePanel").MathApplyPayload) => {
      const session = recognizeSession;
      if (!session) return;
      const { rect, indices } = session;
      if (indices.length > 0) {
        dispatchDraw({ type: "deleteIndices", indices });
      }
      const maxZ = Math.max(
        mathCards.reduce((m, c) => Math.max(m, c.zIndex), 0),
        boardImages.reduce((m, i) => Math.max(m, i.zIndex), 0),
      );
      const h =
        payload.showGraph && payload.showSolution
          ? 300
          : payload.showGraph
            ? 220
            : payload.showSolution
              ? 200
              : 120;
      const card: MathCard = {
        id: `math-${Date.now().toString(36)}`,
        x: rect.x0,
        y: rect.y0,
        w: 260,
        h,
        latex: payload.latex,
        expr: payload.expr,
        paramValues: payload.paramValues,
        kind: payload.kind,
        showGraph: payload.showGraph,
        showSolution: payload.showSolution,
        solutionSteps: payload.solutionSteps,
        answerLatex: payload.answerLatex,
        zIndex: maxZ + 1,
      };
      setMathCards((prev) => [...prev, card]);
      setRecognizeSession(null);
    },
    [recognizeSession, mathCards, boardImages],
  );

  const focusMathCard = useCallback((id: string) => {
    setMathCards((prev) => {
      const maxZ = Math.max(
        prev.reduce((m, c) => Math.max(m, c.zIndex), 0),
        boardImages.reduce((m, i) => Math.max(m, i.zIndex), 0),
      );
      return prev.map((c) =>
        c.id === id ? { ...c, zIndex: maxZ + 1 } : c,
      );
    });
  }, [boardImages]);

  const focusBoardImage = useCallback((id: string) => {
    setBoardImages((prev) => {
      const maxZ = Math.max(
        prev.reduce((m, i) => Math.max(m, i.zIndex), 0),
        mathCards.reduce((m, c) => Math.max(m, c.zIndex), 0),
      );
      return prev.map((i) =>
        i.id === id ? { ...i, zIndex: maxZ + 1 } : i,
      );
    });
  }, [mathCards]);

  const removeBoardImage = useCallback((id: string) => {
    setBoardImages((prev) => prev.filter((i) => i.id !== id));
    setImageUrls((prev) => {
      const url = prev[id];
      if (url) URL.revokeObjectURL(url);
      const next = { ...prev };
      delete next[id];
      return next;
    });
    void deleteImage(id);
  }, []);

  const insertBoardImage = useCallback(
    async (
      processed: { blob: Blob; naturalW: number; naturalH: number },
      at?: { x: number; y: number },
    ) => {
      const id = `img-${Date.now().toString(36)}`;
      await putImage(id, processed.blob);
      const { w, h } = defaultPlacementSize(
        processed.naturalW,
        processed.naturalH,
      );
      const ptr = lastPointerRef.current;
      const rawX = at?.x ?? ptr.x - w / 2;
      const rawY = at?.y ?? ptr.y - h / 2;
      const { x, y } = clampPlacement(rawX, rawY, w, h);
      const url = URL.createObjectURL(processed.blob);

      setBoardImages((prev) => {
        const maxZ = Math.max(
          prev.reduce((m, i) => Math.max(m, i.zIndex), 0),
          mathCards.reduce((m, c) => Math.max(m, c.zIndex), 0),
        );
        return [
          ...prev,
          {
            id,
            x,
            y,
            w,
            h,
            zIndex: maxZ + 1,
            naturalW: processed.naturalW,
            naturalH: processed.naturalH,
          },
        ];
      });
      setImageUrls((prev) => ({ ...prev, [id]: url }));
    },
    [mathCards],
  );

  const handlePickImageFile = useCallback(
    async (file: File) => {
      try {
        const processed = await fileToImageBlob(file);
        await insertBoardImage(processed);
      } catch (err) {
        window.alert(
          err instanceof Error ? err.message : "이미지를 넣을 수 없어요.",
        );
      }
    },
    [insertBoardImage],
  );

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (isEditableTarget(e.target)) return;
      if (recognizeSession || geometrySession) return;
      const raw = clipboardItemToBlob(e.clipboardData);
      if (!raw) return;
      e.preventDefault();
      void (async () => {
        try {
          const processed = await blobToImageBlob(raw);
          await insertBoardImage(processed);
        } catch (err) {
          window.alert(
            err instanceof Error ? err.message : "이미지를 붙여넣을 수 없어요.",
          );
        }
      })();
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [insertBoardImage, recognizeSession, geometrySession]);

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
          ...(id === "ruler" ? { length: 600 } : {}),
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
      case "solid3d":
        return <Solid3DWidget state={w.state} setState={setState} />;
    }
  };

  // Drawing tools must reach the canvas through geometry overlays.
  // Cursor mode keeps ruler/protractor/compass interactive.
  const geometryPassThrough =
    boardMode === "math-select" ||
    boardMode === "geometry-select" ||
    tool !== "cursor";

  const snapPointer = useCallback(
    (x: number, y: number, opts?: { skipCompassCenter?: boolean }) => {
      const r = snapBoardPoint(x, y, {
        strokes: draw.strokes,
        points: draw.boardPoints,
        compass: overlays.compass,
        ruler: overlays.ruler,
        skipCompassCenter: opts?.skipCompassCenter,
      });
      return { x: r.x, y: r.y };
    },
    [draw.strokes, draw.boardPoints, overlays.compass, overlays.ruler],
  );

  const placeBoardPoint = useCallback(
    (clientX: number, clientY: number) => {
      const { x, y } = snapPointer(clientX, clientY);
      dispatchDraw({
        type: "addPoint",
        point: {
          id: `pt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          x,
          y,
          r: pointSize,
        },
      });
    },
    [snapPointer, pointSize],
  );

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-[60] overflow-hidden overscroll-none bg-[#2a5142]"
      onPointerMove={(e) => {
        lastPointerRef.current = { x: e.clientX, y: e.clientY };
      }}
    >
      <BoardBackground id={background} />

      {ready ? (
        <>
          <div className="absolute inset-0 z-10">
            <DrawingCanvas
              tool={tool}
              color={color}
              size={size}
              eraserSize={eraserSize}
              lineKind={lineKind}
              strokes={draw.strokes}
              disabled={boardMode === "math-select" || boardMode === "geometry-select"}
              snap={(x, y) => snapPointer(x, y)}
              onCommit={(stroke) => dispatchDraw({ type: "commit", stroke })}
            />
            <BoardPointsLayer
              points={draw.boardPoints}
              color={color}
              defaultRadius={pointSize}
              active={tool === "point" && boardMode === "draw"}
              onPlace={placeBoardPoint}
            />
          </div>

          {boardMode === "math-select" ? (
            <MathSelectOverlay
              onComplete={onMathSelectComplete}
              onCancel={() => setBoardMode("draw")}
            />
          ) : null}

          {boardMode === "geometry-select" ? (
            <MathSelectOverlay
              hintText="도형이 있는 영역을 드래그하세요 · Esc로 취소"
              onComplete={onGeometrySelectComplete}
              onCancel={() => setBoardMode("draw")}
            />
          ) : null}

          {recognizeSession ? (
            <MathRecognizePanel
              imageDataUrl={recognizeSession.imageDataUrl}
              canUseApi={isTeacher}
              isTeacher={isTeacher}
              apiBase={apiBase}
              getApiAuthHeaders={getApiAuthHeaders}
              onApply={applyMathRecognize}
              onCancel={() => setRecognizeSession(null)}
            />
          ) : null}

          {geometrySession ? (
            <GeometryPerfectPanel
              imageDataUrl={geometrySession.imageDataUrl}
              imageContext={geometrySession.imageContext}
              canUseApi={isTeacher}
              apiBase={apiBase}
              getApiAuthHeaders={getApiAuthHeaders}
              onApply={applyGeometryRecognize}
              onCancel={() => setGeometrySession(null)}
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
                nonInteractive={geometryPassThrough}
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
                nonInteractive={geometryPassThrough}
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
                nonInteractive={geometryPassThrough}
                color={color}
                size={size}
                snap={(x, y) =>
                  snapPointer(x, y, { skipCompassCenter: true })
                }
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
            {boardImages.map((img) => {
              const src = imageUrls[img.id];
              if (!src) return null;
              return (
                <BoardImageOverlay
                  key={img.id}
                  image={img}
                  src={src}
                  onChange={(next) =>
                    setBoardImages((prev) =>
                      prev.map((i) => (i.id === img.id ? next : i)),
                    )
                  }
                  onClose={() => removeBoardImage(img.id)}
                  onFocus={() => focusBoardImage(img.id)}
                />
              );
            })}
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
                onFocus={() => focusMathCard(card.id)}
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
            pointSize={pointSize}
            setPointSize={setPointSize}
            eraserSize={eraserSize}
            setEraserSize={setEraserSize}
            lineKind={lineKind}
            setLineKind={setLineKind}
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
            geometrySelectActive={boardMode === "geometry-select"}
            onToggleGeometrySelect={toggleGeometrySelect}
            isFullscreen={isFullscreen}
            onToggleFullscreen={toggleFullscreen}
            onPickImageFile={handlePickImageFile}
            brand={brand}
          />
        </>
      ) : null}
    </div>
  );
}
