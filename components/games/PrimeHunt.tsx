"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import type { RankingMode, RankingRow, RankingScope } from "@/lib/game-types";
import GameRankingBoard from "@/components/games/GameRankingBoard";
import {
  submitGameRun,
  fetchGameRanking,
  type GameSubmitClientResult,
} from "@/app/adventure/actions";
import {
  START_LIVES,
  MAX_LIVES,
  MAX_TRIALS,
  clampScore,
  dealOddNumber,
  isBonusRound,
  isPrime,
  pointsForCorrect,
  primesUpToSqrt,
} from "@/lib/prime-math";

const CONTENT_KEY = "g1-u1-1-prime-hunt";

type Trial = {
  prime: number;
  quotient: number;
  remainder: number;
};

type Phase = "playing" | "feedback" | "ended";

type Feedback = {
  correct: boolean;
  wasPrime: boolean;
  gained: number;
  lifeDelta: number;
  bonus: boolean;
};

function Hearts({ lives, max }: { lives: number; max: number }) {
  return (
    <div className="flex items-center gap-1.5" aria-label={`생명 ${lives}개`}>
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className={[
            "inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-black transition",
            i < lives
              ? "bg-[#e85d4c] text-white shadow-sm"
              : "bg-wood/10 text-wood/25",
          ].join(" ")}
          aria-hidden
        >
          ♥
        </span>
      ))}
    </div>
  );
}

export default function PrimeHunt() {
  const [round, setRound] = useState(1);
  const [n, setN] = useState(() => dealOddNumber(1));
  const [lives, setLives] = useState(START_LIVES);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [trials, setTrials] = useState<Trial[]>([]);
  const [usedPrimes, setUsedPrimes] = useState<number[]>([]);
  const [bonus, setBonus] = useState(false);
  const [lastBonusRound, setLastBonusRound] = useState(0);
  const [phase, setPhase] = useState<Phase>("playing");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [flashOx, setFlashOx] = useState<"O" | "X" | null>(null);
  const [submitResult, setSubmitResult] = useState<GameSubmitClientResult | null>(
    null,
  );
  const [ranking, setRanking] = useState<RankingRow[]>([]);
  const [rankingScope, setRankingScope] = useState<RankingScope>("class");
  const [rankingMode, setRankingMode] = useState<RankingMode>("best");
  const [isPending, startTransition] = useTransition();

  const helperPrimes = primesUpToSqrt(n);
  const trialsLeft = MAX_TRIALS - trials.length;

  const resetBoard = useCallback((nextRound: number, prevBonusRound: number) => {
    const nextBonus = isBonusRound(nextRound, prevBonusRound);
    setRound(nextRound);
    setN(dealOddNumber(nextRound));
    setTrials([]);
    setUsedPrimes([]);
    setBonus(nextBonus);
    if (nextBonus) setLastBonusRound(nextRound);
    setPhase("playing");
    setFeedback(null);
    setFlashOx(null);
  }, []);

  const startFresh = useCallback(() => {
    setLives(START_LIVES);
    setScore(0);
    setStreak(0);
    setLastBonusRound(0);
    setSubmitResult(null);
    setRanking([]);
    setRankingScope("class");
    setRankingMode("best");
    resetBoard(1, 0);
  }, [resetBoard]);

  const tryDivide = (p: number) => {
    if (phase !== "playing" || trials.length >= MAX_TRIALS) return;
    if (usedPrimes.includes(p)) return;
    const quotient = Math.floor(n / p);
    const remainder = n % p;
    setTrials((prev) => [...prev, { prime: p, quotient, remainder }]);
    setUsedPrimes((prev) => [...prev, p]);
  };

  const answer = (saysPrime: boolean) => {
    if (phase !== "playing") return;
    const actuallyPrime = isPrime(n);
    const correct = saysPrime === actuallyPrime;
    setFlashOx(saysPrime ? "O" : "X");

    let nextLives = lives;
    let nextScore = score;
    let nextStreak = streak;
    let lifeDelta = 0;
    let gained = 0;

    if (correct) {
      gained = pointsForCorrect(n, streak);
      if (bonus) gained += 10;
      nextScore = clampScore(score + gained);
      nextStreak = streak + 1;
      if (bonus && lives < MAX_LIVES) {
        nextLives = lives + 1;
        lifeDelta = 1;
      }
    } else {
      nextLives = lives - 1;
      lifeDelta = -1;
      nextStreak = 0;
    }

    setScore(nextScore);
    setStreak(nextStreak);
    setLives(nextLives);
    setFeedback({
      correct,
      wasPrime: actuallyPrime,
      gained,
      lifeDelta,
      bonus,
    });
    setPhase("feedback");

    if (nextLives <= 0) {
      // End after short feedback beat
      window.setTimeout(() => {
        setPhase("ended");
        startTransition(async () => {
          const result = await submitGameRun({
            contentKey: CONTENT_KEY,
            score: nextScore,
          });
          setSubmitResult(result);
          if (result.recorded) {
            const rows = await fetchGameRanking({
              contentKey: CONTENT_KEY,
              scope: "class",
              mode: "best",
            });
            setRanking(rows);
          }
        });
      }, 900);
    }
  };

  const continueAfterFeedback = () => {
    if (phase !== "feedback" || lives <= 0) return;
    resetBoard(round + 1, lastBonusRound);
  };

  useEffect(() => {
    if (phase !== "feedback" || lives <= 0) return;
    const id = window.setTimeout(() => {
      continueAfterFeedback();
    }, 1100);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-arm when feedback appears
  }, [phase, feedback, lives]);

  const loadRanking = (next: {
    scope?: RankingScope;
    mode?: RankingMode;
  }) => {
    const scope = next.scope ?? rankingScope;
    const mode = next.mode ?? rankingMode;
    if (next.scope) setRankingScope(next.scope);
    if (next.mode) setRankingMode(next.mode);
    startTransition(async () => {
      const rows = await fetchGameRanking({
        contentKey: CONTENT_KEY,
        scope,
        mode,
      });
      setRanking(rows);
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <section className="quest-card bg-gradient-to-br from-mint/40 via-sky/20 to-gold/25 p-5 sm:p-7">
        <p className="text-sm font-bold text-wood">중1 · 1.1 소인수분해</p>
        <h1 className="font-display mt-1 text-3xl text-foreground sm:text-4xl">
          소수 찾기
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-foreground/75 sm:text-base">
          점점 커지는 홀수가 나와요. 제곱근보다 작은 소수로 최대 {MAX_TRIALS}
          번 나눠 본 뒤, 소수인지 아닌지 큰 O / X 로 판정하세요. 생명은{" "}
          {START_LIVES}개, 보너스 문항에서 회복할 수 있어요.
        </p>
      </section>

      {phase === "ended" ? (
        <section
          className="quest-card border-mint/40 bg-gradient-to-br from-mint/45 via-sky/25 to-gold/30 p-5 text-center sm:p-7"
          role="status"
          aria-live="polite"
        >
          <p className="font-display text-3xl text-wood sm:text-4xl">
            {clampScore(score)}점
          </p>
          <p className="mt-2 text-sm font-semibold text-foreground/70">
            {round}라운드까지 도전했어요
          </p>

          {isPending && !submitResult ? (
            <p className="mt-4 text-sm font-bold text-wood/70">점수 반영 중…</p>
          ) : null}

          {submitResult?.error ? (
            <p className="mt-4 text-sm font-bold text-[#a63a1a]">
              {submitResult.error}
            </p>
          ) : null}

          {submitResult && !submitResult.error ? (
            submitResult.recorded ? (
              <p className="mt-4 text-sm font-bold text-wood">
                {submitResult.message}
              </p>
            ) : (
              <p className="mt-4 rounded-2xl bg-wood/5 px-4 py-3 text-sm font-semibold text-foreground/65">
                연습 모드 · 점수는 반영되지 않아요
                <span className="mt-1 block text-xs font-medium text-foreground/50">
                  학급에 배정·활성화된 게임을 학생 로그인으로 플레이하면 XP와
                  랭킹이 쌓여요.
                </span>
              </p>
            )
          ) : null}

          {submitResult?.recorded ? (
            <div className="mt-6 text-left">
              <GameRankingBoard
                rows={ranking}
                scope={rankingScope}
                mode={rankingMode}
                onScopeChange={(scope) => loadRanking({ scope })}
                onModeChange={(mode) => loadRanking({ mode })}
                loading={isPending}
              />
            </div>
          ) : null}

          <button
            type="button"
            onClick={startFresh}
            className="mt-6 rounded-xl bg-wood px-6 py-3 text-base font-bold text-cream"
          >
            다시 하기
          </button>
        </section>
      ) : (
        <>
          <section className="quest-card p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Hearts lives={lives} max={MAX_LIVES} />
              <div className="flex flex-wrap items-center gap-3 text-sm font-bold text-wood">
                <span>라운드 {round}</span>
                <span className="rounded-xl bg-gold/50 px-3 py-1">
                  {score}점
                </span>
                {streak > 1 ? (
                  <span className="rounded-xl bg-mint/40 px-3 py-1">
                    연속 {streak}
                  </span>
                ) : null}
              </div>
            </div>

            {bonus ? (
              <p className="mt-3 rounded-xl bg-gold/40 px-3 py-2 text-center text-sm font-bold text-wood">
                보너스 · 맞히면 생명 +1
              </p>
            ) : null}

            <div className="relative mt-6 flex flex-col items-center justify-center py-6">
              <p className="text-xs font-bold tracking-wide text-wood/60 uppercase">
                이 수는 소수일까?
              </p>
              <p
                className="font-display mt-2 text-6xl font-black tabular-nums text-foreground sm:text-7xl md:text-8xl"
                aria-live="polite"
              >
                {n.toLocaleString("ko-KR")}
              </p>

              {flashOx ? (
                <div
                  className={[
                    "pointer-events-none absolute inset-0 flex items-center justify-center",
                    "animate-pulse",
                  ].join(" ")}
                  aria-hidden
                >
                  <span
                    className={[
                      "font-display text-[7rem] font-black sm:text-[9rem]",
                      flashOx === "O" ? "text-mint" : "text-[#e85d4c]",
                      "drop-shadow-sm opacity-90",
                    ].join(" ")}
                  >
                    {flashOx}
                  </span>
                </div>
              ) : null}
            </div>

            {feedback && phase === "feedback" ? (
              <p
                className={[
                  "mb-4 rounded-2xl px-4 py-3 text-center text-base font-bold",
                  feedback.correct
                    ? "bg-mint/40 text-wood"
                    : "bg-[#e85d4c]/15 text-[#a63a1a]",
                ].join(" ")}
                role="status"
              >
                {feedback.correct
                  ? `정답! ${feedback.wasPrime ? "소수" : "합성수"}예요 (+${feedback.gained}점${
                      feedback.lifeDelta > 0 ? " · 생명 +1" : ""
                    })`
                  : `아쉬워요. ${feedback.wasPrime ? "소수" : "합성수"}였어요`}
              </p>
            ) : null}

            <div className="rounded-2xl bg-mint/15 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-bold text-wood">
                  √{n.toLocaleString("ko-KR")} 이하 소수로 나눠 보기
                </p>
                <p className="text-xs font-semibold text-foreground/55">
                  남은 시도 {trialsLeft}/{MAX_TRIALS}
                </p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {helperPrimes.map((p) => {
                  const used = usedPrimes.includes(p);
                  const disabled =
                    phase !== "playing" || used || trials.length >= MAX_TRIALS;
                  return (
                    <button
                      key={p}
                      type="button"
                      disabled={disabled}
                      onClick={() => tryDivide(p)}
                      className={[
                        "rounded-xl px-3 py-2 text-sm font-bold transition",
                        used
                          ? "bg-wood/15 text-foreground/40 line-through"
                          : "bg-white/80 text-wood hover:bg-mint/50",
                        "disabled:opacity-40",
                      ].join(" ")}
                    >
                      ÷ {p}
                    </button>
                  );
                })}
              </div>

              {trials.length > 0 ? (
                <ul className="mt-3 space-y-1.5 text-sm font-semibold text-foreground/80">
                  {trials.map((t) => (
                    <li key={`${t.prime}-${t.remainder}`}>
                      {n.toLocaleString("ko-KR")} ÷ {t.prime} = {t.quotient}
                      {t.remainder === 0 ? (
                        <span className="ml-2 font-bold text-[#a63a1a]">
                          (나누어떨어짐 → 합성수)
                        </span>
                      ) : (
                        <span className="ml-2 text-foreground/55">
                          나머지 {t.remainder}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-xs text-foreground/50">
                  칩을 눌러 나눠 보세요. 나머지가 0이면 합성수예요.
                </p>
              )}
            </div>
          </section>

          <section className="grid grid-cols-2 gap-3 sm:gap-4">
            <button
              type="button"
              disabled={phase !== "playing"}
              onClick={() => answer(true)}
              aria-label="소수 O"
              className={[
                "flex min-h-[7.5rem] flex-col items-center justify-center rounded-3xl",
                "bg-gradient-to-b from-mint/80 to-mint/50 shadow-md",
                "font-display text-wood transition active:scale-[0.98]",
                "disabled:opacity-40 sm:min-h-[9rem]",
              ].join(" ")}
            >
              <span className="text-6xl font-black sm:text-7xl">O</span>
              <span className="mt-1 text-sm font-bold sm:text-base">소수</span>
            </button>
            <button
              type="button"
              disabled={phase !== "playing"}
              onClick={() => answer(false)}
              aria-label="합성수 X"
              className={[
                "flex min-h-[7.5rem] flex-col items-center justify-center rounded-3xl",
                "bg-gradient-to-b from-[#f0a090]/90 to-[#e85d4c]/55 shadow-md",
                "font-display text-white transition active:scale-[0.98]",
                "disabled:opacity-40 sm:min-h-[9rem]",
              ].join(" ")}
            >
              <span className="text-6xl font-black sm:text-7xl">X</span>
              <span className="mt-1 text-sm font-bold sm:text-base">합성수</span>
            </button>
          </section>
        </>
      )}
    </div>
  );
}
