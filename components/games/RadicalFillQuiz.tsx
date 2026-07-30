"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import type { RankingMode, RankingRow, RankingScope } from "@/lib/game-types";
import GameRankingBoard from "@/components/games/GameRankingBoard";
import {
  submitGameRun,
  fetchGameRanking,
  type GameSubmitClientResult,
} from "@/app/adventure/actions";
import {
  CONTENT_KEY,
  PROBLEMS,
  PROBLEM_COUNT,
  applyScoreGain,
  checkAnswer,
  clampScore,
  emptyFills,
  formatFixedRhs,
  hasDuplicateAmongFills,
  opLabel,
  parsePositiveInt,
  scoreForTime,
  type CheckReason,
  type RadicalProblem,
  type TermFill,
} from "@/lib/radical-fill-math";

type Phase = "ready" | "playing" | "feedback" | "ended";

type TermTexts = { coeff: string; radicand: string };

type FeedbackState = {
  correct: boolean;
  reason: CheckReason | "gave_up";
  gained: number;
};

function textsToFills(
  problem: RadicalProblem,
  texts: TermTexts[],
): TermFill[] {
  return problem.terms.map((term, i) => {
    const t = texts[i] ?? { coeff: "", radicand: "" };
    return {
      coeff: term.hasCoeff ? parsePositiveInt(t.coeff) : null,
      radicand: parsePositiveInt(t.radicand),
    };
  });
}

function emptyTexts(problem: RadicalProblem): TermTexts[] {
  return problem.terms.map((t) => ({
    coeff: t.hasCoeff ? "" : "",
    radicand: "",
  }));
}

function reasonMessage(reason: CheckReason | "gave_up"): string {
  switch (reason) {
    case "ok":
      return "정답이에요!";
    case "incomplete":
      return "빈칸을 모두 채워 주세요.";
    case "invalid":
      return "양의 정수만 입력할 수 있어요.";
    case "duplicate":
      return "모든 숫자는 서로 달라야 해요.";
    case "wrong":
      return "식이 성립하지 않아요. 0점";
    case "gave_up":
      return "포기 · 0점";
  }
}

function SlotInput({
  value,
  onChange,
  onEnter,
  wide,
  duplicate,
  inputRef,
  ariaLabel,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onEnter: () => void;
  wide?: boolean;
  duplicate?: boolean;
  inputRef?: (el: HTMLInputElement | null) => void;
  ariaLabel: string;
  disabled?: boolean;
}) {
  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete="off"
      disabled={disabled}
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => {
        const next = e.target.value.replace(/\D/g, "").slice(0, 4);
        onChange(next);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onEnter();
        }
      }}
      className={[
        "rounded-lg border-2 bg-cream text-center font-display font-bold tabular-nums text-wood outline-none transition",
        "focus:border-wood focus:ring-2 focus:ring-wood/20",
        wide
          ? "h-11 w-14 text-lg sm:h-12 sm:w-16 sm:text-xl"
          : "h-9 w-9 text-base sm:h-10 sm:w-10 sm:text-lg",
        duplicate
          ? "border-[#e85d4c] bg-[#e85d4c]/10"
          : "border-wood/25",
        disabled ? "opacity-60" : "",
      ].join(" ")}
    />
  );
}

function RadicalTermView({
  hasCoeff,
  coeff,
  radicand,
  onCoeffChange,
  onRadicandChange,
  onEnter,
  coeffDup,
  radDup,
  coeffRef,
  radRef,
  disabled,
  termIndex,
}: {
  hasCoeff: boolean;
  coeff: string;
  radicand: string;
  onCoeffChange: (v: string) => void;
  onRadicandChange: (v: string) => void;
  onEnter: () => void;
  coeffDup: boolean;
  radDup: boolean;
  coeffRef?: (el: HTMLInputElement | null) => void;
  radRef?: (el: HTMLInputElement | null) => void;
  disabled?: boolean;
  termIndex: number;
}) {
  return (
    <span className="inline-flex items-end gap-0.5">
      {hasCoeff ? (
        <SlotInput
          value={coeff}
          onChange={onCoeffChange}
          onEnter={onEnter}
          duplicate={coeffDup}
          inputRef={coeffRef}
          ariaLabel={`${termIndex + 1}번째 항 계수`}
          disabled={disabled}
        />
      ) : null}
      <span className="inline-flex flex-col items-center leading-none">
        <span
          className="select-none font-display text-2xl text-wood sm:text-3xl"
          aria-hidden
        >
          √
        </span>
        <span className="-mt-1 border-t-2 border-wood px-0.5 pt-0.5">
          <SlotInput
            value={radicand}
            onChange={onRadicandChange}
            onEnter={onEnter}
            wide
            duplicate={radDup}
            inputRef={radRef}
            ariaLabel={`${termIndex + 1}번째 항 근호 안`}
            disabled={disabled}
          />
        </span>
      </span>
    </span>
  );
}

function formatElapsed(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}:${String(r).padStart(2, "0")}` : `${r}초`;
}

export default function RadicalFillQuiz() {
  const [phase, setPhase] = useState<Phase>("ready");
  const [index, setIndex] = useState(0);
  const [texts, setTexts] = useState<TermTexts[]>([]);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [flashOx, setFlashOx] = useState<"O" | "X" | null>(null);
  const [submitResult, setSubmitResult] =
    useState<GameSubmitClientResult | null>(null);
  const [ranking, setRanking] = useState<RankingRow[]>([]);
  const [rankingScope, setRankingScope] = useState<RankingScope>("class");
  const [rankingMode, setRankingMode] = useState<RankingMode>("best");
  const [isPending, startTransition] = useTransition();

  const phaseRef = useRef<Phase>(phase);
  phaseRef.current = phase;
  const startedAtRef = useRef<number>(0);
  const inputElsRef = useRef<(HTMLInputElement | null)[]>([]);

  const problem = PROBLEMS[index] ?? PROBLEMS[0]!;

  const fills = useMemo(
    () => textsToFills(problem, texts),
    [problem, texts],
  );

  const duplicate = useMemo(
    () => hasDuplicateAmongFills(problem, fills),
    [problem, fills],
  );

  const duplicateValues = useMemo(() => {
    const nums = fills.flatMap((f, i) => {
      const out: number[] = [];
      if (problem.terms[i]?.hasCoeff && f.coeff != null) out.push(f.coeff);
      if (f.radicand != null) out.push(f.radicand);
      return out;
    });
    const counts = new Map<number, number>();
    for (const n of nums) counts.set(n, (counts.get(n) ?? 0) + 1);
    return new Set(
      [...counts.entries()].filter(([, c]) => c > 1).map(([n]) => n),
    );
  }, [fills, problem.terms]);

  const tickTimer = useCallback(() => {
    if (phaseRef.current !== "playing") return;
    setElapsed((Date.now() - startedAtRef.current) / 1000);
  }, []);

  useEffect(() => {
    if (phase !== "playing") return;
    tickTimer();
    const id = window.setInterval(tickTimer, 200);
    return () => window.clearInterval(id);
  }, [phase, index, tickTimer]);

  const focusFirst = useCallback(() => {
    window.requestAnimationFrame(() => {
      inputElsRef.current.find((el) => el)?.focus();
    });
  }, []);

  const loadProblem = useCallback(
    (i: number) => {
      const p = PROBLEMS[i]!;
      setIndex(i);
      setTexts(emptyTexts(p));
      setFeedback(null);
      setFlashOx(null);
      setElapsed(0);
      startedAtRef.current = Date.now();
      setPhase("playing");
      phaseRef.current = "playing";
      inputElsRef.current = [];
      focusFirst();
    },
    [focusFirst],
  );

  const endRun = useCallback(
    (finalScore: number) => {
      setPhase("ended");
      phaseRef.current = "ended";
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

  const advanceAfterFeedback = useCallback(
    (nextScore: number, nextCorrect: number) => {
      const nextIndex = index + 1;
      if (nextIndex >= PROBLEM_COUNT) {
        setCorrectCount(nextCorrect);
        setScore(nextScore);
        endRun(nextScore);
        return;
      }
      setCorrectCount(nextCorrect);
      setScore(nextScore);
      loadProblem(nextIndex);
    },
    [endRun, index, loadProblem],
  );

  const startFresh = useCallback(() => {
    setScore(0);
    setCorrectCount(0);
    setSubmitResult(null);
    setRanking([]);
    setRankingScope("class");
    setRankingMode("best");
    setFeedback(null);
    loadProblem(0);
  }, [loadProblem]);

  const finishProblem = useCallback(
    (gained: number, correct: boolean, reason: CheckReason | "gave_up") => {
      if (phaseRef.current !== "playing") return;
      phaseRef.current = "feedback";
      setPhase("feedback");
      setFlashOx(correct ? "O" : "X");
      const nextScore = correct ? applyScoreGain(score, gained) : score;
      const actualGain = nextScore - score;
      const nextCorrect = correct ? correctCount + 1 : correctCount;
      setFeedback({ correct, reason, gained: actualGain });
      setScore(nextScore);
      setCorrectCount(nextCorrect);

      window.setTimeout(() => {
        advanceAfterFeedback(nextScore, nextCorrect);
      }, correct ? 1200 : 1400);
    },
    [advanceAfterFeedback, correctCount, score],
  );

  const onSubmit = useCallback(() => {
    if (phaseRef.current !== "playing") return;
    const result = checkAnswer(problem, fills);
    if (result.reason === "incomplete" || result.reason === "invalid") {
      setFeedback({
        correct: false,
        reason: result.reason,
        gained: 0,
      });
      return;
    }
    if (result.reason === "duplicate") {
      setFeedback({
        correct: false,
        reason: "duplicate",
        gained: 0,
      });
      return;
    }
    // wrong or ok — one shot
    const t = (Date.now() - startedAtRef.current) / 1000;
    setElapsed(t);
    if (result.ok) {
      const gained = scoreForTime(t, problem.timeLimitSec);
      finishProblem(gained, true, "ok");
    } else {
      finishProblem(0, false, "wrong");
    }
  }, [fills, finishProblem, problem]);

  const onGiveUp = useCallback(() => {
    if (phaseRef.current !== "playing") return;
    finishProblem(0, false, "gave_up");
  }, [finishProblem]);

  const focusNextEmpty = useCallback(() => {
    const el = inputElsRef.current.find(
      (node) => node && node.value.trim() === "",
    );
    if (el) el.focus();
    else onSubmit();
  }, [onSubmit]);

  const setTermText = (
    termIndex: number,
    field: "coeff" | "radicand",
    value: string,
  ) => {
    setTexts((prev) => {
      const next = prev.map((t) => ({ ...t }));
      const cur = next[termIndex] ?? { coeff: "", radicand: "" };
      next[termIndex] = { ...cur, [field]: value };
      return next;
    });
    if (feedback && (feedback.reason === "incomplete" || feedback.reason === "duplicate" || feedback.reason === "invalid")) {
      setFeedback(null);
    }
  };

  const registerInput = (slot: number) => (el: HTMLInputElement | null) => {
    inputElsRef.current[slot] = el;
  };

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

  // Build slot index for refs (coeff + radicand in order)
  let slotCounter = 0;
  const termSlotStarts = problem.terms.map((term) => {
    const start = slotCounter;
    if (term.hasCoeff) slotCounter += 1;
    slotCounter += 1;
    return start;
  });

  const softLimit = problem.timeLimitSec;
  const projected =
    phase === "playing"
      ? scoreForTime(elapsed, softLimit)
      : feedback?.correct
        ? feedback.gained
        : 0;

  return (
    <div className="flex flex-col gap-5">
      <section className="quest-card bg-gradient-to-br from-lavender/50 via-sky/25 to-mint/30 p-5 sm:p-7">
        <p className="text-sm font-bold text-wood">중3 · 1. 제곱근과 실수</p>
        <h1 className="font-display mt-1 text-3xl text-foreground sm:text-4xl">
          근호 빈칸 채우기
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-foreground/75 sm:text-base">
          빈칸에 서로 다른 양의 정수를 넣어 등식이 성립하게 만드세요. 10문제,
          맞히면 걸린 시간에 따라 50~100점, 틀리거나 포기하면 0점이에요.
        </p>
      </section>

      {phase === "ready" ? (
        <section className="quest-card p-5 text-center sm:p-8">
          <p className="text-sm font-semibold text-foreground/70">
            근호 안의 수와 계수를 채우면 우변과 같아지도록 식을 완성합니다.
          </p>
          <ul className="mx-auto mt-4 max-w-md space-y-2 text-left text-sm font-semibold text-wood/80">
            <li>· 한 문제에 쓰는 숫자는 모두 서로 달라야 해요</li>
            <li>· 정답은 여러 가지일 수 있어요 (등식만 맞으면 OK)</li>
            <li>· 빨리 맞힐수록 높은 점수 (문제당 최대 100점)</li>
            <li>· 제출은 문제당 한 번 · 막히면 포기할 수 있어요</li>
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

      {phase === "ended" ? (
        <section
          className="quest-card border-mint/40 bg-gradient-to-br from-mint/45 via-sky/25 to-lavender/35 p-5 text-center sm:p-7"
          role="status"
          aria-live="polite"
        >
          <p className="font-display text-3xl text-wood sm:text-4xl">
            {clampScore(score)}점
          </p>
          <p className="mt-2 text-sm font-semibold text-foreground/70">
            정답 {correctCount}/{PROBLEM_COUNT}문제
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
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm font-bold text-wood">
              <span className="rounded-xl bg-lavender/40 px-3 py-1 tabular-nums">
                문제 {index + 1}/{PROBLEM_COUNT}
              </span>
              <span className="rounded-xl bg-mint/35 px-3 py-1 tabular-nums">
                점수 {clampScore(score)}
              </span>
              <span className="rounded-xl bg-sky/40 px-3 py-1 tabular-nums">
                {formatElapsed(elapsed)}
                <span className="ml-1 font-semibold text-wood/55">
                  · 예상 {projected}점
                </span>
              </span>
            </div>

            <p className="mt-4 text-center text-sm font-semibold text-foreground/70">
              다음 식이 성립하도록 빈칸에{" "}
              <span className="text-wood">서로 다른</span> 수를 넣으세요.
            </p>

            <div
              className="mt-6 flex flex-wrap items-center justify-center gap-x-2 gap-y-4 text-xl text-wood sm:text-2xl"
              aria-label="근호 식"
            >
              {problem.terms.map((term, ti) => {
                const text = texts[ti] ?? { coeff: "", radicand: "" };
                const fill = fills[ti] ?? emptyFills(problem)[ti]!;
                const start = termSlotStarts[ti]!;
                const coeffSlot = term.hasCoeff ? start : -1;
                const radSlot = term.hasCoeff ? start + 1 : start;
                return (
                  <span
                    key={`${problem.id}-t${ti}`}
                    className="inline-flex items-center gap-2"
                  >
                    {ti > 0 ? (
                      <span className="font-display font-bold text-wood/80">
                        {opLabel(problem.ops[ti - 1]!)}
                      </span>
                    ) : null}
                    <RadicalTermView
                      hasCoeff={term.hasCoeff}
                      coeff={text.coeff}
                      radicand={text.radicand}
                      onCoeffChange={(v) => setTermText(ti, "coeff", v)}
                      onRadicandChange={(v) => setTermText(ti, "radicand", v)}
                      onEnter={focusNextEmpty}
                      coeffDup={
                        fill.coeff != null && duplicateValues.has(fill.coeff)
                      }
                      radDup={
                        fill.radicand != null &&
                        duplicateValues.has(fill.radicand)
                      }
                      coeffRef={
                        term.hasCoeff ? registerInput(coeffSlot) : undefined
                      }
                      radRef={registerInput(radSlot)}
                      disabled={phase === "feedback"}
                      termIndex={ti}
                    />
                  </span>
                );
              })}
              <span className="font-display font-bold text-wood/80">=</span>
              <span className="font-display text-2xl font-bold text-foreground sm:text-3xl">
                {formatFixedRhs(problem.rhs)}
              </span>
            </div>

            {duplicate ? (
              <p
                className="mt-4 text-center text-sm font-bold text-[#a63a1a]"
                role="status"
              >
                같은 숫자가 두 번 이상 있어요. 모두 다르게 바꿔 주세요.
              </p>
            ) : null}

            {feedback &&
            phase === "playing" &&
            (feedback.reason === "incomplete" ||
              feedback.reason === "duplicate" ||
              feedback.reason === "invalid") ? (
              <p
                className="mt-3 text-center text-sm font-bold text-[#a63a1a]"
                role="status"
              >
                {reasonMessage(feedback.reason)}
              </p>
            ) : null}

            {phase === "feedback" && feedback ? (
              <div
                className={[
                  "mt-5 rounded-2xl px-4 py-3 text-center",
                  feedback.correct
                    ? "bg-mint/40 text-wood"
                    : "bg-[#e85d4c]/15 text-[#a63a1a]",
                ].join(" ")}
                role="status"
                aria-live="polite"
              >
                <p className="font-display text-2xl">
                  {flashOx === "O" ? "O" : "X"}
                </p>
                <p className="mt-1 text-sm font-bold">
                  {reasonMessage(feedback.reason)}
                  {feedback.correct ? ` · +${feedback.gained}점` : null}
                </p>
              </div>
            ) : null}

            {phase === "playing" ? (
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={onSubmit}
                  className="rounded-xl bg-wood px-8 py-3 text-base font-bold text-cream"
                >
                  확인
                </button>
                <button
                  type="button"
                  onClick={onGiveUp}
                  className="rounded-xl border-2 border-wood/20 bg-cream px-5 py-3 text-sm font-bold text-wood/70 hover:bg-wood/5"
                >
                  포기 · 0점
                </button>
              </div>
            ) : null}
          </section>
        </>
      ) : null}
    </div>
  );
}
