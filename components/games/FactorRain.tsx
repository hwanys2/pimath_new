"use client";

import {
  useCallback,
  useEffect,
  useEffectEvent,
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
  FACTOR_PRIMES,
  START_LIVES,
  MAX_LIVES,
  MAX_ACTIVE,
  FIELD_HEIGHT,
  dealComposite,
  difficultyAt,
  randomSpawnX,
  pointsForClear,
  clampScore,
  applyScoreGain,
} from "@/lib/factor-rain-math";

const CONTENT_KEY = "g1-u1-1-factor-rain";

type Phase = "ready" | "playing" | "ended";

type FallingNumber = {
  id: number;
  /** Current displayed value (shrinks as factors are applied). */
  value: number;
  /** Value when spawned — used for scoring. */
  original: number;
  /** How many successful divisions so far. */
  steps: number;
  x: number;
  y: number;
  /** Brief scale pop after a correct divide. */
  popUntil: number;
  /** Shake after wrong prime. */
  shakeUntil: number;
};

type Burst = {
  id: number;
  x: number;
  y: number;
  label: string;
  until: number;
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

export default function FactorRain() {
  const [phase, setPhase] = useState<Phase>("ready");
  const [lives, setLives] = useState(START_LIVES);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [cleared, setCleared] = useState(0);
  const [numbers, setNumbers] = useState<FallingNumber[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [statusMsg, setStatusMsg] = useState("");
  const [missFlash, setMissFlash] = useState(false);
  const [frameNow, setFrameNow] = useState(0);
  const [submitResult, setSubmitResult] = useState<GameSubmitClientResult | null>(
    null,
  );
  const [ranking, setRanking] = useState<RankingRow[]>([]);
  const [rankingScope, setRankingScope] = useState<RankingScope>("class");
  const [rankingMode, setRankingMode] = useState<RankingMode>("best");
  const [isPending, startTransition] = useTransition();

  const idRef = useRef(1);
  const nextSpawnAtRef = useRef(0);
  const startedAtRef = useRef(0);
  const lastTsRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const endingRef = useRef(false);

  const numbersRef = useRef(numbers);
  const selectedIdRef = useRef(selectedId);
  const livesRef = useRef(lives);
  const scoreRef = useRef(score);
  const streakRef = useRef(streak);
  const clearedRef = useRef(cleared);
  const phaseRef = useRef(phase);

  useEffect(() => {
    numbersRef.current = numbers;
  }, [numbers]);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);
  useEffect(() => {
    livesRef.current = lives;
  }, [lives]);
  useEffect(() => {
    scoreRef.current = score;
  }, [score]);
  useEffect(() => {
    streakRef.current = streak;
  }, [streak]);
  useEffect(() => {
    clearedRef.current = cleared;
  }, [cleared]);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const endGame = useEffectEvent((finalScore: number) => {
    if (endingRef.current) return;
    endingRef.current = true;
    setPhase("ended");
    setSelectedId(null);
    setStatusMsg("");
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
  });

  const tick = useEffectEvent((ts: number) => {
    if (phaseRef.current !== "playing") return;

    if (!lastTsRef.current) lastTsRef.current = ts;
    const dt = Math.min(0.05, (ts - lastTsRef.current) / 1000);
    lastTsRef.current = ts;
    setFrameNow(ts);

    const elapsed = (ts - startedAtRef.current) / 1000;
    const diff = difficultyAt(elapsed, clearedRef.current);
    const selected = selectedIdRef.current;
    let next = numbersRef.current.map((n) => ({ ...n }));
    const hitBottom: FallingNumber[] = [];

    for (const n of next) {
      if (n.id === selected) continue;
      n.y += diff.fallSpeed * dt;
      if (n.y >= FIELD_HEIGHT) hitBottom.push(n);
    }

    if (hitBottom.length > 0) {
      const hitIds = new Set(hitBottom.map((h) => h.id));
      next = next.filter((n) => !hitIds.has(n.id));
      if (selected && hitIds.has(selected)) {
        selectedIdRef.current = null;
        setSelectedId(null);
      }
      const lost = hitBottom.length;
      const nextLives = Math.max(0, livesRef.current - lost);
      livesRef.current = nextLives;
      setLives(nextLives);
      setStreak(0);
      streakRef.current = 0;
      setMissFlash(true);
      window.setTimeout(() => setMissFlash(false), 350);
      setStatusMsg(
        lost === 1
          ? "바닥에 닿았어요! 생명 −1"
          : `바닥에 ${lost}개가 닿았어요! 생명 −${lost}`,
      );

      if (nextLives <= 0) {
        numbersRef.current = next;
        setNumbers(next);
        endGame(scoreRef.current);
        return;
      }
    }

    if (ts >= nextSpawnAtRef.current && next.length < MAX_ACTIVE) {
      const id = idRef.current++;
      const value = dealComposite(diff);
      next.push({
        id,
        value,
        original: value,
        steps: 0,
        x: randomSpawnX(),
        y: -6 - Math.random() * 8,
        popUntil: 0,
        shakeUntil: 0,
      });
      nextSpawnAtRef.current = ts + diff.spawnInterval * 1000;
    }

    numbersRef.current = next;
    setNumbers(next);
    setBursts((prev) => prev.filter((b) => b.until > ts));

    rafRef.current = requestAnimationFrame(tick);
  });

  const stopLoop = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    lastTsRef.current = 0;
  }, []);

  const startGame = useCallback(() => {
    stopLoop();
    endingRef.current = false;
    idRef.current = 1;
    const now = performance.now();
    startedAtRef.current = now;
    nextSpawnAtRef.current = now + 500;
    lastTsRef.current = 0;

    setLives(START_LIVES);
    setScore(0);
    setStreak(0);
    setCleared(0);
    setNumbers([]);
    setSelectedId(null);
    setBursts([]);
    setStatusMsg("떨어지는 숫자를 누르고, 아래 소수로 나눠 보세요!");
    setMissFlash(false);
    setSubmitResult(null);
    setRanking([]);
    setRankingScope("class");
    setRankingMode("best");
    setPhase("playing");

    livesRef.current = START_LIVES;
    scoreRef.current = 0;
    streakRef.current = 0;
    clearedRef.current = 0;
    numbersRef.current = [];
    selectedIdRef.current = null;
    phaseRef.current = "playing";

    rafRef.current = requestAnimationFrame(tick);
  }, [stopLoop]);

  useEffect(() => {
    return () => stopLoop();
  }, [stopLoop]);

  useEffect(() => {
    if (phase !== "playing") stopLoop();
  }, [phase, stopLoop]);

  const selectNumber = (id: number) => {
    if (phase !== "playing") return;
    setSelectedId(id);
    selectedIdRef.current = id;
    const n = numbersRef.current.find((x) => x.id === id);
    if (n) {
      setStatusMsg(
        `${n.value.toLocaleString("ko-KR")} 선택 · 소수로 나누기`,
      );
    }
  };

  const tryPrime = (p: number) => {
    if (phase !== "playing") return;
    const sel = selectedIdRef.current;
    if (sel == null) {
      setStatusMsg("먼저 떨어지는 숫자를 눌러 선택하세요!");
      return;
    }

    const now = performance.now();
    const list = numbersRef.current.map((n) => ({ ...n }));
    const idx = list.findIndex((n) => n.id === sel);
    if (idx < 0) {
      setSelectedId(null);
      selectedIdRef.current = null;
      return;
    }

    const target = list[idx]!;
    if (target.value % p !== 0) {
      target.shakeUntil = now + 320;
      list[idx] = target;
      numbersRef.current = list;
      setNumbers(list);
      setStatusMsg(`${target.value} ÷ ${p} 은 나누어떨어지지 않아요`);
      return;
    }

    const nextValue = target.value / p;
    const nextSteps = target.steps + 1;

    if (nextValue === 1) {
      const gained = pointsForClear(
        target.original,
        nextSteps,
        streakRef.current,
      );
      const nextScore = applyScoreGain(scoreRef.current, gained);
      const nextStreak = streakRef.current + 1;
      const nextCleared = clearedRef.current + 1;

      scoreRef.current = nextScore;
      streakRef.current = nextStreak;
      clearedRef.current = nextCleared;
      setScore(nextScore);
      setStreak(nextStreak);
      setCleared(nextCleared);

      list.splice(idx, 1);
      numbersRef.current = list;
      setNumbers(list);
      setSelectedId(null);
      selectedIdRef.current = null;

      const burstId = idRef.current++;
      setBursts((prev) => [
        ...prev,
        {
          id: burstId,
          x: target.x,
          y: Math.min(Math.max(target.y, 8), 88),
          label: `+${gained}`,
          until: now + 700,
        },
      ]);
      setStatusMsg(
        `${target.original.toLocaleString("ko-KR")} 소인수분해 완료! +${gained}점`,
      );
      return;
    }

    target.value = nextValue;
    target.steps = nextSteps;
    target.popUntil = now + 220;
    list[idx] = target;
    numbersRef.current = list;
    setNumbers(list);
    setStatusMsg(
      `${target.original.toLocaleString("ko-KR")} → ${nextValue.toLocaleString("ko-KR")}  (÷${p})`,
    );
  };

  const loadRanking = (next: {
    scope?: RankingScope;
    mode?: RankingMode;
  }) => {
    const scope = next.scope ?? rankingScope;
    const mode = next.mode ?? rankingMode;
    if (next.scope) setRankingScope(scope);
    if (next.mode) setRankingMode(mode);
    startTransition(async () => {
      const rows = await fetchGameRanking({
        contentKey: CONTENT_KEY,
        scope,
        mode,
      });
      setRanking(rows);
    });
  };

  const selected = numbers.find((n) => n.id === selectedId) ?? null;

  return (
    <div className="flex flex-col gap-5">
      <section className="quest-card bg-gradient-to-br from-mint/40 via-sky/20 to-gold/25 p-5 sm:p-7">
        <p className="text-sm font-bold text-wood">중1 · 1.1 소인수분해</p>
        <h1 className="font-display mt-1 text-3xl text-foreground sm:text-4xl">
          소인수분해 소나기
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-foreground/75 sm:text-base">
          위에서 숫자가 내려와요. 숫자를 고른 뒤 아래 소수(2~19)로 나눠 1이 될
          때까지 소인수분해하세요. 바닥에 닿기 전에 끝내야 해요!
        </p>
      </section>

      {phase === "ready" ? (
        <section className="quest-card border-mint/40 bg-gradient-to-br from-sky/30 via-mint/25 to-gold/20 p-6 text-center sm:p-8">
          <ol className="mx-auto max-w-md space-y-3 text-left text-sm font-semibold text-foreground/80 sm:text-base">
            <li className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-mint font-black text-wood">
                1
              </span>
              <span>떨어지는 숫자를 눌러 선택해요 (선택하면 잠깐 멈춰요).</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky font-black text-wood">
                2
              </span>
              <span>아래 소수 버튼으로 나누어떨어질 때까지 나눠요.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold font-black text-wood">
                3
              </span>
              <span>1이 되면 클리어! 바닥에 닿으면 생명이 줄어요.</span>
            </li>
          </ol>
          <button
            type="button"
            onClick={startGame}
            className="mt-8 rounded-xl bg-wood px-8 py-3.5 text-lg font-bold text-cream shadow-md transition hover:bg-wood-dark active:scale-[0.98]"
          >
            시작하기
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
            {cleared}개 소인수분해했어요
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
            onClick={startGame}
            className="mt-6 rounded-xl bg-wood px-6 py-3 text-base font-bold text-cream"
          >
            다시 하기
          </button>
        </section>
      ) : null}

      {phase === "playing" ? (
        <>
          <section className="quest-card-static overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-wood/10 px-4 py-3 sm:px-5">
              <Hearts lives={lives} max={MAX_LIVES} />
              <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-wood">
                <span className="rounded-xl bg-gold/50 px-3 py-1">{score}점</span>
                <span className="rounded-xl bg-mint/35 px-3 py-1">
                  클리어 {cleared}
                </span>
                {streak > 1 ? (
                  <span className="rounded-xl bg-sky/50 px-3 py-1">
                    연속 {streak}
                  </span>
                ) : null}
              </div>
            </div>

            <div
              className={[
                "relative h-[min(52vh,28rem)] w-full overflow-hidden sm:h-[min(56vh,32rem)]",
                "bg-gradient-to-b from-[#b8e4ff] via-[#d4f5e8] to-[#fff3c4]",
                missFlash ? "ring-4 ring-inset ring-[#e85d4c]/55" : "",
              ].join(" ")}
              role="application"
              aria-label="소인수분해 소나기 플레이 영역"
            >
              <div
                className="pointer-events-none absolute -left-8 top-6 h-16 w-28 rounded-full bg-white/45 blur-[1px]"
                aria-hidden
              />
              <div
                className="pointer-events-none absolute right-4 top-16 h-12 w-24 rounded-full bg-white/40 blur-[1px]"
                aria-hidden
              />
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 h-2.5 bg-gradient-to-t from-[#e85d4c]/50 to-transparent"
                aria-hidden
              />

              {numbers.map((n) => {
                const isSel = n.id === selectedId;
                const popping = n.popUntil > frameNow;
                const shaking = n.shakeUntil > frameNow;
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => selectNumber(n.id)}
                    aria-pressed={isSel}
                    aria-label={`숫자 ${n.value}${isSel ? ", 선택됨" : ""}`}
                    className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
                    style={{
                      left: `${n.x}%`,
                      top: `${Math.max(0, Math.min(98, n.y))}%`,
                    }}
                  >
                    <span
                      className={[
                        "flex min-h-14 min-w-14 items-center justify-center rounded-2xl px-3 py-2",
                        "font-display text-2xl font-black tabular-nums shadow-md",
                        "sm:min-h-16 sm:min-w-16 sm:text-3xl",
                        isSel
                          ? "scale-110 bg-wood text-cream ring-4 ring-gold"
                          : "bg-white/92 text-wood",
                        popping ? "factor-rain-pop" : "",
                        shaking ? "factor-rain-shake text-[#a63a1a]" : "",
                      ].join(" ")}
                    >
                      {n.value.toLocaleString("ko-KR")}
                    </span>
                  </button>
                );
              })}

              {bursts.map((b) => (
                <span
                  key={b.id}
                  className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-full font-display text-xl font-black text-wood drop-shadow-sm animate-bounce"
                  style={{ left: `${b.x}%`, top: `${b.y}%` }}
                  aria-hidden
                >
                  {b.label}
                </span>
              ))}
            </div>

            <p
              className="min-h-[2.5rem] border-t border-wood/10 bg-cream/60 px-4 py-2 text-center text-sm font-semibold text-foreground/70"
              role="status"
              aria-live="polite"
            >
              {statusMsg}
            </p>
          </section>

          <section className="quest-card-static p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-bold text-wood">소수로 나누기</p>
              {selected ? (
                <p className="text-sm font-semibold text-foreground/65">
                  선택:{" "}
                  <span className="font-display text-lg text-wood">
                    {selected.value.toLocaleString("ko-KR")}
                  </span>
                  {selected.steps > 0 ? (
                    <span className="ml-2 text-xs text-foreground/45">
                      (원래 {selected.original.toLocaleString("ko-KR")})
                    </span>
                  ) : null}
                </p>
              ) : (
                <p className="text-xs font-semibold text-foreground/45">
                  숫자를 먼저 선택하세요
                </p>
              )}
            </div>
            <div className="grid grid-cols-4 gap-2 sm:gap-3">
              {FACTOR_PRIMES.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => tryPrime(p)}
                  aria-label={`${p}로 나누기`}
                  className={[
                    "flex min-h-[3.25rem] items-center justify-center rounded-2xl",
                    "font-display text-2xl font-black transition active:scale-[0.96] sm:min-h-[3.75rem] sm:text-3xl",
                    "bg-gradient-to-b from-cream to-sky/35 text-wood shadow-sm",
                    "hover:from-sky/40 hover:to-mint/40",
                    selected == null ? "opacity-55" : "",
                  ].join(" ")}
                >
                  {p}
                </button>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
