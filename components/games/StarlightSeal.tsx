"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import Image from "next/image";
import type { RankingMode, RankingRow, RankingScope } from "@/lib/game-types";
import GameRankingBoard from "@/components/games/GameRankingBoard";
import StarlightSealScene from "@/components/games/StarlightSealScene";
import { useGamePresence } from "@/components/games/GamePresenceBeacon";
import {
  submitGameRun,
  fetchGameRanking,
  type GameSubmitClientResult,
} from "@/app/adventure/actions";
import { activityDetailsV1 } from "@/lib/activity-result-schemas";
import {
  CONTENT_KEY,
  START_ENERGY,
  MAX_ENERGY,
  TOTAL_SEALS,
  JUDGE_TIME_SEC,
  type Seal,
  generateAllSeals,
  checkAnswer,
  pointsFor,
  chapterLabel,
  clampScore,
  applyScoreGain,
  sceneWithPreview,
} from "@/lib/starlight-seal-math";

type Phase =
  | "ready"
  | "playing"
  | "verify"
  | "solution"
  | "sealed"
  | "ended";

type ItemResult = "first" | "second" | "fail" | "timeout";

type RunItem = {
  i: number;
  chapter: number;
  kind: string;
  attempts: number;
  result: ItemResult;
  timeSec: number;
};

function EnergyHearts({ energy, max }: { energy: number; max: number }) {
  return (
    <div
      className="flex items-center gap-1.5"
      aria-label={`결계 에너지 ${energy}개`}
    >
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className={[
            "inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-black transition",
            i < energy
              ? "bg-lavender text-wood shadow-sm"
              : "bg-wood/10 text-wood/25",
          ].join(" ")}
          aria-hidden
        >
          ✦
        </span>
      ))}
    </div>
  );
}

export default function StarlightSeal() {
  const [phase, setPhase] = useState<Phase>("ready");
  const [seals, setSeals] = useState<Seal[]>([]);
  const [index, setIndex] = useState(0);
  const [energy, setEnergy] = useState(START_ENERGY);
  const [score, setScore] = useState(0);
  const [attempt, setAttempt] = useState<1 | 2>(1);
  const [guessText, setGuessText] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [items, setItems] = useState<RunItem[]>([]);
  const [gained, setGained] = useState(0);
  const [judgeLeft, setJudgeLeft] = useState(JUDGE_TIME_SEC);
  const [previewGuess, setPreviewGuess] = useState<number | null>(null);
  const [restored, setRestored] = useState(false);
  const [submitResult, setSubmitResult] =
    useState<GameSubmitClientResult | null>(null);
  const [ranking, setRanking] = useState<RankingRow[]>([]);
  const [rankingScope, setRankingScope] = useState<RankingScope>("class");
  const [rankingMode, setRankingMode] = useState<RankingMode>("best");
  const [isPending, startTransition] = useTransition();

  const phaseRef = useRef<Phase>(phase);
  const sealStartedAt = useRef<number>(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const judgeTickRef = useRef<number | null>(null);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const seal = seals[index] ?? null;
  const playing =
    phase === "playing" ||
    phase === "verify" ||
    phase === "solution" ||
    phase === "sealed";

  useGamePresence(CONTENT_KEY, {
    phase: playing ? "playing" : phase === "ended" ? "ended" : "lobby",
    liveScore: playing || phase === "ended" ? score : null,
  });

  const startFresh = useCallback(() => {
    const next = generateAllSeals();
    setSeals(next);
    setIndex(0);
    setEnergy(START_ENERGY);
    setScore(0);
    setAttempt(1);
    setGuessText("");
    setSelectedId(null);
    setItems([]);
    setGained(0);
    setJudgeLeft(JUDGE_TIME_SEC);
    setPreviewGuess(null);
    setRestored(false);
    setSubmitResult(null);
    setRanking([]);
    setRankingScope("class");
    setRankingMode("best");
    sealStartedAt.current = performance.now();
    setPhase("playing");
  }, []);

  const endRun = useCallback(
    (
      finalScore: number,
      finalEnergy: number,
      finalItems: RunItem[],
      didRestore: boolean,
    ) => {
      setPhase("ended");
      setRestored(didRestore);
      startTransition(async () => {
        const sealsCleared = finalItems.filter(
          (it) => it.result === "first" || it.result === "second",
        ).length;
        const result = await submitGameRun({
          contentKey: CONTENT_KEY,
          score: clampScore(finalScore),
          details: activityDetailsV1(
            {
              sealsCleared,
              totalSeals: TOTAL_SEALS,
              wrongAttempts: finalItems.reduce(
                (s, it) =>
                  s +
                  (it.result === "fail" || it.result === "timeout"
                    ? it.attempts
                    : Math.max(0, it.attempts - 1)),
                0,
              ),
              energyLeft: finalEnergy,
              restored: didRestore,
            },
            finalItems,
          ),
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
    [],
  );

  const advanceAfterSeal = useCallback(
    (
      nextScore: number,
      nextEnergy: number,
      nextItems: RunItem[],
      nextIndex: number,
    ) => {
      if (nextEnergy <= 0) {
        endRun(nextScore, nextEnergy, nextItems, false);
        return;
      }
      if (nextIndex >= TOTAL_SEALS) {
        endRun(nextScore, nextEnergy, nextItems, true);
        return;
      }
      setIndex(nextIndex);
      setAttempt(1);
      setGuessText("");
      setSelectedId(null);
      setPreviewGuess(null);
      setGained(0);
      setJudgeLeft(JUDGE_TIME_SEC);
      sealStartedAt.current = performance.now();
      setPhase("playing");
    },
    [endRun],
  );

  const recordAndSeal = useCallback(
    (
      result: ItemResult,
      attempts: number,
      rawGain: number,
      elapsedSec: number,
    ) => {
      if (!seal) return;
      const nextScore =
        result === "fail" || result === "timeout"
          ? score
          : applyScoreGain(score, rawGain);
      const gain = nextScore - score;
      setScore(nextScore);
      setGained(gain);

      const item: RunItem = {
        i: seal.index + 1,
        chapter: seal.chapter,
        kind: seal.kind,
        attempts,
        result,
        timeSec: Math.round(elapsedSec * 10) / 10,
      };
      const nextItems = [...items, item];
      setItems(nextItems);

      let nextEnergy = energy;
      if (result === "fail" || result === "timeout") {
        nextEnergy = energy - 1;
        setEnergy(nextEnergy);
        setPhase("solution");
        window.setTimeout(() => {
          advanceAfterSeal(nextScore, nextEnergy, nextItems, index + 1);
        }, 2800);
        return;
      }

      setPhase("sealed");
      window.setTimeout(() => {
        advanceAfterSeal(nextScore, nextEnergy, nextItems, index + 1);
      }, 1400);
    },
    [seal, score, items, energy, index, advanceAfterSeal],
  );

  const submitCalc = useCallback(() => {
    if (!seal || phaseRef.current !== "playing") return;
    if (seal.kind !== "calc") return;
    const parsed = Number(guessText.trim());
    if (!Number.isFinite(parsed)) return;

    const elapsedSec = (performance.now() - sealStartedAt.current) / 1000;
    const correct = checkAnswer(seal, parsed);
    setPreviewGuess(Math.round(parsed));
    setPhase("verify");

    window.setTimeout(() => {
      if (correct) {
        const pts = pointsFor(seal, attempt, elapsedSec);
        recordAndSeal(attempt === 1 ? "first" : "second", attempt, pts, elapsedSec);
        return;
      }
      if (attempt === 1) {
        setAttempt(2);
        setGuessText("");
        setPhase("playing");
        return;
      }
      recordAndSeal("fail", 2, 0, elapsedSec);
    }, 900);
  }, [seal, guessText, attempt, recordAndSeal]);

  const submitJudge = useCallback(
    (optionId: string) => {
      if (!seal || phaseRef.current !== "playing") return;
      if (seal.kind !== "judge") return;
      phaseRef.current = "verify";
      setSelectedId(optionId);
      const elapsedSec = (performance.now() - sealStartedAt.current) / 1000;
      const correct = checkAnswer(seal, optionId);
      if (correct) {
        const pts = pointsFor(seal, 1, elapsedSec);
        recordAndSeal("first", 1, pts, elapsedSec);
      } else {
        recordAndSeal("fail", 1, 0, elapsedSec);
      }
    },
    [seal, recordAndSeal],
  );

  // Judge countdown — reset + tick when a judge seal becomes active
  useEffect(() => {
    if (phase !== "playing" || !seal || seal.kind !== "judge") {
      if (judgeTickRef.current != null) {
        window.clearInterval(judgeTickRef.current);
        judgeTickRef.current = null;
      }
      return;
    }

    let left = JUDGE_TIME_SEC;
    const sync = () => setJudgeLeft(left);
    // schedule first paint after mount to avoid sync setState-in-effect lint
    const startId = window.setTimeout(() => {
      sync();
      judgeTickRef.current = window.setInterval(() => {
        left -= 1;
        if (left <= 0) {
          if (judgeTickRef.current != null) {
            window.clearInterval(judgeTickRef.current);
            judgeTickRef.current = null;
          }
          setJudgeLeft(0);
          return;
        }
        setJudgeLeft(left);
      }, 1000);
    }, 0);

    return () => {
      window.clearTimeout(startId);
      if (judgeTickRef.current != null) {
        window.clearInterval(judgeTickRef.current);
        judgeTickRef.current = null;
      }
    };
  }, [phase, seal, index]);

  useEffect(() => {
    if (phase !== "playing" || !seal || seal.kind !== "judge") return;
    if (judgeLeft > 0) return;
    if (phaseRef.current !== "playing") return;
    phaseRef.current = "verify";
    const elapsedSec = (performance.now() - sealStartedAt.current) / 1000;
    recordAndSeal("timeout", 1, 0, elapsedSec);
  }, [judgeLeft, phase, seal, recordAndSeal]);

  useEffect(() => {
    if (phase === "playing" && seal?.kind === "calc") {
      inputRef.current?.focus();
    }
  }, [phase, seal, index, attempt]);

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

  const displayScene =
    seal && previewGuess != null && phase === "verify"
      ? sceneWithPreview(seal, previewGuess)
      : seal
        ? phase === "solution"
          ? seal.scene
          : sceneWithPreview(
              seal,
              seal.kind === "calc" && guessText.trim()
                ? Number(guessText.trim())
                : null,
            )
        : null;

  const isPreviewDrawing =
    Boolean(
      seal?.previewKey &&
        ((phase === "verify" && previewGuess != null) ||
          (phase === "playing" &&
            seal.kind === "calc" &&
            guessText.trim().length > 0 &&
            Number.isFinite(Number(guessText.trim())))),
    );

  return (
    <div className="flex flex-col gap-5">
      <section className="quest-card bg-gradient-to-br from-lavender/50 via-sky/20 to-gold/25 p-5 sm:p-7">
        <div className="flex flex-wrap items-start gap-4">
          <Image
            src="/images/grade-3-v2.png"
            alt="별빛"
            width={88}
            height={88}
            className="h-20 w-20 shrink-0 object-contain sm:h-24 sm:w-24"
            priority
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-wood">중3 · 3.2 원의 성질</p>
            <h1 className="font-display mt-1 text-3xl text-foreground sm:text-4xl">
              결계 수리공 별빛: 현과 접선
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-foreground/75 sm:text-base">
              무너진 마법진을 고치세요. 값을 계산해 입력하면 봉인선·빛줄기가
              실제로 그려집니다. 현과 접선의 성질로 12개의 봉인을 잠그세요.
            </p>
          </div>
        </div>
      </section>

      {phase === "ready" ? (
        <section className="quest-card p-5 text-center sm:p-8">
          <p className="text-sm font-semibold text-foreground/70">
            계산해서 입력 → 도형이 그려져 검증됩니다. 판정 문제는 10초!
          </p>
          <ul className="mx-auto mt-4 max-w-md space-y-2 text-left text-sm font-semibold text-wood/80">
            <li>· 1장 봉인선(현) · 2장 빛줄기(접선) · 3장 합체 결계</li>
            <li>· 계산은 2번까지 시도 (2번째는 절반 점수)</li>
            <li>· 결계 에너지 {START_ENERGY}개 · 목표 약 1000점</li>
          </ul>
          <button
            type="button"
            onClick={startFresh}
            className="mt-6 rounded-xl bg-wood px-8 py-3 text-base font-bold text-cream"
          >
            결계 수리 시작
          </button>
        </section>
      ) : null}

      {phase === "ended" ? (
        <section
          className="quest-card border-lavender/40 bg-gradient-to-br from-lavender/45 via-sky/25 to-gold/30 p-5 text-center sm:p-7"
          role="status"
          aria-live="polite"
        >
          <p className="font-display text-3xl text-wood sm:text-4xl">
            {clampScore(score)}점
          </p>
          <p className="mt-2 text-sm font-semibold text-foreground/70">
            {restored
              ? "결계 복구 완료!"
              : "결계가 붕괴했어요… 다시 도전해 보세요"}
            {" · "}
            봉인 {items.filter((it) => it.result === "first" || it.result === "second").length}/
            {TOTAL_SEALS}
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

      {playing && seal && displayScene ? (
        <section className="quest-card p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <EnergyHearts energy={energy} max={MAX_ENERGY} />
            <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-wood">
              <span className="rounded-xl bg-lavender/50 px-3 py-1">
                {chapterLabel(seal.chapter)}
              </span>
              <span className="rounded-xl bg-mint/35 px-3 py-1 tabular-nums">
                봉인 {index + 1}/{TOTAL_SEALS}
              </span>
              <span className="rounded-xl bg-gold/50 px-3 py-1">
                {score}점
              </span>
              {seal.kind === "judge" && phase === "playing" ? (
                <span
                  className={[
                    "rounded-xl px-3 py-1 tabular-nums",
                    judgeLeft <= 3
                      ? "bg-[#e85d4c]/20 text-[#a63a1a]"
                      : "bg-sky/40",
                  ].join(" ")}
                >
                  {judgeLeft}초
                </span>
              ) : null}
              {attempt === 2 && seal.kind === "calc" ? (
                <span className="rounded-xl bg-[#e85d4c]/15 px-3 py-1 text-[#a63a1a]">
                  2번째 시도 · 절반 점수
                </span>
              ) : null}
            </div>
          </div>

          <h2 className="font-display mt-4 text-xl text-wood sm:text-2xl">
            {seal.title}
          </h2>
          <p className="mt-2 text-sm font-semibold leading-relaxed text-foreground/80 sm:text-base">
            {seal.prompt}
          </p>

          <div className="relative mt-4">
            <StarlightSealScene
              seal={seal}
              scene={displayScene}
              showSolution={phase === "solution"}
              selectedId={
                selectedId ??
                (phase === "solution" && seal.kind === "judge"
                  ? String(seal.answer)
                  : null)
              }
              onSelectChord={
                phase === "playing" && seal.kind === "judge"
                  ? submitJudge
                  : undefined
              }
              sealed={phase === "sealed"}
              preview={isPreviewDrawing && phase !== "sealed"}
            />
            {phase === "sealed" ? (
              <p
                className="pointer-events-none absolute inset-x-0 top-3 text-center font-display text-2xl text-wood"
                role="status"
              >
                봉인 잠김!{gained > 0 ? ` +${gained}` : ""}
              </p>
            ) : null}
          </div>

          {phase === "solution" ? (
            <p
              className="mt-3 rounded-2xl bg-lavender/30 px-4 py-3 text-sm font-semibold text-wood"
              role="status"
            >
              {seal.solution}
              <span className="mt-1 block text-xs font-medium text-foreground/60">
                정답:{" "}
                {seal.kind === "judge"
                  ? (seal.options?.find((o) => o.id === String(seal.answer))
                      ?.label ?? String(seal.answer))
                  : `${seal.answer}${seal.unit ?? ""}`}
              </span>
            </p>
          ) : null}

          {phase === "verify" && seal.kind === "calc" ? (
            <p className="mt-3 text-center text-sm font-bold text-wood/70">
              입력한 값으로 도형을 그리는 중…
            </p>
          ) : null}

          {phase === "playing" && seal.kind === "calc" ? (
            <form
              className="mt-4 flex flex-col items-center gap-3 sm:flex-row sm:justify-center"
              onSubmit={(e) => {
                e.preventDefault();
                submitCalc();
              }}
            >
              <label className="sr-only" htmlFor="seal-answer-input">
                답 입력
              </label>
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  id="seal-answer-input"
                  type="number"
                  inputMode="numeric"
                  step={1}
                  value={guessText}
                  onChange={(e) => setGuessText(e.target.value)}
                  placeholder="답을 입력"
                  className="w-36 rounded-xl border-2 border-wood/20 bg-white/90 px-4 py-3 text-center text-lg font-bold tabular-nums text-foreground outline-none focus:border-lavender disabled:opacity-50"
                />
                {seal.unit ? (
                  <span className="text-base font-bold text-wood">
                    {seal.unit}
                  </span>
                ) : null}
              </div>
              <button
                type="submit"
                disabled={!guessText.trim()}
                className="rounded-xl bg-wood px-6 py-3 text-base font-bold text-cream disabled:opacity-40"
              >
                봉인하기
              </button>
            </form>
          ) : null}

          {phase === "playing" && seal.kind === "judge" && seal.options ? (
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {seal.options.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => submitJudge(opt.id)}
                  className={[
                    "rounded-xl border-2 px-4 py-3 text-sm font-bold transition",
                    selectedId === opt.id
                      ? "border-gold bg-gold/40 text-wood"
                      : "border-wood/15 bg-white/80 text-wood hover:border-lavender hover:bg-lavender/20",
                  ].join(" ")}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
