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
import SimilarSolidsCanvas, {
  type SimilarSolidsSetter,
} from "@/components/tools/figures/similar-solids/SimilarSolidsCanvas";
import {
  canvasToPngBlob,
  copyPngToClipboard,
  downloadBlob,
} from "@/lib/diagrams/export-image";
import {
  cloneSimilarState,
  DEFAULT_SIMILAR_SOLIDS_STATE,
  extractMeasureMarks,
  normalizeSimilarState,
  pairSolidStates,
  patchSideMarks,
  patchSource,
  sideMarks,
  SIMILAR_SOLIDS_PRESETS,
  type SimilarSolidsState,
} from "@/lib/diagrams/similar-solids/model";
import { buildSimilarSolidsScene } from "@/lib/diagrams/similar-solids/scene";
import {
  FAMILY_OPTIONS,
  PLATONIC_OPTIONS,
  cycleVertexMode,
  defaultVertexNames,
  familyHasFaceHeight,
  familyHasSlant,
  familyIsRound,
  familyIsSmooth,
  familyIsSphere,
  familyIsStacked,
  familyNeedsSides,
  resetView,
  vertexMode,
  vertexModeTitle,
  withFamily,
  type SolidSketchState,
} from "@/lib/diagrams/solid-sketch/model";
import {
  buildSolidMesh,
  faceHeightLength,
  faceHeightSpan,
  slantLength,
  slantSpan,
  withFaceHeight,
  withSlantLength,
} from "@/lib/diagrams/solid-sketch/solids";
import { renderSceneToCanvas, sceneToSvg } from "@/lib/diagrams/render";
import type { FontFaces } from "@/lib/diagrams/math-label";

const STORAGE_KEY = "pm-diagram-g2-similar-solids-v1";

const storeListeners = new Set<() => void>();

let cachedRaw: string | null = null;
let cachedState: SimilarSolidsState = DEFAULT_SIMILAR_SOLIDS_STATE;
let cacheReady = false;

function parseStoredState(raw: string | null): SimilarSolidsState {
  if (!raw) return DEFAULT_SIMILAR_SOLIDS_STATE;
  try {
    const parsed = JSON.parse(raw) as SimilarSolidsState;
    if (parsed && parsed.source && typeof parsed.source.family === "string") {
      return normalizeSimilarState(parsed);
    }
  } catch {
    /* keep default */
  }
  return DEFAULT_SIMILAR_SOLIDS_STATE;
}

function getServerSnapshot(): SimilarSolidsState {
  return DEFAULT_SIMILAR_SOLIDS_STATE;
}

function getClientSnapshot(): SimilarSolidsState {
  if (!cacheReady) {
    cacheReady = true;
    cachedRaw = window.localStorage.getItem(STORAGE_KEY);
    cachedState = parseStoredState(cachedRaw);
  }
  return cachedState;
}

function writeStoredState(state: SimilarSolidsState, persist = true) {
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

function useSimilarSolidsState() {
  const state = useSyncExternalStore(
    subscribeStoredState,
    getClientSnapshot,
    getServerSnapshot,
  );
  const setState = useCallback<SimilarSolidsSetter>((updater, persist = true) => {
    const prev = getClientSnapshot();
    const next = typeof updater === "function" ? updater(prev) : updater;
    if (Object.is(next, prev)) {
      if (persist) persistCachedState();
      return;
    }
    writeStoredState(normalizeSimilarState(next), persist);
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

export default function SimilarSolidsStudio() {
  const [state, setState] = useSimilarSolidsState();
  const [status, setStatus] = useState<string | null>(null);
  const [markSide, setMarkSide] = useState<"left" | "right">("left");
  const fonts = useMemo(() => fontsFromNext(), []);
  const source = state.source;
  const marks = sideMarks(state, markSide);

  const setSource = useCallback(
    (patch: Partial<SolidSketchState>) => {
      setState((prev) => patchSource(prev, patch));
    },
    [setState],
  );

  const set = useCallback(
    (patch: Partial<SimilarSolidsState>) => {
      setState((prev) => normalizeSimilarState({ ...prev, ...patch }));
    },
    [setState],
  );

  async function exportPng() {
    await document.fonts.ready;
    const scene = buildSimilarSolidsScene(state);
    const canvas = renderSceneToCanvas(
      scene,
      fonts,
      source.style.lineWidth,
      source.style.exportScale,
    );
    const blob = await canvasToPngBlob(canvas);
    downloadBlob(blob, "입체도형의닮음.png");
    setStatus("PNG를 저장했어요.");
  }

  async function copyPng() {
    await document.fonts.ready;
    const scene = buildSimilarSolidsScene(state);
    const canvas = renderSceneToCanvas(
      scene,
      fonts,
      source.style.lineWidth,
      source.style.exportScale,
    );
    const blob = await canvasToPngBlob(canvas);
    await copyPngToClipboard(blob);
    setStatus("클립보드에 그림을 복사했어요. 한글·워드에 붙여넣기 하세요.");
  }

  function exportSvg() {
    const scene = buildSimilarSolidsScene(state);
    const svg = sceneToSvg(scene, fonts, source.style.lineWidth);
    downloadBlob(
      new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
      "입체도형의닮음.svg",
    );
    setStatus("SVG를 저장했어요.");
  }

  const round = familyIsRound(source.family);
  const smooth = familyIsSmooth(source.family);
  const sphere = familyIsSphere(source.family);
  const hemisphere = source.family === "hemisphere";
  const stacked = familyIsStacked(source.family);
  const needsSides = familyNeedsSides(source.family);
  const prismRect = source.family === "prism" && source.sides === 4;
  const vertexLabels = useMemo(
    () => (smooth ? [] : buildSolidMesh(source).names),
    [smooth, source],
  );

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
            입체도형의 닮음
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-foreground/65">
            왼쪽 입체 하나를 그리고 닮음비만 넣으면 오른쪽이 같이 그려집니다.
            빈 곳을 끌어 돌리고, 모서리를 눌러 그 쪽에만 길이를 붙이세요. 어느
            쪽 숫자를 고쳐도 비가 유지됩니다.
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
            <SimilarSolidsCanvas
              state={state}
              fonts={fonts}
              setState={setState}
              persist={persistCachedState}
            />
          </div>

          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <h2 className="font-display text-sm text-wood-dark">도형</h2>
            <div className="mt-2 flex flex-wrap gap-1">
              {FAMILY_OPTIONS.map((opt) => (
                <ChipToggle
                  key={opt.id}
                  on={source.family === opt.id}
                  onClick={() =>
                    setState((prev) => {
                      const nextSource = withFamily(prev.source, opt.id);
                      return normalizeSimilarState({
                        ...prev,
                        source: nextSource,
                        rightMarks: extractMeasureMarks(nextSource),
                        rightVertexNames: [],
                      });
                    })
                  }
                >
                  {opt.label}
                </ChipToggle>
              ))}
            </div>
            {needsSides ? (
              <div className="mt-3">
                <p className="mb-1 text-xs font-semibold text-foreground/60">
                  밑면 변의 수
                </p>
                <Segmented
                  value={String(source.sides)}
                  onChange={(v) =>
                    setSource({ sides: Number(v), vertexNames: [] })
                  }
                  options={[3, 4, 5, 6, 7, 8].map((n) => ({
                    id: String(n),
                    label: String(n),
                  }))}
                />
              </div>
            ) : null}
            {source.family === "platonic" ? (
              <div className="mt-3 flex flex-wrap gap-1">
                {PLATONIC_OPTIONS.map((opt) => (
                  <ChipToggle
                    key={opt.id}
                    on={source.platonic === opt.id}
                    onClick={() =>
                      setSource({ platonic: opt.id, vertexNames: [] })
                    }
                  >
                    {opt.label}
                  </ChipToggle>
                ))}
              </div>
            ) : null}
            {source.family === "cylinder" ? (
              <div className="mt-3">
                <Segmented
                  value={source.cylinderLie}
                  onChange={(cylinderLie) => setSource({ cylinderLie })}
                  options={[
                    { id: "vertical", label: "세움" },
                    { id: "horizontal", label: "눕힘" },
                  ]}
                />
              </div>
            ) : null}
            {hemisphere ? (
              <div className="mt-3">
                <p className="mb-1 text-xs font-semibold text-foreground/60">
                  반구 방향
                </p>
                <Segmented
                  value={source.hemisphereFlip ? "flipped" : "normal"}
                  onChange={(v) =>
                    setSource({ hemisphereFlip: v === "flipped" })
                  }
                  options={[
                    { id: "normal", label: "아래 잘림" },
                    { id: "flipped", label: "위 잘림" },
                  ]}
                />
              </div>
            ) : null}
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {prismRect ? (
                <>
                  <NumberField
                    label="가로"
                    value={source.width}
                    onChange={(width) => setSource({ width })}
                    min={0.5}
                    max={40}
                    suffix="cm"
                  />
                  <NumberField
                    label="세로"
                    value={source.depth}
                    onChange={(depth) => setSource({ depth })}
                    min={0.5}
                    max={40}
                    suffix="cm"
                  />
                </>
              ) : null}
              {needsSides && !prismRect ? (
                <NumberField
                  label="밑면 한 변"
                  value={source.baseSize}
                  onChange={(baseSize) => setSource({ baseSize })}
                  min={0.5}
                  max={40}
                  suffix="cm"
                />
              ) : null}
              {source.family === "frustum" ? (
                <NumberField
                  label="윗면 한 변"
                  value={source.topSize}
                  onChange={(topSize) => setSource({ topSize })}
                  min={0.4}
                  max={40}
                  suffix="cm"
                />
              ) : null}
              {round ? (
                <NumberField
                  label="밑면 반지름"
                  value={source.radius}
                  onChange={(radius) => setSource({ radius })}
                  min={0.4}
                  max={40}
                  suffix="cm"
                />
              ) : null}
              {sphere || hemisphere || stacked ? (
                <NumberField
                  label="반지름"
                  value={source.radius}
                  onChange={(radius) => setSource({ radius })}
                  min={0.4}
                  max={40}
                  suffix="cm"
                />
              ) : null}
              {source.family === "coneFrustum" ? (
                <NumberField
                  label="윗면 반지름"
                  value={source.topRadius}
                  onChange={(topRadius) => setSource({ topRadius })}
                  min={0.3}
                  max={40}
                  suffix="cm"
                />
              ) : null}
              {source.family === "platonic" ? (
                <NumberField
                  label="한 모서리"
                  value={source.edgeLength}
                  onChange={(edgeLength) => setSource({ edgeLength })}
                  min={0.5}
                  max={40}
                  suffix="cm"
                />
              ) : null}
              {!sphere && !hemisphere && source.family !== "platonic" ? (
                <>
                  <NumberField
                    label={
                      source.family === "cylinderCone"
                        ? "원기둥 높이"
                        : source.family === "coneHemisphere"
                          ? "원뿔 높이"
                          : "높이"
                    }
                    value={source.height}
                    onChange={(height) => setSource({ height })}
                    min={0.5}
                    max={40}
                    suffix="cm"
                  />
                  {source.family === "cylinderCone" ? (
                    <NumberField
                      label="원뿔 높이"
                      value={source.capHeight}
                      onChange={(capHeight) => setSource({ capHeight })}
                      min={0.5}
                      max={40}
                      suffix="cm"
                    />
                  ) : null}
                  {familyHasFaceHeight(source.family) ? (
                    <NumberField
                      label="옆면 높이"
                      value={Number(faceHeightLength(source).toFixed(3))}
                      onChange={(length) =>
                        setState((prev) =>
                          patchSource(prev, (cur) => withFaceHeight(cur, length)),
                        )
                      }
                      min={Number((faceHeightSpan(source) + 0.1).toFixed(2))}
                      max={50}
                      step={0.1}
                      suffix="cm"
                    />
                  ) : null}
                  {familyHasSlant(source.family) ? (
                    <NumberField
                      label="모선"
                      value={Number(slantLength(source).toFixed(3))}
                      onChange={(slant) =>
                        setState((prev) =>
                          patchSource(prev, (cur) => withSlantLength(cur, slant)),
                        )
                      }
                      min={Number((slantSpan(source) + 0.1).toFixed(2))}
                      max={50}
                      step={0.1}
                      suffix="cm"
                    />
                  ) : null}
                </>
              ) : null}
              <TextField
                label="단위"
                value={source.unit}
                onChange={(unit) => setSource({ unit })}
                placeholder="cm"
              />
              <TextField
                label="미지수"
                value={source.unknownLetter}
                onChange={(unknownLetter) => setSource({ unknownLetter })}
              />
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <h2 className="font-display text-sm text-wood-dark">표시</h2>
            <div className="mt-2">
              <p className="mb-1 text-xs font-semibold text-foreground/60">
                길이 표시 쪽
              </p>
              <Segmented
                value={markSide}
                onChange={(v) => setMarkSide(v)}
                options={[
                  { id: "left", label: "왼쪽" },
                  { id: "right", label: "오른쪽" },
                ]}
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <ChipToggle
                on={source.showFill}
                onClick={() => setSource({ showFill: !source.showFill })}
              >
                면 채움
              </ChipToggle>
              <ChipToggle
                on={source.showHidden}
                onClick={() => setSource({ showHidden: !source.showHidden })}
              >
                숨은 선
              </ChipToggle>
              <ChipToggle
                on={state.showFigureLabels}
                onClick={() => set({ showFigureLabels: !state.showFigureLabels })}
              >
                도형 이름
              </ChipToggle>
              {!sphere && !hemisphere ? (
                <ChipToggle
                  on={marks.showHeight}
                  onClick={() =>
                    setState((prev) =>
                      patchSideMarks(prev, markSide, {
                        showHeight: !sideMarks(prev, markSide).showHeight,
                      }),
                    )
                  }
                >
                  높이
                </ChipToggle>
              ) : null}
              {marks.showHeight ? (
                <ChipToggle
                  on={marks.showHeightRightAngle}
                  onClick={() =>
                    setState((prev) =>
                      patchSideMarks(prev, markSide, {
                        showHeightRightAngle:
                          !sideMarks(prev, markSide).showHeightRightAngle,
                      }),
                    )
                  }
                >
                  직각
                </ChipToggle>
              ) : null}
              {smooth ? (
                <ChipToggle
                  on={source.showCenter}
                  onClick={() => setSource({ showCenter: !source.showCenter })}
                >
                  중심
                </ChipToggle>
              ) : null}
              {smooth ? (
                <ChipToggle
                  on={marks.showRadius}
                  onClick={() =>
                    setState((prev) =>
                      patchSideMarks(prev, markSide, {
                        showRadius: !sideMarks(prev, markSide).showRadius,
                      }),
                    )
                  }
                >
                  반지름
                </ChipToggle>
              ) : null}
              {familyHasSlant(source.family) ? (
                <ChipToggle
                  on={marks.showSlant}
                  onClick={() =>
                    setState((prev) =>
                      patchSideMarks(prev, markSide, {
                        showSlant: !sideMarks(prev, markSide).showSlant,
                      }),
                    )
                  }
                >
                  모선
                </ChipToggle>
              ) : null}
              {familyHasFaceHeight(source.family) ? (
                <ChipToggle
                  on={marks.showFaceHeight}
                  onClick={() =>
                    setState((prev) =>
                      patchSideMarks(prev, markSide, {
                        showFaceHeight: !sideMarks(prev, markSide).showFaceHeight,
                      }),
                    )
                  }
                >
                  옆면 높이
                </ChipToggle>
              ) : null}
              {!smooth ? (
                <ChipToggle
                  on={marks.showBaseEdge}
                  onClick={() =>
                    setState((prev) =>
                      patchSideMarks(prev, markSide, {
                        showBaseEdge: !sideMarks(prev, markSide).showBaseEdge,
                      }),
                    )
                  }
                >
                  밑면 한 변
                </ChipToggle>
              ) : null}
            </div>
            {!smooth && vertexLabels.length > 0 ? (
              <div className="mt-2">
                <p className="mb-1 text-[11px] leading-snug text-foreground/45">
                  꼭짓점 버튼을 누르면 점 이름 → 점 → 안보임. 오른쪽은 다음
                  글자부터 이어집니다.
                </p>
                <div className="flex flex-wrap gap-1">
                  {vertexLabels.map((name, i) => {
                    const mode = vertexMode(source, i);
                    return (
                      <button
                        key={`${name}-${i}`}
                        type="button"
                        onClick={() =>
                          setState((prev) =>
                            patchSource(prev, (cur) => cycleVertexMode(cur, i)),
                          )
                        }
                        className={`min-w-[1.5rem] rounded-full px-1.5 py-0.5 text-[11px] font-semibold italic transition ${
                          mode === "names"
                            ? "bg-wood text-cream"
                            : mode === "dots"
                              ? "bg-gold text-[#6b4a00]"
                              : "bg-black/8 text-foreground/35 line-through"
                        }`}
                        aria-pressed={mode !== "hidden"}
                        title={vertexModeTitle(mode)}
                      >
                        {name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
            <p className="mt-2 text-[11px] leading-snug text-foreground/45">
              모서리를 누르면 그 쪽만 길이 설명선이 붙어요. 칩은 위에서 고른
              쪽에만 적용됩니다.
            </p>
            {state.showFigureLabels ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <TextField
                  label="왼쪽 이름"
                  value={state.leftFigureLabel}
                  onChange={(leftFigureLabel) => set({ leftFigureLabel })}
                />
                <TextField
                  label="오른쪽 이름"
                  value={state.rightFigureLabel}
                  onChange={(rightFigureLabel) => set({ rightFigureLabel })}
                />
              </div>
            ) : null}
            {marks.showHeight ? (
              <div className="mt-3">
                <LabelModeRow
                  title="높이"
                  mode={marks.heightLabel.mode}
                  custom={marks.heightLabel.custom}
                  unknownLetter={source.unknownLetter}
                  onMode={(mode) =>
                    setState((prev) =>
                      patchSideMarks(prev, markSide, {
                        heightLabel: {
                          ...sideMarks(prev, markSide).heightLabel,
                          mode,
                        },
                      }),
                    )
                  }
                  onCustom={(custom) =>
                    setState((prev) =>
                      patchSideMarks(prev, markSide, {
                        heightLabel: {
                          ...sideMarks(prev, markSide).heightLabel,
                          custom,
                        },
                      }),
                    )
                  }
                />
              </div>
            ) : null}
            {marks.showRadius ? (
              <div className="mt-3">
                <LabelModeRow
                  title="반지름"
                  mode={marks.radiusLabel.mode}
                  custom={marks.radiusLabel.custom}
                  unknownLetter={source.unknownLetter}
                  onMode={(mode) =>
                    setState((prev) =>
                      patchSideMarks(prev, markSide, {
                        radiusLabel: {
                          ...sideMarks(prev, markSide).radiusLabel,
                          mode,
                        },
                      }),
                    )
                  }
                  onCustom={(custom) =>
                    setState((prev) =>
                      patchSideMarks(prev, markSide, {
                        radiusLabel: {
                          ...sideMarks(prev, markSide).radiusLabel,
                          custom,
                        },
                      }),
                    )
                  }
                />
              </div>
            ) : null}
            {marks.showSlant ? (
              <div className="mt-3">
                <LabelModeRow
                  title="모선"
                  mode={marks.slantLabel.mode}
                  custom={marks.slantLabel.custom}
                  unknownLetter={source.unknownLetter}
                  onMode={(mode) =>
                    setState((prev) =>
                      patchSideMarks(prev, markSide, {
                        slantLabel: {
                          ...sideMarks(prev, markSide).slantLabel,
                          mode,
                        },
                      }),
                    )
                  }
                  onCustom={(custom) =>
                    setState((prev) =>
                      patchSideMarks(prev, markSide, {
                        slantLabel: {
                          ...sideMarks(prev, markSide).slantLabel,
                          custom,
                        },
                      }),
                    )
                  }
                />
              </div>
            ) : null}
            {marks.showFaceHeight ? (
              <div className="mt-3">
                <LabelModeRow
                  title="옆면 높이"
                  mode={marks.faceHeightLabel.mode}
                  custom={marks.faceHeightLabel.custom}
                  unknownLetter={source.unknownLetter}
                  onMode={(mode) =>
                    setState((prev) =>
                      patchSideMarks(prev, markSide, {
                        faceHeightLabel: {
                          ...sideMarks(prev, markSide).faceHeightLabel,
                          mode,
                        },
                      }),
                    )
                  }
                  onCustom={(custom) =>
                    setState((prev) =>
                      patchSideMarks(prev, markSide, {
                        faceHeightLabel: {
                          ...sideMarks(prev, markSide).faceHeightLabel,
                          custom,
                        },
                      }),
                    )
                  }
                />
              </div>
            ) : null}
            {marks.showBaseEdge ? (
              <div className="mt-3">
                <LabelModeRow
                  title="밑면 한 변"
                  mode={marks.baseEdgeLabel.mode}
                  custom={marks.baseEdgeLabel.custom}
                  unknownLetter={source.unknownLetter}
                  onMode={(mode) =>
                    setState((prev) =>
                      patchSideMarks(prev, markSide, {
                        baseEdgeLabel: {
                          ...sideMarks(prev, markSide).baseEdgeLabel,
                          mode,
                        },
                      }),
                    )
                  }
                  onCustom={(custom) =>
                    setState((prev) =>
                      patchSideMarks(prev, markSide, {
                        baseEdgeLabel: {
                          ...sideMarks(prev, markSide).baseEdgeLabel,
                          custom,
                        },
                      }),
                    )
                  }
                />
              </div>
            ) : null}
            {Object.keys(marks.edgeLabels).length > 0 ? (
              <ul className="mt-3 space-y-1">
                {Object.keys(marks.edgeLabels).map((key) => (
                  <li key={key} className="flex items-center gap-2">
                    <span className="flex-1 rounded-lg bg-black/5 px-2 py-1 text-xs font-semibold text-wood-dark">
                      {edgeName(
                        markSide === "right"
                          ? pairSolidStates(state).right
                          : source,
                        key,
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setState((prev) => {
                          const next = {
                            ...sideMarks(prev, markSide).edgeLabels,
                          };
                          delete next[key];
                          return patchSideMarks(prev, markSide, {
                            edgeLabels: next,
                          });
                        })
                      }
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
            <div className="mt-3 space-y-3">
              <SliderField
                label="좌우"
                value={((source.azimuthDeg % 360) + 360) % 360}
                onChange={(azimuthDeg) => setSource({ azimuthDeg })}
                min={0}
                max={359}
                step={1}
                display={`${Math.round(((source.azimuthDeg % 360) + 360) % 360)}°`}
              />
              <SliderField
                label="위아래"
                value={source.elevationDeg}
                onChange={(elevationDeg) => setSource({ elevationDeg })}
                min={6}
                max={82}
                step={1}
                display={`${Math.round(source.elevationDeg)}°`}
              />
              <button
                type="button"
                onClick={() =>
                  setState((prev) =>
                    patchSource(prev, (cur) => resetView(cur)),
                  )
                }
                className="w-full rounded-xl bg-black/5 px-3 py-2 text-xs font-semibold text-foreground/70 hover:bg-black/10"
              >
                표준 보기
              </button>
            </div>
          </section>

          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <h2 className="font-display text-sm text-wood-dark">닮음비</h2>
            <p className="mt-1 text-[11px] leading-snug text-foreground/45">
              왼쪽 : 오른쪽. 왼쪽 길이는 두고 오른쪽만 맞춥니다.
            </p>
            <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-end gap-1.5">
              <NumberField
                label="왼쪽"
                value={state.ratioLeft}
                onChange={(ratioLeft) => set({ ratioLeft })}
                min={0.1}
                max={40}
              />
              <span className="mb-2.5 text-sm font-semibold text-foreground/40">
                :
              </span>
              <NumberField
                label="오른쪽"
                value={state.ratioRight}
                onChange={(ratioRight) => set({ ratioRight })}
                min={0.1}
                max={40}
              />
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <h2 className="font-display text-sm text-wood-dark">빠른 그림</h2>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {SIMILAR_SOLIDS_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setState(cloneSimilarState(preset.state))}
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
                value={source.style.fontSize}
                onChange={(fontSize) =>
                  setSource({ style: { ...source.style, fontSize } })
                }
                min={12}
                max={64}
                step={1}
              />
              <SliderField
                label="점 이름"
                value={source.style.pointLabelSize}
                onChange={(pointLabelSize) =>
                  setSource({ style: { ...source.style, pointLabelSize } })
                }
                min={14}
                max={72}
                step={1}
              />
              <SliderField
                label="점 크기"
                value={source.style.pointRadius}
                onChange={(pointRadius) =>
                  setSource({ style: { ...source.style, pointRadius } })
                }
                min={2}
                max={10}
                step={0.5}
                display={source.style.pointRadius.toFixed(1)}
              />
              <SliderField
                label="선 굵기"
                value={source.style.lineWidth}
                onChange={(lineWidth) =>
                  setSource({ style: { ...source.style, lineWidth } })
                }
                min={1}
                max={3.5}
                step={0.1}
                display={source.style.lineWidth.toFixed(1)}
              />
              <div>
                <p className="mb-1 text-xs font-semibold text-foreground/60">
                  저장 해상도
                </p>
                <Segmented
                  value={String(source.style.exportScale)}
                  onChange={(v) =>
                    setSource({
                      style: { ...source.style, exportScale: Number(v) },
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

function edgeName(state: SolidSketchState, key: string): string {
  const [a, b] = key.split("-").map(Number);
  const names = defaultVertexNames(Math.max(a ?? 0, b ?? 0, 0) + 1);
  const left = state.vertexNames[a ?? 0]?.trim() || names[a ?? 0] || "?";
  const right = state.vertexNames[b ?? 0]?.trim() || names[b ?? 0] || "?";
  return `${left}${right}`;
}
