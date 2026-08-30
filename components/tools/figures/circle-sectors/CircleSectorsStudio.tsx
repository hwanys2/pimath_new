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
import CircleSectorsCanvas, {
  type CircleSectorsSetter,
} from "@/components/tools/figures/circle-sectors/CircleSectorsCanvas";
import {
  canvasToPngBlob,
  copyPngToClipboard,
  downloadBlob,
} from "@/lib/diagrams/export-image";
import { cycleLabelMode, mapSector, toggleMeasure } from "@/lib/diagrams/circle-sectors/geometry";
import {
  CIRCLE_SECTOR_PRESETS,
  cloneState,
  DEFAULT_CIRCLE_SECTORS_STATE,
  labelUnknownLetter,
  normalizeState,
  type CircleSectorsState,
  type MeasLabel,
  type SectorDraft,
} from "@/lib/diagrams/circle-sectors/model";
import { buildCircleSectorsScene } from "@/lib/diagrams/circle-sectors/scene";
import { renderSceneToCanvas, sceneToSvg } from "@/lib/diagrams/render";
import type { FontFaces } from "@/lib/diagrams/math-label";

const STORAGE_KEY = "pm-diagram-g1-circle-sectors-v1";

const storeListeners = new Set<() => void>();

let cachedRaw: string | null = null;
let cachedState: CircleSectorsState = DEFAULT_CIRCLE_SECTORS_STATE;
let cacheReady = false;

function parseStoredState(raw: string | null): CircleSectorsState {
  if (!raw) return DEFAULT_CIRCLE_SECTORS_STATE;
  try {
    const parsed = JSON.parse(raw) as CircleSectorsState;
    if (parsed && Array.isArray(parsed.sectors) && parsed.radius) {
      return normalizeState(parsed);
    }
  } catch {
    /* keep default */
  }
  return DEFAULT_CIRCLE_SECTORS_STATE;
}

function getServerSnapshot(): CircleSectorsState {
  return DEFAULT_CIRCLE_SECTORS_STATE;
}

function getClientSnapshot(): CircleSectorsState {
  if (!cacheReady) {
    cacheReady = true;
    cachedRaw = window.localStorage.getItem(STORAGE_KEY);
    cachedState = parseStoredState(cachedRaw);
  }
  return cachedState;
}

function writeStoredState(state: CircleSectorsState, persist = true) {
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

function useCircleSectorsState() {
  const state = useSyncExternalStore(
    subscribeStoredState,
    getClientSnapshot,
    getServerSnapshot,
  );
  const setState = useCallback<CircleSectorsSetter>((updater, persist = true) => {
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

export default function CircleSectorsStudio() {
  const [state, setState] = useCircleSectorsState();
  const [status, setStatus] = useState<string | null>(null);
  const [tool, setTool] = useState<"select" | "draw">("select");
  const [selectedId, setSelectedId] = useState<string | null>(
    () => state.sectors[0]?.id ?? null,
  );
  const fonts = useMemo(() => fontsFromNext(), []);
  const selected =
    state.sectors.find((s) => s.id === selectedId) ?? state.sectors[0] ?? null;

  const set = useCallback(
    (patch: Partial<CircleSectorsState>) => {
      setState((prev) => normalizeState({ ...prev, ...patch }));
    },
    [setState],
  );

  const patchSelected = useCallback(
    (patch: Partial<SectorDraft>) => {
      if (!selected) return;
      setState((prev) =>
        normalizeState(mapSector(prev, selected.id, (s) => ({ ...s, ...patch }))),
      );
    },
    [selected, setState],
  );

  const deleteSelected = useCallback(() => {
    const id = selected?.id;
    if (!id) return;
    const remaining = state.sectors.filter((s) => s.id !== id);
    setState((prev) => ({
      ...prev,
      sectors: prev.sectors.filter((s) => s.id !== id),
    }));
    setSelectedId(remaining[0]?.id ?? null);
  }, [selected, state.sectors, setState]);

  async function exportPng() {
    await document.fonts.ready;
    const scene = buildCircleSectorsScene(state);
    const canvas = renderSceneToCanvas(
      scene,
      fonts,
      state.style.lineWidth,
      state.style.exportScale,
    );
    const blob = await canvasToPngBlob(canvas);
    downloadBlob(blob, "원과 부채꼴.png");
    setStatus("PNG를 저장했어요.");
  }

  async function copyPng() {
    await document.fonts.ready;
    const scene = buildCircleSectorsScene(state);
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
    const scene = buildCircleSectorsScene(state);
    const svg = sceneToSvg(scene, fonts, state.style.lineWidth);
    downloadBlob(
      new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
      "원과 부채꼴.svg",
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
        xxyy OO AA cm 가 π
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
            원과 부채꼴
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-foreground/65">
            원 위를 끌어 부채꼴을 그리거나, 원을 끄고 부채꼴만 남기세요.
            중심각·호 길이·넓이를 붙이고 글자를 누르면 바로 고칠 수 있어요.
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
        <div className="mx-auto w-full max-w-[24rem] overflow-hidden rounded-3xl border-2 border-wood/10 bg-white shadow-[0_12px_40px_rgba(61,44,30,0.08)] lg:mx-0 lg:max-w-none">
          <CircleSectorsCanvas
            state={state}
            fonts={fonts}
            tool={tool}
            selectedId={selected?.id ?? null}
            setState={setState}
            persist={persistCachedState}
            onSelect={setSelectedId}
            onToolChange={setTool}
            onDeleteSelected={deleteSelected}
          />
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <ChipToggle on={tool === "select"} onClick={() => setTool("select")}>
              옮기기
            </ChipToggle>
            <ChipToggle on={tool === "draw"} onClick={() => setTool("draw")}>
              부채꼴 그리기
            </ChipToggle>
          </div>

          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-sm text-wood-dark">표시</h2>
              {selected ? (
                <button
                  type="button"
                  onClick={deleteSelected}
                  className="rounded-lg bg-black/5 px-2.5 py-1 text-xs font-semibold text-foreground/70 hover:bg-black/10"
                >
                  삭제
                </button>
              ) : null}
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <ChipToggle
                on={state.showCircle}
                onClick={() => set({ showCircle: !state.showCircle })}
              >
                원 전체
              </ChipToggle>
              <ChipToggle
                on={state.showCenter}
                onClick={() => set({ showCenter: !state.showCenter })}
              >
                중심
              </ChipToggle>
              {selected ? (
                <>
                  <ChipToggle
                    on={selected.showFill}
                    onClick={() =>
                      patchSelected({ showFill: !selected.showFill })
                    }
                  >
                    면 채움
                  </ChipToggle>
                  <ChipToggle
                    on={selected.showCentralAngle}
                    onClick={() => {
                      const next = toggleMeasure(
                        selected.angleLabel,
                        selected.showCentralAngle,
                      );
                      patchSelected({
                        showCentralAngle: next.shown,
                        angleLabel: next.label,
                      });
                    }}
                  >
                    중심각
                    {selected.showCentralAngle
                      ? labelModeHint(selected.angleLabel, state.unknownLetter)
                      : ""}
                  </ChipToggle>
                  {selected.showCentralAngle ? (
                    <ChipToggle
                      on={selected.angleLabel.mode !== "hide"}
                      onClick={() =>
                        patchSelected({
                          angleLabel: cycleLabelMode(selected.angleLabel),
                        })
                      }
                    >
                      각 숫자
                      {labelModeHint(selected.angleLabel, state.unknownLetter)}
                    </ChipToggle>
                  ) : null}
                  <ChipToggle
                    on={selected.showRadius}
                    onClick={() => {
                      const next = toggleMeasure(
                        selected.radiusLabel,
                        selected.showRadius,
                      );
                      patchSelected({
                        showRadius: next.shown,
                        radiusLabel: next.label,
                      });
                    }}
                  >
                    반지름
                    {selected.showRadius
                      ? labelModeHint(selected.radiusLabel, state.unknownLetter)
                      : ""}
                  </ChipToggle>
                  {selected.showRadius ? (
                    <ChipToggle
                      on={selected.radiusOn === "end"}
                      onClick={() =>
                        patchSelected({
                          radiusOn:
                            selected.radiusOn === "end" ? "start" : "end",
                        })
                      }
                    >
                      {selected.radiusOn === "end"
                        ? `${state.centerName || "O"}${selected.endName}`
                        : `${state.centerName || "O"}${selected.startName}`}
                    </ChipToggle>
                  ) : null}
                  <ChipToggle
                    on={selected.showArcLength}
                    onClick={() => {
                      const next = toggleMeasure(
                        selected.arcLabel,
                        selected.showArcLength,
                      );
                      patchSelected({
                        showArcLength: next.shown,
                        arcLabel: next.label,
                      });
                    }}
                  >
                    호 길이
                    {selected.showArcLength
                      ? labelModeHint(selected.arcLabel, state.unknownLetter)
                      : ""}
                  </ChipToggle>
                  <ChipToggle
                    on={selected.showArea}
                    onClick={() => {
                      const next = toggleMeasure(
                        selected.areaLabel,
                        selected.showArea,
                      );
                      patchSelected({
                        showArea: next.shown,
                        areaLabel: next.label,
                      });
                    }}
                  >
                    넓이
                    {selected.showArea
                      ? labelModeHint(selected.areaLabel, state.unknownLetter)
                      : ""}
                  </ChipToggle>
                  <ChipToggle
                    on={selected.showPointNames}
                    onClick={() =>
                      patchSelected({
                        showPointNames: !selected.showPointNames,
                      })
                    }
                  >
                    점 이름
                  </ChipToggle>
                </>
              ) : (
                <p className="text-xs text-foreground/50">
                  원 둘레를 끌어 부채꼴을 그리세요.
                </p>
              )}
            </div>
            {state.sectors.length > 0 ? (
              <ul className="mt-3 space-y-1">
                {state.sectors.map((sector) => (
                  <li key={sector.id} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedId(sector.id)}
                      className={`flex-1 rounded-lg px-2 py-1 text-left text-xs font-semibold ${
                        sector.id === selected?.id
                          ? "bg-wood/15 text-wood-dark"
                          : "text-foreground/55 hover:bg-black/5"
                      }`}
                    >
                      {sector.startName}
                      {sector.endName}
                      <span className="ml-1 font-normal text-foreground/40">
                        {Math.round(sector.centralAngleDeg)}°
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const remaining = state.sectors.filter(
                          (s) => s.id !== sector.id,
                        );
                        setState((prev) => ({
                          ...prev,
                          sectors: prev.sectors.filter((s) => s.id !== sector.id),
                        }));
                        if (selectedId === sector.id) {
                          setSelectedId(remaining[0]?.id ?? null);
                        }
                      }}
                      className="text-xs font-semibold text-foreground/40 hover:text-foreground"
                    >
                      지우기
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="mt-2 text-[11px] leading-snug text-foreground/45">
              끝점을 끌면 중심각이 바뀌고, 부채꼴을 끌면 통째로 돌아가요. 호 길이
              숫자는 글자만, 바깥 호는 설명선만 옮겨요. 글자를 누르면
              숫자·x·π로 고칠 수 있어요.
            </p>
          </section>

          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <h2 className="font-display text-sm text-wood-dark">치수</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <NumberField
                label="반지름"
                value={state.radius}
                onChange={(radius) => set({ radius })}
                min={0.5}
                max={40}
                suffix={state.unit || "cm"}
              />
              {selected ? (
                <NumberField
                  label="중심각"
                  value={Number(selected.centralAngleDeg.toFixed(1))}
                  onChange={(centralAngleDeg) =>
                    patchSelected({ centralAngleDeg })
                  }
                  min={1}
                  max={359}
                  step={1}
                  suffix="°"
                />
              ) : null}
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

          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <h2 className="font-display text-sm text-wood-dark">보기</h2>
            <div className="mt-3 space-y-3">
              <SliderField
                label="회전"
                value={((state.viewRotationDeg % 360) + 360) % 360}
                onChange={(viewRotationDeg) => set({ viewRotationDeg })}
                min={0}
                max={359}
                step={1}
                display={`${Math.round(((state.viewRotationDeg % 360) + 360) % 360)}°`}
              />
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <h2 className="font-display text-sm text-wood-dark">빠른 그림</h2>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {CIRCLE_SECTOR_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    const next = cloneState(preset.state);
                    setState(next);
                    setSelectedId(next.sectors[0]?.id ?? null);
                    setTool("select");
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
              <SliderField
                label="설명선 기본 간격"
                value={state.style.dimOffset}
                onChange={(dimOffset) =>
                  set({ style: { ...state.style, dimOffset } })
                }
                min={10}
                max={80}
                step={1}
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

function labelModeHint(label: MeasLabel, unknown: string): string {
  if (label.mode === "x") return ` ${labelUnknownLetter(label, unknown)}`;
  if (label.mode === "hide") return " 숨김";
  if (label.mode === "custom") return " 직접";
  return "";
}
