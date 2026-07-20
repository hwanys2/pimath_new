"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CUBE_SIDE,
  CUBE_VOLUME,
  DEFAULT_N,
  EXACT_PYRAMID,
  MAX_N,
  MIN_N,
  TARGET_VOLUME,
  type ViewMode,
  clampN,
  computeStats,
  formatVolume,
} from "@/lib/pyramid-volume-math";

const PyramidVolumeScene = dynamic(
  () => import("@/components/sims/pyramid-volume/PyramidVolumeScene"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[320px] items-center justify-center rounded-2xl bg-cream/80 text-sm font-semibold text-wood/70 ring-1 ring-wood/10">
        3D 화면을 불러오는 중…
      </div>
    ),
  },
);

const LAYER_MS = 220;
const INSIGHT_N = 12;

function VolumeBar({
  label,
  volume,
  colorClass,
  sumText,
}: {
  label: string;
  volume: number;
  colorClass: string;
  sumText: string;
}) {
  const pct = Math.min(100, Math.max(0, (volume / CUBE_VOLUME) * 100));
  const targetPct = (TARGET_VOLUME / CUBE_VOLUME) * 100;

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-bold text-wood">{label}</p>
        <p className="text-sm font-semibold text-foreground/80">
          ≈ {formatVolume(volume)}
        </p>
      </div>
      <p className="text-xs font-medium leading-relaxed text-foreground/60">
        {sumText}
      </p>
      <div className="relative h-4 overflow-hidden rounded-full bg-wood/10">
        <div
          className={`absolute inset-y-0 left-0 rounded-full ${colorClass} transition-[width] duration-300`}
          style={{ width: `${pct}%` }}
        />
        <div
          className="absolute inset-y-0 w-0.5 bg-wood/80"
          style={{ left: `${targetPct}%` }}
          title="1000/3"
        />
      </div>
      <p className="text-[11px] font-semibold text-wood/70">
        목표선 = 1000 ÷ 3 ≈ {formatVolume(TARGET_VOLUME)}
      </p>
    </div>
  );
}

export default function PyramidVolumeBlocks() {
  const [n, setN] = useState(DEFAULT_N);
  const [viewMode, setViewMode] = useState<ViewMode>("outer");
  const [revealedLayers, setRevealedLayers] = useState(DEFAULT_N);
  const [playing, setPlaying] = useState(false);
  const [showCube, setShowCube] = useState(true);
  const [showPyramid, setShowPyramid] = useState(true);
  const [cameraResetKey, setCameraResetKey] = useState(0);
  const [hasStacked, setHasStacked] = useState(false);
  const [message, setMessage] = useState(
    "한 변 10인 정육면체(부피 1000) 안에 사각뿔을 두고, 층을 나눠 부피를 세어 보세요.",
  );

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stats = useMemo(() => computeStats(n), [n]);
  const viewModeRef = useRef(viewMode);
  viewModeRef.current = viewMode;

  const stopPlay = useCallback(() => {
    setPlaying(false);
    if (timerRef.current != null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPlay(), [stopPlay]);

  const applyN = useCallback(
    (raw: number) => {
      const next = clampN(raw);
      stopPlay();
      setN(next);
      setRevealedLayers(next);
      setMessage(
        `정육면체는 그대로 1000이에요. 높이를 ${next}층으로 나눠 바깥·안쪽 계단을 비교해 보세요.`,
      );
    },
    [stopPlay],
  );

  const startStack = useCallback(() => {
    stopPlay();
    setRevealedLayers(0);
    setPlaying(true);
    setMessage("아래에서부터 한 층씩 쌓고 있어요…");
    let layer = 0;
    const targetN = n;
    timerRef.current = setInterval(() => {
      layer += 1;
      setRevealedLayers(layer);
      if (layer >= targetN) {
        if (timerRef.current != null) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        setPlaying(false);
        setHasStacked(true);
        const s = computeStats(targetN);
        const mode = viewModeRef.current;
        if (mode === "inner") {
          setMessage(
            `안쪽 근사 ≈ ${formatVolume(s.inner)}. 정육면체 1000, 목표는 ≈ ${formatVolume(EXACT_PYRAMID)}이에요.`,
          );
        } else if (mode === "both") {
          setMessage(
            "바깥·안쪽을 함께 봤어요. 분할을 키우면 둘 다 ≈ 333.333에 가까워져요.",
          );
        } else {
          setMessage(
            `바깥쪽 근사 ≈ ${formatVolume(s.outer)}. 정육면체 1000, 목표는 ≈ ${formatVolume(EXACT_PYRAMID)}이에요.`,
          );
        }
      }
    }, LAYER_MS);
  }, [n, stopPlay]);

  const revealAll = useCallback(() => {
    stopPlay();
    setRevealedLayers(n);
    setMessage("모든 층을 한번에 보여 줄게요.");
  }, [n, stopPlay]);

  const reset = useCallback(() => {
    stopPlay();
    setN(DEFAULT_N);
    setViewMode("outer");
    setRevealedLayers(DEFAULT_N);
    setShowCube(true);
    setShowPyramid(true);
    setHasStacked(false);
    setCameraResetKey((k) => k + 1);
    setMessage(
      "한 변 10인 정육면체(부피 1000) 안에 사각뿔을 두고, 층을 나눠 부피를 세어 보세요.",
    );
  }, [stopPlay]);

  const onViewMode = useCallback(
    (mode: ViewMode) => {
      stopPlay();
      setViewMode(mode);
      setRevealedLayers(n);
      const s = computeStats(n);
      if (mode === "outer") {
        setMessage(`바깥쪽(상계): ${s.outerSumText}`);
      } else if (mode === "inner") {
        setMessage(`안쪽(하계): ${s.innerSumText}`);
      } else {
        setMessage(
          "바깥(민트)과 안쪽(하늘)을 함께 봐요. 참 부피 ≈ 333.333은 둘 사이에 있어요.",
        );
      }
    },
    [n, stopPlay],
  );

  const showInsight = n >= INSIGHT_N || hasStacked;

  return (
    <div className="flex flex-col gap-6">
      <section className="quest-card bg-gradient-to-br from-mint/35 to-sky/25 p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-bold text-wood">중1 · 3.4 입체도형의 성질</p>
          <span className="rounded-full bg-sky/55 px-2.5 py-0.5 text-xs font-bold text-wood">
            연습 · 점수 없음
          </span>
        </div>
        <h1 className="font-display mt-1 text-3xl text-foreground sm:text-4xl">
          블럭으로 보는 뿔의 부피
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-foreground/75 sm:text-base">
          한 변이{" "}
          <span className="font-semibold text-wood">{CUBE_SIDE}</span>인
          정육면체(부피{" "}
          <span className="font-semibold text-wood">{CUBE_VOLUME}</span>)는
          고정이에요. 높이만 n등분해서 바깥·안쪽 계단으로 사각뿔 부피를 세어
          보세요. 층을 잘게 나누면 둘 다{" "}
          <span className="font-semibold text-wood">
            ≈ {formatVolume(EXACT_PYRAMID)}
          </span>
          (1000의 1/3)에 다가가요.
        </p>

        <div className="mt-5 flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-sm font-semibold text-foreground/70">
            분할 수 n (층)
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={MIN_N}
                max={MAX_N}
                step={1}
                value={n}
                disabled={playing}
                onChange={(e) => applyN(Number(e.target.value))}
                className="w-40 accent-[#4DB6A0] disabled:opacity-50 sm:w-52"
              />
              <span className="min-w-[2.75rem] rounded-xl bg-white/80 px-2 py-2 text-center text-base font-bold text-foreground">
                {n}
              </span>
            </div>
          </label>

          <div className="flex flex-col gap-1 text-sm font-semibold text-foreground/70">
            보기
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["outer", "바깥쪽"],
                  ["inner", "안쪽"],
                  ["both", "둘 다"],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  disabled={playing}
                  onClick={() => onViewMode(mode)}
                  className={`rounded-xl px-3 py-2 text-sm font-bold disabled:opacity-50 ${
                    viewMode === mode
                      ? "bg-mint/80 text-wood ring-2 ring-wood/20"
                      : "bg-white/70 text-wood/80"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={playing ? stopPlay : startStack}
              className="rounded-xl bg-mint/70 px-4 py-2 text-sm font-bold text-wood"
            >
              {playing ? "멈춤" : "한 층씩 쌓기"}
            </button>
            <button
              type="button"
              onClick={revealAll}
              disabled={playing}
              className="rounded-xl bg-sky/60 px-4 py-2 text-sm font-bold text-wood disabled:opacity-50"
            >
              전부 보이기
            </button>
            <button
              type="button"
              onClick={() => setCameraResetKey((k) => k + 1)}
              disabled={playing}
              className="rounded-xl bg-wood/10 px-4 py-2 text-sm font-bold text-wood disabled:opacity-50"
            >
              카메라 리셋
            </button>
            <button
              type="button"
              onClick={reset}
              disabled={playing}
              className="rounded-xl bg-wood/10 px-4 py-2 text-sm font-bold text-wood disabled:opacity-50"
            >
              처음부터
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-4 text-sm font-semibold text-foreground/70">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={showCube}
              onChange={(e) => setShowCube(e.target.checked)}
              className="accent-[#8B5E3C]"
            />
            정육면체 윤곽
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={showPyramid}
              onChange={(e) => setShowPyramid(e.target.checked)}
              className="accent-[#FFD76A]"
            />
            사각뿔 윤곽
          </label>
        </div>
      </section>

      <section className="quest-card p-4 sm:p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-foreground/70">{message}</p>
          <p className="text-xs font-bold text-wood">
            분할 n = {n} · 층 {revealedLayers}/{n} · 정육면체 {CUBE_VOLUME}
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="min-h-[320px] overflow-hidden rounded-2xl bg-gradient-to-b from-[#FEF9F0] to-mint/15 ring-1 ring-wood/10 sm:min-h-[400px]">
            <PyramidVolumeScene
              n={n}
              viewMode={viewMode}
              revealedLayers={revealedLayers}
              showCube={showCube}
              showPyramid={showPyramid}
              cameraResetKey={cameraResetKey}
            />
          </div>

          <div className="flex flex-col gap-5 rounded-2xl bg-cream/60 p-4 ring-1 ring-wood/10 sm:p-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-wood/60">
                기둥(정육면체) · 고정
              </p>
              <p className="mt-1 font-display text-2xl text-wood">
                V = {CUBE_SIDE}³ = {CUBE_VOLUME}
              </p>
            </div>

            {(viewMode === "outer" || viewMode === "both") && (
              <VolumeBar
                label="바깥쪽 계단 (상계)"
                volume={stats.outer}
                colorClass="bg-mint/80"
                sumText={stats.outerSumText}
              />
            )}

            {(viewMode === "inner" || viewMode === "both") && (
              <VolumeBar
                label="안쪽 계단 (하계)"
                volume={stats.inner}
                colorClass="bg-sky/80"
                sumText={stats.innerSumText}
              />
            )}

            <div className="rounded-xl bg-white/70 px-3 py-3 text-sm leading-relaxed text-foreground/75">
              <p>
                참 부피(사각뿔) ={" "}
                <span className="font-bold text-wood">
                  {CUBE_VOLUME} ÷ 3 ≈ {formatVolume(stats.exact)}
                </span>
              </p>
              <p className="mt-1">
                안쪽 ≤ 뿔 ≤ 바깥쪽 →{" "}
                <span className="font-semibold">
                  {formatVolume(stats.inner)} ≤ {formatVolume(stats.exact)} ≤{" "}
                  {formatVolume(stats.outer)}
                </span>
              </p>
            </div>

            <div className="flex flex-wrap gap-3 text-xs font-bold">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm bg-[#7DD3B0]" />
                바깥쪽
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm bg-[#7EC8F5]" />
                안쪽
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm border-2 border-[#8B5E3C]" />
                정육면체
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm border-2 border-[#FFD76A] bg-[#FFD76A]/40" />
                사각뿔
              </span>
            </div>
          </div>
        </div>
      </section>

      {showInsight ? (
        <section
          className="quest-card border-mint/40 bg-gradient-to-br from-mint/45 via-sky/25 to-gold/25 p-5 sm:p-7"
          role="status"
          aria-live="polite"
        >
          <p className="font-display text-2xl text-wood sm:text-3xl">
            발견 · 뿔은 기둥의 1/3
          </p>
          <ol className="mt-4 space-y-3 text-sm leading-relaxed text-foreground/80 sm:text-base">
            <li>
              <span className="font-bold text-wood">1.</span> 정육면체 부피{" "}
              <span className="font-bold">{CUBE_VOLUME}</span>은 고정하고, 높이만
              n등분해 바깥·안쪽 계단으로 사각뿔을 끼워 넣어요. (구분구적법)
            </li>
            <li>
              <span className="font-bold text-wood">2.</span> n을 키울수록 바깥·안쪽
              부피가 모두{" "}
              <span className="font-bold">
                ≈ {formatVolume(EXACT_PYRAMID)}
              </span>
              에 가까워져요.
              {n >= INSIGHT_N
                ? ` 지금 n=${n}: 바깥 ≈ ${formatVolume(stats.outer)}, 안쪽 ≈ ${formatVolume(stats.inner)}.`
                : " 분할 수를 더 키워 보세요."}
            </li>
            <li>
              <span className="font-bold text-wood">3.</span> 따라서 같은 밑면과
              높이를 갖는 사각뿔의 부피는
              <br />
              <span className="mt-1 inline-block rounded-xl bg-white/70 px-3 py-2 font-bold text-wood">
                (1/3) × 밑넓이 × 높이 = 기둥 부피의 1/3
              </span>
            </li>
          </ol>
        </section>
      ) : (
        <section className="quest-card bg-mint/15 p-5 sm:p-6">
          <p className="text-sm font-bold text-wood">탐구 힌트</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground/75">
            <li>
              n=10일 때 바깥쪽은 100+81+…+1 = 385, 안쪽은 81+…+1 = 285, 정육면체는
              언제나 1000이에요.
            </li>
            <li>
              목표는 항상 ≈ {formatVolume(EXACT_PYRAMID)} (1000÷3). 막대의 목표선을
              보세요.
            </li>
            <li>분할을 키울수록 바깥·안쪽이 같은 값으로 모이는지 비교해 보세요.</li>
          </ul>
        </section>
      )}
    </div>
  );
}
