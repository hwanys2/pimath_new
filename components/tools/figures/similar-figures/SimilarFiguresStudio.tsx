"use client";

import { Noto_Serif, Noto_Serif_KR } from "next/font/google";
import Link from "next/link";
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import {
  ChipToggle,
  LabelModeRow,
  NumberField,
  Segmented,
  SliderField,
  TextField,
} from "@/components/tools/figures/controls";
import SimilarFiguresCanvas, {
  type SimilarSetter,
} from "@/components/tools/figures/similar-figures/SimilarFiguresCanvas";
import {
  canvasToPngBlob,
  copyPngToClipboard,
  downloadBlob,
} from "@/lib/diagrams/export-image";
import { vertexAngles } from "@/lib/diagrams/polygon/geometry";
import {
  applySourceAngle,
  applySourceLength,
  clearSelectionMarks,
  correspondingOn,
  figureBEdgeLength,
  figureBPoints,
  mirrorCorresponding,
  sourceEdgeLength,
  toggleInterior,
  type SimilarSelection,
} from "@/lib/diagrams/similar-figures/geometry";
import {
  DEFAULT_SIMILAR_STATE,
  RATIO_CHIPS,
  SIMILAR_PRESETS,
  cloneState,
  defaultVertexName,
  formatRatio,
  normalizeState,
  resetVertexNames,
  setRatio,
  withSideCount,
  type FigureId,
  type ReflectMode,
  type SimilarFiguresState,
} from "@/lib/diagrams/similar-figures/model";
import { buildSimilarFiguresScene } from "@/lib/diagrams/similar-figures/scene";
import { renderSceneToCanvas, sceneToSvg } from "@/lib/diagrams/render";
import type { FontFaces } from "@/lib/diagrams/math-label";

const STORAGE_KEY = "pm-diagram-g2-similar-figures-v1";

const storeListeners = new Set<() => void>();

let cachedRaw: string | null = null;
let cachedState: SimilarFiguresState = DEFAULT_SIMILAR_STATE;
let cacheReady = false;

function parseStoredState(raw: string | null): SimilarFiguresState {
  if (!raw) return DEFAULT_SIMILAR_STATE;
  try {
    const parsed = JSON.parse(raw) as SimilarFiguresState;
    if (parsed && Array.isArray(parsed.points) && parsed.style) {
      return normalizeState(parsed);
    }
  } catch {
    /* keep default */
  }
  return DEFAULT_SIMILAR_STATE;
}

function getServerSnapshot(): SimilarFiguresState {
  return DEFAULT_SIMILAR_STATE;
}

function getClientSnapshot(): SimilarFiguresState {
  if (!cacheReady) {
    cacheReady = true;
    cachedRaw = window.localStorage.getItem(STORAGE_KEY);
    cachedState = parseStoredState(cachedRaw);
  }
  return cachedState;
}

function writeStoredState(state: SimilarFiguresState, persist = true) {
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

function useSimilarState() {
  const state = useSyncExternalStore(
    subscribeStoredState,
    getClientSnapshot,
    getServerSnapshot,
  );
  const setState = useCallback<SimilarSetter>((updater, persist = true) => {
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

export default function SimilarFiguresStudio() {
  const [state, setState] = useSimilarState();
  const [status, setStatus] = useState<string | null>(null);
  const [selected, setSelected] = useState<SimilarSelection | null>({
    figure: "a",
    t: "vertex",
    i: 0,
  });
  const fonts = useMemo(() => fontsFromNext(), []);
  const n = state.points.length;
  const verts = selected?.figure === "a" ? state.verticesA : state.verticesB;
  const edges = selected?.figure === "a" ? state.edgesA : state.edgesB;
  const selVertex =
    selected?.t === "vertex" ? verts[selected.i] : undefined;
  const selEdge = selected?.t === "edge" ? edges[selected.i] : undefined;
  const ptsForAngle =
    selected?.figure === "b" ? figureBPoints(state) : state.points;

  const set = useCallback(
    (patch: Partial<SimilarFiguresState>) => {
      setState((prev) => normalizeState({ ...prev, ...patch }));
    },
    [setState],
  );

  const deleteSelected = useCallback(() => {
    setState((prev) => clearSelectionMarks(prev, selected));
  }, [selected, setState]);

  async function exportPng() {
    await document.fonts.ready;
    const scene = buildSimilarFiguresScene(state);
    const canvas = renderSceneToCanvas(
      scene,
      fonts,
      state.style.lineWidth,
      state.style.exportScale,
    );
    const blob = await canvasToPngBlob(canvas);
    downloadBlob(blob, "평면도형의 닮음.png");
    setStatus("PNG를 저장했어요.");
  }

  async function copyPng() {
    await document.fonts.ready;
    const scene = buildSimilarFiguresScene(state);
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
    const scene = buildSimilarFiguresScene(state);
    const svg = sceneToSvg(scene, fonts, state.style.lineWidth);
    downloadBlob(
      new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
      "평면도형의 닮음.svg",
    );
    setStatus("SVG를 저장했어요.");
  }

  const activeMarks = useMemo(() => listActiveMarks(state), [state]);

  return (
    <div className={`${notoSerif.variable} ${notoSerifKr.variable} space-y-4`}>
      <span
        className={`${notoSerif.className} ${notoSerifKr.className} sr-only italic`}
        style={{ fontFamily: '"Times New Roman", serif' }}
        aria-hidden
      >
        xxyy OO AA cm 가 60°
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
            평면도형의 닮음
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-foreground/65">
            왼쪽 도형을 그리면 닮음비에 맞춰 오른쪽이 따라옵니다. 오른쪽은
            돌리거나 대칭할 수 있고, 변을 누르면 길이가 붙습니다.
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

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)_minmax(15rem,18rem)]">
        <div className="mx-auto w-full max-w-[24rem] space-y-4 lg:mx-0 lg:max-w-none">
          <div className="overflow-hidden rounded-3xl border-2 border-wood/10 bg-white shadow-[0_12px_40px_rgba(61,44,30,0.08)]">
            <SimilarFiguresCanvas
              state={state}
              fonts={fonts}
              selected={selected}
              setState={setState}
              persist={persistCachedState}
              onSelect={setSelected}
              onDeleteSelected={deleteSelected}
            />
          </div>

          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <h2 className="font-display text-sm text-wood-dark">도형</h2>
            <p className="mb-1 mt-2 text-xs font-semibold text-foreground/60">
              변의 수
            </p>
            <Segmented
              value={String(n)}
              onChange={(v) => {
                const next = Number(v);
                setState((prev) => withSideCount(prev, next));
                setSelected({ figure: "a", t: "vertex", i: 0 });
              }}
              options={[3, 4, 5, 6].map((count) => ({
                id: String(count),
                label: String(count),
              }))}
            />
            <p className="mb-1 mt-3 text-xs font-semibold text-foreground/60">
              닮음비 {formatRatio(state)}
            </p>
            <div className="flex items-center gap-1.5">
              <NumberField
                label="A"
                value={state.ratioA}
                onChange={(ratioA) => set({ ratioA })}
                min={0.1}
                max={40}
                step={0.1}
              />
              <span className="mt-5 text-sm font-semibold text-foreground/45">:</span>
              <NumberField
                label="B"
                value={state.ratioB}
                onChange={(ratioB) => set({ ratioB })}
                min={0.1}
                max={40}
                step={0.1}
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {RATIO_CHIPS.map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => setState((prev) => setRatio(prev, chip.a, chip.b))}
                  className={`rounded-lg px-2 py-1 text-[11px] font-semibold ${
                    state.ratioA === chip.a && state.ratioB === chip.b
                      ? "bg-wood/15 text-wood-dark"
                      : "bg-black/5 text-foreground/55 hover:bg-black/10"
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setState((prev) => resetVertexNames(prev))}
              className="mt-3 w-full rounded-xl bg-black/5 px-3 py-2 text-xs font-semibold text-foreground/70 hover:bg-black/10"
            >
              이름 A, B, C… 다시
            </button>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <TextField
                label="단위"
                value={state.unit}
                onChange={(unit) => set({ unit })}
                placeholder="cm"
              />
              <TextField
                label="미지수"
                value={state.unknownLetter}
                onChange={(unknownLetter) => set({ unknownLetter })}
              />
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <h2 className="font-display text-sm text-wood-dark">표시</h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <ChipToggle
                on={state.showVertexNames}
                onClick={() => set({ showVertexNames: !state.showVertexNames })}
              >
                꼭짓점 이름
              </ChipToggle>
              <ChipToggle
                on={state.showDots}
                onClick={() => set({ showDots: !state.showDots })}
              >
                점
              </ChipToggle>
              <ChipToggle
                on={state.showGrid}
                onClick={() =>
                  set({
                    showGrid: !state.showGrid,
                    snapToGrid: !state.showGrid ? true : state.snapToGrid,
                  })
                }
              >
                모눈
              </ChipToggle>
              {state.showGrid ? (
                <ChipToggle
                  on={state.snapToGrid}
                  onClick={() => set({ snapToGrid: !state.snapToGrid })}
                >
                  격자 맞춤
                </ChipToggle>
              ) : null}
            </div>

            <p className="mt-3 text-[11px] font-semibold text-foreground/50">
              도형 {selected?.figure === "b" ? "B" : "A"}
            </p>
            <div className="mt-1 flex flex-wrap gap-1">
              {state.verticesA.map((v, i) => (
                <button
                  key={`a-${i}`}
                  type="button"
                  onClick={() => setSelected({ figure: "a", t: "vertex", i })}
                  className={`min-w-[1.5rem] rounded-full px-1.5 py-0.5 text-[11px] font-semibold transition ${
                    selected?.figure === "a" && selected.t === "vertex" && selected.i === i
                      ? "bg-wood text-cream"
                      : "bg-black/8 text-foreground/55"
                  }`}
                >
                  {v.name || defaultVertexName(i)}
                </button>
              ))}
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {state.verticesB.map((v, i) => (
                <button
                  key={`b-${i}`}
                  type="button"
                  onClick={() => setSelected({ figure: "b", t: "vertex", i })}
                  className={`min-w-[1.5rem] rounded-full px-1.5 py-0.5 text-[11px] font-semibold transition ${
                    selected?.figure === "b" && selected.t === "vertex" && selected.i === i
                      ? "bg-wood text-cream"
                      : "bg-black/8 text-foreground/55"
                  }`}
                >
                  {v.name || defaultVertexName(i + n)}
                </button>
              ))}
            </div>

            {selected?.t === "vertex" && selVertex ? (
              <div className="mt-3 space-y-2">
                <p className="text-[11px] font-semibold text-foreground/50">
                  꼭짓점 {selVertex.name || defaultVertexName(selected.i)}
                  <span className="ml-1 font-normal text-foreground/40">
                    ({selected.figure === "a" ? "왼쪽" : "오른쪽"})
                  </span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <ChipToggle
                    on={selVertex.showInterior}
                    onClick={() =>
                      setState((prev) => toggleInterior(prev, selected.figure, selected.i))
                    }
                  >
                    내각
                  </ChipToggle>
                  <ChipToggle
                    on={correspondingOn(state, selected)}
                    onClick={() => setState((prev) => mirrorCorresponding(prev, selected))}
                  >
                    대응각에도
                  </ChipToggle>
                </div>
                {selVertex.showInterior ? (
                  <>
                    {selected.figure === "a" ? (
                      <NumberField
                        label="내각 값"
                        value={Number(
                          vertexAngles(ptsForAngle, selected.i).interior.toFixed(1),
                        )}
                        onChange={(deg) =>
                          setState((prev) => {
                            const next = applySourceAngle(prev, selected.i, deg);
                            return {
                              ...next,
                              verticesA: next.verticesA.map((v, idx) =>
                                idx === selected.i
                                  ? {
                                      ...v,
                                      interior: {
                                        ...v.interior,
                                        mode: "custom" as const,
                                        custom: `${deg}°`,
                                      },
                                    }
                                  : v,
                              ),
                            };
                          })
                        }
                        min={1}
                        max={179}
                        step={1}
                        suffix="°"
                      />
                    ) : null}
                    <LabelModeRow
                      title="내각 표시"
                      mode={selVertex.interior.mode}
                      custom={selVertex.interior.custom}
                      unknownLetter={state.unknownLetter}
                      onMode={(mode) =>
                        patchVertex(setState, selected.figure, selected.i, {
                          interior: { ...selVertex.interior, mode },
                        })
                      }
                      onCustom={(custom) =>
                        patchVertex(setState, selected.figure, selected.i, {
                          interior: { ...selVertex.interior, custom },
                        })
                      }
                    />
                  </>
                ) : null}
              </div>
            ) : null}

            {selected?.t === "edge" && selEdge ? (
              <div className="mt-3 space-y-2">
                <p className="text-[11px] font-semibold text-foreground/50">
                  변 {edgeName(state, selected.figure, selected.i)}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <ChipToggle
                    on={selEdge.showLength}
                    onClick={() =>
                      setState((prev) => ({
                        ...prev,
                        ...(selected.figure === "a"
                          ? {
                              edgesA: prev.edgesA.map((e, i) =>
                                i === selected.i
                                  ? { ...e, showLength: !e.showLength }
                                  : e,
                              ),
                            }
                          : {
                              edgesB: prev.edgesB.map((e, i) =>
                                i === selected.i
                                  ? { ...e, showLength: !e.showLength }
                                  : e,
                              ),
                            }),
                      }))
                    }
                  >
                    길이
                  </ChipToggle>
                  <ChipToggle
                    on={correspondingOn(state, selected)}
                    onClick={() => setState((prev) => mirrorCorresponding(prev, selected))}
                  >
                    대응변에도
                  </ChipToggle>
                </div>
                {selEdge.showLength ? (
                  <>
                    {selected.figure === "a" ? (
                      <NumberField
                        label="길이 값"
                        value={Number(sourceEdgeLength(state, selected.i).toFixed(2))}
                        onChange={(len) =>
                          setState((prev) => {
                            const next = applySourceLength(prev, selected.i, len);
                            return {
                              ...next,
                              edgesA: next.edgesA.map((e, idx) =>
                                idx === selected.i
                                  ? {
                                      ...e,
                                      length: {
                                        ...e.length,
                                        mode: "custom" as const,
                                        custom: String(len),
                                      },
                                    }
                                  : e,
                              ),
                            };
                          })
                        }
                        min={0.5}
                        max={40}
                        step={0.1}
                        suffix={state.unit.trim() || "cm"}
                      />
                    ) : (
                      <p className="text-[11px] text-foreground/45">
                        자동 {Number(figureBEdgeLength(state, selected.i).toFixed(2))}{" "}
                        {state.unit.trim() || "cm"} · 숫자는 그림에서 고치면 표시만
                        바뀝니다.
                      </p>
                    )}
                    <LabelModeRow
                      title="길이 표시"
                      mode={selEdge.length.mode}
                      custom={selEdge.length.custom}
                      unknownLetter={state.unknownLetter}
                      onMode={(mode) =>
                        patchEdge(setState, selected.figure, selected.i, {
                          length: { ...selEdge.length, mode },
                        })
                      }
                      onCustom={(custom) =>
                        patchEdge(setState, selected.figure, selected.i, {
                          length: { ...selEdge.length, custom },
                        })
                      }
                    />
                  </>
                ) : null}
              </div>
            ) : null}

            <p className="mt-2 text-[11px] leading-snug text-foreground/45">
              왼쪽 점을 끌어 모양을 잡고, 오른쪽은 통째로 옮깁니다. 변을 누르면
              길이가 켜지고 꺼집니다.
            </p>

            {activeMarks.length > 0 ? (
              <ul className="mt-3 space-y-1">
                {activeMarks.map((item) => (
                  <li key={item.key} className="flex items-center gap-2">
                    <span className="flex-1 rounded-lg bg-black/5 px-2 py-1 text-xs font-semibold text-wood-dark">
                      {item.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => setState((prev) => item.clear(prev))}
                      className="text-xs font-semibold text-foreground/40 hover:text-foreground"
                    >
                      지우기
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <h2 className="font-display text-sm text-wood-dark">보기</h2>
            <p className="mt-2 text-xs font-semibold text-foreground/60">오른쪽 도형</p>
            <SliderField
              label="회전"
              value={state.rotateDeg}
              onChange={(rotateDeg) => set({ rotateDeg })}
              min={0}
              max={360}
              step={1}
              display={`${Math.round(state.rotateDeg)}°`}
            />
            <div className="mt-2 flex flex-wrap gap-1">
              {[0, 90, 180, 270].map((deg) => (
                <button
                  key={deg}
                  type="button"
                  onClick={() => set({ rotateDeg: deg })}
                  className={`rounded-lg px-2 py-1 text-[11px] font-semibold ${
                    Math.abs(state.rotateDeg - deg) < 0.6
                      ? "bg-wood/15 text-wood-dark"
                      : "bg-black/5 text-foreground/55 hover:bg-black/10"
                  }`}
                >
                  {deg}°
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs font-semibold text-foreground/60">대칭</p>
            <div className="mt-1">
              <Segmented
                value={state.reflect}
                onChange={(reflect: ReflectMode) => set({ reflect })}
                options={[
                  { id: "none", label: "없음" },
                  { id: "horizontal", label: "좌우" },
                  { id: "vertical", label: "상하" },
                ]}
              />
            </div>
            <button
              type="button"
              onClick={() => set({ shiftB: { x: 0, y: 0 } })}
              className="mt-3 w-full rounded-xl bg-black/5 px-3 py-2 text-xs font-semibold text-foreground/70 hover:bg-black/10"
            >
              위치 되돌리기
            </button>
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <h2 className="font-display text-sm text-wood-dark">빠른 그림</h2>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {SIMILAR_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setState(cloneState(preset.state));
                    setSelected({ figure: "a", t: "vertex", i: 0 });
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
                label="길이 글자"
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
                label="점 크기"
                value={state.style.pointRadius}
                onChange={(pointRadius) =>
                  set({ style: { ...state.style, pointRadius } })
                }
                min={2}
                max={10}
                step={0.5}
                display={state.style.pointRadius.toFixed(1)}
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

function edgeName(state: SimilarFiguresState, figure: FigureId, i: number): string {
  const n = state.points.length;
  const verts = figure === "a" ? state.verticesA : state.verticesB;
  const start = figure === "a" ? 0 : n;
  const a = verts[i]?.name.trim() || defaultVertexName(i + start);
  const b = verts[(i + 1) % n]?.name.trim() || defaultVertexName(((i + 1) % n) + start);
  return `${a}${b}`;
}

function patchVertex(
  setState: SimilarSetter,
  figure: FigureId,
  i: number,
  patch: Partial<SimilarFiguresState["verticesA"][number]>,
) {
  setState((prev) => {
    const key = figure === "a" ? "verticesA" : "verticesB";
    return {
      ...prev,
      [key]: prev[key].map((v, idx) => (idx === i ? { ...v, ...patch } : v)),
    };
  });
}

function patchEdge(
  setState: SimilarSetter,
  figure: FigureId,
  i: number,
  patch: Partial<SimilarFiguresState["edgesA"][number]>,
) {
  setState((prev) => {
    const key = figure === "a" ? "edgesA" : "edgesB";
    return {
      ...prev,
      [key]: prev[key].map((e, idx) => (idx === i ? { ...e, ...patch } : e)),
    };
  });
}

function listActiveMarks(state: SimilarFiguresState): {
  key: string;
  label: string;
  clear: (prev: SimilarFiguresState) => SimilarFiguresState;
}[] {
  const items: {
    key: string;
    label: string;
    clear: (prev: SimilarFiguresState) => SimilarFiguresState;
  }[] = [];
  state.verticesA.forEach((v, i) => {
    if (!v.showInterior) return;
    const name = v.name.trim() || defaultVertexName(i);
    items.push({
      key: `a-in-${i}`,
      label: `내각 ${name}`,
      clear: (prev) => ({
        ...prev,
        verticesA: prev.verticesA.map((item, idx) =>
          idx === i ? { ...item, showInterior: false } : item,
        ),
      }),
    });
  });
  state.verticesB.forEach((v, i) => {
    if (!v.showInterior) return;
    const name = v.name.trim() || defaultVertexName(i + state.points.length);
    items.push({
      key: `b-in-${i}`,
      label: `내각 ${name}`,
      clear: (prev) => ({
        ...prev,
        verticesB: prev.verticesB.map((item, idx) =>
          idx === i ? { ...item, showInterior: false } : item,
        ),
      }),
    });
  });
  state.edgesA.forEach((e, i) => {
    if (!e.showLength) return;
    items.push({
      key: `a-len-${i}`,
      label: `길이 ${edgeName(state, "a", i)}`,
      clear: (prev) => ({
        ...prev,
        edgesA: prev.edgesA.map((item, idx) =>
          idx === i ? { ...item, showLength: false } : item,
        ),
      }),
    });
  });
  state.edgesB.forEach((e, i) => {
    if (!e.showLength) return;
    items.push({
      key: `b-len-${i}`,
      label: `길이 ${edgeName(state, "b", i)}`,
      clear: (prev) => ({
        ...prev,
        edgesB: prev.edgesB.map((item, idx) =>
          idx === i ? { ...item, showLength: false } : item,
        ),
      }),
    });
  });
  return items;
}
