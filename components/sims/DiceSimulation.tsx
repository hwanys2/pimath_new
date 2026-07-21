"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createConvergenceSeries,
  createTally,
  DICE,
  DIE_FACES,
  formatPercent,
  formatProbability,
  recordConvergencePoint,
  relativeFrequency,
  rollDie,
  tallyTotal,
  theoreticalProbability,
  type ConvergenceSeries,
  type DiceType,
  type DieFace,
  type Tally,
} from "@/lib/dice-simulation-math";

const DICE_TYPES: DiceType[] = ["fair", "cuboid"];

/** 자동 굴리기가 무한히 돌지 않도록 상한. */
const AUTO_MAX_TRIALS = 100000;

/** 현재 시행 횟수에 따라 자동 굴리기 한 프레임당 굴리는 개수(점점 빨라짐). */
function autoBatchSize(total: number): number {
  if (total < 40) return 1;
  if (total < 200) return 4;
  if (total < 1000) return 15;
  if (total < 5000) return 50;
  return 150;
}

// ── 수렴 그래프 좌표계 ──────────────────────────────────────────
const LC_W = 640;
const LC_H = 300;
const LC_PAD_L = 52;
const LC_PAD_R = 18;
const LC_PAD_T = 18;
const LC_PAD_B = 40;
const LC_PLOT_W = LC_W - LC_PAD_L - LC_PAD_R;
const LC_PLOT_H = LC_H - LC_PAD_T - LC_PAD_B;

// ── 분포 막대그래프 좌표계 ──────────────────────────────────────
const BC_W = 640;
const BC_H = 300;
const BC_PAD_L = 52;
const BC_PAD_R = 18;
const BC_PAD_T = 18;
const BC_PAD_B = 40;
const BC_PLOT_W = BC_W - BC_PAD_L - BC_PAD_R;
const BC_PLOT_H = BC_H - BC_PAD_T - BC_PAD_B;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** 주사위 눈별 pip(점) 위치. 0~1 정규화 좌표. */
const PIP_LAYOUT: Record<DieFace, Array<[number, number]>> = {
  1: [[0.5, 0.5]],
  2: [
    [0.28, 0.28],
    [0.72, 0.72],
  ],
  3: [
    [0.28, 0.28],
    [0.5, 0.5],
    [0.72, 0.72],
  ],
  4: [
    [0.28, 0.28],
    [0.72, 0.28],
    [0.28, 0.72],
    [0.72, 0.72],
  ],
  5: [
    [0.28, 0.28],
    [0.72, 0.28],
    [0.5, 0.5],
    [0.28, 0.72],
    [0.72, 0.72],
  ],
  6: [
    [0.3, 0.26],
    [0.7, 0.26],
    [0.3, 0.5],
    [0.7, 0.5],
    [0.3, 0.74],
    [0.7, 0.74],
  ],
};

function DieFaceGraphic({
  face,
  diceType,
  bounceKey,
}: {
  face: DieFace | null;
  diceType: DiceType;
  bounceKey: number;
}) {
  // 직육면체는 살짝 납작한 비율로 표현.
  const w = 96;
  const h = diceType === "cuboid" ? 66 : 96;
  const pipR = diceType === "cuboid" ? 6 : 8;

  return (
    <div
      key={bounceKey}
      className="dice-bounce"
      style={{ width: 96, height: 96, display: "grid", placeItems: "center" }}
    >
      <svg
        viewBox={`0 0 ${w} ${h}`}
        width={w}
        height={h}
        role="img"
        aria-label={face ? `주사위 눈 ${face}` : "아직 굴리지 않음"}
      >
        <rect
          x={2}
          y={2}
          width={w - 4}
          height={h - 4}
          rx={14}
          fill="#fff"
          stroke="rgba(92,64,51,0.35)"
          strokeWidth={3}
        />
        {face
          ? PIP_LAYOUT[face].map(([px, py], i) => (
              <circle
                key={i}
                cx={px * w}
                cy={py * h}
                r={pipR}
                fill="#5C4033"
              />
            ))
          : null}
      </svg>
    </div>
  );
}

export default function DiceSimulation() {
  const [diceType, setDiceType] = useState<DiceType>("fair");
  const [targetFace, setTargetFace] = useState<DieFace>(1);
  const [tally, setTally] = useState<Tally>(() => createTally());
  const [series, setSeries] = useState<ConvergenceSeries>(() =>
    createConvergenceSeries(),
  );
  const [lastRoll, setLastRoll] = useState<DieFace | null>(null);
  const [autoRunning, setAutoRunning] = useState(false);
  const [bounceKey, setBounceKey] = useState(0);

  // rAF 루프에서 최신 값을 참조하기 위한 refs.
  const tallyRef = useRef<Tally>(tally);
  const seriesRef = useRef<ConvergenceSeries>(series);
  const diceTypeRef = useRef<DiceType>(diceType);
  const targetFaceRef = useRef<DieFace>(targetFace);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    diceTypeRef.current = diceType;
  }, [diceType]);
  useEffect(() => {
    targetFaceRef.current = targetFace;
  }, [targetFace]);

  const total = tallyTotal(tally);
  const theoretical = theoreticalProbability(diceType, targetFace);
  const relFreq = relativeFrequency(tally, targetFace);
  const targetHits = tally[targetFace];

  const stopAuto = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setAutoRunning(false);
  }, []);

  const resetAll = useCallback(() => {
    stopAuto();
    const freshTally = createTally();
    const freshSeries = createConvergenceSeries();
    tallyRef.current = freshTally;
    seriesRef.current = freshSeries;
    setTally(freshTally);
    setSeries(freshSeries);
    setLastRoll(null);
  }, [stopAuto]);

  /** count번 굴려 상태를 갱신. bounce=true면 주사위 흔들림 애니메이션 재생. */
  const applyRolls = useCallback((count: number, bounce: boolean) => {
    const t = tallyRef.current;
    const type = diceTypeRef.current;
    let last: DieFace | null = null;
    for (let i = 0; i < count; i += 1) {
      const face = rollDie(type);
      t[face] += 1;
      last = face;
    }
    const newTotal = tallyTotal(t);
    const rf = relativeFrequency(t, targetFaceRef.current);
    seriesRef.current = recordConvergencePoint(seriesRef.current, newTotal, rf);

    setTally({ ...t });
    setSeries(seriesRef.current);
    if (last != null) setLastRoll(last);
    if (bounce) setBounceKey((k) => k + 1);
  }, []);

  const handleManualRoll = useCallback(
    (count: number) => {
      if (autoRunning) return;
      applyRolls(count, count === 1);
    },
    [applyRolls, autoRunning],
  );

  const toggleAuto = useCallback(() => {
    if (autoRunning) {
      stopAuto();
      return;
    }
    setAutoRunning(true);
    const step = () => {
      const currentTotal = tallyTotal(tallyRef.current);
      if (currentTotal >= AUTO_MAX_TRIALS) {
        stopAuto();
        return;
      }
      const batch = autoBatchSize(currentTotal);
      applyRolls(batch, batch === 1);
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  }, [applyRolls, autoRunning, stopAuto]);

  // 언마운트 시 rAF 정리.
  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const handleDiceTypeChange = useCallback(
    (type: DiceType) => {
      if (type === diceType) return;
      stopAuto();
      setDiceType(type);
      diceTypeRef.current = type;
      // 주사위가 바뀌면 새로운 실험이므로 초기화.
      const freshTally = createTally();
      const freshSeries = createConvergenceSeries();
      tallyRef.current = freshTally;
      seriesRef.current = freshSeries;
      setTally(freshTally);
      setSeries(freshSeries);
      setLastRoll(null);
    },
    [diceType, stopAuto],
  );

  const handleTargetChange = useCallback(
    (face: DieFace) => {
      if (face === targetFace) return;
      stopAuto();
      setTargetFace(face);
      targetFaceRef.current = face;
      // 관찰 대상이 바뀌면 상대도수 그래프를 새로 그리기 위해 초기화.
      const freshTally = createTally();
      const freshSeries = createConvergenceSeries();
      tallyRef.current = freshTally;
      seriesRef.current = freshSeries;
      setTally(freshTally);
      setSeries(freshSeries);
      setLastRoll(null);
    },
    [targetFace, stopAuto],
  );

  // ── 수렴 그래프 계산 ────────────────────────────────────────
  const lineChart = useMemo(() => {
    const yMax = clamp(theoretical * 3, 0.4, 1);
    const denomTrials = Math.max(total, 1);

    const xFor = (trials: number) =>
      LC_PAD_L + (trials / denomTrials) * LC_PLOT_W;
    const yFor = (rf: number) =>
      LC_PAD_T + (1 - clamp(rf, 0, yMax) / yMax) * LC_PLOT_H;

    const polyline = series.points
      .map((p) => `${xFor(p.trials).toFixed(1)},${yFor(p.relFreq).toFixed(1)}`)
      .join(" ");

    const theoreticalY = yFor(theoretical);

    const yTicks = [0, yMax / 2, yMax].map((v) => ({
      v,
      y: yFor(v),
      label: formatPercent(v, 0),
    }));

    return { yMax, xFor, yFor, polyline, theoreticalY, yTicks, denomTrials };
  }, [series, theoretical, total]);

  // ── 분포 막대그래프 계산 ────────────────────────────────────
  const barChart = useMemo(() => {
    const probs = DICE[diceType].probabilities;
    const observed = DIE_FACES.map((f) => relativeFrequency(tally, f));
    const maxObserved = Math.max(...observed, 0);
    const maxTheoretical = Math.max(...DIE_FACES.map((f) => probs[f]));
    const yMax = clamp(Math.max(maxObserved, maxTheoretical) * 1.25, 0.3, 1);

    const bandW = BC_PLOT_W / DIE_FACES.length;
    const barW = bandW * 0.54;

    const yFor = (v: number) =>
      BC_PAD_T + (1 - clamp(v, 0, yMax) / yMax) * BC_PLOT_H;

    const bars = DIE_FACES.map((f, i) => {
      const cx = BC_PAD_L + bandW * i + bandW / 2;
      const obs = observed[i];
      const th = probs[f];
      const yObs = yFor(obs);
      return {
        face: f,
        cx,
        x: cx - barW / 2,
        barW,
        yObs,
        heightObs: BC_PAD_T + BC_PLOT_H - yObs,
        yTheoretical: yFor(th),
        observed: obs,
        theoretical: th,
        count: tally[f],
      };
    });

    const yTicks = [0, yMax / 2, yMax].map((v) => ({
      v,
      y: yFor(v),
      label: formatPercent(v, 0),
    }));

    const baseline = BC_PAD_T + BC_PLOT_H;
    return { yMax, bars, yTicks, baseline };
  }, [diceType, tally]);

  const diffAbs = Math.abs(relFreq - theoretical);

  return (
    <div className="flex flex-col gap-6">
      {/* 인트로 */}
      <section className="quest-card bg-gradient-to-br from-peach/40 to-gold/25 p-5 sm:p-7">
        <p className="text-sm font-bold text-wood">중2 · 4. 경우의 수와 확률</p>
        <h1 className="font-display mt-1 text-3xl text-foreground sm:text-4xl">
          주사위 확률 시뮬레이션
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-foreground/75 sm:text-base">
          주사위를 여러 번 굴리면 어떤 눈이 나온 <b>상대도수</b>가 점점{" "}
          <b>이론적 확률(수학적 확률)</b>에 가까워져요. 시행 횟수를 늘려 가며 그래프가
          어떻게 수렴하는지 눈으로 확인해 보세요. 점수는 없는 개념 탐구용
          시뮬레이션입니다.
        </p>
      </section>

      {/* 컨트롤 */}
      <section className="quest-card p-5 sm:p-7">
        <div className="grid gap-6 lg:grid-cols-2">
          {/* 주사위 종류 */}
          <div>
            <p className="mb-2 text-sm font-bold text-wood">주사위 종류</p>
            <div className="flex flex-wrap gap-2">
              {DICE_TYPES.map((type) => {
                const active = diceType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleDiceTypeChange(type)}
                    aria-pressed={active}
                    className={`rounded-2xl px-4 py-2.5 text-sm font-bold transition ${
                      active
                        ? "bg-peach text-wood shadow-sm ring-2 ring-wood/20"
                        : "bg-white/70 text-foreground/70 ring-1 ring-wood/15 hover:bg-peach/30"
                    }`}
                  >
                    {DICE[type].name}
                  </button>
                );
              })}
            </div>
            <p className="mt-3 rounded-xl bg-peach/15 px-4 py-3 text-xs leading-relaxed text-foreground/75">
              {DICE[diceType].description}
            </p>
          </div>

          {/* 관찰할 눈 */}
          <div>
            <p className="mb-2 text-sm font-bold text-wood">관찰할 눈</p>
            <div className="flex flex-wrap gap-2">
              {DIE_FACES.map((face) => {
                const active = targetFace === face;
                return (
                  <button
                    key={face}
                    type="button"
                    onClick={() => handleTargetChange(face)}
                    aria-pressed={active}
                    className={`h-11 w-11 rounded-xl text-lg font-bold transition ${
                      active
                        ? "bg-gold text-wood shadow-sm ring-2 ring-wood/25"
                        : "bg-white/70 text-foreground/70 ring-1 ring-wood/15 hover:bg-gold/30"
                    }`}
                  >
                    {face}
                  </button>
                );
              })}
            </div>
            <p className="mt-3 rounded-xl bg-gold/15 px-4 py-3 text-xs leading-relaxed text-foreground/75">
              눈 <b>{targetFace}</b>이(가) 나올 이론적 확률은{" "}
              <b>{formatProbability(diceType, targetFace)}</b> ={" "}
              <b>{formatPercent(theoretical, 2)}</b> 입니다.
            </p>
          </div>
        </div>

        {/* 굴리기 버튼 */}
        <div className="mt-6 flex flex-col items-center gap-4">
          <DieFaceGraphic
            face={lastRoll}
            diceType={diceType}
            bounceKey={bounceKey}
          />
          <p className="text-sm font-semibold text-foreground/70">
            {lastRoll
              ? `방금 나온 눈: ${lastRoll}`
              : "버튼을 눌러 주사위를 굴려 보세요"}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {[1, 10, 100].map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => handleManualRoll(count)}
                disabled={autoRunning}
                className="rounded-2xl bg-wood px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-wood/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {count}번 굴리기
              </button>
            ))}
            <button
              type="button"
              onClick={toggleAuto}
              className={`rounded-2xl px-5 py-2.5 text-sm font-bold shadow-sm transition ${
                autoRunning
                  ? "bg-[#a63a1a] text-white hover:opacity-90"
                  : "bg-peach text-wood ring-2 ring-wood/20 hover:bg-peach/80"
              }`}
            >
              {autoRunning ? "자동 멈춤" : "자동 굴리기"}
            </button>
            <button
              type="button"
              onClick={resetAll}
              className="rounded-2xl bg-white/70 px-5 py-2.5 text-sm font-bold text-foreground/70 ring-1 ring-wood/15 transition hover:bg-white"
            >
              초기화
            </button>
          </div>
        </div>
      </section>

      {/* 통계 요약 */}
      <section className="quest-card p-5 sm:p-7">
        <p className="mb-4 text-sm font-bold text-wood">
          눈 {targetFace} 관찰 결과
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatBox label="총 시행 횟수" value={total.toLocaleString()} />
          <StatBox
            label={`눈 ${targetFace}이 나온 횟수`}
            value={targetHits.toLocaleString()}
          />
          <StatBox
            label="상대도수"
            value={total === 0 ? "-" : formatPercent(relFreq, 2)}
            highlight
          />
          <StatBox
            label="이론적 확률"
            value={formatPercent(theoretical, 2)}
          />
          <StatBox
            label="차이(오차)"
            value={total === 0 ? "-" : formatPercent(diffAbs, 2)}
          />
        </div>
        <p className="mt-4 text-xs leading-relaxed text-foreground/60">
          상대도수 = (눈 {targetFace}이 나온 횟수) ÷ (총 시행 횟수). 시행 초반에는
          이론적 확률과 차이가 크게 요동치지만, 시행 횟수가 많아질수록 그 차이가
          점점 줄어들며 이론적 확률에 수렴합니다. 이것을 <b>큰 수의 법칙</b>이라고
          해요.
        </p>
      </section>

      {/* 수렴 그래프 */}
      <section className="quest-card p-5 sm:p-7">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-bold text-wood">
            상대도수의 수렴 그래프
          </p>
          <p className="text-xs font-semibold text-foreground/60">
            가로: 시행 횟수 · 세로: 눈 {targetFace}의 상대도수
          </p>
        </div>
        <div className="overflow-hidden rounded-2xl bg-gradient-to-b from-[#FEF9F0] to-peach/15 ring-1 ring-wood/10">
          <svg
            viewBox={`0 0 ${LC_W} ${LC_H}`}
            className="mx-auto h-auto w-full"
            role="img"
            aria-label="시행 횟수에 따른 상대도수의 변화를 나타낸 꺾은선 그래프"
          >
            {/* y축 눈금 + 격자 */}
            {lineChart.yTicks.map((tick) => (
              <g key={tick.v}>
                <line
                  x1={LC_PAD_L}
                  y1={tick.y}
                  x2={LC_W - LC_PAD_R}
                  y2={tick.y}
                  stroke="rgba(92,64,51,0.12)"
                  strokeWidth={1}
                />
                <text
                  x={LC_PAD_L - 8}
                  y={tick.y + 4}
                  textAnchor="end"
                  className="fill-[#5C4033]"
                  fontSize={12}
                >
                  {tick.label}
                </text>
              </g>
            ))}

            {/* 축 */}
            <line
              x1={LC_PAD_L}
              y1={LC_PAD_T}
              x2={LC_PAD_L}
              y2={LC_PAD_T + LC_PLOT_H}
              stroke="rgba(92,64,51,0.45)"
              strokeWidth={1.5}
            />
            <line
              x1={LC_PAD_L}
              y1={LC_PAD_T + LC_PLOT_H}
              x2={LC_W - LC_PAD_R}
              y2={LC_PAD_T + LC_PLOT_H}
              stroke="rgba(92,64,51,0.45)"
              strokeWidth={1.5}
            />

            {/* 이론적 확률 기준선 */}
            <line
              x1={LC_PAD_L}
              y1={lineChart.theoreticalY}
              x2={LC_W - LC_PAD_R}
              y2={lineChart.theoreticalY}
              stroke="#2f9e6f"
              strokeWidth={2}
              strokeDasharray="7 5"
            />
            <text
              x={LC_W - LC_PAD_R}
              y={lineChart.theoreticalY - 6}
              textAnchor="end"
              className="fill-[#2f9e6f]"
              fontSize={12}
              fontWeight={700}
            >
              이론적 확률 {formatPercent(theoretical, 1)}
            </text>

            {/* 상대도수 꺾은선 */}
            {series.points.length > 0 ? (
              <polyline
                points={lineChart.polyline}
                fill="none"
                stroke="#e8823c"
                strokeWidth={2.2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ) : null}

            {/* x축 라벨 */}
            <text
              x={LC_PAD_L}
              y={LC_H - 12}
              textAnchor="start"
              className="fill-[#5C4033]"
              fontSize={12}
            >
              0
            </text>
            <text
              x={LC_W - LC_PAD_R}
              y={LC_H - 12}
              textAnchor="end"
              className="fill-[#5C4033]"
              fontSize={12}
            >
              {total.toLocaleString()}회
            </text>
            <text
              x={LC_PAD_L + LC_PLOT_W / 2}
              y={LC_H - 12}
              textAnchor="middle"
              className="fill-[#5C4033]"
              fontSize={12}
              fontWeight={700}
            >
              시행 횟수
            </text>
          </svg>
        </div>
        {total === 0 ? (
          <p className="mt-3 text-center text-xs text-foreground/50">
            아직 굴리지 않았어요. 주사위를 굴리면 그래프가 그려집니다.
          </p>
        ) : null}
      </section>

      {/* 분포 막대그래프 */}
      <section className="quest-card p-5 sm:p-7">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-bold text-wood">눈별 분포 비교</p>
          <p className="flex flex-wrap items-center gap-3 text-xs font-semibold text-foreground/60">
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-sm bg-[#e8823c]" />
              상대도수(실제)
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-4 border-t-2 border-dashed border-[#2f9e6f]" />
              이론적 확률
            </span>
          </p>
        </div>
        <div className="overflow-hidden rounded-2xl bg-gradient-to-b from-[#FEF9F0] to-sky/15 ring-1 ring-wood/10">
          <svg
            viewBox={`0 0 ${BC_W} ${BC_H}`}
            className="mx-auto h-auto w-full"
            role="img"
            aria-label="주사위 눈 1부터 6까지의 상대도수와 이론적 확률을 비교한 막대그래프"
          >
            {/* y축 눈금 + 격자 */}
            {barChart.yTicks.map((tick) => (
              <g key={tick.v}>
                <line
                  x1={BC_PAD_L}
                  y1={tick.y}
                  x2={BC_W - BC_PAD_R}
                  y2={tick.y}
                  stroke="rgba(92,64,51,0.12)"
                  strokeWidth={1}
                />
                <text
                  x={BC_PAD_L - 8}
                  y={tick.y + 4}
                  textAnchor="end"
                  className="fill-[#5C4033]"
                  fontSize={12}
                >
                  {tick.label}
                </text>
              </g>
            ))}

            {/* 막대 + 이론선 */}
            {barChart.bars.map((bar) => {
              const isTarget = bar.face === targetFace;
              return (
                <g key={bar.face}>
                  <rect
                    x={bar.x}
                    y={bar.yObs}
                    width={bar.barW}
                    height={Math.max(0, bar.heightObs)}
                    rx={4}
                    fill={isTarget ? "#e8823c" : "#f2b68a"}
                    stroke={isTarget ? "#c9631f" : "none"}
                    strokeWidth={isTarget ? 2 : 0}
                  />
                  {/* 이론적 확률 기준선 */}
                  <line
                    x1={bar.cx - bar.barW / 2 - 6}
                    y1={bar.yTheoretical}
                    x2={bar.cx + bar.barW / 2 + 6}
                    y2={bar.yTheoretical}
                    stroke="#2f9e6f"
                    strokeWidth={2.4}
                    strokeDasharray="6 4"
                  />
                  {/* 눈 라벨 */}
                  <text
                    x={bar.cx}
                    y={BC_PAD_T + BC_PLOT_H + 20}
                    textAnchor="middle"
                    className="fill-[#5C4033]"
                    fontSize={13}
                    fontWeight={isTarget ? 700 : 500}
                  >
                    {bar.face}
                  </text>
                  {/* 상대도수 값 */}
                  {total > 0 ? (
                    <text
                      x={bar.cx}
                      y={bar.yObs - 6}
                      textAnchor="middle"
                      className="fill-[#5C4033]"
                      fontSize={11}
                      fontWeight={isTarget ? 700 : 500}
                    >
                      {formatPercent(bar.observed, 1)}
                    </text>
                  ) : null}
                </g>
              );
            })}

            {/* x축 */}
            <line
              x1={BC_PAD_L}
              y1={barChart.baseline}
              x2={BC_W - BC_PAD_R}
              y2={barChart.baseline}
              stroke="rgba(92,64,51,0.45)"
              strokeWidth={1.5}
            />
          </svg>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-foreground/60">
          주황 막대는 실제로 굴려서 나온 상대도수, 초록 점선은 이론적 확률이에요.
          시행 횟수를 늘리면 모든 막대가 각자의 점선 높이에 가까워집니다.
        </p>
      </section>

      <style jsx>{`
        @keyframes dice-bounce {
          0% {
            transform: translateY(0) rotate(0deg) scale(1);
          }
          30% {
            transform: translateY(-14px) rotate(-12deg) scale(1.06);
          }
          60% {
            transform: translateY(0) rotate(8deg) scale(0.98);
          }
          100% {
            transform: translateY(0) rotate(0deg) scale(1);
          }
        }
        .dice-bounce {
          animation: dice-bounce 0.32s ease-out;
        }
      `}</style>
    </div>
  );
}

function StatBox({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl px-3 py-3 text-center ${
        highlight
          ? "bg-peach/30 ring-2 ring-peach"
          : "bg-white/60 ring-1 ring-wood/10"
      }`}
    >
      <p className="text-[11px] font-semibold text-foreground/60">{label}</p>
      <p className="font-display mt-1 text-xl text-foreground sm:text-2xl">
        {value}
      </p>
    </div>
  );
}
