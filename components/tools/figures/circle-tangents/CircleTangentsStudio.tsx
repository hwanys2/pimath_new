"use client";

import { Noto_Serif, Noto_Serif_KR } from "next/font/google";
import Link from "next/link";
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import {
  ChipToggle,
  LabelModeRow,
  NumberField,
  SliderField,
} from "@/components/tools/figures/controls";
import CircleTangentsCanvas, {
  type TangentsSetter,
} from "@/components/tools/figures/circle-tangents/CircleTangentsCanvas";
import {
  canvasToPngBlob,
  copyPngToClipboard,
  cropCanvasToInk,
  downloadBlob,
  EXPORT_INK_PAD,
} from "@/lib/diagrams/export-image";
import {
  applyEditedLabel,
  autoAngleValue,
  autoLengthValue,
  findAngle,
  findLength,
  namedPointOf,
  patchAngle,
  patchLength,
  setAllPointModes,
  setNamedPoint,
  type TangentsSelection,
} from "@/lib/diagrams/circle-tangents/geometry";
import {
  DEFAULT_TANGENTS_STATE,
  POINT_DISPLAY_MODES,
  TANGENT_KINDS,
  TANGENT_PRESETS,
  cloneState,
  cyclePointMode,
  emptyLabel,
  normalizeState,
  withKind,
  type AngleFill,
  type CircleTangentsState,
  type TangentKind,
} from "@/lib/diagrams/circle-tangents/model";
import { buildTangentsScene } from "@/lib/diagrams/circle-tangents/scene";
import { renderSceneToCanvas, sceneToSvg } from "@/lib/diagrams/render";
import type { FontFaces } from "@/lib/diagrams/math-label";

const STORAGE_KEY = "pm-diagram-g3-circle-tangents-v1";

const storeListeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cachedState: CircleTangentsState = DEFAULT_TANGENTS_STATE;
let cacheReady = false;

function parseStoredState(raw: string | null): CircleTangentsState {
  if (!raw) return DEFAULT_TANGENTS_STATE;
  try {
    const parsed = JSON.parse(raw) as CircleTangentsState;
    if (parsed && parsed.kind && parsed.style) {
      return normalizeState(parsed);
    }
  } catch {
    /* keep default */
  }
  return DEFAULT_TANGENTS_STATE;
}

function getServerSnapshot(): CircleTangentsState {
  return DEFAULT_TANGENTS_STATE;
}

function getClientSnapshot(): CircleTangentsState {
  if (!cacheReady) {
    cacheReady = true;
    cachedRaw = window.localStorage.getItem(STORAGE_KEY);
    cachedState = parseStoredState(cachedRaw);
  }
  return cachedState;
}

function writeStoredState(state: CircleTangentsState, persist = true) {
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

function useTangentsState() {
  const state = useSyncExternalStore(
    subscribeStoredState,
    getClientSnapshot,
    getServerSnapshot,
  );
  const setState = useCallback<TangentsSetter>((updater, persist = true) => {
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

const FILL_CHIPS: { id: AngleFill; label: string }[] = [
  { id: "none", label: "없음" },
  { id: "pink", label: "분홍" },
  { id: "blue", label: "파랑" },
  { id: "green", label: "초록" },
  { id: "gray", label: "회색" },
];

export default function CircleTangentsStudio() {
  const [state, setState] = useTangentsState();
  const [selected, setSelected] = useState<TangentsSelection | null>(null);
  const [status, setStatus] = useState("");
  const fonts = useMemo(() => fontsFromNext(), []);

  function set(patch: Partial<CircleTangentsState>) {
    setState((prev) => normalizeState({ ...prev, ...patch }));
  }

  function setTwo(patch: Partial<CircleTangentsState["two"]>) {
    setState((prev) =>
      normalizeState({ ...prev, two: { ...prev.two, ...patch } }),
    );
  }

  async function exportPng() {
    await document.fonts.ready;
    const scene = buildTangentsScene(state);
    const canvas = renderSceneToCanvas(
      scene,
      fonts,
      state.style.lineWidth,
      state.style.exportScale,
    );
    const cropped = cropCanvasToInk(canvas, EXPORT_INK_PAD * state.style.exportScale);
    const blob = await canvasToPngBlob(cropped);
    downloadBlob(blob, "원과접선.png");
    setStatus("PNG를 저장했어요.");
  }

  async function copyPng() {
    await document.fonts.ready;
    const scene = buildTangentsScene(state);
    const canvas = renderSceneToCanvas(
      scene,
      fonts,
      state.style.lineWidth,
      state.style.exportScale,
    );
    const cropped = cropCanvasToInk(canvas, EXPORT_INK_PAD * state.style.exportScale);
    const blob = await canvasToPngBlob(cropped);
    await copyPngToClipboard(blob);
    setStatus("클립보드에 그림을 복사했어요. 한글·워드에 붙여넣기 하세요.");
  }

  function exportSvg() {
    const scene = buildTangentsScene(state);
    const svg = sceneToSvg(scene, fonts, state.style.lineWidth);
    downloadBlob(
      new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
      "원과접선.svg",
    );
    setStatus("SVG를 저장했어요.");
  }

  const presetsForKind = TANGENT_PRESETS.filter((p) => p.state.kind === state.kind);
  const selPoint =
    selected?.t === "point" ? namedPointOf(state, selected.id) : null;
  const selLength =
    selected?.t === "length" ? findLength(state, selected.id) : null;
  const selAngle =
    selected?.t === "angle" ? findAngle(state, selected.id) : null;

  const lengthList = lengthIdsForKind(state);

  return (
    <div className={`${notoSerif.variable} ${notoSerifKr.variable} space-y-4`}>
      <span
        className={`${notoSerif.className} ${notoSerifKr.className} sr-only italic`}
        style={{ fontFamily: '"Times New Roman", serif' }}
        aria-hidden
      >
        xxyy OO AA cm 70°
      </span>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-wood">
            <Link href="/tools/figures?grade=3" className="hover:underline">
              문제 그림 그리기
            </Link>
            <span className="mx-1.5 text-foreground/30">/</span>
            중3
          </p>
          <h1 className="font-display mt-1 text-3xl text-wood-dark sm:text-4xl">
            원과 접선
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-foreground/65">
            한 점에서 두 접선·내접원·접선사각형·세 접선 삼각형을 맞추고 PNG로 저장해요.
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
            <CircleTangentsCanvas
              state={state}
              fonts={fonts}
              selected={selected}
              setState={setState}
              persist={persistCachedState}
              onSelect={setSelected}
            />
          </div>

          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <h2 className="font-display text-sm text-wood-dark">그림 종류</h2>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {TANGENT_KINDS.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => {
                    if (state.kind === k.id) return;
                    setState((prev) => withKind(prev, k.id as TangentKind));
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
            {state.kind === "two-tangents" ? (
              <p className="mt-2 text-[11px] leading-snug text-foreground/55">
                점 P를 끌어 거리·방향을 바꿉니다. 빈 곳을 끌면 통째로 회전합니다.
              </p>
            ) : state.kind === "tangential-quad" ? (
              <p className="mt-2 text-[11px] leading-snug text-foreground/55">
                접점 P·Q·R·S를 원 둘레에서 끌어 모양을 바꿉니다.
              </p>
            ) : (
              <p className="mt-2 text-[11px] leading-snug text-foreground/55">
                꼭짓점 A·B·C를 끌어 삼각형을 맞춥니다. 접점과 중심은 따라옵니다.
              </p>
            )}
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <h2 className="font-display text-sm text-wood-dark">표시</h2>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <ChipToggle
                on={state.showCenter}
                onClick={() => set({ showCenter: !state.showCenter })}
              >
                중심
              </ChipToggle>
              {state.kind === "two-tangents" ? (
                <>
                  <ChipToggle
                    on={state.two.showOA}
                    onClick={() => setTwo({ showOA: !state.two.showOA })}
                  >
                    OA
                  </ChipToggle>
                  <ChipToggle
                    on={state.two.showOB}
                    onClick={() => setTwo({ showOB: !state.two.showOB })}
                  >
                    OB
                  </ChipToggle>
                  <ChipToggle
                    on={state.two.showOP}
                    onClick={() => setTwo({ showOP: !state.two.showOP })}
                  >
                    OP
                  </ChipToggle>
                  <ChipToggle
                    on={state.two.showRightAngles}
                    onClick={() =>
                      setTwo({ showRightAngles: !state.two.showRightAngles })
                    }
                  >
                    직각
                  </ChipToggle>
                  <ChipToggle
                    on={state.two.equalRadiusTicks > 0}
                    onClick={() =>
                      setTwo({
                        equalRadiusTicks: state.two.equalRadiusTicks ? 0 : 1,
                      })
                    }
                  >
                    반지름 등호
                  </ChipToggle>
                  <ChipToggle
                    on={state.two.equalTangentTicks > 0}
                    onClick={() =>
                      setTwo({
                        equalTangentTicks: state.two.equalTangentTicks ? 0 : 1,
                      })
                    }
                  >
                    접선 등호
                  </ChipToggle>
                  <ChipToggle
                    on={state.two.showChordAB}
                    onClick={() =>
                      setTwo({ showChordAB: !state.two.showChordAB })
                    }
                  >
                    접현 AB
                  </ChipToggle>
                  <ChipToggle
                    on={state.two.showAngleP}
                    onClick={() =>
                      setTwo({ showAngleP: !state.two.showAngleP })
                    }
                  >
                    ∠P
                  </ChipToggle>
                  <ChipToggle
                    on={state.two.showAngleA}
                    onClick={() =>
                      setTwo({ showAngleA: !state.two.showAngleA })
                    }
                  >
                    ∠A
                  </ChipToggle>
                </>
              ) : null}
              {state.kind === "incircle-triangle" ? (
                <ChipToggle
                  on={state.tri.showTouchPoints}
                  onClick={() =>
                    setState((prev) =>
                      normalizeState({
                        ...prev,
                        tri: {
                          ...prev.tri,
                          showTouchPoints: !prev.tri.showTouchPoints,
                        },
                      }),
                    )
                  }
                >
                  접점
                </ChipToggle>
              ) : null}
              {state.kind === "tangential-quad" ? (
                <ChipToggle
                  on={state.quad.showTouchPoints}
                  onClick={() =>
                    setState((prev) =>
                      normalizeState({
                        ...prev,
                        quad: {
                          ...prev.quad,
                          showTouchPoints: !prev.quad.showTouchPoints,
                        },
                      }),
                    )
                  }
                >
                  접점
                </ChipToggle>
              ) : null}
              {state.kind === "three-tangents" ? (
                <ChipToggle
                  on={state.three.showTouchPoints}
                  onClick={() =>
                    setState((prev) =>
                      normalizeState({
                        ...prev,
                        three: {
                          ...prev.three,
                          showTouchPoints: !prev.three.showTouchPoints,
                        },
                      }),
                    )
                  }
                >
                  접점
                </ChipToggle>
              ) : null}
            </div>

            <div className="mt-3">
              <p className="mb-1.5 text-[11px] font-semibold text-foreground/55">점</p>
              <div className="flex flex-wrap gap-1.5">
                {POINT_DISPLAY_MODES.map((m) => (
                  <ChipToggle
                    key={m.id}
                    on={false}
                    onClick={() =>
                      setState((prev) => setAllPointModes(prev, m.id))
                    }
                  >
                    {m.label}
                  </ChipToggle>
                ))}
              </div>
            </div>

            {selPoint && selected?.t === "point" ? (
              <div className="mt-3 rounded-xl bg-black/[0.03] p-2.5">
                <p className="text-[11px] font-semibold text-foreground/55">
                  점 {selected.id}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {POINT_DISPLAY_MODES.map((m) => (
                    <ChipToggle
                      key={m.id}
                      on={selPoint.mode === m.id}
                      onClick={() =>
                        setState((prev) =>
                          setNamedPoint(prev, selected.id, { mode: m.id }),
                        )
                      }
                    >
                      {m.label}
                    </ChipToggle>
                  ))}
                  <ChipToggle
                    on={false}
                    onClick={() =>
                      setState((prev) => {
                        const cur = namedPointOf(prev, selected.id);
                        if (!cur) return prev;
                        return setNamedPoint(prev, selected.id, {
                          mode: cyclePointMode(cur.mode),
                        });
                      })
                    }
                  >
                    순환
                  </ChipToggle>
                </div>
              </div>
            ) : null}

            {selLength && selected?.t === "length" ? (
              <div className="mt-3 rounded-xl bg-black/[0.03] p-2.5">
                <p className="mb-1.5 text-[11px] font-semibold text-foreground/55">
                  길이 {selected.id}
                </p>
                {autoLengthValue(state, selected.id) != null ? (
                  <div className="mb-2">
                    <NumberField
                      label={`${selected.id} 길이 값`}
                      value={Number(autoLengthValue(state, selected.id)!.toFixed(1))}
                      onChange={(n) =>
                        setState((prev) =>
                          applyEditedLabel(
                            prev,
                            selected.id,
                            prev.unit ? `${n} ${prev.unit}` : String(n),
                          ),
                        )
                      }
                      min={0.5}
                      max={40}
                      step={0.1}
                      suffix={state.unit}
                    />
                  </div>
                ) : null}
                <LabelModeRow
                  title="길이"
                  mode={selLength.label.mode}
                  custom={selLength.label.custom}
                  unknownLetter={state.unknownLetter}
                  onMode={(mode) =>
                    setState((prev) => {
                      const lenMark = findLength(prev, selected.id);
                      if (!lenMark) return prev;
                      let custom = lenMark.label.custom;
                      if (mode === "custom" && !custom.trim()) {
                        const auto = autoLengthValue(prev, selected.id);
                        custom =
                          auto != null
                            ? `${Number(auto.toFixed(1))}${prev.unit}`
                            : "";
                      }
                      return patchLength(prev, selected.id, {
                        show: mode !== "hide",
                        label: { ...lenMark.label, mode, custom },
                      });
                    })
                  }
                  onCustom={(custom) =>
                    setState((prev) =>
                      applyEditedLabel(prev, selected.id, custom),
                    )
                  }
                />
                <button
                  type="button"
                  className="mt-2 text-xs font-semibold text-foreground/60 hover:underline"
                  onClick={() =>
                    setState((prev) =>
                      patchLength(prev, selected.id, { show: false }),
                    )
                  }
                >
                  숨기기
                </button>
              </div>
            ) : null}

            {selAngle && selected?.t === "angle" ? (
              <div className="mt-3 rounded-xl bg-black/[0.03] p-2.5">
                <p className="mb-1.5 text-[11px] font-semibold text-foreground/55">
                  각 {selected.id}
                </p>
                {autoAngleValue(state, selected.id) != null ? (
                  <div className="mb-2">
                    <NumberField
                      label={`${selected.id} 각도 값`}
                      value={Number(autoAngleValue(state, selected.id)!.toFixed(1))}
                      onChange={(n) =>
                        setState((prev) =>
                          applyEditedLabel(prev, selected.id, `${n}°`),
                        )
                      }
                      min={10}
                      max={170}
                      step={1}
                      suffix="°"
                    />
                  </div>
                ) : null}
                <LabelModeRow
                  title="각"
                  mode={selAngle.label.mode}
                  custom={selAngle.label.custom}
                  unknownLetter={state.unknownLetter}
                  onMode={(mode) =>
                    setState((prev) => {
                      const angMark = findAngle(prev, selected.id);
                      if (!angMark) return prev;
                      let custom = angMark.label.custom;
                      if (mode === "custom" && !custom.trim()) {
                        const auto = autoAngleValue(prev, selected.id);
                        custom = auto != null ? `${Math.round(auto)}°` : "";
                      }
                      return patchAngle(prev, selected.id, {
                        label: { ...angMark.label, mode, custom },
                      });
                    })
                  }
                  onCustom={(custom) =>
                    setState((prev) =>
                      applyEditedLabel(prev, selected.id, custom),
                    )
                  }
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {FILL_CHIPS.map((f) => (
                    <ChipToggle
                      key={f.id}
                      on={selAngle.fill === f.id}
                      onClick={() =>
                        setState((prev) =>
                          patchAngle(prev, selected.id, { fill: f.id }),
                        )
                      }
                    >
                      {f.label}
                    </ChipToggle>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-3">
              <p className="mb-1.5 text-[11px] font-semibold text-foreground/55">
                길이 목록
              </p>
              <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
                {lengthList.map((id) => {
                  const mark = findLength(state, id);
                  if (!mark) return null;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        setState((prev) =>
                          patchLength(prev, id, { show: !mark.show }),
                        );
                        setSelected({ t: "length", id });
                      }}
                      className={`rounded-lg px-2 py-1 text-left text-xs font-semibold ${
                        mark.show
                          ? "bg-wood/10 text-wood-dark"
                          : "bg-black/5 text-foreground/50"
                      }`}
                    >
                      {id} {mark.show ? "표시" : "숨김"}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <h2 className="font-display text-sm text-wood-dark">보기</h2>
            <SliderField
              label="회전"
              value={state.viewRotationDeg}
              min={-180}
              max={180}
              step={1}
              onChange={(viewRotationDeg) => set({ viewRotationDeg })}
            />
            {state.kind === "two-tangents" ? (
              <SliderField
                label="반지름"
                value={state.radius}
                min={2}
                max={12}
                step={0.5}
                onChange={(radius) => set({ radius })}
              />
            ) : null}
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <h2 className="font-display text-sm text-wood-dark">빠른 그림</h2>
            <div className="mt-2 flex flex-col gap-1.5">
              {presetsForKind.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setState(() => cloneState(normalizeState(p.state)));
                    setSelected(null);
                    setStatus(`「${p.title}」를 불러왔어요.`);
                  }}
                  className="rounded-xl bg-black/5 px-3 py-2 text-left hover:bg-black/10"
                >
                  <span className="block text-xs font-semibold text-wood-dark">
                    {p.title}
                  </span>
                  <span className="block text-[11px] text-foreground/55">
                    {p.hint}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <details open className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <summary className="font-display cursor-pointer text-sm text-wood-dark">
              그림 스타일
            </summary>
            <div className="mt-2 space-y-1">
              <SliderField
                label="선 굵기"
                value={state.style.lineWidth}
                min={1}
                max={3.5}
                step={0.1}
                onChange={(lineWidth) =>
                  set({ style: { ...state.style, lineWidth } })
                }
              />
              <SliderField
                label="글자"
                value={state.style.fontSize}
                min={14}
                max={32}
                step={1}
                onChange={(fontSize) =>
                  set({ style: { ...state.style, fontSize } })
                }
              />
              <SliderField
                label="점 이름"
                value={state.style.pointLabelSize}
                min={16}
                max={36}
                step={1}
                onChange={(pointLabelSize) =>
                  set({ style: { ...state.style, pointLabelSize } })
                }
              />
              <SliderField
                label="저장 배율"
                value={state.style.exportScale}
                min={2}
                max={5}
                step={0.5}
                onChange={(exportScale) =>
                  set({ style: { ...state.style, exportScale } })
                }
              />
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}

function lengthIdsForKind(state: CircleTangentsState): string[] {
  if (state.kind === "two-tangents") {
    return Object.keys(state.two.lengths);
  }
  if (state.kind === "incircle-triangle") {
    return [...Object.keys(state.tri.sides), ...Object.keys(state.tri.segs)];
  }
  if (state.kind === "tangential-quad") {
    return Object.keys(state.quad.segs);
  }
  return Object.keys(state.three.lengths);
}
