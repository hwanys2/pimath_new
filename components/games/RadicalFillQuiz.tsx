"use client";

import {
  useCallback,
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
  WRONG_PENALTY,
  applyScoreGain,
  checkAnswer,
  clampScore,
  emptyFills,
  formatFixedRhs,
  hasDuplicateAmongFills,
  opLabel,
  parsePositiveInt,
  scoreForAttempts,
  type CheckReason,
  type RadicalProblem,
  type TermFill,
} from "@/lib/radical-fill-math";

type Phase = "ready" | "playing" | "cleared" | "ended";

type TermTexts = { coeff: string; radicand: string };

type SoftNotice = {
  reason: Extract<CheckReason, "incomplete" | "invalid" | "duplicate" | "wrong">;
};

type ClearedState = {
  gained: number;
  wrongs: number;
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
  return problem.terms.map(() => ({
    coeff: "",
    radicand: "",
  }));
}

function softMessage(reason: SoftNotice["reason"]): string {
  switch (reason) {
    case "incomplete":
      return "빈칸을 모두 채워 주세요.";
    case "invalid":
      return "양의 정수만 입력할 수 있어요.";
    case "duplicate":
      return "모든 숫자는 서로 달라야 해요.";
    case "wrong":
      return "틀렸어요. 다시 풀어보세요!";
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

export default function RadicalFillQuiz() {
  const [phase, setPhase] = useState<Phase>("ready");
  const [index, setIndex] = useState(0);
  const [texts, setTexts] = useState<TermTexts[]>([]);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [softNotice, setSoftNotice] = useState<SoftNotice | null>(null);
  const [cleared, setCleared] = useState<ClearedState | null>(null);
  const [submitResult, setSubmitResult] =
    useState<GameSubmitClientResult | null>(null);
  const [ranking, setRanking] = useState<RankingRow[]>([]);
  const [rankingScope, setRankingScope] = useState<RankingScope>("class");
  const [rankingMode, setRankingMode] = useState<RankingMode>("best");
  const [isPending, startTransition] = useTransition();

  const phaseRef = useRef<Phase>(phase);
  phaseRef.current = phase;
  const inputElsRef = useRef<(HTMLInputElement | null)[]>([]);
  const wrongRef = useRef(0);

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
      setSoftNotice(null);
      setCleared(null);
      wrongRef.current = 0;
      setWrongAttempts(0);
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

  const goNext = useCallback(
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
    setSoftNotice(null);
    setCleared(null);
    loadProblem(0);
  }, [loadProblem]);

  const onSubmit = useCallback(() => {
    if (phaseRef.current !== "playing") return;
    const result = checkAnswer(problem, fills);
    if (
      result.reason === "incomplete" ||
      result.reason === "invalid" ||
      result.reason === "duplicate"
    ) {
      setSoftNotice({ reason: result.reason });
      return;
    }
    if (!result.ok) {
      const nextWrongs = wrongRef.current + 1;
      wrongRef.current = nextWrongs;
      setWrongAttempts(nextWrongs);
      setSoftNotice({ reason: "wrong" });
      return;
    }

    const gained = scoreForAttempts(wrongRef.current);
    const nextScore = applyScoreGain(score, gained);
    const actualGain = nextScore - score;
    const nextCorrect = correctCount + 1;
    phaseRef.current = "cleared";
    setPhase("cleared");
    setSoftNotice(null);
    setCleared({ gained: actualGain, wrongs: wrongRef.current });
    setScore(nextScore);
    setCorrectCount(nextCorrect);

    window.setTimeout(() => {
      goNext(nextScore, nextCorrect);
    }, 1100);
  }, [correctCount, fills, goNext, problem, score]);

  const onGiveUp = useCallback(() => {
    if (phaseRef.current !== "playing") return;
    phaseRef.current = "cleared";
    setPhase("cleared");
    setSoftNotice(null);
    setCleared({ gained: 0, wrongs: wrongRef.current });
    window.setTimeout(() => {
      goNext(score, correctCount);
    }, 1100);
  }, [correctCount, goNext, score]);

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
    if (softNotice) setSoftNotice(null);
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

  let slotCounter = 0;
  const termSlotStarts = problem.terms.map((term) => {
    const start = slotCounter;
    if (term.hasCoeff) slotCounter += 1;
    slotCounter += 1;
    return start;
  });

  const projected = scoreForAttempts(wrongAttempts);

  return (
    <div className="flex flex-col gap-5">
      <section className="quest-card bg-gradient-to-br from-lavender/50 via-sky/25 to-mint/30 p-5 sm:p-7">
        <p className="text-sm font-bold text-wood">중3 · 1. 제곱근과 실수</p>
        <h1 className="font-display mt-1 text-3xl text-foreground sm:text-4xl">
          근호 빈칸 채우기
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-foreground/75 sm:text-base">
          빈칸에 서로 다른 양의 정수를 넣어 등식이 성립하게 만드세요. 틀리면
          다시 풀 수 있고, 틀린 횟수만큼 점수가 깎여요. (문제당 최대 100점)
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
            <li>· 틀리면 다시 도전 · 틀릴 때마다 −{WRONG_PENALTY}점 (하한 40점)</li>
            <li>· 막히면 포기할 수 있어요 (그 문제는 0점)</li>
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

      {phase === "playing" || phase === "cleared" ? (
        <section className="quest-card p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm font-bold text-wood">
            <span className="rounded-xl bg-lavender/40 px-3 py-1 tabular-nums">
              문제 {index + 1}/{PROBLEM_COUNT}
            </span>
            <span className="rounded-xl bg-mint/35 px-3 py-1 tabular-nums">
              점수 {clampScore(score)}
            </span>
            <span className="rounded-xl bg-sky/40 px-3 py-1 tabular-nums">
              오답 {wrongAttempts}회
              <span className="ml-1 font-semibold text-wood/55">
                · 맞히면 {projected}점
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
                    disabled={phase === "cleared"}
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

          {duplicate && phase === "playing" ? (
            <p
              className="mt-4 text-center text-sm font-bold text-[#a63a1a]"
              role="status"
            >
              같은 숫자가 두 번 이상 있어요. 모두 다르게 바꿔 주세요.
            </p>
          ) : null}

          {softNotice && phase === "playing" ? (
            <p
              className={[
                "mt-4 text-center text-sm font-bold",
                softNotice.reason === "wrong"
                  ? "text-[#a63a1a]"
                  : "text-[#a63a1a]",
              ].join(" ")}
              role="status"
            >
              {softMessage(softNotice.reason)}
              {softNotice.reason === "wrong" ? (
                <span className="mt-1 block text-xs font-semibold text-wood/60">
                  지금 맞히면 {scoreForAttempts(wrongAttempts)}점이에요.
                </span>
              ) : null}
            </p>
          ) : null}

          {phase === "cleared" && cleared ? (
            <div
              className={[
                "mt-5 rounded-2xl px-4 py-3 text-center",
                cleared.gained > 0
                  ? "bg-mint/40 text-wood"
                  : "bg-[#e85d4c]/15 text-[#a63a1a]",
              ].join(" ")}
              role="status"
              aria-live="polite"
            >
              <p className="font-display text-2xl">
                {cleared.gained > 0 ? "O" : "X"}
              </p>
              <p className="mt-1 text-sm font-bold">
                {cleared.gained > 0
                  ? `정답이에요! · +${cleared.gained}점`
                  : "포기 · 0점"}
                {cleared.gained > 0 && cleared.wrongs > 0 ? (
                  <span className="mt-1 block text-xs font-semibold opacity-80">
                    오답 {cleared.wrongs}회
                  </span>
                ) : null}
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
      ) : null}
    </div>
  );
}
