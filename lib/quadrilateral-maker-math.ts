/**
 * 사각형 만들기 — board rules, shape detection, AI, rating deltas.
 * Board: 11×11 lattice (x, y ∈ [0, 10]).
 */

export const BOARD_MIN = 0;
export const BOARD_MAX = 10;
export const BOARD_SIZE = 11;

export const SCORE_WIN = 300;
export const SCORE_LOSS = 100;
export const SCORE_DRAW = 150;

export type Stone = "black" | "white";
export type BoardMap = Map<string, Stone>;

export type Point = { x: number; y: number };

export type QuadShape =
  | "parallelogram"
  | "rectangle"
  | "rhombus"
  | "square";

export type RpsChoice = "rock" | "paper" | "scissors";

export type QuadOutcome = "win" | "loss" | "draw";

export const QUAD_SHAPES: QuadShape[] = [
  "parallelogram",
  "rectangle",
  "rhombus",
  "square",
];

export const SHAPE_LABELS: Record<QuadShape, string> = {
  parallelogram: "평행사변형",
  rectangle: "직사각형",
  rhombus: "마름모",
  square: "정사각형",
};

export const RPS_LABELS: Record<RpsChoice, string> = {
  rock: "바위",
  paper: "보",
  scissors: "가위",
};

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

export function getStone(board: BoardMap, x: number, y: number): Stone | null {
  return board.get(coordKey(x, y)) ?? null;
}

export function cloneBoard(board: BoardMap): BoardMap {
  return new Map(board);
}

export function opponent(s: Stone): Stone {
  return s === "black" ? "white" : "black";
}

export function stoneLabel(s: Stone): string {
  return s === "black" ? "흑" : "백";
}

export function boardFromObject(
  obj: Record<string, Stone> | null | undefined,
): BoardMap {
  const m = emptyBoard();
  if (!obj) return m;
  for (const [k, v] of Object.entries(obj)) {
    if (v === "black" || v === "white") m.set(k, v);
  }
  return m;
}

export function boardToObject(board: BoardMap): Record<string, Stone> {
  const o: Record<string, Stone> = {};
  for (const [k, v] of board) o[k] = v;
  return o;
}

export function boardIsFull(board: BoardMap): boolean {
  return board.size >= BOARD_SIZE * BOARD_SIZE;
}

export function stonesForPlayer(board: BoardMap, stone: Stone): Point[] {
  const pts: Point[] = [];
  for (const [k, v] of board) {
    if (v === stone) pts.push(parseKey(k));
  }
  return pts;
}

function cross(ax: number, ay: number, bx: number, by: number): number {
  return ax * by - ay * bx;
}

/** Monotone chain convex hull (counter-clockwise, no duplicate closing point). */
function convexHull(points: Point[]): Point[] {
  if (points.length <= 1) return [...points];
  const sorted = [...points].sort((a, b) =>
    a.x !== b.x ? a.x - b.x : a.y - b.y,
  );
  const lower: Point[] = [];
  for (const p of sorted) {
    while (
      lower.length >= 2 &&
      cross(
        p.x - lower[lower.length - 1].x,
        p.y - lower[lower.length - 1].y,
        lower[lower.length - 1].x - lower[lower.length - 2].x,
        lower[lower.length - 1].y - lower[lower.length - 2].y,
      ) <= 0
    ) {
      lower.pop();
    }
    lower.push(p);
  }
  const upper: Point[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i]!;
    while (
      upper.length >= 2 &&
      cross(
        p.x - upper[upper.length - 1].x,
        p.y - upper[upper.length - 1].y,
        upper[upper.length - 1].x - upper[upper.length - 2].x,
        upper[upper.length - 1].y - upper[upper.length - 2].y,
      ) <= 0
    ) {
      upper.pop();
    }
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

function vec(from: Point, to: Point): [number, number] {
  return [to.x - from.x, to.y - from.y];
}

function isParallelogramOrdered([a, b, c, d]: Point[]): boolean {
  const [abx, aby] = vec(a, b);
  const [dcx, dcy] = vec(d, c);
  const [adx, ady] = vec(a, d);
  const [bcx, bcy] = vec(b, c);
  return abx === dcx && aby === dcy && adx === bcx && ady === bcy;
}

function isRectangleOrdered(pts: Point[]): boolean {
  if (!isParallelogramOrdered(pts)) return false;
  const [a, b] = pts;
  const [abx, aby] = vec(a, b);
  const [adx, ady] = vec(a, pts[3]!);
  return abx * adx + aby * ady === 0;
}

function sideLen2(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function isRhombusOrdered(pts: Point[]): boolean {
  const [a, b, c, d] = pts;
  const l = sideLen2(a, b);
  return (
    l > 0 &&
    l === sideLen2(b, c) &&
    l === sideLen2(c, d) &&
    l === sideLen2(d, a)
  );
}

function isSquareOrdered(pts: Point[]): boolean {
  return isRectangleOrdered(pts) && isRhombusOrdered(pts);
}

function matchesShape(ordered: Point[], shape: QuadShape): boolean {
  switch (shape) {
    case "parallelogram":
      return isParallelogramOrdered(ordered);
    case "rectangle":
      return isRectangleOrdered(ordered);
    case "rhombus":
      return isRhombusOrdered(ordered);
    case "square":
      return isSquareOrdered(ordered);
    default:
      return false;
  }
}

/** True if four lattice points form the target shape (as vertices of a convex quad). */
export function fourPointsFormShape(
  points: Point[],
  shape: QuadShape,
): boolean {
  if (points.length !== 4) return false;
  const hull = convexHull(points);
  if (hull.length !== 4) return false;
  return matchesShape(hull, shape);
}

function* combinations4<T>(arr: T[]): Generator<T[]> {
  const n = arr.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      for (let k = j + 1; k < n; k++) {
        for (let l = k + 1; l < n; l++) {
          yield [arr[i]!, arr[j]!, arr[k]!, arr[l]!];
        }
      }
    }
  }
}

export function hasShapeWin(
  board: BoardMap,
  stone: Stone,
  shape: QuadShape,
): boolean {
  const pts = stonesForPlayer(board, stone);
  if (pts.length < 4) return false;
  for (const combo of combinations4(pts)) {
    if (fourPointsFormShape(combo, shape)) return true;
  }
  return false;
}

export type PlaceResult =
  | { ok: true; board: BoardMap; won: boolean }
  | { ok: false; error: string; message: string };

export function tryPlace(
  board: BoardMap,
  x: number,
  y: number,
  stone: Stone,
  targetShape: QuadShape,
): PlaceResult {
  if (!inBounds(x, y)) {
    return { ok: false, error: "bounds", message: "격자 범위를 벗어났어요." };
  }
  if (getStone(board, x, y)) {
    return { ok: false, error: "occupied", message: "이미 돌이 있어요." };
  }
  const next = cloneBoard(board);
  next.set(coordKey(x, y), stone);
  const won = hasShapeWin(next, stone, targetShape);
  return { ok: true, board: next, won };
}

export function rpsWinner(
  a: RpsChoice,
  b: RpsChoice,
): "a" | "b" | "draw" {
  if (a === b) return "draw";
  if (
    (a === "rock" && b === "scissors") ||
    (a === "paper" && b === "rock") ||
    (a === "scissors" && b === "paper")
  ) {
    return "a";
  }
  return "b";
}

export function pickRandomLegalMove(
  board: BoardMap,
  stone: Stone,
  targetShape: QuadShape,
): Point | null {
  const empty: Point[] = [];
  for (let x = BOARD_MIN; x <= BOARD_MAX; x++) {
    for (let y = BOARD_MIN; y <= BOARD_MAX; y++) {
      if (!getStone(board, x, y)) empty.push({ x, y });
    }
  }
  if (empty.length === 0) return null;
  const shuffled = [...empty].sort(() => Math.random() - 0.5);
  for (const p of shuffled) {
    const r = tryPlace(board, p.x, p.y, stone, targetShape);
    if (r.ok) return p;
  }
  return shuffled[0] ?? null;
}

function parallelogramCompletions(a: Point, b: Point, c: Point): Point[] {
  return [
    { x: a.x + b.x - c.x, y: a.y + b.y - c.y },
    { x: a.x + c.x - b.x, y: a.y + c.y - b.y },
    { x: b.x + c.x - a.x, y: b.y + c.y - a.y },
  ];
}

/**
 * Empty, in-bounds cells that immediately complete `shape` for `stone`.
 * Every target shape is a parallelogram, so given 3 stones the 4th vertex is
 * one of only three candidates — no need to brute-force every empty cell.
 */
export function winningCells(
  board: BoardMap,
  stone: Stone,
  shape: QuadShape,
): Point[] {
  const mine = stonesForPlayer(board, stone);
  if (mine.length < 3) return [];
  const seen = new Set<string>();
  const out: Point[] = [];
  for (let i = 0; i < mine.length; i++) {
    for (let j = i + 1; j < mine.length; j++) {
      for (let k = j + 1; k < mine.length; k++) {
        for (const p of parallelogramCompletions(
          mine[i]!,
          mine[j]!,
          mine[k]!,
        )) {
          if (!inBounds(p.x, p.y) || getStone(board, p.x, p.y)) continue;
          const key = coordKey(p.x, p.y);
          if (seen.has(key)) continue;
          if (fourPointsFormShape([mine[i]!, mine[j]!, mine[k]!, p], shape)) {
            seen.add(key);
            out.push(p);
          }
        }
      }
    }
  }
  return out;
}

function emptyCells(board: BoardMap): Point[] {
  const empty: Point[] = [];
  for (let x = BOARD_MIN; x <= BOARD_MAX; x++) {
    for (let y = BOARD_MIN; y <= BOARD_MAX; y++) {
      if (!getStone(board, x, y)) empty.push({ x, y });
    }
  }
  return empty;
}

/** Empty cells within Chebyshev distance `radius` of any placed stone. */
function candidateCells(board: BoardMap, radius = 2): Point[] {
  if (board.size === 0) {
    const mid = Math.floor(BOARD_SIZE / 2);
    return [{ x: mid, y: mid }];
  }
  const stones: Point[] = [];
  for (const [k] of board) stones.push(parseKey(k));
  const out: Point[] = [];
  for (let x = BOARD_MIN; x <= BOARD_MAX; x++) {
    for (let y = BOARD_MIN; y <= BOARD_MAX; y++) {
      if (getStone(board, x, y)) continue;
      let near = false;
      for (const s of stones) {
        if (Math.abs(s.x - x) <= radius && Math.abs(s.y - y) <= radius) {
          near = true;
          break;
        }
      }
      if (near) out.push({ x, y });
    }
  }
  return out;
}

function placedBoard(board: BoardMap, p: Point, stone: Stone): BoardMap {
  const next = cloneBoard(board);
  next.set(coordKey(p.x, p.y), stone);
  return next;
}

/**
 * Count triples of `stone`'s stones whose parallelogram completion is an
 * in-bounds empty cell and forms `shape` — i.e. developing (near-complete)
 * configurations that could become threats.
 */
function developmentScore(
  board: BoardMap,
  stone: Stone,
  shape: QuadShape,
): number {
  const mine = stonesForPlayer(board, stone);
  if (mine.length < 3) {
    // With <3 stones, reward tight, aligned clusters that can still form shapes.
    let s = 0;
    for (let i = 0; i < mine.length; i++) {
      for (let j = i + 1; j < mine.length; j++) {
        const d = Math.abs(mine[i]!.x - mine[j]!.x) +
          Math.abs(mine[i]!.y - mine[j]!.y);
        if (d > 0 && d <= 8) s += (8 - d) * 0.1;
      }
    }
    return s;
  }
  let score = 0;
  const seen = new Set<string>();
  for (let i = 0; i < mine.length; i++) {
    for (let j = i + 1; j < mine.length; j++) {
      for (let k = j + 1; k < mine.length; k++) {
        for (const p of parallelogramCompletions(
          mine[i]!,
          mine[j]!,
          mine[k]!,
        )) {
          if (!inBounds(p.x, p.y) || getStone(board, p.x, p.y)) continue;
          const key = `${i}-${coordKey(p.x, p.y)}`;
          if (seen.has(key)) continue;
          if (fourPointsFormShape([mine[i]!, mine[j]!, mine[k]!, p], shape)) {
            seen.add(key);
            score += 1;
          }
        }
      }
    }
  }
  return score;
}

/**
 * Threat-aware AI: win → block win → make a double threat → block the
 * opponent's double threat → positional build toward the target shape.
 */
export function chooseAiMove(
  board: BoardMap,
  stone: Stone,
  myShape: QuadShape,
  oppShape: QuadShape,
): Point | null {
  const empty = emptyCells(board);
  if (empty.length === 0) return null;

  const opp = opponent(stone);

  // 1. Immediate win.
  const myWins = winningCells(board, stone, myShape);
  if (myWins.length > 0) {
    return myWins[Math.floor(Math.random() * myWins.length)]!;
  }

  // 2. Block the opponent's immediate win.
  const oppWins = winningCells(board, opp, oppShape);
  if (oppWins.length > 0) {
    return oppWins[Math.floor(Math.random() * oppWins.length)]!;
  }

  const cands = candidateCells(board);
  const pool = cands.length > 0 ? cands : empty;

  // 3. Create a double threat (forced win next turn), if it doesn't hand the
  //    opponent an immediate win in return.
  const doubleThreats: Point[] = [];
  for (const q of pool) {
    const nb = placedBoard(board, q, stone);
    if (winningCells(nb, stone, myShape).length >= 2) {
      if (winningCells(nb, opp, oppShape).length === 0) doubleThreats.push(q);
    }
  }
  if (doubleThreats.length > 0) {
    return doubleThreats[Math.floor(Math.random() * doubleThreats.length)]!;
  }

  // 4. Block a cell where the opponent could build a double threat.
  const oppDoubleThreats: Point[] = [];
  for (const q of pool) {
    const nb = placedBoard(board, q, opp);
    if (winningCells(nb, opp, oppShape).length >= 2) oppDoubleThreats.push(q);
  }

  // 5. Positional scoring fallback (also used to pick the best block above).
  const scoreMove = (q: Point): number => {
    const afterMine = placedBoard(board, q, stone);
    const myThreats = winningCells(afterMine, stone, myShape).length;
    const myDev = developmentScore(afterMine, stone, myShape);

    // How much the opponent could gain by taking this same cell.
    const afterOpp = placedBoard(board, q, opp);
    const oppThreats = winningCells(afterOpp, opp, oppShape).length;
    const oppDev = developmentScore(afterOpp, opp, oppShape);

    const mid = (BOARD_MAX + BOARD_MIN) / 2;
    const centrality = -(Math.abs(q.x - mid) + Math.abs(q.y - mid)) * 0.05;

    return (
      myThreats * 100 +
      myDev * 4 +
      oppThreats * 60 +
      oppDev * 2 +
      centrality +
      Math.random() * 0.5
    );
  };

  const blockPool = oppDoubleThreats.length > 0 ? oppDoubleThreats : pool;
  let best: Point | null = null;
  let bestScore = -Infinity;
  for (const q of blockPool) {
    const s = scoreMove(q);
    if (s > bestScore) {
      bestScore = s;
      best = q;
    }
  }
  return best ?? pool[0] ?? empty[0]!;
}

export function deltaForQuadOutcome(
  totalBefore: number,
  outcome: QuadOutcome,
): number {
  const t = Math.max(0, totalBefore);
  if (t >= 3000) {
    if (outcome === "win") return 100;
    if (outcome === "loss") return -100;
    return 50;
  }
  if (t >= 2000) {
    if (outcome === "win") return 150;
    if (outcome === "loss") return -100;
    return 50;
  }
  if (t >= 1000) {
    if (outcome === "win") return 200;
    if (outcome === "loss") return -100;
    return 75;
  }
  if (outcome === "win") return 300;
  if (outcome === "loss") return 100;
  return 150;
}
