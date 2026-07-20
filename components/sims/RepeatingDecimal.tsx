"use client";

import { useCallback, useMemo, useState } from "react";
import {
  DEFAULT_VISIBLE_DIGITS,
  DIGITS_STEP,
  formatReducedFraction,
  formatSignedIntegerPart,
  generateDecimalDigits,
  parseFractionErrorMessage,
  parseFractionInputs,
} from "@/lib/repeating-decimal-math";

export default function RepeatingDecimal() {
  const [numeratorInput, setNumeratorInput] = useState("1");
  const [denominatorInput, setDenominatorInput] = useState("3");
  const [visibleDigits, setVisibleDigits] = useState(DEFAULT_VISIBLE_DIGITS);

  const parsed = useMemo(
    () => parseFractionInputs(numeratorInput, denominatorInput),
    [numeratorInput, denominatorInput],
  );

  const result = parsed.ok ? parsed.result : null;
  const errorMessage = parsed.ok
    ? null
    : parsed.error === "empty"
      ? null
      : parseFractionErrorMessage(parsed.error);

  const decimalExpansion = useMemo(() => {
    if (!result) return "";
    return generateDecimalDigits(result, visibleDigits);
  }, [result, visibleDigits]);

  const resetVisibleDigits = useCallback(() => {
    setVisibleDigits(DEFAULT_VISIBLE_DIGITS);
  }, []);

  const handleNumeratorChange = useCallback(
    (value: string) => {
      setNumeratorInput(value);
      resetVisibleDigits();
    },
    [resetVisibleDigits],
  );

  const handleDenominatorChange = useCallback(
    (value: string) => {
      setDenominatorInput(value);
      resetVisibleDigits();
    },
    [resetVisibleDigits],
  );

  const showMoreDigits = useCallback(() => {
    setVisibleDigits((count) => count + DIGITS_STEP);
  }, []);

  const canShowMore =
    result != null &&
    (result.kind === "repeating" ||
      decimalExpansion.length < result.prePeriod.length);

  return (
    <div className="flex flex-col gap-6">
      <section className="quest-card bg-gradient-to-br from-peach/35 to-sky/25 p-5 sm:p-7">
        <p className="text-sm font-bold text-wood">중2 · 1. 유리수와 순환소수</p>
        <h1 className="font-display mt-1 text-3xl text-foreground sm:text-4xl">
          분수를 순환소수로
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-foreground/75 sm:text-base">
          분자와 분모를 넣으면 소수로 바꿔 주고, 순환마디 길이를 알려 줍니다.
          점수는 없고, 개념을 눈으로 익히는 시뮬레이션입니다.
        </p>
      </section>

      <section className="quest-card p-5 sm:p-8">
        <p className="mb-5 text-center text-sm font-semibold text-foreground/70">
          분수를 입력해 보세요
        </p>

        <div className="mx-auto flex max-w-md flex-col items-center gap-3">
          <label className="flex w-full flex-col items-center gap-2">
            <span className="text-xs font-bold text-wood/70">분자</span>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={numeratorInput}
              onChange={(e) => handleNumeratorChange(e.target.value)}
              className="w-full max-w-[220px] rounded-2xl border-2 border-wood/20 bg-white/85 px-4 py-3 text-center font-display text-4xl font-bold text-foreground outline-none focus:border-peach sm:text-5xl"
              aria-label="분자"
            />
          </label>

          <div
            aria-hidden
            className="h-1 w-full max-w-[240px] rounded-full bg-wood/35"
          />

          <label className="flex w-full flex-col items-center gap-2">
            <span className="text-xs font-bold text-wood/70">분모</span>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={denominatorInput}
              onChange={(e) => handleDenominatorChange(e.target.value)}
              className="w-full max-w-[220px] rounded-2xl border-2 border-wood/20 bg-white/85 px-4 py-3 text-center font-display text-4xl font-bold text-foreground outline-none focus:border-peach sm:text-5xl"
              aria-label="분모"
            />
          </label>
        </div>

        {errorMessage ? (
          <p
            className="mt-5 rounded-xl bg-peach/40 px-4 py-3 text-center text-sm font-semibold text-[#a63a1a]"
            role="alert"
          >
            {errorMessage}
          </p>
        ) : null}
      </section>

      {result ? (
        <section className="quest-card p-5 sm:p-7">
          <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
            <div className="flex flex-col gap-3">
              <p className="text-sm font-bold text-wood">요약</p>
              <div className="flex flex-1 flex-col rounded-2xl bg-peach/15 px-4 py-4">
                <p className="text-sm font-semibold text-foreground/80">
                  기약분수:{" "}
                  <span className="font-display text-lg">
                    {formatReducedFraction(result)}
                  </span>
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground/75">
                  {result.kind === "terminating" ? (
                    <>유한소수입니다.</>
                  ) : (
                    <>
                      순환소수 · 순환마디 길이{" "}
                      <span className="font-display text-lg text-wood">
                        {result.periodLength}
                      </span>
                    </>
                  )}
                </p>
                {result.kind === "repeating" ? (
                  <>
                    {result.periodLength > 20 ? (
                      <p className="mt-2 text-xs font-medium text-foreground/60">
                        순환마디가 {result.periodLength}자리입니다. 오른쪽에서
                        더 많은 소수 자릿수를 확인할 수 있어요.
                      </p>
                    ) : null}
                    <p className="mt-2 break-all text-xs font-medium text-foreground/60">
                      순환마디:{" "}
                      <span className="font-mono text-sm text-foreground/75">
                        {result.period.length > 80
                          ? `${result.period.slice(0, 80)}…`
                          : result.period}
                      </span>
                    </p>
                  </>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-wood">소수 전개</p>
                  <p className="mt-1 text-xs text-foreground/60">
                    소수점 아래 {visibleDigits}자리까지 표시 중
                  </p>
                </div>
                {canShowMore ? (
                  <button
                    type="button"
                    onClick={showMoreDigits}
                    className="rounded-xl bg-peach/70 px-4 py-2 text-sm font-bold text-wood"
                  >
                    더 보기 (+{DIGITS_STEP}자리)
                  </button>
                ) : null}
              </div>

              <div className="flex-1 overflow-x-auto rounded-2xl bg-peach/15 px-4 py-4">
                <p className="font-mono text-sm leading-relaxed break-all text-foreground/85 sm:text-base">
                  {formatSignedIntegerPart(result.sign, result.integerPart)}.
                  {decimalExpansion || "0"}
                </p>
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
