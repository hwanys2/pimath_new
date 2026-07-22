"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  submitGameRun,
  type GameSubmitClientResult,
} from "@/app/adventure/actions";
import {
  MAX_DECIMAL_DIGITS,
  TARGET_AREAS,
  type Bracket,
  type ConfirmRecord,
  type DecimalValue,
  type TargetArea,
  appendDigit,
  bracketBoundsArea,
  bracketChanged,
  compareDecimal,
  getCorrectIntegerPart,
  getCorrectNextDigit,
  getRequiredBracket,
  getWideProbeBracket,
  isUnlockBracket,
  isValidGuess,
  parseSideInput,
  parseSideInputErrorMessage,
  refineBracket,
  sideToNumber,
  squareSide,
} from "@/lib/sqrt-approx-math";

const CONTENT_KEY = "g3-u1-irrational-square";
const COMPLETION_SCORE = 100;

type Phase = "select" | "explore" | "complete";
type ConfirmStage = "integer" | "decimal";

type WrongProbe = {
  guess: DecimalValue;
  square: string;
};

const VB_W = 900;
const VB_H = 280;
const GAP = 16;
const SYM_W = 24;

const COLOR_LOW = { fill: "rgba(125, 200, 245, 0.85)", stroke: "#4A90C8" };
const COLOR_LOW_OUTER = { fill: "rgba(125, 200, 245, 0.45)", stroke: "#7BB8D8" };
const COLOR_TARGET = { fill: "rgba(212, 196, 255, 0.85)", stroke: "#7B5BB5" };
const COLOR_HIGH = { fill: "rgba(255, 200, 160, 0.85)", stroke: "#D4845A" };
const COLOR_HIGH_OUTER = { fill: "rgba(255, 200, 160, 0.45)", stroke: "#E8A878" };
const COLOR_PROBE = { fill: "rgba(255, 215, 100, 0.85)", stroke: "#C9A030" };

type SquareRole =
  | "prevLow"
  | "low"
  | "target"
  | "high"
  | "prevHigh"
  | "probe";

type SquareSpec = {
  id: string;
  side: DecimalValue;
  label: string;
  sublabel?: string;
  colors: { fill: string; stroke: string };
  role: SquareRole;
};

type VisualBuild = {
  specs: SquareSpec[];
  showInequalities: boolean;
};

function inequalityLabel(spec: SquareSpec, area: number): string {
  if (spec.role === "target") return String(area);
  return squareSide(spec.side);
}

function makeSideSpec(
  id: string,
  side: DecimalValue,
  role: SquareRole,
  colors: { fill: string; stroke: string },
): SquareSpec {
  return {
    id,
    side,
    label: side.raw,
    sublabel: squareSide(side),
    colors,
    role,
  };
}

function makeTargetSpec(area: number): SquareSpec {
  const targetSide = Math.sqrt(area);
  return {
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
}

function specSideForLayout(spec: SquareSpec, area: number): number {
  if (spec.role === "target") return Math.sqrt(area);
  return sideToNumber(spec.side);
}

function sortSpecsBySide(specs: SquareSpec[], area: number): SquareSpec[] {
  return [...specs].sort(
    (a, b) => specSideForLayout(a, area) - specSideForLayout(b, area),
  );
}

function buildSquareSpecs(
  area: number,
  exploreBracket: Bracket,
  prevBracket: Bracket | null,
  wrong: WrongProbe | null,
  probeCount: number,
  lastProbe: DecimalValue | null,
): VisualBuild {
  const targetSpec = makeTargetSpec(area);

  const baseSpecsForWrong = (): SquareSpec[] => {
    const items: SquareSpec[] = [targetSpec];
    if (
      probeCount >= 2 &&
      bracketBoundsArea(exploreBracket, area) &&
      prevBracket &&
      bracketBoundsArea(prevBracket, area) &&
      bracketChanged(prevBracket, exploreBracket) &&
      probeCount >= 3
    ) {
      if (compareDecimal(prevBracket.low, exploreBracket.low) !== 0) {
        items.push(
          makeSideSpec("prevLow", prevBracket.low, "prevLow", COLOR_LOW_OUTER),
        );
      }
      items.push(makeSideSpec("low", exploreBracket.low, "low", COLOR_LOW));
      items.push(makeSideSpec("high", exploreBracket.high, "high", COLOR_HIGH));
      if (compareDecimal(prevBracket.high, exploreBracket.high) !== 0) {
        items.push(
          makeSideSpec(
            "prevHigh",
            prevBracket.high,
            "prevHigh",
            COLOR_HIGH_OUTER,
          ),
        );
      }
    } else if (probeCount >= 2 && bracketBoundsArea(exploreBracket, area)) {
      items.push(makeSideSpec("low", exploreBracket.low, "low", COLOR_LOW));
      items.push(makeSideSpec("high", exploreBracket.high, "high", COLOR_HIGH));
    } else if (lastProbe) {
      items.push({
        id: "lastProbe",
        side: lastProbe,
        label: lastProbe.raw,
        sublabel: squareSide(lastProbe),
        colors: COLOR_PROBE,
        role: "probe",
      });
    }
    return items;
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
    const sorted = sortSpecsBySide(
      [...baseSpecsForWrong(), probeSpec],
      area,
    );
    return { specs: sorted, showInequalities: false };
  }

  if (probeCount === 0) {
    return { specs: [targetSpec], showInequalities: false };
  }

  if (probeCount === 1 && lastProbe) {
    const probeSpec: SquareSpec = {
      id: "lastProbe",
      side: lastProbe,
      label: lastProbe.raw,
      sublabel: squareSide(lastProbe),
      colors: COLOR_PROBE,
      role: "probe",
    };
    const sorted = sortSpecsBySide([targetSpec, probeSpec], area);
    return { specs: sorted, showInequalities: false };
  }

  const showFive =
    probeCount >= 3 &&
    prevBracket !== null &&
    bracketBoundsArea(prevBracket, area) &&
    bracketBoundsArea(exploreBracket, area) &&
    bracketChanged(prevBracket, exploreBracket);

  if (showFive) {
    const specs: SquareSpec[] = [];

    if (compareDecimal(prevBracket.low, exploreBracket.low) !== 0) {
      specs.push(
        makeSideSpec("prevLow", prevBracket.low, "prevLow", COLOR_LOW_OUTER),
      );
    }
    specs.push(
      makeSideSpec("low", exploreBracket.low, "low", COLOR_LOW),
    );
    specs.push(targetSpec);
    specs.push(
      makeSideSpec("high", exploreBracket.high, "high", COLOR_HIGH),
    );
    if (compareDecimal(prevBracket.high, exploreBracket.high) !== 0) {
      specs.push(
        makeSideSpec(
          "prevHigh",
          prevBracket.high,
          "prevHigh",
          COLOR_HIGH_OUTER,
        ),
      );
    }
    return { specs, showInequalities: true };
  }

  if (bracketBoundsArea(exploreBracket, area)) {
    const lowSpec = makeSideSpec("low", exploreBracket.low, "low", COLOR_LOW);
    const highSpec = makeSideSpec(
      "high",
      exploreBracket.high,
      "high",
      COLOR_HIGH,
    );
    return {
      specs: [lowSpec, targetSpec, highSpec],
      showInequalities: true,
    };
  }

  if (lastProbe) {
    const probeSpec: SquareSpec = {
      id: "lastProbe",
      side: lastProbe,
      label: lastProbe.raw,
      sublabel: squareSide(lastProbe),
      colors: COLOR_PROBE,
      role: "probe",
    };
    const sorted = sortSpecsBySide([targetSpec, probeSpec], area);
    return { specs: sorted, showInequalities: false };
  }

  return { specs: [targetSpec], showInequalities: false };
}

function layoutSquares(specs: SquareSpec[], area: number) {
  const sides = specs.map((s) => specSideForLayout(s, area));
  const maxSide = Math.max(...sides, 1);
  const maxPx = specs.length >= 5 ? 72 : specs.length >= 3 ? 96 : 120;
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
  exploreBracket,
  prevBracket,
  wrong,
  probeCount,
  lastProbe,
}: {
  area: number;
  exploreBracket: Bracket;
  prevBracket: Bracket | null;
  wrong: WrongProbe | null;
  probeCount: number;
  lastProbe: DecimalValue | null;
}) {
  const visual = useMemo(
    () =>
      buildSquareSpecs(
        area,
        exploreBracket,
        prevBracket,
        wrong,
        probeCount,
        lastProbe,
      ),
    [area, exploreBracket, prevBracket, wrong, probeCount, lastProbe],
  );
  const layout = useMemo(
    () => layoutSquares(visual.specs, area),
    [visual.specs, area],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto text-center font-mono text-xs font-semibold text-foreground/80 sm:text-sm">
        {visual.showInequalities ? (
          <span className="inline-flex flex-wrap items-center justify-center gap-x-1 gap-y-1">
            {visual.specs.map((spec, i) => (
              <span key={spec.id} className="inline-flex items-center">
                {i > 0 ? (
                  <span className="mx-1 text-wood/50">&lt;</span>
                ) : null}
                <span
                  className={
                    spec.role === "target"
                      ? "text-[#6B4FA0]"
                      : spec.role === "prevLow" || spec.role === "low"
                        ? "text-sky-700"
                        : "text-[#C07040]"
                  }
                >
                  {inequalityLabel(spec, area)}
                </span>
              </span>
            ))}
          </span>
        ) : (
          <span className="text-foreground/40">&nbsp;</span>
        )}
      </div>

      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="mx-auto w-full max-w-4xl"
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
              style={{ fontSize: Math.max(9, item.size * 0.17) }}
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
                style={{ fontSize: Math.max(7, item.size * 0.11) }}
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
                  visual.showInequalities
                    ? "fill-wood/50 text-lg font-bold"
                    : "fill-wood/20 text-lg"
                }
              >
                {visual.showInequalities ? "<" : "·"}
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
  const [prevBracket, setPrevBracket] = useState<Bracket | null>(null);
  const [probeCount, setProbeCount] = useState(0);
  const [lastProbe, setLastProbe] = useState<DecimalValue | null>(null);
  const [confirmLocked, setConfirmLocked] = useState(false);
  const [history, setHistory] = useState<ConfirmRecord[]>([]);

  const [probeInput, setProbeInput] = useState("");
  const [confirmInput, setConfirmInput] = useState("");
  const [probeError, setProbeError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [wrongProbe, setWrongProbe] = useState<WrongProbe | null>(null);
  const [lastProbeSquare, setLastProbeSquare] = useState<{
    raw: string;
    square: string;
  } | null>(null);
  const [submitResult, setSubmitResult] =
    useState<GameSubmitClientResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const xpSubmittedRef = useRef(false);

  const requiredBracket = useMemo(() => {
    if (!area) return null;
    return getRequiredBracket(confirmed, area);
  }, [area, confirmed]);

  const resetProbeVisual = useCallback(() => {
    setPrevBracket(null);
    setProbeCount(0);
    setLastProbe(null);
    setWrongProbe(null);
  }, []);

  const selectArea = useCallback((n: TargetArea) => {
    setArea(n);
    setConfirmStage("integer");
    setConfirmed(null);
    setDecimalIndex(0);
    setExploreBracket(getWideProbeBracket(n));
    setConfirmLocked(false);
    setHistory([]);
    setProbeInput("");
    setConfirmInput("");
    setProbeError(null);
    setConfirmError(null);
    setLastProbeSquare(null);
    resetProbeVisual();
    setPhase("explore");
  }, [resetProbeVisual]);

  const reset = useCallback(() => {
    xpSubmittedRef.current = false;
    setSubmitResult(null);
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
    setLastProbeSquare(null);
    resetProbeVisual();
  }, [resetProbeVisual]);

  const attemptUnlock = useCallback(
    (bracket: Bracket, stage: ConfirmStage) => {
      if (!confirmLocked || !requiredBracket || !area) return false;

      const canUnlock =
        stage === "integer"
          ? true
          : isUnlockBracket(bracket, requiredBracket, area);

      if (canUnlock) {
        setConfirmLocked(false);
        setConfirmInput("");
      }
      return canUnlock;
    },
    [confirmLocked, requiredBracket, area],
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
    setPrevBracket(exploreBracket);
    const newBracket = refineBracket(exploreBracket, guess, area);
    setExploreBracket(newBracket);
    setLastProbe(guess);
    setProbeCount((c) => c + 1);
    if (confirmLocked) {
      attemptUnlock(newBracket, confirmStage);
    }
  }, [
    area,
    exploreBracket,
    phase,
    probeInput,
    attemptUnlock,
    confirmLocked,
    confirmStage,
  ]);

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
        setConfirmError(null);
        setConfirmInput("");
        setExploreBracket(getWideProbeBracket(area));
        resetProbeVisual();
        return;
      }

      setConfirmError(null);
      setConfirmed(parsed.value);
      setConfirmStage("decimal");
      setDecimalIndex(0);
      const nextBracket = getRequiredBracket(parsed.value, area);
      setExploreBracket(nextBracket);
      resetProbeVisual();
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
      resetProbeVisual();
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
    resetProbeVisual,
  ]);

  const confirmEnabled = !confirmLocked;

  useEffect(() => {
    if (phase !== "complete" || !area || xpSubmittedRef.current) return;
    xpSubmittedRef.current = true;
    startTransition(async () => {
      const result = await submitGameRun({
        contentKey: CONTENT_KEY,
        score: COMPLETION_SCORE,
      });
      setSubmitResult(result);
    });
  }, [phase, area]);

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
            <div className="mb-4">
              <p className="text-sm font-bold text-wood">넓이 {area}</p>
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
              exploreBracket={exploreBracket}
              prevBracket={prevBracket}
              wrong={wrongProbe}
              probeCount={probeCount}
              lastProbe={lastProbe}
            />

            <div className="mx-auto mt-8 grid max-w-lg gap-6 sm:grid-cols-2">
              <div>
                <label className="flex flex-col items-center gap-2">
                  <span className="text-center text-xs font-bold text-wood/70">
                    정사각형의 한 변의 길이를 입력하세요
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
        <section
          className="quest-card border-mint/40 bg-gradient-to-br from-mint/45 via-lavender/25 to-gold/30 p-5 sm:p-8"
          role="status"
          aria-live="polite"
        >
          <p className="text-center font-display text-3xl font-bold text-wood sm:text-4xl">
            축하해요!
          </p>
          <p className="mt-2 text-center text-sm font-semibold text-foreground/75">
            소수점 아래 10번째 자리까지 모두 맞혔어요
          </p>
          <p className="mx-auto mt-4 max-w-lg text-center font-mono text-lg font-semibold text-wood">
            {confirmed.raw}
          </p>

          {isPending && !submitResult ? (
            <p className="mt-4 text-center text-sm font-bold text-wood/70">
              경험치 반영 중…
            </p>
          ) : null}

          {submitResult?.error ? (
            <p className="mt-4 text-center text-sm font-bold text-[#a63a1a]">
              {submitResult.error}
            </p>
          ) : null}

          {submitResult && !submitResult.error ? (
            submitResult.recorded ? (
              <p className="mt-4 text-center text-base font-bold text-wood">
                +{submitResult.xpAwarded ?? submitResult.score} XP 획득!
                {submitResult.leveledUp && submitResult.level != null
                  ? ` 레벨 업! Lv.${submitResult.level}`
                  : submitResult.level != null
                    ? ` (Lv.${submitResult.level})`
                    : ""}
              </p>
            ) : (
              <p className="mx-auto mt-4 max-w-md rounded-2xl bg-wood/5 px-4 py-3 text-center text-sm font-semibold text-foreground/65">
                연습 모드 · 경험치는 반영되지 않아요
                <span className="mt-1 block text-xs font-medium text-foreground/50">
                  학급에 배정·활성화된 콘텐츠를 학생 로그인으로 완료하면 XP가
                  쌓여요.
                </span>
              </p>
            )
          ) : null}

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
