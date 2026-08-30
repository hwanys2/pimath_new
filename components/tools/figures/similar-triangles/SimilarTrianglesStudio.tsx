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
import SimilarTrianglesCanvas, {
  type SimSetter,
} from "@/components/tools/figures/similar-triangles/SimilarTrianglesCanvas";
import {
  canvasToPngBlob,
  copyPngToClipboard,
  downloadBlob,
} from "@/lib/diagrams/export-image";
import {
  angleValue,
  applyEditedLabel,
  cycleTicks,
  displayName,
  draggableIds,
  pointIdsFor,
  segDisplayName,
  segLength,
  type SimSelection,
} from "@/lib/diagrams/similar-triangles/geometry";
import {
  DEFAULT_SIMILAR_STATE,
  SIMILAR_PRESETS,
  SIMILARITY_KINDS,
  cloneState,
  findAng,
  findSeg,
  normalizeState,
  patchAngState,
  patchSegState,
  setPointName,
  withKind,
  type SimilarTrianglesState,
} from "@/lib/diagrams/similar-triangles/model";
import { buildSimilarTrianglesScene } from "@/lib/diagrams/similar-triangles/scene";
import { renderSceneToCanvas, sceneToSvg } from "@/lib/diagrams/render";
import type { FontFaces } from "@/lib/diagrams/math-label";

const STORAGE_KEY = "pm-diagram-g2-similar-triangles-v1";

const storeListeners = new Set<() => void>();

let cachedRaw: string | null = null;
let cachedState: SimilarTrianglesState = DEFAULT_SIMILAR_STATE;
let cacheReady = false;

function parseStoredState(raw: string | null): SimilarTrianglesState {
  if (!raw) return DEFAULT_SIMILAR_STATE;
  try {
    const parsed = JSON.parse(raw) as SimilarTrianglesState;
    if (parsed && parsed.kind && parsed.A && parsed.style) {
      return normalizeState(parsed);
    }
  } catch {
    /* keep default */
  }
  return DEFAULT_SIMILAR_STATE;
}

function getServerSnapshot(): SimilarTrianglesState {
  return DEFAULT_SIMILAR_STATE;
}

function getClientSnapshot(): SimilarTrianglesState {
  if (!cacheReady) {
    cacheReady = true;
    cachedRaw = window.localStorage.getItem(STORAGE_KEY);
    cachedState = parseStoredState(cachedRaw);
  }
  return cachedState;
}

function writeStoredState(state: SimilarTrianglesState, persist = true) {
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

function useSimilarState() {
  const state = useSyncExternalStore(
    subscribeStoredState,
    getClientSnapshot,
    getServerSnapshot,
  );
  const setState: SimSetter = useCallback((updater, persist = true) => {
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

export default function SimilarTrianglesStudio() {
  const { state, setState } = useSimilarState();
  const [selected, setSelected] = useState<SimSelection | null>(null);
  const [status, setStatus] = useState("");

  const fonts = useMemo(() => fontsFromNext(), []);

  function set(patch: Partial<SimilarTrianglesState>) {
    setState((prev) => ({ ...prev, ...patch }));
  }

  function deleteSelected() {
    if (!selected) return;
    if (selected.t === "seg") {
      setState((prev) => patchSegState(prev, selected.id, { show: false }));
    }
    if (selected.t === "ang") {
      setState((prev) => patchAngState(prev, selected.id, { show: false, fill: false }));
    }
  }

  async function exportPng() {
    await document.fonts.ready;
    const scene = buildSimilarTrianglesScene(state);
    const canvas = renderSceneToCanvas(
      scene,
      fonts,
      state.style.lineWidth,
      state.style.exportScale,
    );
    const blob = await canvasToPngBlob(canvas);
    downloadBlob(blob, "삼각형의닮음.png");
    setStatus("PNG를 저장했어요.");
  }

  async function copyPng() {
    await document.fonts.ready;
    const scene = buildSimilarTrianglesScene(state);
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
    const scene = buildSimilarTrianglesScene(state);
    const svg = sceneToSvg(scene, fonts, state.style.lineWidth);
    downloadBlob(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }), "삼각형의닮음.svg");
    setStatus("SVG를 저장했어요.");
  }

  const selSeg = selected?.t === "seg" ? findSeg(state, selected.id) : undefined;
  const selAng = selected?.t === "ang" ? findAng(state, selected.id) : undefined;
  const visiblePoints = pointIdsFor(state.kind).filter((id) => {
    if (state.kind === "parallels") return false;
    if (state.kind === "centroid" && id === "D" && !state.medianAD) return false;
    if (state.kind === "centroid" && id === "E" && !state.medianBE) return false;
    if (state.kind === "centroid" && id === "F" && !state.medianCF) return false;
    return true;
  });
  const dragIds = draggableIds(state);

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
            삼각형의 닮음
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-foreground/65">
            빠른 그림에서 유형을 고른 뒤, 점을 끌어 모양을 잡고 변·각을 눌러
            길이와 각을 붙입니다. 점을 끌면 숫자도 따라가고, 숫자를 넣으면
            그림이 맞춰집니다. 평행선은 선을 잡아 위아래로 옮길 수 있습니다.
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
        <div className="mx-auto w-full max-w-[24rem] overflow-hidden rounded-3xl border-2 border-wood/10 bg-white shadow-[0_12px_40px_rgba(61,44,30,0.08)] lg:mx-0 lg:max-w-none">
          <SimilarTrianglesCanvas
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
              {state.kind === "nested" ? (
                <ChipToggle
                  on={state.midpoint}
                  onClick={() => set({ midpoint: !state.midpoint, t: 0.5 })}
                >
                  중점
                </ChipToggle>
              ) : null}
              {state.kind === "bowtie" ? (
                <ChipToggle
                  on={state.bowtieParallel}
                  onClick={() => set({ bowtieParallel: !state.bowtieParallel })}
                >
                  ED∥BC
                </ChipToggle>
              ) : null}
              {state.kind === "centroid" ? (
                <>
                  <ChipToggle
                    on={state.medianAD}
                    onClick={() => set({ medianAD: !state.medianAD })}
                  >
                    중선 AD
                  </ChipToggle>
                  <ChipToggle
                    on={state.medianBE}
                    onClick={() => set({ medianBE: !state.medianBE })}
                  >
                    중선 BE
                  </ChipToggle>
                  <ChipToggle
                    on={state.medianCF}
                    onClick={() => set({ medianCF: !state.medianCF })}
                  >
                    중선 CF
                  </ChipToggle>
                  <ChipToggle
                    on={state.fillFace}
                    onClick={() => set({ fillFace: !state.fillFace })}
                  >
                    면 채움
                  </ChipToggle>
                </>
              ) : null}
              {state.kind === "parallels" ? (
                <>
                  <ChipToggle
                    on={state.parallels.shareTop}
                    onClick={() =>
                      set({
                        parallels: {
                          ...state.parallels,
                          shareTop: !state.parallels.shareTop,
                        },
                      })
                    }
                  >
                    위 점 공유
                  </ChipToggle>
                  <ChipToggle
                    on={state.parallels.meetAtM}
                    onClick={() => {
                      const next = !state.parallels.meetAtM;
                      const trans = [...state.parallels.trans];
                      if (next && trans.length < 3) {
                        trans.push({ xl: 2.4, xn: -0.5 });
                      }
                      set({ parallels: { ...state.parallels, meetAtM: next, trans } });
                    }}
                  >
                    m에서 만남
                  </ChipToggle>
                </>
              ) : null}
            </div>

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

            {state.angles.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {state.angles.map((a) => (
                  <ChipToggle
                    key={a.id}
                    on={a.show}
                    onClick={() => {
                      setState((prev) =>
                        patchAngState(prev, a.id, { show: !a.show }),
                      );
                      setSelected({ t: "ang", id: a.id });
                    }}
                  >
                    각 {angleChipLabel(state, a.id)}
                  </ChipToggle>
                ))}
              </div>
            ) : null}

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
              </div>
            ) : null}

            {selected?.t === "seg" && selSeg ? (
              <div className="mt-3 space-y-2">
                <p className="text-[11px] font-semibold text-foreground/50">
                  선분 {segDisplayName(state, selSeg)}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <ChipToggle
                    on={selSeg.show}
                    onClick={() =>
                      setState((prev) =>
                        patchSegState(prev, selected.id, { show: !selSeg.show }),
                      )
                    }
                  >
                    길이
                  </ChipToggle>
                  <ChipToggle
                    on={selSeg.parallel}
                    onClick={() =>
                      setState((prev) =>
                        patchSegState(prev, selected.id, {
                          parallel: !selSeg.parallel,
                        }),
                      )
                    }
                  >
                    평행 화살
                  </ChipToggle>
                  <ChipToggle
                    on={selSeg.ticks > 0}
                    onClick={() => setState((prev) => cycleTicks(prev, selected.id))}
                  >
                    빗금 {selSeg.ticks || ""}
                  </ChipToggle>
                </div>
                {selSeg.show ? (
                  <>
                    <NumberField
                      label="길이 값"
                      value={Number((segLength(state, selSeg) || 0).toFixed(2))}
                      onChange={(n) =>
                        setState((prev) => applyEditedLabel(prev, `s:${selected.id}`, String(n)))
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
                        setState((prev) =>
                          patchSegState(prev, selected.id, {
                            label: { ...selSeg.label, mode },
                          }),
                        )
                      }
                      onCustom={(custom) =>
                        setState((prev) => applyEditedLabel(prev, `s:${selected.id}`, custom))
                      }
                    />
                  </>
                ) : null}
              </div>
            ) : null}

            {selected?.t === "ang" && selAng ? (
              <div className="mt-3 space-y-2">
                <p className="text-[11px] font-semibold text-foreground/50">
                  각 {angleChipLabel(state, selAng.id)}
                </p>
                <ChipToggle
                  on={selAng.fill}
                  onClick={() =>
                    setState((prev) =>
                      patchAngState(prev, selected.id, { fill: !selAng.fill }),
                    )
                  }
                >
                  분홍 채움
                </ChipToggle>
                <NumberField
                  label="각 값"
                  value={Number((angleValue(state, selAng) || 0).toFixed(1))}
                  onChange={(n) =>
                    setState((prev) => applyEditedLabel(prev, `a:${selected.id}`, String(n)))
                  }
                  min={1}
                  max={179}
                  step={1}
                  suffix="°"
                />
                <LabelModeRow
                  title="각"
                  mode={selAng.label.mode}
                  custom={selAng.label.custom}
                  unknownLetter={state.unknownLetter}
                  onMode={(mode) =>
                    setState((prev) =>
                      patchAngState(prev, selected.id, {
                        label: { ...selAng.label, mode },
                      }),
                    )
                  }
                  onCustom={(custom) =>
                    setState((prev) => applyEditedLabel(prev, `a:${selected.id}`, custom))
                  }
                />
              </div>
            ) : null}

            <p className="mt-2 text-[11px] leading-snug text-foreground/45">
              변을 누르면 길이가 켜지고 꺼집니다. 글자나 길이 값을 바꿔 숫자나
              x로 두면 그림이 맞춰집니다. 평행선은 잡아 위아래로 옮깁니다.
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
              {SIMILAR_PRESETS.map((preset) => (
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

          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <h2 className="font-display text-sm text-wood-dark">그림 종류</h2>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {SIMILARITY_KINDS.map((k) => (
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

function angleChipLabel(state: SimilarTrianglesState, id: string): string {
  const mark = findAng(state, id);
  if (!mark) return id;
  return `${displayName(state, mark.from)}${displayName(state, mark.vertex)}${displayName(state, mark.to)}`;
}

function listActiveMarks(state: SimilarTrianglesState): {
  key: string;
  label: string;
  clear: (prev: SimilarTrianglesState) => SimilarTrianglesState;
}[] {
  const items: {
    key: string;
    label: string;
    clear: (prev: SimilarTrianglesState) => SimilarTrianglesState;
  }[] = [];
  for (const seg of state.segs) {
    if (!seg.show && !seg.parallel && seg.ticks === 0) continue;
    const name = segDisplayName(state, seg);
    if (seg.show) {
      items.push({
        key: `s-${seg.id}`,
        label: `길이 ${name}`,
        clear: (prev) => patchSegState(prev, seg.id, { show: false }),
      });
    }
  }
  for (const ang of state.angles) {
    if (!ang.show) continue;
    items.push({
      key: `a-${ang.id}`,
      label: `각 ${angleChipLabel(state, ang.id)}`,
      clear: (prev) => patchAngState(prev, ang.id, { show: false, fill: false }),
    });
  }
  return items;
}
