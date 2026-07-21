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

/** 직육면체 주사위의 확률을 공개하기 전 권장하는 최소 시행 횟수. */
const MIN_ROLLS_TO_REVEAL = 30;

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
    [0.26, 0.26],
    [0.5, 0.5],
    [0.74, 0.74],
  ],
  4: [
    [0.28, 0.28],
    [0.72, 0.28],
    [0.28, 0.72],
    [0.72, 0.72],
  ],
  5: [
    [0.26, 0.26],
    [0.74, 0.26],
    [0.5, 0.5],
    [0.26, 0.74],
    [0.74, 0.74],
  ],
  6: [
    [0.3, 0.24],
    [0.7, 0.24],
    [0.3, 0.5],
    [0.7, 0.5],
    [0.3, 0.76],
    [0.7, 0.76],
  ],
};

// ── 3D 주사위 ──────────────────────────────────────────────────
/** 정지 상태의 보기 좋은 기울기. */
const TILT_X = -18;
const TILT_Y = 24;

/** 각 눈을 앞으로 오게 하는 회전(면 배치의 역회전). */
const FACE_BASE: Record<DieFace, { rx: number; ry: number }> = {
  1: { rx: 0, ry: 0 },
  2: { rx: -90, ry: 0 },
  3: { rx: 0, ry: -90 },
  4: { rx: 0, ry: 90 },
  5: { rx: 90, ry: 0 },
  6: { rx: 0, ry: 180 },
};

type Dims = { wx: number; wy: number; wz: number };

function faceGeometry(
  face: DieFace,
  dims: Dims,
): { w: number; h: number; placement: string } {
  const { wx, wy, wz } = dims;
  switch (face) {
    case 1:
      return { w: wx, h: wy, placement: `rotateY(0deg) translateZ(${wz / 2}px)` };
    case 6:
      return {
        w: wx,
        h: wy,
        placement: `rotateY(180deg) translateZ(${wz / 2}px)`,
      };
    case 3:
      return {
        w: wz,
        h: wy,
        placement: `rotateY(90deg) translateZ(${wx / 2}px)`,
      };
    case 4:
      return {
        w: wz,
        h: wy,
        placement: `rotateY(-90deg) translateZ(${wx / 2}px)`,
      };
    case 2:
      return {
        w: wx,
        h: wz,
        placement: `rotateX(90deg) translateZ(${wy / 2}px)`,
      };
    case 5:
      return {
        w: wx,
        h: wz,
        placement: `rotateX(-90deg) translateZ(${wy / 2}px)`,
      };
  }
}

function Die3D({
  face,
  long,
  spins,
  animate,
}: {
  face: DieFace | null;
  long: boolean;
  spins: number;
  animate: boolean;
}) {
  // 직육면체는 앞·뒤(1, 6)가 좁은 정사각형 끝면, 네 옆면(2~5)이 길쭉한 면.
  const dims: Dims = long
    ? { wx: 54, wy: 54, wz: 120 }
    : { wx: 84, wy: 84, wz: 84 };
  const C = Math.max(dims.wx, dims.wy, dims.wz);
  const shown = face ?? 1;
  const base = FACE_BASE[shown];
  const rx = base.rx + TILT_X - spins * 360;
  const ry = base.ry + TILT_Y + spins * 360;

  return (
    <>
      <div className="die-stage">
      <div className="die-shadow" style={{ width: long ? 150 : 100 }} />
      <div
        className="die-solid"
        role="img"
        aria-label={face ? `주사위 눈 ${face}` : "주사위"}
        style={{
          width: C,
          height: C,
          transform: `rotateX(${rx}deg) rotateY(${ry}deg)`,
          transition: animate
            ? "transform 0.7s cubic-bezier(0.2,0.85,0.3,1)"
            : "none",
        }}
      >
        {DIE_FACES.map((f) => {
          const g = faceGeometry(f, dims);
          const pipD = Math.max(6, Math.round(Math.min(g.w, g.h) * 0.16));
          return (
            <div
              key={f}
              className="die-face"
              style={{
                width: g.w,
                height: g.h,
                left: (C - g.w) / 2,
                top: (C - g.h) / 2,
                transform: g.placement,
              }}
            >
              {PIP_LAYOUT[f].map(([px, py], i) => (
                <span
                  key={i}
                  className="die-pip"
                  style={{
                    width: pipD,
                    height: pipD,
                    left: `${px * 100}%`,
                    top: `${py * 100}%`,
                    marginLeft: -pipD / 2,
                    marginTop: -pipD / 2,
                  }}
                />
              ))}
            </div>
          );
        })}
      </div>
      </div>
      <style jsx>{`
        .die-stage {
          position: relative;
          height: 190px;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          perspective: 800px;
        }
        .die-shadow {
          position: absolute;
          bottom: 22px;
          left: 50%;
          height: 22px;
          transform: translateX(-50%);
          background: radial-gradient(
            ellipse at center,
            rgba(92, 64, 51, 0.28),
            rgba(92, 64, 51, 0) 70%
          );
          filter: blur(2px);
        }
        .die-solid {
          position: relative;
          transform-style: preserve-3d;
          -webkit-transform-style: preserve-3d;
          will-change: transform;
        }
        .die-face {
          position: absolute;
          box-sizing: border-box;
          border: 2px solid rgba(92, 64, 51, 0.3);
          border-radius: 12px;
          background: linear-gradient(150deg, #ffffff 0%, #fbeede 100%);
          box-shadow: inset 0 0 12px rgba(92, 64, 51, 0.08);
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
        }
        .die-pip {
          position: absolute;
          border-radius: 9999px;
          background: #5c4033;
          box-shadow: inset 0 -1px 1px rgba(0, 0, 0, 0.28);
        }
      `}</style>
    </>
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
  const [spins, setSpins] = useState(0);
  const [animateRoll, setAnimateRoll] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [guessInput, setGuessInput] = useState("");

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

  const isCuboid = diceType === "cuboid";
  // 직육면체는 확률이 숨겨진 '추측' 모드. 정답을 확인하면 공개됨.
  const discovery = isCuboid && !revealed;

  const stopAuto = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setAutoRunning(false);
  }, []);

  const resetExperiment = useCallback(() => {
    const freshTally = createTally();
    const freshSeries = createConvergenceSeries();
    tallyRef.current = freshTally;
    seriesRef.current = freshSeries;
    setTally(freshTally);
    setSeries(freshSeries);
    setLastRoll(null);
    setRevealed(false);
    setGuessInput("");
  }, []);

  const resetAll = useCallback(() => {
    stopAuto();
    resetExperiment();
  }, [stopAuto, resetExperiment]);

  /** count번 굴려 상태를 갱신. animate=true면 3D 굴림 애니메이션 재생(단발 굴리기). */
  const applyRolls = useCallback((count: number, animate: boolean) => {
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
    setAnimateRoll(animate);
    if (animate) setSpins((s) => s + 1);
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
      applyRolls(batch, false);
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
      resetExperiment();
    },
    [diceType, stopAuto, resetExperiment],
  );

  const handleTargetChange = useCallback(
    (face: DieFace) => {
      if (face === targetFace) return;
      stopAuto();
      setTargetFace(face);
      targetFaceRef.current = face;
      resetExperiment();
    },
    [targetFace, stopAuto, resetExperiment],
  );

  const canReveal = total >= MIN_ROLLS_TO_REVEAL;

  const handleReveal = useCallback(() => {
    stopAuto();
    setRevealed(true);
  }, [stopAuto]);

  // ── 수렴 그래프 계산 ────────────────────────────────────────
  const lineChart = useMemo(() => {
    // 추측 모드에서는 이론값이 축 눈금으로 새어 나가지 않도록 고정 범위 사용.
    const yMax = discovery ? 0.5 : clamp(theoretical * 3, 0.4, 1);
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
  }, [series, theoretical, total, discovery]);

  // ── 분포 막대그래프 계산 ────────────────────────────────────
  const barChart = useMemo(() => {
    const probs = DICE[diceType].probabilities;
    const observed = DIE_FACES.map((f) => relativeFrequency(tally, f));
    const maxObserved = Math.max(...observed, 0);
    const maxTheoretical = Math.max(...DIE_FACES.map((f) => probs[f]));
    // 추측 모드에서는 이론값을 축 범위에 반영하지 않음.
    const yMax = discovery
      ? clamp(maxObserved * 1.3, 0.3, 1)
      : clamp(Math.max(maxObserved, maxTheoretical) * 1.25, 0.3, 1);

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
  }, [diceType, tally, discovery]);

  const diffAbs = Math.abs(relFreq - theoretical);

  const guessNum = parseFloat(guessInput);
  const guessValid =
    Number.isFinite(guessNum) && guessNum >= 0 && guessNum <= 100;
  const guessDiff = guessValid
    ? Math.abs(guessNum / 100 - theoretical)
    : null;

  const diceDescription = discovery
    ? "이 직육면체 주사위는 면마다 나올 확률이 서로 달라요. 그런데 그 확률은 숨겨져 있어요! 여러 번 굴려서 상대도수를 관찰하고, 각 눈이 나올 확률을 직접 추측해 보세요."
    : DICE[diceType].description;

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
              {diceDescription}
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
            {discovery ? (
              <p className="mt-3 rounded-xl bg-gold/15 px-4 py-3 text-xs leading-relaxed text-foreground/75">
                눈 <b>{targetFace}</b>이(가) 나올 확률은 <b>숨겨져 있어요.</b>{" "}
                충분히 굴린 뒤 아래 상대도수를 보고 확률을 추측해 보세요.
              </p>
            ) : (
              <p className="mt-3 rounded-xl bg-gold/15 px-4 py-3 text-xs leading-relaxed text-foreground/75">
                눈 <b>{targetFace}</b>이(가) 나올 이론적 확률은{" "}
                <b>{formatProbability(diceType, targetFace)}</b> ={" "}
                <b>{formatPercent(theoretical, 2)}</b> 입니다.
              </p>
            )}
          </div>
        </div>

        {/* 굴리기 버튼 */}
        <div className="mt-6 flex flex-col items-center gap-4">
          <Die3D
            face={lastRoll}
            long={isCuboid}
            spins={spins}
            animate={animateRoll}
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
        <div
          className={`grid gap-3 ${
            discovery
              ? "grid-cols-3"
              : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
          }`}
        >
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
          {!discovery ? (
            <>
              <StatBox
                label="이론적 확률"
                value={formatPercent(theoretical, 2)}
              />
              <StatBox
                label="차이(오차)"
                value={total === 0 ? "-" : formatPercent(diffAbs, 2)}
              />
            </>
          ) : null}
        </div>
        <p className="mt-4 text-xs leading-relaxed text-foreground/60">
          상대도수 = (눈 {targetFace}이 나온 횟수) ÷ (총 시행 횟수). 시행 초반에는
          상대도수가 크게 요동치지만, 시행 횟수가 많아질수록 어떤 일정한 값에
          점점 가까워집니다. 이렇게 상대도수가 수렴하는 값이 바로 그 눈이 나올
          확률이에요. 이것을 <b>큰 수의 법칙</b>이라고 해요.
        </p>
      </section>

      {/* 확률 추측하기 (직육면체 전용) */}
      {isCuboid ? (
        <section className="quest-card bg-gradient-to-br from-sky/25 to-peach/20 p-5 sm:p-7">
          <p className="mb-2 text-sm font-bold text-wood">확률 추측하기</p>
          {!revealed ? (
            <>
              <p className="text-xs leading-relaxed text-foreground/75">
                눈 <b>{targetFace}</b>이(가) 나올 확률이 얼마일지 추측해서 적어
                보세요. <b>자동 굴리기</b>로 충분히(예: 500번 이상) 굴린 뒤
                상대도수를 참고하면 더 정확하게 맞힐 수 있어요. 여섯 개의 눈이 모두
                똑같은 확률은 아니랍니다!
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm font-semibold text-foreground/80">
                  내 추측
                  <input
                    type="text"
                    inputMode="decimal"
                    value={guessInput}
                    onChange={(e) => setGuessInput(e.target.value)}
                    placeholder="예: 15"
                    className="w-24 rounded-xl border-2 border-wood/20 bg-white/85 px-3 py-2 text-center font-display text-xl text-foreground outline-none focus:border-peach"
                    aria-label={`눈 ${targetFace}이 나올 확률 추측 (퍼센트)`}
                  />
                  %
                </label>
                <button
                  type="button"
                  onClick={handleReveal}
                  disabled={!canReveal}
                  className="rounded-2xl bg-gold px-5 py-2.5 text-sm font-bold text-wood shadow-sm ring-2 ring-wood/20 transition hover:bg-gold/80 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  정답 확인
                </button>
              </div>
              {!canReveal ? (
                <p className="mt-3 text-xs font-medium text-[#a63a1a]">
                  조금 더 굴려 보세요. (최소 {MIN_ROLLS_TO_REVEAL}번 이상 굴린 뒤
                  확인할 수 있어요. 지금 {total.toLocaleString()}번)
                </p>
              ) : null}
            </>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <StatBox
                  label={`눈 ${targetFace} · 내 추측`}
                  value={guessValid ? formatPercent(guessNum / 100, 1) : "-"}
                />
                <StatBox
                  label={`눈 ${targetFace} · 실제 확률`}
                  value={formatPercent(theoretical, 1)}
                  highlight
                />
                <StatBox
                  label={`눈 ${targetFace} · 상대도수`}
                  value={total === 0 ? "-" : formatPercent(relFreq, 1)}
                />
              </div>
              <p className="mt-3 text-xs leading-relaxed text-foreground/70">
                이 직육면체 주사위는 넓이가 좁은 두 끝면(<b>1</b>, <b>6</b>)이 나올
                확률이 각각 <b>0.1</b>, 넓은 네 옆면(<b>2, 3, 4, 5</b>)이 나올 확률이
                각각 <b>0.2</b>로 설정되어 있어요.{" "}
                {guessValid ? (
                  guessDiff != null && guessDiff <= 0.03 ? (
                    <b>추측이 실제 확률과 아주 가까워요! 훌륭해요.</b>
                  ) : (
                    <>
                      내 추측과 실제 확률의 차이는{" "}
                      <b>{formatPercent(guessDiff ?? 0, 1)}</b> 예요. 더 많이
                      굴려서 다시 추측해 볼까요?
                    </>
                  )
                ) : (
                  <>이제 위·아래 그래프의 초록 점선(이론적 확률)과 비교해 보세요.</>
                )}
              </p>
              <button
                type="button"
                onClick={resetAll}
                className="mt-4 rounded-2xl bg-white/70 px-5 py-2.5 text-sm font-bold text-foreground/70 ring-1 ring-wood/15 transition hover:bg-white"
              >
                다른 눈으로 다시 도전 (초기화)
              </button>
            </>
          )}
        </section>
      ) : null}

      {/* 수렴 그래프 */}
      <section className="quest-card p-5 sm:p-7">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-bold text-wood">상대도수의 수렴 그래프</p>
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

            {/* 이론적 확률 기준선 (추측 모드에서는 숨김) */}
            {!discovery ? (
              <>
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
              </>
            ) : null}

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
            {!discovery ? (
              <span className="flex items-center gap-1">
                <span className="inline-block h-3 w-4 border-t-2 border-dashed border-[#2f9e6f]" />
                이론적 확률
              </span>
            ) : null}
          </p>
        </div>
        <div className="overflow-hidden rounded-2xl bg-gradient-to-b from-[#FEF9F0] to-sky/15 ring-1 ring-wood/10">
          <svg
            viewBox={`0 0 ${BC_W} ${BC_H}`}
            className="mx-auto h-auto w-full"
            role="img"
            aria-label="주사위 눈 1부터 6까지의 상대도수를 비교한 막대그래프"
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
                  {/* 이론적 확률 기준선 (추측 모드에서는 숨김) */}
                  {!discovery ? (
                    <line
                      x1={bar.cx - bar.barW / 2 - 6}
                      y1={bar.yTheoretical}
                      x2={bar.cx + bar.barW / 2 + 6}
                      y2={bar.yTheoretical}
                      stroke="#2f9e6f"
                      strokeWidth={2.4}
                      strokeDasharray="6 4"
                    />
                  ) : null}
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
          {discovery
            ? "주황 막대는 실제로 굴려서 나온 상대도수예요. 시행을 늘리면 막대 높이가 점점 안정돼요. 어떤 눈이 자주 나오고 어떤 눈이 드물게 나오는지 관찰해 확률을 추측해 보세요."
            : "주황 막대는 실제로 굴려서 나온 상대도수, 초록 점선은 이론적 확률이에요. 시행 횟수를 늘리면 모든 막대가 각자의 점선 높이에 가까워집니다."}
        </p>
      </section>
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
