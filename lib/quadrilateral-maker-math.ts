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

/** Simple AI: win → block opponent win → extend toward shape → random. */
export function chooseAiMove(
  board: BoardMap,
  stone: Stone,
  myShape: QuadShape,
  oppShape: QuadShape,
): Point | null {
  const empty: Point[] = [];
  for (let x = BOARD_MIN; x <= BOARD_MAX; x++) {
    for (let y = BOARD_MIN; y <= BOARD_MAX; y++) {
      if (!getStone(board, x, y)) empty.push({ x, y });
    }
  }
  if (empty.length === 0) return null;

  const winMoves: Point[] = [];
  const blockMoves: Point[] = [];
  for (const p of empty) {
    const mine = tryPlace(board, p.x, p.y, stone, myShape);
    if (mine.ok && mine.won) winMoves.push(p);
    const block = tryPlace(board, p.x, p.y, opponent(stone), oppShape);
    if (block.ok && block.won) blockMoves.push(p);
  }
  if (winMoves.length > 0) {
    return winMoves[Math.floor(Math.random() * winMoves.length)]!;
  }
  if (blockMoves.length > 0) {
    return blockMoves[Math.floor(Math.random() * blockMoves.length)]!;
  }

  const myStones = stonesForPlayer(board, stone);
  if (myStones.length > 0 && myStones.length < 4) {
    const scored = empty.map((p) => {
      let score = Math.random() * 2;
      for (const s of myStones) {
        score -= Math.abs(p.x - s.x) + Math.abs(p.y - s.y);
      }
      return { p, score };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.p ?? empty[0]!;
  }

  return empty[Math.floor(Math.random() * empty.length)]!;
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
