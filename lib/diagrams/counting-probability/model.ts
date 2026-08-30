import type { IconId } from "@/lib/diagrams/counting-probability/icons";

export type CountingKind = "dice" | "cards" | "pouches" | "spinner" | "paths";

export type ColorId =
  | "blue"
  | "red"
  | "green"
  | "yellow"
  | "pink"
  | "purple"
  | "gray"
  | "orange"
  | "white"
  | "beige";

export type DieFace = 1 | 2 | 3 | 4 | 5 | 6;

export type DiceItem = {
  id: string;
  face: DieFace;
  color: ColorId;
  x: number;
  y: number;
  rotation: number;
};

export type CardItem = {
  id: string;
  text: string;
  color: ColorId;
  x: number;
  y: number;
};

export type BallItem = {
  id: string;
  text: string;
  color: ColorId;
  x: number;
  y: number;
};

export type PouchItem = {
  id: string;
  label: string;
  x: number;
  y: number;
  balls: BallItem[];
};

export type SpinnerSlice = {
  id: string;
  text: string;
  color: ColorId;
};

export type SpinnerState = {
  slices: SpinnerSlice[];
  rotation: number;
};

export type PlaceNode = {
  id: string;
  label: string;
  icon: IconId;
  x: number;
  y: number;
};

export type PathEdge = {
  id: string;
  from: string;
  to: string;
  count: number;
  color: ColorId;
  bends: number[];
};

export type PathsState = {
  places: PlaceNode[];
  edges: PathEdge[];
  /** Show place name text under icons on the figure. */
  showPlaceLabels: boolean;
  labelFontSize: number;
};

export type CountingStyle = {
  lineWidth: number;
  fontSize: number;
  exportScale: number;
};

export type CountingState = {
  kind: CountingKind;
  dice: DiceItem[];
  /** 가로 한 줄에 배치할 주사위 개수 */
  diceCols: number;
  cards: CardItem[];
  /** 가로 한 줄에 배치할 카드 개수 */
  cardCols: number;
  pouches: PouchItem[];
  spinner: SpinnerState;
  paths: PathsState;
  style: CountingStyle;
};

export const COUNTING_KINDS: { id: CountingKind; label: string }[] = [
  { id: "dice", label: "주사위" },
  { id: "cards", label: "카드" },
  { id: "pouches", label: "주머니" },
  { id: "spinner", label: "등분할 원판" },
  { id: "paths", label: "길" },
];

export const COLOR_OPTIONS: { id: ColorId; label: string }[] = [
  { id: "blue", label: "파랑" },
  { id: "red", label: "빨강" },
  { id: "green", label: "초록" },
  { id: "yellow", label: "노랑" },
  { id: "pink", label: "분홍" },
  { id: "purple", label: "보라" },
  { id: "orange", label: "주황" },
  { id: "gray", label: "회색" },
  { id: "white", label: "하양" },
  { id: "beige", label: "베이지" },
];

export const COLORS: Record<
  ColorId,
  { fill: string; stroke: string; light: string }
> = {
  blue: { fill: "#4a90d9", stroke: "#2d6cb5", light: "rgba(74,144,217,0.22)" },
  red: { fill: "#e85a5a", stroke: "#c03030", light: "rgba(232,90,90,0.22)" },
  green: { fill: "#6ec86e", stroke: "#3a9a3a", light: "rgba(110,200,110,0.22)" },
  yellow: { fill: "#f5d060", stroke: "#c8a020", light: "rgba(245,208,96,0.28)" },
  pink: { fill: "#f090b0", stroke: "#d06080", light: "rgba(240,144,176,0.25)" },
  purple: { fill: "#a080d0", stroke: "#7050a0", light: "rgba(160,128,208,0.22)" },
  orange: { fill: "#f0a050", stroke: "#c07020", light: "rgba(240,160,80,0.25)" },
  gray: { fill: "#b0b0b0", stroke: "#808080", light: "rgba(176,176,176,0.25)" },
  white: { fill: "#f8f8f8", stroke: "#aaaaaa", light: "rgba(248,248,248,0.5)" },
  beige: { fill: "#f0e0c0", stroke: "#c0a880", light: "rgba(240,224,192,0.35)" },
};

export const DICE_COLORS: ColorId[] = ["blue", "red", "green", "gray"];
export const CARD_COLORS: ColorId[] = [
  "pink",
  "blue",
  "green",
  "yellow",
  "purple",
  "orange",
];
export const BALL_COLORS: ColorId[] = [
  "blue",
  "pink",
  "yellow",
  "green",
  "purple",
  "white",
];
export const PATH_COLORS: ColorId[] = ["pink", "blue", "green", "orange", "purple"];

export const MIN_DICE = 1;
export const MAX_DICE = 12;
export const MIN_CARDS = 1;
export const MAX_CARDS = 20;
export const MIN_POUCHES = 1;
export const MAX_POUCHES = 4;
export const MIN_BALLS = 0;
export const MAX_BALLS = 12;
export const MIN_SLICES = 2;
export const MAX_SLICES = 12;
export const MIN_PLACES = 2;
export const MAX_PLACES = 6;
export const MIN_PATHS = 1;
export const MAX_PATHS = 6;

/** Parallel paths between two places — spacing along the normal (px). */
export const PATH_LANE_SPACING = 40;

export const SCENE_WIDTH = 560;
export const SCENE_HEIGHT = 400;

export const POUCH_BODY_W = 150;
export const POUCH_BODY_H = 175;
export const BALL_RADIUS = 13;

export const MAX_DICE_COLS = 6;
export const MAX_CARD_COLS = 6;

const DEFAULT_STYLE: CountingStyle = {
  lineWidth: 1.5,
  fontSize: 16,
  exportScale: 3,
};

const CARD_CYCLE: ColorId[] = [
  "pink",
  "blue",
  "green",
  "yellow",
  "purple",
  "orange",
  "pink",
  "blue",
  "green",
  "yellow",
];

export function newId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function pouchLabel(index: number): string {
  return String.fromCharCode(65 + index);
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function cloneState(state: CountingState): CountingState {
  return normalizeState(JSON.parse(JSON.stringify(state)) as CountingState);
}

function defaultDice(count: number, faces?: DieFace[]): DiceItem[] {
  const defaults: DieFace[] = faces ?? [3, 6];
  return Array.from({ length: count }, (_, i) => ({
    id: newId("d"),
    face: defaults[i % defaults.length] ?? (((i % 6) + 1) as DieFace),
    color: "blue" as ColorId,
    x: 0,
    y: 0,
    rotation: 0,
  }));
}

export function autoDiceCols(count: number): number {
  return Math.min(MAX_DICE_COLS, Math.max(1, Math.ceil(Math.sqrt(count))));
}

export function autoCardCols(count: number): number {
  return Math.min(MAX_CARD_COLS, Math.max(1, Math.ceil(Math.sqrt(count * 1.4))));
}

function defaultCards(count: number, texts?: string[]): CardItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: newId("c"),
    text: texts?.[i] ?? String(i + 1),
    color: CARD_CYCLE[i % CARD_CYCLE.length]!,
    x: 0,
    y: 0,
  }));
}

function defaultBalls(count: number, color: ColorId): BallItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: newId("b"),
    text: String(i + 1),
    color,
    x: 0,
    y: 0,
  }));
}

function defaultPouches(count: number): PouchItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: newId("p"),
    label: pouchLabel(i),
    x: 0,
    y: 0,
    balls: defaultBalls(5, i === 0 ? "blue" : "pink"),
  }));
}

function defaultSlices(count: number): SpinnerSlice[] {
  const palette: ColorId[] = [
    "green",
    "yellow",
    "pink",
    "blue",
    "purple",
    "orange",
    "beige",
    "gray",
  ];
  return Array.from({ length: count }, (_, i) => ({
    id: newId("s"),
    text: i < count - 2 ? "당첨" : "꽝",
    color: palette[i % palette.length]!,
  }));
}

function defaultPlaces(): PlaceNode[] {
  return [
    { id: newId("pl"), label: "학교", icon: "school", x: 0, y: 0 },
    { id: newId("pl"), label: "문구점", icon: "store", x: 0, y: 0 },
    { id: newId("pl"), label: "집", icon: "home", x: 0, y: 0 },
  ];
}

function defaultEdges(places: PlaceNode[]): PathEdge[] {
  if (places.length < 2) return [];
  const edges: PathEdge[] = [];
  for (let i = 0; i < places.length - 1; i += 1) {
    const count = i === 0 ? 3 : 2;
    edges.push({
      id: newId("e"),
      from: places[i]!.id,
      to: places[i + 1]!.id,
      count,
      color: PATH_COLORS[i % PATH_COLORS.length]!,
      bends: Array.from({ length: count }, (_, j) => {
        const lane = j - (count - 1) / 2;
        return lane * PATH_LANE_SPACING;
      }),
    });
  }
  if (places.length >= 3) {
    edges.push({
      id: newId("e"),
      from: places[0]!.id,
      to: places[places.length - 1]!.id,
      count: 2,
      color: "green",
      bends: [-PATH_LANE_SPACING * 1.75, PATH_LANE_SPACING * 1.75],
    });
  }
  return edges;
}

export function layoutDice(items: DiceItem[], cols?: number): DiceItem[] {
  const size = 72;
  const gap = 16;
  const colCount = clamp(cols ?? autoDiceCols(items.length), 1, MAX_DICE_COLS);
  const rows = Math.ceil(items.length / colCount);
  const gridW = colCount * size + (colCount - 1) * gap;
  const gridH = rows * size + (rows - 1) * gap;
  const ox = (SCENE_WIDTH - gridW) / 2 + size / 2;
  const oy = (SCENE_HEIGHT - gridH) / 2 + size / 2;
  return items.map((item, i) => {
    const col = i % colCount;
    const row = Math.floor(i / colCount);
    return {
      ...item,
      x: ox + col * (size + gap),
      y: oy + row * (size + gap),
      rotation: 0,
    };
  });
}

export function layoutCards(items: CardItem[], cols?: number): CardItem[] {
  const w = 52;
  const h = 72;
  const gapX = 10;
  const gapY = 12;
  const colCount = clamp(cols ?? autoCardCols(items.length), 1, MAX_CARD_COLS);
  const rows = Math.ceil(items.length / colCount);
  const gridW = colCount * w + (colCount - 1) * gapX;
  const gridH = rows * h + (rows - 1) * gapY;
  const ox = (SCENE_WIDTH - gridW) / 2 + w / 2;
  const oy = (SCENE_HEIGHT - gridH) / 2 + h / 2 - 10;
  return items.map((item, i) => {
    const col = i % colCount;
    const row = Math.floor(i / colCount);
    return {
      ...item,
      x: ox + col * (w + gapX),
      y: oy + row * (h + gapY),
    };
  });
}

export function layoutBallsInPouch(balls: BallItem[]): BallItem[] {
  const n = balls.length;
  if (n === 0) return balls;
  const r = BALL_RADIUS;
  const positions: { x: number; y: number }[] = [];
  const bellyY = 14;
  if (n === 1) positions.push({ x: 0, y: bellyY });
  else if (n === 2) {
    positions.push({ x: -20, y: bellyY }, { x: 20, y: bellyY });
  } else if (n === 3) {
    positions.push({ x: -22, y: bellyY + 6 }, { x: 22, y: bellyY + 6 }, { x: 0, y: bellyY - 14 });
  } else if (n === 4) {
    positions.push(
      { x: -22, y: bellyY + 4 },
      { x: 22, y: bellyY + 4 },
      { x: -22, y: bellyY - 12 },
      { x: 22, y: bellyY - 12 },
    );
  } else if (n === 5) {
    positions.push(
      { x: -24, y: bellyY + 6 },
      { x: 24, y: bellyY + 6 },
      { x: -12, y: bellyY - 12 },
      { x: 12, y: bellyY - 12 },
      { x: 0, y: bellyY + 18 },
    );
  } else {
    const cols = Math.min(4, Math.ceil(Math.sqrt(n)));
    const rows = Math.ceil(n / cols);
    const stepX = r * 2 + 5;
    const stepY = r * 2 + 3;
    for (let i = 0; i < n; i += 1) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      positions.push({
        x: (col - (cols - 1) / 2) * stepX,
        y: bellyY + (row - (rows - 1) / 2) * stepY - 4,
      });
    }
  }
  return balls.map((ball, i) => ({
    ...ball,
    x: positions[i]?.x ?? ball.x,
    y: positions[i]?.y ?? ball.y,
  }));
}

export function layoutPouches(items: PouchItem[]): PouchItem[] {
  const gap = 28;
  const pouchW = POUCH_BODY_W + 16;
  const totalW = items.length * pouchW + (items.length - 1) * gap;
  const startX = (SCENE_WIDTH - totalW) / 2 + pouchW / 2;
  const cy = SCENE_HEIGHT / 2 - 6;
  return items.map((pouch, i) => ({
    ...pouch,
    x: startX + i * (pouchW + gap),
    y: cy,
    balls: layoutBallsInPouch(pouch.balls),
  }));
}

export function edgeFrame(a: PlaceNode, b: PlaceNode) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return {
    nx: -dy / len,
    ny: dx / len,
    midX: (a.x + b.x) / 2,
    midY: (a.y + b.y) / 2,
    direct: Math.abs(dx) > Math.abs(dy) * 1.2,
  };
}

export function edgeLaneMidpoint(
  a: PlaceNode,
  b: PlaceNode,
  bend: number,
): { x: number; y: number; nx: number; ny: number } {
  const frame = edgeFrame(a, b);
  return {
    x: frame.midX + frame.nx * bend,
    y: frame.midY + frame.ny * bend,
    nx: frame.nx,
    ny: frame.ny,
  };
}

export function defaultEdgeBend(edgeCount: number, laneIndex: number): number {
  const lane = laneIndex - (edgeCount - 1) / 2;
  return lane * PATH_LANE_SPACING;
}

export function layoutPlaces(places: PlaceNode[]): PlaceNode[] {
  const n = places.length;
  const margin = 70;
  const span = SCENE_WIDTH - margin * 2;
  const y = SCENE_HEIGHT / 2 + 20;
  return places.map((place, i) => ({
    ...place,
    x: margin + (n === 1 ? span / 2 : (span * i) / (n - 1)),
    y,
  }));
}

export function normalizeState(state: CountingState): CountingState {
  const style = { ...DEFAULT_STYLE, ...state.style };
  const kind = state.kind ?? "dice";

  let dice = Array.isArray(state.dice) ? state.dice : defaultDice(2);
  dice = dice.slice(0, MAX_DICE);
  if (dice.length < MIN_DICE) dice = defaultDice(MIN_DICE);

  let cards = Array.isArray(state.cards) ? state.cards : defaultCards(10);
  cards = cards.slice(0, MAX_CARDS);
  if (cards.length < MIN_CARDS) cards = defaultCards(MIN_CARDS);

  let pouches = Array.isArray(state.pouches) ? state.pouches : defaultPouches(2);
  pouches = pouches.slice(0, MAX_POUCHES).map((p) => ({
    ...p,
    balls: (p.balls ?? []).slice(0, MAX_BALLS),
  }));
  if (pouches.length < MIN_POUCHES) pouches = defaultPouches(MIN_POUCHES);

  let slices = state.spinner?.slices ?? defaultSlices(8);
  slices = slices.slice(0, MAX_SLICES);
  if (slices.length < MIN_SLICES) slices = defaultSlices(MIN_SLICES);
  const spinner: SpinnerState = {
    rotation: state.spinner?.rotation ?? 0,
    slices,
  };

  let places = state.paths?.places ?? defaultPlaces();
  places = places.slice(0, MAX_PLACES);
  if (places.length < MIN_PLACES) places = defaultPlaces().slice(0, MIN_PLACES);

  let edges = Array.isArray(state.paths?.edges) ? state.paths.edges : [];
  edges = edges
    .filter((e) => places.some((p) => p.id === e.from) && places.some((p) => p.id === e.to))
    .map((e) => ({
      ...e,
      count: clamp(e.count, MIN_PATHS, MAX_PATHS),
      bends: (e.bends ?? []).slice(0, MAX_PATHS),
    }));

  if (edges.length === 0 && places.length >= 2) {
    edges = defaultEdges(places);
  }

  const paths: PathsState = {
    places,
    edges,
    showPlaceLabels: state.paths?.showPlaceLabels ?? true,
    labelFontSize: clamp(
      state.paths?.labelFontSize ?? style.fontSize,
      10,
      28,
    ),
  };

  const diceCols = clamp(
    state.diceCols ?? autoDiceCols(dice.length),
    1,
    MAX_DICE_COLS,
  );
  const cardCols = clamp(
    state.cardCols ?? autoCardCols(cards.length),
    1,
    MAX_CARD_COLS,
  );

  return {
    kind,
    dice,
    diceCols,
    cards,
    cardCols,
    pouches,
    spinner,
    paths,
    style,
  };
}

export function setDiceCount(state: CountingState, count: number): CountingState {
  const n = clamp(count, MIN_DICE, MAX_DICE);
  let dice = [...state.dice];
  if (n > dice.length) {
    const added = defaultDice(n - dice.length);
    const laid = layoutDice([...dice, ...added], state.diceCols);
    dice = [
      ...dice,
      ...added.map((d, i) => ({
        ...d,
        x: laid[dice.length + i]!.x,
        y: laid[dice.length + i]!.y,
      })),
    ];
  } else {
    dice = dice.slice(0, n);
  }
  return normalizeState({ ...state, dice });
}

export function relayoutDice(state: CountingState): CountingState {
  return { ...state, dice: layoutDice(state.dice, state.diceCols) };
}

export function setDiceCols(state: CountingState, cols: number): CountingState {
  const diceCols = clamp(cols, 1, MAX_DICE_COLS);
  return normalizeState({
    ...state,
    diceCols,
    dice: layoutDice(state.dice, diceCols),
  });
}

export function setCardCount(state: CountingState, count: number): CountingState {
  const n = clamp(count, MIN_CARDS, MAX_CARDS);
  let cards = [...state.cards];
  if (n > cards.length) {
    const added = defaultCards(n - cards.length);
    const laid = layoutCards([...cards, ...added], state.cardCols);
    cards = [
      ...cards,
      ...added.map((c, i) => ({
        ...c,
        x: laid[cards.length + i]!.x,
        y: laid[cards.length + i]!.y,
      })),
    ];
  } else {
    cards = cards.slice(0, n);
  }
  return normalizeState({ ...state, cards });
}

export function relayoutCards(state: CountingState): CountingState {
  return { ...state, cards: layoutCards(state.cards, state.cardCols) };
}

export function setCardCols(state: CountingState, cols: number): CountingState {
  const cardCols = clamp(cols, 1, MAX_CARD_COLS);
  return normalizeState({
    ...state,
    cardCols,
    cards: layoutCards(state.cards, cardCols),
  });
}

export function setPouchCount(state: CountingState, count: number): CountingState {
  const n = clamp(count, MIN_POUCHES, MAX_POUCHES);
  let pouches = [...state.pouches];
  if (n > pouches.length) {
    const added = defaultPouches(n).slice(pouches.length);
    pouches = [...pouches, ...added];
  } else {
    pouches = pouches.slice(0, n);
  }
  return normalizeState({ ...state, pouches: layoutPouches(pouches) });
}

export function setBallCount(
  state: CountingState,
  pouchId: string,
  count: number,
): CountingState {
  const n = clamp(count, MIN_BALLS, MAX_BALLS);
  const pouches = state.pouches.map((p) => {
    if (p.id !== pouchId) return p;
    let balls = [...p.balls];
    if (n > balls.length) {
      const color = balls[0]?.color ?? "blue";
      balls = [...balls, ...defaultBalls(n - balls.length, color)];
    } else {
      balls = balls.slice(0, n);
    }
    return { ...p, balls: layoutBallsInPouch(balls) };
  });
  return normalizeState({ ...state, pouches });
}

export function relayoutPouches(state: CountingState): CountingState {
  return { ...state, pouches: layoutPouches(state.pouches) };
}

export function setSliceCount(state: CountingState, count: number): CountingState {
  const n = clamp(count, MIN_SLICES, MAX_SLICES);
  let slices = [...state.spinner.slices];
  if (n > slices.length) {
    slices = [
      ...slices,
      ...defaultSlices(n).slice(slices.length),
    ];
  } else {
    slices = slices.slice(0, n);
  }
  return normalizeState({
    ...state,
    spinner: { ...state.spinner, slices },
  });
}

export function setPlaceCount(state: CountingState, count: number): CountingState {
  const n = clamp(count, MIN_PLACES, MAX_PLACES);
  let places = [...state.paths.places];
  if (n > places.length) {
    const icons: IconId[] = ["library", "park", "mart"];
    for (let i = places.length; i < n; i += 1) {
      places.push({
        id: newId("pl"),
        label: `장소${i + 1}`,
        icon: icons[(i - 3) % icons.length] ?? "plaza",
        x: 0,
        y: 0,
      });
    }
  } else {
    const removed = new Set(places.slice(n).map((p) => p.id));
    places = places.slice(0, n);
    const edges = state.paths.edges.filter(
      (e) => !removed.has(e.from) && !removed.has(e.to),
    );
    return normalizeState({
      ...state,
      paths: { ...state.paths, places: layoutPlaces(places), edges },
    });
  }
  return normalizeState({
    ...state,
    paths: { ...state.paths, places: layoutPlaces(places) },
  });
}

export function setEdgeCount(
  state: CountingState,
  edgeId: string,
  count: number,
): CountingState {
  const n = clamp(count, MIN_PATHS, MAX_PATHS);
  const edges = state.paths.edges.map((e) => {
    if (e.id !== edgeId) return e;
    const bends: number[] = [];
    for (let i = 0; i < n; i += 1) {
      const lane = i - (n - 1) / 2;
      bends.push(e.bends[i] ?? lane * PATH_LANE_SPACING);
    }
    return { ...e, count: n, bends };
  });
  return normalizeState({ ...state, paths: { ...state.paths, edges } });
}

export function addDirectEdge(
  state: CountingState,
  fromId: string,
  toId: string,
): CountingState {
  if (fromId === toId) return state;
  const exists = state.paths.edges.some(
    (e) =>
      (e.from === fromId && e.to === toId) || (e.from === toId && e.to === fromId),
  );
  if (exists) return state;
  const edge: PathEdge = {
    id: newId("e"),
    from: fromId,
    to: toId,
    count: 2,
    color: "green",
    bends: [-PATH_LANE_SPACING, PATH_LANE_SPACING],
  };
  return normalizeState({
    ...state,
    paths: { ...state.paths, edges: [...state.paths.edges, edge] },
  });
}

export function relayoutPaths(state: CountingState): CountingState {
  return normalizeState({
    ...state,
    paths: {
      ...state.paths,
      places: layoutPlaces(state.paths.places),
    },
  });
}

const DEFAULT_PLACES = defaultPlaces();

export const DEFAULT_COUNTING_STATE: CountingState = normalizeState({
  kind: "dice",
  dice: layoutDice(defaultDice(2, [3, 6]), 2),
  diceCols: 2,
  cards: layoutCards(defaultCards(10), 5),
  cardCols: 5,
  pouches: layoutPouches(defaultPouches(2)),
  spinner: { rotation: 0, slices: defaultSlices(8) },
  paths: {
    places: layoutPlaces(DEFAULT_PLACES),
    edges: defaultEdges(DEFAULT_PLACES),
  },
  style: DEFAULT_STYLE,
});

export const COUNTING_PRESETS: {
  id: string;
  title: string;
  hint: string;
  kind: CountingKind;
  apply: (state: CountingState) => CountingState;
}[] = [
  {
    id: "dice-two",
    title: "주사위 2개",
    hint: "3·6",
    kind: "dice",
    apply: (s) =>
      normalizeState({
        ...s,
        kind: "dice",
        dice: layoutDice(defaultDice(2, [3, 6]), 2),
        diceCols: 2,
      }),
  },
  {
    id: "dice-three",
    title: "주사위 3개",
    hint: "1·4·6",
    kind: "dice",
    apply: (s) =>
      normalizeState({
        ...s,
        kind: "dice",
        dice: layoutDice(defaultDice(3, [1, 4, 6]), 3),
        diceCols: 3,
      }),
  },
  {
    id: "cards-ten",
    title: "카드 1–10",
    hint: "10장",
    kind: "cards",
    apply: (s) =>
      normalizeState({
        ...s,
        kind: "cards",
        cards: layoutCards(defaultCards(10), 5),
        cardCols: 5,
      }),
  },
  {
    id: "cards-abc",
    title: "카드 A·B·C",
    hint: "3장",
    kind: "cards",
    apply: (s) =>
      normalizeState({
        ...s,
        kind: "cards",
        cards: layoutCards(defaultCards(3, ["A", "B", "C"]), 3),
        cardCols: 3,
      }),
  },
  {
    id: "pouches-ab",
    title: "주머니 A·B",
    hint: "공 5개씩",
    kind: "pouches",
    apply: (s) =>
      normalizeState({
        ...s,
        kind: "pouches",
        pouches: layoutPouches(defaultPouches(2)),
      }),
  },
  {
    id: "spinner-eight",
    title: "원판 8등분",
    hint: "당첨 6·꽝 2",
    kind: "spinner",
    apply: (s) =>
      normalizeState({
        ...s,
        kind: "spinner",
        spinner: { rotation: 0, slices: defaultSlices(8) },
      }),
  },
  {
    id: "paths-school",
    title: "학교–문구점–집",
    hint: "3·2·2",
    kind: "paths",
    apply: (s) => {
      const places = layoutPlaces([
        { id: newId("pl"), label: "학교", icon: "school", x: 0, y: 0 },
        { id: newId("pl"), label: "문구점", icon: "store", x: 0, y: 0 },
        { id: newId("pl"), label: "집", icon: "home", x: 0, y: 0 },
      ]);
      return normalizeState({
        ...s,
        kind: "paths",
        paths: { ...s.paths, places, edges: defaultEdges(places) },
      });
    },
  },
];

export function applyPreset(
  state: CountingState,
  presetId: string,
): CountingState {
  const preset = COUNTING_PRESETS.find((p) => p.id === presetId);
  if (!preset) return state;
  return preset.apply(state);
}

export function findDice(state: CountingState, id: string): DiceItem | undefined {
  return state.dice.find((d) => d.id === id);
}

export function findCard(state: CountingState, id: string): CardItem | undefined {
  return state.cards.find((c) => c.id === id);
}

export function findPouch(state: CountingState, id: string): PouchItem | undefined {
  return state.pouches.find((p) => p.id === id);
}

export function findBall(
  state: CountingState,
  pouchId: string,
  ballId: string,
): BallItem | undefined {
  return state.pouches.find((p) => p.id === pouchId)?.balls.find((b) => b.id === ballId);
}

export function findSlice(
  state: CountingState,
  id: string,
): SpinnerSlice | undefined {
  return state.spinner.slices.find((s) => s.id === id);
}

export function findPlace(state: CountingState, id: string): PlaceNode | undefined {
  return state.paths.places.find((p) => p.id === id);
}

export function findEdge(state: CountingState, id: string): PathEdge | undefined {
  return state.paths.edges.find((e) => e.id === id);
}

export const PIP_LAYOUT: Record<DieFace, Array<[number, number]>> = {
  1: [[0.5, 0.5]],
  2: [
    [0.28, 0.28],
    [0.72, 0.72],
  ],
  3: [
    [0.26, 0.26],
    [0.5, 0.5],
    [0.74, 0.74],
  ],
  4: [
    [0.28, 0.28],
    [0.72, 0.28],
    [0.28, 0.72],
    [0.72, 0.72],
  ],
  5: [
    [0.26, 0.26],
    [0.74, 0.26],
    [0.5, 0.5],
    [0.26, 0.74],
    [0.74, 0.74],
  ],
  6: [
    [0.3, 0.24],
    [0.7, 0.24],
    [0.3, 0.5],
    [0.7, 0.5],
    [0.3, 0.76],
    [0.7, 0.76],
  ],
};

export const DIE_SIZE = 64;
