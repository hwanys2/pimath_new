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
import PythagoreanCanvas, {
  type PythSetter,
} from "@/components/tools/figures/pythagorean/PythagoreanCanvas";
import {
  canvasToPngBlob,
  copyPngToClipboard,
  downloadBlob,
} from "@/lib/diagrams/export-image";
import {
  applyEditedLabel,
  displayName,
  draggableIds,
  pointIdsFor,
  rebuildTriangleFromLegs,
  segDisplayName,
  segLength,
  type PythSelection,
} from "@/lib/diagrams/pythagorean/geometry";
import {
  DEFAULT_PYTHAGOREAN_STATE,
  PYTHAGOREAN_PRESETS,
  cloneState,
  findSeg,
  fitGridToFigure,
  figureGridExtent,
  isLockedRight,
  normalizeState,
  patchSegState,
  setPointName,
  toggleAltitude,
  type AltitudeVertex,
  type PythagoreanState,
  type RightVertex,
} from "@/lib/diagrams/pythagorean/model";
import { buildPythagoreanScene } from "@/lib/diagrams/pythagorean/scene";
import { renderSceneToCanvas, sceneToSvg } from "@/lib/diagrams/render";
import type { FontFaces } from "@/lib/diagrams/math-label";

const STORAGE_KEY = "pm-diagram-g2-pythagorean-v1";

const storeListeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cachedState: PythagoreanState = DEFAULT_PYTHAGOREAN_STATE;
let cacheReady = false;

function parseStoredState(raw: string | null): PythagoreanState {
  if (!raw) return DEFAULT_PYTHAGOREAN_STATE;
  try {
    const parsed = JSON.parse(raw) as PythagoreanState;
    if (parsed && parsed.kind && parsed.A && parsed.style) {
      return normalizeState(parsed);
    }
  } catch {
    /* keep default */
  }
  return DEFAULT_PYTHAGOREAN_STATE;
}

function getServerSnapshot(): PythagoreanState {
  return DEFAULT_PYTHAGOREAN_STATE;
}

function getClientSnapshot(): PythagoreanState {
  if (!cacheReady) {
    cacheReady = true;
    cachedRaw = window.localStorage.getItem(STORAGE_KEY);
    cachedState = parseStoredState(cachedRaw);
  }
  return cachedState;
}

function writeStoredState(state: PythagoreanState, persist = true) {
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

function usePythagoreanState() {
  const state = useSyncExternalStore(
    subscribeStoredState,
    getClientSnapshot,
    getServerSnapshot,
  );
  const setState: PythSetter = useCallback((updater, persist = true) => {
    const prev = getClientSnapshot();
    const next = typeof updater === "function" ? updater(prev) : updater;
    writeStoredState(normalizeState(next), persist);
  }, []);
  return { state, setState };
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

export default function PythagoreanStudio() {
  const { state, setState } = usePythagoreanState();
  const [selected, setSelected] = useState<PythSelection | null>(null);
  const [status, setStatus] = useState("");
  const fonts = useMemo(() => fontsFromNext(), []);
  const figureGrid = useMemo(() => figureGridExtent(state), [state]);

  function set(patch: Partial<PythagoreanState>) {
    setState((prev) => normalizeState({ ...prev, ...patch }));
  }

  function deleteSelected() {
    if (!selected) return;
    if (selected.t === "seg") {
      setState((prev) => patchSegState(prev, selected.id, { show: false }));
    }
  }

  function rebuildFromLegs(legLeft: number, legRight: number) {
    setState((prev) => rebuildTriangleFromLegs(prev, legLeft, legRight));
  }

  async function exportPng() {
    await document.fonts.ready;
    const scene = buildPythagoreanScene(state);
    const canvas = renderSceneToCanvas(
      scene,
      fonts,
      state.style.lineWidth,
      state.style.exportScale,
    );
    const blob = await canvasToPngBlob(canvas);
    downloadBlob(blob, "피타고라스의정리.png");
    setStatus("PNG를 저장했어요.");
  }

  async function copyPng() {
    await document.fonts.ready;
    const scene = buildPythagoreanScene(state);
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
    const scene = buildPythagoreanScene(state);
    const svg = sceneToSvg(scene, fonts, state.style.lineWidth);
    downloadBlob(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }), "피타고라스의정리.svg");
    setStatus("SVG를 저장했어요.");
  }

  const selSeg = selected?.t === "seg" ? findSeg(state, selected.id) : undefined;
  const visiblePoints = pointIdsFor(state).filter((id) => id !== "D" || state.kind === "altitude");
  const dragIds = draggableIds(state);
  const canAltitude = state.kind === "triangle";
  const selectedVertex: AltitudeVertex | null =
    selected?.t === "point" && (selected.id === "A" || selected.id === "B" || selected.id === "C")
      ? selected.id
      : null;

  const showLegControls =
    isLockedRight(state.rightVertex) &&
    (state.kind === "triangle" ||
      state.kind === "squares" ||
      state.kind === "altitude");

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
            피타고라스의 정리
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-foreground/65">
            직각삼각형·세 변 위 정사각형·넓이 증명·빗변 수선·사각형 대각선을
            시험 그림처럼 그리고 PNG로 저장해요.
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
            <PythagoreanCanvas
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
            <h2 className="font-display text-sm text-wood-dark">캔버스</h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(state.kind === "triangle" || state.kind === "squares") && (
                <ChipToggle
                  on={state.showGrid}
                  onClick={() => set({ showGrid: !state.showGrid })}
                >
                  모눈
                </ChipToggle>
              )}
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
            </div>
            {(state.kind === "triangle" || state.kind === "squares") && state.showGrid ? (
              <div className="mt-3 space-y-2">
                <p className="text-xs font-semibold text-foreground/60">모눈 크기</p>
                <div className="grid grid-cols-2 gap-2">
                  <NumberField
                    label="가로"
                    value={state.gridCols}
                    onChange={(gridCols) => set({ gridCols })}
                    min={1}
                    max={50}
                    step={1}
                    suffix="칸"
                  />
                  <NumberField
                    label="세로"
                    value={state.gridRows}
                    onChange={(gridRows) => set({ gridRows })}
                    min={1}
                    max={50}
                    step={1}
                    suffix="칸"
                  />
                </div>
                <NumberField
                  label="여백"
                  value={state.gridMargin}
                  onChange={(gridMargin) => set({ gridMargin })}
                  min={0}
                  max={5}
                  step={0.5}
                  suffix="칸"
                />
                <button
                  type="button"
                  onClick={() => setState((prev) => normalizeState(fitGridToFigure(prev)))}
                  className="w-full rounded-lg bg-black/5 px-2 py-1.5 text-[11px] font-semibold text-foreground/65 hover:bg-black/10"
                >
                  도형 비율에 맞춤 ({figureGrid.cols}×{figureGrid.rows})
                </button>
              </div>
            ) : null}
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <h2 className="font-display text-sm text-wood-dark">세부 설정</h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <ChipToggle
                on={state.showRightAngle}
                onClick={() => set({ showRightAngle: !state.showRightAngle })}
              >
                직각
              </ChipToggle>
              {state.kind === "squares" && (
                <>
                  <ChipToggle
                    on={state.showFill}
                    onClick={() => set({ showFill: !state.showFill })}
                  >
                    면 채움
                  </ChipToggle>
                  <ChipToggle
                    on={state.showSquareLabels}
                    onClick={() => set({ showSquareLabels: !state.showSquareLabels })}
                  >
                    ㄱㄴㄷ
                  </ChipToggle>
                  <ChipToggle
                    on={state.showDissection}
                    onClick={() => set({ showDissection: !state.showDissection })}
                  >
                    빗변 분할
                  </ChipToggle>
                </>
              )}
              {state.kind === "proof" && (
                <ChipToggle
                  on={state.showFill}
                  onClick={() => set({ showFill: !state.showFill })}
                >
                  면 채움
                </ChipToggle>
              )}
              {state.kind === "rectangle" && (
                <ChipToggle
                  on={state.showDiagonal}
                  onClick={() => set({ showDiagonal: !state.showDiagonal })}
                >
                  대각선
                </ChipToggle>
              )}
            </div>

            {state.kind === "squares" ? (
              <div className="mt-2">
                <Segmented
                  value={state.squareLabelMode}
                  onChange={(v) =>
                    set({ squareLabelMode: v as PythagoreanState["squareLabelMode"] })
                  }
                  options={[
                    { id: "korean", label: "ㄱㄴㄷ" },
                    { id: "formula", label: "a² b² c²" },
                  ]}
                />
              </div>
            ) : null}

            {canAltitude ? (
              <div className="mt-3 space-y-2">
                <p className="text-xs font-semibold text-foreground/60">수선</p>
                <div className="flex flex-wrap gap-1.5">
                  {(["A", "B", "C"] as const).map((v) => (
                    <ChipToggle
                      key={v}
                      on={state.altitudes.includes(v)}
                      onClick={() => setState((prev) => toggleAltitude(prev, v))}
                    >
                      {displayName(state, v)}
                    </ChipToggle>
                  ))}
                </div>
                <p className="text-[11px] leading-snug text-foreground/45">
                  꼭짓점을 고르고 대변에 수선의 발을 내려요. 둔각이면 밑변을 점선으로 연장해요.
                </p>
              </div>
            ) : null}

            {state.kind === "triangle" || state.kind === "squares" ? (
              <div className="mt-3 space-y-2">
                <p className="text-xs font-semibold text-foreground/60">직각 위치</p>
                <Segmented
                  value={state.rightVertex}
                  onChange={(v) => {
                    const rv = v as RightVertex;
                    if (rv === "none") {
                      set({ rightVertex: "none", isoscelesRight: false });
                      return;
                    }
                    setState((prev) =>
                      rebuildTriangleFromLegs(
                        { ...prev, rightVertex: rv },
                        prev.legLeft,
                        prev.legRight,
                      ),
                    );
                  }}
                  options={
                    state.kind === "triangle"
                      ? [
                          { id: "C", label: "C" },
                          { id: "A", label: "A" },
                          { id: "B", label: "B" },
                          { id: "none", label: "없음" },
                        ]
                      : [
                          { id: "C", label: "C" },
                          { id: "A", label: "A" },
                          { id: "B", label: "B" },
                        ]
                  }
                />
                {isLockedRight(state.rightVertex) ? (
                  <ChipToggle
                    on={state.isoscelesRight}
                    onClick={() => {
                      const next = !state.isoscelesRight;
                      if (next) {
                        const m = Math.max(state.legLeft, state.legRight);
                        rebuildFromLegs(m, m);
                      }
                      set({ isoscelesRight: next });
                    }}
                  >
                    이등변직각
                  </ChipToggle>
                ) : null}
              </div>
            ) : null}

            {showLegControls ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <NumberField
                  label="다리 (왼쪽)"
                  value={state.legLeft}
                  onChange={(legLeft) => rebuildFromLegs(legLeft, state.legRight)}
                  min={0.5}
                  max={40}
                  step={0.1}
                  suffix={state.unit}
                />
                <NumberField
                  label="다리 (오른쪽)"
                  value={state.legRight}
                  onChange={(legRight) => rebuildFromLegs(state.legLeft, legRight)}
                  min={0.5}
                  max={40}
                  step={0.1}
                  suffix={state.unit}
                />
              </div>
            ) : null}

            {state.kind === "proof" ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <NumberField
                  label="다리 a"
                  value={state.proofLegA}
                  onChange={(proofLegA) => set({ proofLegA })}
                  min={0.5}
                  max={20}
                  step={0.5}
                />
                <NumberField
                  label="다리 b"
                  value={state.proofLegB}
                  onChange={(proofLegB) => set({ proofLegB })}
                  min={0.5}
                  max={20}
                  step={0.5}
                />
                <div className="col-span-2">
                  <p className="mb-1 text-xs font-semibold text-foreground/60">보기</p>
                  <Segmented
                    value={state.proofView}
                    onChange={(v) =>
                      set({ proofView: v as PythagoreanState["proofView"] })
                    }
                    options={[
                      { id: "both", label: "둘 다" },
                      { id: "inner", label: "c²" },
                      { id: "tiles", label: "a²+b²" },
                    ]}
                  />
                </div>
              </div>
            ) : null}

            {state.kind === "rectangle" ? (
              <div className="mt-3 space-y-2">
                <ChipToggle
                  on={state.rectSquare}
                  onClick={() =>
                    set({
                      rectSquare: !state.rectSquare,
                      rectHeight: state.rectWidth,
                    })
                  }
                >
                  정사각형
                </ChipToggle>
                <div className="grid grid-cols-2 gap-2">
                  <NumberField
                    label="가로"
                    value={state.rectWidth}
                    onChange={(rectWidth) => set({ rectWidth })}
                    min={0.5}
                    max={40}
                    suffix={state.unit}
                  />
                  {!state.rectSquare ? (
                    <NumberField
                      label="세로"
                      value={state.rectHeight}
                      onChange={(rectHeight) => set({ rectHeight })}
                      min={0.5}
                      max={40}
                      suffix={state.unit}
                    />
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="mt-2 flex flex-wrap gap-1">
              {visiblePoints.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSelected({ t: "point", id })}
                  className={`min-w-[1.5rem] rounded-full px-1.5 py-0.5 text-[11px] font-semibold transition ${
                    selected?.t === "point" && selected.id === id
                      ? "bg-wood text-cream"
                      : "bg-black/8 text-foreground/55"
                  }`}
                >
                  {displayName(state, id)}
                </button>
              ))}
            </div>

            {state.segs.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {state.segs.map((s) => (
                  <ChipToggle
                    key={s.id}
                    on={s.show}
                    onClick={() => {
                      setState((prev) =>
                        patchSegState(prev, s.id, { show: !s.show }),
                      );
                      setSelected({ t: "seg", id: s.id });
                    }}
                  >
                    {segDisplayName(state, s)}
                  </ChipToggle>
                ))}
              </div>
            ) : null}

            {selected?.t === "point" ? (
              <div className="mt-3 space-y-2">
                <p className="text-[11px] font-semibold text-foreground/50">
                  점 {displayName(state, selected.id)}
                  {dragIds.includes(selected.id) ? "" : " (위치 고정)"}
                </p>
                <TextField
                  label="이름"
                  value={displayName(state, selected.id)}
                  onChange={(name) =>
                    setState((prev) => setPointName(prev, selected.id, name))
                  }
                />
                {selectedVertex && canAltitude ? (
                  <ChipToggle
                    on={state.altitudes.includes(selectedVertex)}
                    onClick={() =>
                      setState((prev) => toggleAltitude(prev, selectedVertex))
                    }
                  >
                    대변에 수선
                  </ChipToggle>
                ) : null}
              </div>
            ) : null}

            {selected?.t === "seg" && selSeg ? (
              <div className="mt-3 space-y-2">
                <p className="text-[11px] font-semibold text-foreground/50">
                  선분 {segDisplayName(state, selSeg)}
                </p>
                {selSeg.show ? (
                  <>
                    <NumberField
                      label="길이 값"
                      value={Number((segLength(state, selSeg) || 0).toFixed(2))}
                      onChange={(n) =>
                        setState((prev) =>
                          applyEditedLabel(prev, `s:${selected.id}`, String(n)),
                        )
                      }
                      min={0.2}
                      max={80}
                      step={0.1}
                      suffix={state.unit.trim() || "cm"}
                    />
                    <LabelModeRow
                      title="길이"
                      mode={selSeg.label.mode}
                      custom={selSeg.label.custom}
                      unknownLetter={state.unknownLetter}
                      onMode={(mode) =>
                        setState((prev) => {
                          const seg = prev.segs.find((s) => s.id === selected.id);
                          if (!seg) return prev;
                          const label =
                            mode === "x"
                              ? {
                                  ...seg.label,
                                  mode,
                                  custom: /^[A-Za-z]$/.test(seg.label.custom.trim())
                                    ? seg.label.custom.trim()
                                    : prev.unknownLetter,
                                }
                              : { ...seg.label, mode };
                          return patchSegState(prev, selected.id, { label });
                        })
                      }
                      onCustom={(custom) =>
                        setState((prev) =>
                          applyEditedLabel(prev, `s:${selected.id}`, custom),
                        )
                      }
                    />
                  </>
                ) : null}
              </div>
            ) : null}
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <h2 className="font-display text-sm text-wood-dark">빠른 그림</h2>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {PYTHAGOREAN_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setState(normalizeState(cloneState(preset.state)));
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
                label="길이 글자"
                value={state.style.fontSize}
                onChange={(fontSize) => set({ style: { ...state.style, fontSize } })}
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
                onChange={(lineWidth) => set({ style: { ...state.style, lineWidth } })}
                min={1}
                max={3.5}
                step={0.1}
                display={state.style.lineWidth.toFixed(1)}
              />
              <div>
                <p className="mb-1 text-xs font-semibold text-foreground/60">저장 해상도</p>
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
