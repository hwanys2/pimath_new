"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
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
  hasDuplicateAmongFills,
  opLabel,
  parseRational,
  ratKey,
  sanitizeCoeffInput,
  sanitizeRadicandInput,
  scoreForAttempts,
  type CheckReason,
  type RadicalProblem,
  type Rational,
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
      coeff: term.hasCoeff
        ? parseRational(t.coeff, { allowNegative: true })
        : null,
      radicand: parseRational(t.radicand, { allowNegative: false }),
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
      return "빈칸을 모두 채워 주세요. (예: 3, −2, 1/2)";
    case "invalid":
      return "계수는 정수·분수(음수 가능), 근호 안은 양수만 넣을 수 있어요.";
    case "duplicate":
      return "모든 숫자는 서로 달라야 해요. (2와 2/1은 같은 수로 봐요)";
    case "wrong":
      return "틀렸어요. 다시 풀어보세요!";
  }
}

function SlotInput({
  value,
  onChange,
  onEnter,
  variant,
  duplicate,
  inputRef,
  ariaLabel,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onEnter: () => void;
  variant: "coeff" | "radicand";
  duplicate?: boolean;
  inputRef?: (el: HTMLInputElement | null) => void;
  ariaLabel: string;
  disabled?: boolean;
}) {
  const isRad = variant === "radicand";
  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="text"
      autoComplete="off"
      spellCheck={false}
      disabled={disabled}
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => {
        const next = isRad
          ? sanitizeRadicandInput(e.target.value)
          : sanitizeCoeffInput(e.target.value);
        onChange(next);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onEnter();
        }
      }}
      className={[
        "bg-cream text-center font-display font-bold tabular-nums text-wood outline-none transition",
        "focus:ring-2 focus:ring-wood/25",
        isRad
          ? "h-10 w-[3.6rem] rounded-md rounded-t-none border-2 border-t-0 text-base sm:h-11 sm:w-[4.25rem] sm:text-lg"
          : "h-10 w-[3.25rem] rounded-lg border-2 text-sm sm:h-11 sm:w-14 sm:text-base",
        duplicate
          ? isRad
            ? "border-[#e85d4c] border-t-0 bg-[#e85d4c]/10 focus:border-[#e85d4c]"
            : "border-[#e85d4c] bg-[#e85d4c]/10 focus:border-[#e85d4c]"
          : isRad
            ? "border-wood/35 focus:border-wood"
            : "border-wood/25 focus:border-wood",
        disabled ? "opacity-60" : "",
      ].join(" ")}
    />
  );
}

/**
 * 교과서형 근호: 왼쪽 체크(√)와 위 가로선(vinculum)이 한 획으로 이어짐.
 * 문자 "√" + 별도 border-top 조합은 끊겨 보이므로 SVG path로 그림.
 */
function RadicalShell({
  children,
  emphasize,
}: {
  children: ReactNode;
  emphasize?: boolean;
}) {
  return (
    <span
      className={[
        "inline-flex items-start text-wood",
        emphasize ? "text-foreground" : "",
      ].join(" ")}
    >
      {/*
        viewBox 높이 56 기준:
        - 체크 바닥 ≈ 51
        - 상승선 끝 ≈ 1.4 (vinculum 두께 중앙과 맞춤)
      */}
      <svg
        aria-hidden
        viewBox="0 0 22 56"
        className="h-[3.15rem] w-[1.2rem] shrink-0 overflow-visible sm:h-[3.4rem] sm:w-[1.3rem]"
        fill="none"
      >
        <path
          d="M2 28 H6.8 L12 51.5 L20.8 1.4"
          stroke="currentColor"
          strokeWidth="2.85"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {/* 가로선이 SVG 끝점 위로 살짝 겹쳐 끊김 없이 이어짐 */}
      <span className="relative -ml-[4px] mt-0 flex min-w-[3.4rem] flex-col sm:min-w-[3.85rem]">
        <span className="relative block h-[2.85px] w-full shrink-0">
          <span className="absolute inset-0 rounded-full bg-current" />
          {/* 오른쪽 끝 짧은 세로 훅 — 교과서 근호 느낌 */}
          <span
            className="absolute top-0 right-0 h-2 w-[2.85px] rounded-full bg-current"
            aria-hidden
          />
        </span>
        <span className="flex flex-1 items-center justify-center px-0.5 pb-0.5 pt-1.5">
          {children}
        </span>
      </span>
    </span>
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
    <span className="inline-flex items-end gap-0.5 pb-0.5 sm:gap-1">
      {hasCoeff ? (
        <SlotInput
          value={coeff}
          onChange={onCoeffChange}
          onEnter={onEnter}
          variant="coeff"
          duplicate={coeffDup}
          inputRef={coeffRef}
          ariaLabel={`${termIndex + 1}번째 항 계수`}
          disabled={disabled}
        />
      ) : null}
      <RadicalShell>
        <SlotInput
          value={radicand}
          onChange={onRadicandChange}
          onEnter={onEnter}
          variant="radicand"
          duplicate={radDup}
          inputRef={radRef}
          ariaLabel={`${termIndex + 1}번째 항 근호 안`}
          disabled={disabled}
        />
      </RadicalShell>
    </span>
  );
}

/** 우변 고정 항도 같은 근호 모양으로 표시 */
function RhsView({
  rhs,
}: {
  rhs: { coeff: number; radicand: number }[];
}) {
  if (rhs.length === 0) return <span>0</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1 gap-y-2">
      {rhs.map((t, i) => {
        const abs = Math.abs(t.coeff);
        const sign =
          i === 0
            ? t.coeff < 0
              ? "−"
              : ""
            : t.coeff < 0
              ? "−"
              : "+";
        return (
          <span
            key={`${t.coeff}-${t.radicand}-${i}`}
            className="inline-flex items-center gap-1"
          >
            {sign ? (
              <span className="font-display text-2xl font-bold text-wood/80 sm:text-3xl">
                {i === 0 ? sign : ` ${sign} `}
              </span>
            ) : null}
            {t.radicand === 1 ? (
              <span className="font-display text-2xl font-bold tabular-nums sm:text-3xl">
                {abs}
              </span>
            ) : (
              <span className="inline-flex items-center gap-0.5">
                {abs !== 1 ? (
                  <span className="font-display text-2xl font-bold tabular-nums sm:text-3xl">
                    {abs}
                  </span>
                ) : null}
                <RadicalShell emphasize>
                  <span className="min-w-[1.75rem] px-1 text-center font-display text-2xl font-bold tabular-nums sm:text-3xl">
                    {t.radicand}
                  </span>
                </RadicalShell>
              </span>
            )}
          </span>
        );
      })}
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
  const inputElsRef = useRef<(HTMLInputElement | null)[]>([]);
  const wrongRef = useRef(0);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

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
    const nums: Rational[] = [];
    for (let i = 0; i < fills.length; i++) {
      const f = fills[i]!;
      if (problem.terms[i]?.hasCoeff && f.coeff != null) nums.push(f.coeff);
      if (f.radicand != null) nums.push(f.radicand);
    }
    const counts = new Map<string, number>();
    for (const n of nums) {
      const k = ratKey(n);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return new Set(
      [...counts.entries()].filter(([, c]) => c > 1).map(([k]) => k),
    );
  }, [fills, problem.terms]);

  const termSlotStarts = useMemo(() => {
    const starts: number[] = [];
    let slot = 0;
    for (const term of problem.terms) {
      starts.push(slot);
      if (term.hasCoeff) slot += 1;
      slot += 1;
    }
    return starts;
  }, [problem.terms]);

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

  const projected = scoreForAttempts(wrongAttempts);

  return (
    <div className="flex flex-col gap-5">
      <section className="quest-card bg-gradient-to-br from-lavender/50 via-sky/25 to-mint/30 p-5 sm:p-7">
        <p className="text-sm font-bold text-wood">중3 · 1. 제곱근과 실수</p>
        <h1 className="font-display mt-1 text-3xl text-foreground sm:text-4xl">
          근호 빈칸 채우기
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-foreground/75 sm:text-base">
          빈칸에 서로 다른 수를 넣어 등식이 성립하게 만드세요. 계수는 음수·분수도
          되고, 근호 안에는 양수만 넣을 수 있어요. 틀리면 다시 풀며 감점됩니다.
        </p>
      </section>

      {phase === "ready" ? (
        <section className="quest-card p-5 text-center sm:p-8">
          <p className="text-sm font-semibold text-foreground/70">
            근호 안의 수와 계수를 채우면 우변과 같아지도록 식을 완성합니다.
          </p>
          <ul className="mx-auto mt-4 max-w-md space-y-2 text-left text-sm font-semibold text-wood/80">
            <li>· 한 문제에 쓰는 숫자는 모두 서로 달라야 해요</li>
            <li>· 계수는 음수·분수 가능 (예: −3, 1/2) · 근호 안은 양수만</li>
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
            className="mt-6 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-5 text-xl text-wood sm:gap-x-3 sm:text-2xl"
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
                      fill.coeff != null &&
                      duplicateValues.has(ratKey(fill.coeff))
                    }
                    radDup={
                      fill.radicand != null &&
                      duplicateValues.has(ratKey(fill.radicand))
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
            <RhsView rhs={problem.rhs} />
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
