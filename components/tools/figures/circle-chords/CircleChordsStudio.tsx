"use client";

import { Noto_Serif, Noto_Serif_KR } from "next/font/google";
import Link from "next/link";
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import ChordCard from "@/components/tools/figures/circle-chords/ChordCard";
import CircleChordsCanvas from "@/components/tools/figures/circle-chords/CircleChordsCanvas";
import {
  NumberField,
  Panel,
  Segmented,
  SliderField,
  TextField,
} from "@/components/tools/figures/circle-chords/controls";
import {
  addChord,
  CIRCLE_CHORD_PRESETS,
  cloneState,
  DEFAULT_CIRCLE_CHORDS_STATE,
  withSnappedChords,
  type CircleChordsState,
  type ChordDraft,
  type MeasLabel,
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

const STORAGE_KEY = "pm-diagram-g3-circle-chords-v1";

const storeListeners = new Set<() => void>();

function readStoredState(): CircleChordsState {
  if (typeof window === "undefined") return DEFAULT_CIRCLE_CHORDS_STATE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CIRCLE_CHORDS_STATE;
    const parsed = JSON.parse(raw) as CircleChordsState;
    if (parsed && Array.isArray(parsed.chords) && parsed.radius) {
      return withSnappedChords(parsed);
    }
  } catch {
    /* keep default */
  }
  return DEFAULT_CIRCLE_CHORDS_STATE;
}

function writeStoredState(state: CircleChordsState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota */
  }
  storeListeners.forEach((listener) => listener());
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
    readStoredState,
    () => DEFAULT_CIRCLE_CHORDS_STATE,
  );
  const setState = useCallback(
    (updater: CircleChordsState | ((prev: CircleChordsState) => CircleChordsState)) => {
      const prev = readStoredState();
      const next = typeof updater === "function" ? updater(prev) : updater;
      writeStoredState(next);
    },
    [],
  );
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
  const fonts = useMemo(() => fontsFromNext(), []);

  const set = useCallback((patch: Partial<CircleChordsState>) => {
    setState((prev) => withSnappedChords({ ...prev, ...patch }));
  }, [setState]);

  const patchChord = useCallback((id: string, patch: Partial<ChordDraft>) => {
    setState((prev) =>
      withSnappedChords({
        ...prev,
        chords: prev.chords.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      }),
    );
  }, [setState]);

  const nudgeLabel = useCallback((id: string, dx: number, dy: number) => {
    setState((prev) => {
      const sep = id.lastIndexOf(":");
      if (sep < 0) return prev;
      const chordId = id.slice(0, sep);
      const key = id.slice(sep + 1);
      const labelKeys = new Set([
        "chordLabel",
        "distLabel",
        "halfLabel",
        "radiusLabel",
      ]);
      if (!labelKeys.has(key)) return prev;
      return {
        ...prev,
        chords: prev.chords.map((c) => {
          if (c.id !== chordId) return c;
          const label = c[key as keyof ChordDraft];
          if (!label || typeof label !== "object" || !("mode" in label)) {
            return c;
          }
          const m = label as MeasLabel;
          return { ...c, [key]: { ...m, dx: m.dx + dx, dy: m.dy + dy } };
        }),
      };
    });
  }, [setState]);

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

  function resetLabelPositions() {
    setState((prev) => ({
      ...prev,
      chords: prev.chords.map((c) => ({
        ...c,
        chordLabel: { ...c.chordLabel, dx: 0, dy: 0 },
        distLabel: { ...c.distLabel, dx: 0, dy: 0 },
        halfLabel: { ...c.halfLabel, dx: 0, dy: 0 },
        radiusLabel: { ...c.radiusLabel, dx: 0, dy: 0 },
      })),
    }));
  }

  return (
    <div
      className={`${notoSerif.variable} ${notoSerifKr.variable} space-y-5`}
    >
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
          <p className="mt-1 max-w-xl text-sm text-foreground/65">
            길이만 바꾸면 수선·직각·설명선이 맞춰져요. 숫자 자리만{" "}
            {state.unknownLetter}로 바꾸고 PNG로 저장하세요.
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
            onClick={() => void copyPng().catch(() => setStatus("복사에 실패했어요. PNG 저장을 이용해 주세요."))}
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

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(20rem,0.95fr)]">
        <div className="lg:sticky lg:top-4">
          <div className="overflow-hidden rounded-3xl border-2 border-wood/10 bg-white shadow-[0_12px_40px_rgba(61,44,30,0.08)]">
            <CircleChordsCanvas
              state={state}
              fonts={fonts}
              onNudgeLabel={nudgeLabel}
            />
          </div>
          <p className="mt-2 text-center text-[11px] text-foreground/45">
            길이 글자를 드래그하면 겹치지 않게 옮길 수 있어요.
          </p>
        </div>

        <div className="space-y-4">
          <Panel title="빠른 그림">
            <div className="grid grid-cols-2 gap-2">
              {CIRCLE_CHORD_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setState(cloneState(preset.state))}
                  className="rounded-2xl border-2 border-wood/10 bg-white px-3 py-2.5 text-left transition hover:border-wood/30 hover:bg-cream/60"
                >
                  <span className="block text-sm font-semibold text-wood-dark">
                    {preset.title}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-foreground/50">
                    {preset.hint}
                  </span>
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="원">
            <div className="grid grid-cols-2 gap-2">
              <NumberField
                label="반지름 r"
                value={state.radius}
                onChange={(radius) => set({ radius })}
                min={1}
                max={40}
                step={0.5}
                suffix={state.unit}
              />
              <TextField
                label="단위"
                value={state.unit}
                onChange={(unit) => set({ unit })}
                placeholder="cm  또는 비우기"
              />
              <TextField
                label="중심 이름"
                value={state.centerName}
                onChange={(centerName) => set({ centerName })}
              />
              <TextField
                label="미지수 글자"
                value={state.unknownLetter}
                onChange={(unknownLetter) => set({ unknownLetter })}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={state.showCenter}
                onChange={(e) => set({ showCenter: e.target.checked })}
                className="accent-wood"
              />
              중심 점 표시
            </label>
            <SliderField
              label="그림 전체 회전"
              value={state.viewRotationDeg}
              onChange={(viewRotationDeg) => set({ viewRotationDeg })}
              min={-40}
              max={40}
              step={1}
              display={`${state.viewRotationDeg}°`}
            />
            <TextField
              label="그림 아래 문구"
              value={state.caption}
              onChange={(caption) => set({ caption })}
              placeholder="x를 구하시오."
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={state.showCaption}
                onChange={(e) => set({ showCaption: e.target.checked })}
                className="accent-wood"
              />
              아래 문구 보이기
            </label>
          </Panel>

          <Panel title="현">
            <div className="space-y-3">
              {state.chords.map((chord, i) => (
                <ChordCard
                  key={chord.id}
                  index={i}
                  chord={chord}
                  radius={state.radius}
                  unit={state.unit}
                  unknownLetter={state.unknownLetter}
                  canDelete={state.chords.length > 1}
                  onChange={(patch) => patchChord(chord.id, patch)}
                  onDelete={() =>
                    set({
                      chords: state.chords.filter((c) => c.id !== chord.id),
                    })
                  }
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={state.chords.length >= 4}
                onClick={() => setState((prev) => addChord(prev))}
                className="font-display rounded-xl bg-sky/80 px-3 py-2 text-sm text-[#1a4a6e] disabled:opacity-40"
              >
                현 추가
              </button>
              <button
                type="button"
                onClick={resetLabelPositions}
                className="rounded-xl bg-black/5 px-3 py-2 text-xs font-semibold text-foreground/60"
              >
                라벨 위치 되돌리기
              </button>
            </div>
          </Panel>

          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-4">
            <button
              type="button"
              onClick={() => setStyleOpen((v) => !v)}
              className="flex w-full items-center justify-between"
            >
              <h2 className="font-display text-base text-wood-dark">
                그림 스타일
              </h2>
              <span className="text-xs text-foreground/45">
                {styleOpen ? "접기" : "선 굵기 · 글자 · 여백"}
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
                  label="길이 글자 크기"
                  value={state.style.fontSize}
                  onChange={(fontSize) =>
                    set({ style: { ...state.style, fontSize } })
                  }
                  min={14}
                  max={32}
                  step={1}
                />
                <SliderField
                  label="점 이름 크기"
                  value={state.style.pointLabelSize}
                  onChange={(pointLabelSize) =>
                    set({ style: { ...state.style, pointLabelSize } })
                  }
                  min={14}
                  max={36}
                  step={1}
                />
                <SliderField
                  label="설명선 간격"
                  value={state.style.dimOffset}
                  onChange={(dimOffset) =>
                    set({ style: { ...state.style, dimOffset } })
                  }
                  min={10}
                  max={40}
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
                  min={48}
                  max={110}
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
                  max={28}
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
