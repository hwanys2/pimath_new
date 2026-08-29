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
import NumberLineCanvas, {
  type NumberLineSetter,
} from "@/components/tools/figures/number-line/NumberLineCanvas";
import {
  canvasToPngBlob,
  copyPngToClipboard,
  downloadBlob,
} from "@/lib/diagrams/export-image";
import {
  addPointFromRaw,
  cloneState,
  DEFAULT_NUMBER_LINE_STATE,
  defaultEqualMarks,
  newBandId,
  nextPointName,
  normalizeState,
  NUMBER_LINE_PRESETS,
  resolvedN,
  type EqualMarks,
  type NumberLinePoint,
  type NumberLineState,
} from "@/lib/diagrams/number-line/model";
import { buildNumberLineScene } from "@/lib/diagrams/number-line/scene";
import { formatPointValue, parseNumberLineValue } from "@/lib/diagrams/number-line/parse";
import { renderSceneToCanvas, sceneToSvg } from "@/lib/diagrams/render";
import type { FontFaces } from "@/lib/diagrams/math-label";

const STORAGE_KEY = "pm-diagram-g1-number-line-v2";

const storeListeners = new Set<() => void>();

let cachedRaw: string | null = null;
let cachedState: NumberLineState = DEFAULT_NUMBER_LINE_STATE;
let cacheReady = false;

function parseStoredState(raw: string | null): NumberLineState {
  if (!raw) return DEFAULT_NUMBER_LINE_STATE;
  try {
    const parsed = JSON.parse(raw) as NumberLineState;
    if (parsed && Array.isArray(parsed.points) && typeof parsed.min === "number") {
      return normalizeState(parsed);
    }
  } catch {
    /* keep default */
  }
  return DEFAULT_NUMBER_LINE_STATE;
}

function getServerSnapshot(): NumberLineState {
  return DEFAULT_NUMBER_LINE_STATE;
}

function getClientSnapshot(): NumberLineState {
  if (!cacheReady) {
    cacheReady = true;
    cachedRaw = window.localStorage.getItem(STORAGE_KEY);
    cachedState = parseStoredState(cachedRaw);
  }
  return cachedState;
}

function writeStoredState(state: NumberLineState, persist = true) {
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

function useNumberLineState() {
  const state = useSyncExternalStore(
    subscribeStoredState,
    getClientSnapshot,
    getServerSnapshot,
  );
  const setState = useCallback<NumberLineSetter>((updater, persist = true) => {
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

export default function NumberLineStudio() {
  const [state, setState] = useNumberLineState();
  const [status, setStatus] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(
    () => state.points[0]?.id ?? null,
  );
  const [newName, setNewName] = useState("");
  const [newValue, setNewValue] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const fonts = useMemo(() => fontsFromNext(), []);
  const selected =
    state.points.find((p) => p.id === selectedId) ?? state.points[0] ?? null;

  const set = useCallback(
    (patch: Partial<NumberLineState>) => {
      setState((prev) => normalizeState({ ...prev, ...patch }));
    },
    [setState],
  );

  const patchPoint = useCallback(
    (pointId: string, patch: Partial<NumberLinePoint>) => {
      setState((prev) => ({
        ...prev,
        points: prev.points.map((p) =>
          p.id === pointId ? { ...p, ...patch } : p,
        ),
      }));
    },
    [setState],
  );

  const deleteSelected = useCallback(() => {
    const id = selected?.id;
    if (!id) return;
    setState((prev) => {
      const remaining = prev.points.filter((p) => p.id !== id);
      return { ...prev, points: remaining };
    });
    setSelectedId((cur) => {
      if (cur !== id) return cur;
      const remaining = state.points.filter((p) => p.id !== id);
      return remaining[0]?.id ?? null;
    });
  }, [selected, state.points, setState]);

  async function exportPng() {
    await document.fonts.ready;
    const scene = buildNumberLineScene(state);
    const canvas = renderSceneToCanvas(
      scene,
      fonts,
      state.style.lineWidth,
      state.style.exportScale,
    );
    const blob = await canvasToPngBlob(canvas);
    downloadBlob(blob, "수직선.png");
    setStatus("PNG를 저장했어요.");
  }

  async function copyPng() {
    await document.fonts.ready;
    const scene = buildNumberLineScene(state);
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
    const scene = buildNumberLineScene(state);
    const svg = sceneToSvg(scene, fonts, state.style.lineWidth);
    downloadBlob(
      new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
      "수직선.svg",
    );
    setStatus("SVG를 저장했어요.");
  }

  function addPoint() {
    const result = addPointFromRaw(
      state,
      newValue,
      newName.trim() || nextPointName(state.points),
    );
    if ("error" in result) {
      setAddError(result.error);
      return;
    }
    setAddError(null);
    setState(result);
    const added = result.points[result.points.length - 1];
    if (added) setSelectedId(added.id);
    setNewValue("");
    setNewName("");
  }

  return (
    <div className={`${notoSerif.variable} ${notoSerifKr.variable} space-y-4`}>
      <span
        className={`${notoSerif.className} ${notoSerifKr.className} sr-only italic`}
        style={{ fontFamily: '"Times New Roman", serif' }}
        aria-hidden
      >
        xxyy OO AA +1 -5 가
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
            수직선
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-foreground/65">
            시작·끝·간격을 정하고, 분수나 소수로 점을 넣으세요. 비정수 점은
            그 구간이 n등분으로 표시돼요. 축을 눌러 점을 추가하고 Delete로
            지울 수 있어요.
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

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)]">
        <div className="space-y-4">
          <div className="overflow-hidden rounded-3xl border-2 border-wood/10 bg-white shadow-[0_12px_40px_rgba(61,44,30,0.08)]">
            <NumberLineCanvas
              state={state}
              fonts={fonts}
              selectedId={selected?.id ?? null}
              setState={setState}
              persist={persistCachedState}
              onSelect={setSelectedId}
              onDeleteSelected={deleteSelected}
            />
          </div>

          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <h2 className="font-display text-sm text-wood-dark">점</h2>
            <div className="mt-2.5 grid grid-cols-[4.5rem_1fr_auto] items-end gap-1.5">
              <TextField
                label="이름"
                value={newName}
                onChange={setNewName}
                placeholder={nextPointName(state.points)}
              />
              <TextField
                label="값"
                value={newValue}
                onChange={(v) => {
                  setNewValue(v);
                  setAddError(null);
                }}
                placeholder="-4 1/4, 3/4, +1.5"
              />
              <button
                type="button"
                onClick={addPoint}
                className="rounded-xl bg-wood px-3 py-2 text-xs font-semibold text-cream"
              >
                추가
              </button>
            </div>
            {addError ? (
              <p className="mt-1.5 text-[11px] text-red-700">{addError}</p>
            ) : (
              <p className="mt-1.5 text-[11px] text-foreground/45">
                분수·소수·대분수를 그대로 넣어요. 축을 눌러도 점이 생겨요.
              </p>
            )}

            {state.points.length === 0 ? (
              <p className="mt-3 text-xs text-foreground/45">
                아직 점이 없어요. 값을 넣고 추가하세요.
              </p>
            ) : (
              <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                {state.points.map((point) => (
                  <PointCard
                    key={point.id}
                    point={point}
                    selected={point.id === selected?.id}
                    range={{ min: state.min, max: state.max }}
                    onSelect={() => setSelectedId(point.id)}
                    onPatch={(patch) => patchPoint(point.id, patch)}
                    onRemove={() => {
                      setState((prev) => ({
                        ...prev,
                        points: prev.points.filter((p) => p.id !== point.id),
                      }));
                      if (selectedId === point.id) {
                        const remaining = state.points.filter(
                          (p) => p.id !== point.id,
                        );
                        setSelectedId(remaining[0]?.id ?? null);
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <h2 className="font-display text-sm text-wood-dark">등분 구간</h2>
            <p className="mt-1 text-[11px] text-foreground/45">
              점 없이 단위 구간만 n등분할 수 있어요.
            </p>
            <ul className="mt-2 space-y-1">
              {state.bands.map((band) => (
                <li
                  key={band.id}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <span className="text-foreground/70">
                    [{band.start}, {band.start + 1}] · {band.n}등분
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      set({
                        bands: state.bands.filter((b) => b.id !== band.id),
                      })
                    }
                    className="font-semibold text-foreground/40 hover:text-foreground"
                  >
                    지우기
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() =>
                set({
                  bands: [
                    ...state.bands,
                    {
                      id: newBandId(),
                      start: Math.floor((state.min + state.max) / 2),
                      n: 4,
                      equalMarks: defaultEqualMarks(4),
                    },
                  ],
                })
              }
              className="mt-2 rounded-xl bg-black/5 px-3 py-1.5 text-xs font-semibold text-foreground/70 hover:bg-black/10"
            >
              등분 구간 추가
            </button>
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <h2 className="font-display text-sm text-wood-dark">빠른 그림</h2>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {NUMBER_LINE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    const next = cloneState(preset.state);
                    setState(next);
                    setSelectedId(next.points[0]?.id ?? null);
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
            <h2 className="font-display text-sm text-wood-dark">수직선</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <NumberField
                label="시작"
                value={state.min}
                onChange={(min) => set({ min })}
                step={1}
              />
              <NumberField
                label="끝"
                value={state.max}
                onChange={(max) => set({ max })}
                step={1}
              />
              <NumberField
                label="간격"
                value={state.tickStep}
                onChange={(tickStep) => set({ tickStep })}
                min={0.25}
                max={5}
                step={0.25}
              />
              <NumberField
                label="숫자 간격"
                value={state.labelEvery}
                onChange={(labelEvery) => set({ labelEvery })}
                min={1}
                max={5}
                step={1}
                hint="몇 칸마다 숫자를 달지"
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <ChipToggle
                on={state.leftArrow}
                onClick={() => set({ leftArrow: !state.leftArrow })}
              >
                왼쪽 화살표
              </ChipToggle>
              <ChipToggle
                on={state.rightArrow}
                onClick={() => set({ rightArrow: !state.rightArrow })}
              >
                오른쪽 화살표
              </ChipToggle>
              <ChipToggle
                on={state.showTickLabels}
                onClick={() => set({ showTickLabels: !state.showTickLabels })}
              >
                눈금 숫자
              </ChipToggle>
              <ChipToggle
                on={state.plusOnPositive}
                onClick={() => set({ plusOnPositive: !state.plusOnPositive })}
              >
                양수에 +
              </ChipToggle>
            </div>
          </section>

          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <h2 className="font-display text-sm text-wood-dark">그림 스타일</h2>
            <div className="mt-3 space-y-3">
              <SliderField
                label="눈금 글자"
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
              <SliderField
                label="점 크기"
                value={state.style.pointRadius}
                onChange={(pointRadius) =>
                  set({ style: { ...state.style, pointRadius } })
                }
                min={2}
                max={6}
                step={0.1}
                display={state.style.pointRadius.toFixed(1)}
              />
              <SliderField
                label="좌우 여백"
                value={state.style.paddingX}
                onChange={(paddingX) =>
                  set({ style: { ...state.style, paddingX } })
                }
                min={28}
                max={80}
                step={2}
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
          </section>
        </div>
      </div>
    </div>
  );
}

function PointCard({
  point,
  selected,
  range,
  onSelect,
  onPatch,
  onRemove,
}: {
  point: NumberLinePoint;
  selected: boolean;
  range: { min: number; max: number };
  onSelect: () => void;
  onPatch: (patch: Partial<NumberLinePoint>) => void;
  onRemove: () => void;
}) {
  const autoN = resolvedN(point);
  return (
    <article
      className={`rounded-xl border-2 p-2.5 ${
        selected
          ? "border-wood/40 bg-wood/5"
          : "border-wood/10 bg-white"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onSelect}
          className="min-w-0 flex-1 text-left"
        >
          <p className="font-display text-sm text-wood-dark">
            점 {point.name}
          </p>
          <p className="text-[11px] text-foreground/45">
            {formatPointValue(point.value)}
          </p>
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="rounded-lg bg-black/5 px-2 py-1 text-xs font-semibold text-foreground/70 hover:bg-black/10"
        >
          삭제
        </button>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <TextField
          label="이름"
          value={point.name}
          onChange={(name) => {
            onSelect();
            onPatch({ name });
          }}
        />
        <TextField
          label="값"
          value={point.inputRaw}
          onChange={(inputRaw) => {
            onSelect();
            const parsed = parseNumberLineValue(inputRaw);
            if (
              !parsed ||
              parsed.value < range.min - 1e-9 ||
              parsed.value > range.max + 1e-9
            ) {
              onPatch({ inputRaw });
              return;
            }
            onPatch({
              inputRaw,
              value: parsed.value,
              n: parsed.nHint,
            });
          }}
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <ChipToggle
          on={point.showName}
          onClick={() => {
            onSelect();
            onPatch({ showName: !point.showName });
          }}
        >
          이름
        </ChipToggle>
        <ChipToggle
          on={point.showValue}
          onClick={() => {
            onSelect();
            onPatch({ showValue: !point.showValue });
          }}
        >
          값 표시
        </ChipToggle>
        <ChipToggle
          on={point.showDivision}
          onClick={() => {
            onSelect();
            onPatch({ showDivision: !point.showDivision });
          }}
        >
          n등분
        </ChipToggle>
      </div>
      {point.showDivision ? (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <NumberField
            label="n등분"
            value={point.n ?? autoN ?? 4}
            onChange={(n) => {
              onSelect();
              onPatch({ n: Math.min(12, Math.max(2, Math.round(n))) });
            }}
            min={2}
            max={12}
            step={1}
            hint={point.n == null && autoN ? `자동 ${autoN}` : undefined}
          />
          <div>
            <p className="text-xs font-semibold text-foreground/60">등분 빗금</p>
            <div className="mt-1">
              <Segmented
                value={String(point.equalMarks)}
                onChange={(v) => {
                  onSelect();
                  onPatch({ equalMarks: Number(v) as EqualMarks });
                }}
                options={[
                  { id: "1", label: "1" },
                  { id: "2", label: "2" },
                  { id: "3", label: "3" },
                ]}
              />
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}
