/**
 * 일차방정식 대수막대·저울 탐구 — 값 기반 균형 모델
 * contentKey: g1-u2-2-linear-equation-balance
 *
 * 핵심: x 막대의 무게 = 그 문제의 해(xValue).
 * 균형 = panValue(left) === panValue(right)
 */

export const CONTENT_KEY = "g1-u2-2-linear-equation-balance";
export const PROBLEM_COUNT = 15;

export type TileKind =
  | "x"
  | "neg_x"
  | "half_x"
  | "neg_half_x"
  | "one"
  | "neg_one";

export type PanExpr = { x: number; unit: number };

export type BalanceState = { left: PanExpr; right: PanExpr };

export type PanSide = "left" | "right";

/** 균형이 깨질 때 직전에 한 조작 */
export type BalanceAction =
  | { type: "add"; kind: TileKind; side: PanSide }
  | { type: "remove"; kind: TileKind; side: PanSide }
  | { type: "move"; kind: TileKind; from: PanSide; to: PanSide }
  | { type: "divide"; divisor: number }
  | { type: "multiply"; factor: number }
  | { type: "flip" };

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
  /** 이 문항에서 허용되는 등식 변환(필요할 때만 버튼 표시) */
  scaleOps?: {
    flip?: boolean;
    multiply?: boolean;
    divide?: boolean;
  };
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
    case "half_x":
      return xValue / 2;
    case "neg_half_x":
      return -xValue / 2;
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
      case "half_x":
        x += 0.5;
        break;
      case "neg_half_x":
        x -= 0.5;
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

function formatXCoeff(abs: number): string {
  if (abs === 1) return "x";
  if (abs === 0.5) return "½x";
  const whole = Math.trunc(abs);
  const frac = abs - whole;
  if (frac === 0.5) return `${whole}½x`;
  return `${abs}x`;
}

export function tilesFromExpr(expr: PanExpr): TileKind[] {
  const tiles: TileKind[] = [];
  const wholeX = Math.trunc(expr.x);
  const fracX = Math.round((expr.x - wholeX) * 2) / 2;

  for (let i = 0; i < Math.abs(wholeX); i++) {
    tiles.push(wholeX >= 0 ? "x" : "neg_x");
  }
  if (fracX === 0.5) tiles.push("half_x");
  if (fracX === -0.5) tiles.push("neg_half_x");

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
    const sign = expr.x < 0 ? "−" : "";
    parts.push(`${sign}${formatXCoeff(Math.abs(expr.x))}`);
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
    case "half_x":
      return "½x";
    case "neg_half_x":
      return "−½x";
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
    case "multiply":
      return `양변을 ${action.factor}으로 곱함`;
    case "flip":
      return "양변 부호 바꾸기";
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
  half_x: number;
  neg_half_x: number;
  one: number;
  neg_one: number;
};

function countTiles(tiles: PlacedTile[]): TileCounts {
  return {
    x: tiles.filter((t) => t.kind === "x").length,
    neg_x: tiles.filter((t) => t.kind === "neg_x").length,
    half_x: tiles.filter((t) => t.kind === "half_x").length,
    neg_half_x: tiles.filter((t) => t.kind === "neg_half_x").length,
    one: tiles.filter((t) => t.kind === "one").length,
    neg_one: tiles.filter((t) => t.kind === "neg_one").length,
  };
}

function totalTiles(c: TileCounts): number {
  return (
    c.x +
    c.neg_x +
    c.half_x +
    c.neg_half_x +
    c.one +
    c.neg_one
  );
}

export function findZeroPairs(ws: TileWorkspace): ZeroPair[] {
  const pairs: ZeroPair[] = [];

  for (const pan of ["left", "right"] as PanSide[]) {
    const tiles = ws[pan];
    const ones = tiles.filter((t) => t.kind === "one");
    const negOnes = tiles.filter((t) => t.kind === "neg_one");
    const xs = tiles.filter((t) => t.kind === "x");
    const negXs = tiles.filter((t) => t.kind === "neg_x");
    const halfXs = tiles.filter((t) => t.kind === "half_x");
    const negHalfXs = tiles.filter((t) => t.kind === "neg_half_x");

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

    const halfPairs = Math.min(halfXs.length, negHalfXs.length);
    for (let i = 0; i < halfPairs; i++) {
      pairs.push({
        pan,
        kind: "x",
        tileA: halfXs[i]!.id,
        tileB: negHalfXs[i]!.id,
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
      lc.half_x % n === 0 &&
      lc.neg_half_x % n === 0 &&
      lc.one % n === 0 &&
      lc.neg_one % n === 0 &&
      rc.x % n === 0 &&
      rc.neg_x % n === 0 &&
      rc.half_x % n === 0 &&
      rc.neg_half_x % n === 0 &&
      rc.one % n === 0 &&
      rc.neg_one % n === 0;
    if (ok) divisors.push(n);
  }

  return divisors;
}

export const MAX_TILES_PER_PAN = 14;

export function flipTileKind(kind: TileKind): TileKind {
  switch (kind) {
    case "x":
      return "neg_x";
    case "neg_x":
      return "x";
    case "half_x":
      return "neg_half_x";
    case "neg_half_x":
      return "half_x";
    case "one":
      return "neg_one";
    case "neg_one":
      return "one";
  }
}

export function flipBothSides(ws: TileWorkspace): TileWorkspace {
  const flipPan = (tiles: PlacedTile[]) =>
    tiles.map((t) => createTile(flipTileKind(t.kind), "flip"));
  return { left: flipPan(ws.left), right: flipPan(ws.right) };
}

export function multiplyBothSides(ws: TileWorkspace, n: number): TileWorkspace {
  if (n < 2) return ws;
  const scalePan = (tiles: PlacedTile[]) => {
    const result: PlacedTile[] = [];
    for (const t of tiles) {
      for (let i = 0; i < n; i++) {
        result.push(createTile(t.kind, "mul"));
      }
    }
    return result;
  };
  return consolidateHalfXBothSides({
    left: scalePan(ws.left),
    right: scalePan(ws.right),
  });
}

export function getAvailableMultipliers(ws: TileWorkspace): number[] {
  const lt = ws.left.length;
  const rt = ws.right.length;
  if (lt === 0 || rt === 0) return [];

  const multipliers: number[] = [];
  for (let n = 2; n <= 3; n++) {
    if (lt * n <= MAX_TILES_PER_PAN && rt * n <= MAX_TILES_PER_PAN) {
      multipliers.push(n);
    }
  }
  return multipliers;
}

export function canFlipBothSides(ws: TileWorkspace): boolean {
  return ws.left.length > 0 && ws.right.length > 0;
}

function hasNegativeXTiles(ws: TileWorkspace): boolean {
  return [...ws.left, ...ws.right].some(
    (t) => t.kind === "neg_x" || t.kind === "neg_half_x",
  );
}

function hasHalfXTiles(ws: TileWorkspace): boolean {
  return [...ws.left, ...ws.right].some(
    (t) => t.kind === "half_x" || t.kind === "neg_half_x",
  );
}

function consolidateHalfXTiles(tiles: PlacedTile[]): PlacedTile[] {
  const rest = tiles.filter(
    (t) => t.kind !== "half_x" && t.kind !== "neg_half_x",
  );
  const halfCount = tiles.filter((t) => t.kind === "half_x").length;
  const negHalfCount = tiles.filter((t) => t.kind === "neg_half_x").length;
  const merged: PlacedTile[] = [...rest];

  for (let i = 0; i < Math.floor(halfCount / 2); i++) {
    merged.push(createTile("x", "merge"));
  }
  if (halfCount % 2 === 1) {
    merged.push(createTile("half_x", "merge"));
  }
  for (let i = 0; i < Math.floor(negHalfCount / 2); i++) {
    merged.push(createTile("neg_x", "merge"));
  }
  if (negHalfCount % 2 === 1) {
    merged.push(createTile("neg_half_x", "merge"));
  }

  return merged;
}

function consolidateHalfXBothSides(ws: TileWorkspace): TileWorkspace {
  return {
    left: consolidateHalfXTiles(ws.left),
    right: consolidateHalfXTiles(ws.right),
  };
}

/** x 막대가 한쪽 접시에만 2개 이상일 때만 나누기가 의미 있음 (양변에 x가 있으면 숨김) */
function divideWouldHelp(ws: TileWorkspace): boolean {
  const lc = countTiles(ws.left);
  const rc = countTiles(ws.right);
  const xOnlyOnLeft =
    (lc.x >= 2 || lc.neg_x >= 2) && rc.x === 0 && rc.neg_x === 0;
  const xOnlyOnRight =
    (rc.x >= 2 || rc.neg_x >= 2) && lc.x === 0 && lc.neg_x === 0;
  return xOnlyOnLeft || xOnlyOnRight;
}

/** 문항 설정 + 현재 접시 상태에 따라 필요한 스케일 조작만 반환 */
export function getPedagogicalScaleOperations(
  ws: TileWorkspace,
  problem: BalanceProblem,
): {
  flip: boolean;
  multiply: number[];
  divide: number[];
} {
  const allowed = problem.scaleOps ?? {};

  return {
    flip:
      Boolean(allowed.flip) &&
      hasNegativeXTiles(ws) &&
      canFlipBothSides(ws),
    multiply: allowed.multiply
      ? getAvailableMultipliers(ws).filter((n) =>
          hasHalfXTiles(ws) ? n === 2 : true,
        )
      : [],
    divide: allowed.divide
      ? getAvailableDivisors(ws).filter(() => divideWouldHelp(ws))
      : [],
  };
}

/** @deprecated use getPedagogicalScaleOperations */
export function getScaleOperations(ws: TileWorkspace): {
  flip: boolean;
  multiply: number[];
  divide: number[];
} {
  return {
    flip: canFlipBothSides(ws) && hasNegativeXTiles(ws),
    multiply: getAvailableMultipliers(ws),
    divide: getAvailableDivisors(ws),
  };
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
  leftResult = takeFraction(leftResult, "half_x", lc.half_x / n);
  leftResult = takeFraction(leftResult, "neg_half_x", lc.neg_half_x / n);
  leftResult = takeFraction(leftResult, "one", lc.one / n);
  leftResult = takeFraction(leftResult, "neg_one", lc.neg_one / n);

  let rightResult = ws.right;
  rightResult = takeFraction(rightResult, "x", rc.x / n);
  rightResult = takeFraction(rightResult, "neg_x", rc.neg_x / n);
  rightResult = takeFraction(rightResult, "half_x", rc.half_x / n);
  rightResult = takeFraction(rightResult, "neg_half_x", rc.neg_half_x / n);
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
    title: "양변에 x가",
    instruction:
      "2x + 1 = x + 4 를 풀어 보세요. 양변에 있는 x 막대도 똑같이 더하거나 빼도 돼요.",
    targetLatex: "2x + 1 = x + 4",
    xValue: 3,
    initial: { left: { x: 2, unit: 1 }, right: { x: 1, unit: 4 } },
    hints: [
      "양변에 −x 막대를 1개씩 더하거나, 오른쪽 x 막대를 휴지통에 넣어 보세요.",
      "x + 1 = 4 가 되면 x = 3 이에요.",
    ],
    allowNegatives: true,
  },
  {
    id: "step-6",
    title: "x 항 옮기기",
    instruction: "3x = x + 8 을 풀어 보세요. x 막대를 양변에서 맞춰 빼 보세요.",
    targetLatex: "3x = x + 8",
    xValue: 4,
    initial: { left: { x: 3, unit: 0 }, right: { x: 1, unit: 8 } },
    hints: [
      "양변에서 x 막대를 1개씩 빼 보세요.",
      "2x = 8 이 되면 x = 4!",
    ],
    allowNegatives: true,
  },
  {
    id: "step-7",
    title: "양변 나누기",
    instruction:
      "2x = 6 을 풀어 보세요. 양변을 똑같이 나눠도 등식은 성립해요.",
    targetLatex: "2x = 6",
    xValue: 3,
    initial: { left: { x: 2, unit: 0 }, right: { x: 0, unit: 6 } },
    hints: [
      "「양변을 2로 나누기」 버튼을 눌러 보세요.",
      "x = 3 이 되면 맞아요.",
    ],
    allowNegatives: true,
    scaleOps: { divide: true },
  },
  {
    id: "step-8",
    title: "나누기 종합",
    instruction: "3x − 2 = 7 을 풀어 보세요.",
    targetLatex: "3x - 2 = 7",
    xValue: 3,
    initial: { left: { x: 3, unit: -2 }, right: { x: 0, unit: 7 } },
    hints: [
      "양변에 +1을 2개씩 더한 뒤, 양변을 3으로 나누어 보세요.",
      "x = 3 이 정답이에요.",
    ],
    allowNegatives: true,
    scaleOps: { divide: true },
  },
  {
    id: "step-9",
    title: "x와 상수 함께",
    instruction: "3x − 1 = x + 3 을 풀어 보세요. x를 한쪽으로 모은 뒤 나눌 수도 있어요.",
    targetLatex: "3x - 1 = x + 3",
    xValue: 2,
    initial: { left: { x: 3, unit: -1 }, right: { x: 1, unit: 3 } },
    hints: [
      "먼저 양변에서 x 막대를 1개씩 빼 보세요.",
      "2x − 1 = 3 이 되면 +1을 더해 2x = 4, 그다음 2로 나누면 x = 2!",
    ],
    allowNegatives: true,
    scaleOps: { divide: true },
  },
  {
    id: "step-10",
    title: "½x 막대",
    instruction:
      "½x = 3 을 풀어 보세요. 「양변을 2로 곱하기」를 누르면 x 막대로 바뀌어요.",
    targetLatex: "\\frac{1}{2}x = 3",
    xValue: 6,
    initial: { left: { x: 0.5, unit: 0 }, right: { x: 0, unit: 3 } },
    hints: [
      "½x 막대는 x 막대의 절반이에요.",
      "「양변을 2로 곱하기」를 누르면 x = 6!",
    ],
    allowNegatives: true,
    scaleOps: { multiply: true },
  },
  {
    id: "step-11",
    title: "음수 계수",
    instruction: "−2x = 6 을 풀어 보세요. 나눈 뒤 부호를 바꿔야 할 수 있어요.",
    targetLatex: "-2x = 6",
    xValue: -3,
    initial: { left: { x: -2, unit: 0 }, right: { x: 0, unit: 6 } },
    hints: [
      "먼저 양변을 2로 나누어 −x = 3 을 만들어 보세요.",
      "그다음 양변 부호 바꾸기로 x = −3 을 확인하세요.",
    ],
    allowNegatives: true,
    scaleOps: { divide: true, flip: true },
  },
  {
    id: "step-12",
    title: "음수 계수 종합",
    instruction: "−2x + 4 = −2 를 풀어 보세요.",
    targetLatex: "-2x + 4 = -2",
    xValue: 3,
    initial: { left: { x: -2, unit: 4 }, right: { x: 0, unit: -2 } },
    hints: [
      "양변에서 +1을 4개씩 빼 보세요.",
      "양변을 2로 나눈 뒤, 부호 바꾸기로 x = 3 을 확인하세요.",
    ],
    allowNegatives: true,
    scaleOps: { divide: true, flip: true },
  },
  {
    id: "step-13",
    title: "종합 도전 1",
    instruction:
      "2x + 5 = x + 12 를 풀어 보세요. x 막대와 상수를 모두 활용해 보세요.",
    targetLatex: "2x + 5 = x + 12",
    xValue: 7,
    initial: { left: { x: 2, unit: 5 }, right: { x: 1, unit: 12 } },
    hints: [
      "양변에서 x 막대를 1개씩 빼 보세요.",
      "x + 5 = 12 가 되면 x = 7!",
    ],
    allowNegatives: true,
  },
  {
    id: "step-14",
    title: "종합 도전 2",
    instruction:
      "3x − 4 = x + 8 을 풀어 보세요. x를 모은 뒤 나누기까지 써 보세요.",
    targetLatex: "3x - 4 = x + 8",
    xValue: 6,
    initial: { left: { x: 3, unit: -4 }, right: { x: 1, unit: 8 } },
    hints: [
      "양변에서 x 막대를 1개씩 빼 보세요.",
      "2x − 4 = 8 이 되면 +4를 더하고, 2로 나누면 x = 6!",
    ],
    allowNegatives: true,
    scaleOps: { divide: true },
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
