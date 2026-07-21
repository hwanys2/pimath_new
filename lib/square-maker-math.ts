/**
 * 정사각형 만들기 — 넓이·축 평행 판정·방향별 점수.
 */

import {
  cloneBoard,
  coordKey,
  fourPointsFormShape,
  getStone,
  inBounds,
  stonesForPlayer,
  type BoardMap,
  type PlaceResult,
  type Point,
  type QuadOutcome,
  type Stone,
} from "@/lib/quadrilateral-maker-math";

export const SQ_SCORE_AXIS_ALIGNED = 200;
export const SQ_SCORE_TILTED = 300;
export const SQ_SCORE_LOSS = 100;
export const SQ_SCORE_DRAW = 150;

export type SquareWinInfo = {
  vertices: Point[];
  area: number;
  axisAligned: boolean;
};

export type SquarePlaceResult =
  | { ok: true; board: BoardMap; won: boolean; winInfo?: SquareWinInfo }
  | { ok: false; error: string; message: string };

function cross(ax: number, ay: number, bx: number, by: number): number {
  return ax * by - ay * bx;
}

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
        p.x - lower[lower.length - 1]!.x,
        p.y - lower[lower.length - 1]!.y,
        lower[lower.length - 1]!.x - lower[lower.length - 2]!.x,
        lower[lower.length - 1]!.y - lower[lower.length - 2]!.y,
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
        p.x - upper[upper.length - 1]!.x,
        p.y - upper[upper.length - 1]!.y,
        upper[upper.length - 1]!.x - upper[upper.length - 2]!.x,
        upper[upper.length - 1]!.y - upper[upper.length - 2]!.y,
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

/** Shoelace formula — integer area for lattice polygons. */
export function polygonArea(pts: Point[]): number {
  const hull = convexHull(pts);
  if (hull.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i]!;
    const b = hull[(i + 1) % hull.length]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

/** True when edges are parallel to the grid axes. */
export function isAxisAlignedSquare(pts: Point[]): boolean {
  if (pts.length !== 4) return false;
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const side = maxX - minX;
  if (side !== maxY - minY || side <= 0) return false;
  const corners = new Set(pts.map((p) => coordKey(p.x, p.y)));
  const expected = [
    coordKey(minX, minY),
    coordKey(maxX, minY),
    coordKey(maxX, maxY),
    coordKey(minX, maxY),
  ];
  return expected.every((k) => corners.has(k)) && corners.size === 4;
}

export function squareWinInfoFromVertices(vertices: Point[]): SquareWinInfo {
  const hull = convexHull(vertices);
  const verts = hull.length === 4 ? hull : vertices;
  const axisAligned = isAxisAlignedSquare(verts);
  return {
    vertices: verts,
    area: polygonArea(verts),
    axisAligned,
  };
}

export function findWinningSquare(
  board: BoardMap,
  stone: Stone,
): SquareWinInfo | null {
  const pts = stonesForPlayer(board, stone);
  if (pts.length < 4) return null;
  for (const combo of combinations4(pts)) {
    if (fourPointsFormShape(combo, "square")) {
      const hull = convexHull(combo);
      if (hull.length !== 4) continue;
      return squareWinInfoFromVertices(hull);
    }
  }
  return null;
}

export function sqWinScore(info: SquareWinInfo): number {
  return info.axisAligned ? SQ_SCORE_AXIS_ALIGNED : SQ_SCORE_TILTED;
}

export function sqRunScore(
  outcome: QuadOutcome,
  winInfo?: SquareWinInfo | null,
): number {
  if (outcome === "win") {
    return winInfo ? sqWinScore(winInfo) : SQ_SCORE_TILTED;
  }
  if (outcome === "loss") return SQ_SCORE_LOSS;
  return SQ_SCORE_DRAW;
}

export function squareTypeLabel(axisAligned: boolean): string {
  return axisAligned ? "축에 평행한 정사각형" : "비스듬한 정사각형";
}

export function tryPlaceSquare(
  board: BoardMap,
  x: number,
  y: number,
  stone: Stone,
): SquarePlaceResult {
  if (!inBounds(x, y)) {
    return { ok: false, error: "bounds", message: "격자 범위를 벗어났어요." };
  }
  if (getStone(board, x, y)) {
    return { ok: false, error: "occupied", message: "이미 돌이 있어요." };
  }
  const next = cloneBoard(board);
  next.set(coordKey(x, y), stone);
  const winInfo = findWinningSquare(next, stone);
  return {
    ok: true,
    board: next,
    won: winInfo !== null,
    winInfo: winInfo ?? undefined,
  };
}
