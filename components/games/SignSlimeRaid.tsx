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
import MathAnswerDisplay from "@/components/math/MathAnswerDisplay";
import MathExpressionDisplay from "@/components/math/MathExpressionDisplay";
import {
  submitGameRun,
  fetchGameRanking,
  type GameSubmitClientResult,
} from "@/app/adventure/actions";
import {
  ALL_STAGE_IDS,
  GAME_DURATION_SEC,
  STAGE_PRESETS,
  STAGES_STORAGE_KEY,
  START_HP,
  type Answer,
  type Problem,
  type StageId,
  answersEqual,
  applyScoreGain,
  clampScore,
  dealProblem,
  difficultyAt,
  formatAnswer,
  parseStoredStages,
  pointsForCorrect,
} from "@/lib/sign-slime-math";

const CONTENT_KEY = "g1-u1-2-sign-slime";

type Phase = "ready" | "playing" | "feedback" | "ended";

type Feedback = {
  correct: boolean;
  gained: number;
  picked: Answer;
};

type OrbitSlot = {
  angle: number;
  speed: number;
};

const ORBIT_SPEEDS = [0.55, -0.72, 0.88, -0.63];
const ORBIT_RADIUS_PCT = 38;

function Hearts({ hp, max }: { hp: number; max: number }) {
  return (
    <div className="flex items-center gap-1.5" aria-label={`생명 ${hp}개`}>
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className={[
            "inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-black transition",
            i < hp
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

function StagePicker({
  selected,
  onChange,
}: {
  selected: StageId[];
  onChange: (next: StageId[]) => void;
}) {
  const toggle = (id: StageId) => {
    if (selected.includes(id)) {
      const next = selected.filter((s) => s !== id);
      if (next.length === 0) return;
      onChange(next);
    } else {
      onChange([...selected, id]);
    }
  };

  const selectAll = () => onChange([...ALL_STAGE_IDS]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold text-wood">연습할 단계</p>
        <button
          type="button"
          onClick={selectAll}
          className="rounded-lg bg-wood/8 px-3 py-1 text-xs font-bold text-wood transition hover:bg-wood/12"
        >
          전체 선택
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {STAGE_PRESETS.map((preset) => {
          const checked = selected.includes(preset.id);
          return (
            <label
              key={preset.id}
              className={[
                "flex cursor-pointer items-start gap-3 rounded-2xl border-2 px-3 py-3 transition",
                checked
                  ? "border-mint bg-mint/25 shadow-sm"
                  : "border-wood/10 bg-cream/50 hover:border-wood/20",
              ].join(" ")}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(preset.id)}
                className="mt-1 h-4 w-4 accent-wood"
              />
              <span>
                <span className="block text-sm font-bold text-wood">
                  {preset.label}
                </span>
                <span className="mt-0.5 block text-xs font-medium text-foreground/55">
                  {preset.description}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function SlimeMonster({
  problem,
  scale,
  hit,
  angry,
}: {
  problem: Pick<Problem, "left" | "op" | "right">;
  scale: number;
  hit: boolean;
  angry: boolean;
}) {
  return (
    <div
      className={[
        "relative flex flex-col items-center",
        hit ? "sign-slime-hit" : "",
        angry ? "sign-slime-angry" : "",
      ].join(" ")}
      aria-hidden
    >
      <div
        className="relative flex flex-col items-center transition-transform duration-300"
        style={{ transform: `scale(${scale})` }}
      >
      <div
        className={[
          "relative flex min-h-[8rem] min-w-[11rem] flex-col items-center justify-center rounded-[45%_45%_40%_40%] px-2",
          "bg-gradient-to-b from-[#7ee0a8] via-[#5ecf96] to-[#3fb87f]",
          "shadow-[inset_0_-8px_0_rgba(0,0,0,0.08),0_8px_24px_rgba(47,120,90,0.25)]",
          angry ? "from-[#ff9f8a] via-[#f07d68] to-[#e85d4c]" : "",
        ].join(" ")}
      >
        <div className="absolute -top-3 flex gap-4">
          <span
            className={[
              "h-3 w-3 rounded-full bg-wood shadow-inner",
              angry ? "animate-pulse" : "",
            ].join(" ")}
          />
          <span
            className={[
              "h-3 w-3 rounded-full bg-wood shadow-inner",
              angry ? "animate-pulse" : "",
            ].join(" ")}
          />
        </div>
        <div className="absolute top-5 flex gap-5">
          <span className="h-1.5 w-2 rounded-full bg-wood/70" />
          <span className="h-1.5 w-2 rounded-full bg-wood/70" />
        </div>
        <div className="px-2 text-center text-wood">
          <MathExpressionDisplay
            left={problem.left}
            op={problem.op}
            right={problem.right}
            size="md"
          />
        </div>
        <span className="mt-1 text-sm font-bold text-wood/60">= ?</span>
      </div>
      <div className="absolute -bottom-1 h-4 w-16 rounded-full bg-wood/15 blur-[2px]" />
      </div>
    </div>
  );
}

function CrystalOrb({
  answer,
  angleDeg,
  disabled,
  flash,
  onPick,
}: {
  answer: Answer;
  angleDeg: number;
  disabled: boolean;
  flash: "correct" | "wrong" | null;
  onPick: () => void;
}) {
  const rad = (angleDeg * Math.PI) / 180;
  const x = 50 + ORBIT_RADIUS_PCT * Math.cos(rad);
  const y = 50 + ORBIT_RADIUS_PCT * Math.sin(rad);

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onPick}
      aria-label={`답 ${formatAnswer(answer)}`}
      className={[
        "absolute z-20 -translate-x-1/2 -translate-y-1/2",
        "flex min-h-[4.75rem] min-w-[4.75rem] items-center justify-center rounded-full p-1.5 sm:min-h-[5.25rem] sm:min-w-[5.25rem]",
        "shadow-lg transition active:scale-95",
        "bg-gradient-to-br from-sky/90 via-white to-mint/80 text-wood ring-2 ring-white/80",
        disabled ? "pointer-events-none opacity-70" : "hover:scale-105",
        flash === "correct"
          ? "ring-4 ring-gold bg-gold/80 scale-110"
          : flash === "wrong"
            ? "ring-4 ring-[#e85d4c] bg-[#ffd4cc]"
            : "",
      ].join(" ")}
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      <MathAnswerDisplay answer={answer} variant="answer" size="sm" />
    </button>
  );
}

export default function SignSlimeRaid() {
  const [phase, setPhase] = useState<Phase>("ready");
  const [selectedStages, setSelectedStages] = useState<StageId[]>([
    ...ALL_STAGE_IDS,
  ]);
  const [hp, setHp] = useState(START_HP);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [cleared, setCleared] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [gameTimeLeft, setGameTimeLeft] = useState(GAME_DURATION_SEC);
  const [slimeScale, setSlimeScale] = useState(1);
  const [orbitSlots, setOrbitSlots] = useState<OrbitSlot[]>(() =>
    ORBIT_SPEEDS.map((speed, i) => ({
      angle: i * 90,
      speed,
    })),
  );
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [flashOx, setFlashOx] = useState<"O" | "X" | null>(null);
  const [pickedIndex, setPickedIndex] = useState<number | null>(null);
  const [slimeHit, setSlimeHit] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [submitResult, setSubmitResult] = useState<GameSubmitClientResult | null>(
    null,
  );
  const [ranking, setRanking] = useState<RankingRow[]>([]);
  const [rankingScope, setRankingScope] = useState<RankingScope>("class");
  const [rankingMode, setRankingMode] = useState<RankingMode>("best");
  const [isPending, startTransition] = useTransition();

  const phaseRef = useRef(phase);
  const hpRef = useRef(hp);
  const scoreRef = useRef(score);
  const streakRef = useRef(streak);
  const clearedRef = useRef(cleared);
  const problemRef = useRef(problem);
  const gameTimeLeftRef = useRef(gameTimeLeft);
  const roundStartedAtRef = useRef(0);
  const selectedStagesRef = useRef(selectedStages);
  const startedAtRef = useRef(0);
  const resolvingRef = useRef(false);
  const endingRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef(0);

  phaseRef.current = phase;
  hpRef.current = hp;
  scoreRef.current = score;
  streakRef.current = streak;
  clearedRef.current = cleared;
  problemRef.current = problem;
  gameTimeLeftRef.current = gameTimeLeft;
  selectedStagesRef.current = selectedStages;

  useEffect(() => {
    if (typeof window === "undefined") return;
    setSelectedStages(parseStoredStages(localStorage.getItem(STAGES_STORAGE_KEY)));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STAGES_STORAGE_KEY, JSON.stringify(selectedStages));
  }, [selectedStages]);

  const dealNextProblem = useCallback(() => {
    const next = dealProblem(selectedStagesRef.current);
    setProblem(next);
    const diff = difficultyAt(
      (Date.now() - startedAtRef.current) / 1000,
      clearedRef.current,
    );
    roundStartedAtRef.current = Date.now();
    setSlimeScale(diff.slimeScale);
    setOrbitSlots(
      ORBIT_SPEEDS.map((speed, i) => ({
        angle: i * 90 + Math.random() * 40,
        speed,
      })),
    );
    setPickedIndex(null);
    resolvingRef.current = false;
    setSlimeHit(false);
    setFlashOx(null);
    setFeedback(null);
    setPhase("playing");
    phaseRef.current = "playing";
  }, []);

  const endRun = useCallback(
    (finalScore: number) => {
      if (endingRef.current) return;
      endingRef.current = true;
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

  const resolveAnswer = useCallback(
    (picked: Answer) => {
      if (phaseRef.current !== "playing" || !problemRef.current) return;
      if (resolvingRef.current) return;
      resolvingRef.current = true;
      phaseRef.current = "feedback";
      setPhase("feedback");

      const currentProblem = problemRef.current;
      const correct = answersEqual(picked, currentProblem.answer);
      setFlashOx(correct ? "O" : "X");

      let nextHp = hpRef.current;
      let nextScore = scoreRef.current;
      let nextStreak = streakRef.current;
      let nextCleared = clearedRef.current;
      let gained = 0;

      const idx = currentProblem.choices.findIndex((c) =>
        answersEqual(c, picked),
      );
      setPickedIndex(idx >= 0 ? idx : null);

      if (correct) {
        const answerTimeSec =
          (Date.now() - roundStartedAtRef.current) / 1000;
        const raw = pointsForCorrect(
          currentProblem.stageId,
          streakRef.current,
          answerTimeSec,
        );
        nextScore = applyScoreGain(scoreRef.current, raw);
        gained = nextScore - scoreRef.current;
        nextStreak = streakRef.current + 1;
        nextCleared = clearedRef.current + 1;
        setMaxStreak((prev) => Math.max(prev, nextStreak));
        setSlimeHit(true);
        setStatusMsg(`명중! +${gained}점`);
      } else {
        nextHp = hpRef.current - 1;
        nextStreak = 0;
        setStatusMsg(`빗나감! 정답은 ${formatAnswer(currentProblem.answer)}`);
      }

      setHp(nextHp);
      setScore(nextScore);
      setStreak(nextStreak);
      setCleared(nextCleared);
      setFeedback({ correct, gained, picked });

      if (nextHp <= 0) {
        window.setTimeout(() => endRun(nextScore), 1100);
        return;
      }
      if (gameTimeLeftRef.current <= 0) {
        window.setTimeout(() => endRun(nextScore), 1100);
        return;
      }

      window.setTimeout(() => {
        resolvingRef.current = false;
        if (gameTimeLeftRef.current <= 0 || hpRef.current <= 0) return;
        dealNextProblem();
      }, 1000);
    },
    [dealNextProblem, endRun],
  );

  const startGame = useCallback(() => {
    endingRef.current = false;
    startedAtRef.current = Date.now();
    setHp(START_HP);
    setScore(0);
    setStreak(0);
    setCleared(0);
    setMaxStreak(0);
    setGameTimeLeft(GAME_DURATION_SEC);
    gameTimeLeftRef.current = GAME_DURATION_SEC;
    setSubmitResult(null);
    setRanking([]);
    setRankingScope("class");
    setRankingMode("best");
    setStatusMsg("슬라임이 나타났어요! 수정구슬을 맞춰 공격하세요!");
    hpRef.current = START_HP;
    scoreRef.current = 0;
    streakRef.current = 0;
    clearedRef.current = 0;
    dealNextProblem();
  }, [dealNextProblem]);

  useEffect(() => {
    if (phase !== "playing" && phase !== "feedback") {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    lastFrameRef.current = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastFrameRef.current) / 1000);
      lastFrameRef.current = now;

      if (phaseRef.current === "playing") {
        setOrbitSlots((prev) =>
          prev.map((slot) => ({
            ...slot,
            angle: slot.angle + slot.speed * dt * 60,
          })),
        );

        setGameTimeLeft((prev) => {
          const next = Math.max(0, prev - dt);
          gameTimeLeftRef.current = next;
          if (next <= 0 && !endingRef.current) {
            endRun(scoreRef.current);
          }
          return next;
        });
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [phase, endRun, resolveAnswer]);

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

  const gamePct = (gameTimeLeft / GAME_DURATION_SEC) * 100;

  return (
    <div className="flex flex-col gap-5">
      <section className="quest-card bg-gradient-to-br from-mint/40 via-sky/20 to-gold/25 p-5 sm:p-7">
        <p className="text-sm font-bold text-wood">중1 · 1.2 정수와 유리수</p>
        <h1 className="font-display mt-1 text-3xl text-foreground sm:text-4xl">
          부호 슬라임 대소동
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-foreground/75 sm:text-base">
          슬라임 배에 뜬 수식과 같은 답이 적힌 수정구슬을 맞춰 공격하세요!{" "}
          {GAME_DURATION_SEC}초 동안 최대한 많이 맞히고, 생명 {START_HP}개를 모두
          잃으면 게임이 끝나요. 빠르게 맞출수록 보너스 점수가 올라가요.
        </p>
      </section>

      {phase === "ready" ? (
        <section className="quest-card border-mint/40 bg-gradient-to-br from-sky/30 via-mint/25 to-gold/20 p-5 sm:p-8">
          <StagePicker selected={selectedStages} onChange={setSelectedStages} />
          <ol className="mx-auto mt-6 max-w-md space-y-3 text-left text-sm font-semibold text-foreground/80 sm:text-base">
            <li className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-mint font-black text-wood">
                1
              </span>
              <span>연습할 연산 단계를 골라요 (여러 개 선택 가능).</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky font-black text-wood">
                2
              </span>
              <span>궤도를 도는 수정구슬 중 정답을 탭해 슬라임을 공격해요.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold font-black text-wood">
                3
              </span>
              <span>빠르게 맞출수록 보너스! 3번 틀리면 게임이 끝나요.</span>
            </li>
          </ol>
          <button
            type="button"
            onClick={startGame}
            disabled={selectedStages.length === 0}
            className="mt-8 w-full rounded-xl bg-wood px-8 py-3.5 text-lg font-bold text-cream shadow-md transition hover:bg-wood-dark active:scale-[0.98] disabled:opacity-50 sm:w-auto"
          >
            전투 시작
          </button>
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
            {cleared}번 명중 · 최고 연속 {maxStreak}
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
            onClick={() => {
              setPhase("ready");
              phaseRef.current = "ready";
            }}
            className="mt-6 rounded-xl bg-wood px-6 py-3 text-base font-bold text-cream"
          >
            다시 하기
          </button>
        </section>
      ) : null}

      {phase === "playing" || phase === "feedback" ? (
        <>
          <section className="quest-card-static overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-wood/10 px-4 py-3 sm:px-5">
              <Hearts hp={hp} max={START_HP} />
              <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-wood">
                <span className="rounded-xl bg-gold/50 px-3 py-1">{score}점</span>
                <span className="rounded-xl bg-mint/35 px-3 py-1">
                  명중 {cleared}
                </span>
                {streak > 1 ? (
                  <span className="rounded-xl bg-sky/50 px-3 py-1">
                    연속 {streak}
                  </span>
                ) : null}
                <span className="rounded-xl bg-wood/8 px-3 py-1 tabular-nums">
                  {Math.ceil(gameTimeLeft)}초
                </span>
              </div>
            </div>

            <div className="border-b border-wood/10 px-4 py-2 sm:px-5">
              <div className="flex items-center justify-between text-xs font-semibold text-foreground/55">
                <span>남은 시간</span>
                <span>{Math.ceil(gameTimeLeft)}초</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-wood/10">
                <div
                  className="h-full rounded-full bg-sky/70 transition-[width] duration-100"
                  style={{ width: `${gamePct}%` }}
                />
              </div>
            </div>

            <div
              className="relative mx-auto aspect-square w-full max-w-lg overflow-hidden bg-gradient-to-b from-[#c8f0ff] via-[#d8f8ea] to-[#fff6d4] sm:max-w-xl"
              role="application"
              aria-label="부호 슬라임 전투 영역"
            >
              <div
                className="pointer-events-none absolute left-1/2 top-1/2 h-[76%] w-[76%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed border-mint/35"
                aria-hidden
              />
              <div
                className="pointer-events-none absolute left-1/2 top-1/2 h-[52%] w-[52%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-sky/25"
                aria-hidden
              />

              <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
                {problem ? (
                  <SlimeMonster
                    problem={problem}
                    scale={slimeScale}
                    hit={slimeHit}
                    angry={phase === "feedback" && feedback != null && !feedback.correct}
                  />
                ) : null}
              </div>

              {problem?.choices.map((choice, i) => {
                const flash =
                  phase === "feedback" && pickedIndex === i
                    ? feedback?.correct
                      ? "correct"
                      : "wrong"
                    : phase === "feedback" &&
                        answersEqual(choice, problem.answer) &&
                        !feedback?.correct
                      ? "correct"
                      : null;
                return (
                  <CrystalOrb
                    key={`${problem.expression}-${i}`}
                    answer={choice}
                    angleDeg={orbitSlots[i]?.angle ?? i * 90}
                    disabled={phase === "feedback"}
                    flash={flash}
                    onPick={() => resolveAnswer(choice)}
                  />
                );
              })}

              {flashOx ? (
                <span
                  className={[
                    "pointer-events-none absolute left-1/2 top-4 z-30 -translate-x-1/2",
                    "font-display text-5xl font-black drop-shadow-md",
                    flashOx === "O" ? "text-mint" : "text-[#e85d4c]",
                  ].join(" ")}
                  aria-hidden
                >
                  {flashOx}
                </span>
              ) : null}
            </div>

            <p
              className="min-h-[2.5rem] border-t border-wood/10 bg-cream/60 px-4 py-2 text-center text-sm font-semibold text-foreground/70"
              role="status"
              aria-live="polite"
            >
              {statusMsg}
            </p>
          </section>
        </>
      ) : null}
    </div>
  );
}
