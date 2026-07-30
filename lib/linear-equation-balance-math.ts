/**
 * 일차방정식 대수막대·저울 탐구 — 값 기반 균형 모델
 * contentKey: g1-u2-2-linear-equation-balance
 *
 * 핵심: x 막대의 무게 = 그 문제의 해(xValue).
 * 균형 = panValue(left) === panValue(right)
 */

export const CONTENT_KEY = "g1-u2-2-linear-equation-balance";
export const PROBLEM_COUNT = 10;

export type TileKind = "x" | "neg_x" | "one" | "neg_one";

export type PanExpr = { x: number; unit: number };

export type BalanceState = { left: PanExpr; right: PanExpr };

export type PanSide = "left" | "right";

/** 균형이 깨질 때 직전에 한 조작 */
export type BalanceAction =
  | { type: "add"; kind: TileKind; side: PanSide }
  | { type: "remove"; kind: TileKind; side: PanSide }
  | { type: "move"; kind: TileKind; from: PanSide; to: PanSide }
  | { type: "divide"; divisor: number };

export type PlacedTile = {
  id: string;
  kind: TileKind;
};

export type TileWorkspace = {
  left: PlacedTile[];
  right: PlacedTile[];
};

export type ZeroPairKind = "unit" | "x";

export type ZeroPair = {
  pan: PanSide;
  kind: ZeroPairKind;
  tileA: string;
  tileB: string;
};

export type BalanceProblem = {
  id: string;
  title: string;
  instruction: string;
  targetLatex: string;
  /** 이 문제에서 x 막대 1개의 실제 값 (= 해) */
  xValue: number;
  initial: BalanceState;
  hints: string[];
  allowNegatives: boolean;
};

export type CheckReason =
  | "ok"
  | "unbalanced"
  | "wrong"
  | "incomplete"
  | "x_on_both_sides";

export type CheckResult = {
  ok: boolean;
  reason: CheckReason;
};

export const WRONG_PENALTY = 15;
export const MIN_CORRECT_SCORE = 40;
export const MAX_CORRECT_SCORE = 100;

let tileIdSeq = 0;

export function scoreForAttempts(wrongs: number): number {
  const w = Math.max(0, Math.floor(wrongs));
  return Math.max(MIN_CORRECT_SCORE, MAX_CORRECT_SCORE - w * WRONG_PENALTY);
}

export function tileValue(kind: TileKind, xValue: number): number {
  switch (kind) {
    case "x":
      return xValue;
    case "neg_x":
      return -xValue;
    case "one":
      return 1;
    case "neg_one":
      return -1;
  }
}

export function exprFromTiles(tiles: TileKind[]): PanExpr {
  let x = 0;
  let unit = 0;
  for (const t of tiles) {
    switch (t) {
      case "x":
        x += 1;
        break;
      case "neg_x":
        x -= 1;
        break;
      case "one":
        unit += 1;
        break;
      case "neg_one":
        unit -= 1;
        break;
    }
  }
  return { x, unit };
}

export function tilesFromExpr(expr: PanExpr): TileKind[] {
  const tiles: TileKind[] = [];
  for (let i = 0; i < Math.abs(expr.x); i++) {
    tiles.push(expr.x >= 0 ? "x" : "neg_x");
  }
  for (let i = 0; i < Math.abs(expr.unit); i++) {
    tiles.push(expr.unit >= 0 ? "one" : "neg_one");
  }
  return tiles;
}

export function panValue(tiles: PlacedTile[], xValue: number): number {
  return tiles.reduce((sum, t) => sum + tileValue(t.kind, xValue), 0);
}

export function workspaceToBalance(ws: TileWorkspace): BalanceState {
  return {
    left: exprFromTiles(ws.left.map((t) => t.kind)),
    right: exprFromTiles(ws.right.map((t) => t.kind)),
  };
}

export function isBalancedWs(ws: TileWorkspace, xValue: number): boolean {
  return panValue(ws.left, xValue) === panValue(ws.right, xValue);
}

export function isSolved(ws: TileWorkspace, xValue: number): boolean {
  if (!isBalancedWs(ws, xValue)) return false;
  const { left, right } = workspaceToBalance(ws);

  const leftIsolated =
    left.x === 1 &&
    left.unit === 0 &&
    right.x === 0 &&
    right.unit === xValue;
  const rightIsolated =
    right.x === 1 &&
    right.unit === 0 &&
    left.x === 0 &&
    left.unit === xValue;

  return leftIsolated || rightIsolated;
}

export function checkAnswer(
  problem: BalanceProblem,
  ws: TileWorkspace,
): CheckResult {
  if (!isBalancedWs(ws, problem.xValue)) {
    return { ok: false, reason: "unbalanced" };
  }

  const { left, right } = workspaceToBalance(ws);
  if (left.x > 0 && right.x > 0) {
    return { ok: false, reason: "x_on_both_sides" };
  }

  if (isSolved(ws, problem.xValue)) {
    return { ok: true, reason: "ok" };
  }

  return { ok: false, reason: "wrong" };
}

export function formatExpr(expr: PanExpr): string {
  const parts: string[] = [];
  if (expr.x !== 0) {
    if (expr.x === 1) parts.push("x");
    else if (expr.x === -1) parts.push("−x");
    else parts.push(`${expr.x}x`);
  }
  if (expr.unit !== 0) {
    if (expr.unit > 0) {
      parts.push(expr.unit === 1 ? "+1" : `+${expr.unit}`);
    } else {
      parts.push(expr.unit === -1 ? "−1" : `${expr.unit}`);
    }
  }
  if (parts.length === 0) return "0";
  return parts.join("").replace(/^\+/, "");
}

export function balanceTiltDeg(ws: TileWorkspace, xValue: number): number {
  const diff = panValue(ws.right, xValue) - panValue(ws.left, xValue);
  if (diff === 0) return 0;
  const TILT_DEG = 16;
  return diff > 0 ? TILT_DEG : -TILT_DEG;
}

function tileKindShort(kind: TileKind): string {
  switch (kind) {
    case "x":
      return "x";
    case "neg_x":
      return "−x";
    case "one":
      return "+1";
    case "neg_one":
      return "−1";
  }
}

function panSideLabel(side: PanSide): string {
  return side === "left" ? "왼쪽" : "오른쪽";
}

export function formatBalanceAction(action: BalanceAction): string {
  switch (action.type) {
    case "add":
      return `${panSideLabel(action.side)}에 ${tileKindShort(action.kind)} 추가`;
    case "remove":
      return `${panSideLabel(action.side)}에서 ${tileKindShort(action.kind)} 제거`;
    case "move":
      return `${tileKindShort(action.kind)}을(를) ${panSideLabel(action.from)}→${panSideLabel(action.to)}으로 이동`;
    case "divide":
      return `양변을 ${action.divisor}으로 나눔`;
  }
}

export function workspaceMass(ws: TileWorkspace, xValue: number): {
  left: number;
  right: number;
} {
  return {
    left: panValue(ws.left, xValue),
    right: panValue(ws.right, xValue),
  };
}

export function createTile(kind: TileKind, prefix = "t"): PlacedTile {
  tileIdSeq += 1;
  return { id: `${prefix}-${tileIdSeq}-${kind}`, kind };
}

export function workspaceFromBalance(
  state: BalanceState,
  seed = "",
): TileWorkspace {
  const mk = (side: PanSide, expr: PanExpr): PlacedTile[] =>
    tilesFromExpr(expr).map((kind, i) => ({
      id: `${seed}${side}-${i}-${kind}`,
      kind,
    }));

  return {
    left: mk("left", state.left),
    right: mk("right", state.right),
  };
}

export function emptyTileWorkspace(
  problem: BalanceProblem,
  seed = "",
): TileWorkspace {
  return workspaceFromBalance(
    { left: { ...problem.initial.left }, right: { ...problem.initial.right } },
    seed,
  );
}

export function addTileToPan(
  ws: TileWorkspace,
  kind: TileKind,
  pan: PanSide,
): TileWorkspace {
  const tile = createTile(kind, "add");
  if (pan === "left") {
    return { ...ws, left: [...ws.left, tile] };
  }
  return { ...ws, right: [...ws.right, tile] };
}

export function removeTile(ws: TileWorkspace, tileId: string): TileWorkspace {
  return {
    left: ws.left.filter((t) => t.id !== tileId),
    right: ws.right.filter((t) => t.id !== tileId),
  };
}

export function relocateTile(
  ws: TileWorkspace,
  tileId: string,
  to: PanSide,
): TileWorkspace {
  const from =
    ws.left.some((t) => t.id === tileId)
      ? "left"
      : ws.right.some((t) => t.id === tileId)
        ? "right"
        : null;
  if (!from) return ws;

  const tile = ws[from].find((t) => t.id === tileId);
  if (!tile) return ws;

  const cleared = removeTile(ws, tileId);
  if (from === to) return { ...ws };
  if (to === "left") return { ...cleared, left: [...cleared.left, tile] };
  return { ...cleared, right: [...cleared.right, tile] };
}

type TileCounts = {
  x: number;
  neg_x: number;
  one: number;
  neg_one: number;
};

function countTiles(tiles: PlacedTile[]): TileCounts {
  return {
    x: tiles.filter((t) => t.kind === "x").length,
    neg_x: tiles.filter((t) => t.kind === "neg_x").length,
    one: tiles.filter((t) => t.kind === "one").length,
    neg_one: tiles.filter((t) => t.kind === "neg_one").length,
  };
}

function totalTiles(c: TileCounts): number {
  return c.x + c.neg_x + c.one + c.neg_one;
}

export function findZeroPairs(ws: TileWorkspace): ZeroPair[] {
  const pairs: ZeroPair[] = [];

  for (const pan of ["left", "right"] as PanSide[]) {
    const tiles = ws[pan];
    const ones = tiles.filter((t) => t.kind === "one");
    const negOnes = tiles.filter((t) => t.kind === "neg_one");
    const xs = tiles.filter((t) => t.kind === "x");
    const negXs = tiles.filter((t) => t.kind === "neg_x");

    const unitPairs = Math.min(ones.length, negOnes.length);
    for (let i = 0; i < unitPairs; i++) {
      pairs.push({
        pan,
        kind: "unit",
        tileA: ones[i]!.id,
        tileB: negOnes[i]!.id,
      });
    }

    const xPairs = Math.min(xs.length, negXs.length);
    for (let i = 0; i < xPairs; i++) {
      pairs.push({
        pan,
        kind: "x",
        tileA: xs[i]!.id,
        tileB: negXs[i]!.id,
      });
    }
  }

  return pairs;
}

export function applyZeroPairs(ws: TileWorkspace): TileWorkspace {
  let next = ws;
  const pairs = findZeroPairs(next);
  for (const pair of pairs) {
    next = removeTile(removeTile(next, pair.tileA), pair.tileB);
  }
  return next;
}

export function getAvailableDivisors(ws: TileWorkspace): number[] {
  const lc = countTiles(ws.left);
  const rc = countTiles(ws.right);
  const lt = totalTiles(lc);
  const rt = totalTiles(rc);
  if (lt === 0 || rt === 0) return [];

  const max = Math.min(lt, rt);
  const divisors: number[] = [];

  for (let n = 2; n <= max; n++) {
    const ok =
      lc.x % n === 0 &&
      lc.neg_x % n === 0 &&
      lc.one % n === 0 &&
      lc.neg_one % n === 0 &&
      rc.x % n === 0 &&
      rc.neg_x % n === 0 &&
      rc.one % n === 0 &&
      rc.neg_one % n === 0;
    if (ok) divisors.push(n);
  }

  return divisors;
}

function takeFraction(
  tiles: PlacedTile[],
  kind: TileKind,
  keep: number,
): PlacedTile[] {
  const ofKind = tiles.filter((t) => t.kind === kind);
  const rest = tiles.filter((t) => t.kind !== kind);
  return [...rest, ...ofKind.slice(0, keep)];
}

export function divideBothSides(ws: TileWorkspace, n: number): TileWorkspace {
  if (n < 2) return ws;
  const lc = countTiles(ws.left);
  const rc = countTiles(ws.right);

  const newLeft = ws.left;
  let leftResult = newLeft;
  leftResult = takeFraction(leftResult, "x", lc.x / n);
  leftResult = takeFraction(leftResult, "neg_x", lc.neg_x / n);
  leftResult = takeFraction(leftResult, "one", lc.one / n);
  leftResult = takeFraction(leftResult, "neg_one", lc.neg_one / n);

  let rightResult = ws.right;
  rightResult = takeFraction(rightResult, "x", rc.x / n);
  rightResult = takeFraction(rightResult, "neg_x", rc.neg_x / n);
  rightResult = takeFraction(rightResult, "one", rc.one / n);
  rightResult = takeFraction(rightResult, "neg_one", rc.neg_one / n);

  return { left: leftResult, right: rightResult };
}

export function finalizeWorkspace(ws: TileWorkspace): TileWorkspace {
  return applyZeroPairs(ws);
}

export const PROBLEMS: BalanceProblem[] = [
  {
    id: "step-0",
    title: "등식에서 출발",
    instruction:
      "저울이 균형을 이루고 있어요. +1 막대를 팔레트에서 끌어 양쪽 접시에 각각 2개씩 올려 보세요. 0이 되는 쌍이 사라지면서 x = 5를 만들 수 있어요.",
    targetLatex: "x - 2 = 3",
    xValue: 5,
    initial: { left: { x: 1, unit: -2 }, right: { x: 0, unit: 3 } },
    hints: [
      "아래 팔레트에서 +1 막대를 끌어 왼쪽·오른쪽 접시에 각각 2개씩 놓아 보세요.",
      "+1과 −1이 만나면 0이 되어 사라져요. x 막대만 왼쪽에 남기면 x = 5!",
    ],
    allowNegatives: true,
  },
  {
    id: "step-1",
    title: "같은 수 더하기",
    instruction:
      "x − 4 = 2 를 풀어 보세요. 양변에 같은 막대를 더하면 저울은 계속 균형을 유지해요.",
    targetLatex: "x - 4 = 2",
    xValue: 6,
    initial: { left: { x: 1, unit: -4 }, right: { x: 0, unit: 2 } },
    hints: [
      "양변에 +1 막대를 4개씩 더해 보세요.",
      "0쌍이 사라지면 x = 6 이에요.",
    ],
    allowNegatives: true,
  },
  {
    id: "step-2",
    title: "같은 수 빼기",
    instruction:
      "x + 3 = 8 을 풀어 보세요. 양변에서 같은 막대를 빼도 등식은 성립해요.",
    targetLatex: "x + 3 = 8",
    xValue: 5,
    initial: { left: { x: 1, unit: 3 }, right: { x: 0, unit: 8 } },
    hints: [
      "휴지통에 +1 막대를 넣어 양쪽에서 3개씩 빼거나, −1 막대를 양변에 3개씩 더해 보세요.",
      "x 막대만 남기면 x = 5!",
    ],
    allowNegatives: true,
  },
  {
    id: "step-3",
    title: "음수 해",
    instruction: "x + 6 = 2 를 풀어 보세요. 해가 음수일 수도 있어요.",
    targetLatex: "x + 6 = 2",
    xValue: -4,
    initial: { left: { x: 1, unit: 6 }, right: { x: 0, unit: 2 } },
    hints: [
      "양변에서 +1을 6개씩 빼 보세요.",
      "x = −4 가 되면 맞아요.",
    ],
    allowNegatives: true,
  },
  {
    id: "step-4",
    title: "우변도 음수",
    instruction: "x + 2 = −2 를 풀어 보세요.",
    targetLatex: "x + 2 = -2",
    xValue: -4,
    initial: { left: { x: 1, unit: 2 }, right: { x: 0, unit: -2 } },
    hints: [
      "양변에서 +1을 2개씩 빼 보세요.",
      "x = −4 를 확인해 보세요.",
    ],
    allowNegatives: true,
  },
  {
    id: "step-5",
    title: "음수 종합",
    instruction: "x − 1 = −5 를 풀어 보세요.",
    targetLatex: "x - 1 = -5",
    xValue: -4,
    initial: { left: { x: 1, unit: -1 }, right: { x: 0, unit: -5 } },
    hints: [
      "양변에 +1을 1개씩 더해 보세요.",
      "x = −4 가 되면 성공이에요.",
    ],
    allowNegatives: true,
  },
  {
    id: "step-6",
    title: "양변 나누기",
    instruction:
      "2x = 6 을 풀어 보세요. 양변을 똑같이 나눠도 등식은 성립해요.",
    targetLatex: "2x = 6",
    xValue: 3,
    initial: { left: { x: 2, unit: 0 }, right: { x: 0, unit: 6 } },
    hints: [
      "아래 「양변을 2로 나누기」 버튼을 눌러 보세요.",
      "x = 3 이 되면 맞아요.",
    ],
    allowNegatives: true,
  },
  {
    id: "step-7",
    title: "나누기와 음수",
    instruction: "2x = −6 을 풀어 보세요.",
    targetLatex: "2x = -6",
    xValue: -3,
    initial: { left: { x: 2, unit: 0 }, right: { x: 0, unit: -6 } },
    hints: [
      "양변을 2로 나누어 보세요.",
      "x = −3 을 확인해 보세요.",
    ],
    allowNegatives: true,
  },
  {
    id: "step-8",
    title: "상수 먼저 제거",
    instruction:
      "2x + 1 = 7 을 풀어 보세요. 먼저 상수를 없앤 뒤 나누어야 해요.",
    targetLatex: "2x + 1 = 7",
    xValue: 3,
    initial: { left: { x: 2, unit: 1 }, right: { x: 0, unit: 7 } },
    hints: [
      "양변에서 +1을 1개씩 빼 보세요. 그다음 양변을 2로 나누세요.",
      "x = 3 이에요.",
    ],
    allowNegatives: true,
  },
  {
    id: "step-9",
    title: "종합 도전",
    instruction: "3x − 2 = 7 을 풀어 보세요.",
    targetLatex: "3x - 2 = 7",
    xValue: 3,
    initial: { left: { x: 3, unit: -2 }, right: { x: 0, unit: 7 } },
    hints: [
      "양변에 +1을 2개씩 더한 뒤, 양변을 3으로 나누어 보세요.",
      "x = 3 이 정답이에요.",
    ],
    allowNegatives: true,
  },
];

export function problemAt(stepIndex: number): BalanceProblem {
  return PROBLEMS[stepIndex] ?? PROBLEMS[0]!;
}

/** 개발용: 모든 문제 초기 균형 검증 */
export function assertAllProblemsBalanced(): void {
  for (const p of PROBLEMS) {
    const ws = emptyTileWorkspace(p);
    if (!isBalancedWs(ws, p.xValue)) {
      throw new Error(
        `Problem ${p.id} not balanced: left=${panValue(ws.left, p.xValue)} right=${panValue(ws.right, p.xValue)}`,
      );
    }
  }
}

// Backward compat aliases
export function isBalanced(ws: TileWorkspace, xValue: number): boolean {
  return isBalancedWs(ws, xValue);
}

export function balanceTiltFromWorkspace(
  ws: TileWorkspace,
  xValue: number,
): number {
  return balanceTiltDeg(ws, xValue);
}
