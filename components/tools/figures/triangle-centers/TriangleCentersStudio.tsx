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
import TriangleCentersCanvas, {
  type CentersSetter,
} from "@/components/tools/figures/triangle-centers/TriangleCentersCanvas";
import {
  canvasToPngBlob,
  copyPngToClipboard,
  downloadBlob,
} from "@/lib/diagrams/export-image";
import {
  applySideLength,
  applyVertexAngle,
  applyDisplayedAngle,
  angleDegAt,
  angleReshapeKind,
  clearSelectionMarks,
  derive,
  displayName,
  fullVertexOn,
  isFullSide,
  isFullVertexAngle,
  lengthBetween,
  patchAngle,
  patchLength,
  sideIndex,
  toggleFullVertexAngle,
  type CentersSelection,
} from "@/lib/diagrams/triangle-centers/geometry";
import {
  CENTERS_PRESETS,
  cloneState,
  DEFAULT_CENTERS_STATE,
  normalizeState,
  vertexId,
  type CenterDisplay,
  type CenterKind,
  type TriangleCentersState,
} from "@/lib/diagrams/triangle-centers/model";
import { buildCentersScene } from "@/lib/diagrams/triangle-centers/scene";
import { renderSceneToCanvas, sceneToSvg } from "@/lib/diagrams/render";
import type { FontFaces } from "@/lib/diagrams/math-label";

const STORAGE_KEY = "pm-diagram-g2-triangle-centers-v1";

const storeListeners = new Set<() => void>();

let cachedRaw: string | null = null;
let cachedState: TriangleCentersState = DEFAULT_CENTERS_STATE;
let cacheReady = false;

function parseStoredState(raw: string | null): TriangleCentersState {
  if (!raw) return DEFAULT_CENTERS_STATE;
  try {
    const parsed = JSON.parse(raw) as TriangleCentersState;
    if (parsed && Array.isArray(parsed.points) && parsed.style) {
      return normalizeState(parsed);
    }
  } catch {
    /* keep default */
  }
  return DEFAULT_CENTERS_STATE;
}

function getServerSnapshot(): TriangleCentersState {
  return DEFAULT_CENTERS_STATE;
}

function getClientSnapshot(): TriangleCentersState {
  if (!cacheReady) {
    cacheReady = true;
    cachedRaw = window.localStorage.getItem(STORAGE_KEY);
    cachedState = parseStoredState(cachedRaw);
  }
  return cachedState;
}

function writeStoredState(state: TriangleCentersState, persist = true) {
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

function useCentersState() {
  const state = useSyncExternalStore(
    subscribeStoredState,
    getClientSnapshot,
    getServerSnapshot,
  );
  const setState = useCallback<CentersSetter>((updater, persist = true) => {
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

export default function TriangleCentersStudio() {
  const [state, setState] = useCentersState();
  const [status, setStatus] = useState<string | null>(null);
  const [selected, setSelected] = useState<CentersSelection | null>({
    t: "vertex",
    i: 0,
  });
  const fonts = useMemo(() => fontsFromNext(), []);
  const d = useMemo(() => derive(state), [state]);

  const set = useCallback(
    (patch: Partial<TriangleCentersState>) => {
      setState((prev) => normalizeState({ ...prev, ...patch }));
    },
    [setState],
  );

  const patchCenter = useCallback(
    (which: CenterKind, patch: Partial<CenterDisplay>) => {
      setState((prev) => {
        const cur = which === "circum" ? prev.circum : prev.incenter;
        const next = { ...cur, ...patch };
        return {
          ...prev,
          [which === "circum" ? "circum" : "incenter"]: next,
        };
      });
    },
    [setState],
  );

  const deleteSelected = useCallback(() => {
    setState((prev) => clearSelectionMarks(prev, selected));
  }, [selected, setState]);

  async function exportPng() {
    await document.fonts.ready;
    const scene = buildCentersScene(state);
    const canvas = renderSceneToCanvas(
      scene,
      fonts,
      state.style.lineWidth,
      state.style.exportScale,
    );
    const blob = await canvasToPngBlob(canvas);
    downloadBlob(blob, "외심과 내심.png");
    setStatus("PNG를 저장했어요.");
  }

  async function copyPng() {
    await document.fonts.ready;
    const scene = buildCentersScene(state);
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
    const scene = buildCentersScene(state);
    const svg = sceneToSvg(scene, fonts, state.style.lineWidth);
    downloadBlob(
      new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
      "외심과 내심.svg",
    );
    setStatus("SVG를 저장했어요.");
  }

  const selAngle = selected?.t === "angle"
    ? state.angles.find((a) => a.id === selected.id)
    : undefined;
  const selLen = selected?.t === "length"
    ? state.lengths.find((m) => m.id === selected.id)
    : undefined;
  const activeMarks = useMemo(() => listActiveMarks(state), [state]);

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
            외심과 내심
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-foreground/65">
            꼭짓점을 끌면 외심·내심이 따라옵니다. 칩으로 원·반지름·수선을 켜고,
            각 조각과 선분을 눌러 숫자와 미지수를 붙이세요.
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
          <TriangleCentersCanvas
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
            </div>

            <p className="mt-3 text-[11px] font-semibold text-foreground/50">외심</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <ChipToggle
                on={state.circum.on}
                onClick={() =>
                  setState((prev) => ({
                    ...prev,
                    circum: {
                      ...prev.circum,
                      on: !prev.circum.on,
                      rays: !prev.circum.on && !prev.circum.rays.some(Boolean)
                        ? [true, true, true]
                        : prev.circum.rays,
                    },
                  }))
                }
              >
                외심 {state.circum.name || "O"}
              </ChipToggle>
              <ChipToggle
                on={state.circum.on && state.circum.showCircle}
                onClick={() =>
                  patchCenter("circum", {
                    on: true,
                    showCircle: !state.circum.showCircle,
                  })
                }
              >
                외접원
              </ChipToggle>
              {(["OA", "OB", "OC"] as const).map((label, i) => (
                <ChipToggle
                  key={label}
                  on={state.circum.on && state.circum.rays[i] === true}
                  onClick={() => {
                    const rays: [boolean, boolean, boolean] = [...state.circum.rays];
                    rays[i] = !rays[i];
                    patchCenter("circum", { on: true, rays });
                  }}
                >
                  {label.replace("O", state.circum.name || "O")}
                </ChipToggle>
              ))}
              <ChipToggle
                on={state.circum.on && state.circum.perps.every(Boolean)}
                onClick={() => {
                  const all = state.circum.perps.every(Boolean);
                  patchCenter("circum", {
                    on: true,
                    perps: all ? [false, false, false] : [true, true, true],
                  });
                }}
              >
                수선
              </ChipToggle>
              {state.circum.perps.some(Boolean) ? (
                <ChipToggle
                  on={state.circum.showFeetNames}
                  onClick={() =>
                    patchCenter("circum", { showFeetNames: !state.circum.showFeetNames })
                  }
                >
                  발 이름
                </ChipToggle>
              ) : null}
            </div>

            <p className="mt-3 text-[11px] font-semibold text-foreground/50">내심</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <ChipToggle
                on={state.incenter.on}
                onClick={() =>
                  setState((prev) => ({
                    ...prev,
                    incenter: {
                      ...prev.incenter,
                      on: !prev.incenter.on,
                      rays: !prev.incenter.on && !prev.incenter.rays.some(Boolean)
                        ? [true, true, true]
                        : prev.incenter.rays,
                    },
                  }))
                }
              >
                내심 {state.incenter.name || "I"}
              </ChipToggle>
              <ChipToggle
                on={state.incenter.on && state.incenter.showCircle}
                onClick={() =>
                  patchCenter("in", {
                    on: true,
                    showCircle: !state.incenter.showCircle,
                  })
                }
              >
                내접원
              </ChipToggle>
              {(["IA", "IB", "IC"] as const).map((label, i) => (
                <ChipToggle
                  key={label}
                  on={state.incenter.on && state.incenter.rays[i] === true}
                  onClick={() => {
                    const rays: [boolean, boolean, boolean] = [...state.incenter.rays];
                    rays[i] = !rays[i];
                    patchCenter("in", { on: true, rays });
                  }}
                >
                  {label.replace("I", state.incenter.name || "I")}
                </ChipToggle>
              ))}
              <ChipToggle
                on={state.incenter.on && state.incenter.perps.every(Boolean)}
                onClick={() => {
                  const all = state.incenter.perps.every(Boolean);
                  patchCenter("in", {
                    on: true,
                    perps: all ? [false, false, false] : [true, true, true],
                  });
                }}
              >
                수선
              </ChipToggle>
              {state.incenter.perps.some(Boolean) ? (
                <ChipToggle
                  on={state.incenter.showFeetNames}
                  onClick={() =>
                    patchCenter("in", { showFeetNames: !state.incenter.showFeetNames })
                  }
                >
                  발 이름
                </ChipToggle>
              ) : null}
            </div>

            <div className="mt-3 flex flex-wrap gap-1">
              {state.vertexNames.map((name, i) => (
                <button
                  key={`v-${i}`}
                  type="button"
                  onClick={() => setSelected({ t: "vertex", i: i as 0 | 1 | 2 })}
                  className={`min-w-[1.5rem] rounded-full px-1.5 py-0.5 text-[11px] font-semibold transition ${
                    selected?.t === "vertex" && selected.i === i
                      ? "bg-wood text-cream"
                      : "bg-black/8 text-foreground/55"
                  }`}
                >
                  {name || vertexId(i)}
                </button>
              ))}
              {state.circum.on ? (
                <button
                  type="button"
                  onClick={() => setSelected({ t: "center", which: "circum" })}
                  className={`min-w-[1.5rem] rounded-full px-1.5 py-0.5 text-[11px] font-semibold transition ${
                    selected?.t === "center" && selected.which === "circum"
                      ? "bg-wood text-cream"
                      : "bg-black/8 text-foreground/55"
                  }`}
                >
                  {state.circum.name || "O"}
                </button>
              ) : null}
              {state.incenter.on ? (
                <button
                  type="button"
                  onClick={() => setSelected({ t: "center", which: "in" })}
                  className={`min-w-[1.5rem] rounded-full px-1.5 py-0.5 text-[11px] font-semibold transition ${
                    selected?.t === "center" && selected.which === "in"
                      ? "bg-wood text-cream"
                      : "bg-black/8 text-foreground/55"
                  }`}
                >
                  {state.incenter.name || "I"}
                </button>
              ) : null}
            </div>

            {selected?.t === "vertex" ? (
              <div className="mt-3 space-y-2">
                <p className="text-[11px] font-semibold text-foreground/50">
                  꼭짓점 {state.vertexNames[selected.i] || vertexId(selected.i)}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <ChipToggle
                    on={fullVertexOn(state, selected.i)}
                    onClick={() =>
                      setState((prev) => toggleFullVertexAngle(prev, selected.i))
                    }
                  >
                    내각
                  </ChipToggle>
                  <ChipToggle
                    on={state.vertexRights[selected.i]}
                    onClick={() => {
                      const vertexRights = [...state.vertexRights] as typeof state.vertexRights;
                      vertexRights[selected.i] = !vertexRights[selected.i];
                      set({ vertexRights });
                    }}
                  >
                    직각
                  </ChipToggle>
                </div>
                <TextField
                  label="이름"
                  value={state.vertexNames[selected.i] || ""}
                  onChange={(name) => {
                    const vertexNames = [...state.vertexNames] as typeof state.vertexNames;
                    vertexNames[selected.i] = name;
                    set({ vertexNames });
                  }}
                />
                {fullVertexOn(state, selected.i) && d ? (
                  <NumberField
                    label="내각 값"
                    value={Number(
                      angleDegAt(
                        d,
                        vertexId(selected.i),
                        vertexId((selected.i + 1) % 3),
                        vertexId((selected.i + 2) % 3),
                      ).toFixed(1),
                    )}
                    onChange={(deg) =>
                      setState((prev) => applyVertexAngle(prev, selected.i, deg))
                    }
                    min={1}
                    max={179}
                    step={1}
                    suffix="°"
                  />
                ) : null}
              </div>
            ) : null}

            {selected?.t === "center" ? (
              <div className="mt-3 space-y-2">
                <p className="text-[11px] font-semibold text-foreground/50">
                  {selected.which === "circum" ? "외심" : "내심"}
                </p>
                <TextField
                  label="이름"
                  value={
                    selected.which === "circum"
                      ? state.circum.name
                      : state.incenter.name
                  }
                  onChange={(name) =>
                    patchCenter(selected.which, { name: name.trim() || (selected.which === "circum" ? "O" : "I") })
                  }
                />
              </div>
            ) : null}

            {selected?.t === "angle" && selAngle && d ? (
              <div className="mt-3 space-y-2">
                <p className="text-[11px] font-semibold text-foreground/50">
                  각 {displayName(state, selAngle.at)}
                </p>
                <ChipToggle
                  on={selAngle.fill}
                  onClick={() =>
                    setState((prev) => patchAngle(prev, selAngle.id, { fill: !selAngle.fill }))
                  }
                >
                  채움
                </ChipToggle>
                {angleReshapeKind(selAngle) ? (
                  <NumberField
                    label="각 값"
                    value={Number(
                      angleDegAt(d, selAngle.at, selAngle.from, selAngle.to).toFixed(1),
                    )}
                    onChange={(deg) =>
                      setState((prev) => {
                        const next = applyDisplayedAngle(prev, selAngle, deg);
                        return patchAngle(next, selAngle.id, {
                          label: { ...selAngle.label, mode: "custom", custom: `${deg}°` },
                        });
                      })
                    }
                    min={1}
                    max={179}
                    step={1}
                    suffix="°"
                  />
                ) : null}
                <LabelModeRow
                  title="각"
                  mode={selAngle.label.mode}
                  custom={selAngle.label.custom}
                  unknownLetter={state.unknownLetter}
                  onMode={(mode) =>
                    setState((prev) =>
                      patchAngle(prev, selAngle.id, {
                        label: { ...selAngle.label, mode },
                      }),
                    )
                  }
                  onCustom={(custom) =>
                    setState((prev) =>
                      patchAngle(prev, selAngle.id, {
                        label: { ...selAngle.label, custom },
                      }),
                    )
                  }
                />
              </div>
            ) : null}

            {selected?.t === "length" && selLen && d ? (
              <div className="mt-3 space-y-2">
                <p className="text-[11px] font-semibold text-foreground/50">
                  {displayName(state, selLen.a)}
                  {displayName(state, selLen.b)}
                </p>
                {isFullSide(selLen) ? (
                  <NumberField
                    label="길이 값"
                    value={Number(lengthBetween(d, selLen.a, selLen.b).toFixed(2))}
                    onChange={(len) =>
                      setState((prev) => {
                        const edge = sideIndex(selLen.a, selLen.b);
                        if (edge == null) return prev;
                        const next = applySideLength(prev, edge, len);
                        return patchLength(next, selLen.id, {
                          label: { ...selLen.label, mode: "custom", custom: String(len) },
                        });
                      })
                    }
                    min={0.5}
                    max={40}
                    step={0.1}
                    suffix={state.unit.trim() || "cm"}
                  />
                ) : null}
                <LabelModeRow
                  title="길이"
                  mode={selLen.label.mode}
                  custom={selLen.label.custom}
                  unknownLetter={state.unknownLetter}
                  onMode={(mode) =>
                    setState((prev) =>
                      patchLength(prev, selLen.id, {
                        label: { ...selLen.label, mode },
                      }),
                    )
                  }
                  onCustom={(custom) =>
                    setState((prev) =>
                      patchLength(prev, selLen.id, {
                        label: { ...selLen.label, custom },
                      }),
                    )
                  }
                />
              </div>
            ) : null}

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

            <p className="mt-2 text-[11px] leading-snug text-foreground/45">
              반지름·이등분선이 켜진 뒤 각 조각과 선분을 누르면 표시가 붙습니다.
              Delete로 지울 수 있어요.
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
              {CENTERS_PRESETS.map((preset) => (
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

function listActiveMarks(state: TriangleCentersState): {
  key: string;
  label: string;
  clear: (prev: TriangleCentersState) => TriangleCentersState;
}[] {
  const items: {
    key: string;
    label: string;
    clear: (prev: TriangleCentersState) => TriangleCentersState;
  }[] = [];
  for (const a of state.angles) {
    items.push({
      key: a.id,
      label: `각 ${displayName(state, a.at)}`,
      clear: (prev) => ({
        ...prev,
        angles: prev.angles.filter((item) => item.id !== a.id),
      }),
    });
  }
  for (const m of state.lengths) {
    items.push({
      key: m.id,
      label: `${displayName(state, m.a)}${displayName(state, m.b)}`,
      clear: (prev) => ({
        ...prev,
        lengths: prev.lengths.filter((item) => item.id !== m.id),
      }),
    });
  }
  return items;
}
