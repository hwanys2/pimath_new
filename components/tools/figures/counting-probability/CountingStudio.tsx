"use client";

import { Noto_Serif, Noto_Serif_KR } from "next/font/google";
import Link from "next/link";
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import CountingCanvas, {
  type CountingSetter,
} from "@/components/tools/figures/counting-probability/CountingCanvas";
import {
  ChipToggle,
  Segmented,
  SliderField,
  TextField,
} from "@/components/tools/figures/controls";
import { parseSelection } from "@/lib/diagrams/counting-probability/geometry";
import {
  ICON_OPTIONS,
} from "@/lib/diagrams/counting-probability/icons";
import {
  addDirectEdge,
  applyPreset,
  BALL_COLORS,
  CARD_COLORS,
  COUNTING_KINDS,
  COUNTING_PRESETS,
  DICE_COLORS,
  DEFAULT_COUNTING_STATE,
  MAX_BALLS,
  MAX_CARDS,
  MAX_DICE,
  MAX_PATHS,
  MAX_PLACES,
  MAX_POUCHES,
  MAX_SLICES,
  MIN_BALLS,
  MIN_CARDS,
  MIN_DICE,
  MIN_PATHS,
  MIN_PLACES,
  MIN_POUCHES,
  MIN_SLICES,
  normalizeState,
  relayoutCards,
  relayoutDice,
  relayoutPaths,
  relayoutPouches,
  setBallCount,
  setCardCount,
  setDiceCount,
  setEdgeCount,
  setPlaceCount,
  setPouchCount,
  setSliceCount,
  type ColorId,
  type CountingState,
  type DieFace,
} from "@/lib/diagrams/counting-probability/model";
import { buildCountingScene } from "@/lib/diagrams/counting-probability/scene";
import {
  canvasToPngBlob,
  copyPngToClipboard,
  downloadBlob,
} from "@/lib/diagrams/export-image";
import type { FontFaces } from "@/lib/diagrams/math-label";
import { renderSceneToCanvas, sceneToSvg } from "@/lib/diagrams/render";

const STORAGE_KEY = "pm-diagram-g2-counting-probability-v1";

const storeListeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cachedState: CountingState = DEFAULT_COUNTING_STATE;
let cacheReady = false;

function parseStoredState(raw: string | null): CountingState {
  if (!raw) return DEFAULT_COUNTING_STATE;
  try {
    const parsed = JSON.parse(raw) as CountingState;
    if (parsed && parsed.kind && parsed.style) {
      return normalizeState(parsed);
    }
  } catch {
    /* keep default */
  }
  return DEFAULT_COUNTING_STATE;
}

function getServerSnapshot(): CountingState {
  return DEFAULT_COUNTING_STATE;
}

function getClientSnapshot(): CountingState {
  if (!cacheReady) {
    cacheReady = true;
    cachedRaw = window.localStorage.getItem(STORAGE_KEY);
    cachedState = parseStoredState(cachedRaw);
  }
  return cachedState;
}

function writeStoredState(state: CountingState, persist = true) {
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

function useCountingState() {
  const state = useSyncExternalStore(
    subscribeStoredState,
    getClientSnapshot,
    getServerSnapshot,
  );
  const setState = useCallback<CountingSetter>((updater, persist = true) => {
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

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-foreground/60">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          className="font-display rounded-lg bg-black/5 px-3 py-1.5 text-sm text-wood-dark hover:bg-black/10"
        >
          −
        </button>
        <span className="min-w-[2rem] text-center text-sm font-bold tabular-nums text-wood-dark">
          {value}
        </span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          className="font-display rounded-lg bg-black/5 px-3 py-1.5 text-sm text-wood-dark hover:bg-black/10"
        >
          +
        </button>
      </div>
    </div>
  );
}

export default function CountingStudio() {
  const [state, setState] = useCountingState();
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const fonts = useMemo(() => fontsFromNext(), []);

  const set = useCallback(
    (patch: Partial<CountingState>) => setState((prev) => ({ ...prev, ...patch })),
    [setState],
  );

  const selectedHit = parseSelection(selected);

  async function exportPng() {
    const scene = buildCountingScene(state);
    const canvas = renderSceneToCanvas(
      scene,
      fonts,
      state.style.lineWidth,
      state.style.exportScale,
    );
    const blob = await canvasToPngBlob(canvas);
    downloadBlob(blob, "경우의수와확률.png");
    setStatus("PNG를 저장했어요.");
  }

  async function copyPng() {
    const scene = buildCountingScene(state);
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
    const scene = buildCountingScene(state);
    const svg = sceneToSvg(scene, fonts, state.style.lineWidth);
    const blob = new Blob([svg], { type: "image/svg+xml" });
    downloadBlob(blob, "경우의수와확률.svg");
    setStatus("SVG를 저장했어요.");
  }

  function relayoutForKind() {
    switch (state.kind) {
      case "dice":
        setState(relayoutDice(state));
        break;
      case "cards":
        setState(relayoutCards(state));
        break;
      case "pouches":
        setState(relayoutPouches(state));
        break;
      case "paths":
        setState(relayoutPaths(state));
        break;
      default:
        break;
    }
  }

  function renderKindControls() {
    switch (state.kind) {
      case "dice":
        return (
          <Stepper
            label="주사위 개수"
            value={state.dice.length}
            min={MIN_DICE}
            max={MAX_DICE}
            onChange={(n) => setState(setDiceCount(state, n))}
          />
        );
      case "cards":
        return (
          <Stepper
            label="카드 개수"
            value={state.cards.length}
            min={MIN_CARDS}
            max={MAX_CARDS}
            onChange={(n) => setState(setCardCount(state, n))}
          />
        );
      case "pouches":
        return (
          <div className="space-y-3">
            <Stepper
              label="주머니 개수"
              value={state.pouches.length}
              min={MIN_POUCHES}
              max={MAX_POUCHES}
              onChange={(n) => setState(setPouchCount(state, n))}
            />
            {selectedHit?.t === "pouch" ? (
              <Stepper
                label={`${state.pouches.find((p) => p.id === selectedHit.id)?.label ?? "주머니"} 공`}
                value={
                  state.pouches.find((p) => p.id === selectedHit.id)?.balls.length ?? 0
                }
                min={MIN_BALLS}
                max={MAX_BALLS}
                onChange={(n) =>
                  setState(setBallCount(state, selectedHit.id, n))
                }
              />
            ) : (
              <p className="text-[11px] text-foreground/45">
                주머니를 누르면 공 개수를 바꿀 수 있어요.
              </p>
            )}
          </div>
        );
      case "spinner":
        return (
          <Stepper
            label="등분 개수"
            value={state.spinner.slices.length}
            min={MIN_SLICES}
            max={MAX_SLICES}
            onChange={(n) => setState(setSliceCount(state, n))}
          />
        );
      case "paths":
        return (
          <Stepper
            label="장소 개수"
            value={state.paths.places.length}
            min={MIN_PLACES}
            max={MAX_PLACES}
            onChange={(n) => setState(setPlaceCount(state, n))}
          />
        );
      default:
        return null;
    }
  }

  function renderDetailPanel() {
    if (!selectedHit) {
      return (
        <p className="text-[11px] leading-snug text-foreground/45">
          그림에서 항목을 누르면 눈·글자·색을 고칠 수 있어요. 주사위·카드·주머니·공·장소는
          끌어 재배치할 수 있습니다.
        </p>
      );
    }

    if (selectedHit.t === "dice") {
      const die = state.dice.find((d) => d.id === selectedHit.id);
      if (!die) return null;
      return (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-foreground/60">주사위 눈</p>
          <div className="flex flex-wrap gap-1">
            {([1, 2, 3, 4, 5, 6] as DieFace[]).map((face) => (
              <ChipToggle
                key={face}
                on={die.face === face}
                onClick={() =>
                  setState({
                    ...state,
                    dice: state.dice.map((d) =>
                      d.id === die.id ? { ...d, face } : d,
                    ),
                  })
                }
              >
                {face}
              </ChipToggle>
            ))}
          </div>
          <ColorChips
            colors={DICE_COLORS}
            value={die.color}
            onChange={(color) =>
              setState({
                ...state,
                dice: state.dice.map((d) =>
                  d.id === die.id ? { ...d, color } : d,
                ),
              })
            }
          />
        </div>
      );
    }

    if (selectedHit.t === "card") {
      const card = state.cards.find((c) => c.id === selectedHit.id);
      if (!card) return null;
      return (
        <div className="space-y-2">
          <TextField
            label="카드 내용"
            value={card.text}
            onChange={(text) =>
              setState({
                ...state,
                cards: state.cards.map((c) =>
                  c.id === card.id ? { ...c, text } : c,
                ),
              })
            }
          />
          <ColorChips
            colors={CARD_COLORS}
            value={card.color}
            onChange={(color) =>
              setState({
                ...state,
                cards: state.cards.map((c) =>
                  c.id === card.id ? { ...c, color } : c,
                ),
              })
            }
          />
        </div>
      );
    }

    if (selectedHit.t === "pouch") {
      const pouch = state.pouches.find((p) => p.id === selectedHit.id);
      if (!pouch) return null;
      return (
        <TextField
          label="주머니 이름"
          value={pouch.label}
          onChange={(label) =>
            setState({
              ...state,
              pouches: state.pouches.map((p) =>
                p.id === pouch.id ? { ...p, label } : p,
              ),
            })
          }
        />
      );
    }

    if (selectedHit.t === "ball") {
      const pouch = state.pouches.find((p) => p.id === selectedHit.pouchId);
      const ball = pouch?.balls.find((b) => b.id === selectedHit.id);
      if (!ball) return null;
      return (
        <div className="space-y-2">
          <TextField
            label="공 글자"
            value={ball.text}
            onChange={(text) =>
              setState({
                ...state,
                pouches: state.pouches.map((p) =>
                  p.id === selectedHit.pouchId
                    ? {
                        ...p,
                        balls: p.balls.map((b) =>
                          b.id === ball.id ? { ...b, text } : b,
                        ),
                      }
                    : p,
                ),
              })
            }
          />
          <ColorChips
            colors={BALL_COLORS}
            value={ball.color}
            onChange={(color) =>
              setState({
                ...state,
                pouches: state.pouches.map((p) =>
                  p.id === selectedHit.pouchId
                    ? {
                        ...p,
                        balls: p.balls.map((b) =>
                          b.id === ball.id ? { ...b, color } : b,
                        ),
                      }
                    : p,
                ),
              })
            }
          />
        </div>
      );
    }

    if (selectedHit.t === "slice") {
      const slice = state.spinner.slices.find((s) => s.id === selectedHit.id);
      if (!slice) return null;
      return (
        <div className="space-y-2">
          <TextField
            label="칸 내용"
            value={slice.text}
            onChange={(text) =>
              setState({
                ...state,
                spinner: {
                  ...state.spinner,
                  slices: state.spinner.slices.map((s) =>
                    s.id === slice.id ? { ...s, text } : s,
                  ),
                },
              })
            }
          />
          <ColorChips
            colors={["green", "orange", "yellow", "pink", "blue", "purple"]}
            value={slice.color}
            onChange={(color) =>
              setState({
                ...state,
                spinner: {
                  ...state.spinner,
                  slices: state.spinner.slices.map((s) =>
                    s.id === slice.id ? { ...s, color } : s,
                  ),
                },
              })
            }
          />
        </div>
      );
    }

    if (selectedHit.t === "place") {
      const place = state.paths.places.find((p) => p.id === selectedHit.id);
      if (!place) return null;
      return (
        <div className="space-y-2">
          <TextField
            label="장소 이름"
            value={place.label}
            onChange={(label) =>
              setState({
                ...state,
                paths: {
                  ...state.paths,
                  places: state.paths.places.map((p) =>
                    p.id === place.id ? { ...p, label } : p,
                  ),
                },
              })
            }
          />
          <p className="text-xs font-semibold text-foreground/60">아이콘</p>
          <div className="grid max-h-40 grid-cols-2 gap-1 overflow-y-auto">
            {ICON_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() =>
                  setState({
                    ...state,
                    paths: {
                      ...state.paths,
                      places: state.paths.places.map((p) =>
                        p.id === place.id ? { ...p, icon: opt.id } : p,
                      ),
                    },
                  })
                }
                className={`rounded-lg px-2 py-1.5 text-left text-[11px] font-semibold ${
                  place.icon === opt.id
                    ? "bg-wood text-cream"
                    : "bg-black/5 text-foreground/70 hover:bg-black/10"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (selectedHit.t === "edge") {
      const edge = state.paths.edges.find((e) => e.id === selectedHit.id);
      if (!edge) return null;
      const from = state.paths.places.find((p) => p.id === edge.from);
      const to = state.paths.places.find((p) => p.id === edge.to);
      return (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-foreground/60">
            {from?.label ?? "?"} → {to?.label ?? "?"} 길
          </p>
          <Stepper
            label="길 개수"
            value={edge.count}
            min={MIN_PATHS}
            max={MAX_PATHS}
            onChange={(n) => setState(setEdgeCount(state, edge.id, n))}
          />
        </div>
      );
    }

    return null;
  }

  const presetsForKind = COUNTING_PRESETS.filter((p) => p.kind === state.kind);

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
            <Link href="/tools/figures?grade=2" className="hover:underline">
              문제 그림 그리기
            </Link>
            <span className="mx-1.5 text-foreground/30">/</span>
            중2
          </p>
          <h1 className="font-display mt-1 text-3xl text-wood-dark sm:text-4xl">
            경우의 수와 확률
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-foreground/65">
            주사위·카드·주머니·등분할 원판·길 그림을 고르고, 개수와 내용을 맞춘 뒤 끌어
            재배치하고 PNG로 저장해요.
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
            <CountingCanvas
              state={state}
              fonts={fonts}
              selected={selected}
              setState={setState}
              persist={persistCachedState}
              onSelect={setSelected}
              onEdgeCountChange={(edgeId, delta) => {
                const edge = state.paths.edges.find((e) => e.id === edgeId);
                if (!edge) return;
                setState(setEdgeCount(state, edgeId, edge.count + delta));
              }}
            />
          </div>

          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <h2 className="font-display text-sm text-wood-dark">그림 종류</h2>
            <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {COUNTING_KINDS.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => {
                    set({ kind: k.id });
                    setSelected(null);
                  }}
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
            <div className="mt-3">{renderKindControls()}</div>
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-sm text-wood-dark">세부 설정</h2>
              {state.kind !== "spinner" ? (
                <button
                  type="button"
                  onClick={relayoutForKind}
                  className="text-xs font-semibold text-wood hover:underline"
                >
                  다시 정렬
                </button>
              ) : null}
            </div>
            <div className="mt-2">{renderDetailPanel()}</div>

            {state.kind === "spinner" ? (
              <div className="mt-3">
                <SliderField
                  label="원판 회전"
                  value={Math.round((state.spinner.rotation * 180) / Math.PI)}
                  onChange={(deg) =>
                    set({
                      spinner: {
                        ...state.spinner,
                        rotation: (deg * Math.PI) / 180,
                      },
                    })
                  }
                  min={-180}
                  max={180}
                  step={1}
                  display={`${Math.round((state.spinner.rotation * 180) / Math.PI)}°`}
                />
              </div>
            ) : null}

            {state.kind === "paths" && state.paths.places.length >= 2 ? (
              <div className="mt-3 space-y-2">
                <p className="text-xs font-semibold text-foreground/60">직통 길 추가</p>
                <div className="grid grid-cols-2 gap-2">
                  <PlaceSelect
                    label="출발"
                    places={state.paths.places}
                    value={state.paths.places[0]?.id ?? ""}
                    onChange={() => {}}
                    id="path-from"
                    readOnly
                  />
                </div>
                <p className="text-[11px] text-foreground/45">
                  구간을 누르면 길 개수를 바꿀 수 있어요. 그림 위 +/− 버튼도
                  사용할 수 있습니다.
                </p>
                {state.paths.places.length >= 2 ? (
                  <div className="flex flex-wrap gap-1">
                    {state.paths.places.map((from) =>
                      state.paths.places
                        .filter((to) => to.id !== from.id)
                        .map((to) => {
                          const exists = state.paths.edges.some(
                            (e) =>
                              (e.from === from.id && e.to === to.id) ||
                              (e.from === to.id && e.to === from.id),
                          );
                          if (exists) return null;
                          return (
                            <button
                              key={`${from.id}-${to.id}`}
                              type="button"
                              onClick={() =>
                                setState(addDirectEdge(state, from.id, to.id))
                              }
                              className="rounded-lg bg-black/5 px-2 py-1 text-[11px] font-semibold text-foreground/70 hover:bg-black/10"
                            >
                              {from.label}↔{to.label}
                            </button>
                          );
                        }),
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <h2 className="font-display text-sm text-wood-dark">빠른 그림</h2>
            <div className="mt-2 grid grid-cols-1 gap-1.5">
              {presetsForKind.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setState(applyPreset(state, preset.id));
                    setSelected(null);
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
                label="글자 크기"
                value={state.style.fontSize}
                onChange={(fontSize) =>
                  set({ style: { ...state.style, fontSize } })
                }
                min={12}
                max={24}
                step={1}
                display={`${state.style.fontSize}px`}
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
                    set({ style: { ...state.style, exportScale: Number(v) } })
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

function ColorChips({
  colors,
  value,
  onChange,
}: {
  colors: ColorId[];
  value: ColorId;
  onChange: (c: ColorId) => void;
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-foreground/60">색</p>
      <div className="mt-1 flex flex-wrap gap-1">
        {colors.map((c) => (
          <ChipToggle key={c} on={value === c} onClick={() => onChange(c)}>
            {c === "blue"
              ? "파랑"
              : c === "red"
                ? "빨강"
                : c === "green"
                  ? "초록"
                  : c === "yellow"
                    ? "노랑"
                    : c === "pink"
                      ? "분홍"
                      : c === "purple"
                        ? "보라"
                        : c === "orange"
                          ? "주황"
                          : c === "gray"
                            ? "회색"
                            : c === "white"
                              ? "하양"
                              : "베이지"}
          </ChipToggle>
        ))}
      </div>
    </div>
  );
}

function PlaceSelect({
  label,
  places,
  value,
  onChange,
  id,
  readOnly,
}: {
  label: string;
  places: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
  id: string;
  readOnly?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-foreground/60">{label}</span>
      <select
        id={id}
        value={value}
        disabled={readOnly}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border-2 border-wood/20 bg-white px-2 py-1.5 text-sm outline-none focus:border-wood"
      >
        {places.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>
    </label>
  );
}
