"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import type { RankingMode, RankingRow, RankingScope } from "@/lib/game-types";
import GameRankingBoard from "@/components/games/GameRankingBoard";
import AngleDisplay from "@/components/games/AngleDisplay";
import {
  submitGameRun,
  fetchGameRanking,
  type GameSubmitClientResult,
} from "@/app/adventure/actions";
import {
  STEPS,
  CORRECTS_PER_STAGE,
  START_LIVES,
  MAX_LIVES,
  FINAL_TOLERANCE,
  type AngleStep,
  dealAngle,
  isCorrect,
  nextStep,
  pointsForCorrect,
  clampScore,
  applyScoreGain,
} from "@/lib/angle-guess-math";

const CONTENT_KEY = "g1-u3-1-angle-guess";

type Phase = "ready" | "playing" | "feedback" | "levelup" | "ended";

type Feedback = {
  correct: boolean;
  gained: number;
  target: number;
  guess: number;
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

function StepBadge({ step }: { step: AngleStep }) {
  return (
    <span className="rounded-xl bg-sky/40 px-3 py-1 tabular-nums">
      {step}도 간격
    </span>
  );
}

function StageProgress({
  step,
  correctsInStage,
}: {
  step: AngleStep;
  correctsInStage: number;
}) {
  if (step === 1) {
    return (
      <span className="rounded-xl bg-mint/35 px-3 py-1 text-xs sm:text-sm">
        최종 단계 · ±{FINAL_TOLERANCE}도
      </span>
    );
  }
  return (
    <span className="rounded-xl bg-mint/35 px-3 py-1 tabular-nums text-xs sm:text-sm">
      단계 {correctsInStage}/{CORRECTS_PER_STAGE}
    </span>
  );
}

export default function AngleGuess() {
  const [phase, setPhase] = useState<Phase>("ready");
  const [step, setStep] = useState<AngleStep>(30);
  const [target, setTarget] = useState(90);
  const [roundId, setRoundId] = useState(0);
  const [correctsInStage, setCorrectsInStage] = useState(0);
  const [lives, setLives] = useState(START_LIVES);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [totalCorrect, setTotalCorrect] = useState(0);
  const [guessText, setGuessText] = useState("");
  const [animDone, setAnimDone] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [pendingStep, setPendingStep] = useState<AngleStep | null>(null);
  const [flashOx, setFlashOx] = useState<"O" | "X" | null>(null);
  const [submitResult, setSubmitResult] =
    useState<GameSubmitClientResult | null>(null);
  const [ranking, setRanking] = useState<RankingRow[]>([]);
  const [rankingScope, setRankingScope] = useState<RankingScope>("class");
  const [rankingMode, setRankingMode] = useState<RankingMode>("best");
  const [isPending, startTransition] = useTransition();

  const phaseRef = useRef<Phase>(phase);
  phaseRef.current = phase;
  const inputRef = useRef<HTMLInputElement>(null);

  const dealNext = useCallback((nextStepValue: AngleStep) => {
    setStep(nextStepValue);
    setTarget(dealAngle(nextStepValue));
    setRoundId((id) => id + 1);
    setGuessText("");
    setAnimDone(false);
    setFeedback(null);
    setFlashOx(null);
    setPhase("playing");
  }, []);

  const startFresh = useCallback(() => {
    setLives(START_LIVES);
    setScore(0);
    setStreak(0);
    setTotalCorrect(0);
    setCorrectsInStage(0);
    setPendingStep(null);
    setSubmitResult(null);
    setRanking([]);
    setRankingScope("class");
    setRankingMode("best");
    dealNext(30);
  }, [dealNext]);

  const endRun = useCallback(
    (finalScore: number) => {
      setPhase("ended");
      startTransition(async () => {
        const result = await submitGameRun({
          contentKey: CONTENT_KEY,
          score: finalScore,
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
    },
    [startTransition],
  );

  const submitGuess = useCallback(() => {
    if (phaseRef.current !== "playing" || !animDone) return;
    const parsed = Number(guessText.trim());
    if (!Number.isFinite(parsed)) return;

    phaseRef.current = "feedback";
    const correct = isCorrect(parsed, target, step);
    setFlashOx(correct ? "O" : "X");

    let nextLives = lives;
    let nextScore = score;
    let nextStreak = streak;
    let nextCorrectsInStage = correctsInStage;
    let nextTotalCorrect = totalCorrect;
    let gained = 0;
    let willLevelUp: AngleStep | null = null;

    if (correct) {
      const raw = pointsForCorrect(step, streak);
      nextScore = applyScoreGain(score, raw);
      gained = nextScore - score;
      nextStreak = streak + 1;
      nextTotalCorrect = totalCorrect + 1;
      nextCorrectsInStage = correctsInStage + 1;

      if (step !== 1 && nextCorrectsInStage >= CORRECTS_PER_STAGE) {
        willLevelUp = nextStep(step);
      }
    } else {
      nextLives = lives - 1;
      nextStreak = 0;
    }

    setScore(nextScore);
    setStreak(nextStreak);
    setLives(nextLives);
    setCorrectsInStage(nextCorrectsInStage);
    setTotalCorrect(nextTotalCorrect);
    setFeedback({
      correct,
      gained,
      target,
      guess: Math.round(parsed),
    });
    setPhase("feedback");

    if (nextLives <= 0) {
      window.setTimeout(() => endRun(nextScore), 1000);
      return;
    }

    if (willLevelUp) {
      setPendingStep(willLevelUp);
      window.setTimeout(() => {
        setPhase("levelup");
      }, 1100);
      return;
    }
  }, [
    animDone,
    guessText,
    target,
    step,
    lives,
    score,
    streak,
    correctsInStage,
    totalCorrect,
    endRun,
  ]);

  useEffect(() => {
    if (phase !== "feedback" || lives <= 0 || pendingStep) return;
    const id = window.setTimeout(() => {
      dealNext(step);
    }, 1200);
    return () => window.clearTimeout(id);
  }, [phase, feedback, lives, pendingStep, step, dealNext]);

  useEffect(() => {
    if (phase !== "levelup" || !pendingStep) return;
    const id = window.setTimeout(() => {
      const next = pendingStep;
      setPendingStep(null);
      setCorrectsInStage(0);
      dealNext(next);
    }, 2200);
    return () => window.clearTimeout(id);
  }, [phase, pendingStep, dealNext]);

  useEffect(() => {
    if (phase === "playing" && animDone) {
      inputRef.current?.focus();
    }
  }, [phase, animDone, roundId]);

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

  const canSubmit =
    phase === "playing" && animDone && guessText.trim().length > 0;

  return (
    <div className="flex flex-col gap-5">
      <section className="quest-card bg-gradient-to-br from-mint/40 via-sky/20 to-gold/25 p-5 sm:p-7">
        <p className="text-sm font-bold text-wood">중1 · 3.1 기본도형</p>
        <h1 className="font-display mt-1 text-3xl text-foreground sm:text-4xl">
          각도 맞히기
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-foreground/75 sm:text-base">
          벌어지는 각을 보고 크기를 맞혀 보세요. 처음엔 {STEPS[0]}도 간격,
          그다음 {STEPS[1]}도 → {STEPS[2]}도 → 최종 {STEPS[3]}도(±
          {FINAL_TOLERANCE}도). 생명은 {START_LIVES}개예요.
        </p>
      </section>

      {phase === "ready" ? (
        <section className="quest-card p-5 text-center sm:p-8">
          <p className="text-sm font-semibold text-foreground/70">
            각이 0도에서 벌어지는 모습을 잘 보고, 몇 도인지 입력하세요.
          </p>
          <ul className="mx-auto mt-4 max-w-md space-y-2 text-left text-sm font-semibold text-wood/80">
            <li>· 단계마다 정답 {CORRECTS_PER_STAGE}문제 → 다음 간격으로 승급</li>
            <li>· 30·10·5도는 정확히 일치해야 해요</li>
            <li>· 1도 단계는 ±{FINAL_TOLERANCE}도까지 인정</li>
          </ul>
          <button
            type="button"
            onClick={startFresh}
            className="mt-6 rounded-xl bg-wood px-8 py-3 text-base font-bold text-cream"
          >
            시작하기
          </button>
        </section>
      ) : null}

      {phase === "levelup" && pendingStep ? (
        <section
          className="quest-card border-gold/50 bg-gradient-to-br from-gold/45 via-mint/30 to-sky/35 p-6 text-center sm:p-10"
          role="status"
          aria-live="polite"
        >
          <p className="text-sm font-bold tracking-wide text-wood/70 uppercase">
            레벨 업
          </p>
          <p className="font-display mt-3 text-3xl text-wood sm:text-5xl">
            이제{" "}
            <span className="text-foreground">{pendingStep}도</span> 간격!
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-sm font-bold text-wood">
            {STEPS.map((s, i) => {
              const pendingIdx = STEPS.indexOf(pendingStep);
              return (
                <span
                  key={s}
                  className={[
                    "rounded-xl px-3 py-1.5",
                    s === pendingStep
                      ? "bg-wood text-cream"
                      : i < pendingIdx
                        ? "bg-mint/50 text-wood"
                        : "bg-wood/10 text-wood/40",
                  ].join(" ")}
                >
                  {s}°
                </span>
              );
            })}
          </div>
          {pendingStep === 1 ? (
            <p className="mt-4 text-sm font-semibold text-foreground/65">
              최종 단계 · ±{FINAL_TOLERANCE}도까지 허용돼요
            </p>
          ) : null}
        </section>
      ) : null}

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
            정답 {totalCorrect}문제 · {step}도 간격까지
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
      ) : null}

      {phase === "playing" || phase === "feedback" ? (
        <>
          <section className="quest-card p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Hearts lives={lives} max={MAX_LIVES} />
              <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-wood">
                <StepBadge step={step} />
                <StageProgress
                  step={step}
                  correctsInStage={correctsInStage}
                />
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

            <div className="relative mt-4">
              <AngleDisplay
                degrees={target}
                animKey={roundId}
                onAnimComplete={() => setAnimDone(true)}
              />
              {flashOx ? (
                <div
                  className="pointer-events-none absolute inset-0 flex items-center justify-center animate-pulse"
                  aria-hidden
                >
                  <span
                    className={[
                      "font-display text-[6rem] font-black sm:text-[8rem]",
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
                  "mt-2 rounded-2xl px-4 py-3 text-center text-base font-bold",
                  feedback.correct
                    ? "bg-mint/40 text-wood"
                    : "bg-[#e85d4c]/15 text-[#a63a1a]",
                ].join(" ")}
                role="status"
              >
                {feedback.correct
                  ? `정답! ${feedback.target}도예요 (+${feedback.gained}점)`
                  : `아쉬워요. 정답은 ${feedback.target}도예요 (입력 ${feedback.guess}도)`}
              </p>
            ) : null}

            {phase === "playing" ? (
              <form
                className="mt-4 flex flex-col items-center gap-3 sm:flex-row sm:justify-center"
                onSubmit={(e) => {
                  e.preventDefault();
                  submitGuess();
                }}
              >
                <label className="sr-only" htmlFor="angle-guess-input">
                  각도 입력
                </label>
                <div className="flex items-center gap-2">
                  <input
                    ref={inputRef}
                    id="angle-guess-input"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={180}
                    step={1}
                    value={guessText}
                    disabled={!animDone}
                    onChange={(e) => setGuessText(e.target.value)}
                    placeholder={animDone ? "몇 도?" : "각이 벌어지는 중…"}
                    className="w-36 rounded-xl border-2 border-wood/20 bg-white/90 px-4 py-3 text-center text-lg font-bold tabular-nums text-foreground outline-none focus:border-mint disabled:opacity-50"
                  />
                  <span className="text-base font-bold text-wood">도</span>
                </div>
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="rounded-xl bg-wood px-6 py-3 text-base font-bold text-cream disabled:opacity-40"
                >
                  맞히기
                </button>
              </form>
            ) : null}

            {phase === "playing" && !animDone ? (
              <p className="mt-3 text-center text-xs font-semibold text-foreground/50">
                각이 0도에서 벌어지는 모습을 잘 보세요
              </p>
            ) : null}
          </section>
        </>
      ) : null}
    </div>
  );
}
