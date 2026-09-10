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
  START_LIVES,
  MAX_LIVES,
  TOTAL_ROUNDS,
  TAP_TIME_SEC,
  LOCK_TOL,
  type Round,
  generateAllRounds,
  isDragRound,
  isInLockZone,
  checkTap,
  checkEqual,
  pointsForLock,
  liveMetric,
  targetMetric,
  clampScore,
  applyScoreGain,
} from "@/lib/starlight-seal-math";

type Phase = "ready" | "playing" | "locked" | "miss" | "ended";

type ItemResult = "lock" | "miss" | "timeout";

type RunItem = {
  i: number;
  kind: string;
  result: ItemResult;
  timeSec: number;
};

function Hearts({ lives, max }: { lives: number; max: number }) {
  return (
    <div className="flex items-center gap-1.5" aria-label={`생명 ${lives}`}>
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className={[
            "inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-black",
            i < lives ? "bg-[#e85d4c] text-white" : "bg-wood/10 text-wood/25",
          ].join(" ")}
        >
          ♥
        </span>
      ))}
    </div>
  );
}

export default function StarlightSeal() {
  const [phase, setPhase] = useState<Phase>("ready");
  const [rounds, setRounds] = useState<Round[]>([]);
  const [index, setIndex] = useState(0);
  const [lives, setLives] = useState(START_LIVES);
  const [score, setScore] = useState(0);
  const [value, setValue] = useState(0);
  const [items, setItems] = useState<RunItem[]>([]);
  const [gained, setGained] = useState(0);
  const [tapLeft, setTapLeft] = useState(TAP_TIME_SEC);
  const [selectedTap, setSelectedTap] = useState<string | null>(null);
  const [clearedAll, setClearedAll] = useState(false);
  const [submitResult, setSubmitResult] =
    useState<GameSubmitClientResult | null>(null);
  const [ranking, setRanking] = useState<RankingRow[]>([]);
  const [rankingScope, setRankingScope] = useState<RankingScope>("class");
  const [rankingMode, setRankingMode] = useState<RankingMode>("best");
  const [isPending, startTransition] = useTransition();

  const phaseRef = useRef<Phase>(phase);
  const startedAt = useRef(0);
  const tapTimerRef = useRef<number | null>(null);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const round = rounds[index] ?? null;
  const playing = phase === "playing" || phase === "locked" || phase === "miss";
  const inZone = round ? isInLockZone(round, value) : false;

  useGamePresence(CONTENT_KEY, {
    phase: playing ? "playing" : phase === "ended" ? "ended" : "lobby",
    liveScore: playing || phase === "ended" ? score : null,
  });

  const beginRound = useCallback((list: Round[], i: number) => {
    const r = list[i];
    if (!r) return;
    setIndex(i);
    setValue(r.startValue);
    setSelectedTap(null);
    setGained(0);
    setTapLeft(TAP_TIME_SEC);
    startedAt.current = performance.now();
    setPhase("playing");
  }, []);

  const startFresh = useCallback(() => {
    const list = generateAllRounds();
    setRounds(list);
    setLives(START_LIVES);
    setScore(0);
    setItems([]);
    setClearedAll(false);
    setSubmitResult(null);
    setRanking([]);
    setRankingScope("class");
    setRankingMode("best");
    beginRound(list, 0);
  }, [beginRound]);

  const endRun = useCallback(
    (
      finalScore: number,
      finalItems: RunItem[],
      allClear: boolean,
      livesLeft: number,
    ) => {
      setPhase("ended");
      setClearedAll(allClear);
      startTransition(async () => {
        const locks = finalItems.filter((it) => it.result === "lock").length;
        const result = await submitGameRun({
          contentKey: CONTENT_KEY,
          score: clampScore(finalScore),
          details: activityDetailsV1(
            {
              sealsCleared: locks,
              totalSeals: TOTAL_ROUNDS,
              wrongAttempts: finalItems.filter((it) => it.result !== "lock")
                .length,
              energyLeft: livesLeft,
              restored: allClear,
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

  const advance = useCallback(
    (
      nextScore: number,
      nextLives: number,
      nextItems: RunItem[],
      nextIndex: number,
    ) => {
      if (nextLives <= 0) {
        endRun(nextScore, nextItems, false, 0);
        return;
      }
      if (nextIndex >= TOTAL_ROUNDS) {
        endRun(nextScore, nextItems, true, nextLives);
        return;
      }
      beginRound(rounds, nextIndex);
    },
    [beginRound, endRun, rounds],
  );

  const succeed = useCallback(() => {
    if (!round || phaseRef.current !== "playing") return;
    phaseRef.current = "locked";
    const elapsed = (performance.now() - startedAt.current) / 1000;
    const perfect =
      isDragRound(round.kind) &&
      Math.abs(liveMetric(round, value) - targetMetric(round)) <= LOCK_TOL / 2;
    const raw = pointsForLock(round, elapsed, perfect);
    const nextScore = applyScoreGain(score, raw);
    setScore(nextScore);
    setGained(nextScore - score);
    const item: RunItem = {
      i: round.index + 1,
      kind: round.kind,
      result: "lock",
      timeSec: Math.round(elapsed * 10) / 10,
    };
    const nextItems = [...items, item];
    setItems(nextItems);
    setPhase("locked");
    window.setTimeout(() => {
      advance(nextScore, lives, nextItems, index + 1);
    }, 900);
  }, [round, score, value, items, lives, index, advance]);

  const fail = useCallback(
    (result: "miss" | "timeout") => {
      if (!round || phaseRef.current !== "playing") return;
      phaseRef.current = "miss";
      const elapsed = (performance.now() - startedAt.current) / 1000;
      const nextLives = lives - 1;
      setLives(nextLives);
      const item: RunItem = {
        i: round.index + 1,
        kind: round.kind,
        result,
        timeSec: Math.round(elapsed * 10) / 10,
      };
      const nextItems = [...items, item];
      setItems(nextItems);
      setPhase("miss");
      window.setTimeout(() => {
        advance(score, nextLives, nextItems, index + 1);
      }, 1100);
    },
    [round, lives, items, score, index, advance],
  );

  /** Auto-update drag value. Lock on release in green zone or 잠그기 button. */
  const onValueChange = useCallback(
    (v: number) => {
      if (phaseRef.current !== "playing" || !round) return;
      setValue(v);
    },
    [round],
  );

  const onPointerReleaseLock = useCallback(() => {
    if (phaseRef.current !== "playing" || !round) return;
    if (!isDragRound(round.kind)) return;
    if (isInLockZone(round, value)) {
      succeed();
    }
  }, [round, value, succeed]);

  // Tap timer
  useEffect(() => {
    if (phase !== "playing" || !round) return;
    if (round.kind !== "tap-longest") return;
    let left = TAP_TIME_SEC;
    const startId = window.setTimeout(() => {
      setTapLeft(left);
      tapTimerRef.current = window.setInterval(() => {
        left -= 1;
        if (left <= 0) {
          if (tapTimerRef.current != null) {
            window.clearInterval(tapTimerRef.current);
            tapTimerRef.current = null;
          }
          setTapLeft(0);
          return;
        }
        setTapLeft(left);
      }, 1000);
    }, 0);
    return () => {
      window.clearTimeout(startId);
      if (tapTimerRef.current != null) {
        window.clearInterval(tapTimerRef.current);
        tapTimerRef.current = null;
      }
    };
  }, [phase, round, index]);

  useEffect(() => {
    if (phase !== "playing" || !round || round.kind !== "tap-longest") return;
    if (tapLeft > 0) return;
    if (phaseRef.current !== "playing") return;
    fail("timeout");
  }, [tapLeft, phase, round, fail]);

  const onTap = (id: string) => {
    if (!round || phaseRef.current !== "playing") return;
    setSelectedTap(id);
    if (checkTap(round, id)) succeed();
    else fail("miss");
  };

  const onEqual = (id: string) => {
    if (!round || phaseRef.current !== "playing") return;
    if (checkEqual(round, id)) succeed();
    else fail("miss");
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

  return (
    <div className="flex flex-col gap-5">
      <section className="quest-card bg-gradient-to-br from-lavender/50 via-sky/15 to-gold/25 p-5 sm:p-7">
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
              현·접선 거리 챌린지
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-foreground/75 sm:text-base">
              현을 원의 중심에 가깝게·멀게 <strong>드래그</strong>해서 목표
              길이에 맞추세요. 접선은 점 P를 끌어 길이를 잠급니다. 초록이 되면
              손을 떼세요!
            </p>
          </div>
        </div>
      </section>

      {phase === "ready" ? (
        <section className="quest-card p-5 text-center sm:p-8">
          <p className="text-base font-bold text-wood">조작은 단 하나 — 끌어 맞추기</p>
          <ul className="mx-auto mt-4 max-w-md space-y-2 text-left text-sm font-semibold text-wood/80">
            <li>· 현을 위아래로 당겨 목표 길이에 맞추기 (초록이면 잠그기)</li>
            <li>· 점 P를 끌어 접선 길이 맞추기</li>
            <li>· 가끔 “가장 긴 현” 빠르게 고르기</li>
            <li>· 생명 {START_LIVES} · 12라운드 · 목표 약 1000점</li>
          </ul>
          <button
            type="button"
            onClick={startFresh}
            className="mt-6 rounded-xl bg-wood px-8 py-3 text-base font-bold text-cream"
          >
            챌린지 시작
          </button>
        </section>
      ) : null}

      {phase === "ended" ? (
        <section
          className="quest-card border-lavender/40 bg-gradient-to-br from-lavender/40 via-mint/20 to-gold/25 p-5 text-center sm:p-7"
          role="status"
        >
          <p className="font-display text-3xl text-wood sm:text-4xl">
            {clampScore(score)}점
          </p>
          <p className="mt-2 text-sm font-semibold text-foreground/70">
            {clearedAll ? "전체 클리어!" : "생명 소진… 다시 도전해 보세요"}
            {" · "}
            성공 {items.filter((it) => it.result === "lock").length}/
            {TOTAL_ROUNDS}
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

      {playing && round ? (
        <section className="quest-card p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Hearts lives={lives} max={MAX_LIVES} />
            <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-wood">
              <span className="rounded-xl bg-lavender/50 px-3 py-1">
                {round.title}
              </span>
              <span className="rounded-xl bg-mint/35 px-3 py-1 tabular-nums">
                {index + 1}/{TOTAL_ROUNDS}
              </span>
              <span className="rounded-xl bg-gold/50 px-3 py-1">{score}점</span>
              {round.kind === "tap-longest" && phase === "playing" ? (
                <span
                  className={[
                    "rounded-xl px-3 py-1 tabular-nums",
                    tapLeft <= 2
                      ? "bg-[#e85d4c]/20 text-[#a63a1a]"
                      : "bg-sky/40",
                  ].join(" ")}
                >
                  {tapLeft}초
                </span>
              ) : null}
            </div>
          </div>

          <p className="mt-4 text-base font-bold leading-relaxed text-wood sm:text-lg">
            {round.prompt}
          </p>
          <p className="mt-1 text-xs font-semibold text-foreground/55">
            {round.tip}
          </p>

          {isDragRound(round.kind) ? (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-3 text-sm font-black">
              <span className="rounded-xl bg-wood/8 px-3 py-1.5 text-wood">
                목표{" "}
                <span className="text-lavender-700 text-[#6d28d9]">
                  {targetMetric(round).toFixed(0)}
                </span>
              </span>
              <span
                className={[
                  "rounded-xl px-3 py-1.5",
                  inZone
                    ? "bg-mint/50 text-wood"
                    : "bg-wood/8 text-foreground/70",
                ].join(" ")}
              >
                지금 {liveMetric(round, value).toFixed(1)}
                {inZone ? " · OK!" : ""}
              </span>
            </div>
          ) : null}

          <div
            className="relative mt-3"
            onPointerUp={onPointerReleaseLock}
            onPointerCancel={onPointerReleaseLock}
          >
            <StarlightSealScene
              round={round}
              value={value}
              onValueChange={onValueChange}
              inZone={inZone && phase === "playing"}
              locked={phase === "locked"}
              selectedTapId={selectedTap}
              onTapChord={
                phase === "playing" && round.kind === "tap-longest"
                  ? onTap
                  : undefined
              }
              disabled={phase !== "playing"}
            />
            {phase === "locked" ? (
              <p
                className="pointer-events-none absolute inset-x-0 top-10 text-center font-display text-2xl text-wood"
                role="status"
              >
                잠금!{gained > 0 ? ` +${gained}` : ""}
              </p>
            ) : null}
            {phase === "miss" ? (
              <p
                className="pointer-events-none absolute inset-x-0 top-10 text-center font-display text-2xl text-[#a63a1a]"
                role="status"
              >
                아쉬워요!
              </p>
            ) : null}
          </div>

          {phase === "playing" && isDragRound(round.kind) ? (
            <div className="mt-3 flex flex-col items-center gap-3">
              <label className="flex w-full max-w-md flex-col gap-1.5 px-2">
                <span className="text-center text-xs font-bold text-wood/70">
                  {round.kind === "tangent-length"
                    ? "점 P 거리 (슬라이더로도 조절)"
                    : "현 거리 (슬라이더로도 조절)"}
                </span>
                <input
                  type="range"
                  min={round.dragMin}
                  max={round.dragMax}
                  step={0.1}
                  value={value}
                  onChange={(e) => onValueChange(Number(e.target.value))}
                  className="w-full accent-[#7c3aed]"
                  aria-label="거리 조절"
                />
              </label>
              <button
                type="button"
                disabled={!inZone}
                onClick={succeed}
                className="rounded-xl bg-wood px-8 py-3 text-base font-bold text-cream disabled:opacity-35"
              >
                {inZone ? "잠그기 ✓" : "목표에 더 가까이…"}
              </button>
            </div>
          ) : null}

          {phase === "playing" &&
          round.kind === "tangent-equal" &&
          round.equalOptions ? (
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {round.equalOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onEqual(opt.id)}
                  className="rounded-xl border-2 border-wood/15 bg-white/90 px-3 py-3 text-sm font-bold text-wood hover:border-lavender hover:bg-lavender/20"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          ) : null}

          {phase === "playing" && round.kind === "tap-longest" ? (
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {round.tapChords?.map((ch) => (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => onTap(ch.id)}
                  className="rounded-xl border-2 border-wood/15 bg-white/90 px-3 py-3 text-sm font-bold text-wood hover:border-lavender hover:bg-lavender/25"
                >
                  {ch.label} (거리 {Math.round(ch.dist)})
                </button>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
