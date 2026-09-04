"use client";

import { Noto_Serif, Noto_Serif_KR } from "next/font/google";
import Link from "next/link";
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import {
  ChipToggle,
  LabelModeRow,
  SliderField,
} from "@/components/tools/figures/controls";
import InscribedAnglesCanvas, {
  type InscribedSetter,
} from "@/components/tools/figures/inscribed-angles/InscribedAnglesCanvas";
import {
  canvasToPngBlob,
  copyPngToClipboard,
  downloadBlob,
} from "@/lib/diagrams/export-image";
import {
  CENTER_ID,
  connectedIds,
  cycleFill,
  angleFillLabel,
  cycleLabelMode,
  deleteSelected,
  hasEdge,
  possibleAngles,
  toggleEdge,
  toggleRadius,
  upsertAngle,
  upsertArc,
  type InscribedSelection,
} from "@/lib/diagrams/inscribed-angles/geometry";
import {
  DEFAULT_INSCRIBED_STATE,
  INSCRIBED_KINDS,
  INSCRIBED_PRESETS,
  cloneState,
  displayAngleName,
  displayEdgeName,
  findAngle,
  findArc,
  findEdge,
  findPoint,
  labelUnknownLetter,
  normalizeState,
  withKind,
  type InscribedKind,
  type InscribedState,
  type MeasLabel,
} from "@/lib/diagrams/inscribed-angles/model";
import { buildInscribedScene } from "@/lib/diagrams/inscribed-angles/scene";
import { renderSceneToCanvas, sceneToSvg } from "@/lib/diagrams/render";
import type { FontFaces } from "@/lib/diagrams/math-label";

const STORAGE_KEY = "pm-diagram-g3-inscribed-angles-v1";

const storeListeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cachedState: InscribedState = DEFAULT_INSCRIBED_STATE;
let cacheReady = false;

function parseStoredState(raw: string | null): InscribedState {
  if (!raw) return DEFAULT_INSCRIBED_STATE;
  try {
    const parsed = JSON.parse(raw) as InscribedState;
    if (parsed && Array.isArray(parsed.points) && parsed.radius) {
      return normalizeState(parsed);
    }
  } catch {
    /* keep default */
  }
  return DEFAULT_INSCRIBED_STATE;
}

function getServerSnapshot(): InscribedState {
  return DEFAULT_INSCRIBED_STATE;
}

function getClientSnapshot(): InscribedState {
  if (!cacheReady) {
    cacheReady = true;
    cachedRaw = window.localStorage.getItem(STORAGE_KEY);
    cachedState = parseStoredState(cachedRaw);
  }
  return cachedState;
}

function writeStoredState(state: InscribedState, persist = true) {
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

function useInscribedState() {
  const state = useSyncExternalStore(
    subscribeStoredState,
    getClientSnapshot,
    getServerSnapshot,
  );
  const setState = useCallback<InscribedSetter>((updater, persist = true) => {
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

function labelModeHint(label: MeasLabel, unknown: string): string {
  if (label.mode === "x") return ` ${labelUnknownLetter(label, unknown)}`;
  if (label.mode === "hide") return " 숨김";
  if (label.mode === "custom") return " 직접";
  return "";
}

function pointLabel(state: InscribedState, id: string): string {
  if (id === CENTER_ID) return state.centerName || "O";
  if (id === "T+" || id === "T-") return state.tangent?.tName || "T";
  if (id === "E") return state.extension?.extraName || "E";
  return findPoint(state, id)?.name || id;
}

export default function InscribedAnglesStudio() {
  const [state, setState] = useInscribedState();
  const [status, setStatus] = useState<string | null>(null);
  const [tool, setTool] = useState<"select" | "draw">("select");
  const [selected, setSelected] = useState<InscribedSelection | null>(() =>
    state.points[0] ? { t: "point", id: state.points[0].id } : null,
  );
  const fonts = useMemo(() => fontsFromNext(), []);

  const set = useCallback(
    (patch: Partial<InscribedState>) => {
      setState((prev) => normalizeState({ ...prev, ...patch }));
    },
    [setState],
  );

  const deleteSel = useCallback(() => {
    setState((prev) => deleteSelected(prev, selected));
    setSelected(null);
  }, [selected, setState]);

  async function exportPng() {
    await document.fonts.ready;
    const scene = buildInscribedScene(state);
    const canvas = renderSceneToCanvas(
      scene,
      fonts,
      state.style.lineWidth,
      state.style.exportScale,
    );
    const blob = await canvasToPngBlob(canvas);
    downloadBlob(blob, "원주각.png");
    setStatus("PNG를 저장했어요.");
  }

  async function copyPng() {
    await document.fonts.ready;
    const scene = buildInscribedScene(state);
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
    const scene = buildInscribedScene(state);
    const svg = sceneToSvg(scene, fonts, state.style.lineWidth);
    downloadBlob(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }), "원주각.svg");
    setStatus("SVG를 저장했어요.");
  }

  const presetsForKind = INSCRIBED_PRESETS.filter((p) => p.state.kind === state.kind);
  const selPoint = selected?.t === "point" ? findPoint(state, selected.id) : null;
  const selAngle = selected?.t === "angle" ? findAngle(state, selected.id) : null;
  const selArc = selected?.t === "arc" ? findArc(state, selected.id) : null;
  const selEdge = selected?.t === "edge" ? findEdge(state, selected.id) : null;
  const otherPoints = selPoint
    ? state.points.filter((p) => p.id !== selPoint.id)
    : [];

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
          <h1 className="font-display mt-1 text-3xl text-wood-dark sm:text-4xl">원주각</h1>
          <p className="mt-1 max-w-2xl text-sm text-foreground/65">
            원 위 점을 끌어 원주각·중심각 그림을 맞추세요. 빠른 그림에서 시작해서 각·호를
            붙이고 PNG로 저장해요.
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
            <InscribedAnglesCanvas
              state={state}
              fonts={fonts}
              tool={tool}
              selected={selected}
              setState={setState}
              persist={persistCachedState}
              onSelect={setSelected}
              onToolChange={setTool}
              onDeleteSelected={deleteSel}
            />
          </div>

          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <h2 className="font-display text-sm text-wood-dark">그림 종류</h2>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {INSCRIBED_KINDS.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => {
                    if (state.kind === k.id) return;
                    setState((prev) => withKind(prev, k.id as InscribedKind));
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
          </section>
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <ChipToggle on={tool === "select"} onClick={() => setTool("select")}>
              옮기기
            </ChipToggle>
            <ChipToggle on={tool === "draw"} onClick={() => setTool("draw")}>
              점 찍기
            </ChipToggle>
          </div>

          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-sm text-wood-dark">표시</h2>
              {selected && selected.t !== "center" ? (
                <button
                  type="button"
                  onClick={deleteSel}
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
                원
              </ChipToggle>
              <ChipToggle
                on={state.showCenter}
                onClick={() => set({ showCenter: !state.showCenter })}
              >
                중심
              </ChipToggle>
              <ChipToggle
                on={state.showDots}
                onClick={() => set({ showDots: !state.showDots })}
              >
                점
              </ChipToggle>
              <ChipToggle
                on={state.points.some((p) => p.showName)}
                onClick={() => {
                  const next = !state.points.some((p) => p.showName);
                  set({
                    points: state.points.map((p) => ({ ...p, showName: next })),
                  });
                }}
              >
                점 이름
              </ChipToggle>
              <ChipToggle
                on={Boolean(state.tangent?.show)}
                onClick={() => {
                  const at = selPoint?.id ?? state.points[0]?.id;
                  if (!at) return;
                  if (!state.tangent) {
                    set({
                      tangent: {
                        at,
                        show: true,
                        tName: "T",
                        tDx: 0,
                        tDy: 0,
                        span: 1.4,
                      },
                    });
                    return;
                  }
                  set({
                    tangent: {
                      ...state.tangent,
                      at: selPoint?.id ?? state.tangent.at,
                      show: !state.tangent.show,
                    },
                  });
                }}
              >
                접선
              </ChipToggle>
              <ChipToggle
                on={Boolean(state.extension?.show)}
                onClick={() => {
                  if (!state.extension) {
                    if (state.points.length < 2) return;
                    set({
                      extension: {
                        from: state.points[0]!.id,
                        through: state.points[1]!.id,
                        extraName: "E",
                        extraT: 0.55,
                        extraDx: 0,
                        extraDy: 0,
                        show: true,
                      },
                    });
                    return;
                  }
                  set({
                    extension: { ...state.extension, show: !state.extension.show },
                  });
                }}
              >
                변 연장
              </ChipToggle>
            </div>

            {selPoint ? (
              <div className="mt-3 space-y-2">
                <p className="text-[11px] font-semibold text-foreground/50">
                  점 {selPoint.name} · 두 번 누르면 반지름
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <ChipToggle
                    on={hasEdge(state, CENTER_ID, selPoint.id)}
                    onClick={() =>
                      setState((prev) => toggleRadius(prev, selPoint.id))
                    }
                  >
                    {state.centerName || "O"}
                    {selPoint.name}
                  </ChipToggle>
                  {otherPoints.map((p) => (
                    <ChipToggle
                      key={p.id}
                      on={hasEdge(state, selPoint.id, p.id)}
                      onClick={() =>
                        setState((prev) => toggleEdge(prev, selPoint.id, p.id))
                      }
                    >
                      {selPoint.name}
                      {p.name}
                    </ChipToggle>
                  ))}
                </div>
                <p className="text-[11px] font-semibold text-foreground/50">각</p>
                <div className="flex flex-wrap gap-1.5">
                  {possibleAngles(state, selPoint.id).map((pair) => {
                    const idGuess = state.angles.find(
                      (a) =>
                        a.vertex === selPoint.id &&
                        !a.reflex &&
                        ((a.from === pair.from && a.to === pair.to) ||
                          (a.from === pair.to && a.to === pair.from)),
                    );
                    return (
                      <ChipToggle
                        key={`${pair.from}-${pair.to}`}
                        on={Boolean(idGuess?.show)}
                        onClick={() => {
                          setState((prev) =>
                            upsertAngle(prev, selPoint.id, pair.from, pair.to),
                          );
                        }}
                      >
                        ∠{pointLabel(state, pair.from)}
                        {selPoint.name}
                        {pointLabel(state, pair.to)}
                      </ChipToggle>
                    );
                  })}
                </div>
                {connectedIds(state, selPoint.id).filter((id) =>
                  state.points.some((p) => p.id === id),
                ).length >= 1 ? (
                  <>
                    <p className="text-[11px] font-semibold text-foreground/50">호 길이</p>
                    <div className="flex flex-wrap gap-1.5">
                      {state.points
                        .filter((p) => p.id !== selPoint.id)
                        .map((p) => {
                          const ccw = true;
                          const existing = state.arcs.find(
                            (a) =>
                              a.show &&
                              ((a.a === selPoint.id && a.b === p.id) ||
                                (a.a === p.id && a.b === selPoint.id)),
                          );
                          return (
                            <ChipToggle
                              key={p.id}
                              on={Boolean(existing)}
                              onClick={() =>
                                setState((prev) =>
                                  upsertArc(prev, selPoint.id, p.id, ccw),
                                )
                              }
                            >
                              ⌒{selPoint.name}
                              {p.name}
                            </ChipToggle>
                          );
                        })}
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}

            {selAngle ? (
              <div className="mt-3 space-y-2">
                <p className="text-[11px] font-semibold text-foreground/50">
                  {displayAngleName(state, selAngle)}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <ChipToggle
                    on={selAngle.fill !== "none"}
                    onClick={() =>
                      setState((prev) => ({
                        ...prev,
                        angles: prev.angles.map((a) =>
                          a.id === selAngle.id ? { ...a, fill: cycleFill(a.fill) } : a,
                        ),
                      }))
                    }
                  >
                    채움{angleFillLabel(selAngle.fill) ? ` ${angleFillLabel(selAngle.fill)}` : ""}
                  </ChipToggle>
                  <ChipToggle
                    on={selAngle.reflex}
                    onClick={() =>
                      setState((prev) => ({
                        ...prev,
                        angles: prev.angles.map((a) =>
                          a.id === selAngle.id ? { ...a, reflex: !a.reflex } : a,
                        ),
                      }))
                    }
                  >
                    큰 각
                  </ChipToggle>
                  <ChipToggle
                    on={selAngle.right}
                    onClick={() =>
                      setState((prev) => ({
                        ...prev,
                        angles: prev.angles.map((a) =>
                          a.id === selAngle.id ? { ...a, right: !a.right } : a,
                        ),
                      }))
                    }
                  >
                    직각
                  </ChipToggle>
                  <ChipToggle
                    on={selAngle.label.mode !== "hide"}
                    onClick={() =>
                      setState((prev) => ({
                        ...prev,
                        angles: prev.angles.map((a) =>
                          a.id === selAngle.id
                            ? { ...a, label: cycleLabelMode(a.label) }
                            : a,
                        ),
                      }))
                    }
                  >
                    각 숫자
                    {labelModeHint(selAngle.label, state.unknownLetter)}
                  </ChipToggle>
                </div>
                <LabelModeRow
                  title="각"
                  mode={selAngle.label.mode}
                  custom={selAngle.label.custom}
                  unknownLetter={state.unknownLetter}
                  onMode={(mode) =>
                    setState((prev) => ({
                      ...prev,
                      angles: prev.angles.map((a) =>
                        a.id === selAngle.id ? { ...a, label: { ...a.label, mode } } : a,
                      ),
                    }))
                  }
                  onCustom={(custom) =>
                    setState((prev) => ({
                      ...prev,
                      angles: prev.angles.map((a) =>
                        a.id === selAngle.id
                          ? { ...a, label: { ...a.label, custom } }
                          : a,
                      ),
                    }))
                  }
                />
              </div>
            ) : null}

            {selArc ? (
              <div className="mt-3 space-y-2">
                <p className="text-[11px] font-semibold text-foreground/50">호</p>
                <div className="flex flex-wrap gap-1.5">
                  <ChipToggle
                    on={selArc.highlight}
                    onClick={() =>
                      setState((prev) => ({
                        ...prev,
                        arcs: prev.arcs.map((a) =>
                          a.id === selArc.id ? { ...a, highlight: !a.highlight } : a,
                        ),
                      }))
                    }
                  >
                    호 강조
                  </ChipToggle>
                  <ChipToggle
                    on={selArc.ccw}
                    onClick={() =>
                      setState((prev) => ({
                        ...prev,
                        arcs: prev.arcs.map((a) =>
                          a.id === selArc.id ? { ...a, ccw: !a.ccw } : a,
                        ),
                      }))
                    }
                  >
                    {selArc.ccw ? "작은 호 방향" : "반대 호"}
                  </ChipToggle>
                </div>
                <LabelModeRow
                  title="호 길이"
                  mode={selArc.label.mode}
                  custom={selArc.label.custom}
                  unknownLetter={state.unknownLetter}
                  onMode={(mode) =>
                    setState((prev) => ({
                      ...prev,
                      arcs: prev.arcs.map((a) =>
                        a.id === selArc.id ? { ...a, label: { ...a.label, mode } } : a,
                      ),
                    }))
                  }
                  onCustom={(custom) =>
                    setState((prev) => ({
                      ...prev,
                      arcs: prev.arcs.map((a) =>
                        a.id === selArc.id
                          ? { ...a, label: { ...a.label, custom } }
                          : a,
                      ),
                    }))
                  }
                />
              </div>
            ) : null}

            {selEdge ? (
              <p className="mt-3 text-[11px] font-semibold text-foreground/50">
                선분 {displayEdgeName(state, selEdge)}
              </p>
            ) : null}

            <div className="mt-3">
              <p className="text-[11px] font-semibold text-foreground/50">대상</p>
              <ul className="mt-1 max-h-32 space-y-0.5 overflow-auto text-xs">
                {state.points.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setSelected({ t: "point", id: p.id })}
                      className={`w-full rounded-lg px-2 py-1 text-left ${
                        selected?.t === "point" && selected.id === p.id
                          ? "bg-wood/10 font-semibold text-wood-dark"
                          : "text-foreground/65 hover:bg-black/5"
                      }`}
                    >
                      점 {p.name}
                    </button>
                  </li>
                ))}
                {state.angles
                  .filter((a) => a.show)
                  .map((a) => (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => setSelected({ t: "angle", id: a.id })}
                        className={`w-full rounded-lg px-2 py-1 text-left ${
                          selected?.t === "angle" && selected.id === a.id
                            ? "bg-wood/10 font-semibold text-wood-dark"
                            : "text-foreground/65 hover:bg-black/5"
                        }`}
                      >
                        {displayAngleName(state, a)}
                      </button>
                    </li>
                  ))}
              </ul>
            </div>
          </section>

          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <h2 className="font-display text-sm text-wood-dark">보기</h2>
            <SliderField
              label="회전"
              value={state.viewRotationDeg}
              onChange={(viewRotationDeg) => set({ viewRotationDeg })}
              min={0}
              max={359}
              step={1}
              display={`${Math.round(state.viewRotationDeg)}°`}
            />
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
                    setState(
                      normalizeState({
                        ...cloneState(preset.state),
                        style: state.style,
                        unit: state.unit,
                        unknownLetter: state.unknownLetter,
                      }),
                    );
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
                label="선 굵기"
                value={state.style.lineWidth}
                onChange={(lineWidth) => set({ style: { ...state.style, lineWidth } })}
                min={1}
                max={3.5}
                step={0.1}
              />
              <SliderField
                label="글자 크기"
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
                label="PNG 배율"
                value={state.style.exportScale}
                onChange={(exportScale) =>
                  set({ style: { ...state.style, exportScale } })
                }
                min={2}
                max={4}
                step={0.5}
              />
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
