"use client";

import { Noto_Serif, Noto_Serif_KR } from "next/font/google";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  ChipToggle,
  InlineNumber,
  InlineText,
  NumberField,
  Segmented,
  SliderField,
  TextField,
} from "@/components/tools/figures/controls";
import QuadraticFunctionCanvas, {
  type QuadraticFunctionSetter,
} from "@/components/tools/figures/quadratic-function/QuadraticFunctionCanvas";
import {
  canvasToPngBlob,
  copyPngToClipboard,
  downloadBlob,
} from "@/lib/diagrams/export-image";
import {
  addGraphFromEquation,
  addHorizontalLine,
  addQuadraticGraph,
  addTranslation,
  applyEquationToGraph,
  cloneState,
  DEFAULT_QUADRATIC_FUNCTION_STATE,
  equationPlainText,
  GRAPH_CYAN,
  GRAPH_GREEN,
  GRAPH_INK,
  GRAPH_PINK,
  GRAPH_PURPLE,
  GRID_COLOR,
  GRID_GRAY,
  graphsHaveSameA,
  isHorizontal,
  isMinimum,
  makeQuadratic,
  nextGraphColor,
  normalizeState,
  QUADRATIC_FUNCTION_PRESETS,
  quadraticEquationText,
  removeById,
  yOnParabola,
  type GraphLabelMode,
  type QuadraticFunctionState,
  type QuadraticGraph,
  type QuadraticPoint,
  type Translation,
  type TranslationKind,
} from "@/lib/diagrams/quadratic-function/model";
import { buildQuadraticFunctionScene } from "@/lib/diagrams/quadratic-function/scene";
import { renderSceneToCanvas, sceneToSvg } from "@/lib/diagrams/render";
import type { FontFaces } from "@/lib/diagrams/math-label";

const STORAGE_KEY = "pm-diagram-g3-quadratic-function-v1";

const storeListeners = new Set<() => void>();
let cachedState: QuadraticFunctionState = DEFAULT_QUADRATIC_FUNCTION_STATE;
let cacheReady = false;

function parseStoredState(raw: string | null): QuadraticFunctionState {
  if (!raw) return DEFAULT_QUADRATIC_FUNCTION_STATE;
  try {
    const parsed = JSON.parse(raw) as QuadraticFunctionState;
    if (
      parsed &&
      Array.isArray(parsed.graphs) &&
      Array.isArray(parsed.points) &&
      typeof parsed.xMin === "number"
    ) {
      return normalizeState({
        ...DEFAULT_QUADRATIC_FUNCTION_STATE,
        ...parsed,
        graphs: parsed.graphs ?? [],
        points: parsed.points ?? [],
        translations: parsed.translations ?? [],
      });
    }
  } catch {
    /* keep default */
  }
  return DEFAULT_QUADRATIC_FUNCTION_STATE;
}

function getServerSnapshot(): QuadraticFunctionState {
  return DEFAULT_QUADRATIC_FUNCTION_STATE;
}

function getClientSnapshot(): QuadraticFunctionState {
  if (!cacheReady) {
    cacheReady = true;
    cachedState = parseStoredState(window.localStorage.getItem(STORAGE_KEY));
  }
  return cachedState;
}

function writeStoredState(state: QuadraticFunctionState, persist = true) {
  cachedState = state;
  cacheReady = true;
  if (persist) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }
  storeListeners.forEach((l) => l());
}

function persistCachedState() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cachedState));
  } catch {
    /* ignore */
  }
}

function subscribeStoredState(onChange: () => void) {
  storeListeners.add(onChange);
  return () => storeListeners.delete(onChange);
}

function useQuadraticFunctionState() {
  const state = useSyncExternalStore(
    subscribeStoredState,
    getClientSnapshot,
    getServerSnapshot,
  );
  const setState = useCallback<QuadraticFunctionSetter>((updater, persist = true) => {
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
  { id: GRAPH_PURPLE, label: "보라" },
  { id: GRAPH_GREEN, label: "초록" },
  { id: GRAPH_INK, label: "검정" },
];

function addParallelTranslate(
  state: QuadraticFunctionState,
  graphId: string,
  kind: TranslationKind,
): QuadraticFunctionState {
  const graph = state.graphs.find((g) => g.id === graphId);
  if (!graph || isHorizontal(graph)) return state;
  const parallel = state.graphs.find(
    (g) => g.id !== graphId && graphsHaveSameA(g, graph),
  );
  if (parallel) return addTranslation(state, graph.id, parallel.id, kind);
  const other = state.graphs.find(
    (g) => g.id !== graphId && !isHorizontal(g),
  );
  if (other) return addTranslation(state, graph.id, other.id, kind);
  const copy = makeQuadratic({
    a: graph.a,
    p: graph.p,
    q: graph.q - 2,
    color: nextGraphColor(state.graphs),
    labelMode: "auto",
  });
  return addTranslation(
    { ...state, graphs: [...state.graphs, copy] },
    graph.id,
    copy.id,
    kind,
  );
}

export default function QuadraticFunctionStudio() {
  const [state, setState] = useQuadraticFunctionState();
  const [status, setStatus] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(
    () => state.graphs[0]?.id ?? null,
  );
  const [placingPoint, setPlacingPoint] = useState(false);
  const [eqAdd, setEqAdd] = useState("");
  const [eqEdit, setEqEdit] = useState<string | null>(null);
  const fonts = useMemo(() => fontsFromNext(), []);

  const selectedGraph = state.graphs.find((g) => g.id === selectedId) ?? null;
  const selectedPoint = state.points.find((p) => p.id === selectedId) ?? null;
  const selectedTrans =
    state.translations.find((t) => t.id === selectedId) ?? null;

  const set = useCallback(
    (patch: Partial<QuadraticFunctionState>) => {
      setState((prev) => normalizeState({ ...prev, ...patch }));
    },
    [setState],
  );

  const patchSelectedGraph = useCallback(
    (patch: Partial<QuadraticGraph>) => {
      if (!selectedGraph) return;
      setState((prev) => ({
        ...prev,
        graphs: prev.graphs.map((g) =>
          g.id === selectedGraph.id ? { ...g, ...patch } : g,
        ),
      }));
    },
    [selectedGraph, setState],
  );

  useEffect(() => {
    setEqEdit(null);
  }, [selectedGraph?.id]);

  function addEquation(raw: string) {
    const next = addGraphFromEquation(state, raw);
    if (!next) {
      setStatus("y=x^2, y=(x-2)^2+1, y=4처럼 넣어 주세요.");
      return;
    }
    setState(next);
    const added = next.graphs[next.graphs.length - 1];
    if (added) setSelectedId(added.id);
    setEqAdd("");
    setStatus(null);
  }

  function commitEqEdit(raw: string) {
    if (!selectedGraph) return;
    const trimmed = raw.trim();
    if (!trimmed || trimmed === equationPlainText(selectedGraph)) {
      setEqEdit(null);
      return;
    }
    const next = applyEquationToGraph(state, selectedGraph.id, trimmed);
    if (!next) {
      setStatus("식을 읽지 못했어요. y=x^2+(x+2)^2+1처럼 넣어 주세요.");
      setEqEdit(null);
      return;
    }
    setState(next);
    setEqEdit(null);
    setStatus(null);
  }

  const patchSelectedPoint = useCallback(
    (patch: Partial<QuadraticPoint>) => {
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

  const patchSelectedTrans = useCallback(
    (patch: Partial<Translation>) => {
      if (!selectedTrans) return;
      setState((prev) => ({
        ...prev,
        translations: prev.translations.map((t) =>
          t.id === selectedTrans.id ? { ...t, ...patch } : t,
        ),
      }));
    },
    [selectedTrans, setState],
  );

  const deleteSelected = useCallback(() => {
    const id = selectedId;
    if (!id) return;
    setState((prev) => removeById(prev, id));
    setSelectedId((cur) => {
      if (cur !== id) return cur;
      const next = removeById(state, id);
      return (
        next.graphs[0]?.id ??
        next.points[0]?.id ??
        next.translations[0]?.id ??
        null
      );
    });
  }, [selectedId, state, setState]);

  async function exportPng() {
    await document.fonts.ready;
    const scene = buildQuadraticFunctionScene(state);
    const canvas = renderSceneToCanvas(
      scene,
      fonts,
      state.style.lineWidth,
      state.style.exportScale,
    );
    const blob = await canvasToPngBlob(canvas);
    downloadBlob(blob, "이차함수 그래프.png");
    setStatus("PNG를 저장했어요.");
  }

  async function copyPng() {
    await document.fonts.ready;
    const scene = buildQuadraticFunctionScene(state);
    const canvas = renderSceneToCanvas(
      scene,
      fonts,
      state.style.lineWidth,
      state.style.exportScale,
    );
    const blob = await canvasToPngBlob(canvas);
    await copyPngToClipboard(blob);
    setStatus("이미지를 복사했어요.");
  }

  function exportSvg() {
    const scene = buildQuadraticFunctionScene(state);
    const svg = sceneToSvg(scene, fonts, state.style.lineWidth);
    downloadBlob(new Blob([svg], { type: "image/svg+xml" }), "이차함수 그래프.svg");
    setStatus("SVG를 저장했어요.");
  }

  return (
    <div className={`${notoSerif.variable} ${notoSerifKr.variable} space-y-4`}>
      <span
        className={`${notoSerif.className} ${notoSerifKr.className} sr-only italic`}
        style={{ fontFamily: '"Times New Roman", serif' }}
        aria-hidden
      >
        xy O y=ax^2
      </span>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-wood">
            <Link href="/tools/figures?grade=3" className="hover:underline">
              문제 그림 그리기
            </Link>
            <span className="mx-1.5 text-foreground/30">/</span>
            중3
          </p>
          <h1 className="font-display mt-1 text-3xl text-wood-dark sm:text-4xl">
            이차함수 그래프
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-foreground/65">
            좌표평면에 <span className="italic">y=a(x-p)²+q</span>를 그리고,
            꼭짓점·최댓값·평행이동을 켜고 PNG로 저장하세요.
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

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(14rem,16rem)_minmax(15rem,18rem)]">
        <div className="mx-auto w-full max-w-[24rem] space-y-4 lg:mx-0 lg:max-w-none">
          <div className="overflow-hidden rounded-3xl border-2 border-wood/10 bg-white shadow-[0_12px_40px_rgba(61,44,30,0.08)]">
            <QuadraticFunctionCanvas
              state={state}
              fonts={fonts}
              selectedId={selectedId}
              placingPoint={placingPoint}
              setState={setState}
              persist={persistCachedState}
              onSelect={setSelectedId}
              onDeleteSelected={deleteSelected}
            />
          </div>

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
                <InlineNumber
                  ariaLabel="눈금 간격"
                  value={state.xTick}
                  onChange={(tick) => set({ xTick: tick, yTick: tick })}
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
                      set({ style: { ...state.style, gridColor: GRID_COLOR } })
                    }
                  >
                    청록
                  </ChipToggle>
                  <ChipToggle
                    on={state.style.gridColor === GRID_GRAY}
                    onClick={() =>
                      set({ style: { ...state.style, gridColor: GRID_GRAY } })
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
            </div>
            <div className="mt-2.5">
              <SliderField
                label="그림 여백"
                value={state.style.padding}
                onChange={(padding) =>
                  set({ style: { ...state.style, padding } })
                }
                min={48}
                max={160}
                step={2}
                display={`${state.style.padding}px`}
              />
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <ChipToggle
              on={placingPoint}
              onClick={() => setPlacingPoint((v) => !v)}
            >
              점 찍기
            </ChipToggle>
          </div>

          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-sm text-wood-dark">표시</h2>
              {selectedId ? (
                <button
                  type="button"
                  onClick={deleteSelected}
                  className="rounded-lg bg-black/5 px-2.5 py-1 text-xs font-semibold text-foreground/70 hover:bg-black/10"
                >
                  삭제
                </button>
              ) : null}
            </div>

            {selectedGraph ? (
              <div className="mt-2.5 space-y-2">
                <label className="block">
                  <span className="text-xs font-semibold text-foreground/60">
                    식
                  </span>
                  <input
                    type="text"
                    value={eqEdit ?? equationPlainText(selectedGraph)}
                    onChange={(e) => setEqEdit(e.target.value)}
                    onBlur={(e) => commitEqEdit(e.currentTarget.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                    spellCheck={false}
                    className="mt-1 w-full rounded-xl border-2 border-wood/20 bg-white px-3 py-2 text-sm outline-none focus:border-wood"
                  />
                </label>
                {!isHorizontal(selectedGraph) ? (
                  <div className="grid grid-cols-3 gap-1.5">
                    <NumberField
                      label="a"
                      value={selectedGraph.a}
                      onChange={(a) => patchSelectedGraph({ a })}
                      step={0.25}
                    />
                    <NumberField
                      label="p"
                      value={selectedGraph.p}
                      onChange={(p) => patchSelectedGraph({ p })}
                      step={0.5}
                    />
                    <NumberField
                      label="q"
                      value={selectedGraph.q}
                      onChange={(q) => patchSelectedGraph({ q })}
                      step={0.5}
                    />
                  </div>
                ) : (
                  <NumberField
                    label="y"
                    value={selectedGraph.q}
                    onChange={(q) => patchSelectedGraph({ q })}
                    step={0.5}
                  />
                )}
                <div className="flex flex-wrap gap-1.5">
                  <ChipToggle
                    on={selectedGraph.labelMode !== "hide"}
                    onClick={() =>
                      patchSelectedGraph({
                        labelMode:
                          selectedGraph.labelMode === "hide" ? "auto" : "hide",
                      })
                    }
                  >
                    식 표시
                  </ChipToggle>
                  {!isHorizontal(selectedGraph) ? (
                    <>
                      <ChipToggle
                        on={selectedGraph.showVertex}
                        onClick={() =>
                          patchSelectedGraph({
                            showVertex: !selectedGraph.showVertex,
                          })
                        }
                      >
                        꼭짓점
                      </ChipToggle>
                      <ChipToggle
                        on={selectedGraph.showVertexDrop}
                        onClick={() =>
                          patchSelectedGraph({
                            showVertexDrop: !selectedGraph.showVertexDrop,
                          })
                        }
                      >
                        수선
                      </ChipToggle>
                      <ChipToggle
                        on={selectedGraph.showVertexMarks}
                        onClick={() =>
                          patchSelectedGraph({
                            showVertexMarks: !selectedGraph.showVertexMarks,
                          })
                        }
                      >
                        p, q
                      </ChipToggle>
                      <ChipToggle
                        on={selectedGraph.showAxisOfSymmetry}
                        onClick={() =>
                          patchSelectedGraph({
                            showAxisOfSymmetry: !selectedGraph.showAxisOfSymmetry,
                          })
                        }
                      >
                        대칭축
                      </ChipToggle>
                      <ChipToggle
                        on={selectedGraph.showExtrema}
                        onClick={() =>
                          patchSelectedGraph({
                            showExtrema: !selectedGraph.showExtrema,
                          })
                        }
                      >
                        {isMinimum(selectedGraph) ? "최솟값" : "최댓값"}
                      </ChipToggle>
                      <ChipToggle
                        on={selectedGraph.showXIntercept}
                        onClick={() =>
                          patchSelectedGraph({
                            showXIntercept: !selectedGraph.showXIntercept,
                          })
                        }
                      >
                        x절편
                      </ChipToggle>
                      <ChipToggle
                        on={selectedGraph.showYIntercept}
                        onClick={() =>
                          patchSelectedGraph({
                            showYIntercept: !selectedGraph.showYIntercept,
                          })
                        }
                      >
                        y절편
                      </ChipToggle>
                    </>
                  ) : null}
                </div>
                <Segmented
                  value={selectedGraph.labelMode}
                  onChange={(labelMode) =>
                    patchSelectedGraph({ labelMode: labelMode as GraphLabelMode })
                  }
                  options={[
                    { value: "auto", label: "숫자" },
                    { value: "letter", label: "문자" },
                    { value: "custom", label: "직접" },
                  ]}
                />
                {selectedGraph.labelMode === "letter" && !isHorizontal(selectedGraph) ? (
                  <div className="grid grid-cols-3 gap-1.5">
                    <TextField
                      label="a"
                      value={selectedGraph.letterA}
                      onChange={(letterA) => patchSelectedGraph({ letterA })}
                    />
                    <TextField
                      label="p"
                      value={selectedGraph.letterP}
                      onChange={(letterP) => patchSelectedGraph({ letterP })}
                    />
                    <TextField
                      label="q"
                      value={selectedGraph.letterQ}
                      onChange={(letterQ) => patchSelectedGraph({ letterQ })}
                    />
                  </div>
                ) : null}
                {selectedGraph.labelMode === "custom" ? (
                  <TextField
                    label="식 글자"
                    value={selectedGraph.custom}
                    onChange={(custom) => patchSelectedGraph({ custom })}
                  />
                ) : null}
                <div className="flex flex-wrap gap-1.5">
                  {COLORS.map((c) => (
                    <ChipToggle
                      key={c.id}
                      on={selectedGraph.color === c.id}
                      onClick={() => patchSelectedGraph({ color: c.id })}
                    >
                      {c.label}
                    </ChipToggle>
                  ))}
                </div>
                {!isHorizontal(selectedGraph) ? (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        const next = addParallelTranslate(
                          state,
                          selectedGraph.id,
                          "vertical",
                        );
                        setState(next);
                        const added = next.translations[next.translations.length - 1];
                        if (added) setSelectedId(added.id);
                      }}
                      className="rounded-xl bg-black/5 px-2.5 py-1 text-xs font-semibold text-foreground/70 hover:bg-black/10"
                    >
                      위아래 평행이동
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const next = addParallelTranslate(
                          state,
                          selectedGraph.id,
                          "horizontal",
                        );
                        setState(next);
                        const added = next.translations[next.translations.length - 1];
                        if (added) setSelectedId(added.id);
                      }}
                      className="rounded-xl bg-black/5 px-2.5 py-1 text-xs font-semibold text-foreground/70 hover:bg-black/10"
                    >
                      좌우 평행이동
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const next = addParallelTranslate(
                          state,
                          selectedGraph.id,
                          "vertex",
                        );
                        setState(next);
                        const added = next.translations[next.translations.length - 1];
                        if (added) setSelectedId(added.id);
                      }}
                      className="rounded-xl bg-black/5 px-2.5 py-1 text-xs font-semibold text-foreground/70 hover:bg-black/10"
                    >
                      꼭짓점 L자
                    </button>
                  </div>
                ) : null}
              </div>
            ) : selectedPoint ? (
              <div className="mt-2.5 space-y-2">
                <TextField
                  label="이름"
                  value={selectedPoint.name}
                  onChange={(name) => patchSelectedPoint({ name })}
                />
                <div className="flex flex-wrap gap-1.5">
                  <ChipToggle
                    on={selectedPoint.showDot}
                    onClick={() =>
                      patchSelectedPoint({ showDot: !selectedPoint.showDot })
                    }
                  >
                    점
                  </ChipToggle>
                  <ChipToggle
                    on={selectedPoint.showName}
                    onClick={() =>
                      patchSelectedPoint({ showName: !selectedPoint.showName })
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
                    x수선
                  </ChipToggle>
                  <ChipToggle
                    on={selectedPoint.dropY}
                    onClick={() =>
                      patchSelectedPoint({ dropY: !selectedPoint.dropY })
                    }
                  >
                    y수선
                  </ChipToggle>
                  <ChipToggle
                    on={selectedPoint.axisMarkX}
                    onClick={() =>
                      patchSelectedPoint({
                        axisMarkX: !selectedPoint.axisMarkX,
                      })
                    }
                  >
                    x값
                  </ChipToggle>
                  <ChipToggle
                    on={selectedPoint.axisMarkY}
                    onClick={() =>
                      patchSelectedPoint({
                        axisMarkY: !selectedPoint.axisMarkY,
                      })
                    }
                  >
                    y값
                  </ChipToggle>
                </div>
              </div>
            ) : selectedTrans ? (
              <div className="mt-2.5 space-y-2">
                <Segmented
                  value={selectedTrans.kind}
                  onChange={(kind) =>
                    patchSelectedTrans({ kind: kind as TranslationKind })
                  }
                  options={[
                    { value: "vertical", label: "세로" },
                    { value: "horizontal", label: "가로" },
                    { value: "vertex", label: "L자" },
                  ]}
                />
                <ChipToggle
                  on={selectedTrans.showDelta}
                  onClick={() =>
                    patchSelectedTrans({ showDelta: !selectedTrans.showDelta })
                  }
                >
                  이동량 숫자
                </ChipToggle>
              </div>
            ) : (
              <p className="mt-2 text-[11px] text-foreground/45">
                그래프를 고르면 꼭짓점·최댓값·평행이동을 켤 수 있어요.
              </p>
            )}
          </section>

          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <h2 className="font-display text-sm text-wood-dark">그래프</h2>
            <div className="mt-2 flex flex-wrap items-end gap-1.5">
              <div className="min-w-0 flex-1">
                <TextField
                  label="식 추가"
                  value={eqAdd}
                  onChange={setEqAdd}
                  placeholder="y=x^2+1"
                />
              </div>
              <button
                type="button"
                onClick={() => addEquation(eqAdd)}
                className="rounded-xl bg-wood/15 px-3 py-2 text-xs font-semibold text-wood-dark"
              >
                추가
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => {
                  const next = addQuadraticGraph(state);
                  setState(next);
                  const added = next.graphs[next.graphs.length - 1];
                  if (added) setSelectedId(added.id);
                }}
                className="rounded-xl bg-black/5 px-2.5 py-1 text-xs font-semibold text-foreground/70 hover:bg-black/10"
              >
                포물선
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = addHorizontalLine(state);
                  setState(next);
                  const added = next.graphs[next.graphs.length - 1];
                  if (added) setSelectedId(added.id);
                }}
                className="rounded-xl bg-black/5 px-2.5 py-1 text-xs font-semibold text-foreground/70 hover:bg-black/10"
              >
                y=k
              </button>
            </div>
            {state.graphs.length > 0 ? (
              <ul className="mt-2 space-y-1">
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
                      <span
                        className="mr-1.5 inline-block h-2 w-2 rounded-full"
                        style={{ background: graph.color }}
                      />
                      {quadraticEquationText(graph) ?? "식 숨김"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setState((prev) => removeById(prev, graph.id));
                        if (selectedId === graph.id) {
                          setSelectedId(
                            state.graphs.find((g) => g.id !== graph.id)?.id ??
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
            ) : (
              <p className="mt-2 text-[11px] text-foreground/45">
                그래프를 추가하거나 빠른 그림을 고르세요.
              </p>
            )}
            {state.points.length > 0 ? (
              <ul className="mt-3 space-y-1 border-t border-wood/10 pt-2">
                {state.points.map((point) => {
                  const g = state.graphs.find((gr) => gr.id === point.graphId);
                  const y = g ? yOnParabola(g, point.x) : 0;
                  return (
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
                        {point.name || "점"}
                        <span className="ml-1 font-normal text-foreground/45">
                          ({point.x}, {Math.round(y * 100) / 100})
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setState((prev) => removeById(prev, point.id));
                          if (selectedId === point.id) {
                            setSelectedId(state.graphs[0]?.id ?? null);
                          }
                        }}
                        className="text-xs font-semibold text-foreground/40 hover:text-foreground"
                      >
                        지우기
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <h2 className="font-display text-sm text-wood-dark">빠른 그림</h2>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {QUADRATIC_FUNCTION_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    const next = cloneState(preset.state);
                    setState(next);
                    setSelectedId(next.graphs[0]?.id ?? null);
                    setPlacingPoint(false);
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

          <details
            open
            className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5"
          >
            <summary className="font-display cursor-pointer text-sm text-wood-dark">
              그림 스타일
            </summary>
            <div className="mt-3 space-y-3">
              <SliderField
                label="눈금 글자"
                value={state.style.fontSize}
                onChange={(fontSize) =>
                  set({ style: { ...state.style, fontSize } })
                }
                min={12}
                max={64}
                step={1}
              />
              <SliderField
                label="점 이름"
                value={state.style.pointLabelSize}
                onChange={(pointLabelSize) =>
                  set({ style: { ...state.style, pointLabelSize } })
                }
                min={14}
                max={72}
                step={1}
              />
              <SliderField
                label="축 이름"
                value={state.style.axisNameSize}
                onChange={(axisNameSize) =>
                  set({ style: { ...state.style, axisNameSize } })
                }
                min={12}
                max={72}
                step={1}
              />
              <SliderField
                label="식 크기"
                value={state.style.equationSize}
                onChange={(equationSize) =>
                  set({ style: { ...state.style, equationSize } })
                }
                min={12}
                max={64}
                step={1}
              />
              <SliderField
                label="축 굵기"
                value={state.style.lineWidth}
                onChange={(lineWidth) =>
                  set({ style: { ...state.style, lineWidth } })
                }
                min={1}
                max={6}
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
                max={8}
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
                max={12}
                step={0.2}
                display={state.style.pointRadius.toFixed(1)}
              />
              <SliderField
                label="PNG 배율"
                value={state.style.exportScale}
                onChange={(exportScale) =>
                  set({ style: { ...state.style, exportScale } })
                }
                min={1}
                max={4}
                step={0.5}
                display={`${state.style.exportScale}×`}
              />
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
