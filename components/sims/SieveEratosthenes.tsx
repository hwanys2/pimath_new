"use client";

import { useCallback, useMemo, useState, useTransition } from "react";

const MIN_N = 2;
const MAX_N = 1000;
const DEFAULT_N = 100;
const COLS = 10;

type CellState = "alive" | "removed" | "removing" | "prime";

function createInitialStates(n: number): CellState[] {
  const states: CellState[] = Array.from({ length: n + 1 }, () => "alive");
  states[0] = "removed";
  if (n >= 1) states[1] = "removed";
  return states;
}

/** Smallest unmarked candidate still on the board. */
function smallestAlive(states: CellState[], n: number): number | null {
  for (let i = 2; i <= n; i++) {
    if (states[i] === "alive") return i;
  }
  return null;
}

function countPrimes(states: CellState[], n: number): number {
  let c = 0;
  for (let i = 2; i <= n; i++) {
    if (states[i] === "prime") c++;
  }
  return c;
}

/** Classic sieve end: next unmarked p satisfies p*p > n, or no alive left. */
function shouldComplete(states: CellState[], n: number): boolean {
  const p = smallestAlive(states, n);
  if (p == null) return true;
  return p * p > n;
}

function markRemainingPrimes(states: CellState[], n: number): CellState[] {
  const next = [...states];
  for (let i = 2; i <= n; i++) {
    if (next[i] === "alive") next[i] = "prime";
  }
  return next;
}

export default function SieveEratosthenes() {
  const [limitInput, setLimitInput] = useState(String(DEFAULT_N));
  const [n, setN] = useState(DEFAULT_N);
  const [states, setStates] = useState<CellState[]>(() =>
    createInitialStates(DEFAULT_N),
  );
  const [activePrime, setActivePrime] = useState<number | null>(null);
  const [message, setMessage] = useState(
    "소수(또는 아직 지우지 않은 수)를 누르면 그 배수가 사라져 가요.",
  );
  const [isPending, startTransition] = useTransition();
  const [animating, setAnimating] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [strikeFlash, setStrikeFlash] = useState<number | null>(null);

  const primesLeft = useMemo(() => {
    const list: number[] = [];
    for (let i = 2; i <= n; i++) {
      if (states[i] === "alive" || states[i] === "prime") list.push(i);
    }
    return list;
  }, [states, n]);

  const foundPrimes = useMemo(() => {
    const list: number[] = [];
    for (let i = 2; i <= n; i++) {
      if (states[i] === "prime") list.push(i);
    }
    return list;
  }, [states, n]);

  const applyLimit = useCallback(() => {
    const parsed = Number.parseInt(limitInput, 10);
    if (!Number.isFinite(parsed) || parsed < MIN_N || parsed > MAX_N) {
      setMessage(`숫자는 ${MIN_N}~${MAX_N} 사이로 입력해 주세요.`);
      return;
    }
    startTransition(() => {
      setN(parsed);
      setStates(createInitialStates(parsed));
      setActivePrime(null);
      setAnimating(false);
      setCompleted(false);
      setStrikeFlash(null);
      setMessage(
        `1부터 ${parsed}까지 준비됐어요. 1은 이미 지워져 있어요. 2부터 눌러 보세요!`,
      );
    });
  }, [limitInput]);

  const reset = useCallback(() => {
    setStates(createInitialStates(n));
    setActivePrime(null);
    setAnimating(false);
    setCompleted(false);
    setStrikeFlash(null);
    setMessage(`다시 시작! 1은 이미 지워져 있어요.`);
  }, [n]);

  const strikeMultiples = useCallback(
    async (p: number) => {
      if (animating || completed) return;
      if (p < 2 || p > n) return;
      if (states[p] !== "alive") return;

      const multiples: number[] = [];
      for (let m = p * 2; m <= n; m += p) {
        if (states[m] === "alive") multiples.push(m);
      }

      setAnimating(true);
      setActivePrime(p);
      setStrikeFlash(p);
      window.setTimeout(() => setStrikeFlash(null), 450);

      let working = [...states];
      working[p] = "prime";
      setStates(working);

      if (multiples.length > 0) {
        setMessage(`${p}의 배수를 지우는 중…`);
        const step = Math.max(28, Math.min(70, 1100 / multiples.length));
        for (let i = 0; i < multiples.length; i++) {
          const m = multiples[i]!;
          working = [...working];
          if (working[m] === "alive") working[m] = "removing";
          setStates(working);
          await new Promise((r) => window.setTimeout(r, step));
          working = [...working];
          if (working[m] === "removing" || working[m] === "alive") {
            working[m] = "removed";
          }
          setStates(working);
        }
      }

      if (shouldComplete(working, n)) {
        working = markRemainingPrimes(working, n);
        setStates(working);
        setCompleted(true);
        setMessage(
          `모든 소수를 찾았어요! 1부터 ${n}까지 소수 ${countPrimes(working, n)}개예요.`,
        );
      } else if (multiples.length === 0) {
        setMessage(`${p}은(는) 소수예요! 지울 배수가 더 이상 없어요.`);
        setStates(working);
      } else {
        setMessage(
          `${p}의 배수 ${multiples.length}개를 지웠어요. 남은 수를 살펴보세요!`,
        );
        setStates(working);
      }
      setAnimating(false);
    },
    [animating, completed, n, states],
  );

  const cells = useMemo(() => {
    const list: { num: number; state: CellState }[] = [];
    for (let i = 1; i <= n; i++) {
      list.push({ num: i, state: states[i] ?? "removed" });
    }
    return list;
  }, [n, states]);

  return (
    <div className="flex flex-col gap-6">
      <section className="quest-card bg-gradient-to-br from-mint/35 to-sky/25 p-5 sm:p-7">
        <p className="text-sm font-bold text-wood">중1 · 1.1 소인수분해</p>
        <h1 className="font-display mt-1 text-3xl text-foreground sm:text-4xl">
          에라토스테네스의 체
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-foreground/75 sm:text-base">
          원하는 숫자까지 칸을 만들고, 소수를 눌러 배수를 지워 보세요. 마지막에
          남는 수들이 바로 소수예요. 점수는 없고, 개념을 눈으로 익히는
          시뮬레이션입니다. (최대 {MAX_N})
        </p>

        <div className="mt-5 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm font-semibold text-foreground/70">
            몇까지?
            <input
              type="number"
              min={MIN_N}
              max={MAX_N}
              value={limitInput}
              disabled={animating}
              onChange={(e) => setLimitInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applyLimit();
              }}
              className="w-28 rounded-xl border-2 border-wood/20 bg-white/80 px-3 py-2 text-base font-bold text-foreground outline-none focus:border-mint disabled:opacity-50"
            />
          </label>
          <button
            type="button"
            onClick={applyLimit}
            disabled={isPending || animating}
            className="rounded-xl bg-mint/70 px-4 py-2 text-sm font-bold text-wood disabled:opacity-50"
          >
            격자 만들기
          </button>
          <button
            type="button"
            onClick={reset}
            disabled={animating}
            className="rounded-xl bg-wood/10 px-4 py-2 text-sm font-bold text-wood disabled:opacity-50"
          >
            처음부터
          </button>
        </div>
      </section>

      {completed ? (
        <section
          className="quest-card border-mint/40 bg-gradient-to-br from-mint/50 via-sky/30 to-gold/30 p-5 text-center sm:p-7"
          role="status"
          aria-live="polite"
        >
          <p className="font-display text-2xl text-wood sm:text-3xl">
            모든 소수를 찾았어요!
          </p>
          <p className="mt-2 text-sm font-semibold text-foreground/75">
            1부터 {n}까지 소수 {foundPrimes.length}개 · 더 이상 지울 배수가
            없어요
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-4 rounded-xl bg-wood px-5 py-2 text-sm font-bold text-cream"
          >
            다시 해보기
          </button>
        </section>
      ) : null}

      <section className="quest-card p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-foreground/70">{message}</p>
          <p className="text-xs font-bold text-wood">
            {completed
              ? `소수 ${foundPrimes.length}개`
              : `남은 후보 ${primesLeft.length}개`}
            {activePrime != null && !completed ? ` · 방금 ${activePrime}` : ""}
          </p>
        </div>

        <div
          className="grid gap-1 sm:gap-1.5"
          style={{
            gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
          }}
          role="grid"
          aria-label={`1부터 ${n}까지 에라토스테네스의 체`}
        >
          {cells.map(({ num, state }) => {
            const removed = state === "removed" || state === "removing";
            const isPrime = state === "prime";
            const flash = strikeFlash === num;
            const clickable =
              !animating && !completed && state === "alive" && num >= 2;

            return (
              <button
                key={num}
                type="button"
                role="gridcell"
                disabled={!clickable}
                onClick={() => void strikeMultiples(num)}
                aria-label={
                  removed
                    ? `${num} 지워짐`
                    : isPrime
                      ? `${num} 소수`
                      : `${num}`
                }
                className={[
                  "sieve-cell aspect-square rounded-md text-[10px] font-bold sm:rounded-lg sm:text-xs md:text-sm",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-mint",
                  state === "removing" ? "sieve-cell-removing" : "",
                  state === "removed" ? "sieve-cell-removed" : "",
                  state === "alive" ? "sieve-cell-alive" : "",
                  state === "prime" ? "sieve-cell-prime" : "",
                  flash ? "sieve-cell-flash" : "",
                  clickable ? "cursor-pointer" : "cursor-default",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {num}
              </button>
            );
          })}
        </div>

        <div className="mt-6 rounded-2xl bg-mint/15 px-4 py-3">
          <p className="text-xs font-bold text-wood">
            {completed ? "찾은 소수 전부" : "지금까지 확인한 소수"}
          </p>
          <p className="mt-1 text-sm font-semibold break-words text-foreground/80">
            {foundPrimes.length > 0
              ? foundPrimes.join(", ")
              : "아직 없어요. 2를 눌러 보세요!"}
          </p>
        </div>
      </section>
    </div>
  );
}
