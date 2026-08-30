import { appendIconCmds } from "@/lib/diagrams/counting-probability/icons";
import {
  BALL_RADIUS,
  COLORS,
  defaultEdgeBend,
  DIE_SIZE,
  edgeFrame,
  edgeLaneMidpoint,
  PATH_LANE_SPACING,
  PIP_LAYOUT,
  POUCH_BODY_H,
  POUCH_BODY_W,
  SCENE_HEIGHT,
  SCENE_WIDTH,
  type BallItem,
  type CardItem,
  type CountingState,
  type DiceItem,
  type PathEdge,
  type PlaceNode,
  type PouchItem,
} from "@/lib/diagrams/counting-probability/model";
import { parseNameRuns } from "@/lib/diagrams/math-label";
import type { DiagramScene, SceneCmd, SceneText, Vec } from "@/lib/diagrams/scene";

const INK = "#111111";
const CARD_W = 52;
const CARD_H = 72;
const CARD_R = 10;
const POUCH_W = POUCH_BODY_W;
const POUCH_H = POUCH_BODY_H;
const RIBBON = "#c03030";

export type CountingHit =
  | { t: "dice"; id: string }
  | { t: "card"; id: string }
  | { t: "pouch"; id: string }
  | { t: "ball"; pouchId: string; id: string }
  | { t: "slice"; id: string }
  | { t: "place"; id: string }
  | { t: "edge"; id: string; lane: number }
  | { t: "edgeControl"; id: string; lane: number };

export type CountingScene = DiagramScene & {
  hits: CountingHitRegion[];
  uiControls?: UiControl[];
};

export type CountingHitRegion = CountingHit & {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type UiControl = {
  id: string;
  edgeId: string;
  action: "inc" | "dec" | "label";
  x: number;
  y: number;
  r: number;
  text?: string;
};

function pushText(texts: SceneText[], cmds: SceneCmd[], text: SceneText): void {
  texts.push(text);
  cmds.push({ t: "text", text });
}

export function buildCountingScene(
  state: CountingState,
  selected: string | null = null,
): CountingScene {
  const cmds: SceneCmd[] = [];
  const texts: SceneText[] = [];
  const hits: CountingHitRegion[] = [];
  const uiControls: UiControl[] = [];

  switch (state.kind) {
    case "dice":
      buildDiceScene(state, cmds, hits, selected);
      break;
    case "cards":
      buildCardsScene(state, cmds, texts, hits, selected);
      break;
    case "pouches":
      buildPouchesScene(state, cmds, texts, hits, selected);
      break;
    case "spinner":
      buildSpinnerScene(state, cmds, texts, hits, selected);
      break;
    case "paths":
      buildPathsScene(state, cmds, texts, hits, uiControls, selected);
      break;
    default:
      break;
  }

  return {
    width: SCENE_WIDTH,
    height: SCENE_HEIGHT,
    cmds,
    texts,
    hits,
    uiControls,
  };
}

function addDie(
  die: DiceItem,
  cmds: SceneCmd[],
  hits: CountingHitRegion[],
  selected: boolean,
): void {
  const half = DIE_SIZE / 2;
  const colors = COLORS[die.color];
  const cx = die.x;
  const cy = die.y;

  cmds.push({
    t: "roundRect",
    x: cx - half,
    y: cy - half,
    w: DIE_SIZE,
    h: DIE_SIZE,
    r: 14,
    fill: colors.fill,
    stroke: selected ? INK : colors.stroke,
    width: selected ? 2.5 : 1.2,
  });

  const pipR = DIE_SIZE * 0.07;
  for (const [px, py] of PIP_LAYOUT[die.face]) {
    const x = cx + (px - 0.5) * DIE_SIZE * 0.72;
    const y = cy + (py - 0.5) * DIE_SIZE * 0.72;
    cmds.push({ t: "dot", x, y, r: pipR, stroke: "#ffffff" });
  }

  hits.push({
    t: "dice",
    id: die.id,
    x: cx - half,
    y: cy - half,
    w: DIE_SIZE,
    h: DIE_SIZE,
  });
}

function buildDiceScene(
  state: CountingState,
  cmds: SceneCmd[],
  hits: CountingHitRegion[],
  selected: string | null,
): void {
  for (const die of state.dice) {
    addDie(die, cmds, hits, selected === `dice:${die.id}`);
  }
}

function buildCardsScene(
  state: CountingState,
  cmds: SceneCmd[],
  texts: SceneText[],
  hits: CountingHitRegion[],
  selected: string | null,
): void {
  for (const card of state.cards) {
    addCard(
      card,
      cmds,
      texts,
      hits,
      selected === `card:${card.id}`,
      state.style.fontSize,
    );
  }
}

function addCard(
  card: CardItem,
  cmds: SceneCmd[],
  texts: SceneText[],
  hits: CountingHitRegion[],
  selected: boolean,
  fontSize: number,
): void {
  const colors = COLORS[card.color];
  const x = card.x - CARD_W / 2;
  const y = card.y - CARD_H / 2;
  cmds.push({
    t: "roundRect",
    x,
    y,
    w: CARD_W,
    h: CARD_H,
    r: CARD_R,
    fill: colors.light,
    stroke: selected ? INK : colors.stroke,
    width: selected ? 2.5 : 1.8,
    dashed: true,
  });
  pushText(texts, cmds, {
    id: `card:${card.id}`,
    x: card.x,
    y: card.y,
    runs: parseNameRuns(card.text || "?"),
    size: fontSize,
    anchor: "middle",
    fill: INK,
  });
  hits.push({ t: "card", id: card.id, x, y, w: CARD_W, h: CARD_H });
}

function pouchBodyPoints(cx: number, cy: number): Vec[] {
  const hw = POUCH_W * 0.48;
  const hh = POUCH_H * 0.46;
  return [
    { x: cx - hw * 0.38, y: cy - hh * 0.58 },
    { x: cx - hw * 0.52, y: cy - hh * 0.38 },
    { x: cx - hw * 0.98, y: cy - hh * 0.02 },
    { x: cx - hw * 0.82, y: cy + hh * 0.62 },
    { x: cx, y: cy + hh * 0.78 },
    { x: cx + hw * 0.82, y: cy + hh * 0.62 },
    { x: cx + hw * 0.98, y: cy - hh * 0.02 },
    { x: cx + hw * 0.52, y: cy - hh * 0.38 },
    { x: cx + hw * 0.38, y: cy - hh * 0.58 },
  ];
}

function pouchNeckPoints(cx: number, cy: number): Vec[] {
  const hw = POUCH_W * 0.48;
  const hh = POUCH_H * 0.46;
  const ny = cy - hh * 0.42;
  return [
    { x: cx - hw * 0.38, y: ny },
    { x: cx - hw * 0.22, y: ny - hh * 0.12 },
    { x: cx + hw * 0.22, y: ny - hh * 0.12 },
    { x: cx + hw * 0.38, y: ny },
  ];
}

function drawPouchRibbon(cx: number, cy: number, cmds: SceneCmd[]): void {
  const hh = POUCH_H * 0.46;
  const ny = cy - hh * 0.42;
  const bowY = ny - hh * 0.1;
  cmds.push({
    t: "line",
    x1: cx - POUCH_W * 0.22,
    y1: ny,
    x2: cx + POUCH_W * 0.22,
    y2: ny,
    stroke: RIBBON,
    width: 2.4,
  });
  cmds.push({
    t: "circle",
    x: cx - 10,
    y: bowY,
    r: 7,
    stroke: RIBBON,
    width: 2,
  });
  cmds.push({
    t: "circle",
    x: cx + 10,
    y: bowY,
    r: 7,
    stroke: RIBBON,
    width: 2,
  });
  cmds.push({ t: "dot", x: cx, y: bowY, r: 4, stroke: RIBBON });
  cmds.push({
    t: "line",
    x1: cx - 10,
    y1: bowY,
    x2: cx - 18,
    y2: bowY + 10,
    stroke: RIBBON,
    width: 1.6,
  });
  cmds.push({
    t: "line",
    x1: cx + 10,
    y1: bowY,
    x2: cx + 18,
    y2: bowY + 10,
    stroke: RIBBON,
    width: 1.6,
  });
}

function buildPouchesScene(
  state: CountingState,
  cmds: SceneCmd[],
  texts: SceneText[],
  hits: CountingHitRegion[],
  selected: string | null,
): void {
  for (const pouch of state.pouches) {
    addPouch(
      pouch,
      cmds,
      texts,
      hits,
      selected === `pouch:${pouch.id}`,
      state.style.fontSize,
      selected,
    );
  }
}

function addPouch(
  pouch: PouchItem,
  cmds: SceneCmd[],
  texts: SceneText[],
  hits: CountingHitRegion[],
  selected: boolean,
  fontSize: number,
  selectedKey: string | null,
): void {
  const cx = pouch.x;
  const cy = pouch.y;
  const body = pouchBodyPoints(cx, cy);
  const neck = pouchNeckPoints(cx, cy);

  cmds.push({
    t: "ellipseArc",
    cx,
    cy: cy + POUCH_H * 0.34,
    ux: POUCH_W * 0.34,
    uy: 0,
    vx: 0,
    vy: 10,
    a0: 0,
    a1: Math.PI,
    stroke: "rgba(0,0,0,0.08)",
    width: 1,
  });

  cmds.push({ t: "polygon", points: body, fill: COLORS.beige.fill });
  cmds.push({
    t: "polygon",
    points: [
      { x: cx - POUCH_W * 0.3, y: cy + POUCH_H * 0.08 },
      { x: cx + POUCH_W * 0.3, y: cy + POUCH_H * 0.08 },
      { x: cx + POUCH_W * 0.18, y: cy + POUCH_H * 0.38 },
      { x: cx - POUCH_W * 0.18, y: cy + POUCH_H * 0.38 },
    ],
    fill: "rgba(192,168,128,0.18)",
  });

  hits.push({
    t: "pouch",
    id: pouch.id,
    x: cx - POUCH_W / 2,
    y: cy - POUCH_H / 2,
    w: POUCH_W,
    h: POUCH_H + 28,
  });

  for (const ball of pouch.balls) {
    addBall(
      pouch.id,
      ball,
      cx,
      cy,
      cmds,
      texts,
      hits,
      selectedKey === `ball:${pouch.id}:${ball.id}`,
      fontSize * 0.85,
    );
  }

  cmds.push({ t: "polygon", points: neck, fill: COLORS.beige.fill });
  cmds.push({
    t: "polyline",
    pts: neck,
    stroke: COLORS.beige.stroke,
    width: 1.2,
  });

  drawPouchRibbon(cx, cy, cmds);

  cmds.push({
    t: "polyline",
    pts: body,
    stroke: selected ? INK : COLORS.beige.stroke,
    width: selected ? 2.4 : 1.6,
  });

  pushText(texts, cmds, {
    id: `pouch:${pouch.id}`,
    x: cx,
    y: cy + POUCH_H * 0.52,
    runs: parseNameRuns(pouch.label),
    size: fontSize + 2,
    anchor: "middle",
    fill: INK,
  });
}

function addBall(
  pouchId: string,
  ball: BallItem,
  pouchCx: number,
  pouchCy: number,
  cmds: SceneCmd[],
  texts: SceneText[],
  hits: CountingHitRegion[],
  selected: boolean,
  fontSize: number,
): void {
  const x = pouchCx + ball.x;
  const y = pouchCy + ball.y;
  const r = BALL_RADIUS;
  const colors = COLORS[ball.color];
  cmds.push({ t: "dot", x, y, r, stroke: colors.fill });
  cmds.push({
    t: "circle",
    x,
    y,
    r,
    stroke: selected ? INK : colors.stroke,
    width: selected ? 2.4 : 1.2,
  });
  if (ball.text.trim()) {
    pushText(texts, cmds, {
      id: `ball:${pouchId}:${ball.id}`,
      x,
      y,
      runs: parseNameRuns(ball.text),
      size: fontSize,
      anchor: "middle",
      fill: ball.color === "white" || ball.color === "yellow" ? INK : "#ffffff",
    });
  }
  hits.push({
    t: "ball",
    pouchId,
    id: ball.id,
    x: x - r - 2,
    y: y - r - 2,
    w: (r + 2) * 2,
    h: (r + 2) * 2,
  });
}

function buildSpinnerScene(
  state: CountingState,
  cmds: SceneCmd[],
  texts: SceneText[],
  hits: CountingHitRegion[],
  selected: string | null,
): void {
  const cx = SCENE_WIDTH / 2;
  const cy = SCENE_HEIGHT / 2 + 10;
  const r = 130;
  const n = state.spinner.slices.length;
  const rot = state.spinner.rotation - Math.PI / 2;
  const step = (Math.PI * 2) / n;

  for (let i = 0; i < n; i += 1) {
    const slice = state.spinner.slices[i]!;
    const a0 = rot + i * step;
    const a1 = a0 + step;
    const colors = COLORS[slice.color];
    cmds.push({
      t: "sector",
      cx,
      cy,
      r,
      a0,
      a1,
      ccw: false,
      fill: colors.light,
    });
  }

  for (let i = 0; i < n; i += 1) {
    const a = rot + i * step;
    cmds.push({
      t: "line",
      x1: cx,
      y1: cy,
      x2: cx + Math.cos(a) * r,
      y2: cy + Math.sin(a) * r,
      stroke: INK,
      width: 2,
    });
  }

  cmds.push({ t: "circle", x: cx, y: cy, r, stroke: INK, width: 2 });

  for (let i = 0; i < n; i += 1) {
    const slice = state.spinner.slices[i]!;
    const a0 = rot + i * step;
    const a1 = a0 + step;
    const isSelected = selected === `slice:${slice.id}`;
    if (isSelected) {
      cmds.push({
        t: "arc",
        cx,
        cy,
        r,
        a0,
        a1,
        ccw: false,
        stroke: COLORS[slice.color].stroke,
        width: 4,
      });
    }
    const mid = (a0 + a1) / 2;
    const tx = cx + Math.cos(mid) * r * 0.62;
    const ty = cy + Math.sin(mid) * r * 0.62;
    pushText(texts, cmds, {
      id: `slice:${slice.id}`,
      x: tx,
      y: ty,
      runs: parseNameRuns(slice.text),
      size: state.style.fontSize,
      anchor: "middle",
      fill: INK,
    });
    const hx = cx + Math.cos(mid) * r * 0.45;
    const hy = cy + Math.sin(mid) * r * 0.45;
    hits.push({
      t: "slice",
      id: slice.id,
      x: hx - 30,
      y: hy - 16,
      w: 60,
      h: 32,
    });
  }

  cmds.push({ t: "dot", x: cx, y: cy, r: 6, stroke: "#6ec86e" });
  cmds.push({
    t: "arrowhead",
    x: cx,
    y: cy - r - 8,
    ux: 0,
    uy: -1,
    size: 18,
    stroke: "#e04040",
  });
}

function placeById(places: PlaceNode[], id: string): PlaceNode | undefined {
  return places.find((p) => p.id === id);
}

function buildPathsScene(
  state: CountingState,
  cmds: SceneCmd[],
  texts: SceneText[],
  hits: CountingHitRegion[],
  uiControls: UiControl[],
  selected: string | null,
): void {
  const places = state.paths.places;
  for (const edge of state.paths.edges) {
    const a = placeById(places, edge.from);
    const b = placeById(places, edge.to);
    if (!a || !b) continue;
    addPathEdge(
      edge,
      a,
      b,
      cmds,
      hits,
      uiControls,
      selected === `edge:${edge.id}`,
    );
  }
  for (const place of places) {
    addPlace(
      place,
      cmds,
      texts,
      hits,
      state.paths.labelFontSize,
      state.paths.showPlaceLabels,
      selected === `place:${place.id}`,
    );
  }
}

function addPathEdge(
  edge: PathEdge,
  a: PlaceNode,
  b: PlaceNode,
  cmds: SceneCmd[],
  hits: CountingHitRegion[],
  uiControls: UiControl[],
  selected: boolean,
): void {
  const colors = COLORS[edge.color];
  const frame = edgeFrame(a, b);
  const { nx, ny, direct } = frame;
  const pathLift = 28;

  for (let i = 0; i < edge.count; i += 1) {
    const bend = edge.bends[i] ?? defaultEdgeBend(edge.count, i);
    const lane = edgeLaneMidpoint(a, b, bend);
    const mx = lane.x;
    const my = lane.y;
    const curveCy = my - pathLift;

    if (direct && Math.abs(bend) < 10) {
      cmds.push({
        t: "line",
        x1: a.x,
        y1: a.y - pathLift,
        x2: b.x,
        y2: b.y - pathLift,
        stroke: colors.stroke,
        width: selected ? 3 : 2,
      });
    } else {
      cmds.push({
        t: "quad",
        x1: a.x,
        y1: a.y - pathLift + 4,
        cx: mx,
        cy: curveCy,
        x2: b.x,
        y2: b.y - pathLift + 4,
        stroke: colors.stroke,
        width: selected ? 3 : 2,
      });
    }

    if (selected) {
      cmds.push({
        t: "circle",
        x: mx,
        y: curveCy,
        r: 7,
        stroke: colors.stroke,
        width: 2,
      });
      cmds.push({ t: "dot", x: mx, y: curveCy, r: 4, stroke: colors.fill });
    }

    const hitW = 72;
    const hitH = 52;
    hits.push({
      t: "edge",
      id: edge.id,
      lane: i,
      x: mx - hitW / 2,
      y: curveCy - hitH / 2,
      w: hitW,
      h: hitH,
    });
    hits.push({
      t: "edgeControl",
      id: edge.id,
      lane: i,
      x: mx - 14,
      y: curveCy - 14,
      w: 28,
      h: 28,
    });
  }

  if (!selected) return;

  const midLane = Math.floor((edge.count - 1) / 2);
  const midBend = edge.bends[midLane] ?? defaultEdgeBend(edge.count, midLane);
  const anchor = edgeLaneMidpoint(a, b, midBend);
  const panelX = anchor.x + nx * 8;
  const panelY = anchor.y + ny * 8 - pathLift - 36;
  const btnR = 15;

  uiControls.push({
    id: `${edge.id}-cap`,
    edgeId: edge.id,
    action: "label",
    x: panelX,
    y: panelY - 18,
    r: 0,
    text: `${a.label} → ${b.label}`,
  });
  uiControls.push({
    id: `${edge.id}-dec`,
    edgeId: edge.id,
    action: "dec",
    x: panelX - 42,
    y: panelY,
    r: btnR,
  });
  uiControls.push({
    id: `${edge.id}-count`,
    edgeId: edge.id,
    action: "label",
    x: panelX,
    y: panelY,
    r: 0,
    text: `${edge.count}개`,
  });
  uiControls.push({
    id: `${edge.id}-inc`,
    edgeId: edge.id,
    action: "inc",
    x: panelX + 42,
    y: panelY,
    r: btnR,
  });
}

function addPlace(
  place: PlaceNode,
  cmds: SceneCmd[],
  texts: SceneText[],
  hits: CountingHitRegion[],
  labelFontSize: number,
  showPlaceLabels: boolean,
  selected: boolean,
): void {
  appendIconCmds(cmds, place.icon, place.x, place.y - 18, 56);
  if (selected) {
    cmds.push({
      t: "roundRect",
      x: place.x - 34,
      y: place.y - 42,
      w: 68,
      h: 86,
      r: 10,
      stroke: INK,
      width: 2,
    });
  }
  if (showPlaceLabels && place.label.trim()) {
    pushText(texts, cmds, {
      id: `place:${place.id}`,
      x: place.x,
      y: place.y + 34,
      runs: parseNameRuns(place.label),
      size: labelFontSize,
      anchor: "middle",
      fill: INK,
    });
  }
  const hitH = showPlaceLabels && place.label.trim() ? 80 : 56;
  hits.push({
    t: "place",
    id: place.id,
    x: place.x - 32,
    y: place.y - 40,
    w: 64,
    h: hitH,
  });
}

export function hitTestCounting(
  scene: CountingScene,
  x: number,
  y: number,
): CountingHit | null {
  for (let i = scene.hits.length - 1; i >= 0; i -= 1) {
    const h = scene.hits[i]!;
    if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) {
      const { x: _x, y: _y, w: _w, h: _hh, ...hit } = h;
      return hit;
    }
  }
  return null;
}

export function hitTestUiControl(
  scene: CountingScene,
  x: number,
  y: number,
): UiControl | null {
  for (const c of scene.uiControls ?? []) {
    if (c.action === "label") continue;
    if (Math.hypot(x - c.x, y - c.y) <= c.r + 6) return c;
  }
  return null;
}

export { SCENE_WIDTH, SCENE_HEIGHT };
