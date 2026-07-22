"use client";

import { useCallback, useMemo, useState } from "react";
import {
  MAX_DECIMAL_DIGITS,
  TARGET_AREAS,
  type Bracket,
  type ConfirmRecord,
  type DecimalValue,
  type TargetArea,
  appendDigit,
  compareDecimal,
  getCorrectIntegerPart,
  getCorrectNextDigit,
  getInitialBracket,
  getRequiredBracket,
  isUnlockBracket,
  isValidGuess,
  parseSideInput,
  parseSideInputErrorMessage,
  refineBracket,
  sideToNumber,
  squareInt,
  squareSide,
} from "@/lib/sqrt-approx-math";

type Phase = "select" | "explore" | "complete";
type ConfirmStage = "integer" | "decimal";

type WrongProbe = {
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
const COLOR_PROBE = { fill: "rgba(255, 215, 100, 0.85)", stroke: "#C9A030" };

type SquareSpec = {
  id: string;
  side: DecimalValue;
  label: string;
  sublabel?: string;
  colors: { fill: string; stroke: string };
  role: "low" | "target" | "high" | "probe";
};

function buildSquareSpecs(
  area: number,
  bracket: Bracket,
  wrong: WrongProbe | null,
): { specs: SquareSpec[]; showInequalities: boolean } {
  const lowSq = squareSide(bracket.low);
  const highSq = squareSide(bracket.high);
  const targetSide = Math.sqrt(area);

  const lowSpec: SquareSpec = {
    id: "low",
    side: bracket.low,
    label: bracket.low.raw,
    sublabel: lowSq,
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
    colors: COLOR_TARGET,
    role: "target",
  };
  const highSpec: SquareSpec = {
    id: "high",
    side: bracket.high,
    label: bracket.high.raw,
    sublabel: highSq,
    colors: COLOR_HIGH,
    role: "high",
  };

  if (wrong) {
    const probeSpec: SquareSpec = {
      id: "probe",
      side: wrong.guess,
      label: wrong.guess.raw,
      sublabel: wrong.square,
      colors: COLOR_PROBE,
      role: "probe",
    };
    const sorted = [lowSpec, targetSpec, highSpec, probeSpec].sort(
      (a, b) => sideToNumber(a.side) - sideToNumber(b.side),
    );
    return { specs: sorted, showInequalities: false };
  }

  return { specs: [lowSpec, targetSpec, highSpec], showInequalities: true };
}

function layoutSquares(specs: SquareSpec[]) {
  const sides = specs.map((s) =>
    s.role === "target"
      ? Math.sqrt(Number(s.label.replace("넓이 ", "")))
      : sideToNumber(s.side),
  );
  const maxSide = Math.max(...sides, 1);
  const maxPx = 120;
  const scale = maxPx / maxSide;

  const sizes = sides.map((s) => s * scale);
  const totalW =
    sizes.reduce((a, b) => a + b, 0) + (specs.length - 1) * (GAP + SYM_W);
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

function squareCenterY(item: { y: number; size: number }) {
  return item.y + item.size / 2;
}

function SquareDiagram({
  area,
  bracket,
  wrong,
}: {
  area: number;
  bracket: Bracket;
  wrong: WrongProbe | null;
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
              className="fill-wood font-bold"
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
                y={squareCenterY(item)}
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

function DigitDisplay({
  confirmed,
  confirmStage,
  decimalIndex,
}: {
  confirmed: DecimalValue | null;
  confirmStage: ConfirmStage;
  decimalIndex: number;
}) {
  const intPart = confirmed ? confirmed.raw.split(".")[0] : null;
  const filledFrac =
    confirmed && confirmed.scale > 0 ? confirmed.raw.split(".")[1] : "";

  return (
    <div className="flex flex-wrap items-center justify-center gap-1 font-display text-2xl font-bold sm:text-3xl">
      <span
        className={`min-w-[2rem] rounded-lg px-2 py-1 text-center ${
          intPart
            ? "bg-lavender/40 text-wood"
            : confirmStage === "integer"
              ? "bg-gold/40 text-wood ring-2 ring-gold/60"
              : "bg-wood/10 text-foreground/30"
        }`}
      >
        {intPart ?? "_"}
      </span>
      <span className="text-wood/60">.</span>
      {Array.from({ length: MAX_DECIMAL_DIGITS }, (_, i) => {
        const digit = filledFrac[i];
        const isActive =
          confirmStage === "decimal" && decimalIndex === i && !digit;
        const isFuture = !digit && (i > filledFrac.length || !confirmed);
        return (
          <span
            key={i}
            className={`min-w-[1.75rem] rounded-lg px-1.5 py-1 text-center sm:min-w-[2rem] ${
              digit
                ? "bg-lavender/40 text-wood"
                : isActive
                  ? "bg-gold/40 text-wood ring-2 ring-gold/60"
                  : "bg-wood/10 text-foreground/30"
            } ${isFuture && !isActive ? "opacity-50" : ""}`}
          >
            {digit ?? (isActive ? "_" : "·")}
          </span>
        );
      })}
    </div>
  );
}

export default function IrrationalSquare() {
  const [phase, setPhase] = useState<Phase>("select");
  const [area, setArea] = useState<TargetArea | null>(null);
  const [confirmStage, setConfirmStage] = useState<ConfirmStage>("integer");
  const [confirmed, setConfirmed] = useState<DecimalValue | null>(null);
  const [decimalIndex, setDecimalIndex] = useState(0);
  const [exploreBracket, setExploreBracket] = useState<Bracket | null>(null);
  const [confirmLocked, setConfirmLocked] = useState(false);
  const [history, setHistory] = useState<ConfirmRecord[]>([]);

  const [probeInput, setProbeInput] = useState("");
  const [confirmInput, setConfirmInput] = useState("");
  const [probeError, setProbeError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [wrongProbe, setWrongProbe] = useState<WrongProbe | null>(null);
  const [probedSinceLock, setProbedSinceLock] = useState(false);
  const [lastProbeSquare, setLastProbeSquare] = useState<{
    raw: string;
    square: string;
  } | null>(null);

  const requiredBracket = useMemo(() => {
    if (!area) return null;
    return getRequiredBracket(confirmed, area);
  }, [area, confirmed]);

  const selectArea = useCallback((n: TargetArea) => {
    const initial = getInitialBracket(n);
    setArea(n);
    setConfirmStage("integer");
    setConfirmed(null);
    setDecimalIndex(0);
    setExploreBracket(initial);
    setConfirmLocked(false);
    setHistory([]);
    setProbeInput("");
    setConfirmInput("");
    setProbeError(null);
    setConfirmError(null);
    setWrongProbe(null);
    setProbedSinceLock(false);
    setLastProbeSquare(null);
    setPhase("explore");
  }, []);

  const reset = useCallback(() => {
    setPhase("select");
    setArea(null);
    setConfirmStage("integer");
    setConfirmed(null);
    setDecimalIndex(0);
    setExploreBracket(null);
    setConfirmLocked(false);
    setHistory([]);
    setProbeInput("");
    setConfirmInput("");
    setProbeError(null);
    setConfirmError(null);
    setWrongProbe(null);
    setProbedSinceLock(false);
    setLastProbeSquare(null);
  }, []);

  const tryUnlock = useCallback(
    (bracket: Bracket, stage: ConfirmStage) => {
      if (!confirmLocked || !requiredBracket || !area) return;
      if (!probedSinceLock) return;

      const canUnlock =
        stage === "integer"
          ? true
          : isUnlockBracket(bracket, requiredBracket, area);

      if (canUnlock) {
        setConfirmLocked(false);
        setConfirmInput("");
        setProbedSinceLock(false);
      }
    },
    [confirmLocked, requiredBracket, area, probedSinceLock],
  );

  const submitProbe = useCallback(() => {
    if (!area || !exploreBracket || phase !== "explore") return;

    const parsed = parseSideInput(probeInput);
    if (!parsed.ok) {
      setProbeError(parseSideInputErrorMessage(parsed.error));
      return;
    }

    setProbeError(null);
    const guess = parsed.value;
    const square = squareSide(guess);
    setLastProbeSquare({ raw: guess.raw, square });

    if (!isValidGuess(guess, exploreBracket.low, exploreBracket.high)) {
      setWrongProbe({ guess, square });
      return;
    }

    setWrongProbe(null);
    const newBracket = refineBracket(exploreBracket, guess, area);
    setExploreBracket(newBracket);
    if (confirmLocked) {
      setProbedSinceLock(true);
      tryUnlock(newBracket, confirmStage);
    }
  }, [area, exploreBracket, phase, probeInput, tryUnlock, confirmLocked, confirmStage]);

  const submitConfirm = useCallback(() => {
    if (!area || !exploreBracket || phase !== "explore" || confirmLocked)
      return;

    if (confirmStage === "integer") {
      const parsed = parseSideInput(confirmInput);
      if (!parsed.ok) {
        setConfirmError(parseSideInputErrorMessage(parsed.error));
        return;
      }

      const correct = getCorrectIntegerPart(area);
      if (compareDecimal(parsed.value, correct) !== 0) {
        setConfirmLocked(true);
        setProbedSinceLock(false);
        setConfirmError(null);
        setConfirmInput("");
        setExploreBracket(getInitialBracket(area));
        setWrongProbe(null);
        return;
      }

      setConfirmError(null);
      setConfirmed(parsed.value);
      setConfirmStage("decimal");
      setDecimalIndex(0);
      const nextBracket = getRequiredBracket(parsed.value, area);
      setExploreBracket(nextBracket);
      setHistory((h) => [
        ...h,
        {
          label: "정수부",
          value: parsed.value.raw,
          square: squareSide(parsed.value),
        },
      ]);
      setConfirmInput("");
      return;
    }

    if (!/^\d$/.test(confirmInput.trim())) {
      setConfirmError("0~9 한 자리 숫자를 입력해 주세요.");
      return;
    }

    const digit = Number.parseInt(confirmInput.trim(), 10);
    if (!confirmed) return;

    const correctDigit = getCorrectNextDigit(confirmed, area);
    if (digit !== correctDigit) {
      setConfirmLocked(true);
      setProbedSinceLock(false);
      setConfirmError(null);
      setConfirmInput("");
      setWrongProbe(null);
      return;
    }

    const next = appendDigit(confirmed, digit);
    setConfirmError(null);
    setConfirmed(next);
    setConfirmInput("");
    setHistory((h) => [
      ...h,
      {
        label: `소수 ${decimalIndex + 1}번째`,
        value: next.raw,
        square: squareSide(next),
      },
    ]);

    if (decimalIndex + 1 >= MAX_DECIMAL_DIGITS) {
      setPhase("complete");
    } else {
      setDecimalIndex((i) => i + 1);
      const nextBracket = getRequiredBracket(next, area);
      setExploreBracket(nextBracket);
    }
  }, [
    area,
    exploreBracket,
    phase,
    confirmLocked,
    confirmStage,
    confirmInput,
    confirmed,
    decimalIndex,
  ]);

  const initialBracket = area ? getInitialBracket(area) : null;
  const confirmEnabled = !confirmLocked;

  const stageLabel =
    confirmStage === "integer"
      ? "정수부 확정"
      : `소수 ${decimalIndex + 1}번째 자릿수 확정`;

  return (
    <div className="flex flex-col gap-6">
      <section className="quest-card bg-gradient-to-br from-lavender/50 to-sky/30 p-5 sm:p-7">
        <p className="text-sm font-bold text-wood">중3 · 1. 제곱근과 실수</p>
        <h1 className="font-display mt-1 text-3xl text-foreground sm:text-4xl">
          정사각형으로 만나는 무리수
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-foreground/75 sm:text-base">
          넓이가 정수인 정사각형의 한 변 길이를 찾아 보세요. 정수부를 확정한 뒤
          소수점 아래 자릿수를 하나씩 열어 가며, 탐색으로 넓이를 비교하고 확신이
          들면 해당 자릿수를 확정합니다. 제곱값은 자동으로 계산해 드립니다.
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
            완전제곱수가 아닌 넓이를 골라, 소수점 아래 10번째 자리까지 찾아
            보세요.
          </p>
        </section>
      ) : null}

      {phase === "explore" && area && exploreBracket ? (
        <>
          <section className="quest-card p-5 sm:p-8">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-bold text-wood">넓이 {area}</p>
              {initialBracket ? (
                <p className="font-mono text-xs text-foreground/55">
                  {squareInt(Number(initialBracket.low.raw))} &lt; {area} &lt;{" "}
                  {squareInt(Number(initialBracket.high.raw))}
                </p>
              ) : null}
            </div>

            <div className="mb-6">
              <DigitDisplay
                confirmed={confirmed}
                confirmStage={confirmStage}
                decimalIndex={decimalIndex}
              />
            </div>

            <SquareDiagram
              area={area}
              bracket={exploreBracket}
              wrong={wrongProbe}
            />

            <div className="mx-auto mt-8 grid max-w-lg gap-6 sm:grid-cols-2">
              <div>
                <label className="flex flex-col items-center gap-2">
                  <span className="text-xs font-bold text-wood/70">
                    탐색해 보기
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={probeInput}
                    onChange={(e) => {
                      setProbeInput(e.target.value);
                      setProbeError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submitProbe();
                    }}
                    className="w-full rounded-2xl border-2 border-wood/20 bg-white/85 px-4 py-3 text-center font-display text-2xl font-bold text-foreground outline-none focus:border-sky sm:text-3xl"
                    aria-label="탐색용 변 길이"
                  />
                </label>
                {lastProbeSquare ? (
                  <p className="mt-2 text-center font-mono text-xs text-foreground/70">
                    {lastProbeSquare.raw}² ={" "}
                    <span className="font-semibold text-wood">
                      {lastProbeSquare.square}
                    </span>
                  </p>
                ) : null}
                {probeError ? (
                  <p
                    className="mt-2 text-center text-xs font-semibold text-[#a63a1a]"
                    role="alert"
                  >
                    {probeError}
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={submitProbe}
                  className="mt-3 w-full rounded-2xl bg-sky/60 py-2.5 text-sm font-bold text-wood"
                >
                  비교하기
                </button>
              </div>

              <div>
                <label className="flex flex-col items-center gap-2">
                  <span className="text-xs font-bold text-wood/70">
                    {stageLabel}
                  </span>
                  <input
                    type="text"
                    inputMode={
                      confirmStage === "integer" ? "numeric" : "numeric"
                    }
                    value={confirmInput}
                    disabled={!confirmEnabled}
                    onChange={(e) => {
                      setConfirmInput(e.target.value);
                      setConfirmError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && confirmEnabled) submitConfirm();
                    }}
                    className="w-full rounded-2xl border-2 border-wood/20 bg-white/85 px-4 py-3 text-center font-display text-2xl font-bold text-foreground outline-none focus:border-lavender disabled:cursor-not-allowed disabled:opacity-45 sm:text-3xl"
                    aria-label={
                      confirmStage === "integer"
                        ? "정수부 입력"
                        : "소수 자릿수 입력"
                    }
                    maxLength={confirmStage === "decimal" ? 1 : undefined}
                  />
                </label>
                {confirmError ? (
                  <p
                    className="mt-2 text-center text-xs font-semibold text-[#a63a1a]"
                    role="alert"
                  >
                    {confirmError}
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={submitConfirm}
                  disabled={!confirmEnabled}
                  className="block-btn-lavender mt-3 w-full rounded-2xl py-2.5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-45"
                >
                  정답확인
                </button>
              </div>
            </div>
          </section>

          {history.length > 0 ? (
            <section className="quest-card p-5 sm:p-7">
              <p className="mb-4 text-sm font-bold text-wood">확정 기록</p>
              <ol className="flex flex-col gap-3">
                {history.map((rec, i) => (
                  <li
                    key={`${rec.label}-${i}`}
                    className="rounded-xl bg-lavender/15 px-4 py-3 text-sm"
                  >
                    <span className="font-bold text-wood">{rec.label}</span>
                    <span className="mx-2 text-foreground/40">·</span>
                    <span className="font-mono">
                      {rec.value} → {rec.value}² = {rec.square}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </>
      ) : null}

      {phase === "complete" && area && confirmed ? (
        <section className="quest-card p-5 sm:p-8">
          <p className="text-center font-display text-2xl font-bold text-foreground">
            소수점 아래 10번째 자리까지 찾았어요
          </p>
          <p className="mx-auto mt-4 max-w-lg text-center font-mono text-lg font-semibold text-wood">
            {confirmed.raw}
          </p>
          <p className="mx-auto mt-4 max-w-lg text-center text-sm leading-relaxed text-foreground/75">
            넓이 {area}인 정사각형의 한 변 길이를 소수점 아래 10자리까지
            좁혀 왔습니다. 제곱값이 넓이 {area}과{" "}
            <strong>정확히 같아진 적은 없었습니다.</strong> 소수 자릿수를
            늘릴수록 제곱값의 소수 자릿수도 두 배로 늘어나지만, 넓이와 딱 맞는
            유한소수 제곱은 나타나지 않았어요.
          </p>

          <div className="mt-6">
            <p className="mb-3 text-sm font-bold text-wood">확정 기록</p>
            <ol className="flex flex-col gap-2">
              {history.map((rec, i) => (
                <li
                  key={`${rec.label}-${i}`}
                  className="rounded-xl bg-lavender/15 px-4 py-2 font-mono text-xs text-foreground/80 sm:text-sm"
                >
                  {rec.label}: {rec.value}² = {rec.square}
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
