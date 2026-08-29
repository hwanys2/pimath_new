"use client";

import { Noto_Serif, Noto_Serif_KR } from "next/font/google";
import Link from "next/link";
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import {
  ChipToggle,
  NumberField,
  Segmented,
  SliderField,
  TextField,
} from "@/components/tools/figures/controls";
import InequalityCanvas, {
  type InequalitySetter,
} from "@/components/tools/figures/linear-inequality/InequalityCanvas";
import {
  canvasToPngBlob,
  copyPngToClipboard,
  downloadBlob,
} from "@/lib/diagrams/export-image";
import {
  boundKeys,
  cloneState,
  DEFAULT_INEQUALITY_STATE,
  describeInequality,
  FILL_PRESETS,
  fillRgba,
  INEQUALITY_PRESETS,
  normalizeHex,
  normalizeState,
  setBoundFromRaw,
  type BoundKey,
  type InequalityBound,
  type InequalityKind,
  type InequalityState,
} from "@/lib/diagrams/linear-inequality/model";
import { buildInequalityScene } from "@/lib/diagrams/linear-inequality/scene";
import type { FontFaces } from "@/lib/diagrams/math-label";
import { renderSceneToCanvas, sceneToSvg } from "@/lib/diagrams/render";

const STORAGE_KEY = "pm-diagram-g2-linear-inequality-v1";

const storeListeners = new Set<() => void>();

let cachedRaw: string | null = null;
let cachedState: InequalityState = DEFAULT_INEQUALITY_STATE;
let cacheReady = false;

function parseStoredState(raw: string | null): InequalityState {
  if (!raw) return DEFAULT_INEQUALITY_STATE;
  try {
    const parsed = JSON.parse(raw) as InequalityState;
    if (
      parsed &&
      parsed.start &&
      parsed.end &&
      typeof parsed.min === "number"
    ) {
      return normalizeState(parsed);
    }
  } catch {
    /* keep default */
  }
  return DEFAULT_INEQUALITY_STATE;
}

function getServerSnapshot(): InequalityState {
  return DEFAULT_INEQUALITY_STATE;
}

function getClientSnapshot(): InequalityState {
  if (!cacheReady) {
    cacheReady = true;
    cachedRaw = window.localStorage.getItem(STORAGE_KEY);
    cachedState = parseStoredState(cachedRaw);
  }
  return cachedState;
}

function writeStoredState(state: InequalityState, persist = true) {
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

function useInequalityState() {
  const state = useSyncExternalStore(
    subscribeStoredState,
    getClientSnapshot,
    getServerSnapshot,
  );
  const setState = useCallback<InequalitySetter>((updater, persist = true) => {
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

const KIND_OPTIONS: { id: InequalityKind; title: string; hint: string }[] = [
  { id: "blank", title: "빈 수직선", hint: "축만" },
  { id: "ray", title: "한쪽으로", hint: "x > a" },
  { id: "segment", title: "사이", hint: "a ≤ x < b" },
  { id: "split", title: "양쪽", hint: "또는" },
];

export default function InequalityStudio() {
  const [state, setState] = useInequalityState();
  const [status, setStatus] = useState<string | null>(null);
  const [selected, setSelected] = useState<BoundKey | null>("start");
  const fonts = useMemo(() => fontsFromNext(), []);
  const keys = boundKeys(state.kind);
  const caption = describeInequality(state);

  const set = useCallback(
    (patch: Partial<InequalityState>) => {
      setState((prev) => normalizeState({ ...prev, ...patch }));
    },
    [setState],
  );

  const patchBound = useCallback(
    (which: BoundKey, patch: Partial<InequalityBound>) => {
      setState((prev) =>
        normalizeState({
          ...prev,
          [which]: { ...prev[which], ...patch },
        }),
      );
    },
    [setState],
  );

  async function exportPng() {
    await document.fonts.ready;
    const scene = buildInequalityScene(state);
    const canvas = renderSceneToCanvas(
      scene,
      fonts,
      state.style.lineWidth,
      state.style.exportScale,
    );
    const blob = await canvasToPngBlob(canvas);
    downloadBlob(blob, "일차부등식.png");
    setStatus("PNG를 저장했어요.");
  }

  async function copyPng() {
    await document.fonts.ready;
    const scene = buildInequalityScene(state);
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
    const scene = buildInequalityScene(state);
    const svg = sceneToSvg(scene, fonts, state.style.lineWidth);
    downloadBlob(
      new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
      "일차부등식.svg",
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
        xxyy OO AA +1 -5 가
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
            일차부등식
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-foreground/65">
            해의 범위를 수직선에 그려요. 같다를 켜면 점을 칠하고, 끄면 빈
            동그라미예요. 점을 끌어 경계를 옮기고, 두 번 눌러 같다를 바꿀 수
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
        <p className="rounded-xl bg-mint/30 px-3 py-2 text-sm text-wood-dark">
          {status}
        </p>
      ) : null}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)]">
        <div className="space-y-4">
          <div className="overflow-hidden rounded-3xl border-2 border-wood/10 bg-white shadow-[0_12px_40px_rgba(61,44,30,0.08)]">
            <InequalityCanvas
              state={state}
              fonts={fonts}
              selected={selected}
              setState={setState}
              persist={persistCachedState}
              onSelect={setSelected}
            />
          </div>
          <p className="px-1 text-center text-sm text-foreground/70">
            <span className="font-display text-wood-dark">{caption}</span>
          </p>
        </div>

        <div className="space-y-4">
          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <h2 className="font-display text-sm text-wood-dark">빠른 그림</h2>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {INEQUALITY_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    const next = cloneState(preset.state);
                    setState(next);
                    setSelected(boundKeys(next.kind)[0] ?? null);
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
            <h2 className="font-display text-sm text-wood-dark">부등식</h2>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {KIND_OPTIONS.map((opt) => {
                const active = state.kind === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      set({ kind: opt.id });
                      setSelected(boundKeys(opt.id)[0] ?? null);
                    }}
                    className={`rounded-xl px-2.5 py-2 text-left text-xs font-semibold ${
                      active
                        ? "bg-wood text-cream"
                        : "bg-black/5 text-foreground/70 hover:bg-black/10"
                    }`}
                  >
                    {opt.title}
                    <span
                      className={`mt-0.5 block font-normal ${
                        active ? "text-cream/75" : "text-foreground/45"
                      }`}
                    >
                      {opt.hint}
                    </span>
                  </button>
                );
              })}
            </div>

            {state.kind === "ray" ? (
              <div className="mt-3">
                <p className="mb-1 text-xs font-semibold text-foreground/60">
                  방향
                </p>
                <Segmented
                  value={state.direction}
                  onChange={(direction) => set({ direction })}
                  options={[
                    { id: "left", label: "왼쪽 (<)" },
                    { id: "right", label: "오른쪽 (>)" },
                  ]}
                />
              </div>
            ) : null}

            {keys.length > 0 ? (
              <div className="mt-3 space-y-2.5">
                {keys.map((which) => (
                  <BoundCard
                    key={which}
                    title={
                      state.kind === "ray"
                        ? "경계"
                        : which === "start"
                          ? "왼쪽"
                          : "오른쪽"
                    }
                    bound={state[which]}
                    selected={selected === which}
                    onSelect={() => setSelected(which)}
                    onChangeRaw={(raw) =>
                      setState((prev) => setBoundFromRaw(prev, which, raw))
                    }
                    onPatch={(patch) => patchBound(which, patch)}
                  />
                ))}
              </div>
            ) : (
              <p className="mt-3 text-[11px] text-foreground/45">
                해의 범위 없이 수직선만 그려요. 학습지에 빈칸으로 넣을 때
                써요.
              </p>
            )}

            {state.kind !== "blank" ? (
              <div className="mt-3">
                <div className="flex flex-wrap gap-1.5">
                  <ChipToggle
                    on={state.showFill}
                    onClick={() => set({ showFill: !state.showFill })}
                  >
                    색칠
                  </ChipToggle>
                </div>
                {state.showFill ? (
                  <div className="mt-2.5">
                    <p className="text-xs font-semibold text-foreground/60">
                      색
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {FILL_PRESETS.map((c) => {
                        const active =
                          normalizeHex(state.fillHex) === normalizeHex(c.hex);
                        return (
                          <button
                            key={c.id}
                            type="button"
                            title={c.label}
                            aria-label={c.label}
                            onClick={() => set({ fillHex: c.hex })}
                            className={`h-8 w-8 rounded-full border-2 ${
                              active ? "border-wood" : "border-black/10"
                            }`}
                            style={{
                              background: fillRgba(c.hex, 0.55),
                            }}
                          />
                        );
                      })}
                      <label className="relative h-8 w-8 overflow-hidden rounded-full border-2 border-black/10">
                        <span className="sr-only">직접 고르기</span>
                        <input
                          type="color"
                          value={normalizeHex(state.fillHex)}
                          onChange={(e) => set({ fillHex: e.target.value })}
                          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                        />
                        <span
                          className="block h-full w-full"
                          style={{
                            background: fillRgba(state.fillHex, 0.7),
                          }}
                        />
                      </label>
                    </div>
                    <div className="mt-2">
                      <SliderField
                        label="색 진하기"
                        value={Math.round(state.fillAlpha * 100)}
                        onChange={(n) => set({ fillAlpha: n / 100 })}
                        min={8}
                        max={60}
                        step={1}
                        display={`${Math.round(state.fillAlpha * 100)}%`}
                      />
                    </div>
                  </div>
                ) : null}
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
                hint="몇 칸마다 숫자를 달지"
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
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
                onClick={() =>
                  set({ plusOnPositive: !state.plusOnPositive })
                }
              >
                양수에 +
              </ChipToggle>
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
                max={36}
                step={1}
              />
              <SliderField
                label="꺾은선 높이"
                value={state.style.shelfHeight}
                onChange={(shelfHeight) =>
                  set({ style: { ...state.style, shelfHeight } })
                }
                min={16}
                max={70}
                step={1}
              />
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
                label="점 크기"
                value={state.style.pointRadius}
                onChange={(pointRadius) =>
                  set({ style: { ...state.style, pointRadius } })
                }
                min={3}
                max={10}
                step={0.1}
                display={state.style.pointRadius.toFixed(1)}
              />
              <SliderField
                label="좌우 여백"
                value={state.style.paddingX}
                onChange={(paddingX) =>
                  set({ style: { ...state.style, paddingX } })
                }
                min={28}
                max={80}
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

function BoundCard({
  title,
  bound,
  selected,
  onSelect,
  onChangeRaw,
  onPatch,
}: {
  title: string;
  bound: InequalityBound;
  selected: boolean;
  onSelect: () => void;
  onChangeRaw: (raw: string) => void;
  onPatch: (patch: Partial<InequalityBound>) => void;
}) {
  return (
    <article
      className={`rounded-xl border-2 p-2.5 ${
        selected ? "border-wood/40 bg-wood/5" : "border-wood/10 bg-white"
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="mb-2 text-left text-xs font-semibold text-wood-dark"
      >
        {title}
      </button>
      <TextField
        label="값"
        value={bound.inputRaw}
        onChange={(raw) => {
          onSelect();
          onChangeRaw(raw);
        }}
        placeholder="2, -1, 3/2"
      />
      <div className="mt-2 flex flex-wrap gap-1.5">
        <ChipToggle
          on={bound.inclusive}
          onClick={() => {
            onSelect();
            onPatch({ inclusive: !bound.inclusive });
          }}
        >
          같다
        </ChipToggle>
        <ChipToggle
          on={bound.showValue}
          onClick={() => {
            onSelect();
            onPatch({ showValue: !bound.showValue });
          }}
        >
          값 표시
        </ChipToggle>
      </div>
      <p className="mt-1.5 text-[11px] text-foreground/40">
        {bound.inclusive ? "칠한 점 (≥, ≤)" : "빈 동그라미 (>, <)"}
      </p>
    </article>
  );
}
