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
import PolygonCanvas, {
  type PolygonSelection,
  type PolygonSetter,
} from "@/components/tools/figures/polygon/PolygonCanvas";
import {
  canvasToPngBlob,
  copyPngToClipboard,
  downloadBlob,
} from "@/lib/diagrams/export-image";
import {
  allDiagonalsOn,
  applyInteriorAngleChange,
  clearSelectionMarks,
  toggleAllDiagonals,
  toggleVertexDiagonals,
  vertexDiagonalsOn,
} from "@/lib/diagrams/polygon/geometry";
import {
  POLYGON_PRESETS,
  cloneState,
  DEFAULT_POLYGON_STATE,
  allExteriorsOn,
  allInteriorsOn,
  allLengthsOn,
  computeLastInteriorAngle,
  normalizeState,
  setAllExteriors,
  setAllInteriors,
  setAllLengths,
  toRegular,
  withSideCount,
  type PolygonState,
} from "@/lib/diagrams/polygon/model";
import { buildPolygonScene } from "@/lib/diagrams/polygon/scene";
import { renderSceneToCanvas, sceneToSvg } from "@/lib/diagrams/render";
import type { FontFaces } from "@/lib/diagrams/math-label";

const STORAGE_KEY = "pm-diagram-g1-polygon-v2";

const storeListeners = new Set<() => void>();

let cachedRaw: string | null = null;
let cachedState: PolygonState = DEFAULT_POLYGON_STATE;
let cacheReady = false;

function parseStoredState(raw: string | null): PolygonState {
  if (!raw) return DEFAULT_POLYGON_STATE;
  try {
    const parsed = JSON.parse(raw) as PolygonState;
    if (parsed && Array.isArray(parsed.points) && parsed.style) {
      return normalizeState(parsed);
    }
  } catch {
    /* keep default */
  }
  return DEFAULT_POLYGON_STATE;
}

function getServerSnapshot(): PolygonState {
  return DEFAULT_POLYGON_STATE;
}

function getClientSnapshot(): PolygonState {
  if (!cacheReady) {
    cacheReady = true;
    cachedRaw = window.localStorage.getItem(STORAGE_KEY);
    cachedState = parseStoredState(cachedRaw);
  }
  return cachedState;
}

function writeStoredState(state: PolygonState, persist = true) {
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

function usePolygonState() {
  const state = useSyncExternalStore(
    subscribeStoredState,
    getClientSnapshot,
    getServerSnapshot,
  );
  const setState = useCallback<PolygonSetter>((updater, persist = true) => {
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

export default function PolygonStudio() {
  const [state, setState] = usePolygonState();
  const [status, setStatus] = useState<string | null>(null);
  const [selected, setSelected] = useState<PolygonSelection | null>({
    t: "vertex",
    i: 0,
  });
  const fonts = useMemo(() => fontsFromNext(), []);
  const n = state.points.length;
  const selVertex =
    selected?.t === "vertex" ? state.vertices[selected.i] : undefined;
  const selEdge = selected?.t === "edge" ? state.edges[selected.i] : undefined;

  const set = useCallback(
    (patch: Partial<PolygonState>) => {
      setState((prev) => normalizeState({ ...prev, ...patch }));
    },
    [setState],
  );

  const deleteSelected = useCallback(() => {
    setState((prev) => clearSelectionMarks(prev, selected));
  }, [selected, setState]);

  async function exportPng() {
    await document.fonts.ready;
    const scene = buildPolygonScene(state);
    const canvas = renderSceneToCanvas(
      scene,
      fonts,
      state.style.lineWidth,
      state.style.exportScale,
    );
    const blob = await canvasToPngBlob(canvas);
    downloadBlob(blob, "다각형.png");
    setStatus("PNG를 저장했어요.");
  }

  async function copyPng() {
    await document.fonts.ready;
    const scene = buildPolygonScene(state);
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
    const scene = buildPolygonScene(state);
    const svg = sceneToSvg(scene, fonts, state.style.lineWidth);
    downloadBlob(
      new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
      "다각형.svg",
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
            <Link href="/tools/figures?grade=1" className="hover:underline">
              문제 그림 그리기
            </Link>
            <span className="mx-1.5 text-foreground/30">/</span>
            중1
          </p>
          <h1 className="font-display mt-1 text-3xl text-wood-dark sm:text-4xl">
            다각형
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-foreground/65">
            꼭짓점을 끌어 모양을 잡고, 칩으로 내각·외각·길이·대각선을 켭니다.
            글자를 누르면 바로 고칠 수 있어요.
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

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(16rem,20rem)_minmax(15rem,18rem)]">
        <div className="mx-auto w-full max-w-[24rem] overflow-hidden rounded-3xl border-2 border-wood/10 bg-white shadow-[0_12px_40px_rgba(61,44,30,0.08)] lg:mx-0">
          <PolygonCanvas
            state={state}
            fonts={fonts}
            selected={selected}
            setState={setState}
            persist={persistCachedState}
            onSelect={setSelected}
            onDeleteSelected={deleteSelected}
          />
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
                on={allInteriorsOn(state)}
                onClick={() => setState((prev) => setAllInteriors(prev, !allInteriorsOn(prev)))}
              >
                모든 내각
              </ChipToggle>
              <ChipToggle
                on={allExteriorsOn(state)}
                onClick={() => setState((prev) => setAllExteriors(prev, !allExteriorsOn(prev)))}
              >
                모든 외각
              </ChipToggle>
              <ChipToggle
                on={allLengthsOn(state)}
                onClick={() => setState((prev) => setAllLengths(prev, !allLengthsOn(prev)))}
              >
                모든 변 길이
              </ChipToggle>
              {n >= 4 ? (
                <ChipToggle
                  on={allDiagonalsOn(state)}
                  onClick={() => setState((prev) => toggleAllDiagonals(prev))}
                >
                  모든 대각선
                </ChipToggle>
              ) : null}
            </div>

            <div className="mt-2 flex flex-wrap gap-1">
              {state.vertices.map((v, i) => (
                <button
                  key={`name-${i}`}
                  type="button"
                  onClick={() => setSelected({ t: "vertex", i })}
                  className={`min-w-[1.5rem] rounded-full px-1.5 py-0.5 text-[11px] font-semibold transition ${
                    selected?.t === "vertex" && selected.i === i
                      ? "bg-wood text-cream"
                      : "bg-black/8 text-foreground/55"
                  }`}
                >
                  {v.name || defaultName(i)}
                </button>
              ))}
            </div>

            {selected?.t === "vertex" && selVertex ? (
              <div className="mt-3 space-y-2">
                <p className="text-[11px] font-semibold text-foreground/50">
                  꼭짓점 {selVertex.name || defaultName(selected.i)}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <ChipToggle
                    on={selVertex.showInterior}
                    onClick={() =>
                      patchVertex(setState, selected.i, {
                        showInterior: !selVertex.showInterior,
                      })
                    }
                  >
                    내각
                  </ChipToggle>
                  <ChipToggle
                    on={selVertex.showExterior}
                    onClick={() =>
                      patchVertex(setState, selected.i, {
                        showExterior: !selVertex.showExterior,
                        fillExterior: !selVertex.showExterior
                          ? selVertex.fillExterior
                          : false,
                      })
                    }
                  >
                    외각
                  </ChipToggle>
                  {selVertex.showExterior ? (
                    <ChipToggle
                      on={selVertex.fillExterior}
                      onClick={() =>
                        patchVertex(setState, selected.i, {
                          fillExterior: !selVertex.fillExterior,
                        })
                      }
                    >
                      외각 채움
                    </ChipToggle>
                  ) : null}
                  {n >= 4 ? (
                    <ChipToggle
                      on={vertexDiagonalsOn(state, selected.i)}
                      onClick={() =>
                        setState((prev) => toggleVertexDiagonals(prev, selected.i))
                      }
                    >
                      이 점의 대각선
                    </ChipToggle>
                  ) : null}
                </div>
                {selVertex.showInterior ? (
                  <LabelModeRow
                    title="내각"
                    mode={selVertex.interior.mode}
                    custom={selVertex.interior.custom}
                    unknownLetter={state.unknownLetter}
                    onMode={(mode) =>
                      patchVertex(setState, selected.i, {
                        interior: { ...selVertex.interior, mode },
                      })
                    }
                    onCustom={(custom) =>
                      patchVertex(setState, selected.i, {
                        interior: { ...selVertex.interior, custom },
                      })
                    }
                  />
                ) : null}
                {selVertex.showExterior ? (
                  <LabelModeRow
                    title="외각"
                    mode={selVertex.exterior.mode}
                    custom={selVertex.exterior.custom}
                    unknownLetter={state.unknownLetter}
                    onMode={(mode) =>
                      patchVertex(setState, selected.i, {
                        exterior: { ...selVertex.exterior, mode },
                      })
                    }
                    onCustom={(custom) =>
                      patchVertex(setState, selected.i, {
                        exterior: { ...selVertex.exterior, custom },
                      })
                    }
                  />
                ) : null}
              </div>
            ) : null}

            {selected?.t === "edge" && selEdge ? (
              <div className="mt-3 space-y-2">
                <p className="text-[11px] font-semibold text-foreground/50">
                  변 {edgeName(state, selected.i)}
                </p>
                <ChipToggle
                  on={selEdge.showLength}
                  onClick={() =>
                    patchEdge(setState, selected.i, {
                      showLength: !selEdge.showLength,
                    })
                  }
                >
                  길이
                </ChipToggle>
                {selEdge.showLength ? (
                  <LabelModeRow
                    title="길이"
                    mode={selEdge.length.mode}
                    custom={selEdge.length.custom}
                    unknownLetter={state.unknownLetter}
                    onMode={(mode) =>
                      patchEdge(setState, selected.i, {
                        length: { ...selEdge.length, mode },
                      })
                    }
                    onCustom={(custom) =>
                      patchEdge(setState, selected.i, {
                        length: { ...selEdge.length, custom },
                      })
                    }
                  />
                ) : null}
              </div>
            ) : null}

            <p className="mt-2 text-[11px] leading-snug text-foreground/45">
              꼭짓점을 끌어 모양을 바꾸고, 변을 눌러 고른 뒤 길이를 켜세요.
              글자를 누르면 숫자나 x로 고칠 수 있어요.
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
        </div>

        <div className="space-y-4">
          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <h2 className="font-display text-sm text-wood-dark">빠른 그림</h2>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {POLYGON_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setState(cloneState(preset.state));
                    setSelected({ t: "vertex", i: 0 });
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
            <h2 className="font-display text-sm text-wood-dark">도형</h2>
            <p className="mb-1 mt-2 text-xs font-semibold text-foreground/60">
              변의 수
            </p>
            <Segmented
              value={String(n)}
              onChange={(v) => {
                const next = Number(v);
                setState((prev) => withSideCount(prev, next));
                setSelected({ t: "vertex", i: 0 });
              }}
              options={[3, 4, 5, 6, 7, 8].map((count) => ({
                id: String(count),
                label: String(count),
              }))}
            />
            <button
              type="button"
              onClick={() => setState((prev) => toRegular(prev))}
              className="mt-3 w-full rounded-xl bg-black/5 px-3 py-2 text-xs font-semibold text-foreground/70 hover:bg-black/10"
            >
              정다각형
            </button>
            <div className="mt-3 space-y-2">
              <p className="text-xs font-semibold text-foreground/60">내각 (°)</p>
              <p className="text-[11px] leading-snug text-foreground/45">
                마지막 꼭짓점 각은 (n−2)×180°에서 나머지 합을 뺀 값으로
                자동 맞춰집니다. 길이를 바꾸면 모든 변이 같은 비율로
                커지거나 작아집니다.
              </p>
              {state.vertices.map((v, i) => {
                const name = v.name.trim() || defaultName(i);
                const isLast = i === n - 1;
                const value = isLast
                  ? computeLastInteriorAngle(state.interiorAnglesDeg, n)
                  : state.interiorAnglesDeg[i] ?? 0;
                return (
                  <NumberField
                    key={`angle-${i}`}
                    label={isLast ? `∠${name} (자동)` : `∠${name}`}
                    value={Number(value.toFixed(1))}
                    onChange={(deg) =>
                      setState((prev) => applyInteriorAngleChange(prev, i, deg))
                    }
                    min={1}
                    max={179}
                    step={1}
                    suffix="°"
                    disabled={isLast}
                  />
                );
              })}
            </div>
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

function defaultName(i: number): string {
  return i < 26 ? String.fromCharCode(65 + i) : `P${i + 1}`;
}

function edgeName(state: PolygonState, i: number): string {
  const n = state.points.length;
  const a = state.vertices[i]?.name.trim() || defaultName(i);
  const b = state.vertices[(i + 1) % n]?.name.trim() || defaultName((i + 1) % n);
  return `${a}${b}`;
}

function patchVertex(
  setState: PolygonSetter,
  i: number,
  patch: Partial<PolygonState["vertices"][number]>,
) {
  setState((prev) => ({
    ...prev,
    vertices: prev.vertices.map((v, idx) => (idx === i ? { ...v, ...patch } : v)),
  }));
}

function patchEdge(
  setState: PolygonSetter,
  i: number,
  patch: Partial<PolygonState["edges"][number]>,
) {
  setState((prev) => ({
    ...prev,
    edges: prev.edges.map((e, idx) => (idx === i ? { ...e, ...patch } : e)),
  }));
}

function listActiveMarks(state: PolygonState): {
  key: string;
  label: string;
  clear: (prev: PolygonState) => PolygonState;
}[] {
  const items: {
    key: string;
    label: string;
    clear: (prev: PolygonState) => PolygonState;
  }[] = [];
  state.vertices.forEach((v, i) => {
    const name = v.name.trim() || defaultName(i);
    if (v.showInterior) {
      items.push({
        key: `in-${i}`,
        label: `내각 ${name}`,
        clear: (prev) => ({
          ...prev,
          vertices: prev.vertices.map((item, idx) =>
            idx === i ? { ...item, showInterior: false } : item,
          ),
        }),
      });
    }
    if (v.showExterior) {
      items.push({
        key: `ex-${i}`,
        label: `외각 ${name}${v.fillExterior ? " 채움" : ""}`,
        clear: (prev) => ({
          ...prev,
          vertices: prev.vertices.map((item, idx) =>
            idx === i
              ? { ...item, showExterior: false, fillExterior: false }
              : item,
          ),
        }),
      });
    }
  });
  state.edges.forEach((e, i) => {
    if (!e.showLength) return;
    items.push({
      key: `len-${i}`,
      label: `길이 ${edgeName(state, i)}`,
      clear: (prev) => ({
        ...prev,
        edges: prev.edges.map((item, idx) =>
          idx === i ? { ...item, showLength: false } : item,
        ),
      }),
    });
  });
  state.diagonals.forEach(([a, b]) => {
    const an = state.vertices[a]?.name.trim() || defaultName(a);
    const bn = state.vertices[b]?.name.trim() || defaultName(b);
    items.push({
      key: `d-${a}-${b}`,
      label: `대각선 ${an}${bn}`,
      clear: (prev) => ({
        ...prev,
        diagonals: prev.diagonals.filter(([i, j]) => !(i === a && j === b)),
      }),
    });
  });
  return items;
}
