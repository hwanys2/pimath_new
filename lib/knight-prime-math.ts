/**
 * Pure logic for 「나이트 프라임」 — knight hops on primes/composites.
 * Score soft-cap: docs/progression-system.md
 */

import { isPrime, primesUpTo } from "@/lib/prime-math";

export { isPrime };
export { applyScoreGain, SCORE_SOFT_CAP, SCORE_HARD_MAX } from "@/lib/xp";

export const GRID = 10;
export const CELL_COUNT = GRID * GRID;
/** Board numbers prefer this range so a strong run lands near ~1000. */
export const MAX_VALUE = 100;

export const KNIGHT_DELTAS: readonly [number, number][] = [
  [-2, -1],
  [-2, 1],
  [-1, -2],
  [-1, 2],
  [1, -2],
  [1, 2],
  [2, -1],
  [2, 1],
];

export const FRIENDLY_PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31] as const;
export const FIRST_MOVE_PRIMES = [2, 3, 5, 7] as const;

export type Cell = {
  val: number;
  visited: boolean;
};

export type EndReason = "negative" | "all_primes" | "nomoves";

export type MoveKind = "prime" | "one" | "composite" | "start";

export function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.round(score));
}

export function idx(row: number, col: number): number {
  return row * GRID + col;
}

export function startIndex(): number {
  return idx(GRID - 1, 0);
}

export function inBounds(row: number, col: number): boolean {
  return row >= 0 && row < GRID && col >= 0 && col < GRID;
}

export function isKnightMove(
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number,
): boolean {
  const dr = Math.abs(toRow - fromRow);
  const dc = Math.abs(toCol - fromCol);
  return (dr === 2 && dc === 1) || (dr === 1 && dc === 2);
}

export function cellKind(val: number): MoveKind {
  if (val === 0) return "start";
  if (val === 1) return "one";
  if (isPrime(val)) return "prime";
  return "composite";
}

/** Penalty magnitude for a non-prime cell (1 → 1, composite → n). */
export function penaltyFor(val: number): number {
  if (val === 1) return 1;
  if (val > 1 && !isPrime(val)) return val;
  return 0;
}

export function primeFactors(n: number): number[] {
  if (!Number.isInteger(n) || n < 2) return [];
  const factors: number[] = [];
  let x = n;
  for (let p = 2; p * p <= x; p++) {
    while (x % p === 0) {
      factors.push(p);
      x = Math.floor(x / p);
    }
  }
  if (x > 1) factors.push(x);
  return factors;
}

/** Plain-text factorization, e.g. `12 = 2×2×3`. */
export function formatFactorization(n: number): string {
  const factors = primeFactors(n);
  if (factors.length === 0) return String(n);
  return `${n} = ${factors.join("×")}`;
}

export function countUnvisitedPrimes(board: Cell[]): number {
  let count = 0;
  for (const cell of board) {
    if (!cell.visited && isPrime(cell.val)) count += 1;
  }
  return count;
}

export function legalMoves(
  board: Cell[],
  row: number,
  col: number,
): { row: number; col: number }[] {
  const out: { row: number; col: number }[] = [];
  for (const [dr, dc] of KNIGHT_DELTAS) {
    const r = row + dr;
    const c = col + dc;
    if (!inBounds(r, c)) continue;
    if (board[idx(r, c)]!.visited) continue;
    out.push({ row: r, col: c });
  }
  return out;
}

export function evaluateEnd(
  board: Cell[],
  score: number,
  row: number,
  col: number,
): EndReason | null {
  if (score < 0) return "negative";
  if (countUnvisitedPrimes(board) === 0) return "all_primes";
  if (legalMoves(board, row, col).length === 0) return "nomoves";
  return null;
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
}

function buildPools(maxValue: number) {
  const primes = primesUpTo(maxValue);
  const nonPrimes: number[] = [];
  for (let n = 4; n <= maxValue; n++) {
    if (!isPrime(n)) nonPrimes.push(n);
  }
  const smallCap = Math.min(50, maxValue);
  const smallPrimes = primes.filter((p) => p <= smallCap);
  const smallNonPrimes = nonPrimes.filter((n) => n <= smallCap);
  return { primes, nonPrimes, smallPrimes, smallNonPrimes };
}

function randomCellValue(
  pools: ReturnType<typeof buildPools>,
): number {
  // ~42% prime — tuned with MAX_VALUE=100 so strong paths ≈ 900–1100 before soft cap.
  if (Math.random() < 0.42) {
    if (Math.random() < 0.65 && pools.smallPrimes.length > 0) {
      return pick(pools.smallPrimes);
    }
    return pick(pools.primes);
  }
  // ~10% trap 1
  if (Math.random() < 0.1) return 1;
  if (Math.random() < 0.82 && pools.smallNonPrimes.length > 0) {
    return pick(pools.smallNonPrimes);
  }
  return pick(pools.nonPrimes);
}

/**
 * Build a fresh 10×10 board. Start cell is 0 (bottom-left).
 * Guarantees friendly primes exist and at least one first-move prime.
 */
export function createBoard(maxValue: number = MAX_VALUE): Cell[] {
  const pools = buildPools(maxValue);
  const board: Cell[] = Array.from({ length: CELL_COUNT }, () => ({
    val: randomCellValue(pools),
    visited: false,
  }));

  const start = startIndex();
  const otherIndices = Array.from({ length: CELL_COUNT }, (_, i) => i).filter(
    (i) => i !== start,
  );
  shuffleInPlace(otherIndices);

  const friendly = FRIENDLY_PRIMES.filter((p) => p <= maxValue);
  for (let i = 0; i < friendly.length && i < otherIndices.length; i++) {
    board[otherIndices[i]!]!.val = friendly[i]!;
  }

  board[start]!.val = 0;

  // First knight squares from start (9,0): (7,1) and (8,2)
  const firstMoves = [
    idx(GRID - 3, 1),
    idx(GRID - 2, 2),
  ];
  const hasFirstPrime = firstMoves.some((i) => isPrime(board[i]!.val));
  if (!hasFirstPrime) {
    const target = pick(firstMoves);
    const seed = FIRST_MOVE_PRIMES.filter((p) => p <= maxValue);
    board[target]!.val = pick(seed.length > 0 ? seed : ([2] as const));
  }

  return board;
}

/** Mark start visited (no score change). Returns position. */
export function visitStart(board: Cell[]): { row: number; col: number } {
  const s = startIndex();
  board[s]!.visited = true;
  return { row: GRID - 1, col: 0 };
}

export function endReasonLabel(reason: EndReason): string {
  switch (reason) {
    case "negative":
      return "점수가 0 미만이 되어 게임이 끝났어요";
    case "all_primes":
      return "보드의 모든 소수를 획득했어요. 클리어!";
    case "nomoves":
      return "더 이상 이동할 수 있는 칸이 없어요";
  }
}
