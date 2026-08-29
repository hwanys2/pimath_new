"use client";

import { Noto_Serif, Noto_Serif_KR } from "next/font/google";
import Link from "next/link";
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import {
  ChipToggle,
  Segmented,
  SliderField,
} from "@/components/tools/figures/controls";
import RepeatingDecimalCanvas, {
  type RepeatingDecimalSetter,
} from "@/components/tools/figures/repeating-decimal/RepeatingDecimalCanvas";
import {
  canvasToPngBlob,
  copyPngToClipboard,
  downloadBlob,
} from "@/lib/diagrams/export-image";
import {
  cloneState,
  DEFAULT_REPEATING_DECIMAL_STATE,
  layoutFromState,
  MAX_PERIOD_DIGITS,
  normalizeState,
  REPEATING_DECIMAL_PRESETS,
  type RepeatingDecimalState,
} from "@/lib/diagrams/repeating-decimal/model";
import { buildRepeatingDecimalScene } from "@/lib/diagrams/repeating-decimal/scene";
import {
  parseDivisionErrorMessage,
  parseDivisionInputs,
} from "@/lib/diagrams/repeating-decimal/division";
import { renderSceneToCanvas, sceneToSvg } from "@/lib/diagrams/render";
import type { FontFaces } from "@/lib/diagrams/math-label";

const STORAGE_KEY = "pm-diagram-g2-repeating-decimal-v1";

const storeListeners = new Set<() => void>();

let cachedRaw: string | null = null;
let cachedState: RepeatingDecimalState = DEFAULT_REPEATING_DECIMAL_STATE;
let cacheReady = false;

function parseStoredState(raw: string | null): RepeatingDecimalState {
  if (!raw) return DEFAULT_REPEATING_DECIMAL_STATE;
  try {
    const parsed = JSON.parse(raw) as RepeatingDecimalState;
    if (parsed && parsed.style && typeof parsed.dividendInput === "string") {
      return normalizeState(parsed);
    }
  } catch {
    /* keep default */
  }
  return DEFAULT_REPEATING_DECIMAL_STATE;
}

function getServerSnapshot(): RepeatingDecimalState {
  return DEFAULT_REPEATING_DECIMAL_STATE;
}

function getClientSnapshot(): RepeatingDecimalState {
  if (!cacheReady) {
    cacheReady = true;
    cachedRaw = window.localStorage.getItem(STORAGE_KEY);
    cachedState = parseStoredState(cachedRaw);
  }
  return cachedState;
}

function writeStoredState(state: RepeatingDecimalState, persist = true) {
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

function useRepeatingDecimalState() {
  const state = useSyncExternalStore(
    subscribeStoredState,
    getClientSnapshot,
    getServerSnapshot,
  );
  const setState = useCallback<RepeatingDecimalSetter>(
    (updater, persist = true) => {
      const prev = getClientSnapshot();
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (Object.is(next, prev)) {
        if (persist) persistCachedState();
        return;
      }
      writeStoredState(normalizeState(next), persist);
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

export default function RepeatingDecimalStudio() {
  const [state, setState] = useRepeatingDecimalState();
  const [status, setStatus] = useState<string | null>(null);
  const fonts = useMemo(() => fontsFromNext(), []);
  const parsed = parseDivisionInputs(state.dividendInput, state.divisorInput);
  const layout = layoutFromState(state);

  const set = useCallback(
    (patch: Partial<RepeatingDecimalState>) => {
      setState((prev) => normalizeState({ ...prev, ...patch }));
    },
    [setState],
  );

  async function exportPng() {
    await document.fonts.ready;
    const scene = buildRepeatingDecimalScene(state);
    const canvas = renderSceneToCanvas(
      scene,
      fonts,
      state.style.lineWidth,
      state.style.exportScale,
    );
    const blob = await canvasToPngBlob(canvas);
    downloadBlob(blob, "순환소수 나눗셈.png");
    setStatus("PNG를 저장했어요.");
  }

  async function copyPng() {
    await document.fonts.ready;
    const scene = buildRepeatingDecimalScene(state);
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
    const scene = buildRepeatingDecimalScene(state);
    const svg = sceneToSvg(scene, fonts, state.style.lineWidth);
    downloadBlob(
      new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
      "순환소수 나눗셈.svg",
    );
    setStatus("SVG를 저장했어요.");
  }

  const errorMessage =
    parsed.ok || parsed.error === "empty"
      ? null
      : parseDivisionErrorMessage(parsed.error);

  return (
    <div className={`${notoSerif.variable} ${notoSerifKr.variable} space-y-4`}>
      <span
        className={`${notoSerif.className} ${notoSerifKr.className} sr-only italic`}
        style={{ fontFamily: '"Times New Roman", serif' }}
        aria-hidden
      >
        0123456789 같다
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
            순환소수 나눗셈
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-foreground/65">
            피제수와 제수를 넣으면 순환소수로 바꾸는 나눗셈 과정이 그려집니다.
            몫을 클릭하면 숨길 수 있고, 나머지 색과 「같다」 표시도 켤 수
            있어요. 순환마디는 {MAX_PERIOD_DIGITS}자리까지.
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

      {errorMessage ? (
        <p
          className="rounded-xl bg-peach/40 px-3 py-2 text-sm font-semibold text-[#a63a1a]"
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(16rem,20rem)_minmax(15rem,18rem)]">
        <div className="mx-auto w-full max-w-[24rem] overflow-hidden rounded-3xl border-2 border-wood/10 bg-white shadow-[0_12px_40px_rgba(61,44,30,0.08)] lg:mx-0">
          <div className="max-h-[min(72vh,52rem)] overflow-auto">
            <RepeatingDecimalCanvas
              state={state}
              fonts={fonts}
              setState={setState}
            />
          </div>
        </div>

        <div className="space-y-4">
          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <h2 className="font-display text-sm text-wood-dark">표시</h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <ChipToggle
                on={state.showQuotient}
                onClick={() => set({ showQuotient: !state.showQuotient })}
              >
                몫
              </ChipToggle>
              <ChipToggle
                on={state.showRemainderMarks}
                onClick={() =>
                  set({ showRemainderMarks: !state.showRemainderMarks })
                }
              >
                나머지 색
              </ChipToggle>
              <ChipToggle
                on={state.showSameMark}
                onClick={() => set({ showSameMark: !state.showSameMark })}
              >
                같다
              </ChipToggle>
            </div>
            <p className="mt-2 text-[11px] leading-snug text-foreground/45">
              그림 위 몫을 눌러도 보였다 숨겨요. 나머지 색은 순환이 시작·끝나는
              분홍과 가운데 나머지 파랑이에요.
            </p>
          </section>

          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <h2 className="font-display text-sm text-wood-dark">나눗셈</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <DigitField
                label="피제수"
                value={state.dividendInput}
                onChange={(dividendInput) => set({ dividendInput })}
              />
              <DigitField
                label="제수"
                value={state.divisorInput}
                onChange={(divisorInput) => set({ divisorInput })}
              />
            </div>
            {layout ? (
              <p className="mt-3 text-[11px] leading-snug text-foreground/55">
                {layout.kind === "terminating" ? (
                  <>유한소수예요.</>
                ) : layout.kind === "truncated" ? (
                  <>
                    순환마디가 {layout.periodLength}자리라 {MAX_PERIOD_DIGITS}
                    자리까지만 그렸어요.
                  </>
                ) : (
                  <>
                    {layout.prePeriod
                      ? `비순환 ${layout.prePeriod.length}자리, `
                      : null}
                    순환마디 {layout.period.length}자리
                    {layout.period ? ` (${layout.period})` : null}.
                  </>
                )}
              </p>
            ) : null}
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <h2 className="font-display text-sm text-wood-dark">빠른 그림</h2>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {REPEATING_DECIMAL_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setState(cloneState(preset.state))}
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
                label="글자"
                value={state.style.fontSize}
                onChange={(fontSize) =>
                  set({ style: { ...state.style, fontSize } })
                }
                min={14}
                max={36}
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

function DigitField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-foreground/60">{label}</span>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        className="mt-1 w-full rounded-xl border-2 border-wood/20 bg-white px-3 py-2 text-sm tabular-nums outline-none focus:border-wood"
      />
    </label>
  );
}
