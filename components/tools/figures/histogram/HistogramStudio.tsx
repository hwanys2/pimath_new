"use client";

import { Noto_Serif, Noto_Serif_KR } from "next/font/google";
import Link from "next/link";
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import {
  ChipToggle,
  InlineNumber,
  Segmented,
  SliderField,
  TextField,
} from "@/components/tools/figures/controls";
import HistogramCanvas, {
  type HistogramSetter,
} from "@/components/tools/figures/histogram/HistogramCanvas";
import {
  canvasToPngBlob,
  copyPngToClipboard,
  downloadBlob,
} from "@/lib/diagrams/export-image";
import {
  addCompareSeries,
  classBound,
  classEnd,
  cloneState,
  DEFAULT_HISTOGRAM_STATE,
  FILL_CYAN,
  FILL_PINK,
  formatTick,
  GRAPH_CYAN,
  GRAPH_PINK,
  HISTOGRAM_PRESETS,
  normalizeState,
  patchSeries,
  removeSeries,
  setFrequency,
  type HistogramKind,
  type HistogramState,
} from "@/lib/diagrams/histogram/model";
import { buildHistogramScene } from "@/lib/diagrams/histogram/scene";
import { renderSceneToCanvas, sceneToSvg } from "@/lib/diagrams/render";
import type { FontFaces } from "@/lib/diagrams/math-label";

const STORAGE_KEY = "pm-diagram-g1-histogram-v1";

const storeListeners = new Set<() => void>();

let cachedRaw: string | null = null;
let cachedState: HistogramState = DEFAULT_HISTOGRAM_STATE;
let cacheReady = false;

function parseStoredState(raw: string | null): HistogramState {
  if (!raw) return DEFAULT_HISTOGRAM_STATE;
  try {
    const parsed = JSON.parse(raw) as HistogramState;
    if (
      parsed &&
      Array.isArray(parsed.series) &&
      typeof parsed.classStart === "number" &&
      parsed.style
    ) {
      return normalizeState(parsed);
    }
  } catch {
    /* keep default */
  }
  return DEFAULT_HISTOGRAM_STATE;
}

function getServerSnapshot(): HistogramState {
  return DEFAULT_HISTOGRAM_STATE;
}

function getClientSnapshot(): HistogramState {
  if (!cacheReady) {
    cacheReady = true;
    cachedRaw = window.localStorage.getItem(STORAGE_KEY);
    cachedState = parseStoredState(cachedRaw);
  }
  return cachedState;
}

function writeStoredState(state: HistogramState, persist = true) {
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

function useHistogramState() {
  const state = useSyncExternalStore(
    subscribeStoredState,
    getClientSnapshot,
    getServerSnapshot,
  );
  const setState = useCallback<HistogramSetter>((updater, persist = true) => {
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
  { id: GRAPH_CYAN, fill: FILL_CYAN, label: "청록" },
  { id: GRAPH_PINK, fill: FILL_PINK, label: "분홍" },
];

const compactInputClass =
  "w-full min-w-0 rounded-xl border-2 border-wood/20 bg-white px-2 py-1.5 text-sm tabular-nums outline-none focus:border-wood";

function CompactNumber({
  label,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <label className="min-w-0">
      <span className="text-xs font-semibold text-foreground/60">{label}</span>
      <input
        type="number"
        aria-label={label}
        value={Number.isFinite(value) ? value : 0}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`mt-1 ${compactInputClass}`}
      />
    </label>
  );
}

export default function HistogramStudio() {
  const [state, setState] = useHistogramState();
  const [status, setStatus] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(
    () => state.series[0]?.id ?? null,
  );
  const fonts = useMemo(() => fontsFromNext(), []);

  const selectedSeries =
    state.series.find((s) => s.id === selectedId) ?? state.series[0] ?? null;

  const set = useCallback(
    (patch: Partial<HistogramState>) => {
      setState((prev) => normalizeState({ ...prev, ...patch }));
    },
    [setState],
  );

  async function exportPng() {
    await document.fonts.ready;
    const scene = buildHistogramScene(state);
    const canvas = renderSceneToCanvas(
      scene,
      fonts,
      state.style.lineWidth,
      state.style.exportScale,
    );
    const blob = await canvasToPngBlob(canvas);
    downloadBlob(blob, "히스토그램.png");
    setStatus("PNG를 저장했어요.");
  }

  async function copyPng() {
    await document.fonts.ready;
    const scene = buildHistogramScene(state);
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
    const scene = buildHistogramScene(state);
    const svg = sceneToSvg(scene, fonts, state.style.lineWidth);
    downloadBlob(
      new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
      "히스토그램.svg",
    );
    setStatus("SVG를 저장했어요.");
  }

  const canBreak = state.classStart > 1e-9;
  const classEndValue = classEnd(state);

  function setClassStartKeepEnd(classStart: number) {
    const width = (classEndValue - classStart) / state.classCount;
    if (!(width >= 0.01)) return;
    set({ classStart, classWidth: width });
  }

  function setClassEndKeepStart(end: number) {
    const width = (end - state.classStart) / state.classCount;
    if (!(width >= 0.01)) return;
    set({ classWidth: width });
  }

  function setClassCountKeepRange(classCount: number) {
    const count = Math.min(12, Math.max(3, Math.round(classCount)));
    const width = (classEndValue - state.classStart) / count;
    if (!(width >= 0.01)) return;
    set({ classCount: count, classWidth: width });
  }

  return (
    <div className={`${notoSerif.variable} ${notoSerifKr.variable} space-y-4`}>
      <span
        className={`${notoSerif.className} ${notoSerifKr.className} sr-only italic`}
        style={{ fontFamily: '"Times New Roman", serif' }}
        aria-hidden
      >
        xxyy OO AA cm 가
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
            히스토그램
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-foreground/65">
            계급을 맞추고 막대나 점을 끌어 도수를 그립니다. 버튼으로
            히스토그램과 도수분포다각형을 바꿉니다. 다각형에서는 비교 그래프를
            하나 더 올릴 수 있어요.
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
            <HistogramCanvas
              state={state}
              fonts={fonts}
              selectedId={selectedSeries?.id ?? null}
              setState={setState}
              persist={persistCachedState}
              onSelect={setSelectedId}
            />
          </div>

          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <h2 className="font-display text-sm text-wood-dark">계급·축</h2>
            <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-2">
              <div className="col-span-2">
                <p className="text-xs font-semibold text-foreground/60">계급</p>
                <div className="mt-1 grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
                  <input
                    type="number"
                    aria-label="계급 시작"
                    value={Number.isFinite(state.classStart) ? state.classStart : 0}
                    step={0.5}
                    onChange={(e) => setClassStartKeepEnd(Number(e.target.value))}
                    className={compactInputClass}
                  />
                  <span className="text-sm text-foreground/40">~</span>
                  <input
                    type="number"
                    aria-label="계급 끝"
                    value={Number.isFinite(classEndValue) ? classEndValue : 0}
                    step={0.5}
                    onChange={(e) => setClassEndKeepStart(Number(e.target.value))}
                    className={compactInputClass}
                  />
                </div>
              </div>
              <CompactNumber
                label="크기"
                value={state.classWidth}
                onChange={(classWidth) => set({ classWidth })}
                min={0.01}
                step={0.5}
              />
              <CompactNumber
                label="개수"
                value={state.classCount}
                onChange={setClassCountKeepRange}
                min={3}
                max={12}
                step={1}
              />
              <label className="min-w-0">
                <span className="text-xs font-semibold text-foreground/60">
                  가로축
                </span>
                <input
                  type="text"
                  aria-label="가로축 이름"
                  value={state.xAxisLabel}
                  placeholder="(%)"
                  onChange={(e) => set({ xAxisLabel: e.target.value })}
                  className={`mt-1 w-full min-w-0 rounded-xl border-2 border-wood/20 bg-white px-2 py-1.5 text-sm outline-none focus:border-wood`}
                />
              </label>
              <label className="min-w-0">
                <span className="text-xs font-semibold text-foreground/60">
                  세로축
                </span>
                <input
                  type="text"
                  aria-label="세로축 이름"
                  value={state.yAxisLabel}
                  placeholder="(일)"
                  onChange={(e) => set({ yAxisLabel: e.target.value })}
                  className={`mt-1 w-full min-w-0 rounded-xl border-2 border-wood/20 bg-white px-2 py-1.5 text-sm outline-none focus:border-wood`}
                />
              </label>
              <p className="col-span-2 text-[11px] text-foreground/45">
                그림에서 축 이름·제목을 끌어 위치를 조절할 수 있어요.
              </p>
              <CompactNumber
                label="최댓값"
                value={state.yMax}
                onChange={(yMax) => set({ yMax })}
                min={state.yTick}
                step={state.yTick}
              />
              <CompactNumber
                label="눈금"
                value={state.yTick}
                onChange={(yTick) => set({ yTick })}
                min={0.001}
                step={0.1}
              />
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <h2 className="font-display text-sm text-wood-dark">보기</h2>
            <div className="mt-2">
              <Segmented<HistogramKind>
                value={state.kind}
                onChange={(kind) => set({ kind })}
                options={[
                  { id: "histogram", label: "히스토그램" },
                  { id: "polygon", label: "다각형" },
                ]}
              />
            </div>
            <p className="mt-2 text-[11px] text-foreground/45">
              같은 도수를 막대와 점으로 바꿉니다. 다각형은 양쪽 계급값에서
              도수 0으로 닫혀요.
            </p>
          </section>

          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <h2 className="font-display text-sm text-wood-dark">그래프</h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {state.series.map((s, i) => (
                <ChipToggle
                  key={s.id}
                  on={selectedSeries?.id === s.id}
                  onClick={() => setSelectedId(s.id)}
                >
                  {s.name.trim() || `그래프 ${i + 1}`}
                </ChipToggle>
              ))}
            </div>
            {state.kind === "polygon" ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {state.series.length < 2 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setState((prev) => {
                        const next = addCompareSeries(prev);
                        const added = next.series[next.series.length - 1];
                        if (added) setSelectedId(added.id);
                        return next;
                      });
                    }}
                    className="rounded-full bg-black/5 px-2.5 py-1 text-xs font-semibold text-foreground/60 hover:bg-black/10"
                  >
                    비교 그래프 추가
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (!selectedSeries) return;
                      setState((prev) => {
                        const next = removeSeries(prev, selectedSeries.id);
                        setSelectedId(next.series[0]?.id ?? null);
                        return next;
                      });
                    }}
                    className="rounded-full bg-black/5 px-2.5 py-1 text-xs font-semibold text-foreground/60 hover:bg-black/10"
                  >
                    그래프 지우기
                  </button>
                )}
              </div>
            ) : null}
            {selectedSeries ? (
              <div className="mt-3 space-y-2">
                <TextField
                  label="이름"
                  value={selectedSeries.name}
                  onChange={(name) =>
                    setState((prev) =>
                      patchSeries(prev, selectedSeries.id, { name }),
                    )
                  }
                  placeholder="예: 학교 A"
                />
                <div>
                  <p className="text-xs font-semibold text-foreground/60">색</p>
                  <div className="mt-1 flex gap-1.5">
                    {COLORS.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() =>
                          setState((prev) =>
                            patchSeries(prev, selectedSeries.id, {
                              color: c.id,
                              fill: c.fill,
                            }),
                          )
                        }
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          selectedSeries.color === c.id
                            ? "bg-wood text-cream"
                            : "bg-black/5 text-foreground/60 hover:bg-black/10"
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground/60">도수</p>
                  <div className="mt-1.5 space-y-1">
                    {selectedSeries.frequencies.map((freq, i) => (
                      <label
                        key={i}
                        className="flex items-center gap-1.5 text-xs font-semibold text-foreground/55"
                      >
                        <span className="w-[4.8rem] shrink-0 tabular-nums">
                          {formatTick(classBound(state, i))}
                          –
                          {formatTick(classBound(state, i + 1))}
                        </span>
                        <InlineNumber
                          ariaLabel={`${formatTick(classBound(state, i))} 계급 도수`}
                          value={freq}
                          min={0}
                          step={state.yTick}
                          className="min-w-0 flex-1"
                          onChange={(n) =>
                            setState((prev) =>
                              setFrequency(prev, selectedSeries.id, i, n),
                            )
                          }
                        />
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <h2 className="font-display text-sm text-wood-dark">표시</h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <ChipToggle
                on={state.showGrid}
                onClick={() => set({ showGrid: !state.showGrid })}
              >
                격자
              </ChipToggle>
              <ChipToggle
                on={state.xBreak && canBreak}
                onClick={() => {
                  if (!canBreak) return;
                  set({ xBreak: !state.xBreak });
                }}
              >
                x축 끊기
              </ChipToggle>
              <ChipToggle
                on={state.showPoints}
                onClick={() => set({ showPoints: !state.showPoints })}
              >
                점 표시
              </ChipToggle>
              <ChipToggle
                on={state.showTitle}
                onClick={() => set({ showTitle: !state.showTitle })}
              >
                제목
              </ChipToggle>
            </div>
            {state.showTitle ? (
              <div className="mt-2">
                <TextField
                  label="제목"
                  value={state.title}
                  onChange={(title) => set({ title, showTitle: true })}
                  placeholder="예: 습도별 일수"
                />
              </div>
            ) : null}
            {!canBreak ? (
              <p className="mt-2 text-[11px] text-foreground/45">
                계급 시작이 0보다 클 때 x축을 끊을 수 있어요.
              </p>
            ) : null}
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <h2 className="font-display text-sm text-wood-dark">빠른 그림</h2>
            <div className="mt-2 grid grid-cols-1 gap-1.5">
              {HISTOGRAM_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    const next = cloneState(preset.state);
                    setState(next);
                    setSelectedId(next.series[0]?.id ?? null);
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

          <details open className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
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
                min={10}
                max={28}
                step={1}
              />
              <SliderField
                label="이름"
                value={state.style.pointLabelSize}
                onChange={(pointLabelSize) =>
                  set({ style: { ...state.style, pointLabelSize } })
                }
                min={12}
                max={36}
                step={1}
              />
              <SliderField
                label="축 이름"
                value={state.style.axisNameSize}
                onChange={(axisNameSize) =>
                  set({ style: { ...state.style, axisNameSize } })
                }
                min={12}
                max={36}
                step={1}
              />
              <SliderField
                label="제목"
                value={state.style.titleSize}
                onChange={(titleSize) =>
                  set({ style: { ...state.style, titleSize } })
                }
                min={12}
                max={40}
                step={1}
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
              <SliderField
                label="축 굵기"
                value={state.style.lineWidth}
                onChange={(lineWidth) =>
                  set({ style: { ...state.style, lineWidth } })
                }
                min={1}
                max={3}
                step={0.1}
                display={state.style.lineWidth.toFixed(1)}
              />
              <SliderField
                label="다각형 선"
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
                label="여백"
                value={state.style.padding}
                onChange={(padding) =>
                  set({ style: { ...state.style, padding } })
                }
                min={40}
                max={96}
                step={2}
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
