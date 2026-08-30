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
import LinearFunctionCanvas, {
  type LinearFunctionSetter,
} from "@/components/tools/figures/linear-function/LinearFunctionCanvas";
import {
  canvasToPngBlob,
  copyPngToClipboard,
  downloadBlob,
} from "@/lib/diagrams/export-image";
import {
  addHorizontalGraph,
  addLinearGraph,
  addPointOnGraph,
  addSlopeStep,
  addTranslation,
  addVerticalGraph,
  cloneState,
  DEFAULT_LINEAR_FUNCTION_STATE,
  GRAPH_CYAN,
  GRAPH_INK,
  GRAPH_PINK,
  GRAPH_PURPLE,
  GRID_COLOR,
  GRID_GRAY,
  graphsAreParallel,
  isHorizontal,
  isVertical,
  LINEAR_FUNCTION_PRESETS,
  linearEquationText,
  makeLinear,
  nextGraphColor,
  normalizeState,
  pointCoords,
  removeById,
  xIntercept,
  type GraphLabelMode,
  type LinearFunctionState,
  type LinearGraph,
  type LinearPoint,
  type SlopeStep,
  type Translation,
} from "@/lib/diagrams/linear-function/model";
import { moveIntercept } from "@/lib/diagrams/linear-function/geometry";
import { buildLinearFunctionScene } from "@/lib/diagrams/linear-function/scene";
import { renderSceneToCanvas, sceneToSvg } from "@/lib/diagrams/render";
import type { FontFaces } from "@/lib/diagrams/math-label";

const STORAGE_KEY = "pm-diagram-g2-linear-function-v2";

const storeListeners = new Set<() => void>();

let cachedRaw: string | null = null;
let cachedState: LinearFunctionState = DEFAULT_LINEAR_FUNCTION_STATE;
let cacheReady = false;

function parseStoredState(raw: string | null): LinearFunctionState {
  if (!raw) return DEFAULT_LINEAR_FUNCTION_STATE;
  try {
    const parsed = JSON.parse(raw) as LinearFunctionState;
    if (
      parsed &&
      Array.isArray(parsed.graphs) &&
      Array.isArray(parsed.points) &&
      typeof parsed.xMin === "number"
    ) {
      return normalizeState({
        ...DEFAULT_LINEAR_FUNCTION_STATE,
        ...parsed,
        graphs: parsed.graphs ?? [],
        points: parsed.points ?? [],
        slopeSteps: parsed.slopeSteps ?? [],
        translations: parsed.translations ?? [],
      });
    }
  } catch {
    /* keep default */
  }
  return DEFAULT_LINEAR_FUNCTION_STATE;
}

function getServerSnapshot(): LinearFunctionState {
  return DEFAULT_LINEAR_FUNCTION_STATE;
}

function getClientSnapshot(): LinearFunctionState {
  if (!cacheReady) {
    cacheReady = true;
    cachedRaw = window.localStorage.getItem(STORAGE_KEY);
    cachedState = parseStoredState(cachedRaw);
  }
  return cachedState;
}

function writeStoredState(state: LinearFunctionState, persist = true) {
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

function useLinearFunctionState() {
  const state = useSyncExternalStore(
    subscribeStoredState,
    getClientSnapshot,
    getServerSnapshot,
  );
  const setState = useCallback<LinearFunctionSetter>((updater, persist = true) => {
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
  { id: GRAPH_INK, label: "검정" },
];

function addParallelTranslate(
  state: LinearFunctionState,
  graphId: string,
): LinearFunctionState {
  const graph = state.graphs.find((g) => g.id === graphId);
  if (!graph) return state;
  const parallel = state.graphs.find(
    (g) => g.id !== graphId && graphsAreParallel(g, graph),
  );
  if (parallel) return addTranslation(state, graph.id, parallel.id);
  const other = state.graphs.find((g) => g.id !== graphId);
  if (other) return addTranslation(state, graph.id, other.id);
  const copy = makeLinear({
    a: graph.a,
    b: graph.b - 2,
    color: nextGraphColor(state.graphs),
    labelMode: "auto",
  });
  return addTranslation(
    { ...state, graphs: [...state.graphs, copy] },
    graph.id,
    copy.id,
  );
}

export default function LinearFunctionStudio() {
  const [state, setState] = useLinearFunctionState();
  const [status, setStatus] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(
    () => state.graphs[0]?.id ?? null,
  );
  const [placingPoint, setPlacingPoint] = useState(false);
  const fonts = useMemo(() => fontsFromNext(), []);

  const selectedGraph = state.graphs.find((g) => g.id === selectedId) ?? null;
  const selectedPoint = state.points.find((p) => p.id === selectedId) ?? null;
  const selectedSlope = state.slopeSteps.find((s) => s.id === selectedId) ?? null;
  const selectedTrans =
    state.translations.find((t) => t.id === selectedId) ?? null;

  const set = useCallback(
    (patch: Partial<LinearFunctionState>) => {
      setState((prev) => normalizeState({ ...prev, ...patch }));
    },
    [setState],
  );

  const patchSelectedGraph = useCallback(
    (patch: Partial<LinearGraph>) => {
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

  const patchSelectedPoint = useCallback(
    (patch: Partial<LinearPoint>) => {
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

  const patchSelectedSlope = useCallback(
    (patch: Partial<SlopeStep>) => {
      if (!selectedSlope) return;
      setState((prev) => ({
        ...prev,
        slopeSteps: prev.slopeSteps.map((s) =>
          s.id === selectedSlope.id ? { ...s, ...patch } : s,
        ),
      }));
    },
    [selectedSlope, setState],
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
        next.slopeSteps[0]?.id ??
        next.translations[0]?.id ??
        null
      );
    });
  }, [selectedId, state, setState]);

  async function exportPng() {
    await document.fonts.ready;
    const scene = buildLinearFunctionScene(state);
    const canvas = renderSceneToCanvas(
      scene,
      fonts,
      state.style.lineWidth,
      state.style.exportScale,
    );
    const blob = await canvasToPngBlob(canvas);
    downloadBlob(blob, "일차함수.png");
    setStatus("PNG를 저장했어요.");
  }

  async function copyPng() {
    await document.fonts.ready;
    const scene = buildLinearFunctionScene(state);
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
    const scene = buildLinearFunctionScene(state);
    const svg = sceneToSvg(scene, fonts, state.style.lineWidth);
    downloadBlob(new Blob([svg], { type: "image/svg+xml" }), "일차함수.svg");
    setStatus("SVG를 저장했어요.");
  }

  const eqPreview = selectedGraph ? linearEquationText(selectedGraph) : null;
  const xi = selectedGraph ? xIntercept(selectedGraph) : null;

  return (
    <div className={`${notoSerif.variable} ${notoSerifKr.variable} space-y-4`}>
      <span
        className={`${notoSerif.className} ${notoSerifKr.className} sr-only italic`}
        style={{ fontFamily: '"Times New Roman", serif' }}
        aria-hidden
      >
        xy O y=ax+b 기울기
      </span>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-wood">
            <Link href="/tools/figures?grade=2" className="hover:underline">
              문제 그림 그리기
            </Link>
            <span className="mx-1.5 text-foreground/30">/</span>
            중2
          </p>
          <h1 className="font-display mt-1 text-3xl text-wood-dark sm:text-4xl">
            일차함수 그래프
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-foreground/65">
            중1 좌표평면 위에 <span className="italic">y=ax+b</span>를 여러 개
            그립니다. 절편, 점의 수선, 기울기 화살, 평행이동을 켜고 PNG로
            저장하세요.
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
        <div className="mx-auto w-full max-w-[24rem] overflow-hidden rounded-3xl border-2 border-wood/10 bg-white shadow-[0_12px_40px_rgba(61,44,30,0.08)] lg:mx-0 lg:max-w-none">
          <LinearFunctionCanvas
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
                <p className="text-xs font-semibold text-wood-dark">
                  {eqPreview ?? "식 숨김"}
                </p>
                <Segmented
                  value={
                    isVertical(selectedGraph)
                      ? "xeq"
                      : isHorizontal(selectedGraph)
                        ? "yeq"
                        : "axb"
                  }
                  onChange={(form) => {
                    if (form === "xeq") {
                      const xi = xIntercept(selectedGraph);
                      patchSelectedGraph({
                        kind: "vertical",
                        c: xi ?? selectedGraph.c ?? 2,
                      });
                      return;
                    }
                    if (form === "yeq") {
                      patchSelectedGraph({
                        kind: "linear",
                        a: 0,
                        b: isVertical(selectedGraph) ? 0 : selectedGraph.b,
                      });
                      return;
                    }
                    patchSelectedGraph({
                      kind: "linear",
                      a: isHorizontal(selectedGraph) ? 1 : selectedGraph.a,
                    });
                  }}
                  options={[
                    { id: "axb", label: "y=ax+b" },
                    { id: "xeq", label: "x=a" },
                    { id: "yeq", label: "y=b" },
                  ]}
                />
                {isVertical(selectedGraph) ? (
                  <NumberField
                    label="x ="
                    value={selectedGraph.c}
                    onChange={(c) => patchSelectedGraph({ c })}
                    step={0.5}
                  />
                ) : isHorizontal(selectedGraph) ? (
                  <NumberField
                    label="y ="
                    value={selectedGraph.b}
                    onChange={(b) => patchSelectedGraph({ b })}
                    step={0.5}
                  />
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <NumberField
                        label="기울기 a"
                        value={selectedGraph.a}
                        onChange={(a) => patchSelectedGraph({ a })}
                        step={0.25}
                      />
                      <NumberField
                        label="y절편 b"
                        value={selectedGraph.b}
                        onChange={(b) => patchSelectedGraph({ b })}
                        step={0.5}
                      />
                    </div>
                    {xi != null ? (
                      <NumberField
                        label="x절편"
                        value={Math.round(xi * 1000) / 1000}
                        onChange={(value) =>
                          setState((prev) =>
                            moveIntercept(prev, selectedGraph.id, "x", value),
                          )
                        }
                        step={0.5}
                      />
                    ) : null}
                  </>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {isVertical(selectedGraph) ? (
                    <ChipToggle
                      on={selectedGraph.showXIntercept}
                      onClick={() =>
                        patchSelectedGraph({
                          showXIntercept: !selectedGraph.showXIntercept,
                        })
                      }
                    >
                      x값
                    </ChipToggle>
                  ) : (
                    <>
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
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const x =
                        Math.abs(selectedGraph.a) < 1e-9
                          ? 2
                          : Math.min(
                              state.xMax - state.xTick,
                              Math.max(state.xMin + state.xTick, 2),
                            );
                      const next = addPointOnGraph(state, selectedGraph.id, x);
                      setState(next);
                      const added = next.points[next.points.length - 1];
                      if (added) setSelectedId(added.id);
                      setPlacingPoint(false);
                    }}
                    className="rounded-xl bg-black/5 px-2.5 py-1.5 text-xs font-semibold text-foreground/70 hover:bg-black/10"
                  >
                    점 추가
                  </button>
                  {!isVertical(selectedGraph) ? (
                    <button
                      type="button"
                      onClick={() => {
                        const next = addSlopeStep(state, selectedGraph.id);
                        setState(next);
                        const added = next.slopeSteps[next.slopeSteps.length - 1];
                        if (added) setSelectedId(added.id);
                      }}
                      className="rounded-xl bg-black/5 px-2.5 py-1.5 text-xs font-semibold text-foreground/70 hover:bg-black/10"
                    >
                      기울기 설명
                    </button>
                  ) : null}
                  {!isVertical(selectedGraph) ? (
                    <button
                      type="button"
                      onClick={() => {
                        const next = addParallelTranslate(state, selectedGraph.id);
                        setState(next);
                        const added =
                          next.translations[next.translations.length - 1];
                        if (added) setSelectedId(added.id);
                      }}
                      className="rounded-xl bg-black/5 px-2.5 py-1.5 text-xs font-semibold text-foreground/70 hover:bg-black/10"
                    >
                      평행이동
                    </button>
                  ) : null}
                </div>
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
                    isVertical(selectedGraph) || isHorizontal(selectedGraph) ? (
                      <TextField
                        label="문자"
                        value={
                          isVertical(selectedGraph)
                            ? selectedGraph.letterA
                            : selectedGraph.letterB
                        }
                        onChange={(letter) =>
                          patchSelectedGraph(
                            isVertical(selectedGraph)
                              ? { letterA: letter }
                              : { letterB: letter },
                          )
                        }
                        className="mt-2"
                      />
                    ) : (
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <TextField
                          label="기울기 문자"
                          value={selectedGraph.letterA}
                          onChange={(letterA) =>
                            patchSelectedGraph({ letterA })
                          }
                        />
                        <TextField
                          label="절편 문자"
                          value={selectedGraph.letterB}
                          onChange={(letterB) =>
                            patchSelectedGraph({ letterB })
                          }
                        />
                      </div>
                    )
                  ) : null}
                  {selectedGraph.labelMode === "custom" ? (
                    <TextField
                      label="식"
                      value={selectedGraph.custom}
                      onChange={(custom) => patchSelectedGraph({ custom })}
                      placeholder="y=\\frac{3}{4}x-2"
                      className="mt-2"
                    />
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
                        style={{
                          color: c.id === GRAPH_INK ? undefined : c.id,
                        }}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : selectedPoint ? (
              <div className="mt-2.5 space-y-2">
                <p className="text-xs font-semibold text-wood-dark">
                  점 {selectedPoint.name || ""}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <TextField
                    label="이름"
                    value={selectedPoint.name}
                    onChange={(name) => patchSelectedPoint({ name })}
                  />
                  {(() => {
                    const g = state.graphs.find(
                      (gr) => gr.id === selectedPoint.graphId,
                    );
                    if (g && isVertical(g)) {
                      return (
                        <NumberField
                          label="y"
                          value={selectedPoint.y}
                          onChange={(y) => patchSelectedPoint({ y })}
                          step={state.yTick}
                        />
                      );
                    }
                    return (
                      <NumberField
                        label="x"
                        value={selectedPoint.x}
                        onChange={(x) => patchSelectedPoint({ x })}
                        step={state.xTick}
                      />
                    );
                  })()}
                </div>
                <p className="text-[11px] text-foreground/45">
                  {(() => {
                    const g = state.graphs.find(
                      (gr) => gr.id === selectedPoint.graphId,
                    );
                    if (!g) return "직선 위를 따라 움직여요.";
                    const c = pointCoords(g, selectedPoint);
                    return `(${c.x}, ${Math.round(c.y * 1000) / 1000}). 직선 위를 따라 움직여요.`;
                  })()}
                </p>
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
            ) : selectedSlope ? (
              <div className="mt-2.5 space-y-2">
                <p className="text-xs font-semibold text-wood-dark">
                  기울기 설명
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <NumberField
                    label="시작 x"
                    value={selectedSlope.x1}
                    onChange={(x1) => patchSelectedSlope({ x1 })}
                    step={state.xTick}
                  />
                  <NumberField
                    label="끝 x"
                    value={selectedSlope.x2}
                    onChange={(x2) => patchSelectedSlope({ x2 })}
                    step={state.xTick}
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <ChipToggle
                    on={selectedSlope.showDx}
                    onClick={() =>
                      patchSelectedSlope({ showDx: !selectedSlope.showDx })
                    }
                  >
                    Δx
                  </ChipToggle>
                  <ChipToggle
                    on={selectedSlope.showDy}
                    onClick={() =>
                      patchSelectedSlope({ showDy: !selectedSlope.showDy })
                    }
                  >
                    Δy
                  </ChipToggle>
                </div>
                <p className="text-[11px] text-foreground/45">
                  그림에서 두 끝점을 직선 따라 끌 수 있어요.
                </p>
              </div>
            ) : selectedTrans ? (
              <div className="mt-2.5 space-y-2">
                <p className="text-xs font-semibold text-wood-dark">
                  평행이동
                </p>
                <NumberField
                  label="화살 개수"
                  value={selectedTrans.xs.length}
                  onChange={(n) => {
                    const count = Math.min(8, Math.max(2, Math.round(n)));
                    const span = state.xMax - state.xMin;
                    const start = selectedTrans.xs[0] ?? state.xMin + span * 0.2;
                    const step = span * 0.18;
                    const xs = Array.from(
                      { length: count },
                      (_, i) => start + i * step,
                    );
                    patchSelectedTrans({ xs });
                  }}
                  min={2}
                  max={8}
                  step={1}
                />
                <ChipToggle
                  on={selectedTrans.showDelta}
                  onClick={() =>
                    patchSelectedTrans({
                      showDelta: !selectedTrans.showDelta,
                    })
                  }
                >
                  이동 크기
                </ChipToggle>
                <p className="text-[11px] text-foreground/45">
                  빨간 화살을 좌우로 끌어 위치를 맞춰요.
                </p>
              </div>
            ) : (
              <p className="mt-2 text-[11px] leading-snug text-foreground/45">
                그래프를 고르면 절편·점·기울기 설명을 켤 수 있어요. 그래프를
                여러 개 올리면 한 그림에 겹칩니다.
              </p>
            )}
          </section>

          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-sm text-wood-dark">그래프</h2>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => {
                  const next = addLinearGraph(state);
                  setState(next);
                  const added = next.graphs[next.graphs.length - 1];
                  if (added) setSelectedId(added.id);
                }}
                className="rounded-xl bg-wood px-2.5 py-1 text-xs font-semibold text-cream"
              >
                y=ax+b
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = addVerticalGraph(state);
                  setState(next);
                  const added = next.graphs[next.graphs.length - 1];
                  if (added) setSelectedId(added.id);
                }}
                className="rounded-xl bg-black/5 px-2.5 py-1 text-xs font-semibold text-foreground/70 hover:bg-black/10"
              >
                x=a
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = addHorizontalGraph(state);
                  setState(next);
                  const added = next.graphs[next.graphs.length - 1];
                  if (added) setSelectedId(added.id);
                }}
                className="rounded-xl bg-black/5 px-2.5 py-1 text-xs font-semibold text-foreground/70 hover:bg-black/10"
              >
                y=b
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
                      {linearEquationText(graph) ?? "식 숨김"}
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
                  const c = g ? pointCoords(g, point) : { x: point.x, y: "?" };
                  const y =
                    typeof c.y === "number" ? Math.round(c.y * 100) / 100 : c.y;
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
                          ({c.x}, {y})
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
          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <h2 className="font-display text-sm text-wood-dark">빠른 그림</h2>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {LINEAR_FUNCTION_PRESETS.map((preset) => (
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
          </details>
        </div>
      </div>
    </div>
  );
}
