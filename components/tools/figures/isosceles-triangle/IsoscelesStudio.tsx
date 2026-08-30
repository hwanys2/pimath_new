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
import IsoscelesCanvas, {
  type IsoSetter,
} from "@/components/tools/figures/isosceles-triangle/IsoscelesCanvas";
import {
  canvasToPngBlob,
  copyPngToClipboard,
  downloadBlob,
} from "@/lib/diagrams/export-image";
import {
  applyIsoAngle,
  applyIsoLength,
  applyPartLength,
  cevianFromIndex,
  clearSelectionMarks,
  cycleExtraArcs,
  cycleTicks,
  edgeLength,
  edgeName,
  footPoint,
  partName,
  splitAngleName,
  vertexAngles,
  vertexName,
  wedgeDeg,
  type IsoSelection,
} from "@/lib/diagrams/isosceles-triangle/geometry";
import {
  DEFAULT_ISO_STATE,
  ISO_PRESETS,
  cloneState,
  normalizeState,
  setCevianFrom,
  setEqualApex,
  type CevianFrom,
  type EqualApex,
  type IsoscelesState,
  type WedgeMark,
} from "@/lib/diagrams/isosceles-triangle/model";
import { buildIsoscelesScene } from "@/lib/diagrams/isosceles-triangle/scene";
import { renderSceneToCanvas, sceneToSvg } from "@/lib/diagrams/render";
import type { FontFaces } from "@/lib/diagrams/math-label";

const STORAGE_KEY = "pm-diagram-g2-isosceles-triangle-v1";

const storeListeners = new Set<() => void>();

let cachedRaw: string | null = null;
let cachedState: IsoscelesState = DEFAULT_ISO_STATE;
let cacheReady = false;

function parseStoredState(raw: string | null): IsoscelesState {
  if (!raw) return DEFAULT_ISO_STATE;
  try {
    const parsed = JSON.parse(raw) as IsoscelesState;
    if (parsed && Array.isArray(parsed.points) && parsed.style) {
      return normalizeState(parsed);
    }
  } catch {
    /* keep default */
  }
  return DEFAULT_ISO_STATE;
}

function getServerSnapshot(): IsoscelesState {
  return DEFAULT_ISO_STATE;
}

function getClientSnapshot(): IsoscelesState {
  if (!cacheReady) {
    cacheReady = true;
    cachedRaw = window.localStorage.getItem(STORAGE_KEY);
    cachedState = parseStoredState(cachedRaw);
  }
  return cachedState;
}

function writeStoredState(state: IsoscelesState, persist = true) {
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

function useIsoState() {
  const state = useSyncExternalStore(
    subscribeStoredState,
    getClientSnapshot,
    getServerSnapshot,
  );
  const setState = useCallback<IsoSetter>((updater, persist = true) => {
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

export default function IsoscelesStudio() {
  const [state, setState] = useIsoState();
  const [status, setStatus] = useState<string | null>(null);
  const [selected, setSelected] = useState<IsoSelection | null>({
    t: "vertex",
    i: 0,
  });
  const fonts = useMemo(() => fontsFromNext(), []);
  const fromIdx = cevianFromIndex(state);
  const D = footPoint(state);
  const selVertex =
    selected?.t === "vertex" ? state.vertices[selected.i] : undefined;
  const selEdge = selected?.t === "edge" ? state.edges[selected.i] : undefined;

  const set = useCallback(
    (patch: Partial<IsoscelesState>) => {
      setState((prev) => normalizeState({ ...prev, ...patch }));
    },
    [setState],
  );

  const deleteSelected = useCallback(() => {
    setState((prev) => clearSelectionMarks(prev, selected));
  }, [selected, setState]);

  async function exportPng() {
    await document.fonts.ready;
    const scene = buildIsoscelesScene(state);
    const canvas = renderSceneToCanvas(
      scene,
      fonts,
      state.style.lineWidth,
      state.style.exportScale,
    );
    const blob = await canvasToPngBlob(canvas);
    downloadBlob(blob, "이등변삼각형.png");
    setStatus("PNG를 저장했어요.");
  }

  async function copyPng() {
    await document.fonts.ready;
    const scene = buildIsoscelesScene(state);
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
    const scene = buildIsoscelesScene(state);
    const svg = sceneToSvg(scene, fonts, state.style.lineWidth);
    downloadBlob(
      new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
      "이등변삼각형.svg",
    );
    setStatus("SVG를 저장했어요.");
  }

  const activeMarks = useMemo(() => listActiveMarks(state), [state]);
  const equalOptions: { id: EqualApex; label: string }[] = [
    { id: "none", label: "없음" },
    { id: "A", label: `${vertexName(state, 0)}${vertexName(state, 1)}=${vertexName(state, 0)}${vertexName(state, 2)}` },
    { id: "B", label: `${vertexName(state, 0)}${vertexName(state, 1)}=${vertexName(state, 1)}${vertexName(state, 2)}` },
    { id: "C", label: `${vertexName(state, 0)}${vertexName(state, 2)}=${vertexName(state, 1)}${vertexName(state, 2)}` },
  ];
  const cevianOptions: { id: CevianFrom; label: string }[] = [
    { id: "none", label: "없음" },
    { id: "A", label: `${vertexName(state, 0)}D` },
    { id: "B", label: `${vertexName(state, 1)}D` },
    { id: "C", label: `${vertexName(state, 2)}D` },
  ];

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
            이등변삼각형
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-foreground/65">
            등변 표시·밑각·외각·수선·이등분선을 붙여 중2 삼각형의 성질 문제를
            바로 그립니다. 점을 끌면 이등변 모양이 유지됩니다.
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
          <IsoscelesCanvas
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
                on={state.lockEqual && state.equalApex !== "none"}
                onClick={() => {
                  if (state.equalApex === "none") return;
                  set({ lockEqual: !state.lockEqual });
                }}
              >
                이등변 고정
              </ChipToggle>
            </div>

            <p className="mb-1 mt-3 text-[11px] font-semibold text-foreground/50">
              이등변
            </p>
            <Segmented
              value={state.equalApex}
              onChange={(v) =>
                setState((prev) => setEqualApex(prev, v as EqualApex))
              }
              options={equalOptions}
            />

            <p className="mb-1 mt-3 text-[11px] font-semibold text-foreground/50">
              보조선
            </p>
            <Segmented
              value={state.cevian.from}
              onChange={(v) => {
                const from = v as CevianFrom;
                setState((prev) => setCevianFrom(prev, from));
                if (from !== "none") setSelected({ t: "foot" });
              }}
              options={cevianOptions}
            />
            {fromIdx != null ? (
              <div className="mt-2">
                <Segmented
                  value={state.cevian.role}
                  onChange={(v) =>
                    setState((prev) => ({
                      ...prev,
                      cevian: {
                        ...prev.cevian,
                        role: v as IsoscelesState["cevian"]["role"],
                      },
                    }))
                  }
                  options={[
                    { id: "free", label: "자유" },
                    { id: "midpoint", label: "중점" },
                    { id: "altitude", label: "수선" },
                    { id: "bisector", label: "이등분" },
                  ]}
                />
              </div>
            ) : null}

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
              {fromIdx != null ? (
                <button
                  type="button"
                  onClick={() => setSelected({ t: "foot" })}
                  className={`min-w-[1.5rem] rounded-full px-1.5 py-0.5 text-[11px] font-semibold transition ${
                    selected?.t === "foot"
                      ? "bg-wood text-cream"
                      : "bg-black/8 text-foreground/55"
                  }`}
                >
                  {state.cevian.name || "D"}
                </button>
              ) : null}
            </div>

            {selected?.t === "vertex" && selVertex ? (
              <VertexPanel
                state={state}
                index={selected.i}
                vertex={selVertex}
                isCevianOrigin={fromIdx === selected.i}
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

            {selected?.t === "foot" && fromIdx != null && D ? (
              <FootPanel state={state} fromIdx={fromIdx} D={D} setState={setState} />
            ) : null}

            {selected?.t === "cevian" && fromIdx != null && D ? (
              <LengthOnly
                label={`${vertexName(state, fromIdx)}${state.cevian.name || "D"} 길이`}
                show={state.cevian.length.show}
                onToggle={() =>
                  setState((prev) => ({
                    ...prev,
                    cevian: {
                      ...prev.cevian,
                      length: { ...prev.cevian.length, show: !prev.cevian.length.show },
                    },
                  }))
                }
                value={Math.hypot(
                  D.x - state.points[fromIdx]!.x,
                  D.y - state.points[fromIdx]!.y,
                )}
                unit={state.unit}
                mode={state.cevian.length.label.mode}
                custom={state.cevian.length.label.custom}
                unknownLetter={state.unknownLetter}
                onValue={(n) =>
                  setState((prev) => applyPartLength(prev, "cevian", n))
                }
                onMode={(mode) =>
                  setState((prev) => ({
                    ...prev,
                    cevian: {
                      ...prev.cevian,
                      length: { ...prev.cevian.length, label: { ...prev.cevian.length.label, mode } },
                    },
                  }))
                }
                onCustom={(custom) =>
                  setState((prev) => ({
                    ...prev,
                    cevian: {
                      ...prev.cevian,
                      length: { ...prev.cevian.length, label: { ...prev.cevian.length.label, custom } },
                    },
                  }))
                }
              />
            ) : null}

            {selected?.t === "part" && fromIdx != null && D ? (
              <LengthOnly
                label={`${partName(state, selected.which)} 길이`}
                show={
                  selected.which === "left"
                    ? state.cevian.leftLen.show
                    : state.cevian.rightLen.show
                }
                onToggle={() =>
                  setState((prev) => {
                    const field = selected.which === "left" ? "leftLen" : "rightLen";
                    return {
                      ...prev,
                      cevian: {
                        ...prev.cevian,
                        [field]: { ...prev.cevian[field], show: !prev.cevian[field].show },
                      },
                    };
                  })
                }
                value={(() => {
                  const [i, j] = [
                    (fromIdx + 1) % 3,
                    (fromIdx + 2) % 3,
                  ];
                  const end = selected.which === "left" ? i : j;
                  return Math.hypot(
                    D.x - state.points[end]!.x,
                    D.y - state.points[end]!.y,
                  );
                })()}
                unit={state.unit}
                mode={
                  selected.which === "left"
                    ? state.cevian.leftLen.label.mode
                    : state.cevian.rightLen.label.mode
                }
                custom={
                  selected.which === "left"
                    ? state.cevian.leftLen.label.custom
                    : state.cevian.rightLen.label.custom
                }
                unknownLetter={state.unknownLetter}
                onValue={(n) =>
                  setState((prev) => applyPartLength(prev, selected.which, n))
                }
                onMode={(mode) =>
                  setState((prev) => {
                    const field = selected.which === "left" ? "leftLen" : "rightLen";
                    return {
                      ...prev,
                      cevian: {
                        ...prev.cevian,
                        [field]: {
                          ...prev.cevian[field],
                          label: { ...prev.cevian[field].label, mode },
                        },
                      },
                    };
                  })
                }
                onCustom={(custom) =>
                  setState((prev) => {
                    const field = selected.which === "left" ? "leftLen" : "rightLen";
                    return {
                      ...prev,
                      cevian: {
                        ...prev.cevian,
                        [field]: {
                          ...prev.cevian[field],
                          label: { ...prev.cevian[field].label, custom },
                        },
                      },
                    };
                  })
                }
              />
            ) : null}

            <p className="mt-2 text-[11px] leading-snug text-foreground/45">
              변을 누르면 길이가 켜지고, 보조선을 누르면 그 길이가 켜집니다.
              글자를 눌러 숫자나 x로 고칩니다.
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
              {ISO_PRESETS.map((preset) => (
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
  vertex,
  isCevianOrigin,
  setState,
}: {
  state: IsoscelesState;
  index: number;
  vertex: IsoscelesState["vertices"][number];
  isCevianOrigin: boolean;
  setState: IsoSetter;
}) {
  const name = vertex.name || vertexName(state, index);
  return (
    <div className="mt-3 space-y-2">
      <p className="text-[11px] font-semibold text-foreground/50">꼭짓점 {name}</p>
      <div className="flex flex-wrap gap-1.5">
        {!isCevianOrigin ? (
          <>
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
                on={vertex.fillInterior}
                onClick={() =>
                  patchVertex(setState, index, { fillInterior: !vertex.fillInterior })
                }
              >
                내각 채움
              </ChipToggle>
            ) : null}
          </>
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
        {vertex.showExterior ? (
          <ChipToggle
            on={vertex.fillExterior}
            onClick={() =>
              patchVertex(setState, index, { fillExterior: !vertex.fillExterior })
            }
          >
            외각 채움
          </ChipToggle>
        ) : null}
        <ChipToggle
          on={vertex.showDot}
          onClick={() => patchVertex(setState, index, { showDot: !vertex.showDot })}
        >
          각에 점
        </ChipToggle>
        <ChipToggle
          on={vertex.extraArcs > 0}
          onClick={() =>
            patchVertex(setState, index, { extraArcs: cycleExtraArcs(vertex.extraArcs) })
          }
        >
          같은 각 호 {vertex.extraArcs > 0 ? vertex.extraArcs + 1 : ""}
        </ChipToggle>
      </div>
      {vertex.showInterior && !isCevianOrigin ? (
        <>
          <NumberField
            label="내각 값"
            value={Number(vertexAngles(state.points, index).interior.toFixed(1))}
            onChange={(deg) =>
              setState((prev) => {
                const next = applyIsoAngle(prev, index, deg);
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
      {vertex.showExterior ? (
        <>
          <NumberField
            label="외각 값"
            value={Number(vertexAngles(state.points, index).exterior.toFixed(1))}
            onChange={(deg) =>
              setState((prev) => {
                const next = applyIsoAngle(prev, index, 180 - deg);
                return {
                  ...next,
                  vertices: next.vertices.map((v, idx) =>
                    idx === index
                      ? {
                          ...v,
                          exterior: {
                            ...v.exterior,
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
            title="외각 표시"
            mode={vertex.exterior.mode}
            custom={vertex.exterior.custom}
            unknownLetter={state.unknownLetter}
            onMode={(mode) =>
              patchVertex(setState, index, {
                exterior: { ...vertex.exterior, mode },
              })
            }
            onCustom={(custom) =>
              patchVertex(setState, index, {
                exterior: { ...vertex.exterior, custom },
              })
            }
          />
        </>
      ) : null}
      {isCevianOrigin ? (
        <div className="space-y-2">
          <WedgeRow
            state={state}
            title={`각 ${splitAngleName(state, "apexLeft")}`}
            mark={state.cevian.apexLeft}
            onPatch={(patch) => patchWedge(setState, "apexLeft", patch)}
          />
          <WedgeRow
            state={state}
            title={`각 ${splitAngleName(state, "apexRight")}`}
            mark={state.cevian.apexRight}
            onPatch={(patch) => patchWedge(setState, "apexRight", patch)}
          />
        </div>
      ) : null}
    </div>
  );
}

function EdgePanel({
  state,
  index,
  setState,
}: {
  state: IsoscelesState;
  index: number;
  setState: IsoSetter;
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
      </div>
      {edge.showLength ? (
        <>
          <NumberField
            label="길이 값"
            value={Number(edgeLength(state.points, index).toFixed(2))}
            onChange={(len) =>
              setState((prev) => {
                const next = applyIsoLength(prev, index, len);
                return {
                  ...next,
                  edges: next.edges.map((e, idx) =>
                    idx === index
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

function FootPanel({
  state,
  fromIdx,
  D,
  setState,
}: {
  state: IsoscelesState;
  fromIdx: 0 | 1 | 2;
  D: { x: number; y: number };
  setState: IsoSetter;
}) {
  const [li, ri] = [(fromIdx + 1) % 3, (fromIdx + 2) % 3];
  const leftDeg = wedgeDeg(D, state.points[fromIdx]!, state.points[li]!);
  const rightDeg = wedgeDeg(D, state.points[fromIdx]!, state.points[ri]!);
  return (
    <div className="mt-3 space-y-2">
      <p className="text-[11px] font-semibold text-foreground/50">
        점 {state.cevian.name || "D"}
      </p>
      <div className="flex flex-wrap gap-1.5">
        <ChipToggle
          on={state.cevian.showName}
          onClick={() =>
            setState((prev) => ({
              ...prev,
              cevian: { ...prev.cevian, showName: !prev.cevian.showName },
            }))
          }
        >
          이름
        </ChipToggle>
        <ChipToggle
          on={state.cevian.showRightAtD}
          onClick={() =>
            setState((prev) => ({
              ...prev,
              cevian: { ...prev.cevian, showRightAtD: !prev.cevian.showRightAtD },
            }))
          }
        >
          직각
        </ChipToggle>
        <ChipToggle
          on={state.cevian.length.show}
          onClick={() =>
            setState((prev) => ({
              ...prev,
              cevian: {
                ...prev.cevian,
                length: { ...prev.cevian.length, show: !prev.cevian.length.show },
              },
            }))
          }
        >
          {vertexName(state, fromIdx)}
          {state.cevian.name || "D"} 길이
        </ChipToggle>
      </div>
      <WedgeRow
        state={state}
        title={`각 ${splitAngleName(state, "footLeft")} (${leftDeg.toFixed(0)}°)`}
        mark={state.cevian.footLeft}
        onPatch={(patch) => patchWedge(setState, "footLeft", patch)}
      />
      <WedgeRow
        state={state}
        title={`각 ${splitAngleName(state, "footRight")} (${rightDeg.toFixed(0)}°)`}
        mark={state.cevian.footRight}
        onPatch={(patch) => patchWedge(setState, "footRight", patch)}
      />
    </div>
  );
}

function WedgeRow({
  state,
  title,
  mark,
  onPatch,
}: {
  state: IsoscelesState;
  title: string;
  mark: WedgeMark;
  onPatch: (patch: Partial<WedgeMark>) => void;
}) {
  return (
    <div className="space-y-1.5 rounded-xl bg-black/4 px-2 py-2">
      <p className="text-[11px] font-semibold text-foreground/50">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        <ChipToggle on={mark.show} onClick={() => onPatch({ show: !mark.show })}>
          표시
        </ChipToggle>
        {mark.show ? (
          <>
            <ChipToggle on={mark.fill} onClick={() => onPatch({ fill: !mark.fill })}>
              채움
            </ChipToggle>
            <ChipToggle
              on={mark.showDot}
              onClick={() => onPatch({ showDot: !mark.showDot })}
            >
              점
            </ChipToggle>
          </>
        ) : null}
      </div>
      {mark.show ? (
        <LabelModeRow
          title={title}
          mode={mark.label.mode}
          custom={mark.label.custom}
          unknownLetter={state.unknownLetter}
          onMode={(mode) => onPatch({ label: { ...mark.label, mode } })}
          onCustom={(custom) => onPatch({ label: { ...mark.label, custom } })}
        />
      ) : null}
    </div>
  );
}

function LengthOnly({
  label,
  show,
  onToggle,
  value,
  unit,
  mode,
  custom,
  unknownLetter,
  onValue,
  onMode,
  onCustom,
}: {
  label: string;
  show: boolean;
  onToggle: () => void;
  value: number;
  unit: string;
  mode: WedgeMark["label"]["mode"];
  custom: string;
  unknownLetter: string;
  onValue: (n: number) => void;
  onMode: (m: WedgeMark["label"]["mode"]) => void;
  onCustom: (v: string) => void;
}) {
  return (
    <div className="mt-3 space-y-2">
      <p className="text-[11px] font-semibold text-foreground/50">{label}</p>
      <ChipToggle on={show} onClick={onToggle}>
        길이
      </ChipToggle>
      {show ? (
        <>
          <NumberField
            label="길이 값"
            value={Number(value.toFixed(2))}
            onChange={onValue}
            min={0.5}
            max={40}
            step={0.1}
            suffix={unit.trim() || "cm"}
          />
          <LabelModeRow
            title="길이 표시"
            mode={mode}
            custom={custom}
            unknownLetter={unknownLetter}
            onMode={onMode}
            onCustom={onCustom}
          />
        </>
      ) : null}
    </div>
  );
}

function patchVertex(
  setState: IsoSetter,
  i: number,
  patch: Partial<IsoscelesState["vertices"][number]>,
) {
  setState((prev) => ({
    ...prev,
    vertices: prev.vertices.map((v, idx) => (idx === i ? { ...v, ...patch } : v)),
  }));
}

function patchEdge(
  setState: IsoSetter,
  i: number,
  patch: Partial<IsoscelesState["edges"][number]>,
) {
  setState((prev) => ({
    ...prev,
    edges: prev.edges.map((e, idx) => (idx === i ? { ...e, ...patch } : e)),
  }));
}

function patchWedge(
  setState: IsoSetter,
  key: "apexLeft" | "apexRight" | "footLeft" | "footRight",
  patch: Partial<WedgeMark>,
) {
  setState((prev) => ({
    ...prev,
    cevian: { ...prev.cevian, [key]: { ...prev.cevian[key], ...patch } },
  }));
}

function listActiveMarks(state: IsoscelesState): {
  key: string;
  label: string;
  clear: (prev: IsoscelesState) => IsoscelesState;
}[] {
  const items: {
    key: string;
    label: string;
    clear: (prev: IsoscelesState) => IsoscelesState;
  }[] = [];
  state.vertices.forEach((v, i) => {
    const name = v.name.trim() || vertexName(state, i);
    if (v.showInterior) {
      items.push({
        key: `in-${i}`,
        label: `내각 ${name}${v.fillInterior ? " 채움" : ""}`,
        clear: (prev) => ({
          ...prev,
          vertices: prev.vertices.map((item, idx) =>
            idx === i ? { ...item, showInterior: false, fillInterior: false } : item,
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
    if (e.showLength) {
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
    }
    if (e.ticks > 0) {
      items.push({
        key: `tick-${i}`,
        label: `등변 ${edgeName(state, i)}`,
        clear: (prev) => ({
          ...prev,
          edges: prev.edges.map((item, idx) =>
            idx === i ? { ...item, ticks: 0 } : item,
          ),
        }),
      });
    }
  });
  if (state.cevian.from !== "none") {
    items.push({
      key: "cevian",
      label: `보조선 ${vertexName(state, cevianFromIndex(state)!)}${state.cevian.name || "D"}`,
      clear: (prev) => setCevianFrom(prev, "none"),
    });
  }
  return items;
}
