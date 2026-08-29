"use client";

import { Noto_Serif, Noto_Serif_KR } from "next/font/google";
import Link from "next/link";
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import {
  ChipToggle,
  InlineNumber,
  InlineText,
  NumberField,
  Segmented,
  SliderField,
  TextField,
} from "@/components/tools/figures/controls";
import CoordinatePlaneCanvas, {
  type CoordPlaneSetter,
} from "@/components/tools/figures/coordinate-plane/CoordinatePlaneCanvas";
import {
  canvasToPngBlob,
  copyPngToClipboard,
  downloadBlob,
} from "@/lib/diagrams/export-image";
import {
  addDirectGraph,
  addInverseGraph,
  addPointAt,
  addPolylineGraph,
  appendPolylineVertex,
  cloneState,
  COORD_PLANE_PRESETS,
  DEFAULT_COORD_PLANE_STATE,
  GRAPH_CYAN,
  GRAPH_INK,
  GRAPH_PINK,
  GRID_COLOR,
  GRID_GRAY,
  graphEquationText,
  graphTitle,
  insertPolylineVertexAfter,
  nextPointName,
  normalizeState,
  removePolylineVertex,
  setPolylineVertex,
  type CoordPlaneState,
  type CoordPoint,
  type GraphLabelMode,
  type PlaneGraph,
} from "@/lib/diagrams/coordinate-plane/model";
import { buildCoordPlaneScene } from "@/lib/diagrams/coordinate-plane/scene";
import { renderSceneToCanvas, sceneToSvg } from "@/lib/diagrams/render";
import type { FontFaces } from "@/lib/diagrams/math-label";

const STORAGE_KEY = "pm-diagram-g1-coordinate-plane-v2";

const storeListeners = new Set<() => void>();

let cachedRaw: string | null = null;
let cachedState: CoordPlaneState = DEFAULT_COORD_PLANE_STATE;
let cacheReady = false;

function parseStoredState(raw: string | null): CoordPlaneState {
  if (!raw) return DEFAULT_COORD_PLANE_STATE;
  try {
    const parsed = JSON.parse(raw) as CoordPlaneState;
    if (
      parsed &&
      Array.isArray(parsed.points) &&
      Array.isArray(parsed.graphs) &&
      typeof parsed.xMin === "number"
    ) {
      return normalizeState(parsed);
    }
  } catch {
    /* keep default */
  }
  return DEFAULT_COORD_PLANE_STATE;
}

function getServerSnapshot(): CoordPlaneState {
  return DEFAULT_COORD_PLANE_STATE;
}

function getClientSnapshot(): CoordPlaneState {
  if (!cacheReady) {
    cacheReady = true;
    cachedRaw = window.localStorage.getItem(STORAGE_KEY);
    cachedState = parseStoredState(cachedRaw);
  }
  return cachedState;
}

function writeStoredState(state: CoordPlaneState, persist = true) {
  cachedState = state;
  cacheReady = true;
  if (persist) {
    cachedRaw = JSON.stringify(state);
    try {
      window.localStorage.setItem(STORAGE_KEY, cachedRaw);
    } catch {
      /* ignore quota */
    }
  }
  storeListeners.forEach((listener) => listener());
}

function persistCachedState() {
  cachedRaw = JSON.stringify(cachedState);
  try {
    window.localStorage.setItem(STORAGE_KEY, cachedRaw);
  } catch {
    /* ignore quota */
  }
}

function subscribeStoredState(onChange: () => void) {
  storeListeners.add(onChange);
  return () => {
    storeListeners.delete(onChange);
  };
}

function useCoordPlaneState() {
  const state = useSyncExternalStore(
    subscribeStoredState,
    getClientSnapshot,
    getServerSnapshot,
  );
  const setState = useCallback<CoordPlaneSetter>((updater, persist = true) => {
    const prev = getClientSnapshot();
    const next = typeof updater === "function" ? updater(prev) : updater;
    if (Object.is(next, prev)) {
      if (persist) persistCachedState();
      return;
    }
    writeStoredState(normalizeState(next), persist);
  }, []);
  return [state, setState] as const;
}

const notoSerif = Noto_Serif({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  variable: "--font-diagram-math",
  display: "swap",
});

const notoSerifKr = Noto_Serif_KR({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-diagram-kr",
  display: "swap",
});

function fontsFromNext(): FontFaces {
  return {
    math: notoSerif.style.fontFamily,
    korean: notoSerifKr.style.fontFamily,
  };
}

const COLORS = [
  { id: GRAPH_PINK, label: "분홍" },
  { id: GRAPH_CYAN, label: "청록" },
  { id: GRAPH_INK, label: "검정" },
];

export default function CoordinatePlaneStudio() {
  const [state, setState] = useCoordPlaneState();
  const [status, setStatus] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(
    () => state.points[0]?.id ?? state.graphs[0]?.id ?? null,
  );
  const [newName, setNewName] = useState("");
  const [newX, setNewX] = useState("3");
  const [newY, setNewY] = useState("2");
  const [addError, setAddError] = useState<string | null>(null);
  const [placingVertices, setPlacingVertices] = useState(false);
  const [styleOpen, setStyleOpen] = useState(true);
  const fonts = useMemo(() => fontsFromNext(), []);

  const selectedPoint =
    state.points.find((p) => p.id === selectedId) ?? null;
  const selectedGraph =
    state.graphs.find((g) => g.id === selectedId) ?? null;

  const set = useCallback(
    (patch: Partial<CoordPlaneState>) => {
      setState((prev) => normalizeState({ ...prev, ...patch }));
    },
    [setState],
  );

  const patchSelectedPoint = useCallback(
    (patch: Partial<CoordPoint>) => {
      if (!selectedPoint) return;
      setState((prev) => ({
        ...prev,
        points: prev.points.map((p) =>
          p.id === selectedPoint.id ? { ...p, ...patch } : p,
        ),
      }));
    },
    [selectedPoint, setState],
  );

  const patchSelectedGraph = useCallback(
    (patch: Partial<PlaneGraph>) => {
      if (!selectedGraph) return;
      setState((prev) => ({
        ...prev,
        graphs: prev.graphs.map((g) =>
          g.id === selectedGraph.id ? ({ ...g, ...patch } as PlaneGraph) : g,
        ),
      }));
    },
    [selectedGraph, setState],
  );

  const deleteSelected = useCallback(() => {
    const id = selectedId;
    if (!id) return;
    setState((prev) => ({
      ...prev,
      points: prev.points.filter((p) => p.id !== id),
      graphs: prev.graphs.filter((g) => g.id !== id),
    }));
    setSelectedId((cur) => {
      if (cur !== id) return cur;
      const remaining = [
        ...state.points.filter((p) => p.id !== id),
        ...state.graphs.filter((g) => g.id !== id),
      ];
      return remaining[0]?.id ?? null;
    });
  }, [selectedId, state.points, state.graphs, setState]);

  async function exportPng() {
    await document.fonts.ready;
    const scene = buildCoordPlaneScene(state);
    const canvas = renderSceneToCanvas(
      scene,
      fonts,
      state.style.lineWidth,
      state.style.exportScale,
    );
    const blob = await canvasToPngBlob(canvas);
    downloadBlob(blob, "좌표평면.png");
    setStatus("PNG를 저장했어요.");
  }

  async function copyPng() {
    await document.fonts.ready;
    const scene = buildCoordPlaneScene(state);
    const canvas = renderSceneToCanvas(
      scene,
      fonts,
      state.style.lineWidth,
      state.style.exportScale,
    );
    const blob = await canvasToPngBlob(canvas);
    await copyPngToClipboard(blob);
    setStatus("클립보드에 그림을 복사했어요. 한글·워드에 붙여넣기 하세요.");
  }

  function exportSvg() {
    const scene = buildCoordPlaneScene(state);
    const svg = sceneToSvg(scene, fonts, state.style.lineWidth);
    downloadBlob(
      new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
      "좌표평면.svg",
    );
    setStatus("SVG를 저장했어요.");
  }

  function addPoint() {
    const x = Number(newX);
    const y = Number(newY);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      setAddError("좌표는 숫자로 넣어 주세요.");
      return;
    }
    if (
      x < state.xMin - 1e-9 ||
      x > state.xMax + 1e-9 ||
      y < state.yMin - 1e-9 ||
      y > state.yMax + 1e-9
    ) {
      setAddError("점이 좌표 범위 밖에 있어요.");
      return;
    }
    setAddError(null);
    const next = addPointAt(state, x, y);
    const added = next.points[next.points.length - 1];
    if (added && newName.trim()) {
      added.name = newName.trim();
    } else if (added) {
      added.name = nextPointName(state.points);
    }
    setState(next);
    if (added) setSelectedId(added.id);
    setNewName("");
  }

  const eqPreview = selectedGraph ? graphEquationText(selectedGraph) : null;

  return (
    <div className={`${notoSerif.variable} ${notoSerifKr.variable} space-y-4`}>
      <span
        className={`${notoSerif.className} ${notoSerifKr.className} sr-only italic`}
        style={{ fontFamily: '"Times New Roman", serif' }}
        aria-hidden
      >
        xy O A y=ax 24/x 높이 시간
      </span>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-wood">
            <Link href="/tools/figures?grade=1" className="hover:underline">
              문제 그림 그리기
            </Link>
            <span className="mx-1.5 text-foreground/30">/</span>
            중1
          </p>
          <h1 className="font-display mt-1 text-3xl text-wood-dark sm:text-4xl">
            좌표평면
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-foreground/65">
            범위와 축 이름을 정하고, 점·정비례·반비례를 올리세요. 그래프는
            숫자로 그리고, 식 표시만 <span className="italic">y=a/x</span>처럼
            바꿀 수 있어요. 칸을 눌러 점을 넣고, 꺾은선은 꼭짓점을 원하는
            만큼 추가·삭제할 수 있어요.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void exportPng()}
            className="font-display rounded-xl bg-wood px-4 py-2.5 text-sm text-cream shadow-[0_3px_0_rgba(90,58,34,0.35)] transition hover:brightness-105"
          >
            PNG 저장
          </button>
          <button
            type="button"
            onClick={() =>
              void copyPng().catch(() =>
                setStatus("복사에 실패했어요. PNG 저장을 이용해 주세요."),
              )
            }
            className="font-display rounded-xl bg-gold px-4 py-2.5 text-sm text-[#6b4a00] shadow-[0_3px_0_rgba(107,74,0,0.3)]"
          >
            복사
          </button>
          <button
            type="button"
            onClick={exportSvg}
            className="font-display rounded-xl bg-black/10 px-4 py-2.5 text-sm text-wood-dark"
          >
            SVG
          </button>
        </div>
      </header>

      {status ? (
        <p className="rounded-xl bg-mint/30 px-3 py-2 text-sm text-wood-dark">
          {status}
        </p>
      ) : null}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(15rem,1fr)_minmax(15rem,1fr)]">
        <div className="overflow-hidden rounded-3xl border-2 border-wood/10 bg-white shadow-[0_12px_40px_rgba(61,44,30,0.08)]">
          <CoordinatePlaneCanvas
            state={state}
            fonts={fonts}
            selectedId={selectedId}
            placingVertices={
              placingVertices && selectedGraph?.t === "polyline"
            }
            setState={setState}
            persist={persistCachedState}
            onSelect={setSelectedId}
            onDeleteSelected={deleteSelected}
          />
        </div>

        <div className="space-y-4">
          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <h2 className="font-display text-sm text-wood-dark">빠른 그림</h2>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {COORD_PLANE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    const next = cloneState(preset.state);
                    setState(next);
                    setSelectedId(
                      next.points[0]?.id ?? next.graphs[0]?.id ?? null,
                    );
                    setPlacingVertices(false);
                  }}
                  className="rounded-xl bg-black/5 px-2.5 py-2 text-left text-xs font-semibold text-foreground/70 hover:bg-black/10"
                >
                  {preset.title}
                  <span className="mt-0.5 block font-normal text-foreground/45">
                    {preset.hint}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-sm text-wood-dark">좌표평면</h2>
              <ChipToggle
                on={state.xMin >= -1e-9 && state.yMin >= -1e-9}
                onClick={() => {
                  const first = state.xMin >= -1e-9 && state.yMin >= -1e-9;
                  if (first) {
                    set({
                      xMin: -Math.abs(state.xMax),
                      yMin: -Math.abs(state.yMax),
                    });
                  } else {
                    set({ xMin: 0, yMin: 0 });
                  }
                }}
              >
                1사분면
              </ChipToggle>
            </div>
            <div className="mt-3 space-y-1.5 text-xs font-semibold text-foreground/55">
              <div className="flex items-center gap-1.5">
                <span className="w-7 shrink-0 text-wood-dark">x축</span>
                <span>시작</span>
                <InlineNumber
                  ariaLabel="x 시작"
                  value={state.xMin}
                  onChange={(xMin) => set({ xMin })}
                  className="min-w-0 flex-1"
                />
                <span>끝</span>
                <InlineNumber
                  ariaLabel="x 끝"
                  value={state.xMax}
                  onChange={(xMax) => set({ xMax })}
                  className="min-w-0 flex-1"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-7 shrink-0 text-wood-dark">y축</span>
                <span>시작</span>
                <InlineNumber
                  ariaLabel="y 시작"
                  value={state.yMin}
                  onChange={(yMin) => set({ yMin })}
                  className="min-w-0 flex-1"
                />
                <span>끝</span>
                <InlineNumber
                  ariaLabel="y 끝"
                  value={state.yMax}
                  onChange={(yMax) => set({ yMax })}
                  className="min-w-0 flex-1"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-7 shrink-0 text-wood-dark">간격</span>
                <span>x</span>
                <InlineNumber
                  ariaLabel="x 간격"
                  value={state.xTick}
                  onChange={(xTick) => set({ xTick })}
                  min={0.25}
                  max={20}
                  step={0.25}
                  className="min-w-0 flex-1"
                />
                <span>y</span>
                <InlineNumber
                  ariaLabel="y 간격"
                  value={state.yTick}
                  onChange={(yTick) => set({ yTick })}
                  min={0.25}
                  max={20}
                  step={0.25}
                  className="min-w-0 flex-1"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-7 shrink-0 text-wood-dark">숫자</span>
                <span>x</span>
                <InlineNumber
                  ariaLabel="x 숫자 몇 칸마다"
                  value={state.xLabelEvery}
                  onChange={(xLabelEvery) => set({ xLabelEvery })}
                  min={1}
                  max={10}
                  step={1}
                  className="min-w-0 flex-1"
                />
                <span>y</span>
                <InlineNumber
                  ariaLabel="y 숫자 몇 칸마다"
                  value={state.yLabelEvery}
                  onChange={(yLabelEvery) => set({ yLabelEvery })}
                  min={1}
                  max={10}
                  step={1}
                  className="min-w-0 flex-1"
                />
                <span className="shrink-0 font-normal text-foreground/45">
                  칸마다
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-7 shrink-0 text-wood-dark">이름</span>
                <span>x</span>
                <InlineText
                  ariaLabel="x축 이름"
                  value={state.xAxisLabel}
                  onChange={(xAxisLabel) => set({ xAxisLabel })}
                  placeholder="$x$"
                />
                <span>y</span>
                <InlineText
                  ariaLabel="y축 이름"
                  value={state.yAxisLabel}
                  onChange={(yAxisLabel) => set({ yAxisLabel })}
                  placeholder="$y$"
                />
                <span>O</span>
                <InlineText
                  ariaLabel="원점 이름"
                  value={state.originLabel}
                  onChange={(originLabel) => set({ originLabel })}
                  placeholder="O"
                  className="w-12 shrink-0"
                />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <ChipToggle
                on={state.showGrid}
                onClick={() => set({ showGrid: !state.showGrid })}
              >
                격자
              </ChipToggle>
              {state.showGrid ? (
                <>
                  <ChipToggle
                    on={state.style.gridColor === GRID_COLOR}
                    onClick={() =>
                      set({
                        style: { ...state.style, gridColor: GRID_COLOR },
                      })
                    }
                  >
                    청록
                  </ChipToggle>
                  <ChipToggle
                    on={state.style.gridColor === GRID_GRAY}
                    onClick={() =>
                      set({
                        style: { ...state.style, gridColor: GRID_GRAY },
                      })
                    }
                  >
                    회색
                  </ChipToggle>
                </>
              ) : null}
              <ChipToggle
                on={state.showOrigin}
                onClick={() => set({ showOrigin: !state.showOrigin })}
              >
                원점
              </ChipToggle>
              <ChipToggle
                on={state.showArrows}
                onClick={() => set({ showArrows: !state.showArrows })}
              >
                화살표
              </ChipToggle>
              <ChipToggle
                on={state.showTickLabels}
                onClick={() => set({ showTickLabels: !state.showTickLabels })}
              >
                눈금 숫자
              </ChipToggle>
              <ChipToggle
                on={state.showTicks}
                onClick={() => set({ showTicks: !state.showTicks })}
              >
                눈금
              </ChipToggle>
              <ChipToggle
                on={state.yLabelVertical}
                onClick={() => set({ yLabelVertical: !state.yLabelVertical })}
              >
                y 세로
              </ChipToggle>
              <ChipToggle
                on={state.yBreak}
                onClick={() => set({ yBreak: !state.yBreak })}
              >
                y 끊기
              </ChipToggle>
            </div>
            {state.yBreak ? (
              <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-foreground/55">
                <span>끊은 뒤</span>
                <InlineNumber
                  ariaLabel="끊은 뒤 첫 값"
                  value={state.yBreakTo}
                  onChange={(yBreakTo) => set({ yBreakTo })}
                  className="w-16"
                />
              </div>
            ) : null}
            <div className="mt-2.5">
              <SliderField
                label="그림 여백"
                value={state.style.padding}
                onChange={(padding) =>
                  set({ style: { ...state.style, padding } })
                }
                min={48}
                max={96}
                step={2}
                display={`${state.style.padding}px`}
              />
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-sm text-wood-dark">
                {selectedPoint ? `점 ${selectedPoint.name}` : "점"}
              </h2>
              {selectedPoint ? (
                <button
                  type="button"
                  onClick={deleteSelected}
                  className="rounded-lg bg-black/5 px-2.5 py-1 text-xs font-semibold text-foreground/70 hover:bg-black/10"
                >
                  삭제
                </button>
              ) : null}
            </div>
            <div className="mt-2.5 grid grid-cols-[4.5rem_1fr_1fr_auto] items-end gap-1.5">
              <TextField
                label="이름"
                value={newName}
                onChange={setNewName}
                placeholder={nextPointName(state.points)}
              />
              <TextField
                label="x"
                value={newX}
                onChange={(v) => {
                  setNewX(v);
                  setAddError(null);
                }}
              />
              <TextField
                label="y"
                value={newY}
                onChange={(v) => {
                  setNewY(v);
                  setAddError(null);
                }}
              />
              <button
                type="button"
                onClick={addPoint}
                className="rounded-xl bg-wood px-3 py-2 text-xs font-semibold text-cream"
              >
                추가
              </button>
            </div>
            {addError ? (
              <p className="mt-1.5 text-[11px] text-red-700">{addError}</p>
            ) : (
              <p className="mt-1.5 text-[11px] text-foreground/45">
                그림 칸을 눌러도 점이 생겨요.
              </p>
            )}
            {selectedPoint ? (
              <div className="mt-3 space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <TextField
                    label="이름"
                    value={selectedPoint.name}
                    onChange={(name) => patchSelectedPoint({ name })}
                  />
                  <NumberField
                    label="x"
                    value={selectedPoint.x}
                    onChange={(x) => patchSelectedPoint({ x })}
                    step={state.xTick}
                  />
                  <NumberField
                    label="y"
                    value={selectedPoint.y}
                    onChange={(y) => patchSelectedPoint({ y })}
                    step={state.yTick}
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <ChipToggle
                    on={selectedPoint.showDot}
                    onClick={() =>
                      patchSelectedPoint({ showDot: !selectedPoint.showDot })
                    }
                  >
                    점 ●
                  </ChipToggle>
                  <ChipToggle
                    on={selectedPoint.showName}
                    onClick={() =>
                      patchSelectedPoint({
                        showName: !selectedPoint.showName,
                      })
                    }
                  >
                    이름
                  </ChipToggle>
                  <ChipToggle
                    on={selectedPoint.dropX}
                    onClick={() =>
                      patchSelectedPoint({ dropX: !selectedPoint.dropX })
                    }
                  >
                    x축 수선
                  </ChipToggle>
                  <ChipToggle
                    on={selectedPoint.dropY}
                    onClick={() =>
                      patchSelectedPoint({ dropY: !selectedPoint.dropY })
                    }
                  >
                    y축 수선
                  </ChipToggle>
                  <ChipToggle
                    on={selectedPoint.axisMarkX}
                    onClick={() =>
                      patchSelectedPoint({
                        axisMarkX: !selectedPoint.axisMarkX,
                      })
                    }
                  >
                    x값 표시
                  </ChipToggle>
                  <ChipToggle
                    on={selectedPoint.axisMarkY}
                    onClick={() =>
                      patchSelectedPoint({
                        axisMarkY: !selectedPoint.axisMarkY,
                      })
                    }
                  >
                    y값 표시
                  </ChipToggle>
                </div>
              </div>
            ) : null}
            {state.points.length > 0 ? (
              <ul className="mt-3 space-y-1">
                {state.points.map((point) => (
                  <li key={point.id} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedId(point.id)}
                      className={`flex-1 rounded-lg px-2 py-1 text-left text-xs font-semibold ${
                        point.id === selectedPoint?.id
                          ? "bg-wood/15 text-wood-dark"
                          : "text-foreground/55 hover:bg-black/5"
                      }`}
                    >
                      {point.name}
                      <span className="ml-1 font-normal text-foreground/45">
                        ({point.x}, {point.y})
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setState((prev) => ({
                          ...prev,
                          points: prev.points.filter((p) => p.id !== point.id),
                        }));
                        if (selectedId === point.id) {
                          setSelectedId(
                            state.points.find((p) => p.id !== point.id)?.id ??
                              state.graphs[0]?.id ??
                              null,
                          );
                        }
                      }}
                      className="text-xs font-semibold text-foreground/40 hover:text-foreground"
                    >
                      지우기
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <h2 className="font-display text-sm text-wood-dark">그래프</h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => {
                  const next = addDirectGraph(state);
                  setState(next);
                  const added = next.graphs[next.graphs.length - 1];
                  if (added) setSelectedId(added.id);
                }}
                className="rounded-xl bg-black/5 px-2.5 py-1.5 text-xs font-semibold text-foreground/70 hover:bg-black/10"
              >
                정비례 y=ax
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = addInverseGraph(state);
                  setState(next);
                  const added = next.graphs[next.graphs.length - 1];
                  if (added) setSelectedId(added.id);
                }}
                className="rounded-xl bg-black/5 px-2.5 py-1.5 text-xs font-semibold text-foreground/70 hover:bg-black/10"
              >
                반비례 y=a/x
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = addPolylineGraph(state);
                  setState(next);
                  const added = next.graphs[next.graphs.length - 1];
                  if (added) setSelectedId(added.id);
                  setPlacingVertices(true);
                }}
                className="rounded-xl bg-black/5 px-2.5 py-1.5 text-xs font-semibold text-foreground/70 hover:bg-black/10"
              >
                꺾은선
              </button>
            </div>

            {selectedGraph ? (
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-wood-dark">
                    {graphTitle(selectedGraph)}
                  </p>
                  <button
                    type="button"
                    onClick={deleteSelected}
                    className="rounded-lg bg-black/5 px-2.5 py-1 text-xs font-semibold text-foreground/70 hover:bg-black/10"
                  >
                    삭제
                  </button>
                </div>
                {selectedGraph.t === "direct" || selectedGraph.t === "inverse" ? (
                  <NumberField
                    label={selectedGraph.t === "direct" ? "기울기 a" : "상수 a"}
                    value={selectedGraph.a}
                    onChange={(a) => patchSelectedGraph({ a })}
                    step={0.5}
                  />
                ) : null}
                {selectedGraph.t === "inverse" ? (
                  <ChipToggle
                    on={selectedGraph.bothBranches}
                    onClick={() =>
                      patchSelectedGraph({
                        bothBranches: !selectedGraph.bothBranches,
                      })
                    }
                  >
                    1·3사분면
                  </ChipToggle>
                ) : null}
                {selectedGraph.t === "polyline" ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      <ChipToggle
                        on={selectedGraph.rounded}
                        onClick={() =>
                          patchSelectedGraph({
                            rounded: !selectedGraph.rounded,
                          })
                        }
                      >
                        모서리 둥글게
                      </ChipToggle>
                      <ChipToggle
                        on={placingVertices}
                        onClick={() => setPlacingVertices((v) => !v)}
                      >
                        그림에서 찍기
                      </ChipToggle>
                    </div>
                    <p className="text-[11px] text-foreground/45">
                      {placingVertices
                        ? "가까운 선분 사이를 누르면 꺾이는 점이 생기고, 끝 밖을 누르면 이어 붙습니다."
                        : "좌표를 고치거나, 이 뒤에 넣기·끝에 추가로 꺾이는 점을 늘리세요."}
                    </p>
                    <ul className="space-y-2">
                      {selectedGraph.vertices.map((vertex, index) => (
                        <li
                          key={`${selectedGraph.id}-${index}`}
                          className="rounded-xl bg-black/[0.03] p-2"
                        >
                          <div className="flex items-end gap-1.5">
                            <span className="mb-2 w-4 shrink-0 text-[11px] font-semibold text-foreground/45">
                              {index + 1}
                            </span>
                            <NumberField
                              label="x"
                              value={vertex.x}
                              onChange={(x) =>
                                setState((prev) =>
                                  setPolylineVertex(
                                    prev,
                                    selectedGraph.id,
                                    index,
                                    { x },
                                  ),
                                )
                              }
                              step={state.xTick / 2}
                            />
                            <NumberField
                              label="y"
                              value={vertex.y}
                              onChange={(y) =>
                                setState((prev) =>
                                  setPolylineVertex(
                                    prev,
                                    selectedGraph.id,
                                    index,
                                    { y },
                                  ),
                                )
                              }
                              step={state.yTick / 2}
                            />
                          </div>
                          <div className="mt-1.5 flex justify-end gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                setState((prev) =>
                                  insertPolylineVertexAfter(
                                    prev,
                                    selectedGraph.id,
                                    index,
                                  ),
                                )
                              }
                              className="rounded-lg px-2 py-1 text-[11px] font-semibold text-wood-dark/70 hover:bg-wood/10"
                            >
                              이 뒤에 넣기
                            </button>
                            <button
                              type="button"
                              disabled={selectedGraph.vertices.length <= 2}
                              onClick={() =>
                                setState((prev) =>
                                  removePolylineVertex(
                                    prev,
                                    selectedGraph.id,
                                    index,
                                  ),
                                )
                              }
                              className="rounded-lg px-2 py-1 text-[11px] font-semibold text-foreground/45 hover:text-foreground disabled:opacity-30"
                            >
                              지우기
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      onClick={() => {
                        setState((prev) =>
                          appendPolylineVertex(prev, selectedGraph.id),
                        );
                        setPlacingVertices(false);
                      }}
                      className="rounded-xl bg-wood/90 px-3 py-1.5 text-xs font-semibold text-cream"
                    >
                      끝에 꼭짓점 추가
                    </button>
                  </div>
                ) : null}
                <div>
                  <p className="text-[11px] font-semibold text-foreground/50">
                    식 표시
                  </p>
                  <div className="mt-1">
                    <Segmented
                      value={selectedGraph.labelMode}
                      onChange={(labelMode: GraphLabelMode) =>
                        patchSelectedGraph({ labelMode })
                      }
                      options={[
                        { id: "auto", label: "숫자" },
                        { id: "letter", label: "문자" },
                        { id: "custom", label: "직접" },
                        { id: "hide", label: "숨김" },
                      ]}
                    />
                  </div>
                  {selectedGraph.labelMode === "letter" ? (
                    <TextField
                      label="문자"
                      value={selectedGraph.letter}
                      onChange={(letter) => patchSelectedGraph({ letter })}
                      className="mt-2"
                    />
                  ) : null}
                  {selectedGraph.labelMode === "custom" ? (
                    <TextField
                      label="식"
                      value={selectedGraph.custom}
                      onChange={(custom) => patchSelectedGraph({ custom })}
                      placeholder="y=\\frac{24}{x}"
                      className="mt-2"
                    />
                  ) : null}
                  {eqPreview ? (
                    <p className="mt-1.5 text-[11px] text-foreground/45">
                      그림에 {eqPreview}
                    </p>
                  ) : null}
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-foreground/50">
                    색
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {COLORS.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => patchSelectedGraph({ color: c.id })}
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          selectedGraph.color === c.id
                            ? "ring-2 ring-wood/40"
                            : "bg-black/5 text-foreground/60"
                        }`}
                        style={{ color: c.id === GRAPH_INK ? undefined : c.id }}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
                <SliderField
                  label="이 그래프 굵기"
                  value={
                    selectedGraph.width > 0
                      ? selectedGraph.width
                      : state.style.graphWidth
                  }
                  onChange={(width) => patchSelectedGraph({ width })}
                  min={1}
                  max={4}
                  step={0.1}
                  display={(selectedGraph.width > 0
                    ? selectedGraph.width
                    : state.style.graphWidth
                  ).toFixed(1)}
                />
              </div>
            ) : null}

            {state.graphs.length > 0 ? (
              <ul className="mt-3 space-y-1">
                {state.graphs.map((graph) => (
                  <li key={graph.id} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedId(graph.id)}
                      className={`flex-1 rounded-lg px-2 py-1 text-left text-xs font-semibold ${
                        graph.id === selectedGraph?.id
                          ? "bg-wood/15 text-wood-dark"
                          : "text-foreground/55 hover:bg-black/5"
                      }`}
                    >
                      {graphTitle(graph)}
                      <span className="ml-1 font-normal text-foreground/45">
                        {graph.t === "polyline"
                          ? `꼭짓점 ${graph.vertices.length}`
                          : (graphEquationText(graph) ?? "식 숨김")}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setState((prev) => ({
                          ...prev,
                          graphs: prev.graphs.filter((g) => g.id !== graph.id),
                        }));
                        if (selectedId === graph.id) {
                          setSelectedId(
                            state.graphs.find((g) => g.id !== graph.id)?.id ??
                              state.points[0]?.id ??
                              null,
                          );
                        }
                      }}
                      className="text-xs font-semibold text-foreground/40 hover:text-foreground"
                    >
                      지우기
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <button
              type="button"
              onClick={() => setStyleOpen((v) => !v)}
              className="flex w-full items-center justify-between text-left"
            >
              <h2 className="font-display text-sm text-wood-dark">그림 스타일</h2>
              <span className="text-xs text-foreground/45">
                {styleOpen ? "접기" : "펼치기"}
              </span>
            </button>
            {styleOpen ? (
              <div className="mt-3 space-y-3">
                <SliderField
                  label="눈금 글자"
                  value={state.style.fontSize}
                  onChange={(fontSize) =>
                    set({ style: { ...state.style, fontSize } })
                  }
                  min={11}
                  max={28}
                  step={1}
                />
                <SliderField
                  label="점·축 이름"
                  value={state.style.pointLabelSize}
                  onChange={(pointLabelSize) =>
                    set({ style: { ...state.style, pointLabelSize } })
                  }
                  min={14}
                  max={36}
                  step={1}
                />
                <SliderField
                  label="식 크기"
                  value={state.style.equationSize}
                  onChange={(equationSize) =>
                    set({ style: { ...state.style, equationSize } })
                  }
                  min={12}
                  max={32}
                  step={1}
                />
                <SliderField
                  label="축 굵기"
                  value={state.style.lineWidth}
                  onChange={(lineWidth) =>
                    set({ style: { ...state.style, lineWidth } })
                  }
                  min={1}
                  max={3.2}
                  step={0.1}
                  display={state.style.lineWidth.toFixed(1)}
                />
                <SliderField
                  label="그래프 굵기"
                  value={state.style.graphWidth}
                  onChange={(graphWidth) =>
                    set({ style: { ...state.style, graphWidth } })
                  }
                  min={1}
                  max={4}
                  step={0.1}
                  display={state.style.graphWidth.toFixed(1)}
                />
                <SliderField
                  label="점 크기"
                  value={state.style.pointRadius}
                  onChange={(pointRadius) =>
                    set({ style: { ...state.style, pointRadius } })
                  }
                  min={2}
                  max={6}
                  step={0.1}
                  display={state.style.pointRadius.toFixed(1)}
                />
                <div>
                  <p className="mb-1 text-xs font-semibold text-foreground/60">
                    저장 해상도
                  </p>
                  <Segmented
                    value={String(state.style.exportScale)}
                    onChange={(v) =>
                      set({
                        style: { ...state.style, exportScale: Number(v) },
                      })
                    }
                    options={[
                      { id: "2", label: "2×" },
                      { id: "3", label: "3×" },
                      { id: "4", label: "4×" },
                    ]}
                  />
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
