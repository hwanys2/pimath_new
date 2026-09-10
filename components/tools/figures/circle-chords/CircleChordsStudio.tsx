"use client";

import { Noto_Serif, Noto_Serif_KR } from "next/font/google";
import Link from "next/link";
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import CircleChordsCanvas, {
  type CircleChordsSetter,
} from "@/components/tools/figures/circle-chords/CircleChordsCanvas";
import {
  ChipToggle,
  LabelModeRow,
  NumberField,
  Segmented,
  SliderField,
} from "@/components/tools/figures/circle-chords/controls";
import {
  cycleLabelMode,
  mapChord,
  toggleRadius,
  type ChordSegKey,
} from "@/lib/diagrams/circle-chords/geometry";
import {
  chordEndPointMode,
  chordMidpointMode,
  chordPointMode,
  chordStartPointMode,
  CIRCLE_CHORD_PRESETS,
  cloneState,
  cycleCenterPointMode,
  cycleChordPointMode,
  DEFAULT_CIRCLE_CHORDS_STATE,
  globalPointDisplayMode,
  labelUnknownLetter,
  POINT_DISPLAY_MODES,
  setAllPointsMode,
  stateCenterMode,
  withChordMidpointMode,
  withChordPointMode,
  withSnappedChords,
  type CircleChordsState,
  type ChordDraft,
  type MeasLabel,
  type PointDisplayMode,
} from "@/lib/diagrams/circle-chords/model";
import { buildCircleChordsScene } from "@/lib/diagrams/circle-chords/scene";
import {
  renderSceneToCanvas,
  sceneToSvg,
} from "@/lib/diagrams/circle-chords/render";
import {
  canvasToPngBlob,
  copyPngToClipboard,
  cropCanvasToInk,
  downloadBlob,
  EXPORT_INK_PAD,
} from "@/lib/diagrams/export-image";
import { formatNiceNumber, type FontFaces } from "@/lib/diagrams/math-label";

const STORAGE_KEY = "pm-diagram-g3-circle-chords-v2";

const storeListeners = new Set<() => void>();

let cachedRaw: string | null = null;
let cachedState: CircleChordsState = DEFAULT_CIRCLE_CHORDS_STATE;
let cacheReady = false;

function parseStoredState(raw: string | null): CircleChordsState {
  if (!raw) return DEFAULT_CIRCLE_CHORDS_STATE;
  try {
    const parsed = JSON.parse(raw) as CircleChordsState;
    if (parsed && Array.isArray(parsed.chords) && parsed.radius) {
      return withSnappedChords(parsed);
    }
  } catch {
    /* keep default */
  }
  return DEFAULT_CIRCLE_CHORDS_STATE;
}

function getServerSnapshot(): CircleChordsState {
  return DEFAULT_CIRCLE_CHORDS_STATE;
}

/** Must return the same object while unchanged, or React 185 loops. */
function getClientSnapshot(): CircleChordsState {
  if (!cacheReady) {
    cacheReady = true;
    cachedRaw = window.localStorage.getItem(STORAGE_KEY);
    cachedState = parseStoredState(cachedRaw);
  }
  return cachedState;
}

function writeStoredState(state: CircleChordsState, persist = true) {
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

function useCircleChordsState() {
  const state = useSyncExternalStore(
    subscribeStoredState,
    getClientSnapshot,
    getServerSnapshot,
  );
  const setState = useCallback<CircleChordsSetter>((updater, persist = true) => {
    const prev = getClientSnapshot();
    const next = typeof updater === "function" ? updater(prev) : updater;
    if (Object.is(next, prev)) {
      if (persist) persistCachedState();
      return;
    }
    writeStoredState(next, persist);
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

export default function CircleChordsStudio() {
  const [state, setState] = useCircleChordsState();
  const [status, setStatus] = useState<string | null>(null);
  const [tool, setTool] = useState<"select" | "draw">("select");
  const [selectedId, setSelectedId] = useState<string | null>(
    () => state.chords[0]?.id ?? null,
  );
  const [selectedSeg, setSelectedSeg] = useState<ChordSegKey>("chord");
  const fonts = useMemo(() => fontsFromNext(), []);
  const selected =
    state.chords.find((c) => c.id === selectedId) ?? state.chords[0] ?? null;

  const set = useCallback(
    (patch: Partial<CircleChordsState>) => {
      setState((prev) => withSnappedChords({ ...prev, ...patch }));
    },
    [setState],
  );

  const patchSelected = useCallback(
    (patch: Partial<ChordDraft>) => {
      if (!selected) return;
      setState((prev) =>
        withSnappedChords(mapChord(prev, selected.id, (c) => ({ ...c, ...patch }))),
      );
    },
    [selected, setState],
  );

  const deleteSelected = useCallback(() => {
    const id = selected?.id;
    if (!id) return;
    const remaining = state.chords.filter((c) => c.id !== id);
    setState((prev) => ({
      ...prev,
      chords: prev.chords.filter((c) => c.id !== id),
    }));
    setSelectedId(remaining[0]?.id ?? null);
    setSelectedSeg("chord");
  }, [selected, state.chords, setState]);

  const activeSegInfo = useMemo(() => {
    if (!selected) return null;
    const center = state.centerName || "O";
    const start = selected.startName || "A";
    const end = selected.endName || "B";
    const mid = selected.midName || "M";

    switch (selectedSeg) {
      case "chord":
        return {
          key: "chord" as const,
          name: `현 ${start}${end}`,
          value: selected.length,
          min: 0.5,
          max: Number((state.radius * 2 * 0.995).toFixed(1)),
          step: 0.5,
          label: selected.chordLabel,
          onValueChange: (val: number) => {
            patchSelected({ lock: "length", length: val });
          },
          onLabelChange: (label: MeasLabel) => {
            patchSelected({ chordLabel: label });
          },
        };
      case "dist":
        return {
          key: "dist" as const,
          name: `중심 거리 ${center}${mid}`,
          value: selected.distance,
          min: 0,
          max: Number((state.radius * 0.995).toFixed(1)),
          step: 0.5,
          label: selected.distLabel,
          onValueChange: (val: number) => {
            patchSelected({ lock: "distance", distance: val });
          },
          onLabelChange: (label: MeasLabel) => {
            patchSelected({ distLabel: label });
          },
        };
      case "radiusStart":
        return {
          key: "radiusStart" as const,
          name: `반지름 ${center}${start}`,
          value: state.radius,
          min: 1,
          max: 40,
          step: 0.5,
          label: selected.radiusStartLabel,
          onValueChange: (val: number) => {
            setState((prev) => withSnappedChords({ ...prev, radius: val }));
          },
          onLabelChange: (label: MeasLabel) => {
            patchSelected({ radiusStartLabel: label });
          },
        };
      case "radiusEnd":
        return {
          key: "radiusEnd" as const,
          name: `반지름 ${center}${end}`,
          value: state.radius,
          min: 1,
          max: 40,
          step: 0.5,
          label: selected.radiusEndLabel,
          onValueChange: (val: number) => {
            setState((prev) => withSnappedChords({ ...prev, radius: val }));
          },
          onLabelChange: (label: MeasLabel) => {
            patchSelected({ radiusEndLabel: label });
          },
        };
      case "half":
        return {
          key: "half" as const,
          name: `반 길이 ${mid}${end}`,
          value: Number((selected.length / 2).toFixed(2)),
          min: 0.2,
          max: Number((state.radius * 0.995).toFixed(1)),
          step: 0.5,
          label: selected.halfLabel,
          onValueChange: (val: number) => {
            patchSelected({ lock: "length", length: val * 2 });
          },
          onLabelChange: (label: MeasLabel) => {
            patchSelected({ halfLabel: label });
          },
        };
    }
  }, [
    selected,
    selectedSeg,
    state.centerName,
    state.radius,
    patchSelected,
    setState,
  ]);

  const segChips = useMemo(() => {
    if (!selected) return [];
    const center = state.centerName || "O";
    const start = selected.startName || "A";
    const end = selected.endName || "B";
    const mid = selected.midName || "M";

    return [
      {
        key: "chord" as ChordSegKey,
        label: `현 ${start}${end}`,
        labelMode: selected.chordLabel.mode,
        onSelect: () => setSelectedSeg("chord"),
        onToggleLength: () =>
          patchSelected({
            chordLabel: {
              ...selected.chordLabel,
              mode: selected.chordLabel.mode === "hide" ? "auto" : "hide",
            },
          }),
      },
      {
        key: "dist" as ChordSegKey,
        label: `거리 ${center}${mid}`,
        labelMode: selected.distLabel.mode,
        onSelect: () => {
          setSelectedSeg("dist");
          if (!selected.showPerp) patchSelected({ showPerp: true });
        },
        onToggleLength: () => {
          const nextMode = selected.distLabel.mode === "hide" ? "auto" : "hide";
          patchSelected({
            showPerp: true,
            distLabel: { ...selected.distLabel, mode: nextMode },
          });
        },
      },
      {
        key: "radiusStart" as ChordSegKey,
        label: `반지름 ${center}${start}`,
        labelMode: selected.radiusStartLabel.mode,
        onSelect: () => {
          setSelectedSeg("radiusStart");
          if (!selected.showRadiusStart) patchSelected({ showRadiusStart: true });
        },
        onToggleLength: () => {
          const nextMode =
            selected.radiusStartLabel.mode === "hide" ? "auto" : "hide";
          patchSelected({
            showRadiusStart: true,
            radiusStartLabel: { ...selected.radiusStartLabel, mode: nextMode },
          });
        },
      },
      {
        key: "radiusEnd" as ChordSegKey,
        label: `반지름 ${center}${end}`,
        labelMode: selected.radiusEndLabel.mode,
        onSelect: () => {
          setSelectedSeg("radiusEnd");
          if (!selected.showRadiusEnd) patchSelected({ showRadiusEnd: true });
        },
        onToggleLength: () => {
          const nextMode =
            selected.radiusEndLabel.mode === "hide" ? "auto" : "hide";
          patchSelected({
            showRadiusEnd: true,
            radiusEndLabel: { ...selected.radiusEndLabel, mode: nextMode },
          });
        },
      },
      {
        key: "half" as ChordSegKey,
        label: `반 길이 ${mid}${end}`,
        labelMode: selected.halfLabel.mode,
        onSelect: () => {
          setSelectedSeg("half");
          if (!selected.showHalf) patchSelected({ showHalf: true });
        },
        onToggleLength: () => {
          const nextMode = selected.halfLabel.mode === "hide" ? "auto" : "hide";
          patchSelected({
            showHalf: true,
            halfLabel: { ...selected.halfLabel, mode: nextMode },
          });
        },
      },
    ];
  }, [selected, state.centerName, patchSelected]);

  async function exportPng() {
    await document.fonts.ready;
    const scene = buildCircleChordsScene(state);
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
    downloadBlob(blob, "원의 현.png");
    setStatus("PNG를 저장했어요.");
  }

  async function copyPng() {
    await document.fonts.ready;
    const scene = buildCircleChordsScene(state);
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
    setStatus("클립보드에 그림을 복사했어요. 한글·워드에 붙여넣기 하세요.");
  }

  function exportSvg() {
    const scene = buildCircleChordsScene(state);
    const svg = sceneToSvg(scene, fonts, state.style.lineWidth, EXPORT_INK_PAD);
    downloadBlob(
      new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
      "원의 현.svg",
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
        xxyy OO AA cm 가
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
            원의 현
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-foreground/65">
            원 위를 끌어 현을 그리세요. 점 A를 옮기면 길이는 그대로 두고 B가
            원을 따라가요. Delete로 고른 현을 지울 수 있어요.
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
          <CircleChordsCanvas
            state={state}
            fonts={fonts}
            tool={tool}
            selectedId={selected?.id ?? null}
            selectedSeg={selectedSeg}
            setState={setState}
            persist={persistCachedState}
            onSelect={(id, segKey) => {
              setSelectedId(id);
              if (segKey) setSelectedSeg(segKey);
            }}
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
              현 그리기
            </ChipToggle>
          </div>

          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <h2 className="font-display text-sm text-wood-dark">점 표시</h2>
            <div className="mt-2 flex flex-wrap gap-1">
              {POINT_DISPLAY_MODES.map((m) => {
                const curMode = globalPointDisplayMode(state);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() =>
                      setState((prev) => setAllPointsMode(prev, m.id))
                    }
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                      curMode === m.id
                        ? "bg-wood text-cream shadow-sm"
                        : "bg-black/5 text-foreground/60 hover:bg-black/10"
                    }`}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
            <div className="mt-2.5">
              <p className="mb-1 text-[11px] leading-snug text-foreground/45">
                점 버튼을 누르면 점과이름 → 점만 → 이름만 → 안보임 순으로 바뀝니다.
              </p>
              <div className="flex flex-wrap gap-1">
                {(() => {
                  const oMode = stateCenterMode(state);
                  return (
                    <button
                      type="button"
                      onClick={() =>
                        setState((prev) => cycleCenterPointMode(prev))
                      }
                      className={`min-w-[1.6rem] rounded-full px-2 py-0.5 text-[11px] font-semibold transition ${
                        oMode === "both"
                          ? "bg-wood text-cream shadow-sm"
                          : oMode === "dot"
                            ? "bg-gold text-[#6b4a00] shadow-sm"
                            : oMode === "name"
                              ? "bg-wood/20 text-wood-dark"
                              : "bg-black/8 text-foreground/35 line-through"
                      }`}
                      title={`점 ${state.centerName || "O"}: ${pointModeTitle(oMode)} (누르면 변경)`}
                    >
                      {state.centerName || "O"}
                    </button>
                  );
                })()}
                {state.chords.flatMap((chord) => {
                  const aMode = chordStartPointMode(chord);
                  const bMode = chordEndPointMode(chord);
                  const mMode = chordMidpointMode(chord);
                  const pts = [
                    {
                      key: `${chord.id}:start`,
                      name: chord.startName || "A",
                      mode: aMode,
                      onClick: () =>
                        setState((prev) =>
                          mapChord(prev, chord.id, (c) =>
                            cycleChordPointMode(c, "start"),
                          ),
                        ),
                    },
                    {
                      key: `${chord.id}:end`,
                      name: chord.endName || "B",
                      mode: bMode,
                      onClick: () =>
                        setState((prev) =>
                          mapChord(prev, chord.id, (c) =>
                            cycleChordPointMode(c, "end"),
                          ),
                        ),
                    },
                  ];
                  if (chord.showMidpoint) {
                    pts.push({
                      key: `${chord.id}:mid`,
                      name: chord.midName || "M",
                      mode: mMode,
                      onClick: () =>
                        setState((prev) =>
                          mapChord(prev, chord.id, (c) =>
                            cycleChordPointMode(c, "mid"),
                          ),
                        ),
                    });
                  }
                  return pts.map((pt) => (
                    <button
                      key={pt.key}
                      type="button"
                      onClick={pt.onClick}
                      className={`min-w-[1.6rem] rounded-full px-2 py-0.5 text-[11px] font-semibold transition ${
                        pt.mode === "both"
                          ? "bg-wood text-cream shadow-sm"
                          : pt.mode === "dot"
                            ? "bg-gold text-[#6b4a00] shadow-sm"
                            : pt.mode === "name"
                              ? "bg-wood/20 text-wood-dark"
                              : "bg-black/8 text-foreground/35 line-through"
                      }`}
                      title={`점 ${pt.name}: ${pointModeTitle(pt.mode)} (누르면 변경)`}
                    >
                      {pt.name}
                    </button>
                  ));
                })}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-sm text-wood-dark">
                {selected
                  ? `현 ${selected.startName}${selected.endName}`
                  : "현"}
              </h2>
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
            {selected ? (
              <>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  <ChipToggle
                    on={selected.showPerp}
                    onClick={() => patchSelected({ showPerp: !selected.showPerp })}
                  >
                    수선
                  </ChipToggle>
                  <ChipToggle
                    on={selected.showRightAngle}
                    onClick={() =>
                      patchSelected({ showRightAngle: !selected.showRightAngle })
                    }
                  >
                    직각
                  </ChipToggle>
                  <ChipToggle
                    on={selected.showMidpoint}
                    onClick={() =>
                      patchSelected({ showMidpoint: !selected.showMidpoint })
                    }
                  >
                    중점
                  </ChipToggle>
                  <ChipToggle
                    on={selected.showHalf}
                    onClick={() => patchSelected({ showHalf: !selected.showHalf })}
                  >
                    반
                  </ChipToggle>
                  <ChipToggle
                    on={selected.equalTicks > 0}
                    onClick={() =>
                      patchSelected({
                        equalTicks: selected.equalTicks === 0 ? 1 : 0,
                      })
                    }
                  >
                    빗금
                  </ChipToggle>
                  <ChipToggle
                    on={selected.showRadiusStart}
                    onClick={() =>
                      patchSelected(toggleRadius(selected, "start"))
                    }
                  >
                    {state.centerName || "O"}{selected.startName} 반지름
                  </ChipToggle>
                  <ChipToggle
                    on={selected.showRadiusEnd}
                    onClick={() => patchSelected(toggleRadius(selected, "end"))}
                  >
                    {state.centerName || "O"}{selected.endName} 반지름
                  </ChipToggle>
                </div>

                <div className="mt-3">
                  <p className="text-[11px] font-semibold text-foreground/50">
                    선분 선택 (길이 조작)
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {segChips.map((chip) => {
                      const isSelected = selectedSeg === chip.key;
                      const hasLength = chip.labelMode !== "hide";
                      return (
                        <button
                          key={chip.key}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              chip.onToggleLength();
                            } else {
                              chip.onSelect();
                            }
                          }}
                          className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                            isSelected
                              ? "bg-wood text-cream shadow-sm"
                              : hasLength
                                ? "bg-wood/15 text-wood-dark"
                                : "bg-black/5 text-foreground/60 hover:bg-black/10"
                          }`}
                          title={
                            hasLength
                              ? "길이 표시 중 (누르면 숨김/선택)"
                              : "누르면 선택 및 표시"
                          }
                        >
                          {chip.label}
                          {hasLength ? " ✓" : ""}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {activeSegInfo ? (
                  <div className="mt-2.5 space-y-2 rounded-xl border border-wood/15 bg-wood/5 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-wood-dark">
                        {activeSegInfo.name}
                      </span>
                      <span className="text-[11px] tabular-nums text-foreground/50">
                        실제 길이: {formatNiceNumber(activeSegInfo.value)} {state.unit}
                      </span>
                    </div>
                    <NumberField
                      label={`${activeSegInfo.name} 길이 값`}
                      value={Number(activeSegInfo.value.toFixed(1))}
                      onChange={activeSegInfo.onValueChange}
                      min={activeSegInfo.min}
                      max={activeSegInfo.max}
                      step={activeSegInfo.step}
                      suffix={state.unit}
                    />
                    <LabelModeRow
                      title="길이"
                      mode={activeSegInfo.label.mode}
                      custom={activeSegInfo.label.custom}
                      unknownLetter={state.unknownLetter}
                      onMode={(mode) => {
                        let custom = activeSegInfo.label.custom;
                        if (mode === "custom" && !custom.trim()) {
                          custom = `${formatNiceNumber(activeSegInfo.value)} ${state.unit}`.trim();
                        } else if (mode === "x" && !custom.trim()) {
                          custom = state.unknownLetter || "x";
                        }
                        activeSegInfo.onLabelChange({
                          ...activeSegInfo.label,
                          mode,
                          custom,
                        });
                      }}
                      onCustom={(custom) => {
                        activeSegInfo.onLabelChange({
                          ...activeSegInfo.label,
                          custom,
                        });
                      }}
                    />
                  </div>
                ) : null}

                <div className="mt-3">
                  <p className="text-[11px] font-semibold text-foreground/50">
                    {selected.startName}{selected.endName} 양 끝점 표시
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {POINT_DISPLAY_MODES.map((m) => {
                      const cur = chordPointMode(selected);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() =>
                            patchSelected(withChordPointMode(selected, m.id))
                          }
                          className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
                            cur === m.id
                              ? "bg-wood text-cream shadow-sm"
                              : "bg-black/5 text-foreground/60 hover:bg-black/10"
                          }`}
                        >
                          {m.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {selected.showMidpoint ? (
                  <div className="mt-2.5">
                    <p className="text-[11px] font-semibold text-foreground/50">
                      중점 {selected.midName || "M"} 표시
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {POINT_DISPLAY_MODES.map((m) => {
                        const cur = chordMidpointMode(selected);
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() =>
                              patchSelected(withChordMidpointMode(selected, m.id))
                            }
                            className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
                              cur === m.id
                                ? "bg-wood text-cream shadow-sm"
                                : "bg-black/5 text-foreground/60 hover:bg-black/10"
                            }`}
                          >
                            {m.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </>
          ) : (
            <p className="mt-2 text-xs text-foreground/50">
              원 둘레를 끌어 현을 그리세요.
            </p>
            )}
            {state.chords.length > 0 ? (
              <ul className="mt-3 space-y-1">
                {state.chords.map((chord) => (
                  <li key={chord.id} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedId(chord.id)}
                      className={`flex-1 rounded-lg px-2 py-1 text-left text-xs font-semibold ${
                        chord.id === selected?.id
                          ? "bg-wood/15 text-wood-dark"
                          : "text-foreground/55 hover:bg-black/5"
                      }`}
                    >
                      {chord.startName}
                      {chord.endName}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const remaining = state.chords.filter(
                          (c) => c.id !== chord.id,
                        );
                        setState((prev) => ({
                          ...prev,
                          chords: prev.chords.filter((c) => c.id !== chord.id),
                        }));
                        if (selectedId === chord.id) {
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
              선분을 누르면 변의 길이가 켜지고 꺼집니다.
              길이 숫자를 끌면 설명선이 같이 가고, 점선만 잡으면 선만 옮겨요.
              반대편으로도 넘길 수 있어요. 끝점을 더블클릭하거나 중심까지 끌면
              반지름이 이어집니다.
            </p>
          </section>

          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <h2 className="font-display text-sm text-wood-dark">원</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="text-xs font-semibold text-foreground/60">
                반지름
                <input
                  type="number"
                  min={1}
                  max={40}
                  step={0.5}
                  value={state.radius}
                  onChange={(e) => set({ radius: Number(e.target.value) })}
                  className="mt-1 w-full rounded-xl border-2 border-wood/20 bg-white px-2 py-1.5 text-sm outline-none focus:border-wood"
                />
              </label>
              <label className="text-xs font-semibold text-foreground/60">
                단위
                <input
                  value={state.unit}
                  onChange={(e) => set({ unit: e.target.value })}
                  placeholder="cm"
                  className="mt-1 w-full rounded-xl border-2 border-wood/20 bg-white px-2 py-1.5 text-sm outline-none focus:border-wood"
                />
              </label>
              <label className="text-xs font-semibold text-foreground/60">
                미지수
                <input
                  value={state.unknownLetter}
                  onChange={(e) => set({ unknownLetter: e.target.value })}
                  className="mt-1 w-full rounded-xl border-2 border-wood/20 bg-white px-2 py-1.5 text-sm outline-none focus:border-wood"
                />
              </label>
              <label className="flex items-end gap-2 pb-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={stateCenterMode(state) !== "none"}
                  onChange={(e) =>
                    set({
                      showCenter: e.target.checked,
                      centerPointMode: e.target.checked ? "both" : "none",
                    })
                  }
                  className="accent-wood"
                />
                중심 점 ({state.centerName || "O"})
              </label>
            </div>
            <label className="mt-2 block text-xs font-semibold text-foreground/60">
              아래 문구
              <input
                value={state.caption}
                onChange={(e) =>
                  set({
                    caption: e.target.value,
                    showCaption: e.target.value.trim().length > 0,
                  })
                }
                placeholder="x를 구하시오."
                className="mt-1 w-full rounded-xl border-2 border-wood/20 bg-white px-2 py-1.5 text-sm font-normal outline-none focus:border-wood"
              />
            </label>
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <h2 className="font-display text-sm text-wood-dark">빠른 그림</h2>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {CIRCLE_CHORD_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    const next = cloneState(preset.state);
                    setState(next);
                    setSelectedId(next.chords[0]?.id ?? null);
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
                min={14}
                max={56}
                step={1}
              />
              <SliderField
                label="점 이름"
                value={state.style.pointLabelSize}
                onChange={(pointLabelSize) =>
                  set({ style: { ...state.style, pointLabelSize } })
                }
                min={14}
                max={64}
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
              <SliderField
                label="직각 표시 크기"
                value={state.style.rightAngleSize}
                onChange={(rightAngleSize) =>
                  set({ style: { ...state.style, rightAngleSize } })
                }
                min={6}
                max={20}
                step={1}
              />
              <SliderField
                label="여백"
                value={state.style.padding}
                onChange={(padding) =>
                  set({ style: { ...state.style, padding } })
                }
                min={36}
                max={90}
                step={2}
              />
              <SliderField
                label="아래 문구 크기"
                value={state.style.captionSize}
                onChange={(captionSize) =>
                  set({ style: { ...state.style, captionSize } })
                }
                min={14}
                max={48}
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

function pointModeTitle(mode: PointDisplayMode): string {
  switch (mode) {
    case "both":
      return "점과 이름";
    case "dot":
      return "점만";
    case "name":
      return "이름만";
    case "none":
      return "안보임";
  }
}
