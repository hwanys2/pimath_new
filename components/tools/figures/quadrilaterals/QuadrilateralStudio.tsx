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
import QuadrilateralCanvas, {
  type QuadSetter,
} from "@/components/tools/figures/quadrilaterals/QuadrilateralCanvas";
import {
  canvasToPngBlob,
  copyPngToClipboard,
  downloadBlob,
} from "@/lib/diagrams/export-image";
import {
  applyDiagLength,
  applyQuadAngle,
  applyQuadLength,
  clearSelectionMarks,
  cycleExtraArcs,
  cycleTicks,
  diagSegPoints,
  edgeLength,
  edgeName,
  patchWedge,
  prevIndex,
  nextIndex,
  segName,
  setDiagonals,
  snapFamily,
  vertexAngles,
  vertexName,
  wedgeDeg,
  wedgeName,
  type QuadSelection,
} from "@/lib/diagrams/quadrilaterals/geometry";
import {
  DEFAULT_QUAD_STATE,
  DIAG_SEG_IDS,
  FACE_KEYS,
  QUAD_FAMILIES,
  QUAD_PRESETS,
  cloneState,
  cycleAngleFill,
  cycleAngleMark,
  cycleFaceFill,
  normalizeState,
  type DiagSegId,
  type FaceKey,
  type QuadFamily,
  type QuadState,
} from "@/lib/diagrams/quadrilaterals/model";
import { buildQuadScene } from "@/lib/diagrams/quadrilaterals/scene";
import { renderSceneToCanvas, sceneToSvg } from "@/lib/diagrams/render";
import type { FontFaces } from "@/lib/diagrams/math-label";
import { len } from "@/lib/diagrams/polygon/geometry";

const STORAGE_KEY = "pm-diagram-g2-quadrilaterals-v1";

const storeListeners = new Set<() => void>();

let cachedRaw: string | null = null;
let cachedState: QuadState = DEFAULT_QUAD_STATE;
let cacheReady = false;

function parseStoredState(raw: string | null): QuadState {
  if (!raw) return DEFAULT_QUAD_STATE;
  try {
    const parsed = JSON.parse(raw) as QuadState;
    if (parsed && Array.isArray(parsed.points) && parsed.style) {
      return normalizeState(parsed);
    }
  } catch {
    /* keep default */
  }
  return DEFAULT_QUAD_STATE;
}

function getServerSnapshot(): QuadState {
  return DEFAULT_QUAD_STATE;
}

function getClientSnapshot(): QuadState {
  if (!cacheReady) {
    cacheReady = true;
    cachedRaw = window.localStorage.getItem(STORAGE_KEY);
    cachedState = parseStoredState(cachedRaw);
  }
  return cachedState;
}

function writeStoredState(state: QuadState, persist = true) {
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

function useQuadState() {
  const state = useSyncExternalStore(
    subscribeStoredState,
    getClientSnapshot,
    getServerSnapshot,
  );
  const setState = useCallback<QuadSetter>((updater, persist = true) => {
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

const FACE_LABEL: Record<FaceKey, string> = {
  DBC: "△DBC",
  ODC: "△ODC",
  ABC: "△ABC",
  AOB: "△AOB",
};

export default function QuadrilateralStudio() {
  const [state, setState] = useQuadState();
  const [status, setStatus] = useState<string | null>(null);
  const [selected, setSelected] = useState<QuadSelection | null>({
    t: "vertex",
    i: 0,
  });
  const fonts = useMemo(() => fontsFromNext(), []);
  const selVertex =
    selected?.t === "vertex" ? state.vertices[selected.i] : undefined;
  const selEdge = selected?.t === "edge" ? state.edges[selected.i] : undefined;

  const set = useCallback(
    (patch: Partial<QuadState>) => {
      setState((prev) => normalizeState({ ...prev, ...patch }));
    },
    [setState],
  );

  const deleteSelected = useCallback(() => {
    setState((prev) => clearSelectionMarks(prev, selected));
  }, [selected, setState]);

  async function exportPng() {
    await document.fonts.ready;
    const scene = buildQuadScene(state);
    const canvas = renderSceneToCanvas(
      scene,
      fonts,
      state.style.lineWidth,
      state.style.exportScale,
    );
    const blob = await canvasToPngBlob(canvas);
    downloadBlob(blob, "사각형의 성질.png");
    setStatus("PNG를 저장했어요.");
  }

  async function copyPng() {
    await document.fonts.ready;
    const scene = buildQuadScene(state);
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
    const scene = buildQuadScene(state);
    const svg = sceneToSvg(scene, fonts, state.style.lineWidth);
    downloadBlob(
      new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
      "사각형의 성질.svg",
    );
    setStatus("SVG를 저장했어요.");
  }

  const activeMarks = useMemo(() => listActiveMarks(state), [state]);
  const diagsOn = state.showDiagAC || state.showDiagBD || state.showO;

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
            사각형의 성질
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-foreground/65">
            평행사변형·직사각형·마름모·사다리꼴을 고르면 성질이 유지됩니다.
            대변·대각선·맞꼭지각 표시를 붙여 PNG로 저장해요.
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
          <QuadrilateralCanvas
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
                on={diagsOn}
                onClick={() => setState((prev) => setDiagonals(prev, !diagsOn))}
              >
                대각선·O
              </ChipToggle>
              <ChipToggle
                on={state.showRightAtO}
                onClick={() =>
                  setState((prev) => ({
                    ...prev,
                    showRightAtO: !prev.showRightAtO,
                    showO: true,
                    showDiagAC: true,
                    showDiagBD: true,
                  }))
                }
              >
                대각선 수직
              </ChipToggle>
              <ChipToggle
                on={state.showGuides}
                onClick={() => set({ showGuides: !state.showGuides })}
              >
                평행선
              </ChipToggle>
              <ChipToggle
                on={state.extension.show}
                onClick={() =>
                  setState((prev) => ({
                    ...prev,
                    extension: { ...prev.extension, show: !prev.extension.show },
                  }))
                }
              >
                변 연장
              </ChipToggle>
            </div>
            {state.extension.show ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {([0, 1, 2, 3] as const).map((i) => (
                  <ChipToggle
                    key={`ext-${i}`}
                    on={state.extension.vertex === i}
                    onClick={() =>
                      setState((prev) => ({
                        ...prev,
                        extension: { ...prev.extension, vertex: i, show: true },
                      }))
                    }
                  >
                    {vertexName(state, i)}에서
                  </ChipToggle>
                ))}
              </div>
            ) : null}

            <p className="mb-1 mt-3 text-[11px] font-semibold text-foreground/50">
              면 채움
            </p>
            <div className="flex flex-wrap gap-1.5">
              {FACE_KEYS.map((key) => (
                <ChipToggle
                  key={key}
                  on={state.faces[key] !== "none"}
                  onClick={() =>
                    setState((prev) => ({
                      ...prev,
                      faces: {
                        ...prev.faces,
                        [key]: cycleFaceFill(prev.faces[key]),
                      },
                      showO:
                        key === "ODC" || key === "AOB" ? true : prev.showO,
                      showDiagAC:
                        key === "ODC" || key === "AOB" ? true : prev.showDiagAC,
                      showDiagBD:
                        key === "ODC" || key === "AOB" ? true : prev.showDiagBD,
                    }))
                  }
                >
                  {FACE_LABEL[key]}
                  {state.faces[key] === "green"
                    ? " 녹"
                    : state.faces[key] === "yellow"
                      ? " 노랑"
                      : ""}
                </ChipToggle>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap gap-1">
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
                  {v.name || vertexName(state, i)}
                </button>
              ))}
              {diagsOn ? (
                <button
                  type="button"
                  onClick={() => setSelected({ t: "o" })}
                  className={`min-w-[1.5rem] rounded-full px-1.5 py-0.5 text-[11px] font-semibold transition ${
                    selected?.t === "o"
                      ? "bg-wood text-cream"
                      : "bg-black/8 text-foreground/55"
                  }`}
                >
                  {state.oName || "O"}
                </button>
              ) : null}
              {state.extension.show ? (
                <button
                  type="button"
                  onClick={() => setSelected({ t: "extension" })}
                  className={`min-w-[1.5rem] rounded-full px-1.5 py-0.5 text-[11px] font-semibold transition ${
                    selected?.t === "extension"
                      ? "bg-wood text-cream"
                      : "bg-black/8 text-foreground/55"
                  }`}
                >
                  {state.extension.name || "E"}
                </button>
              ) : null}
            </div>

            {selected?.t === "vertex" && selVertex ? (
              <VertexPanel
                state={state}
                index={selected.i}
                setState={setState}
              />
            ) : null}

            {selected?.t === "edge" && selEdge ? (
              <EdgePanel
                state={state}
                index={selected.i}
                setState={setState}
              />
            ) : null}

            {selected?.t === "o" ? (
              <OPanel state={state} setState={setState} />
            ) : null}

            {selected?.t === "seg" ? (
              <SegPanel state={state} id={selected.id} setState={setState} />
            ) : null}

            {selected?.t === "extension" ? (
              <p className="mt-3 text-[11px] text-foreground/50">
                연장점 {state.extension.name || "E"} · 꼭짓점{" "}
                {vertexName(state, state.extension.vertex)}에서 변을 늘립니다.
              </p>
            ) : null}

            <p className="mt-2 text-[11px] leading-snug text-foreground/45">
              점을 끌면 고른 도형의 성질이 유지됩니다. 변을 누르면 길이가
              켜지고, 글자를 눌러 숫자나 x로 고칩니다.
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
              {QUAD_PRESETS.map((preset) => (
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
              종류
            </p>
            <div className="flex flex-wrap gap-1.5">
              {QUAD_FAMILIES.map((f) => (
                <ChipToggle
                  key={f.id}
                  on={state.family === f.id}
                  onClick={() => {
                    const family = f.id;
                    setState((prev) =>
                      normalizeState({
                        ...prev,
                        family,
                        points: snapFamily(prev.points, family, 1),
                      }),
                    );
                  }}
                >
                  {f.label}
                </ChipToggle>
              ))}
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

function VertexPanel({
  state,
  index,
  setState,
}: {
  state: QuadState;
  index: number;
  setState: QuadSetter;
}) {
  const vertex = state.vertices[index]!;
  const name = vertex.name || vertexName(state, index);
  const diagsOn = state.showDiagAC || state.showDiagBD || state.showO;
  return (
    <div className="mt-3 space-y-2">
      <p className="text-[11px] font-semibold text-foreground/50">꼭짓점 {name}</p>
      <div className="flex flex-wrap gap-1.5">
        <ChipToggle
          on={vertex.showInterior}
          onClick={() =>
            patchVertex(setState, index, { showInterior: !vertex.showInterior })
          }
        >
          내각
        </ChipToggle>
        {vertex.showInterior ? (
          <ChipToggle
            on={vertex.fillInterior !== "none"}
            onClick={() =>
              patchVertex(setState, index, {
                fillInterior: cycleAngleFill(vertex.fillInterior),
              })
            }
          >
            내각 채움
            {vertex.fillInterior === "pink"
              ? " 분홍"
              : vertex.fillInterior === "blue"
                ? " 파랑"
                : ""}
          </ChipToggle>
        ) : null}
        <ChipToggle
          on={vertex.showExterior}
          onClick={() =>
            patchVertex(setState, index, {
              showExterior: !vertex.showExterior,
              fillExterior: !vertex.showExterior ? vertex.fillExterior : false,
            })
          }
        >
          외각
        </ChipToggle>
        <ChipToggle
          on={vertex.angleMark !== "none"}
          onClick={() =>
            patchVertex(setState, index, {
              angleMark: cycleAngleMark(vertex.angleMark),
              showInterior: true,
            })
          }
        >
          {vertex.angleMark === "x" ? "각에 x" : "각에 점"}
        </ChipToggle>
        <ChipToggle
          on={vertex.extraArcs > 0}
          onClick={() =>
            patchVertex(setState, index, {
              extraArcs: cycleExtraArcs(vertex.extraArcs),
            })
          }
        >
          같은 각 호 {vertex.extraArcs > 0 ? vertex.extraArcs + 1 : ""}
        </ChipToggle>
        {diagsOn ? (
          <>
            <ChipToggle
              on={vertex.wedgePrev.show}
              onClick={() => {
                setState((prev) =>
                  patchWedge(prev, index, "wedgePrev", {
                    show: !prev.vertices[index]!.wedgePrev.show,
                  }),
                );
                setState((prev) => ({
                  ...prev,
                  showO: true,
                  showDiagAC: true,
                  showDiagBD: true,
                }));
              }}
            >
              ∠{wedgeName(state, index, "prev")}
            </ChipToggle>
            <ChipToggle
              on={vertex.wedgeNext.show}
              onClick={() => {
                setState((prev) =>
                  patchWedge(prev, index, "wedgeNext", {
                    show: !prev.vertices[index]!.wedgeNext.show,
                  }),
                );
                setState((prev) => ({
                  ...prev,
                  showO: true,
                  showDiagAC: true,
                  showDiagBD: true,
                }));
              }}
            >
              ∠{wedgeName(state, index, "next")}
            </ChipToggle>
          </>
        ) : null}
      </div>
      {vertex.showInterior ? (
        <>
          <NumberField
            label="내각 값"
            value={Number(vertexAngles(state.points, index).interior.toFixed(1))}
            onChange={(deg) =>
              setState((prev) => {
                const next = applyQuadAngle(prev, index, deg);
                return {
                  ...next,
                  vertices: next.vertices.map((v, idx) =>
                    idx === index
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
          <LabelModeRow
            title="내각 표시"
            mode={vertex.interior.mode}
            custom={vertex.interior.custom}
            unknownLetter={state.unknownLetter}
            onMode={(mode) =>
              patchVertex(setState, index, {
                interior: { ...vertex.interior, mode },
              })
            }
            onCustom={(custom) =>
              patchVertex(setState, index, {
                interior: { ...vertex.interior, custom },
              })
            }
          />
        </>
      ) : null}
      {vertex.wedgePrev.show ? (
        <WedgeFields
          state={state}
          index={index}
          which="prev"
          setState={setState}
        />
      ) : null}
      {vertex.wedgeNext.show ? (
        <WedgeFields
          state={state}
          index={index}
          which="next"
          setState={setState}
        />
      ) : null}
    </div>
  );
}

function WedgeFields({
  state,
  index,
  which,
  setState,
}: {
  state: QuadState;
  index: number;
  which: "prev" | "next";
  setState: QuadSetter;
}) {
  const key = which === "prev" ? "wedgePrev" : "wedgeNext";
  const mark = state.vertices[index]![key];
  const V = state.points[index]!;
  const other =
    which === "prev"
      ? state.points[prevIndex(index, 4)]!
      : state.points[nextIndex(index, 4)]!;
  const O = {
    x: (state.points[0]!.x + state.points[2]!.x) / 2,
    y: (state.points[0]!.y + state.points[2]!.y) / 2,
  };
  const deg = wedgeDeg(V, other, O);
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold text-foreground/50">
        ∠{wedgeName(state, index, which)}
      </p>
      <div className="flex flex-wrap gap-1.5">
        <ChipToggle
          on={mark.fill !== "none"}
          onClick={() =>
            setState((prev) =>
              patchWedge(prev, index, key, { fill: cycleAngleFill(mark.fill) }),
            )
          }
        >
          채움
        </ChipToggle>
      </div>
      <NumberField
        label="각"
        value={Number(deg.toFixed(1))}
        onChange={() => undefined}
        min={1}
        max={179}
        step={1}
        suffix="°"
        disabled
      />
      <LabelModeRow
        title="각 표시"
        mode={mark.label.mode}
        custom={mark.label.custom}
        unknownLetter={state.unknownLetter}
        onMode={(mode) =>
          setState((prev) =>
            patchWedge(prev, index, key, { label: { ...mark.label, mode } }),
          )
        }
        onCustom={(custom) =>
          setState((prev) =>
            patchWedge(prev, index, key, { label: { ...mark.label, custom } }),
          )
        }
      />
    </div>
  );
}

function EdgePanel({
  state,
  index,
  setState,
}: {
  state: QuadState;
  index: number;
  setState: QuadSetter;
}) {
  const edge = state.edges[index]!;
  return (
    <div className="mt-3 space-y-2">
      <p className="text-[11px] font-semibold text-foreground/50">
        변 {edgeName(state, index)}
      </p>
      <div className="flex flex-wrap gap-1.5">
        <ChipToggle
          on={edge.showLength}
          onClick={() =>
            patchEdge(setState, index, { showLength: !edge.showLength })
          }
        >
          길이
        </ChipToggle>
        <ChipToggle
          on={edge.ticks > 0}
          onClick={() => patchEdge(setState, index, { ticks: cycleTicks(edge.ticks) })}
        >
          등변 표시 {edge.ticks > 0 ? edge.ticks : ""}
        </ChipToggle>
        <ChipToggle
          on={edge.parallel}
          onClick={() => patchEdge(setState, index, { parallel: !edge.parallel })}
        >
          평행 화살
        </ChipToggle>
      </div>
      {edge.showLength ? (
        <>
          <NumberField
            label="길이 값"
            value={Number(edgeLength(state.points, index).toFixed(2))}
            onChange={(n) =>
              setState((prev) => {
                const next = applyQuadLength(prev, index, n);
                return {
                  ...next,
                  edges: next.edges.map((e, idx) =>
                    idx === index
                      ? {
                          ...e,
                          length: {
                            ...e.length,
                            mode: "custom" as const,
                            custom: String(n),
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
          <LabelModeRow
            title="길이 표시"
            mode={edge.length.mode}
            custom={edge.length.custom}
            unknownLetter={state.unknownLetter}
            onMode={(mode) =>
              patchEdge(setState, index, { length: { ...edge.length, mode } })
            }
            onCustom={(custom) =>
              patchEdge(setState, index, { length: { ...edge.length, custom } })
            }
          />
        </>
      ) : null}
    </div>
  );
}

function OPanel({
  state,
  setState,
}: {
  state: QuadState;
  setState: QuadSetter;
}) {
  return (
    <div className="mt-3 space-y-2">
      <p className="text-[11px] font-semibold text-foreground/50">점 {state.oName || "O"}</p>
      <div className="flex flex-wrap gap-1.5">
        {DIAG_SEG_IDS.filter((id) => id !== "AC" && id !== "BD").map((id) => (
          <ChipToggle
            key={id}
            on={state.diagSegs[id].show}
            onClick={() =>
              setState((prev) => ({
                ...prev,
                diagSegs: {
                  ...prev.diagSegs,
                  [id]: { ...prev.diagSegs[id], show: !prev.diagSegs[id].show },
                },
              }))
            }
          >
            {segName(state, id)}
          </ChipToggle>
        ))}
        <ChipToggle
          on={state.diagSegs.AC.show}
          onClick={() =>
            setState((prev) => ({
              ...prev,
              diagSegs: {
                ...prev.diagSegs,
                AC: { ...prev.diagSegs.AC, show: !prev.diagSegs.AC.show },
              },
            }))
          }
        >
          {segName(state, "AC")}
        </ChipToggle>
        <ChipToggle
          on={state.diagSegs.BD.show}
          onClick={() =>
            setState((prev) => ({
              ...prev,
              diagSegs: {
                ...prev.diagSegs,
                BD: { ...prev.diagSegs.BD, show: !prev.diagSegs.BD.show },
              },
            }))
          }
        >
          {segName(state, "BD")}
        </ChipToggle>
      </div>
    </div>
  );
}

function SegPanel({
  state,
  id,
  setState,
}: {
  state: QuadState;
  id: DiagSegId;
  setState: QuadSetter;
}) {
  const mark = state.diagSegs[id];
  const [a, b] = diagSegPoints(state, id);
  const value = len(subVec(a, b));
  return (
    <div className="mt-3 space-y-2">
      <p className="text-[11px] font-semibold text-foreground/50">
        {segName(state, id)}
      </p>
      <ChipToggle
        on={mark.show}
        onClick={() =>
          setState((prev) => ({
            ...prev,
            diagSegs: {
              ...prev.diagSegs,
              [id]: { ...prev.diagSegs[id], show: !prev.diagSegs[id].show },
            },
          }))
        }
      >
        길이
      </ChipToggle>
      {mark.show ? (
        <>
          <NumberField
            label="길이 값"
            value={Number(value.toFixed(2))}
            onChange={(n) =>
              setState((prev) => {
                const next = applyDiagLength(prev, id, n);
                return {
                  ...next,
                  diagSegs: {
                    ...next.diagSegs,
                    [id]: {
                      show: true,
                      label: {
                        ...next.diagSegs[id].label,
                        mode: "custom" as const,
                        custom: String(n),
                      },
                    },
                  },
                };
              })
            }
            min={0.5}
            max={40}
            step={0.1}
            suffix={state.unit.trim() || "cm"}
          />
          <LabelModeRow
            title="길이 표시"
            mode={mark.label.mode}
            custom={mark.label.custom}
            unknownLetter={state.unknownLetter}
            onMode={(mode) =>
              setState((prev) => ({
                ...prev,
                diagSegs: {
                  ...prev.diagSegs,
                  [id]: { ...prev.diagSegs[id], label: { ...mark.label, mode } },
                },
              }))
            }
            onCustom={(custom) =>
              setState((prev) => ({
                ...prev,
                diagSegs: {
                  ...prev.diagSegs,
                  [id]: {
                    ...prev.diagSegs[id],
                    label: { ...mark.label, custom },
                  },
                },
              }))
            }
          />
        </>
      ) : null}
    </div>
  );
}

function subVec(a: { x: number; y: number }, b: { x: number; y: number }) {
  return { x: a.x - b.x, y: a.y - b.y };
}

function patchVertex(
  setState: QuadSetter,
  i: number,
  patch: Partial<QuadState["vertices"][number]>,
) {
  setState((prev) => ({
    ...prev,
    vertices: prev.vertices.map((v, idx) => (idx === i ? { ...v, ...patch } : v)),
  }));
}

function patchEdge(
  setState: QuadSetter,
  i: number,
  patch: Partial<QuadState["edges"][number]>,
) {
  setState((prev) => ({
    ...prev,
    edges: prev.edges.map((e, idx) => (idx === i ? { ...e, ...patch } : e)),
  }));
}

function listActiveMarks(state: QuadState): {
  key: string;
  label: string;
  clear: (prev: QuadState) => QuadState;
}[] {
  const items: {
    key: string;
    label: string;
    clear: (prev: QuadState) => QuadState;
  }[] = [];
  state.vertices.forEach((v, i) => {
    const name = v.name.trim() || vertexName(state, i);
    if (v.showInterior) {
      items.push({
        key: `in-${i}`,
        label: `내각 ${name}`,
        clear: (prev) => ({
          ...prev,
          vertices: prev.vertices.map((item, idx) =>
            idx === i
              ? { ...item, showInterior: false, fillInterior: "none", angleMark: "none" }
              : item,
          ),
        }),
      });
    }
    if (v.showExterior) {
      items.push({
        key: `ex-${i}`,
        label: `외각 ${name}`,
        clear: (prev) => ({
          ...prev,
          vertices: prev.vertices.map((item, idx) =>
            idx === i ? { ...item, showExterior: false, fillExterior: false } : item,
          ),
        }),
      });
    }
  });
  state.edges.forEach((e, i) => {
    if (!e.showLength && e.ticks === 0 && !e.parallel) return;
    items.push({
      key: `e-${i}`,
      label: `변 ${edgeName(state, i)}`,
      clear: (prev) => ({
        ...prev,
        edges: prev.edges.map((item, idx) =>
          idx === i
            ? { ...item, showLength: false, ticks: 0, parallel: false }
            : item,
        ),
      }),
    });
  });
  if (state.showDiagAC || state.showDiagBD || state.showO) {
    items.push({
      key: "diags",
      label: "대각선·O",
      clear: (prev) => setDiagonals(prev, false),
    });
  }
  if (state.extension.show) {
    items.push({
      key: "ext",
      label: `연장 ${state.extension.name || "E"}`,
      clear: (prev) => ({
        ...prev,
        extension: { ...prev.extension, show: false },
      }),
    });
  }
  return items;
}
