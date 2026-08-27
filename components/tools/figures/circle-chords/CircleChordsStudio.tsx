"use client";

import { Noto_Serif, Noto_Serif_KR } from "next/font/google";
import Link from "next/link";
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import CircleChordsCanvas, {
  type CircleChordsSetter,
} from "@/components/tools/figures/circle-chords/CircleChordsCanvas";
import {
  ChipToggle,
  Segmented,
  SliderField,
} from "@/components/tools/figures/circle-chords/controls";
import { cycleLabelMode, mapChord } from "@/lib/diagrams/circle-chords/geometry";
import {
  CIRCLE_CHORD_PRESETS,
  cloneState,
  DEFAULT_CIRCLE_CHORDS_STATE,
  withSnappedChords,
  type CircleChordsState,
  type ChordDraft,
} from "@/lib/diagrams/circle-chords/model";
import { buildCircleChordsScene } from "@/lib/diagrams/circle-chords/scene";
import {
  renderSceneToCanvas,
  sceneToSvg,
} from "@/lib/diagrams/circle-chords/render";
import {
  canvasToPngBlob,
  copyPngToClipboard,
  downloadBlob,
} from "@/lib/diagrams/export-image";
import type { FontFaces } from "@/lib/diagrams/math-label";

const STORAGE_KEY = "pm-diagram-g3-circle-chords-v2";

const storeListeners = new Set<() => void>();

let cachedRaw: string | null = null;
let cachedState: CircleChordsState = DEFAULT_CIRCLE_CHORDS_STATE;
let cacheReady = false;

function parseStoredState(raw: string | null): CircleChordsState {
  if (!raw) return DEFAULT_CIRCLE_CHORDS_STATE;
  try {
    const parsed = JSON.parse(raw) as CircleChordsState;
    if (parsed && Array.isArray(parsed.chords) && parsed.radius) {
      return withSnappedChords(parsed);
    }
  } catch {
    /* keep default */
  }
  return DEFAULT_CIRCLE_CHORDS_STATE;
}

function getServerSnapshot(): CircleChordsState {
  return DEFAULT_CIRCLE_CHORDS_STATE;
}

/** Must return the same object while unchanged, or React 185 loops. */
function getClientSnapshot(): CircleChordsState {
  if (!cacheReady) {
    cacheReady = true;
    cachedRaw = window.localStorage.getItem(STORAGE_KEY);
    cachedState = parseStoredState(cachedRaw);
  }
  return cachedState;
}

function writeStoredState(state: CircleChordsState, persist = true) {
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

function useCircleChordsState() {
  const state = useSyncExternalStore(
    subscribeStoredState,
    getClientSnapshot,
    getServerSnapshot,
  );
  const setState = useCallback<CircleChordsSetter>((updater, persist = true) => {
    const prev = getClientSnapshot();
    const next = typeof updater === "function" ? updater(prev) : updater;
    if (Object.is(next, prev)) {
      if (persist) persistCachedState();
      return;
    }
    writeStoredState(next, persist);
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

export default function CircleChordsStudio() {
  const [state, setState] = useCircleChordsState();
  const [status, setStatus] = useState<string | null>(null);
  const [styleOpen, setStyleOpen] = useState(false);
  const [tool, setTool] = useState<"select" | "draw">("select");
  const [selectedId, setSelectedId] = useState<string | null>(
    () => state.chords[0]?.id ?? null,
  );
  const fonts = useMemo(() => fontsFromNext(), []);
  const selected =
    state.chords.find((c) => c.id === selectedId) ?? state.chords[0] ?? null;

  const set = useCallback(
    (patch: Partial<CircleChordsState>) => {
      setState((prev) => withSnappedChords({ ...prev, ...patch }));
    },
    [setState],
  );

  const patchSelected = useCallback(
    (patch: Partial<ChordDraft>) => {
      if (!selected) return;
      setState((prev) =>
        withSnappedChords(mapChord(prev, selected.id, (c) => ({ ...c, ...patch }))),
      );
    },
    [selected, setState],
  );

  const deleteSelected = useCallback(() => {
    const id = selected?.id;
    if (!id) return;
    const remaining = state.chords.filter((c) => c.id !== id);
    setState((prev) => ({
      ...prev,
      chords: prev.chords.filter((c) => c.id !== id),
    }));
    setSelectedId(remaining[0]?.id ?? null);
  }, [selected, state.chords, setState]);

  async function exportPng() {
    await document.fonts.ready;
    const scene = buildCircleChordsScene(state);
    const canvas = renderSceneToCanvas(
      scene,
      fonts,
      state.style.lineWidth,
      state.style.exportScale,
    );
    const blob = await canvasToPngBlob(canvas);
    downloadBlob(blob, "원의 현.png");
    setStatus("PNG를 저장했어요.");
  }

  async function copyPng() {
    await document.fonts.ready;
    const scene = buildCircleChordsScene(state);
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
    const scene = buildCircleChordsScene(state);
    const svg = sceneToSvg(scene, fonts, state.style.lineWidth);
    downloadBlob(
      new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
      "원의 현.svg",
    );
    setStatus("SVG를 저장했어요.");
  }

  return (
    <div className={`${notoSerif.variable} ${notoSerifKr.variable} space-y-4`}>
      <span
        className={`${notoSerif.className} ${notoSerifKr.className} hidden`}
        aria-hidden
      >
        x cm 가
      </span>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-wood">
            <Link href="/tools/figures" className="hover:underline">
              문제 그림 그리기
            </Link>
            <span className="mx-1.5 text-foreground/30">/</span>
            중3
          </p>
          <h1 className="font-display mt-1 text-3xl text-wood-dark sm:text-4xl">
            원의 현
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-foreground/65">
            원 위를 끌어 현을 그리세요. 점 A를 옮기면 길이는 그대로 두고 B가
            원을 따라가요. Delete로 고른 현을 지울 수 있어요.
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

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(16rem,1fr)] xl:grid-cols-[minmax(0,24rem)_20rem]">
        <div className="mx-auto w-full max-w-[24rem] overflow-hidden rounded-3xl border-2 border-wood/10 bg-white shadow-[0_12px_40px_rgba(61,44,30,0.08)] lg:mx-0">
          <CircleChordsCanvas
            state={state}
            fonts={fonts}
            tool={tool}
            selectedId={selected?.id ?? null}
            setState={setState}
            persist={persistCachedState}
            onSelect={setSelectedId}
            onToolChange={setTool}
            onDeleteSelected={deleteSelected}
          />
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <ChipToggle on={tool === "select"} onClick={() => setTool("select")}>
              옮기기
            </ChipToggle>
            <ChipToggle on={tool === "draw"} onClick={() => setTool("draw")}>
              현 그리기
            </ChipToggle>
          </div>

          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <h2 className="font-display text-sm text-wood-dark">빠른 그림</h2>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {CIRCLE_CHORD_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    const next = cloneState(preset.state);
                    setState(next);
                    setSelectedId(next.chords[0]?.id ?? null);
                    setTool("select");
                  }}
                  className="rounded-xl bg-black/5 px-2.5 py-2 text-left text-xs font-semibold text-foreground/70 hover:bg-black/10"
                >
                  {preset.title}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-sm text-wood-dark">
                {selected
                  ? `현 ${selected.startName}${selected.endName}`
                  : "현"}
              </h2>
              {selected ? (
                <button
                  type="button"
                  onClick={deleteSelected}
                  className="rounded-lg bg-black/5 px-2.5 py-1 text-xs font-semibold text-foreground/70 hover:bg-black/10"
                >
                  삭제
                </button>
              ) : null}
            </div>
            {selected ? (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <ChipToggle
                  on={selected.showRadiusStart}
                  onClick={() =>
                    patchSelected({ showRadiusStart: !selected.showRadiusStart })
                  }
                >
                  {state.centerName || "O"}
                  {selected.startName}
                </ChipToggle>
                <ChipToggle
                  on={selected.showRadiusEnd}
                  onClick={() =>
                    patchSelected({ showRadiusEnd: !selected.showRadiusEnd })
                  }
                >
                  {state.centerName || "O"}
                  {selected.endName}
                </ChipToggle>
                <ChipToggle
                  on={selected.showPerp}
                  onClick={() => patchSelected({ showPerp: !selected.showPerp })}
                >
                  수선
                </ChipToggle>
                <ChipToggle
                  on={selected.showRightAngle}
                  onClick={() =>
                    patchSelected({ showRightAngle: !selected.showRightAngle })
                  }
                >
                  직각
                </ChipToggle>
                <ChipToggle
                  on={selected.showPoints}
                  onClick={() =>
                    patchSelected({ showPoints: !selected.showPoints })
                  }
                >
                  점 이름
                </ChipToggle>
                <ChipToggle
                  on={selected.showMidpoint}
                  onClick={() =>
                    patchSelected({ showMidpoint: !selected.showMidpoint })
                  }
                >
                  중점
                </ChipToggle>
                <ChipToggle
                  on={selected.showHalf}
                  onClick={() =>
                    patchSelected({ showHalf: !selected.showHalf })
                  }
                >
                  반
                </ChipToggle>
                <ChipToggle
                  on={selected.equalTicks > 0}
                  onClick={() =>
                    patchSelected({
                      equalTicks: selected.equalTicks === 0 ? 1 : 0,
                    })
                  }
                >
                  빗금
                </ChipToggle>
                <ChipToggle
                  on={selected.chordLabel.mode !== "hide"}
                  onClick={() =>
                    patchSelected({
                      chordLabel: cycleLabelMode(selected.chordLabel),
                    })
                  }
                >
                  길이{labelModeHint(selected.chordLabel.mode, state.unknownLetter)}
                </ChipToggle>
                <ChipToggle
                  on={selected.distLabel.mode !== "hide"}
                  onClick={() =>
                    patchSelected({
                      distLabel: cycleLabelMode(selected.distLabel),
                    })
                  }
                >
                  거리{labelModeHint(selected.distLabel.mode, state.unknownLetter)}
                </ChipToggle>
              </div>
            ) : (
              <p className="mt-2 text-xs text-foreground/50">
                원 둘레를 끌어 현을 그리세요.
              </p>
            )}
            {state.chords.length > 0 ? (
              <ul className="mt-3 space-y-1">
                {state.chords.map((chord) => (
                  <li key={chord.id} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedId(chord.id)}
                      className={`flex-1 rounded-lg px-2 py-1 text-left text-xs font-semibold ${
                        chord.id === selected?.id
                          ? "bg-wood/15 text-wood-dark"
                          : "text-foreground/55 hover:bg-black/5"
                      }`}
                    >
                      {chord.startName}
                      {chord.endName}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const remaining = state.chords.filter(
                          (c) => c.id !== chord.id,
                        );
                        setState((prev) => ({
                          ...prev,
                          chords: prev.chords.filter((c) => c.id !== chord.id),
                        }));
                        if (selectedId === chord.id) {
                          setSelectedId(remaining[0]?.id ?? null);
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
            <p className="mt-2 text-[11px] leading-snug text-foreground/45">
              끝점을 더블클릭하거나 중심까지 끌면 반지름이 이어집니다. Delete
              키로도 지울 수 있어요.
            </p>
          </section>

          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <h2 className="font-display text-sm text-wood-dark">크기</h2>
            <div className="mt-2 space-y-3">
              <SliderField
                label="길이 글자"
                value={state.style.fontSize}
                onChange={(fontSize) =>
                  set({ style: { ...state.style, fontSize } })
                }
                min={14}
                max={56}
                step={1}
              />
              <SliderField
                label="점 이름"
                value={state.style.pointLabelSize}
                onChange={(pointLabelSize) =>
                  set({ style: { ...state.style, pointLabelSize } })
                }
                min={14}
                max={64}
                step={1}
              />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="text-xs font-semibold text-foreground/60">
                반지름
                <input
                  type="number"
                  min={1}
                  max={40}
                  step={0.5}
                  value={state.radius}
                  onChange={(e) => set({ radius: Number(e.target.value) })}
                  className="mt-1 w-full rounded-xl border-2 border-wood/20 bg-white px-2 py-1.5 text-sm outline-none focus:border-wood"
                />
              </label>
              <label className="text-xs font-semibold text-foreground/60">
                단위
                <input
                  value={state.unit}
                  onChange={(e) => set({ unit: e.target.value })}
                  placeholder="cm"
                  className="mt-1 w-full rounded-xl border-2 border-wood/20 bg-white px-2 py-1.5 text-sm outline-none focus:border-wood"
                />
              </label>
              <label className="text-xs font-semibold text-foreground/60">
                미지수
                <input
                  value={state.unknownLetter}
                  onChange={(e) => set({ unknownLetter: e.target.value })}
                  className="mt-1 w-full rounded-xl border-2 border-wood/20 bg-white px-2 py-1.5 text-sm outline-none focus:border-wood"
                />
              </label>
              <label className="flex items-end gap-2 pb-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={state.showCenter}
                  onChange={(e) => set({ showCenter: e.target.checked })}
                  className="accent-wood"
                />
                중심
              </label>
            </div>
            <label className="mt-2 block text-xs font-semibold text-foreground/60">
              아래 문구
              <input
                value={state.caption}
                onChange={(e) =>
                  set({
                    caption: e.target.value,
                    showCaption: e.target.value.trim().length > 0,
                  })
                }
                placeholder="x를 구하시오."
                className="mt-1 w-full rounded-xl border-2 border-wood/20 bg-white px-2 py-1.5 text-sm font-normal outline-none focus:border-wood"
              />
            </label>
          </section>

          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <button
              type="button"
              onClick={() => setStyleOpen((v) => !v)}
              className="flex w-full items-center justify-between"
            >
              <h2 className="font-display text-sm text-wood-dark">그림 스타일</h2>
              <span className="text-xs text-foreground/45">
                {styleOpen ? "접기" : "선 · 여백"}
              </span>
            </button>
            {styleOpen ? (
              <div className="mt-3 space-y-3">
                <SliderField
                  label="선 굵기"
                  value={state.style.lineWidth}
                  onChange={(lineWidth) =>
                    set({ style: { ...state.style, lineWidth } })
                  }
                  min={1}
                  max={3.5}
                  step={0.1}
                  display={state.style.lineWidth.toFixed(1)}
                />
                <SliderField
                  label="설명선 기본 간격"
                  value={state.style.dimOffset}
                  onChange={(dimOffset) =>
                    set({ style: { ...state.style, dimOffset } })
                  }
                  min={10}
                  max={80}
                  step={1}
                />
                <SliderField
                  label="직각 표시 크기"
                  value={state.style.rightAngleSize}
                  onChange={(rightAngleSize) =>
                    set({ style: { ...state.style, rightAngleSize } })
                  }
                  min={6}
                  max={20}
                  step={1}
                />
                <SliderField
                  label="여백"
                  value={state.style.padding}
                  onChange={(padding) =>
                    set({ style: { ...state.style, padding } })
                  }
                  min={36}
                  max={90}
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
                <SliderField
                  label="아래 문구 크기"
                  value={state.style.captionSize}
                  onChange={(captionSize) =>
                    set({ style: { ...state.style, captionSize } })
                  }
                  min={14}
                  max={48}
                  step={1}
                />
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}

function labelModeHint(
  mode: ChordDraft["chordLabel"]["mode"],
  unknown: string,
): string {
  if (mode === "x") return ` ${unknown}`;
  if (mode === "hide") return " 숨김";
  if (mode === "custom") return " 직접";
  return "";
}
