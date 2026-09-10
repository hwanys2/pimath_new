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
import TrigRatiosCanvas, {
  type TrigSetter,
} from "@/components/tools/figures/trig-ratios/TrigRatiosCanvas";
import {
  canvasToPngBlob,
  copyPngToClipboard,
  cropCanvasToInk,
  downloadBlob,
  EXPORT_INK_PAD,
} from "@/lib/diagrams/export-image";
import {
  applyEditedLabel,
  applySegNumeric,
  interiorAngleDeg,
  quadDiagAngleDeg,
  rebuildRightForRightVertex,
  rebuildTriangleFromLegs,
  resolveSegText,
  segDisplayName,
  segLength,
  setLengthDisplayText,
  setQuadFamily,
  setRotateDeg,
  setThetaDeg,
  trianglePoints,
  worldQuadPoints,
  worldRightTriangle,
  type TrigSelection,
} from "@/lib/diagrams/trig-ratios/geometry";
import {
  ANGLE_FILL_CHIPS,
  DEFAULT_TRIG_STATE,
  FACE_FILL_CHIPS,
  QUAD_DIAG_COLOR_CHIPS,
  TRIG_KINDS,
  TRIG_PRESETS,
  cloneState,
  cycleFigurePoint,
  emptyLabel,
  figurePointIds,
  findAngle,
  findSeg,
  normalizeState,
  patchAngleState,
  patchQuadDiagAngle,
  patchQuadInterior,
  patchSegState,
  pointDisplayOf,
  pointDisplayTitle,
  readPointMark,
  setAllPointDisplay,
  toggleAltitude,
  withKind,
  TRIG_TABLE_THEMES,
  addTableRow,
  removeTableRow,
  setAllTableCellsVisibility,
  setTableColumnVisibility,
  setTableRowsDegs,
  updateTableRowDeg,
  type AltitudeVertex,
  type AngleFill,
  type MeasLabel,
  type TrigRatiosState,
} from "@/lib/diagrams/trig-ratios/model";
import { buildTrigScene } from "@/lib/diagrams/trig-ratios/scene";
import { renderSceneToCanvas, sceneToSvg } from "@/lib/diagrams/render";
import type { FontFaces } from "@/lib/diagrams/math-label";
import type { LockedRightVertex } from "@/lib/diagrams/pythagorean/model";

const STORAGE_KEY = "pm-diagram-g3-trig-ratios-v2";

const storeListeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cachedState: TrigRatiosState = DEFAULT_TRIG_STATE;
let cacheReady = false;

function parseStoredState(raw: string | null): TrigRatiosState {
  if (!raw) return DEFAULT_TRIG_STATE;
  try {
    const parsed = JSON.parse(raw) as TrigRatiosState;
    if (parsed && parsed.kind && parsed.style) {
      return normalizeState(parsed);
    }
  } catch {
    /* keep default */
  }
  return DEFAULT_TRIG_STATE;
}

function getServerSnapshot(): TrigRatiosState {
  return DEFAULT_TRIG_STATE;
}

function getClientSnapshot(): TrigRatiosState {
  if (!cacheReady) {
    cacheReady = true;
    cachedRaw = window.localStorage.getItem(STORAGE_KEY);
    cachedState = parseStoredState(cachedRaw);
  }
  return cachedState;
}

function writeStoredState(state: TrigRatiosState, persist = true) {
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

function useTrigState() {
  const state = useSyncExternalStore(
    subscribeStoredState,
    getClientSnapshot,
    getServerSnapshot,
  );
  const setState: TrigSetter = useCallback((updater, persist = true) => {
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

export default function TrigRatiosStudio() {
  const { state, setState } = useTrigState();
  const [selected, setSelected] = useState<TrigSelection | null>(null);
  const [status, setStatus] = useState("");
  const fonts = useMemo(() => fontsFromNext(), []);

  function set(patch: Partial<TrigRatiosState>) {
    setState((prev) => normalizeState({ ...prev, ...patch }));
  }

  function deleteSelected() {
    if (!selected) return;
    if (selected.t === "seg") {
      if (state.kind === "unit-circle") {
        setState((prev) =>
          patchSegState(prev, selected.id, {
            lineStyle: "hidden",
            hidden: true,
            dashed: false,
          }),
        );
        return;
      }
      setState((prev) => patchSegState(prev, selected.id, { show: false }));
      return;
    }
    if (selected.t === "ang") {
      if (selected.id.startsWith("v:")) {
        const i = Number(selected.id.slice(2));
        setState((prev) => patchQuadInterior(prev, i, { showInterior: false }));
        return;
      }
      if (selected.id === "theta") {
        set({ showAngleX: false });
        return;
      }
      if (selected.id === "y") {
        set({ showAngleY: false });
        return;
      }
      if (selected.id === "z") {
        set({ showAngleZ: false });
        return;
      }
      setState((prev) => patchAngleState(prev, selected.id, { show: false }));
    }
  }

  async function exportPng() {
    await document.fonts.ready;
    const scene = buildTrigScene(state);
    const canvas = renderSceneToCanvas(
      scene,
      fonts,
      state.style.lineWidth,
      state.style.exportScale,
    );
    const cropped = cropCanvasToInk(
      canvas,
      EXPORT_INK_PAD * state.style.exportScale,
    );
    const blob = await canvasToPngBlob(cropped);
    downloadBlob(blob, "삼각비.png");
    setStatus("PNG를 저장했어요.");
  }

  async function copyPng() {
    await document.fonts.ready;
    const scene = buildTrigScene(state);
    const canvas = renderSceneToCanvas(
      scene,
      fonts,
      state.style.lineWidth,
      state.style.exportScale,
    );
    const cropped = cropCanvasToInk(
      canvas,
      EXPORT_INK_PAD * state.style.exportScale,
    );
    const blob = await canvasToPngBlob(cropped);
    await copyPngToClipboard(blob);
    setStatus("클립보드에 그림을 복사했어요.");
  }

  function exportSvg() {
    const scene = buildTrigScene(state);
    const svg = sceneToSvg(scene, fonts, state.style.lineWidth, EXPORT_INK_PAD);
    downloadBlob(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }), "삼각비.svg");
    setStatus("SVG를 저장했어요.");
  }

  const segPool = state.kind === "triangle-area" ? state.triSegs : state.segs;
  const selSeg = selected?.t === "seg" ? findSeg(state, selected.id) : undefined;
  const selAngle = selected?.t === "ang" ? selected.id : null;
  const presetsForKind = TRIG_PRESETS.filter((p) => p.state.kind === state.kind);

  return (
    <div className={`${notoSerif.variable} ${notoSerifKr.variable} space-y-4`}>
      <span
        className={`${notoSerif.className} ${notoSerifKr.className} sr-only italic`}
        style={{ fontFamily: '"Times New Roman", serif' }}
        aria-hidden
      >
        xxyy OO AA cm 60° √3
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
          <h1 className="font-display mt-1 text-3xl text-wood-dark sm:text-4xl">삼각비</h1>
          <p className="mt-1 max-w-2xl text-sm text-foreground/65">
            직각삼각형·단위원·삼각형·사각형의 넓이·삼각비의 표 문제 그림을 시험지처럼 그리고 PNG로
            저장해요.
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
            <TrigRatiosCanvas
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
            <h2 className="font-display text-sm text-wood-dark">그림 종류</h2>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {TRIG_KINDS.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => {
                    if (state.kind === k.id) return;
                    setState((prev) => withKind(prev, k.id));
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

            {state.kind === "right" ? (
              <div className="mt-3 space-y-2">
                <p className="text-xs font-semibold text-foreground/60">직각 위치</p>
                <Segmented
                  value={state.rightVertex}
                  onChange={(v) =>
                    setState((prev) => rebuildRightForRightVertex(prev, v as LockedRightVertex))
                  }
                  options={[
                    { id: "C", label: "꼭짓점 C" },
                    { id: "A", label: "꼭짓점 A" },
                    { id: "B", label: "꼭짓점 B" },
                  ]}
                />
                <ChipToggle
                  on={state.isoscelesRight}
                  onClick={() => {
                    const next = !state.isoscelesRight;
                    if (next) {
                      const m = Math.max(state.legLeft, state.legRight);
                      setState((prev) => rebuildTriangleFromLegs(prev, m, m));
                    }
                    set({ isoscelesRight: next });
                  }}
                >
                  이등변직각
                </ChipToggle>
                <div className="grid grid-cols-2 gap-2">
                  <NumberField
                    label="다리 (왼쪽)"
                    value={state.legLeft}
                    onChange={(legLeft) =>
                      setState((prev) => rebuildTriangleFromLegs(prev, legLeft, prev.legRight))
                    }
                    min={0.5}
                    max={40}
                    step={0.1}
                    suffix={state.unit}
                  />
                  <NumberField
                    label="다리 (오른쪽)"
                    value={state.legRight}
                    onChange={(legRight) =>
                      setState((prev) => rebuildTriangleFromLegs(prev, prev.legLeft, legRight))
                    }
                    min={0.5}
                    max={40}
                    step={0.1}
                    suffix={state.unit}
                  />
                </div>
              </div>
            ) : null}

            {state.kind === "unit-circle" ? (
              <div className="mt-3">
                <NumberField
                  label="각 θ"
                  value={state.thetaDeg}
                  onChange={(thetaDeg) => setState((prev) => setThetaDeg(prev, thetaDeg))}
                  min={15}
                  max={80}
                  step={0.1}
                  suffix="°"
                />
              </div>
            ) : null}

            {state.kind === "triangle-area" ? (
              <div className="mt-3 space-y-2">
                <p className="text-xs font-semibold text-foreground/60">수선</p>
                <div className="flex flex-wrap gap-1.5">
                  {(["A", "B", "C"] as const).map((v) => (
                    <ChipToggle
                      key={v}
                      on={state.altitudes.includes(v)}
                      onClick={() =>
                        setState((prev) => toggleAltitude(prev, v as AltitudeVertex))
                      }
                    >
                      {v}
                    </ChipToggle>
                  ))}
                </div>
                <p className="text-[11px] leading-snug text-foreground/45">
                  여러 꼭짓점에서 동시에 켤 수 있어요.
                </p>
              </div>
            ) : null}

            {state.kind === "quad-area" ? (
              <div className="mt-3">
                <Segmented
                  value={state.quadFamily}
                  onChange={(v) =>
                    setState((prev) =>
                      setQuadFamily(prev, v as TrigRatiosState["quadFamily"]),
                    )
                  }
                  options={[
                    { id: "general", label: "일반" },
                    { id: "parallelogram", label: "평행사변형" },
                  ]}
                />
              </div>
            ) : null}

            {state.kind === "table" ? (
              <div className="mt-3 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-foreground/70">
                    행별 각도 설정 ({state.tableRows.length}행)
                  </p>
                  <button
                    type="button"
                    onClick={() => setState((prev) => addTableRow(prev))}
                    disabled={state.tableRows.length >= 8}
                    className="rounded-lg bg-wood/10 px-2.5 py-1 text-xs font-semibold text-wood-dark hover:bg-wood/20 disabled:opacity-40"
                  >
                    + 행 추가
                  </button>
                </div>

                <div className="space-y-2">
                  {state.tableRows.map((row, idx) => (
                    <div
                      key={row.id}
                      className="flex items-center gap-2 rounded-xl bg-black/[0.03] p-2"
                    >
                      <span className="w-5 text-center text-xs font-semibold text-foreground/45">
                        {idx + 1}
                      </span>
                      <div className="flex-1">
                        <NumberField
                          label={`각도`}
                          value={row.deg}
                          onChange={(deg) =>
                            setState((prev) => updateTableRowDeg(prev, row.id, deg))
                          }
                          min={0}
                          max={90}
                          step={1}
                          suffix="°"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setState((prev) => removeTableRow(prev, row.id))}
                        disabled={state.tableRows.length <= 1}
                        className="mt-4 rounded-lg p-1.5 text-xs text-foreground/40 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-20"
                        title="이 행 삭제"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>

                <div className="space-y-1.5 pt-1">
                  <p className="text-[11px] font-semibold text-foreground/50">빠른 각도 설정</p>
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      onClick={() => setState((prev) => setTableRowsDegs(prev, [34, 35, 36]))}
                      className="rounded-lg bg-black/5 px-2 py-1 text-[11px] font-semibold text-foreground/70 hover:bg-black/10"
                    >
                      34°~36°
                    </button>
                    <button
                      type="button"
                      onClick={() => setState((prev) => setTableRowsDegs(prev, [32, 43, 54]))}
                      className="rounded-lg bg-black/5 px-2 py-1 text-[11px] font-semibold text-foreground/70 hover:bg-black/10"
                    >
                      32°·43°·54°
                    </button>
                    <button
                      type="button"
                      onClick={() => setState((prev) => setTableRowsDegs(prev, [30, 45, 60]))}
                      className="rounded-lg bg-black/5 px-2 py-1 text-[11px] font-semibold text-foreground/70 hover:bg-black/10"
                    >
                      30°·45°·60°
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const base = state.tableRows[0]?.deg ?? 30;
                        setState((prev) => setTableRowsDegs(prev, [base, base + 1, base + 2]));
                      }}
                      className="rounded-lg bg-black/5 px-2 py-1 text-[11px] font-semibold text-foreground/70 hover:bg-black/10"
                    >
                      1°씩 증가
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </section>
        </div>

        {state.kind === "table" ? (
          <div className="space-y-4">
            <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
              <h2 className="font-display text-sm text-wood-dark">칸 표시 제어</h2>
              <div className="mt-2 rounded-xl bg-amber-500/10 p-2.5 text-xs text-wood-dark">
                💡 <strong>그림 위의 숫자 칸을 클릭</strong>하면 값이 켜지거나 꺼져요. 원하는 칸만 남겨 시험 문제를 만들 수 있어요.
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setState((prev) => setAllTableCellsVisibility(prev, true))}
                  className="flex-1 rounded-xl bg-wood/10 py-2 text-xs font-semibold text-wood-dark hover:bg-wood/20"
                >
                  전체 보이기
                </button>
                <button
                  type="button"
                  onClick={() => setState((prev) => setAllTableCellsVisibility(prev, false))}
                  className="flex-1 rounded-xl bg-black/5 py-2 text-xs font-semibold text-foreground/70 hover:bg-black/10"
                >
                  전체 가리기
                </button>
              </div>

              <div className="mt-3 space-y-1.5">
                <p className="text-xs font-semibold text-foreground/60">열 단위 일괄 토글</p>
                <div className="grid grid-cols-2 gap-1.5">
                  <ChipToggle
                    on={state.tableRows.every((r) => r.showAngle)}
                    onClick={() => {
                      const allOn = state.tableRows.every((r) => r.showAngle);
                      setState((prev) => setTableColumnVisibility(prev, "deg", !allOn));
                    }}
                  >
                    각도 열
                  </ChipToggle>
                  <ChipToggle
                    on={state.tableRows.every((r) => r.showSin)}
                    onClick={() => {
                      const allOn = state.tableRows.every((r) => r.showSin);
                      setState((prev) => setTableColumnVisibility(prev, "sin", !allOn));
                    }}
                  >
                    사인(sin) 열
                  </ChipToggle>
                  <ChipToggle
                    on={state.tableRows.every((r) => r.showCos)}
                    onClick={() => {
                      const allOn = state.tableRows.every((r) => r.showCos);
                      setState((prev) => setTableColumnVisibility(prev, "cos", !allOn));
                    }}
                  >
                    코사인(cos) 열
                  </ChipToggle>
                  <ChipToggle
                    on={state.tableRows.every((r) => r.showTan)}
                    onClick={() => {
                      const allOn = state.tableRows.every((r) => r.showTan);
                      setState((prev) => setTableColumnVisibility(prev, "tan", !allOn));
                    }}
                  >
                    탄젠트(tan) 열
                  </ChipToggle>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
              <h2 className="font-display text-sm text-wood-dark">표 스타일</h2>

              <div className="mt-3 space-y-2">
                <p className="text-xs font-semibold text-foreground/60">색상 테마</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {TRIG_TABLE_THEMES.map((theme) => (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => set({ tableTheme: theme.id })}
                      className={`flex items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-semibold ${
                        state.tableTheme === theme.id
                          ? "bg-wood text-cream"
                          : "bg-black/5 text-foreground/70 hover:bg-black/10"
                      }`}
                    >
                      <span
                        className="inline-block h-3.5 w-3.5 rounded-full border border-black/20"
                        style={{ backgroundColor: theme.color }}
                      />
                      {theme.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-3 space-y-2">
                <p className="text-xs font-semibold text-foreground/60">헤더 표기</p>
                <Segmented
                  value={state.tableHeaderMode}
                  onChange={(v) =>
                    set({ tableHeaderMode: v as TrigRatiosState["tableHeaderMode"] })
                  }
                  options={[
                    { id: "full", label: "사인(sin)" },
                    { id: "short", label: "sin" },
                  ]}
                />
              </div>

              <div className="mt-3 space-y-2">
                <p className="text-xs font-semibold text-foreground/60">행 구분선</p>
                <Segmented
                  value={state.tableShowRowDividers ? "show" : "hide"}
                  onChange={(v) => set({ tableShowRowDividers: v === "show" })}
                  options={[
                    { id: "hide", label: "없음 (여백)" },
                    { id: "show", label: "있음 (가로선)" },
                  ]}
                />
              </div>
            </section>
          </div>
        ) : (
          <div className="space-y-4">
            <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
              <h2 className="font-display text-sm text-wood-dark">표시</h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <ChipToggle
                on={figurePointIds(state).every((id) => readPointMark(state, id).showName)}
                onClick={() => {
                  const ids = figurePointIds(state);
                  const next = !ids.every((id) => readPointMark(state, id).showName);
                  setState((prev) => setAllPointDisplay(prev, { showName: next }));
                }}
              >
                꼭짓점 이름
              </ChipToggle>
              <ChipToggle
                on={figurePointIds(state).every((id) => readPointMark(state, id).showDot)}
                onClick={() => {
                  const ids = figurePointIds(state);
                  const next = !ids.every((id) => readPointMark(state, id).showDot);
                  setState((prev) => setAllPointDisplay(prev, { showDot: next }));
                }}
              >
                점
              </ChipToggle>
              {state.kind === "right" ? (
                <>
                  <ChipToggle
                    on={state.showRightAngle}
                    onClick={() => set({ showRightAngle: !state.showRightAngle })}
                  >
                    직각
                  </ChipToggle>
                  {state.angles.map((a) => (
                    <ChipToggle
                      key={a.id}
                      on={a.show}
                      onClick={() => {
                        setState((prev) =>
                          patchAngleState(prev, a.id, { show: !a.show }),
                        );
                        setSelected({ t: "ang", id: a.id });
                      }}
                    >
                      ∠{a.id}
                    </ChipToggle>
                  ))}
                </>
              ) : null}
              {state.kind === "unit-circle" ? (
                <>
                  <ChipToggle on={state.showAxes} onClick={() => set({ showAxes: !state.showAxes })}>
                    축
                  </ChipToggle>
                  <ChipToggle
                    on={state.showAxisValues}
                    onClick={() => set({ showAxisValues: !state.showAxisValues })}
                  >
                    축 1
                  </ChipToggle>
                  <ChipToggle
                    on={state.showCosValue}
                    onClick={() => set({ showCosValue: !state.showCosValue })}
                  >
                    cos
                  </ChipToggle>
                  <ChipToggle
                    on={state.showSinValue}
                    onClick={() => set({ showSinValue: !state.showSinValue })}
                  >
                    sin
                  </ChipToggle>
                  <ChipToggle
                    on={state.showTanValue}
                    onClick={() => set({ showTanValue: !state.showTanValue })}
                  >
                    tan
                  </ChipToggle>
                  <ChipToggle
                    on={state.showRadiusLabel}
                    onClick={() => set({ showRadiusLabel: !state.showRadiusLabel })}
                  >
                    반지름 1
                  </ChipToggle>
                  <ChipToggle
                    on={state.showUnitRightAngles}
                    onClick={() => set({ showUnitRightAngles: !state.showUnitRightAngles })}
                  >
                    직각
                  </ChipToggle>
                  <ChipToggle
                    on={state.showYProjections}
                    onClick={() => set({ showYProjections: !state.showYProjections })}
                  >
                    y축 점선
                  </ChipToggle>
                  <ChipToggle
                    on={state.showAngleX}
                    onClick={() => {
                      set({ showAngleX: !state.showAngleX });
                      setSelected({ t: "ang", id: "theta" });
                    }}
                  >
                    각 x°
                  </ChipToggle>
                  <ChipToggle
                    on={state.showAngleY}
                    onClick={() => {
                      set({ showAngleY: !state.showAngleY });
                      setSelected({ t: "ang", id: "y" });
                    }}
                  >
                    여각 y°
                  </ChipToggle>
                  <ChipToggle
                    on={state.showAngleZ}
                    onClick={() => {
                      set({ showAngleZ: !state.showAngleZ });
                      setSelected({ t: "ang", id: "z" });
                    }}
                  >
                    여각 z°
                  </ChipToggle>
                </>
              ) : null}
              {state.kind === "triangle-area" ? (
                <>
                  <ChipToggle
                    on={state.showTriFill}
                    onClick={() => set({ showTriFill: !state.showTriFill })}
                  >
                    면 채움
                  </ChipToggle>
                  <ChipToggle
                    on={state.showAltitudeHighlight}
                    onClick={() => set({ showAltitudeHighlight: !state.showAltitudeHighlight })}
                  >
                    수선 강조
                  </ChipToggle>
                  <ChipToggle
                    on={state.showAltitudeRight}
                    onClick={() => set({ showAltitudeRight: !state.showAltitudeRight })}
                  >
                    수선 직각
                  </ChipToggle>
                  <ChipToggle
                    on={state.showBaseExtension}
                    onClick={() => set({ showBaseExtension: !state.showBaseExtension })}
                  >
                    밑변 연장
                  </ChipToggle>
                  {state.triAngles.map((a) => (
                    <ChipToggle
                      key={a.id}
                      on={a.show}
                      onClick={() => {
                        setState((prev) =>
                          patchAngleState(prev, a.id, { show: !a.show }),
                        );
                        setSelected({ t: "ang", id: a.id });
                      }}
                    >
                      ∠{a.id}
                    </ChipToggle>
                  ))}
                </>
              ) : null}
              {state.kind === "quad-area" ? (
                <>
                  <ChipToggle
                    on={state.showQuadFill}
                    onClick={() => set({ showQuadFill: !state.showQuadFill })}
                  >
                    면 채움
                  </ChipToggle>
                  <ChipToggle
                    on={state.showQuadDiagAC}
                    onClick={() => set({ showQuadDiagAC: !state.showQuadDiagAC })}
                  >
                    대각선 AC
                  </ChipToggle>
                  <ChipToggle
                    on={state.showQuadDiagBD || state.showQuadDiagonal}
                    onClick={() => {
                      const next = !(state.showQuadDiagBD || state.showQuadDiagonal);
                      set({ showQuadDiagBD: next, showQuadDiagonal: next });
                    }}
                  >
                    대각선 BD
                  </ChipToggle>
                  {state.showQuadDiagAC && (state.showQuadDiagBD || state.showQuadDiagonal) ? (
                    <>
                      {state.quadDiagAngles.map((a) => (
                        <ChipToggle
                          key={a.id}
                          on={a.show}
                          onClick={() => {
                            setState((prev) =>
                              patchQuadDiagAngle(prev, a.id, { show: !a.show }),
                            );
                            setSelected({ t: "ang", id: a.id });
                          }}
                        >
                          ∠{a.id}
                        </ChipToggle>
                      ))}
                    </>
                  ) : null}
                  {state.quadVertices.map((v, i) => (
                    <ChipToggle
                      key={`qang-${i}`}
                      on={v.showInterior}
                      onClick={() => {
                        setState((prev) =>
                          patchQuadInterior(prev, i, { showInterior: !v.showInterior }),
                        );
                        setSelected({ t: "ang", id: `v:${i}` });
                      }}
                    >
                      ∠{v.name || String.fromCharCode(65 + i)}
                    </ChipToggle>
                  ))}
                </>
              ) : null}
            </div>
            {state.kind === "triangle-area" ? (
              <div className="mt-2 space-y-2">
                <p className="text-[11px] font-semibold text-foreground/50">면 색</p>
                <div className="flex flex-wrap gap-1">
                  {FACE_FILL_CHIPS.map((chip) => (
                    <ChipToggle
                      key={chip.id}
                      on={state.showTriFill && state.triFill === chip.id}
                      onClick={() => set({ triFill: chip.id, showTriFill: true })}
                    >
                      {chip.label}
                    </ChipToggle>
                  ))}
                </div>
                <p className="text-[11px] font-semibold text-foreground/50">수선 색</p>
                <div className="flex flex-wrap gap-1">
                  {ANGLE_FILL_CHIPS.map((chip) => (
                    <ChipToggle
                      key={chip.id}
                      on={state.showAltitudeHighlight && state.altitudeColor === chip.id}
                      onClick={() =>
                        set({ altitudeColor: chip.id, showAltitudeHighlight: true })
                      }
                    >
                      {chip.label}
                    </ChipToggle>
                  ))}
                </div>
              </div>
            ) : null}
            {state.kind === "quad-area" ? (
              <div className="mt-2 space-y-2">
                <p className="text-[11px] font-semibold text-foreground/50">면 색</p>
                <div className="flex flex-wrap gap-1">
                  {FACE_FILL_CHIPS.map((chip) => (
                    <ChipToggle
                      key={chip.id}
                      on={state.showQuadFill && state.quadFill === chip.id}
                      onClick={() => set({ quadFill: chip.id, showQuadFill: true })}
                    >
                      {chip.label}
                    </ChipToggle>
                  ))}
                </div>

                {state.showQuadDiagAC || state.showQuadDiagBD || state.showQuadDiagonal ? (() => {
                  const hasAC = state.showQuadDiagAC;
                  const hasBD = state.showQuadDiagBD || state.showQuadDiagonal;
                  const colorAC = state.quadDiagColorAC ?? state.quadDiagColor ?? "pink";
                  const colorBD = state.quadDiagColorBD ?? state.quadDiagColor ?? "pink";

                  if (hasAC && hasBD) {
                    return (
                      <div className="space-y-2 pt-1">
                        <div>
                          <p className="text-[11px] font-semibold text-foreground/50">대각선 색 (전체)</p>
                          <div className="flex flex-wrap gap-1">
                            {QUAD_DIAG_COLOR_CHIPS.map((chip) => (
                              <ChipToggle
                                key={chip.id}
                                on={colorAC === chip.id && colorBD === chip.id}
                                onClick={() =>
                                  set({
                                    quadDiagColor: chip.id,
                                    quadDiagColorAC: chip.id,
                                    quadDiagColorBD: chip.id,
                                  })
                                }
                              >
                                {chip.label}
                              </ChipToggle>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-1.5 pt-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-medium text-foreground/60 w-14">대각선 AC</span>
                            <div className="flex flex-wrap gap-1">
                              {QUAD_DIAG_COLOR_CHIPS.map((chip) => (
                                <ChipToggle
                                  key={chip.id}
                                  on={colorAC === chip.id}
                                  onClick={() => set({ quadDiagColorAC: chip.id })}
                                >
                                  {chip.label}
                                </ChipToggle>
                              ))}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-medium text-foreground/60 w-14">대각선 BD</span>
                            <div className="flex flex-wrap gap-1">
                              {QUAD_DIAG_COLOR_CHIPS.map((chip) => (
                                <ChipToggle
                                  key={chip.id}
                                  on={colorBD === chip.id}
                                  onClick={() => set({ quadDiagColorBD: chip.id })}
                                >
                                  {chip.label}
                                </ChipToggle>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className="pt-1">
                      <p className="text-[11px] font-semibold text-foreground/50">대각선 색</p>
                      <div className="flex flex-wrap gap-1">
                        {QUAD_DIAG_COLOR_CHIPS.map((chip) => (
                          <ChipToggle
                            key={chip.id}
                            on={(hasAC ? colorAC : colorBD) === chip.id}
                            onClick={() => {
                              if (hasAC) {
                                set({ quadDiagColor: chip.id, quadDiagColorAC: chip.id });
                              } else {
                                set({ quadDiagColor: chip.id, quadDiagColorBD: chip.id });
                              }
                            }}
                          >
                            {chip.label}
                          </ChipToggle>
                        ))}
                      </div>
                    </div>
                  );
                })() : null}
              </div>
            ) : null}

            <div className="mt-2">
              <p className="mb-1 text-[11px] leading-snug text-foreground/45">
                점 버튼을 누르면 이름 → 점 → 안보임. 길이·각 숫자는 끌어 옮기고, 점선만 잡으면
                설명선만 옮겨요.
              </p>
              <div className="flex flex-wrap gap-1">
                {figurePointIds(state).map((id) => {
                  const mark = readPointMark(state, id);
                  const mode = pointDisplayOf(mark.showName, mark.showDot);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setState((prev) => cycleFigurePoint(prev, id))}
                      className={`min-w-[1.5rem] rounded-full px-1.5 py-0.5 text-[11px] font-semibold transition ${
                        mode === "names"
                          ? "bg-wood text-cream"
                          : mode === "dots"
                            ? "bg-gold text-[#6b4a00]"
                            : "bg-black/8 text-foreground/35 line-through"
                      }`}
                      aria-pressed={mode !== "hidden"}
                      title={pointDisplayTitle(mode)}
                    >
                      {mark.name || id}
                    </button>
                  );
                })}
              </div>
            </div>

            {state.kind === "right" || state.kind === "triangle-area" ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {segPool.map((s) => (
                  <ChipToggle
                    key={s.id}
                    on={s.show}
                    onClick={() => {
                      setState((prev) => patchSegState(prev, s.id, { show: !s.show }));
                      setSelected({ t: "seg", id: s.id });
                    }}
                  >
                    {segDisplayName(state, s)}
                  </ChipToggle>
                ))}
              </div>
            ) : null}

            {state.kind === "quad-area" ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {["AB", "BC", "CD", "DA"].map((id, i) => (
                  <ChipToggle
                    key={id}
                    on={state.quadEdges[i]?.showLength ?? false}
                    onClick={() => {
                      setSelected({ t: "seg", id });
                      set({
                        quadEdges: state.quadEdges.map((e, idx) =>
                          idx === i ? { ...e, showLength: !e.showLength } : e,
                        ),
                      });
                    }}
                  >
                    {id}
                  </ChipToggle>
                ))}
                {(["AC", "BD"] as const).map((id) => (
                  <ChipToggle
                    key={id}
                    on={state.quadDiagEdges?.[id]?.showLength ?? false}
                    onClick={() => {
                      setSelected({ t: "seg", id });
                      const cur = state.quadDiagEdges?.[id]?.showLength ?? false;
                      const nextShow = !cur;
                      const nextDiagEdges = {
                        ...state.quadDiagEdges,
                        [id]: {
                          ...(state.quadDiagEdges?.[id] ?? { length: { mode: "auto", custom: "" } }),
                          showLength: nextShow,
                        },
                      };
                      if (id === "AC") {
                        set({
                          quadDiagEdges: nextDiagEdges,
                          showQuadDiagAC: nextShow ? true : state.showQuadDiagAC,
                        });
                      } else {
                        set({
                          quadDiagEdges: nextDiagEdges,
                          showQuadDiagBD: nextShow ? true : state.showQuadDiagBD,
                          showQuadDiagonal: nextShow ? true : state.showQuadDiagonal,
                        });
                      }
                    }}
                  >
                    대각선 {id}
                  </ChipToggle>
                ))}
              </div>
            ) : null}

            {state.kind === "unit-circle" ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {state.unitSegs.map((s) => {
                  const isDashed = s.lineStyle === "dashed" || s.dashed === true;
                  const isHidden = s.lineStyle === "hidden" || s.hidden === true;
                  const isSelected =
                    selected?.t === "seg" &&
                    (selected.id === s.id ||
                      (selected.id.length === 2 &&
                        `${selected.id[1]}${selected.id[0]}` === s.id));
                  return (
                    <ChipToggle
                      key={s.id}
                      on={isSelected || isDashed}
                      onClick={() => {
                        if (isSelected) {
                          const nextStyle = isDashed ? "solid" : "dashed";
                          setState((prev) =>
                            patchSegState(prev, s.id, {
                              lineStyle: nextStyle,
                              dashed: nextStyle === "dashed",
                              hidden: false,
                            }),
                          );
                        } else {
                          setSelected({ t: "seg", id: s.id });
                        }
                      }}
                    >
                      {s.id === "CD" ? "선분 CD" : `선분 ${s.id}`}
                      {isDashed ? " (점선)" : isHidden ? " (숨김)" : ""}
                    </ChipToggle>
                  );
                })}
              </div>
            ) : null}

            {selected?.t === "seg" && selSeg ? (
              <div className="mt-3 space-y-2">
                {state.kind === "unit-circle" ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground/70">
                        {selected.id === "CD" || selected.id === "DC"
                          ? "선분 CD (DC)"
                          : `선분 ${selected.id}`}
                      </span>
                      <span className="text-[11px] text-foreground/45">
                        길이 {segLength(state, selSeg).toFixed(state.axisPrecision)}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-semibold text-foreground/50">선 모양</p>
                      <Segmented
                        value={
                          selSeg.lineStyle ??
                          (selSeg.dashed ? "dashed" : selSeg.hidden ? "hidden" : "solid")
                        }
                        onChange={(lineStyle) => {
                          setState((prev) =>
                            patchSegState(prev, selected.id, {
                              lineStyle,
                              dashed: lineStyle === "dashed",
                              hidden: lineStyle === "hidden",
                            }),
                          );
                        }}
                        options={[
                          { id: "solid", label: "실선" },
                          { id: "dashed", label: "점선" },
                          { id: "hidden", label: "안보임" },
                        ]}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <NumberField
                      label={`${selected.id === "AC" || selected.id === "BD" ? "대각선 " : "선분 "}${selected.id} 길이 값`}
                      value={Number(segLength(state, selSeg).toFixed(1))}
                      onChange={(n) => setState((prev) => applySegNumeric(prev, selected.id, n))}
                      min={0.5}
                      max={40}
                      step={0.1}
                      suffix={state.unit}
                    />
                    <LabelModeRow
                      title="길이"
                      mode={selSeg.label.mode}
                      custom={selSeg.label.custom}
                      unknownLetter={state.unknownLetter}
                      onMode={(mode) =>
                        setState((prev) => {
                          const seg = findSeg(prev, selected.id);
                          if (!seg) return prev;
                          let custom = seg.label.custom;
                          if (mode === "custom" && !custom.trim()) {
                            custom = resolveSegText(prev, seg) ?? "";
                          }
                          return patchSegState(prev, selected.id, {
                            label: { ...seg.label, mode, custom },
                          });
                        })
                      }
                      onCustom={(custom) =>
                        setState((prev) => setLengthDisplayText(prev, selected.id, custom))
                      }
                    />
                  </>
                )}
              </div>
            ) : null}

            {selAngle ? (
              <AngleDisplayPanel
                state={state}
                angId={selAngle}
                setState={setState}
                set={set}
              />
            ) : null}
          </section>

          {state.kind !== "unit-circle" && (
            <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
              <h2 className="font-display text-sm text-wood-dark">보기</h2>
              <SliderField
                label="회전"
                value={state.rotateDeg}
                onChange={(rotateDeg) => setState((prev) => setRotateDeg(prev, rotateDeg))}
                min={0}
                max={359}
                step={1}
                display={`${Math.round(state.rotateDeg)}°`}
              />
              <div className="mt-2">
                <NumberField
                  label="각도"
                  value={Math.round(state.rotateDeg * 10) / 10}
                  onChange={(deg) => setState((prev) => setRotateDeg(prev, deg, { snap: false }))}
                  min={0}
                  max={359}
                  step={1}
                  suffix="°"
                  hint="10° 근처에서는 슬라이더가 살짝 붙습니다."
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {[0, 30, 45, 60, 90, 180, 270].map((deg) => (
                  <button
                    key={deg}
                    type="button"
                    onClick={() => setState((prev) => setRotateDeg(prev, deg, { snap: false }))}
                    className={`rounded-lg px-2 py-1 text-[11px] font-semibold ${
                      Math.abs(state.rotateDeg - deg) < 0.6 ||
                      Math.abs(state.rotateDeg - deg - 360) < 0.6
                        ? "bg-wood/15 text-wood-dark"
                        : "bg-black/5 text-foreground/55 hover:bg-black/10"
                    }`}
                  >
                    {deg}°
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
        )}

        <div className="space-y-4">
          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <h2 className="font-display text-sm text-wood-dark">빠른 그림</h2>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {presetsForKind.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setState(cloneState(preset.state));
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
              {state.kind !== "table" && (
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
              )}
              <SliderField
                label="PNG 배율"
                value={state.style.exportScale}
                onChange={(exportScale) => set({ style: { ...state.style, exportScale } })}
                min={2}
                max={4}
                step={0.5}
              />
              {state.kind !== "table" && (
                <div className="grid grid-cols-2 gap-2">
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
              )}
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}

function angleChipTitle(angId: string, state: TrigRatiosState): string {
  if (angId === "theta") return "각 θ";
  if (angId === "y") return "여각 y";
  if (angId === "z") return "여각 z";
  if (angId.startsWith("v:")) {
    const i = Number(angId.slice(2));
    const name = state.quadVertices[i]?.name || String.fromCharCode(65 + i);
    return `각 ${name}`;
  }
  return `각 ${angId}`;
}

function currentAngleDeg(state: TrigRatiosState, angId: string): number {
  if (angId === "theta") return state.thetaDeg;
  if (angId === "y" || angId === "z") return 90 - state.thetaDeg;
  if (["AOB", "BOC", "COD", "DOA"].includes(angId)) {
    return quadDiagAngleDeg(worldQuadPoints(state), angId);
  }
  if (angId.startsWith("v:")) {
    const i = Number(angId.slice(2));
    return interiorAngleDeg(state.quadPoints, i);
  }
  if (state.kind === "triangle-area") {
    const pts = trianglePoints(state);
    const idx = { A: 0, B: 1, C: 2 }[angId as "A" | "B" | "C"];
    if (idx == null || !pts.A || !pts.B || !pts.C) return 0;
    return interiorAngleDeg([pts.A, pts.B, pts.C], idx);
  }
  const math = worldRightTriangle(state);
  const idx = { A: 0, B: 1, C: 2 }[angId as "A" | "B" | "C"];
  if (idx == null) return 0;
  return interiorAngleDeg([math.A, math.B, math.C], idx);
}

function AngleDisplayPanel({
  state,
  angId,
  setState,
  set,
}: {
  state: TrigRatiosState;
  angId: string;
  setState: TrigSetter;
  set: (patch: Partial<TrigRatiosState>) => void;
}) {
  const unit = angId === "theta" || angId === "y" || angId === "z";
  const quad = angId.startsWith("v:");
  const quadIndex = quad ? Number(angId.slice(2)) : -1;
  const isQuadDiag = ["AOB", "BOC", "COD", "DOA"].includes(angId);
  const diagAngle = isQuadDiag ? state.quadDiagAngles.find((a) => a.id === angId) : null;
  const mark = unit || quad || isQuadDiag ? null : findAngle(state, angId);
  const quadV = quad ? state.quadVertices[quadIndex] : null;

  let fill: AngleFill = "none";
  let label: MeasLabel = emptyLabel("auto");
  if (angId === "theta") {
    fill = state.thetaFill;
    label = state.thetaLabel;
  } else if (angId === "y") {
    fill = state.yAngleFill;
    label = state.yAngleLabel;
  } else if (angId === "z") {
    fill = state.zAngleFill;
    label = state.zAngleLabel;
  } else if (quadV) {
    fill = quadV.fillInterior;
    label = quadV.interior;
  } else if (diagAngle) {
    fill = diagAngle.fill;
    label = diagAngle.label;
  } else if (mark) {
    fill = mark.fill;
    label = mark.label;
  }

  function setFill(next: AngleFill) {
    if (angId === "theta") set({ thetaFill: next });
    else if (angId === "y") set({ yAngleFill: next });
    else if (angId === "z") set({ zAngleFill: next });
    else if (quad) setState((prev) => patchQuadInterior(prev, quadIndex, { fillInterior: next }));
    else if (isQuadDiag) setState((prev) => patchQuadDiagAngle(prev, angId, { fill: next }));
    else setState((prev) => patchAngleState(prev, angId, { fill: next }));
  }

  function patchLabel(next: MeasLabel) {
    if (angId === "theta") set({ thetaLabel: next });
    else if (angId === "y") set({ yAngleLabel: next });
    else if (angId === "z") set({ zAngleLabel: next });
    else if (quad) setState((prev) => patchQuadInterior(prev, quadIndex, { interior: next }));
    else if (isQuadDiag) setState((prev) => patchQuadDiagAngle(prev, angId, { label: next }));
    else setState((prev) => patchAngleState(prev, angId, { label: next }));
  }

  function setLabelMode(mode: MeasLabel["mode"]) {
    patchLabel({ ...label, mode });
  }

  function setLabelCustom(custom: string) {
    patchLabel({ ...label, mode: "custom", custom });
  }

  const deg = currentAngleDeg(state, angId);
  const labelId = quad ? `v:${quadIndex}:interior` : `a:${angId}`;
  const canEditValue = !unit && (isQuadDiag || quad || Boolean(mark && (mark.id === "A" || mark.id === "B" || mark.id === "C")));

  return (
    <div className="mt-3 space-y-2">
      <p className="text-[11px] font-semibold text-foreground/50">{angleChipTitle(angId, state)}</p>
      <p className="text-[11px] font-semibold text-foreground/50">각 색</p>
      <div className="flex flex-wrap gap-1">
        {ANGLE_FILL_CHIPS.map((chip) => (
          <ChipToggle
            key={chip.id}
            on={fill === chip.id}
            onClick={() => setFill(fill === chip.id ? "none" : chip.id)}
          >
            {chip.label}
          </ChipToggle>
        ))}
      </div>
      {canEditValue ? (
        <NumberField
          label="각 값"
          value={Number(deg.toFixed(1))}
          onChange={(n) => setState((prev) => applyEditedLabel(prev, labelId, String(n)))}
          min={1}
          max={179}
          step={1}
          suffix="°"
        />
      ) : null}
      <LabelModeRow
        title="각 크기"
        mode={label.mode}
        custom={label.custom}
        unknownLetter={state.unknownLetter}
        onMode={setLabelMode}
        onCustom={setLabelCustom}
      />
      <p className="text-[11px] leading-snug text-foreground/45">
        크기를 숨기면 호만 남아요. 색을 끄면 검정 호만 그려요.
      </p>
    </div>
  );
}
