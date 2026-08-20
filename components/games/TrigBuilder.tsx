"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import type { RankingMode, RankingRow, RankingScope } from "@/lib/game-types";
import GameRankingBoard from "@/components/games/GameRankingBoard";
import TrigBuilderScene, {
  type SceneStatus,
} from "@/components/games/TrigBuilderScene";
import TrigBuilderHintModal from "@/components/games/TrigBuilderHintModal";
import {
  submitGameRun,
  fetchGameRanking,
  type GameSubmitClientResult,
} from "@/app/adventure/actions";
import { activityDetailsV1 } from "@/lib/activity-result-schemas";
import {
  CONTENT_KEY,
  HINT_PENALTY,
  STAGES,
  STAGE_COUNT,
  type ExpressionSlots,
  type StageDef,
  type TrigFn,
  applyScoreGain,
  bridgeRatio,
  isExpressionCorrect,
  pointsForStage,
  sideLabelKo,
} from "@/lib/trig-builder-math";

type Phase = "ready" | "playing" | "animating" | "ended";

const TRIG_OPTIONS: TrigFn[] = ["sin", "cos", "tan"];

function Latex({ latex, className }: { latex: string; className?: string }) {
  const html = useMemo(
    () =>
      katex.renderToString(latex, {
        throwOnError: false,
        displayMode: false,
      }),
    [latex],
  );
  return (
    <span className={className} dangerouslySetInnerHTML={{ __html: html }} />
  );
}

function parsePositiveNumber(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function slotsFromInputs(
  lengthRaw: string,
  trig: TrigFn | null,
  angleRaw: string,
): ExpressionSlots {
  const lengthVal = parsePositiveNumber(lengthRaw);
  const angleVal = parsePositiveNumber(angleRaw);
  return {
    length:
      lengthVal !== null
        ? {
            id: "input-length",
            kind: "length",
            value: lengthVal,
            label: String(lengthVal),
          }
        : null,
    trig: trig
      ? { id: "input-trig", kind: "trig", value: trig, label: trig }
      : null,
    angle:
      angleVal !== null
        ? {
            id: "input-angle",
            kind: "angle",
            value: angleVal,
            label: `${angleVal}°`,
          }
        : null,
  };
}

export default function TrigBuilder() {
  const [phase, setPhase] = useState<Phase>("ready");
  const [stageIndex, setStageIndex] = useState(0);
  const [lengthRaw, setLengthRaw] = useState("");
  const [trig, setTrig] = useState<TrigFn | null>(null);
  const [angleRaw, setAngleRaw] = useState("");
  const [trigOpen, setTrigOpen] = useState(false);
  const [score, setScore] = useState(0);
  const [stageWrong, setStageWrong] = useState(0);
  const [stageHints, setStageHints] = useState(0);
  const [totalWrong, setTotalWrong] = useState(0);
  const [totalHints, setTotalHints] = useState(0);
  const [hintOpen, setHintOpen] = useState(false);
  const [cleared, setCleared] = useState(0);
  const [sceneStatus, setSceneStatus] = useState<SceneStatus>("idle");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [submitResult, setSubmitResult] =
    useState<GameSubmitClientResult | null>(null);
  const [ranking, setRanking] = useState<RankingRow[]>([]);
  const [rankingScope, setRankingScope] = useState<RankingScope>("class");
  const [rankingMode, setRankingMode] = useState<RankingMode>("best");
  const [isPending, startTransition] = useTransition();

  const lengthRef = useRef<HTMLInputElement>(null);
  const angleRef = useRef<HTMLInputElement>(null);
  const trigWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!trigOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!trigWrapRef.current?.contains(e.target as Node)) {
        setTrigOpen(false);
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [trigOpen]);

  const stage: StageDef = STAGES[stageIndex]!;
  const slots = useMemo(
    () => slotsFromInputs(lengthRaw, trig, angleRaw),
    [lengthRaw, trig, angleRaw],
  );
  const ratio = bridgeRatio(slots, stage);
  const inputsLocked = phase !== "playing" || sceneStatus !== "idle";
  const canConfirm =
    phase === "playing" &&
    !!slots.length &&
    !!slots.trig &&
    !!slots.angle &&
    sceneStatus === "idle";

  const stagePoints = pointsForStage(stageWrong, stageHints);

  const resetStageLocal = useCallback((idx: number) => {
    setStageIndex(idx);
    setLengthRaw("");
    setTrig(null);
    setAngleRaw("");
    setTrigOpen(false);
    setStageWrong(0);
    setStageHints(0);
    setHintOpen(false);
    setSceneStatus("idle");
    setFeedback(null);
  }, []);

  const startFresh = useCallback(() => {
    setScore(0);
    setTotalWrong(0);
    setTotalHints(0);
    setCleared(0);
    setSubmitResult(null);
    setRanking([]);
    setRankingScope("class");
    setRankingMode("best");
    resetStageLocal(0);
    setPhase("playing");
  }, [resetStageLocal]);

  const endRun = useCallback(
    (
      finalScore: number,
      clearedCount: number,
      wrongs: number,
      hints: number,
    ) => {
      setPhase("ended");
      startTransition(async () => {
        const result = await submitGameRun({
          contentKey: CONTENT_KEY,
          score: finalScore,
          details: activityDetailsV1({
            cleared: clearedCount,
            stages: STAGE_COUNT,
            wrongAttempts: wrongs,
            hintsUsed: hints,
          }),
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

  const loadRanking = useCallback(
    async (opts?: { scope?: RankingScope; mode?: RankingMode }) => {
      const scope = opts?.scope ?? rankingScope;
      const mode = opts?.mode ?? rankingMode;
      if (opts?.scope) setRankingScope(opts.scope);
      if (opts?.mode) setRankingMode(opts.mode);
      startTransition(async () => {
        const rows = await fetchGameRanking({
          contentKey: CONTENT_KEY,
          scope,
          mode,
        });
        setRanking(rows);
      });
    },
    [rankingMode, rankingScope, startTransition],
  );

  const clearInputs = useCallback(() => {
    setLengthRaw("");
    setTrig(null);
    setAngleRaw("");
    setTrigOpen(false);
    setFeedback(null);
  }, []);

  const confirm = useCallback(() => {
    if (!canConfirm) return;
    const correct = isExpressionCorrect(slots, stage);
    if (correct) {
      const gained = pointsForStage(stageWrong, stageHints);
      const nextScore = applyScoreGain(score, gained);
      const nextCleared = cleared + 1;
      setScore(nextScore);
      setCleared(nextCleared);
      setFeedback(`다리를 이었어요! +${nextScore - score}점`);
      setSceneStatus("success");
      setPhase("animating");
    } else {
      const r = ratio ?? 0;
      const nextWrong = stageWrong + 1;
      setStageWrong(nextWrong);
      setTotalWrong((w) => w + 1);
      const nextPoints = pointsForStage(nextWrong, stageHints);
      if (r < 1) {
        setFeedback(
          `다리가 짧아요… 다시 입력해 보세요 (이번 다리 ${nextPoints}점)`,
        );
        setSceneStatus("wrong-short");
      } else {
        setFeedback(
          `다리가 너무 길어요! 절벽을 뚫고 나갔어요 (이번 다리 ${nextPoints}점)`,
        );
        setSceneStatus("wrong-long");
      }
      setPhase("animating");
    }
  }, [canConfirm, slots, stage, stageWrong, stageHints, score, cleared, ratio]);

  const openHint = useCallback(() => {
    if (inputsLocked) return;
    if (stageHints === 0) {
      setStageHints(1);
      setTotalHints((h) => h + 1);
      setFeedback(
        `힌트를 열었어요 (−${HINT_PENALTY}점). 이번 다리 ${pointsForStage(stageWrong, 1)}점`,
      );
    }
    setHintOpen(true);
  }, [inputsLocked, stageHints, stageWrong]);

  const scoreRef = useRef(score);
  scoreRef.current = score;
  const clearedRef = useRef(cleared);
  clearedRef.current = cleared;
  const totalWrongRef = useRef(totalWrong);
  totalWrongRef.current = totalWrong;
  const totalHintsRef = useRef(totalHints);
  totalHintsRef.current = totalHints;

  const onSceneAnimCompleteStable = useCallback(
    (status: SceneStatus) => {
      if (status === "success") {
        if (stageIndex + 1 >= STAGE_COUNT) {
          endRun(
            scoreRef.current,
            clearedRef.current,
            totalWrongRef.current,
            totalHintsRef.current,
          );
        } else {
          resetStageLocal(stageIndex + 1);
          setPhase("playing");
        }
        return;
      }
      if (status === "wrong-short" || status === "wrong-long") {
        setSceneStatus("falling");
        return;
      }
      if (status === "falling") {
        setSceneStatus("idle");
        setPhase("playing");
      }
    },
    [stageIndex, endRun, resetStageLocal],
  );

  return (
    <div className="space-y-4">
      {phase === "ready" ? (
        <section className="quest-card border-lavender/40 bg-gradient-to-br from-lavender/40 via-sky/20 to-gold/25 p-5 sm:p-7">
          <h1 className="font-display text-2xl text-wood sm:text-3xl">
            삼각비 다리 놓기
          </h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-relaxed text-foreground/70 sm:text-base">
            끊어진 다리 길이{" "}
            <Latex latex="x" className="mx-0.5 font-bold text-wood" />를{" "}
            <strong className="text-wood">길이 × 삼각비(각도)</strong>로 직접
            입력해 보세요. 계산기 없이{" "}
            <strong className="text-wood">수식 그 자체</strong>로 변의 길이를
            표현하는 감각을 길러요.
          </p>
          <ul className="mt-4 list-disc space-y-1 pl-5 text-sm font-semibold text-foreground/65">
            <li>스테이지 {STAGE_COUNT}개 · 만점 약 1000점</li>
            <li>길이와 각도는 숫자 입력, 삼각비는 sin · cos · tan 중 선택</li>
            <li>어려우면 힌트(−{HINT_PENALTY}점)로 그림을 바로잡아 보세요</li>
            <li>
              <Latex latex="\sin\theta=\cos(90^\circ-\theta)" /> 처럼 동치인
              식도 정답이에요
            </li>
          </ul>
          <button
            type="button"
            onClick={startFresh}
            className="mt-6 rounded-xl bg-wood px-6 py-3 text-base font-bold text-cream"
          >
            다리 놓기 시작
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
            {score}점
          </p>
          <p className="mt-2 text-sm font-semibold text-foreground/70">
            다리 {cleared}/{STAGE_COUNT}개 연결 · 오답 {totalWrong}회 · 힌트{" "}
            {totalHints}회
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

      {phase === "playing" || phase === "animating" ? (
        <>
          <section className="quest-card overflow-hidden p-3 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm font-bold text-wood">
              <span className="rounded-xl bg-lavender/45 px-3 py-1">
                스테이지 {stageIndex + 1}/{STAGE_COUNT}
              </span>
              <span className="rounded-xl bg-gold/50 px-3 py-1">
                {score}점
              </span>
              {stageWrong > 0 || stageHints > 0 ? (
                <span className="rounded-xl bg-[#e85d4c]/15 px-3 py-1 text-[#a63a1a]">
                  {stageWrong > 0 ? `오답 ${stageWrong}` : null}
                  {stageWrong > 0 && stageHints > 0 ? " · " : null}
                  {stageHints > 0 ? `힌트 ${stageHints}` : null}
                  {" · "}지금 맞히면 {stagePoints}점
                </span>
              ) : (
                <span className="rounded-xl bg-mint/35 px-3 py-1 text-wood/70">
                  이번 다리 {stagePoints}점
                </span>
              )}
            </div>

            <TrigBuilderScene
              stage={stage}
              ratio={ratio}
              status={sceneStatus}
              onAnimComplete={onSceneAnimCompleteStable}
            />

            <p className="mt-3 text-center text-sm font-semibold text-foreground/65">
              기준각 {stage.theta}° · 주어진 {sideLabelKo(stage.givenSide)}{" "}
              {stage.givenLength} · 구할 변은 {sideLabelKo(stage.unknownSide)}{" "}
              <Latex latex="x" />
            </p>
            <p className="mt-1 text-center text-xs font-medium text-wood/55">
              {stage.hint}
            </p>
          </section>

          <section className="quest-card p-4 sm:p-5">
            <div className="flex flex-wrap items-end justify-center gap-2 sm:gap-3">
              {/* Length */}
              <label className="flex flex-col items-center gap-1">
                <span className="text-[10px] font-bold tracking-wide text-wood/45">
                  길이
                </span>
                <input
                  ref={lengthRef}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  disabled={inputsLocked}
                  value={lengthRaw}
                  onChange={(e) => {
                    setLengthRaw(e.target.value);
                    setFeedback(null);
                  }}
                  placeholder="?"
                  className="w-20 rounded-2xl border-2 border-gold/60 bg-gold/30 px-2 py-3 text-center text-lg font-black tabular-nums text-wood outline-none focus:border-wood disabled:opacity-50 sm:w-24"
                  aria-label="길이 입력"
                />
              </label>

              <span className="mb-3 text-xl font-black text-wood">×</span>

              {/* Trig picker */}
              <div
                ref={trigWrapRef}
                className="relative flex flex-col items-center gap-1"
              >
                <span className="text-[10px] font-bold tracking-wide text-wood/45">
                  삼각비
                </span>
                <button
                  type="button"
                  disabled={inputsLocked}
                  onClick={() => setTrigOpen((o) => !o)}
                  className={[
                    "min-w-[88px] rounded-2xl border-2 px-3 py-3 text-base font-black outline-none transition disabled:opacity-50",
                    trig
                      ? "border-lavender/70 bg-lavender/45 text-wood"
                      : "border-dashed border-wood/30 bg-wood/5 text-wood/40",
                  ].join(" ")}
                  aria-haspopup="listbox"
                  aria-expanded={trigOpen}
                  aria-label="삼각비 선택"
                >
                  {trig ? (
                    <Latex latex={`\\${trig}`} />
                  ) : (
                    <span className="text-sm">선택</span>
                  )}
                </button>
                {trigOpen && !inputsLocked ? (
                  <ul
                    role="listbox"
                    className="absolute top-full z-20 mt-1 flex min-w-[88px] flex-col overflow-hidden rounded-2xl border-2 border-lavender/50 bg-cream shadow-lg"
                  >
                    {TRIG_OPTIONS.map((fn) => (
                      <li key={fn} role="option" aria-selected={trig === fn}>
                        <button
                          type="button"
                          className={[
                            "w-full px-4 py-2.5 text-center text-base font-black transition hover:bg-lavender/35",
                            trig === fn ? "bg-lavender/40" : "",
                          ].join(" ")}
                          onClick={() => {
                            setTrig(fn);
                            setTrigOpen(false);
                            setFeedback(null);
                          }}
                        >
                          <Latex latex={`\\${fn}`} />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>

              <span className="mb-3 text-xl font-black text-wood">(</span>

              {/* Angle with degree symbol */}
              <label className="flex flex-col items-center gap-1">
                <span className="text-[10px] font-bold tracking-wide text-wood/45">
                  각도
                </span>
                <div className="flex items-center gap-1 rounded-2xl border-2 border-sky/70 bg-sky/35 px-2 py-1.5 focus-within:border-wood">
                  <input
                    ref={angleRef}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={90}
                    step="any"
                    disabled={inputsLocked}
                    value={angleRaw}
                    onChange={(e) => {
                      setAngleRaw(e.target.value);
                      setFeedback(null);
                    }}
                    placeholder="?"
                    className="w-14 bg-transparent py-1.5 text-center text-lg font-black tabular-nums text-wood outline-none disabled:opacity-50 sm:w-16"
                    aria-label="각도 입력"
                  />
                  <span
                    className="pr-1 text-lg font-black text-wood"
                    aria-hidden
                  >
                    °
                  </span>
                </div>
              </label>

              <span className="mb-3 text-xl font-black text-wood">)</span>
            </div>

            {feedback ? (
              <p
                className={[
                  "mt-3 rounded-2xl px-4 py-3 text-center text-sm font-bold",
                  sceneStatus === "success"
                    ? "bg-mint/40 text-wood"
                    : "bg-[#e85d4c]/15 text-[#a63a1a]",
                ].join(" ")}
                role="status"
              >
                {feedback}
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                disabled={!canConfirm}
                onClick={confirm}
                className="rounded-xl bg-wood px-6 py-3 text-base font-bold text-cream disabled:opacity-40"
              >
                다리 놓기 확인
              </button>
              <button
                type="button"
                disabled={inputsLocked}
                onClick={openHint}
                className="rounded-xl border-2 border-lavender/70 bg-lavender/35 px-4 py-3 text-sm font-bold text-wood disabled:opacity-40"
              >
                {stageHints > 0
                  ? "힌트 다시 보기"
                  : `힌트 (−${HINT_PENALTY}점)`}
              </button>
              <button
                type="button"
                disabled={inputsLocked}
                onClick={clearInputs}
                className="rounded-xl bg-wood/10 px-4 py-3 text-sm font-bold text-wood disabled:opacity-40"
              >
                입력 비우기
              </button>
            </div>
          </section>

          <TrigBuilderHintModal
            stage={stage}
            open={hintOpen}
            onClose={() => setHintOpen(false)}
          />
        </>
      ) : null}
    </div>
  );
}
