"use client";

import {
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import {
  checkAnswer,
  emptyFills,
  hasDuplicateAmongFills,
  opLabel,
  ratKey,
  sanitizeCoeffInput,
  sanitizeRadicandInput,
  scoreForAttempts,
  type CheckReason,
  type RadicalProblem,
  type Rational,
} from "@/lib/radical-fill-math";
import { textsToFills } from "@/lib/inquiry-radical-fill";

export type TermTexts = { coeff: string; radicand: string };

export type SoftNotice = {
  reason: Extract<CheckReason, "incomplete" | "invalid" | "duplicate" | "wrong">;
};

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
      <span className="relative -ml-[4px] mt-0 flex min-w-[3.4rem] flex-col sm:min-w-[3.85rem]">
        <span className="relative block h-[2.85px] w-full shrink-0">
          <span className="absolute inset-0 rounded-full bg-current" />
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

export function emptyTexts(problem: RadicalProblem): TermTexts[] {
  return problem.terms.map(() => ({ coeff: "", radicand: "" }));
}

type Props = {
  problem: RadicalProblem;
  stepIndex: number;
  stepCount: number;
  texts: TermTexts[];
  onTextsChange: (texts: TermTexts[]) => void;
  readOnly?: boolean;
  /** 교사 시연용 — 제출 UI 없이 빈칸 입력만 허용 */
  hostPreview?: boolean;
  disabled?: boolean;
  wrongAttempts?: number;
  softNotice?: SoftNotice | null;
  submitted?: boolean;
  submitFeedback?: "correct" | "wrong" | null;
  onSubmit?: () => void;
  onGiveUp?: () => void;
  showScoreBar?: boolean;
  score?: number;
};

export default function InquiryRadicalFillStep({
  problem,
  stepIndex,
  stepCount,
  texts,
  onTextsChange,
  readOnly = false,
  hostPreview = false,
  disabled = false,
  wrongAttempts = 0,
  softNotice = null,
  submitted = false,
  submitFeedback = null,
  onSubmit,
  onGiveUp,
  showScoreBar = false,
  score = 0,
}: Props) {
  const inputElsRef = useRef<(HTMLInputElement | null)[]>([]);

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

  const focusNextEmpty = useCallback(() => {
    const el = inputElsRef.current.find(
      (node) => node && node.value.trim() === "",
    );
    if (el) el.focus();
    else onSubmit?.();
  }, [onSubmit]);

  const setTermText = (
    termIndex: number,
    field: "coeff" | "radicand",
    value: string,
  ) => {
    if ((readOnly && !hostPreview) || disabled) return;
    const next = texts.map((t) => ({ ...t }));
    const cur = next[termIndex] ?? { coeff: "", radicand: "" };
    next[termIndex] = { ...cur, [field]: value };
    onTextsChange(next);
  };

  const registerInput = (slot: number) => (el: HTMLInputElement | null) => {
    inputElsRef.current[slot] = el;
  };

  const interactive = hostPreview || !readOnly;
  const locked = !interactive || disabled;
  const projected = scoreForAttempts(wrongAttempts);

  return (
    <section className="quest-card p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm font-bold text-wood">
        <span className="rounded-xl bg-lavender/40 px-3 py-1 tabular-nums">
          문제 {stepIndex + 1}/{stepCount}
        </span>
        {hostPreview ? (
          <span className="rounded-xl bg-lavender/45 px-3 py-1 text-xs font-bold text-wood">
            시연 모드 — 빈칸을 채우며 설명할 수 있어요
          </span>
        ) : null}
        {showScoreBar ? (
          <>
            <span className="rounded-xl bg-mint/35 px-3 py-1 tabular-nums">
              점수 {score}
            </span>
            <span className="rounded-xl bg-sky/40 px-3 py-1 tabular-nums">
              오답 {wrongAttempts}회
              <span className="ml-1 font-semibold text-wood/55">
                · 맞히면 {projected}점
              </span>
            </span>
          </>
        ) : null}
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
                disabled={locked}
                termIndex={ti}
              />
            </span>
          );
        })}
        <span className="font-display font-bold text-wood/80">=</span>
        <RhsView rhs={problem.rhs} />
      </div>

      {duplicate && !locked ? (
        <p
          className="mt-4 text-center text-sm font-bold text-[#a63a1a]"
          role="status"
        >
          같은 숫자가 두 번 이상 있어요. 모두 다르게 바꿔 주세요.
        </p>
      ) : null}

      {softNotice && !readOnly && !hostPreview ? (
        <p className="mt-4 text-center text-sm font-bold text-[#a63a1a]" role="status">
          {softMessage(softNotice.reason)}
          {softNotice.reason === "wrong" ? (
            <span className="mt-1 block text-xs font-semibold text-wood/60">
              지금 맞히면 {scoreForAttempts(wrongAttempts)}점이에요.
            </span>
          ) : null}
        </p>
      ) : null}

      {submitted && submitFeedback ? (
        <div
          className={[
            "mt-5 rounded-2xl px-4 py-3 text-center",
            submitFeedback === "correct"
              ? "bg-mint/40 text-wood"
              : "bg-[#e85d4c]/15 text-[#a63a1a]",
          ].join(" ")}
          role="status"
          aria-live="polite"
        >
          <p className="font-display text-2xl">
            {submitFeedback === "correct" ? "O" : "X"}
          </p>
          <p className="mt-1 text-sm font-bold">
            {submitFeedback === "correct"
              ? "제출 완료! 답을 고칠 수 있어요. 선생님이 다음 문제로 넘길 때까지 기다려 주세요."
              : "다시 생각해 보세요. 답을 고친 뒤 다시 확인할 수 있어요."}
          </p>
        </div>
      ) : null}

      {!readOnly && !hostPreview && onSubmit ? (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={onSubmit}
            disabled={disabled}
            className="rounded-xl bg-wood px-8 py-3 text-base font-bold text-cream disabled:opacity-50"
          >
            {submitted ? "다시 확인" : "확인"}
          </button>
          {onGiveUp ? (
            <button
              type="button"
              onClick={onGiveUp}
              disabled={disabled}
              className="rounded-xl border-2 border-wood/20 bg-cream px-5 py-3 text-sm font-bold text-wood/70 hover:bg-wood/5 disabled:opacity-50"
            >
              포기
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export function validateRadicalFillSubmit(
  problem: RadicalProblem,
  texts: TermTexts[],
): SoftNotice | null {
  const fills = textsToFills(problem, texts);
  const result = checkAnswer(problem, fills);
  if (
    result.reason === "incomplete" ||
    result.reason === "invalid" ||
    result.reason === "duplicate" ||
    result.reason === "wrong"
  ) {
    return { reason: result.reason };
  }
  return null;
}
