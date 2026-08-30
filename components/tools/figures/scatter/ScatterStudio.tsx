"use client";

import { Noto_Serif, Noto_Serif_KR } from "next/font/google";
import Link from "next/link";
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import {
  ChipToggle,
  InlineNumber,
  InlineText,
  Segmented,
  SliderField,
  TextField,
} from "@/components/tools/figures/controls";
import ScatterCanvas, {
  type ScatterSetter,
} from "@/components/tools/figures/scatter/ScatterCanvas";
import {
  canvasToPngBlob,
  copyPngToClipboard,
  downloadBlob,
} from "@/lib/diagrams/export-image";
import {
  clearCloud,
  cloneState,
  CLOUD_KIND_LABELS,
  DEFAULT_SCATTER_STATE,
  fitAxisToData,
  GRAPH_CYAN,
  GRAPH_INK,
  GRAPH_PINK,
  importPoints,
  labeledPoints,
  MAX_CLOUD,
  MAX_SPREAD,
  MIN_CLOUD,
  MIN_SPREAD,
  normalizeState,
  parsePointTable,
  patchPoint,
  removePoint,
  reshuffleCloud,
  SCATTER_PRESETS,
  setCloudCount,
  setCloudKind,
  setCloudSpread,
  setKind,
  setPanelKind,
  type CloudKind,
  type PointRole,
  type ScatterKind,
  type ScatterState,
} from "@/lib/diagrams/scatter/model";
import { buildScatterScene } from "@/lib/diagrams/scatter/scene";
import { renderSceneToCanvas, sceneToSvg } from "@/lib/diagrams/render";
import type { FontFaces } from "@/lib/diagrams/math-label";

const STORAGE_KEY = "pm-diagram-g3-scatter-v1";

const storeListeners = new Set<() => void>();

let cachedRaw: string | null = null;
let cachedState: ScatterState = DEFAULT_SCATTER_STATE;
let cacheReady = false;

function parseStoredState(raw: string | null): ScatterState {
  if (!raw) return DEFAULT_SCATTER_STATE;
  try {
    const parsed = JSON.parse(raw) as ScatterState;
    if (parsed && Array.isArray(parsed.points) && parsed.style) {
      return normalizeState(parsed);
    }
  } catch {
    /* keep default */
  }
  return DEFAULT_SCATTER_STATE;
}

function getServerSnapshot(): ScatterState {
  return DEFAULT_SCATTER_STATE;
}

function getClientSnapshot(): ScatterState {
  if (!cacheReady) {
    cacheReady = true;
    cachedRaw = window.localStorage.getItem(STORAGE_KEY);
    cachedState = parseStoredState(cachedRaw);
  }
  return cachedState;
}

function writeStoredState(state: ScatterState, persist = true) {
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

function useScatterState() {
  const state = useSyncExternalStore(
    subscribeStoredState,
    getClientSnapshot,
    getServerSnapshot,
  );
  const setState = useCallback<ScatterSetter>((updater, persist = true) => {
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

const POINT_COLORS = [
  { id: GRAPH_PINK, label: "분홍" },
  { id: GRAPH_CYAN, label: "청록" },
  { id: GRAPH_INK, label: "검정" },
];

const CLOUD_OPTIONS: { id: CloudKind; label: string }[] = [
  { id: "positive", label: "양의 상관" },
  { id: "negative", label: "음의 상관" },
  { id: "none", label: "상관 없음" },
  { id: "circle", label: "원형" },
];

const compactInputClass =
  "w-full min-w-0 rounded-xl border-2 border-wood/20 bg-white px-2 py-1.5 text-sm tabular-nums outline-none focus:border-wood";

function CompactNumber({
  label,
  value,
  onChange,
  min,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (Number.isFinite(value) ? String(value) : "");

  function commit(raw: string) {
    const n = Number(raw);
    if (raw.trim() === "" || !Number.isFinite(n)) {
      setDraft(null);
      return;
    }
    onChange(n);
    setDraft(null);
  }

  return (
    <label className="min-w-0">
      <span className="text-xs font-semibold text-foreground/60">{label}</span>
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        aria-label={label}
        value={shown}
        onChange={(e) => {
          const raw = e.target.value;
          setDraft(raw);
          if (raw.trim() === "" || raw.endsWith(".") || raw.endsWith("-")) return;
          const n = Number(raw);
          if (!Number.isFinite(n)) return;
          if (min != null && n < min) return;
          onChange(n);
        }}
        onBlur={() => commit(draft ?? shown)}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className={`mt-1 ${compactInputClass}`}
      />
    </label>
  );
}

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-foreground/60">{label}</p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {POINT_COLORS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onChange(c.id)}
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              value === c.id
                ? "bg-wood text-cream"
                : "bg-black/5 text-foreground/60 hover:bg-black/10"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ScatterStudio() {
  const [state, setState] = useScatterState();
  const [status, setStatus] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const [placeRole, setPlaceRole] = useState<PointRole>("named");
  const [paste, setPaste] = useState("");
  const fonts = useMemo(() => fontsFromNext(), []);

  const selected =
    state.points.find((p) => p.id === selectedId) ?? null;
  const labeled = labeledPoints(state);
  const cloudN = state.points.filter((p) => p.role === "cloud").length;

  const set = useCallback(
    (patch: Partial<ScatterState>) => {
      setState((prev) => normalizeState({ ...prev, ...patch }));
    },
    [setState],
  );

  async function exportPng() {
    await document.fonts.ready;
    const scene = buildScatterScene(state);
    const canvas = renderSceneToCanvas(
      scene,
      fonts,
      state.style.lineWidth,
      state.style.exportScale,
    );
    const blob = await canvasToPngBlob(canvas);
    downloadBlob(blob, "산점도.png");
    setStatus("PNG를 저장했어요.");
  }

  async function copyPng() {
    await document.fonts.ready;
    const scene = buildScatterScene(state);
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
    const scene = buildScatterScene(state);
    const svg = sceneToSvg(scene, fonts, state.style.lineWidth);
    downloadBlob(
      new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
      "산점도.svg",
    );
    setStatus("SVG를 저장했어요.");
  }

  const canXBreak = state.xMin > 1e-9;
  const canYBreak = state.yMin > 1e-9;

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
            산점도
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-foreground/65">
            상관 구름을 뿌리고 점을 찍어 시험용 산점도를 바로 그립니다. 축 끊기,
            이름 붙인 점, 상관 비교(2×2)까지 PNG로 저장하세요.
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
            <ScatterCanvas
              state={state}
              fonts={fonts}
              selectedId={selected?.id ?? null}
              placing={placing}
              placeRole={placeRole}
              setState={setState}
              persist={persistCachedState}
              onSelect={setSelectedId}
              onDeleteSelected={() => {
                if (!selectedId) return;
                setState((prev) => removePoint(prev, selectedId));
                setSelectedId(null);
              }}
              onPlaced={setSelectedId}
            />
          </div>

          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <h2 className="font-display text-sm text-wood-dark">그림·축</h2>
            <div className="mt-2">
              <Segmented<ScatterKind>
                value={state.kind}
                onChange={(kind) => {
                  setState((prev) => setKind(prev, kind));
                  setSelectedId(null);
                }}
                options={[
                  { id: "single", label: "산점도" },
                  { id: "quad", label: "상관 비교" },
                ]}
              />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-2">
              <div className="col-span-2">
                <p className="text-xs font-semibold text-foreground/60">가로</p>
                <div className="mt-1 grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
                  <input
                    type="number"
                    aria-label="가로 시작"
                    value={Number.isFinite(state.xMin) ? state.xMin : 0}
                    step={state.xTick}
                    onChange={(e) => set({ xMin: Number(e.target.value) })}
                    className={compactInputClass}
                  />
                  <span className="text-sm text-foreground/40">~</span>
                  <input
                    type="number"
                    aria-label="가로 끝"
                    value={Number.isFinite(state.xMax) ? state.xMax : 0}
                    step={state.xTick}
                    onChange={(e) => set({ xMax: Number(e.target.value) })}
                    className={compactInputClass}
                  />
                </div>
              </div>
              <div className="col-span-2">
                <p className="text-xs font-semibold text-foreground/60">세로</p>
                <div className="mt-1 grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
                  <input
                    type="number"
                    aria-label="세로 시작"
                    value={Number.isFinite(state.yMin) ? state.yMin : 0}
                    step={state.yTick}
                    onChange={(e) => set({ yMin: Number(e.target.value) })}
                    className={compactInputClass}
                  />
                  <span className="text-sm text-foreground/40">~</span>
                  <input
                    type="number"
                    aria-label="세로 끝"
                    value={Number.isFinite(state.yMax) ? state.yMax : 0}
                    step={state.yTick}
                    onChange={(e) => set({ yMax: Number(e.target.value) })}
                    className={compactInputClass}
                  />
                </div>
              </div>
              <CompactNumber
                label="가로 눈금"
                value={state.xTick}
                onChange={(xTick) => set({ xTick })}
                min={0.01}
              />
              <CompactNumber
                label="세로 눈금"
                value={state.yTick}
                onChange={(yTick) => set({ yTick })}
                min={0.01}
              />
              <CompactNumber
                label="가로 격자"
                value={state.xGrid}
                onChange={(xGrid) => set({ xGrid })}
                min={0.01}
              />
              <CompactNumber
                label="세로 격자"
                value={state.yGrid}
                onChange={(yGrid) => set({ yGrid })}
                min={0.01}
              />
              <label className="min-w-0">
                <span className="text-xs font-semibold text-foreground/60">
                  가로축
                </span>
                <input
                  type="text"
                  aria-label="가로축 이름"
                  value={state.xAxisLabel}
                  placeholder="수심(m)"
                  onChange={(e) => set({ xAxisLabel: e.target.value })}
                  className="mt-1 w-full min-w-0 rounded-xl border-2 border-wood/20 bg-white px-2 py-1.5 text-sm outline-none focus:border-wood"
                />
              </label>
              <label className="min-w-0">
                <span className="text-xs font-semibold text-foreground/60">
                  세로축
                </span>
                <input
                  type="text"
                  aria-label="세로축 이름"
                  value={state.yAxisLabel}
                  placeholder="가격(원)"
                  onChange={(e) => set({ yAxisLabel: e.target.value })}
                  className="mt-1 w-full min-w-0 rounded-xl border-2 border-wood/20 bg-white px-2 py-1.5 text-sm outline-none focus:border-wood"
                />
              </label>
              <p className="col-span-2 text-[11px] text-foreground/45">
                세로가 0보다 크면 y축을 끊을 수 있어요. 축 이름은 그림에서 끌어
                옮깁니다.
              </p>
              <button
                type="button"
                onClick={() => setState((prev) => fitAxisToData(prev))}
                className="col-span-2 rounded-xl bg-black/5 px-2.5 py-1.5 text-xs font-semibold text-foreground/70 hover:bg-black/10"
              >
                축을 점에 맞추기
              </button>
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <h2 className="font-display text-sm text-wood-dark">구름</h2>
            {state.kind === "single" ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {CLOUD_OPTIONS.map((opt) => (
                  <ChipToggle
                    key={opt.id}
                    on={state.cloudKind === opt.id}
                    onClick={() =>
                      setState((prev) => setCloudKind(prev, opt.id))
                    }
                  >
                    {opt.label}
                  </ChipToggle>
                ))}
              </div>
            ) : (
              <div className="mt-2 space-y-1.5">
                {state.panelKinds.map((kind, i) => (
                  <div key={i}>
                    <p className="text-[11px] font-semibold text-foreground/50">
                      ({i + 1}) {CLOUD_KIND_LABELS[kind]}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {CLOUD_OPTIONS.map((opt) => (
                        <ChipToggle
                          key={opt.id}
                          on={kind === opt.id}
                          onClick={() =>
                            setState((prev) => setPanelKind(prev, i, opt.id))
                          }
                        >
                          {opt.label.replace(" 상관", "")}
                        </ChipToggle>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3">
              <SliderField
                label="점 개수"
                value={state.cloudCount}
                onChange={(n) => setState((prev) => setCloudCount(prev, n))}
                min={MIN_CLOUD}
                max={MAX_CLOUD}
                step={1}
              />
            </div>
            <div className="mt-2">
              <SliderField
                label="퍼짐"
                value={Math.round(state.cloudSpread * 100)}
                onChange={(n) =>
                  setState((prev) => setCloudSpread(prev, n / 100))
                }
                min={Math.round(MIN_SPREAD * 100)}
                max={Math.round(MAX_SPREAD * 100)}
                step={1}
                display={`${Math.round(state.cloudSpread * 100)}`}
              />
            </div>
            <p className="mt-1 text-[11px] text-foreground/45">
              지금 구름 {cloudN}개. 퍼짐이 작을수록 상관이 뚜렷해요.
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setState((prev) => reshuffleCloud(prev))}
                className="rounded-full bg-black/5 px-2.5 py-1 text-xs font-semibold text-foreground/60 hover:bg-black/10"
              >
                다시 뿌리기
              </button>
              {cloudN > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setState((prev) => clearCloud(prev));
                    setSelectedId(null);
                  }}
                  className="rounded-full bg-black/5 px-2.5 py-1 text-xs font-semibold text-foreground/60 hover:bg-black/10"
                >
                  구름 지우기
                </button>
              ) : null}
            </div>
          </section>

          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <h2 className="font-display text-sm text-wood-dark">점</h2>
            <div className="mt-2">
              <Segmented<PointRole>
                value={placeRole === "mark" ? "mark" : "named"}
                onChange={(role) => setPlaceRole(role)}
                options={[
                  { id: "named", label: "이름점" },
                  { id: "mark", label: "강조 A·B" },
                ]}
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <ChipToggle on={placing} onClick={() => setPlacing((v) => !v)}>
                점 찍기
              </ChipToggle>
            </div>
            <p className="mt-1.5 text-[11px] text-foreground/45">
              {placing
                ? "그림 빈 곳을 누르면 점이 생깁니다. 강조점은 A, B, C…"
                : "점을 끌어 옮기고, 글자를 눌러 이름을 고칩니다."}
            </p>
            {labeled.length > 0 ? (
              <div className="mt-2 flex max-h-36 flex-col gap-1 overflow-y-auto">
                {labeled.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedId(p.id)}
                    className={`rounded-lg px-2 py-1 text-left text-xs font-semibold ${
                      selected?.id === p.id
                        ? "bg-wood text-cream"
                        : "bg-black/5 text-foreground/65 hover:bg-black/10"
                    }`}
                  >
                    {p.label.trim() || (p.role === "mark" ? "강조점" : "이름점")}
                    <span className="ml-1 font-normal opacity-70">
                      ({p.x}, {p.y})
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-[11px] text-foreground/45">
                이름 있는 점이 없어요. 찍거나 아래 표를 붙여 넣으세요.
              </p>
            )}
            {selected ? (
              <div className="mt-2 space-y-1.5 border-t border-wood/10 pt-2">
                <InlineText
                  ariaLabel="점 이름"
                  value={selected.label}
                  placeholder="이름"
                  onChange={(label) =>
                    setState((prev) => patchPoint(prev, selected.id, { label }))
                  }
                />
                <div className="flex gap-1.5">
                  <label className="flex min-w-0 flex-1 items-center gap-1 text-xs font-semibold text-foreground/55">
                    x
                    <InlineNumber
                      ariaLabel="점 x"
                      value={selected.x}
                      step={state.xGrid >= 1 ? 1 : state.xGrid}
                      className="min-w-0 flex-1"
                      onChange={(x) =>
                        setState((prev) => patchPoint(prev, selected.id, { x }))
                      }
                    />
                  </label>
                  <label className="flex min-w-0 flex-1 items-center gap-1 text-xs font-semibold text-foreground/55">
                    y
                    <InlineNumber
                      ariaLabel="점 y"
                      value={selected.y}
                      step={state.yGrid >= 1 ? 1 : state.yGrid}
                      className="min-w-0 flex-1"
                      onChange={(y) =>
                        setState((prev) => patchPoint(prev, selected.id, { y }))
                      }
                    />
                  </label>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <ChipToggle
                    on={selected.role === "named"}
                    onClick={() =>
                      setState((prev) =>
                        patchPoint(prev, selected.id, { role: "named" }),
                      )
                    }
                  >
                    이름점
                  </ChipToggle>
                  <ChipToggle
                    on={selected.role === "mark"}
                    onClick={() =>
                      setState((prev) =>
                        patchPoint(prev, selected.id, { role: "mark" }),
                      )
                    }
                  >
                    강조
                  </ChipToggle>
                  <button
                    type="button"
                    onClick={() => {
                      setState((prev) => removePoint(prev, selected.id));
                      setSelectedId(null);
                    }}
                    className="rounded-full bg-black/5 px-2.5 py-1 text-xs font-semibold text-foreground/60 hover:bg-black/10"
                  >
                    지우기
                  </button>
                </div>
              </div>
            ) : null}
            <label className="mt-2 block">
              <span className="text-xs font-semibold text-foreground/60">
                표 붙여넣기
              </span>
              <textarea
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
                placeholder={"소고기뭇국 80 2.2\n돈가스 280 18"}
                rows={3}
                className="mt-1 w-full rounded-xl border-2 border-wood/20 bg-white px-2 py-1.5 text-xs outline-none focus:border-wood"
              />
            </label>
            <button
              type="button"
              onClick={() => {
                const rows = parsePointTable(paste);
                if (rows.length === 0) {
                  setStatus("이름 x y 형식으로 붙여 넣어 주세요.");
                  return;
                }
                setState((prev) => importPoints(prev, rows));
                setPaste("");
                setStatus(`${rows.length}개 점을 넣었어요.`);
              }}
              className="mt-1.5 rounded-xl bg-black/5 px-2.5 py-1.5 text-xs font-semibold text-foreground/70 hover:bg-black/10"
            >
              점 넣기
            </button>
          </section>

          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <h2 className="font-display text-sm text-wood-dark">표시</h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <ChipToggle
                on={state.showGrid}
                onClick={() => set({ showGrid: !state.showGrid })}
              >
                격자
              </ChipToggle>
              <ChipToggle
                on={state.showTicks}
                onClick={() => set({ showTicks: !state.showTicks })}
              >
                눈금 숫자
              </ChipToggle>
              <ChipToggle
                on={state.showOrigin}
                onClick={() => set({ showOrigin: !state.showOrigin })}
              >
                원점 O
              </ChipToggle>
              <ChipToggle
                on={state.yBreak && canYBreak}
                onClick={() => {
                  if (!canYBreak) return;
                  set({ yBreak: !state.yBreak });
                }}
              >
                y축 끊기
              </ChipToggle>
              <ChipToggle
                on={state.xBreak && canXBreak}
                onClick={() => {
                  if (!canXBreak) return;
                  set({ xBreak: !state.xBreak });
                }}
              >
                x축 끊기
              </ChipToggle>
              <ChipToggle
                on={state.yLabelVertical}
                onClick={() => set({ yLabelVertical: !state.yLabelVertical })}
              >
                세로축 세로쓰기
              </ChipToggle>
              {state.kind === "quad" ? (
                <ChipToggle
                  on={state.showPanelNumbers}
                  onClick={() =>
                    set({ showPanelNumbers: !state.showPanelNumbers })
                  }
                >
                  (1)~(4)
                </ChipToggle>
              ) : null}
              <ChipToggle
                on={state.showTitle}
                onClick={() => set({ showTitle: !state.showTitle })}
              >
                제목
              </ChipToggle>
            </div>
            {state.showTitle ? (
              <div className="mt-2">
                <TextField
                  label="제목"
                  value={state.title}
                  onChange={(title) => set({ title, showTitle: true })}
                  placeholder="예: 수심과 용존 산소량"
                />
              </div>
            ) : null}
            {!canYBreak ? (
              <p className="mt-2 text-[11px] text-foreground/45">
                세로 시작이 0보다 클 때 y축을 끊을 수 있어요.
              </p>
            ) : null}
            <div className="mt-3 space-y-2">
              <ColorRow
                label="점 색"
                value={state.pointColor}
                onChange={(pointColor) => set({ pointColor })}
              />
              <ColorRow
                label="강조점 색"
                value={state.markColor}
                onChange={(markColor) => set({ markColor })}
              />
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-3.5">
            <h2 className="font-display text-sm text-wood-dark">빠른 그림</h2>
            <div className="mt-2 grid grid-cols-1 gap-1.5">
              {SCATTER_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    const next = cloneState(preset.state);
                    setState(next);
                    setSelectedId(
                      labeledPoints(next)[0]?.id ?? null,
                    );
                    setPlacing(false);
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
                label="눈금 글자"
                value={state.style.fontSize}
                onChange={(fontSize) =>
                  set({ style: { ...state.style, fontSize } })
                }
                min={10}
                max={28}
                step={1}
              />
              <SliderField
                label="점 이름"
                value={state.style.pointLabelSize}
                onChange={(pointLabelSize) =>
                  set({ style: { ...state.style, pointLabelSize } })
                }
                min={12}
                max={36}
                step={1}
              />
              <SliderField
                label="축 이름"
                value={state.style.axisNameSize}
                onChange={(axisNameSize) =>
                  set({ style: { ...state.style, axisNameSize } })
                }
                min={12}
                max={36}
                step={1}
              />
              <SliderField
                label="제목"
                value={state.style.titleSize}
                onChange={(titleSize) =>
                  set({ style: { ...state.style, titleSize } })
                }
                min={12}
                max={40}
                step={1}
              />
              <SliderField
                label="점 크기"
                value={state.style.pointRadius}
                onChange={(pointRadius) =>
                  set({ style: { ...state.style, pointRadius } })
                }
                min={1.4}
                max={8}
                step={0.1}
                display={state.style.pointRadius.toFixed(1)}
              />
              <SliderField
                label="강조점"
                value={state.style.markRadius}
                onChange={(markRadius) =>
                  set({ style: { ...state.style, markRadius } })
                }
                min={2}
                max={10}
                step={0.1}
                display={state.style.markRadius.toFixed(1)}
              />
              <SliderField
                label="선 굵기"
                value={state.style.lineWidth}
                onChange={(lineWidth) =>
                  set({ style: { ...state.style, lineWidth } })
                }
                min={1}
                max={3}
                step={0.1}
                display={state.style.lineWidth.toFixed(1)}
              />
              <SliderField
                label="여백"
                value={state.style.padding}
                onChange={(padding) =>
                  set({ style: { ...state.style, padding } })
                }
                min={40}
                max={120}
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
          </details>
        </div>
      </div>
    </div>
  );
}
