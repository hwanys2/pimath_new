"use client";

import { useCallback, useMemo, useState } from "react";
import {
  MAX_ITERATIONS,
  TARGET_AREAS,
  type Bracket,
  type DecimalValue,
  type IterationRecord,
  type TargetArea,
  compareSquareToArea,
  getInitialBracket,
  isValidGuess,
  parseSideInput,
  parseSideInputErrorMessage,
  refineBracket,
  sideToNumber,
  squareInt,
  squareSide,
} from "@/lib/sqrt-approx-math";

type Phase = "select" | "iterate" | "complete";

type WrongAttempt = {
  guess: DecimalValue;
  square: string;
};

const VB_W = 720;
const VB_H = 280;
const GAP = 28;
const SYM_W = 36;

const COLOR_LOW = { fill: "rgba(125, 200, 245, 0.75)", stroke: "#4A90C8" };
const COLOR_TARGET = { fill: "rgba(212, 196, 255, 0.85)", stroke: "#7B5BB5" };
const COLOR_HIGH = { fill: "rgba(255, 200, 160, 0.8)", stroke: "#D4845A" };
const COLOR_GUESS = { fill: "rgba(255, 215, 100, 0.85)", stroke: "#C9A030" };

type SquareSpec = {
  id: string;
  side: DecimalValue;
  label: string;
  sublabel?: string;
  colors: { fill: string; stroke: string };
  role: "low" | "target" | "high" | "guess";
};

function buildSquareSpecs(
  area: number,
  bracket: Bracket,
  wrong: WrongAttempt | null,
): { specs: SquareSpec[]; showInequalities: boolean } {
  const lowSq = squareSide(bracket.low);
  const highSq = squareSide(bracket.high);
  const targetSide = Math.sqrt(area);

  const lowSpec: SquareSpec = {
    id: "low",
    side: bracket.low,
    label: bracket.low.raw,
    sublabel: `${lowSq}`,
    colors: COLOR_LOW,
    role: "low",
  };
  const targetSpec: SquareSpec = {
    id: "target",
    side: {
      raw: `√${area}`,
      scaled: BigInt(Math.round(targetSide * 1e6)),
      scale: 6,
    },
    label: `넓이 ${area}`,
    sublabel: undefined,
    colors: COLOR_TARGET,
    role: "target",
  };
  const highSpec: SquareSpec = {
    id: "high",
    side: bracket.high,
    label: bracket.high.raw,
    sublabel: `${highSq}`,
    colors: COLOR_HIGH,
    role: "high",
  };

  if (wrong) {
    const guessSpec: SquareSpec = {
      id: "guess",
      side: wrong.guess,
      label: wrong.guess.raw,
      sublabel: wrong.square,
      colors: COLOR_GUESS,
      role: "guess",
    };
    const sorted = [lowSpec, targetSpec, highSpec, guessSpec].sort(
      (a, b) => sideToNumber(a.side) - sideToNumber(b.side),
    );
    return { specs: sorted, showInequalities: false };
  }

  return { specs: [lowSpec, targetSpec, highSpec], showInequalities: true };
}

function layoutSquares(specs: SquareSpec[]) {
  const sides = specs.map((s) =>
    s.role === "target" ? Math.sqrt(Number(s.label.replace("넓이 ", ""))) : sideToNumber(s.side),
  );
  const maxSide = Math.max(...sides, 1);
  const maxPx = 120;
  const scale = maxPx / maxSide;

  const sizes = sides.map((s) => s * scale);
  const totalW =
    sizes.reduce((a, b) => a + b, 0) +
    (specs.length - 1) * (GAP + SYM_W);
  let x = (VB_W - totalW) / 2;
  const baseY = VB_H / 2;

  return specs.map((spec, i) => {
    const size = sizes[i];
    const y = baseY - size / 2;
    const rect = { x, y, size, spec };
    x += size + GAP + SYM_W;
    return rect;
  });
}

function SquareDiagram({
  area,
  bracket,
  wrong,
}: {
  area: number;
  bracket: Bracket;
  wrong: WrongAttempt | null;
}) {
  const { specs, showInequalities } = useMemo(
    () => buildSquareSpecs(area, bracket, wrong),
    [area, bracket, wrong],
  );
  const layout = useMemo(() => layoutSquares(specs), [specs]);

  const lowSq = squareSide(bracket.low);
  const highSq = squareSide(bracket.high);

  return (
    <div className="flex flex-col gap-3">
      <div className="text-center font-mono text-sm font-semibold text-foreground/80 sm:text-base">
        {showInequalities ? (
          <>
            <span className="text-sky-700">{lowSq}</span>
            <span className="mx-2 text-wood/60">&lt;</span>
            <span className="text-[#6B4FA0]">{area}</span>
            <span className="mx-2 text-wood/60">&lt;</span>
            <span className="text-[#C07040]">{highSq}</span>
          </>
        ) : (
          <span className="text-foreground/40">&nbsp;</span>
        )}
      </div>

      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="mx-auto w-full max-w-3xl"
        role="img"
        aria-label="정사각형 넓이 비교"
      >
        {layout.map((item, i) => (
          <g key={item.spec.id}>
            <rect
              x={item.x}
              y={item.y}
              width={item.size}
              height={item.size}
              rx={4}
              fill={item.spec.colors.fill}
              stroke={item.spec.colors.stroke}
              strokeWidth={2}
            />
            <text
              x={item.x + item.size / 2}
              y={item.y + item.size / 2 - (item.spec.sublabel ? 6 : 0)}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-wood text-[13px] font-bold"
              style={{ fontSize: Math.max(10, item.size * 0.18) }}
            >
              {item.spec.label}
            </text>
            {item.spec.sublabel ? (
              <text
                x={item.x + item.size / 2}
                y={item.y + item.size / 2 + item.size * 0.14}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-wood/70"
                style={{ fontSize: Math.max(8, item.size * 0.12) }}
              >
                = {item.spec.sublabel}
              </text>
            ) : null}
            {i < layout.length - 1 ? (
              <text
                x={item.x + item.size + GAP / 2 + SYM_W / 2}
                y={baseY(item)}
                textAnchor="middle"
                dominantBaseline="middle"
                className={
                  showInequalities
                    ? "fill-wood/50 text-xl font-bold"
                    : "fill-wood/20 text-xl"
                }
              >
                {showInequalities ? "<" : "·"}
              </text>
            ) : null}
          </g>
        ))}
      </svg>
    </div>
  );
}

function baseY(item: { y: number; size: number }) {
  return item.y + item.size / 2;
}

export default function IrrationalSquare() {
  const [phase, setPhase] = useState<Phase>("select");
  const [area, setArea] = useState<TargetArea | null>(null);
  const [bracket, setBracket] = useState<Bracket | null>(null);
  const [round, setRound] = useState(1);
  const [history, setHistory] = useState<IterationRecord[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [wrongAttempt, setWrongAttempt] = useState<WrongAttempt | null>(null);
  const [lastSquare, setLastSquare] = useState<string | null>(null);
  const [lastGuessRaw, setLastGuessRaw] = useState<string | null>(null);

  const selectArea = useCallback((n: TargetArea) => {
    setArea(n);
    setBracket(getInitialBracket(n));
    setRound(1);
    setHistory([]);
    setInputValue("");
    setInputError(null);
    setWrongAttempt(null);
    setLastSquare(null);
    setLastGuessRaw(null);
    setPhase("iterate");
  }, []);

  const reset = useCallback(() => {
    setPhase("select");
    setArea(null);
    setBracket(null);
    setRound(1);
    setHistory([]);
    setInputValue("");
    setInputError(null);
    setWrongAttempt(null);
    setLastSquare(null);
    setLastGuessRaw(null);
  }, []);

  const submitGuess = useCallback(() => {
    if (!area || !bracket || phase !== "iterate") return;

    const parsed = parseSideInput(inputValue);
    if (!parsed.ok) {
      if (parsed.error !== "empty") {
        setInputError(parseSideInputErrorMessage(parsed.error));
      } else {
        setInputError(parseSideInputErrorMessage(parsed.error));
      }
      return;
    }

    setInputError(null);
    const guess = parsed.value;
    const square = squareSide(guess);
    setLastSquare(square);
    setLastGuessRaw(guess.raw);

    if (!isValidGuess(guess, bracket.low, bracket.high)) {
      setWrongAttempt({ guess, square });
      return;
    }

    setWrongAttempt(null);
    const squareVsArea = compareSquareToArea(square, area);
    const newBracket = refineBracket(bracket, guess, area);

    const record: IterationRecord = {
      round,
      guess,
      square,
      bracket: { ...bracket },
      squareVsArea,
    };

    setHistory((prev) => [...prev, record]);
    setBracket(newBracket);
    setInputValue("");

    if (round >= MAX_ITERATIONS) {
      setPhase("complete");
    } else {
      setRound((r) => r + 1);
    }
  }, [area, bracket, phase, inputValue, round]);

  const initialBracket = area ? getInitialBracket(area) : null;

  return (
    <div className="flex flex-col gap-6">
      <section className="quest-card bg-gradient-to-br from-lavender/50 to-sky/30 p-5 sm:p-7">
        <p className="text-sm font-bold text-wood">중3 · 1. 제곱근과 실수</p>
        <h1 className="font-display mt-1 text-3xl text-foreground sm:text-4xl">
          정사각형으로 만나는 무리수
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-foreground/75 sm:text-base">
          넓이가 정수인 정사각형의 한 변 길이를 직접 찾아 보세요. 제곱값은
          자동으로 계산해 드리지만, 어떤 수를 넣어야 하는지는 스스로
          판단해야 합니다. 점수는 없고, 개념을 눈으로 익히는 시뮬레이션입니다.
        </p>
      </section>

      {phase === "select" ? (
        <section className="quest-card p-5 sm:p-8">
          <p className="mb-5 text-center text-sm font-semibold text-foreground/70">
            넓이를 선택하세요
          </p>
          <div className="mx-auto grid max-w-lg grid-cols-3 gap-3 sm:gap-4">
            {TARGET_AREAS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => selectArea(n)}
                className="block-btn-lavender rounded-2xl px-4 py-6 font-display text-3xl font-bold sm:text-4xl"
              >
                {n}
              </button>
            ))}
          </div>
          <p className="mt-6 text-center text-xs text-foreground/55">
            완전제곱수가 아닌 넓이를 골라, 한 변의 길이를 10번 탐구해 보세요.
          </p>
        </section>
      ) : null}

      {phase === "iterate" && area && bracket ? (
        <>
          <section className="quest-card p-5 sm:p-8">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-bold text-wood">
                넓이 {area} — {round} / {MAX_ITERATIONS}차
              </p>
              {initialBracket ? (
                <p className="font-mono text-xs text-foreground/55">
                  {squareInt(Number(initialBracket.low.raw))} &lt; {area} &lt;{" "}
                  {squareInt(Number(initialBracket.high.raw))}
                </p>
              ) : null}
            </div>

            <SquareDiagram
              area={area}
              bracket={bracket}
              wrong={wrongAttempt}
            />

            <div className="mx-auto mt-8 max-w-sm">
              <label className="flex flex-col items-center gap-2">
                <span className="text-xs font-bold text-wood/70">
                  한 변의 길이
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={inputValue}
                  onChange={(e) => {
                    setInputValue(e.target.value);
                    setInputError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitGuess();
                  }}
                  className="w-full rounded-2xl border-2 border-wood/20 bg-white/85 px-4 py-3 text-center font-display text-3xl font-bold text-foreground outline-none focus:border-lavender sm:text-4xl"
                  aria-label="한 변의 길이 입력"
                />
              </label>

              {lastSquare && lastGuessRaw ? (
                <p className="mt-3 text-center font-mono text-sm text-foreground/70">
                  {lastGuessRaw}² ={" "}
                  <span className="font-semibold text-wood">{lastSquare}</span>
                </p>
              ) : null}

              {inputError ? (
                <p
                  className="mt-3 text-center text-sm font-semibold text-[#a63a1a]"
                  role="alert"
                >
                  {inputError}
                </p>
              ) : null}

              <button
                type="button"
                onClick={submitGuess}
                className="block-btn-lavender mt-5 w-full rounded-2xl py-3 text-base font-bold"
              >
                확인
              </button>
            </div>
          </section>

          {history.length > 0 ? (
            <section className="quest-card p-5 sm:p-7">
              <p className="mb-4 text-sm font-bold text-wood">탐구 기록</p>
              <ol className="flex flex-col gap-3">
                {history.map((rec) => {
                  const bLowSq = squareSide(rec.bracket.low);
                  const bHighSq = squareSide(rec.bracket.high);
                  return (
                    <li
                      key={rec.round}
                      className="rounded-xl bg-lavender/15 px-4 py-3 text-sm"
                    >
                      <span className="font-bold text-wood">{rec.round}차</span>
                      <span className="mx-2 text-foreground/40">·</span>
                      <span className="font-mono">
                        변 {rec.guess.raw} → {rec.guess.raw}² = {rec.square}
                      </span>
                      <p className="mt-1 font-mono text-xs text-foreground/60">
                        {bLowSq} &lt; {area} &lt; {bHighSq}
                      </p>
                    </li>
                  );
                })}
              </ol>
            </section>
          ) : null}
        </>
      ) : null}

      {phase === "complete" && area ? (
        <section className="quest-card p-5 sm:p-8">
          <p className="text-center font-display text-2xl font-bold text-foreground">
            10차 탐구를 마쳤어요
          </p>
          <p className="mx-auto mt-4 max-w-lg text-center text-sm leading-relaxed text-foreground/75">
            넓이 {area}인 정사각형의 한 변 길이를 10번 좁혀 왔습니다. 제곱값이
            넓이 {area}과 <strong>정확히 같아진 적은 없었습니다.</strong> 소수
            자릿수를 늘릴수록 제곱값의 소수 자릿수도 두 배로 늘어나지만, 넓이와
            딱 맞는 유한소수 제곱은 나타나지 않았어요.
          </p>

          <div className="mt-6">
            <p className="mb-3 text-sm font-bold text-wood">전체 기록</p>
            <ol className="flex flex-col gap-2">
              {history.map((rec) => (
                <li
                  key={rec.round}
                  className="rounded-xl bg-lavender/15 px-4 py-2 font-mono text-xs text-foreground/80 sm:text-sm"
                >
                  {rec.round}차: {rec.guess.raw}² = {rec.square}
                </li>
              ))}
            </ol>
          </div>

          <button
            type="button"
            onClick={reset}
            className="block-btn-lavender mx-auto mt-8 block rounded-2xl px-8 py-3 text-base font-bold"
          >
            다른 넓이로 다시
          </button>
        </section>
      ) : null}
    </div>
  );
}
