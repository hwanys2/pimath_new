/**
 * Ordered-pair Omok (좌표 순서쌍 오목) — board rules, renju 3×3, mid-school AI.
 * Board: integer lattice x,y ∈ [-10, 10]. Place only via ordered pairs.
 */

import { applyScoreGain } from "@/lib/xp";

export const BOARD_MIN = -10;
export const BOARD_MAX = 10;
export const WIN_LEN = 5;

export const SCORE_WIN = 300;
export const SCORE_LOSS = 100;
export const SCORE_DRAW = 150;

export type Stone = "black" | "white";
export type Cell = Stone | null;

/** Key `"x,y"` → stone */
export type BoardMap = Map<string, Stone>;

export type Point = { x: number; y: number };

export const DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
] as const;

export function coordKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function parseKey(key: string): Point {
  const [xs, ys] = key.split(",");
  return { x: Number(xs), y: Number(ys) };
}

export function inBounds(x: number, y: number): boolean {
  return (
    Number.isInteger(x) &&
    Number.isInteger(y) &&
    x >= BOARD_MIN &&
    x <= BOARD_MAX &&
    y >= BOARD_MIN &&
    y <= BOARD_MAX
  );
}

export function emptyBoard(): BoardMap {
  return new Map();
}

export function getStone(board: BoardMap, x: number, y: number): Cell {
  return board.get(coordKey(x, y)) ?? null;
}

export function cloneBoard(board: BoardMap): BoardMap {
  return new Map(board);
}

export function opponent(s: Stone): Stone {
  return s === "black" ? "white" : "black";
}

export function formatPair(x: number, y: number): string {
  return `(${x}, ${y})`;
}

/** Count consecutive stones of `stone` from (x,y) along (dx,dy), excluding start. */
function countRay(
  board: BoardMap,
  x: number,
  y: number,
  dx: number,
  dy: number,
  stone: Stone,
): number {
  let n = 0;
  let cx = x + dx;
  let cy = y + dy;
  while (inBounds(cx, cy) && getStone(board, cx, cy) === stone) {
    n++;
    cx += dx;
    cy += dy;
  }
  return n;
}

/**
 * Line length through (x,y) for stone after placing there (must already be on board).
 */
export function lineLengthThrough(
  board: BoardMap,
  x: number,
  y: number,
  dx: number,
  dy: number,
  stone: Stone,
): number {
  return (
    1 +
    countRay(board, x, y, dx, dy, stone) +
    countRay(board, x, y, -dx, -dy, stone)
  );
}

export function hasFive(
  board: BoardMap,
  x: number,
  y: number,
  stone: Stone,
): boolean {
  for (const [dx, dy] of DIRS) {
    if (lineLengthThrough(board, x, y, dx, dy, stone) >= WIN_LEN) return true;
  }
  return false;
}

/**
 * Detect an open three (활삼) created by placing `stone` at (x,y).
 * Simplified renju-style: exactly 3 in a row with both ends open,
 * or patterns that form two threats of three.
 *
 * Returns number of distinct open-three directions created by this move.
 */
export function countOpenThrees(
  board: BoardMap,
  x: number,
  y: number,
  stone: Stone,
): number {
  let count = 0;
  for (const [dx, dy] of DIRS) {
    if (isOpenThreeInDir(board, x, y, dx, dy, stone)) count++;
  }
  return count;
}

/**
 * Open three in one axis: after placing at (x,y), there is a contiguous
 * run of exactly 3 of `stone` that includes (x,y), both ends empty,
 * and not already part of a 4+ (those are fours, not threes).
 */
function isOpenThreeInDir(
  board: BoardMap,
  x: number,
  y: number,
  dx: number,
  dy: number,
  stone: Stone,
): boolean {
  const len = lineLengthThrough(board, x, y, dx, dy, stone);
  if (len !== 3) {
    // Also detect broken/jump threes: ·●●·●· or ·●·●●· with both outer ends open
    return isBrokenOpenThree(board, x, y, dx, dy, stone);
  }

  const forward = countRay(board, x, y, dx, dy, stone);
  const back = countRay(board, x, y, -dx, -dy, stone);
  const x1 = x - dx * back;
  const y1 = y - dy * back;
  const x2 = x + dx * forward;
  const y2 = y + dy * forward;

  const beforeOpen =
    inBounds(x1 - dx, y1 - dy) && getStone(board, x1 - dx, y1 - dy) === null;
  const afterOpen =
    inBounds(x2 + dx, y2 + dy) && getStone(board, x2 + dx, y2 + dy) === null;

  return beforeOpen && afterOpen;
}

/** Patterns like ●·●● or ●●·● forming an open three threat. */
function isBrokenOpenThree(
  board: BoardMap,
  x: number,
  y: number,
  dx: number,
  dy: number,
  stone: Stone,
): boolean {
  // Scan a window of 5 cells centered-ish around the move along the axis
  for (let start = -4; start <= 0; start++) {
    const cells: (Cell | "out")[] = [];
    for (let i = 0; i < 5; i++) {
      const cx = x + dx * (start + i);
      const cy = y + dy * (start + i);
      if (!inBounds(cx, cy)) cells.push("out");
      else cells.push(getStone(board, cx, cy));
    }
    // Must include the placed stone at relative 0
    const rel = -start;
    if (rel < 0 || rel > 4) continue;
    if (cells[rel] !== stone) continue;

    const stones = cells.filter((c) => c === stone).length;
    const empties = cells.filter((c) => c === null).length;
    const enemy = cells.some((c) => c === opponent(stone) || c === "out");
    if (enemy || stones !== 3 || empties !== 2) continue;

    // Ends of the 5-window should allow growth: outer neighbors open or the
    // pattern itself has empties at ends of the three-threat.
    // Require both "gap" empties and that the line is not a closed four.
    const left = start - 1;
    const right = start + 5;
    const lx = x + dx * left;
    const ly = y + dy * left;
    const rx = x + dx * right;
    const ry = y + dy * right;
    const leftOk =
      !inBounds(lx, ly) || getStone(board, lx, ly) !== opponent(stone);
    const rightOk =
      !inBounds(rx, ry) || getStone(board, rx, ry) !== opponent(stone);
    // At least one side truly empty for "open"
    const leftEmpty = inBounds(lx, ly) && getStone(board, lx, ly) === null;
    const rightEmpty = inBounds(rx, ry) && getStone(board, rx, ry) === null;
    if (leftOk && rightOk && (leftEmpty || rightEmpty)) {
      // Avoid counting solid open-3 twice (already handled)
      if (lineLengthThrough(board, x, y, dx, dy, stone) === 3) continue;
      return true;
    }
  }
  return false;
}

/** Black double-three (쌍삼) forbidden. White unrestricted. */
export function isDoubleThreeForbidden(
  board: BoardMap,
  x: number,
  y: number,
  stone: Stone,
): boolean {
  if (stone !== "black") return false;
  if (getStone(board, x, y) !== null) return false;
  const next = cloneBoard(board);
  next.set(coordKey(x, y), stone);
  // Winning five overrides 금수
  if (hasFive(next, x, y, stone)) return false;
  return countOpenThrees(next, x, y, stone) >= 2;
}

export type PlaceError =
  | "out_of_bounds"
  | "occupied"
  | "double_three"
  | "not_your_turn"
  | "game_over";

export type PlaceResult =
  | { ok: true; board: BoardMap; won: boolean; forbidden: false }
  | { ok: false; error: PlaceError; message: string };

export function tryPlace(
  board: BoardMap,
  x: number,
  y: number,
  stone: Stone,
): PlaceResult {
  if (!inBounds(x, y)) {
    return {
      ok: false,
      error: "out_of_bounds",
      message: `순서쌍 ${formatPair(x, y)}는 판 밖이에요. x, y는 ${BOARD_MIN}부터 ${BOARD_MAX}까지예요.`,
    };
  }
  if (getStone(board, x, y) !== null) {
    return {
      ok: false,
      error: "occupied",
      message: `${formatPair(x, y)}에는 이미 돌이 있어요. 다른 순서쌍을 골라 보세요.`,
    };
  }
  if (isDoubleThreeForbidden(board, x, y, stone)) {
    return {
      ok: false,
      error: "double_three",
      message: `흑돌은 한 수로 열린 삼이 두 개가 되는 쌍삼(3×3)을 둘 수 없어요. ${formatPair(x, y)}는 금수예요.`,
    };
  }
  const next = cloneBoard(board);
  next.set(coordKey(x, y), stone);
  const won = hasFive(next, x, y, stone);
  return { ok: true, board: next, won, forbidden: false };
}

export function boardIsFull(board: BoardMap): boolean {
  const size = BOARD_MAX - BOARD_MIN + 1;
  return board.size >= size * size;
}

export function scoreForOutcome(
  outcome: "win" | "loss" | "draw",
): number {
  if (outcome === "win") return SCORE_WIN;
  if (outcome === "loss") return SCORE_LOSS;
  return SCORE_DRAW;
}

export function finalizeRunScore(outcome: "win" | "loss" | "draw"): number {
  return applyScoreGain(0, scoreForOutcome(outcome));
}

/** Serialize board for JSON / DB */
export function boardToObject(board: BoardMap): Record<string, Stone> {
  const o: Record<string, Stone> = {};
  for (const [k, v] of board) o[k] = v;
  return o;
}

export function boardFromObject(o: Record<string, Stone> | null | undefined): BoardMap {
  const m = emptyBoard();
  if (!o) return m;
  for (const [k, v] of Object.entries(o)) {
    if (v === "black" || v === "white") m.set(k, v);
  }
  return m;
}

// ─── Mid-school AI ───────────────────────────────────────────────

function allEmptyCells(board: BoardMap): Point[] {
  const pts: Point[] = [];
  for (let x = BOARD_MIN; x <= BOARD_MAX; x++) {
    for (let y = BOARD_MIN; y <= BOARD_MAX; y++) {
      if (getStone(board, x, y) === null) pts.push({ x, y });
    }
  }
  return pts;
}

/** Candidates near existing stones (speed + stronger play). */
function candidateMoves(board: BoardMap): Point[] {
  if (board.size === 0) return [{ x: 0, y: 0 }];
  const set = new Set<string>();
  for (const key of board.keys()) {
    const { x, y } = parseKey(key);
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        const nx = x + dx;
        const ny = y + dy;
        if (!inBounds(nx, ny)) continue;
        if (getStone(board, nx, ny) !== null) continue;
        set.add(coordKey(nx, ny));
      }
    }
  }
  return [...set].map(parseKey);
}

function evaluateMove(board: BoardMap, x: number, y: number, stone: Stone): number {
  const trial = tryPlace(board, x, y, stone);
  if (!trial.ok) return -Infinity;
  if (trial.won) return 1_000_000;

  let score = 0;
  // Center bias
  score += 12 - (Math.abs(x) + Math.abs(y));

  for (const [dx, dy] of DIRS) {
    const len = lineLengthThrough(trial.board, x, y, dx, dy, stone);
    if (len >= 4) score += 8000;
    else if (len === 3) score += 400;
    else if (len === 2) score += 40;
  }

  // Threat: open threes
  score += countOpenThrees(trial.board, x, y, stone) * 350;

  return score;
}

/**
 * Medium AI: win now → block opponent win → build threats.
 * ~15% chance to pick a slightly weaker move so middle-schoolers can win.
 */
export function chooseAiMove(
  board: BoardMap,
  aiStone: Stone,
  rng: () => number = Math.random,
): Point | null {
  const candidates = candidateMoves(board);
  if (candidates.length === 0) {
    const all = allEmptyCells(board);
    return all[0] ?? null;
  }

  const human = opponent(aiStone);

  // 1. Immediate win
  for (const p of candidates) {
    const r = tryPlace(board, p.x, p.y, aiStone);
    if (r.ok && r.won) return p;
  }

  // 2. Block opponent win
  for (const p of candidates) {
    const r = tryPlace(board, p.x, p.y, human);
    if (r.ok && r.won) {
      const block = tryPlace(board, p.x, p.y, aiStone);
      if (block.ok) return p;
    }
  }

  // 3. Score candidates
  const scored = candidates
    .map((p) => ({ p, s: evaluateMove(board, p.x, p.y, aiStone) }))
    .filter((c) => c.s > -Infinity)
    .sort((a, b) => b.s - a.s);

  if (scored.length === 0) return null;

  // Soften: sometimes take 2nd–4th best
  if (scored.length > 1 && rng() < 0.18) {
    const idx = 1 + Math.floor(rng() * Math.min(3, scored.length - 1));
    return scored[idx]!.p;
  }
  return scored[0]!.p;
}

export function stoneLabel(s: Stone): string {
  return s === "black" ? "흑(선공)" : "백(후공)";
}
