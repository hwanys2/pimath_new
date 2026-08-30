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
import BoxPlotCanvas, {
  type BoxPlotSetter,
} from "@/components/tools/figures/boxplot/BoxPlotCanvas";
import {
  canvasToPngBlob,
  copyPngToClipboard,
  downloadBlob,
} from "@/lib/diagrams/export-image";
import {
  addSeries,
  BOX_PALETTE,
  BOXPLOT_PRESETS,
  cloneState,
  dataRange,
  DEFAULT_BOXPLOT_STATE,
  fitAxisToData,
  formatTick,
  iqr,
  MAX_SERIES,
  normalizeState,
  PILL_COLORS,
  patchSeries,
  removeSeries,
  setStat,
  STAT_KEYS,
  STAT_LABELS,
  type BoxOrientation,
  type BoxPlotState,
} from "@/lib/diagrams/boxplot/model";
import { buildBoxPlotScene } from "@/lib/diagrams/boxplot/scene";
import { renderSceneToCanvas, sceneToSvg } from "@/lib/diagrams/render";
import type { FontFaces } from "@/lib/diagrams/math-label";

const STORAGE_KEY = "pm-diagram-g3-boxplot-v1";

const storeListeners = new Set<() => void>();

let cachedRaw: string | null = null;
let cachedState: BoxPlotState = DEFAULT_BOXPLOT_STATE;
let cacheReady = false;

function parseStoredState(raw: string | null): BoxPlotState {
  if (!raw) return DEFAULT_BOXPLOT_STATE;
  try {
    const parsed = JSON.parse(raw) as BoxPlotState;
    if (
      parsed &&
      Array.isArray(parsed.series) &&
      typeof parsed.axisMin === "number" &&
      parsed.style
    ) {
      return normalizeState(parsed);
    }
  } catch {
    /* keep default */
  }
  return DEFAULT_BOXPLOT_STATE;
}

function getServerSnapshot(): BoxPlotState {
  return DEFAULT_BOXPLOT_STATE;
}

function getClientSnapshot(): BoxPlotState {
  if (!cacheReady) {
    cacheReady = true;
    cachedRaw = window.localStorage.getItem(STORAGE_KEY);
    cachedState = parseStoredState(cachedRaw);
  }
  return cachedState;
}

function writeStoredState(state: BoxPlotState, persist = true) {
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

function useBoxPlotState() {
  const state = useSyncExternalStore(
    subscribeStoredState,
    getClientSnapshot,
    getServerSnapshot,
  );
  const setState = useCallback<BoxPlotSetter>((updater, persist = true) => {
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

const compactInputClass =
  "w-full min-w-0 rounded-xl border-2 border-wood/20 bg-white px-2 py-1.5 text-sm tabular-nums outline-none focus:border-wood";

function CompactNumber({
  label,
  value,
  onChange,
  min,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (Number.isFinite(value) ? String(value) : "");

  function commit(raw: string) {
    const n = Number(raw);
    if (raw.trim() === "" || !Number.isFinite(n)) {
      setDraft(null);
      return;
    }
    onChange(n);
    setDraft(null);
  }

  return (
    <label className="min-w-0">
      <span className="text-xs font-semibold text-foreground/60">{label}</span>
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        aria-label={label}
        value={shown}
        onChange={(e) => {
          const raw = e.target.value;
          setDraft(raw);
          if (raw.trim() === "" || raw.endsWith(".") || raw.endsWith("-")) return;
          const n = Number(raw);
          if (!Number.isFinite(n)) return;
          if (min != null && n < min) return;
          onChange(n);
        }}
        onBlur={() => commit(draft ?? shown)}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className={`mt-1 ${compactInputClass}`}
      />
    </label>
  );
}

export default function BoxPlotStudio() {
  const [state, setState] = useBoxPlotState();
  const [status, setStatus] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(
    () => state.series[0]?.id ?? null,
  );
  const fonts = useMemo(() => fontsFromNext(), []);

  const selectedSeries =
    state.series.find((s) => s.id === selectedId) ?? state.series[0] ?? null;

  const set = useCallback(
    (patch: Partial<BoxPlotState>) => {
      setState((prev) => normalizeState({ ...prev, ...patch }));
    },
    [setState],
  );

  async function exportPng() {
    await document.fonts.ready;
    const scene = buildBoxPlotScene(state);
    const canvas = renderSceneToCanvas(
      scene,
      fonts,
      state.style.lineWidth,
      state.style.exportScale,
    );
    const blob = await canvasToPngBlob(canvas);
    downloadBlob(blob, "상자수염 그림.png");
    setStatus("PNG를 저장했어요.");
  }

  async function copyPng() {
    await document.fonts.ready;
    const scene = buildBoxPlotScene(state);
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
    const scene = buildBoxPlotScene(state);
    const svg = sceneToSvg(scene, fonts, state.style.lineWidth);
    downloadBlob(
      new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
      "상자수염 그림.svg",
    );
    setStatus("SVG를 저장했어요.");
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
            <Link href="/tools/figures?grade=3" className="hover:underline">
              문제 그림 그리기
            </Link>
            <span className="mx-1.5 text-foreground/30">/</span>
            중3
          </p>
          <h1 className="font-display mt-1 text-3xl text-wood-dark sm:text-4xl">
            상자수염 그림
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-foreground/65">
            가로·세로로 그리고, 상자를 여러 개 올려 비교할 수 있어요. 다섯 값을
            그림에서 끌어 바로 맞춘 뒤 PNG로 저장하세요.
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
            <BoxPlotCanvas
              state={state}
              fonts={fonts}
              selectedId={selectedSeries?.id ?? null}
              setState={setState}
              persist={persistCachedState}
              onSelect={setSelectedId}
            />
          </div>

          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <h2 className="font-display text-sm text-wood-dark">방향·축</h2>
            <div className="mt-2">
              <Segmented<BoxOrientation>
                value={state.orientation}
                onChange={(orientation) => set({ orientation })}
                options={[
                  { id: "horizontal", label: "가로" },
                  { id: "vertical", label: "세로" },
                ]}
              />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-2">
              <div className="col-span-2">
                <p className="text-xs font-semibold text-foreground/60">축</p>
                <div className="mt-1 grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
                  <input
                    type="number"
                    aria-label="축 시작"
                    value={Number.isFinite(state.axisMin) ? state.axisMin : 0}
                    step={state.majorTick}
                    onChange={(e) => set({ axisMin: Number(e.target.value) })}
                    className={compactInputClass}
                  />
                  <span className="text-sm text-foreground/40">~</span>
                  <input
                    type="number"
                    aria-label="축 끝"
                    value={Number.isFinite(state.axisMax) ? state.axisMax : 0}
                    step={state.majorTick}
                    onChange={(e) => set({ axisMax: Number(e.target.value) })}
                    className={compactInputClass}
                  />
                </div>
              </div>
              <CompactNumber
                label="눈금"
                value={state.majorTick}
                onChange={(majorTick) => set({ majorTick })}
                min={0.01}
              />
              <CompactNumber
                label="격자"
                value={state.gridStep}
                onChange={(gridStep) => set({ gridStep })}
                min={0.01}
              />
              <label className="col-span-2 min-w-0">
                <span className="text-xs font-semibold text-foreground/60">
                  단위
                </span>
                <input
                  type="text"
                  aria-label="축 단위"
                  value={state.axisLabel}
                  placeholder="(cm)"
                  onChange={(e) => set({ axisLabel: e.target.value })}
                  className={`mt-1 w-full min-w-0 rounded-xl border-2 border-wood/20 bg-white px-2 py-1.5 text-sm outline-none focus:border-wood`}
                />
              </label>
              <p className="col-span-2 text-[11px] text-foreground/45">
                그림에서 다섯 값을 끌어 바꿉니다. 축이 좁으면 아래 버튼으로
                맞출 수 있어요.
              </p>
              <button
                type="button"
                onClick={() => setState((prev) => fitAxisToData(prev))}
                className="col-span-2 rounded-xl bg-black/5 px-2.5 py-1.5 text-xs font-semibold text-foreground/70 hover:bg-black/10"
              >
                축을 데이터에 맞추기
              </button>
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <h2 className="font-display text-sm text-wood-dark">상자</h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {state.series.map((s, i) => (
                <ChipToggle
                  key={s.id}
                  on={selectedSeries?.id === s.id}
                  onClick={() => setSelectedId(s.id)}
                >
                  {s.name.trim() || `상자 ${i + 1}`}
                </ChipToggle>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {state.series.length < MAX_SERIES ? (
                <button
                  type="button"
                  onClick={() => {
                    setState((prev) => {
                      const next = addSeries(prev);
                      const added = next.series[next.series.length - 1];
                      if (added) setSelectedId(added.id);
                      return next;
                    });
                  }}
                  className="rounded-full bg-black/5 px-2.5 py-1 text-xs font-semibold text-foreground/60 hover:bg-black/10"
                >
                  상자 추가
                </button>
              ) : null}
              {state.series.length > 1 && selectedSeries ? (
                <button
                  type="button"
                  onClick={() => {
                    setState((prev) => {
                      const next = removeSeries(prev, selectedSeries.id);
                      setSelectedId(next.series[0]?.id ?? null);
                      return next;
                    });
                  }}
                  className="rounded-full bg-black/5 px-2.5 py-1 text-xs font-semibold text-foreground/60 hover:bg-black/10"
                >
                  상자 지우기
                </button>
              ) : null}
            </div>
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
                  placeholder="예: 공장 A"
                />
                <div>
                  <p className="text-xs font-semibold text-foreground/60">상자 색</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {BOX_PALETTE.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() =>
                          setState((prev) =>
                            patchSeries(prev, selectedSeries.id, { fill: c.fill }),
                          )
                        }
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          selectedSeries.fill === c.fill
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
                  <p className="text-xs font-semibold text-foreground/60">이름 색</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {PILL_COLORS.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() =>
                          setState((prev) =>
                            patchSeries(prev, selectedSeries.id, {
                              pillFill: c.fill,
                            }),
                          )
                        }
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          selectedSeries.pillFill === c.fill
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
                  <p className="text-xs font-semibold text-foreground/60">
                    다섯 값
                  </p>
                  <div className="mt-1.5 space-y-1">
                    {STAT_KEYS.map((key) => (
                      <label
                        key={key}
                        className="flex items-center gap-1.5 text-xs font-semibold text-foreground/55"
                      >
                        <span className="w-[3.6rem] shrink-0">{STAT_LABELS[key]}</span>
                        <InlineNumber
                          ariaLabel={STAT_LABELS[key]}
                          value={selectedSeries.values[key]}
                          step={state.gridStep >= 1 ? 1 : state.gridStep}
                          className="min-w-0 flex-1"
                          onChange={(n) =>
                            setState((prev) =>
                              setStat(prev, selectedSeries.id, key, n, "cascade"),
                            )
                          }
                        />
                      </label>
                    ))}
                    <div className="flex items-center gap-1.5 border-t border-wood/10 pt-1.5 text-xs font-semibold text-foreground/70">
                      <span className="w-[3.6rem] shrink-0">IQR</span>
                      <span
                        className="min-w-0 flex-1 rounded-lg border-2 border-wood/10 bg-black/[0.03] px-1.5 py-1 text-center text-sm tabular-nums text-foreground/80"
                        aria-label="사분위수 범위"
                      >
                        {formatTick(iqr(selectedSeries.values))}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground/70">
                      <span className="w-[3.6rem] shrink-0">범위</span>
                      <span
                        className="min-w-0 flex-1 rounded-lg border-2 border-wood/10 bg-black/[0.03] px-1.5 py-1 text-center text-sm tabular-nums text-foreground/80"
                        aria-label="범위"
                      >
                        {formatTick(dataRange(selectedSeries.values))}
                      </span>
                    </div>
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
                on={state.showFrame}
                onClick={() => set({ showFrame: !state.showFrame })}
              >
                테두리
              </ChipToggle>
              <ChipToggle
                on={state.showValueArrows}
                onClick={() => set({ showValueArrows: !state.showValueArrows })}
              >
                값 화살표
              </ChipToggle>
              <ChipToggle
                on={state.showNamePills}
                onClick={() => set({ showNamePills: !state.showNamePills })}
              >
                이름 알약
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
                  placeholder="예: 나무의 높이"
                />
              </div>
            ) : null}
            <p className="mt-2 text-[11px] text-foreground/45">
              제목·단위·이름은 그림에서 끌어 옮길 수 있어요.
            </p>
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <h2 className="font-display text-sm text-wood-dark">빠른 그림</h2>
            <div className="mt-2 grid grid-cols-1 gap-1.5">
              {BOXPLOT_PRESETS.map((preset) => (
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
                label="선 굵기"
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
                label="여백"
                value={state.style.padding}
                onChange={(padding) =>
                  set({ style: { ...state.style, padding } })
                }
                min={36}
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
