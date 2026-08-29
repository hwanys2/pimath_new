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
import SolidSketchCanvas, {
  type SolidSketchSetter,
} from "@/components/tools/figures/solid-sketch/SolidSketchCanvas";
import {
  canvasToPngBlob,
  copyPngToClipboard,
  downloadBlob,
} from "@/lib/diagrams/export-image";
import {
  FAMILY_OPTIONS,
  PLATONIC_OPTIONS,
  SOLID_SKETCH_PRESETS,
  cloneState,
  DEFAULT_SOLID_SKETCH_STATE,
  defaultVertexNames,
  familyIsRound,
  familyNeedsSides,
  normalizeState,
  resetView,
  withFamily,
  type SolidSketchState,
} from "@/lib/diagrams/solid-sketch/model";
import { buildSolidSketchScene } from "@/lib/diagrams/solid-sketch/scene";
import { renderSceneToCanvas, sceneToSvg } from "@/lib/diagrams/render";
import type { FontFaces } from "@/lib/diagrams/math-label";

const STORAGE_KEY = "pm-diagram-g1-solid-sketch-v1";

const storeListeners = new Set<() => void>();

let cachedRaw: string | null = null;
let cachedState: SolidSketchState = DEFAULT_SOLID_SKETCH_STATE;
let cacheReady = false;

function parseStoredState(raw: string | null): SolidSketchState {
  if (!raw) return DEFAULT_SOLID_SKETCH_STATE;
  try {
    const parsed = JSON.parse(raw) as SolidSketchState;
    if (parsed && typeof parsed.family === "string" && parsed.style) {
      return normalizeState(parsed);
    }
  } catch {
    /* keep default */
  }
  return DEFAULT_SOLID_SKETCH_STATE;
}

function getServerSnapshot(): SolidSketchState {
  return DEFAULT_SOLID_SKETCH_STATE;
}

function getClientSnapshot(): SolidSketchState {
  if (!cacheReady) {
    cacheReady = true;
    cachedRaw = window.localStorage.getItem(STORAGE_KEY);
    cachedState = parseStoredState(cachedRaw);
  }
  return cachedState;
}

function writeStoredState(state: SolidSketchState, persist = true) {
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

function useSolidSketchState() {
  const state = useSyncExternalStore(
    subscribeStoredState,
    getClientSnapshot,
    getServerSnapshot,
  );
  const setState = useCallback<SolidSketchSetter>((updater, persist = true) => {
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

export default function SolidSketchStudio() {
  const [state, setState] = useSolidSketchState();
  const [status, setStatus] = useState<string | null>(null);
  const fonts = useMemo(() => fontsFromNext(), []);

  const set = useCallback(
    (patch: Partial<SolidSketchState>) => {
      setState((prev) => normalizeState({ ...prev, ...patch }));
    },
    [setState],
  );

  async function exportPng() {
    await document.fonts.ready;
    const scene = buildSolidSketchScene(state);
    const canvas = renderSceneToCanvas(
      scene,
      fonts,
      state.style.lineWidth,
      state.style.exportScale,
    );
    const blob = await canvasToPngBlob(canvas);
    downloadBlob(blob, "겨냥도.png");
    setStatus("PNG를 저장했어요.");
  }

  async function copyPng() {
    await document.fonts.ready;
    const scene = buildSolidSketchScene(state);
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
    const scene = buildSolidSketchScene(state);
    const svg = sceneToSvg(scene, fonts, state.style.lineWidth);
    downloadBlob(
      new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
      "겨냥도.svg",
    );
    setStatus("SVG를 저장했어요.");
  }

  const round = familyIsRound(state.family);
  const needsSides = familyNeedsSides(state.family);
  const prismRect = state.family === "prism" && state.sides === 4;

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
            <Link href="/tools/figures?grade=1" className="hover:underline">
              문제 그림 그리기
            </Link>
            <span className="mx-1.5 text-foreground/30">/</span>
            중1
          </p>
          <h1 className="font-display mt-1 text-3xl text-wood-dark sm:text-4xl">
            겨냥도
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-foreground/65">
            기둥·뿔·뿔대·원기둥·원뿔·정다면체를 겨냥도로 그립니다. 빈 곳을
            끌어 돌리고, 모서리를 눌러 길이를 붙이세요. 글자를 누르면 바로
            고칠 수 있어요.
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
          <SolidSketchCanvas
            state={state}
            fonts={fonts}
            setState={setState}
            persist={persistCachedState}
          />
        </div>

        <div className="space-y-4">
          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <h2 className="font-display text-sm text-wood-dark">표시</h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <ChipToggle
                on={state.showFill}
                onClick={() => set({ showFill: !state.showFill })}
              >
                면 채움
              </ChipToggle>
              <ChipToggle
                on={state.showHidden}
                onClick={() => set({ showHidden: !state.showHidden })}
              >
                숨은 선
              </ChipToggle>
              <ChipToggle
                on={state.showVertexNames}
                onClick={() => set({ showVertexNames: !state.showVertexNames })}
              >
                꼭짓점 이름
              </ChipToggle>
              <ChipToggle
                on={state.showHeight}
                onClick={() => set({ showHeight: !state.showHeight })}
              >
                높이
              </ChipToggle>
              {state.showHeight ? (
                <ChipToggle
                  on={state.showHeightRightAngle}
                  onClick={() =>
                    set({ showHeightRightAngle: !state.showHeightRightAngle })
                  }
                >
                  직각
                </ChipToggle>
              ) : null}
              {round ? (
                <ChipToggle
                  on={state.showCenter}
                  onClick={() => set({ showCenter: !state.showCenter })}
                >
                  중심
                </ChipToggle>
              ) : null}
              {round ? (
                <ChipToggle
                  on={state.showRadius}
                  onClick={() => set({ showRadius: !state.showRadius })}
                >
                  반지름
                </ChipToggle>
              ) : null}
              {state.family === "cone" || state.family === "pyramid" ? (
                <ChipToggle
                  on={state.showSlant}
                  onClick={() => set({ showSlant: !state.showSlant })}
                >
                  모선
                </ChipToggle>
              ) : null}
              {!round ? (
                <ChipToggle
                  on={state.showBaseEdge}
                  onClick={() => set({ showBaseEdge: !state.showBaseEdge })}
                >
                  밑면 한 변
                </ChipToggle>
              ) : null}
            </div>
            <p className="mt-2 text-[11px] leading-snug text-foreground/45">
              모서리를 누르면 길이 설명선이 붙어요. 글자를 끌어 옮기고, 점선만
              잡으면 선만 옮겨요.
            </p>
            {state.showHeight ? (
              <div className="mt-3">
                <LabelModeRow
                  title="높이"
                  mode={state.heightLabel.mode}
                  custom={state.heightLabel.custom}
                  unknownLetter={state.unknownLetter}
                  onMode={(mode) =>
                    set({ heightLabel: { ...state.heightLabel, mode } })
                  }
                  onCustom={(custom) =>
                    set({ heightLabel: { ...state.heightLabel, custom } })
                  }
                />
              </div>
            ) : null}
            {state.showRadius ? (
              <div className="mt-3">
                <LabelModeRow
                  title="반지름"
                  mode={state.radiusLabel.mode}
                  custom={state.radiusLabel.custom}
                  unknownLetter={state.unknownLetter}
                  onMode={(mode) =>
                    set({ radiusLabel: { ...state.radiusLabel, mode } })
                  }
                  onCustom={(custom) =>
                    set({ radiusLabel: { ...state.radiusLabel, custom } })
                  }
                />
              </div>
            ) : null}
            {state.showSlant ? (
              <div className="mt-3">
                <LabelModeRow
                  title="모선"
                  mode={state.slantLabel.mode}
                  custom={state.slantLabel.custom}
                  unknownLetter={state.unknownLetter}
                  onMode={(mode) =>
                    set({ slantLabel: { ...state.slantLabel, mode } })
                  }
                  onCustom={(custom) =>
                    set({ slantLabel: { ...state.slantLabel, custom } })
                  }
                />
              </div>
            ) : null}
            {state.showBaseEdge ? (
              <div className="mt-3">
                <LabelModeRow
                  title="밑면 한 변"
                  mode={state.baseEdgeLabel.mode}
                  custom={state.baseEdgeLabel.custom}
                  unknownLetter={state.unknownLetter}
                  onMode={(mode) =>
                    set({ baseEdgeLabel: { ...state.baseEdgeLabel, mode } })
                  }
                  onCustom={(custom) =>
                    set({ baseEdgeLabel: { ...state.baseEdgeLabel, custom } })
                  }
                />
              </div>
            ) : null}
            {Object.keys(state.edgeLabels).length > 0 ? (
              <ul className="mt-3 space-y-1">
                {Object.keys(state.edgeLabels).map((key) => (
                  <li key={key} className="flex items-center gap-2">
                    <span className="flex-1 rounded-lg bg-black/5 px-2 py-1 text-xs font-semibold text-wood-dark">
                      {edgeName(state, key)}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const next = { ...state.edgeLabels };
                        delete next[key];
                        set({ edgeLabels: next });
                      }}
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
                value={((state.azimuthDeg % 360) + 360) % 360}
                onChange={(azimuthDeg) => set({ azimuthDeg })}
                min={0}
                max={359}
                step={1}
                display={`${Math.round(((state.azimuthDeg % 360) + 360) % 360)}°`}
              />
              <SliderField
                label="위아래"
                value={state.elevationDeg}
                onChange={(elevationDeg) => set({ elevationDeg })}
                min={6}
                max={82}
                step={1}
                display={`${Math.round(state.elevationDeg)}°`}
              />
              <button
                type="button"
                onClick={() => setState((prev) => resetView(prev))}
                className="w-full rounded-xl bg-black/5 px-3 py-2 text-xs font-semibold text-foreground/70 hover:bg-black/10"
              >
                표준 보기
              </button>
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <h2 className="font-display text-sm text-wood-dark">빠른 그림</h2>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {SOLID_SKETCH_PRESETS.map((preset) => (
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

          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <h2 className="font-display text-sm text-wood-dark">도형</h2>
            <div className="mt-2 flex flex-wrap gap-1">
              {FAMILY_OPTIONS.map((opt) => (
                <ChipToggle
                  key={opt.id}
                  on={state.family === opt.id}
                  onClick={() => setState((prev) => withFamily(prev, opt.id))}
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
                  value={String(state.sides)}
                  onChange={(v) => set({ sides: Number(v) })}
                  options={[3, 4, 5, 6, 7, 8].map((n) => ({
                    id: String(n),
                    label: String(n),
                  }))}
                />
              </div>
            ) : null}
            {state.family === "platonic" ? (
              <div className="mt-3 flex flex-wrap gap-1">
                {PLATONIC_OPTIONS.map((opt) => (
                  <ChipToggle
                    key={opt.id}
                    on={state.platonic === opt.id}
                    onClick={() => set({ platonic: opt.id })}
                  >
                    {opt.label}
                  </ChipToggle>
                ))}
              </div>
            ) : null}
            {state.family === "cylinder" ? (
              <div className="mt-3">
                <Segmented
                  value={state.cylinderLie}
                  onChange={(cylinderLie) => set({ cylinderLie })}
                  options={[
                    { id: "vertical", label: "세움" },
                    { id: "horizontal", label: "눕힘" },
                  ]}
                />
              </div>
            ) : null}
            <div className="mt-3 grid grid-cols-2 gap-2">
              {prismRect ? (
                <>
                  <NumberField
                    label="가로"
                    value={state.width}
                    onChange={(width) => set({ width })}
                    min={0.5}
                    max={40}
                    suffix="cm"
                  />
                  <NumberField
                    label="세로"
                    value={state.depth}
                    onChange={(depth) => set({ depth })}
                    min={0.5}
                    max={40}
                    suffix="cm"
                  />
                </>
              ) : null}
              {needsSides && !prismRect ? (
                <NumberField
                  label="밑면 한 변"
                  value={state.baseSize}
                  onChange={(baseSize) => set({ baseSize })}
                  min={0.5}
                  max={40}
                  suffix="cm"
                />
              ) : null}
              {state.family === "frustum" ? (
                <NumberField
                  label="윗면 한 변"
                  value={state.topSize}
                  onChange={(topSize) => set({ topSize })}
                  min={0.4}
                  max={40}
                  suffix="cm"
                />
              ) : null}
              {round ? (
                <NumberField
                  label="밑면 반지름"
                  value={state.radius}
                  onChange={(radius) => set({ radius })}
                  min={0.4}
                  max={40}
                  suffix="cm"
                />
              ) : null}
              {state.family === "coneFrustum" ? (
                <NumberField
                  label="윗면 반지름"
                  value={state.topRadius}
                  onChange={(topRadius) => set({ topRadius })}
                  min={0.3}
                  max={40}
                  suffix="cm"
                />
              ) : null}
              {state.family === "platonic" ? (
                <NumberField
                  label="한 모서리"
                  value={state.edgeLength}
                  onChange={(edgeLength) => set({ edgeLength })}
                  min={0.5}
                  max={40}
                  suffix="cm"
                />
              ) : (
                <NumberField
                  label="높이"
                  value={state.height}
                  onChange={(height) => set({ height })}
                  min={0.5}
                  max={40}
                  suffix="cm"
                />
              )}
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

          <details className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
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
                max={36}
                step={1}
              />
              <SliderField
                label="점 이름"
                value={state.style.pointLabelSize}
                onChange={(pointLabelSize) =>
                  set({ style: { ...state.style, pointLabelSize } })
                }
                min={14}
                max={48}
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

function edgeName(state: SolidSketchState, key: string): string {
  const [a, b] = key.split("-").map(Number);
  const names = defaultVertexNames(Math.max(a ?? 0, b ?? 0, 0) + 1);
  const left = state.vertexNames[a ?? 0]?.trim() || names[a ?? 0] || "?";
  const right = state.vertexNames[b ?? 0]?.trim() || names[b ?? 0] || "?";
  return `${left}${right}`;
}
