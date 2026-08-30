"use client";

import { Noto_Serif, Noto_Serif_KR } from "next/font/google";
import Link from "next/link";
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import {
  ChipToggle,
  NumberField,
  Segmented,
  SliderField,
} from "@/components/tools/figures/controls";
import SqrtNumberLineCanvas, {
  type SqrtSetter,
} from "@/components/tools/figures/sqrt-number-line/SqrtNumberLineCanvas";
import {
  canvasToPngBlob,
  copyPngToClipboard,
  downloadBlob,
} from "@/lib/diagrams/export-image";
import { matchesRadicand, suggestedAxisRange } from "@/lib/diagrams/sqrt-number-line/geometry";
import {
  applyLegs,
  applyRadicand,
  cloneState,
  COMMON_SQRT_N,
  DEFAULT_SQRT_NUMBER_LINE_STATE,
  formatSqrtLabel,
  formatSqrtLabelPlain,
  normalizeState,
  pairsFor,
  radicand,
  SQRT_FILL_PRESETS,
  normalizeFillColor,
  SQRT_KINDS,
  SQRT_NUMBER_LINE_PRESETS,
  type ShapeSide,
  type SqrtKind,
  type SqrtNumberLineState,
} from "@/lib/diagrams/sqrt-number-line/model";
import { buildSqrtNumberLineScene } from "@/lib/diagrams/sqrt-number-line/scene";
import { renderSceneToCanvas, sceneToSvg } from "@/lib/diagrams/render";
import type { FontFaces } from "@/lib/diagrams/math-label";

const STORAGE_KEY = "pm-diagram-g3-sqrt-number-line-v1";

const storeListeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cachedState: SqrtNumberLineState = DEFAULT_SQRT_NUMBER_LINE_STATE;
let cacheReady = false;

function parseStoredState(raw: string | null): SqrtNumberLineState {
  if (!raw) return DEFAULT_SQRT_NUMBER_LINE_STATE;
  try {
    const parsed = JSON.parse(raw) as SqrtNumberLineState;
    if (parsed && parsed.style && typeof parsed.legA === "number") {
      return normalizeState(parsed);
    }
  } catch {
    /* keep default */
  }
  return DEFAULT_SQRT_NUMBER_LINE_STATE;
}

function getServerSnapshot(): SqrtNumberLineState {
  return DEFAULT_SQRT_NUMBER_LINE_STATE;
}

function getClientSnapshot(): SqrtNumberLineState {
  if (!cacheReady) {
    cacheReady = true;
    cachedRaw = window.localStorage.getItem(STORAGE_KEY);
    cachedState = parseStoredState(cachedRaw);
  }
  return cachedState;
}

function writeStoredState(state: SqrtNumberLineState, persist = true) {
  cachedState = state;
  cacheReady = true;
  if (persist) {
    cachedRaw = JSON.stringify(state);
    try {
      window.localStorage.setItem(STORAGE_KEY, cachedRaw);
    } catch {
      /* ignore */
    }
  }
  storeListeners.forEach((listener) => listener());
}

function persistCachedState() {
  cachedRaw = JSON.stringify(cachedState);
  try {
    window.localStorage.setItem(STORAGE_KEY, cachedRaw);
  } catch {
    /* ignore */
  }
}

function subscribeStoredState(onChange: () => void) {
  storeListeners.add(onChange);
  return () => {
    storeListeners.delete(onChange);
  };
}

function useSqrtNumberLineState() {
  const state = useSyncExternalStore(
    subscribeStoredState,
    getClientSnapshot,
    getServerSnapshot,
  );
  const setState = useCallback<SqrtSetter>((updater, persist = true) => {
    const prev = getClientSnapshot();
    const next = typeof updater === "function" ? updater(prev) : updater;
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

export default function SqrtNumberLineStudio() {
  const [state, setState] = useSqrtNumberLineState();
  const [status, setStatus] = useState<string | null>(null);
  const fonts = useMemo(() => fontsFromNext(), []);
  const n = radicand(state);
  const pairOptions = useMemo(() => pairsFor(n), [n]);

  function set(patch: Partial<SqrtNumberLineState>) {
    setState((prev) => normalizeState({ ...prev, ...patch }));
  }

  function pickSqrtN(target: number) {
    const result = applyRadicand(state, target);
    if ("error" in result) {
      setStatus(result.error);
      return;
    }
    setState(result);
    setStatus(null);
  }

  function pickPair(index: number) {
    const pairs = pairsFor(n);
    if (pairs.length === 0) return;
    const [a, b] = pairs[index] ?? pairs[0]!;
    setState((prev) =>
      normalizeState({
        ...applyLegs(prev, a, b),
        posValueRaw: "",
        negValueRaw: "",
      }),
    );
  }

  async function exportPng() {
    await document.fonts.ready;
    const scene = buildSqrtNumberLineScene(state);
    const canvas = renderSceneToCanvas(
      scene,
      fonts,
      state.style.lineWidth,
      state.style.exportScale,
    );
    const blob = await canvasToPngBlob(canvas);
    downloadBlob(blob, "제곱근수직선.png");
    setStatus("PNG를 저장했어요.");
  }

  async function copyPng() {
    await document.fonts.ready;
    const scene = buildSqrtNumberLineScene(state);
    const canvas = renderSceneToCanvas(
      scene,
      fonts,
      state.style.lineWidth,
      state.style.exportScale,
    );
    const blob = await canvasToPngBlob(canvas);
    await copyPngToClipboard(blob);
    setStatus("클립보드에 그림을 복사했어요.");
  }

  function exportSvg() {
    const scene = buildSqrtNumberLineScene(state);
    const svg = sceneToSvg(scene, fonts, state.style.lineWidth);
    downloadBlob(
      new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
      "제곱근수직선.svg",
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
        xxyy OO AA sqrt cm
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
            제곱근 수직선
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-foreground/65">
            정사각형·직각삼각형으로 √n을 수직선에 찍는 시험 그림을 바로
            그리고 PNG로 저장해요. 시작점·도형·호·점을 각각 켜고 끌 수
            있어요.
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
        <p className="rounded-xl bg-mint/30 px-3 py-2 text-sm text-wood-dark">{status}</p>
      ) : null}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(14rem,16rem)_minmax(15rem,18rem)]">
        <div className="mx-auto w-full max-w-[24rem] space-y-4 lg:mx-0 lg:max-w-none">
          <div className="overflow-hidden rounded-3xl border-2 border-wood/10 bg-white shadow-[0_12px_40px_rgba(61,44,30,0.08)]">
            <SqrtNumberLineCanvas
              state={state}
              fonts={fonts}
              setState={setState}
              persist={persistCachedState}
            />
          </div>

          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <h2 className="font-display text-sm text-wood-dark">작도</h2>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {SQRT_KINDS.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => set({ kind: k.id as SqrtKind })}
                  className={`rounded-xl px-2.5 py-2 text-left text-xs font-semibold ${
                    state.kind === k.id
                      ? "bg-wood text-cream"
                      : "bg-black/5 text-foreground/70 hover:bg-black/10"
                  }`}
                >
                  {k.label}
                </button>
              ))}
            </div>

            <p className="mt-3 text-xs font-semibold text-foreground/60">√n</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {COMMON_SQRT_N.map((target) => (
                <ChipToggle
                  key={target}
                  on={matchesRadicand(state, target)}
                  onClick={() => pickSqrtN(target)}
                >
                  {formatSqrtLabelPlain(target)}
                </ChipToggle>
              ))}
            </div>
            {pairOptions.length > 1 ? (
              <div className="mt-2">
                <p className="text-xs font-semibold text-foreground/60">방향 (a, b)</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {pairOptions.map(([a, b], i) => (
                    <ChipToggle
                      key={`${a}-${b}`}
                      on={state.legA === a && state.legB === b}
                      onClick={() => pickPair(i)}
                    >
                      {a}·{b}
                    </ChipToggle>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-3 grid grid-cols-2 gap-2">
              <NumberField
                label="직각변 a"
                value={state.legA}
                onChange={(legA) =>
                  setState((prev) => applyLegs(prev, legA, prev.legB))
                }
                min={1}
                max={8}
                step={1}
              />
              <NumberField
                label="직각변 b"
                value={state.legB}
                onChange={(legB) =>
                  setState((prev) => applyLegs(prev, prev.legA, legB))
                }
                min={1}
                max={8}
                step={1}
              />
              <NumberField
                label="시작점 O"
                value={state.origin}
                onChange={(origin) =>
                  setState((prev) =>
                    normalizeState({ ...prev, origin, posValueRaw: "", negValueRaw: "" }),
                  )
                }
                step={0.5}
              />
              <div className="flex flex-col justify-end">
                <p className="text-xs font-semibold text-foreground/60">지금 √n</p>
                <p className="font-display mt-1 text-lg text-wood-dark">
                  {formatSqrtLabelPlain(n)}
                </p>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-foreground/45">
              a²+b²=n인 정수 a, b만 그릴 수 있어요. 그림에서 O를 끌면
              시작점, A를 끌면 a·b가 바뀝니다.
            </p>
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <h2 className="font-display text-sm text-wood-dark">표시</h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <ChipToggle on={state.showShape} onClick={() => set({ showShape: !state.showShape })}>
                도형
              </ChipToggle>
              <ChipToggle on={state.showFill} onClick={() => set({ showFill: !state.showFill })}>
                면 채움
              </ChipToggle>
              <ChipToggle on={state.showGrid} onClick={() => set({ showGrid: !state.showGrid })}>
                모눈
              </ChipToggle>
              <ChipToggle on={state.showArc} onClick={() => set({ showArc: !state.showArc })}>
                반원(호)
              </ChipToggle>
              <ChipToggle
                on={state.showPosPoint}
                onClick={() => set({ showPosPoint: !state.showPosPoint })}
              >
                점 P
              </ChipToggle>
              <ChipToggle
                on={state.showNegPoint}
                onClick={() => set({ showNegPoint: !state.showNegPoint })}
              >
                점 Q
              </ChipToggle>
              <ChipToggle
                on={state.showPosValue}
                onClick={() => set({ showPosValue: !state.showPosValue })}
              >
                값 √n
              </ChipToggle>
              <ChipToggle
                on={state.showNegValue}
                onClick={() => set({ showNegValue: !state.showNegValue })}
              >
                값 −√n
              </ChipToggle>
              <ChipToggle
                on={state.combinePointLabels}
                onClick={() => set({ combinePointLabels: !state.combinePointLabels })}
              >
                P(값) 형식
              </ChipToggle>
              <ChipToggle
                on={state.showVertexNames}
                onClick={() => set({ showVertexNames: !state.showVertexNames })}
              >
                꼭짓점 이름
              </ChipToggle>
              {state.kind === "triangle" ? (
                <>
                  <ChipToggle
                    on={state.showRightAngle}
                    onClick={() => set({ showRightAngle: !state.showRightAngle })}
                  >
                    직각
                  </ChipToggle>
                  <ChipToggle
                    on={state.shapeSide === "left"}
                    onClick={() =>
                      set({ shapeSide: (state.shapeSide === "left" ? "right" : "left") as ShapeSide })
                    }
                  >
                    {state.shapeSide === "left" ? "왼쪽 △" : "오른쪽 △"}
                  </ChipToggle>
                </>
              ) : null}
            </div>
            {state.showFill ? (
              <div className="mt-2.5">
                <p className="text-xs font-semibold text-foreground/60">면 색</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {SQRT_FILL_PRESETS.map((c) => {
                    const active =
                      normalizeFillColor(state.fillColor, state.kind) ===
                      normalizeFillColor(c.hex, state.kind);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        title={c.label}
                        aria-label={c.label}
                        onClick={() => set({ fillColor: c.hex })}
                        className={`h-8 w-8 rounded-full border-2 ${
                          active ? "border-wood" : "border-black/10"
                        }`}
                        style={{ background: c.hex }}
                      />
                    );
                  })}
                  <label className="relative h-8 w-8 overflow-hidden rounded-full border-2 border-black/10">
                    <span className="sr-only">직접 고르기</span>
                    <input
                      type="color"
                      value={normalizeFillColor(state.fillColor, state.kind)}
                      onChange={(e) => set({ fillColor: e.target.value })}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    />
                    <span
                      className="block h-full w-full"
                      style={{
                        background: normalizeFillColor(state.fillColor, state.kind),
                      }}
                    />
                  </label>
                </div>
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <h2 className="font-display text-sm text-wood-dark">수직선</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <NumberField
                label="시작"
                value={state.min}
                onChange={(min) => set({ min })}
                step={1}
              />
              <NumberField
                label="끝"
                value={state.max}
                onChange={(max) => set({ max })}
                step={1}
              />
              <NumberField
                label="간격"
                value={state.tickStep}
                onChange={(tickStep) => set({ tickStep })}
                min={0.25}
                max={5}
                step={0.25}
              />
              <NumberField
                label="숫자 간격"
                value={state.labelEvery}
                onChange={(labelEvery) => set({ labelEvery })}
                min={1}
                max={5}
                step={1}
                hint="몇 칸마다"
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <ChipToggle
                on={state.leftArrow}
                onClick={() => set({ leftArrow: !state.leftArrow })}
              >
                왼쪽 화살표
              </ChipToggle>
              <ChipToggle
                on={state.rightArrow}
                onClick={() => set({ rightArrow: !state.rightArrow })}
              >
                오른쪽 화살표
              </ChipToggle>
              <ChipToggle
                on={state.showTickLabels}
                onClick={() => set({ showTickLabels: !state.showTickLabels })}
              >
                눈금 숫자
              </ChipToggle>
              <ChipToggle
                on={state.plusOnPositive}
                onClick={() => set({ plusOnPositive: !state.plusOnPositive })}
              >
                양수에 +
              </ChipToggle>
            </div>
            <button
              type="button"
              onClick={() => {
                const range = suggestedAxisRange(state);
                set({ min: range.min, max: range.max });
              }}
              className="mt-2 w-full rounded-xl bg-black/5 px-2.5 py-2 text-xs font-semibold text-foreground/70 hover:bg-black/10"
            >
              축 범위 자동 맞춤
            </button>
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <h2 className="font-display text-sm text-wood-dark">빠른 그림</h2>
            <div className="mt-2 space-y-1.5">
              {SQRT_NUMBER_LINE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setState(normalizeState(cloneState(preset.state)));
                    setStatus(null);
                  }}
                  className="w-full rounded-xl bg-black/5 px-2.5 py-2 text-left text-xs font-semibold text-foreground/70 hover:bg-black/10"
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
                label="선 굵기"
                value={state.style.lineWidth}
                onChange={(lineWidth) =>
                  set({ style: { ...state.style, lineWidth } })
                }
                min={1}
                max={3}
                step={0.1}
              />
              <SliderField
                label="눈금 글자"
                value={state.style.fontSize}
                onChange={(fontSize) =>
                  set({ style: { ...state.style, fontSize } })
                }
                min={14}
                max={24}
                step={1}
              />
              <SliderField
                label="점·이름"
                value={state.style.pointLabelSize}
                onChange={(pointLabelSize) =>
                  set({ style: { ...state.style, pointLabelSize } })
                }
                min={16}
                max={28}
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
                step={0.2}
              />
              <SliderField
                label="PNG 배율"
                value={state.style.exportScale}
                onChange={(exportScale) =>
                  set({ style: { ...state.style, exportScale } })
                }
                min={2}
                max={4}
                step={0.5}
              />
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
