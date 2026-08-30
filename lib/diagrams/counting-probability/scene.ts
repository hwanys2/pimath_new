import { appendIconCmds } from "@/lib/diagrams/counting-probability/icons";
import {
  COLORS,
  DIE_SIZE,
  PIP_LAYOUT,
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
import type { DiagramScene, SceneCmd, SceneText } from "@/lib/diagrams/scene";

const INK = "#111111";
const CARD_W = 52;
const CARD_H = 72;
const CARD_R = 10;
const POUCH_W = 90;
const POUCH_H = 100;

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
  action: "inc" | "dec";
  x: number;
  y: number;
  r: number;
};

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
  const rad = (die.rotation * Math.PI) / 180;
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
    const lx = (px - 0.5) * DIE_SIZE * 0.72;
    const ly = (py - 0.5) * DIE_SIZE * 0.72;
    const x = cx + lx * Math.cos(rad) - ly * Math.sin(rad);
    const y = cy + lx * Math.sin(rad) + ly * Math.cos(rad);
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
  texts.push({
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

function pouchPolygon(cx: number, cy: number): { x: number; y: number }[] {
  const hw = POUCH_W / 2;
  const hh = POUCH_H / 2;
  return [
    { x: cx - hw * 0.85, y: cy - hh * 0.15 },
    { x: cx + hw * 0.85, y: cy - hh * 0.15 },
    { x: cx + hw * 0.75, y: cy + hh * 0.55 },
    { x: cx - hw * 0.75, y: cy + hh * 0.55 },
  ];
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
  const pts = pouchPolygon(cx, cy);
  cmds.push({ t: "polygon", points: pts, fill: COLORS.beige.fill });
  cmds.push({
    t: "polyline",
    pts,
    stroke: selected ? INK : COLORS.beige.stroke,
    width: selected ? 2.2 : 1.4,
  });
  cmds.push({
    t: "line",
    x1: cx - 28,
    y1: cy - POUCH_H * 0.15,
    x2: cx + 28,
    y2: cy - POUCH_H * 0.15,
    stroke: "#c03030",
    width: 2,
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
  texts.push({
    id: `pouch:${pouch.id}`,
    x: cx,
    y: cy + POUCH_H * 0.72,
    runs: parseNameRuns(pouch.label),
    size: fontSize + 2,
    anchor: "middle",
    fill: INK,
  });
  hits.push({
    t: "pouch",
    id: pouch.id,
    x: cx - POUCH_W / 2,
    y: cy - POUCH_H / 2,
    w: POUCH_W,
    h: POUCH_H + 24,
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
  const r = 14;
  const colors = COLORS[ball.color];
  cmds.push({ t: "dot", x, y, r, stroke: colors.fill });
  cmds.push({
    t: "circle",
    x,
    y,
    r,
    stroke: selected ? INK : colors.stroke,
    width: selected ? 2 : 1.2,
  });
  texts.push({
    id: `ball:${pouchId}:${ball.id}`,
    x,
    y,
    runs: parseNameRuns(ball.text || "?"),
    size: fontSize,
    anchor: "middle",
    fill: ball.color === "white" ? INK : "#ffffff",
  });
  hits.push({
    t: "ball",
    pouchId,
    id: ball.id,
    x: x - r,
    y: y - r,
    w: r * 2,
    h: r * 2,
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
    cmds.push({
      t: "arc",
      cx,
      cy,
      r,
      a0,
      a1,
      ccw: false,
      stroke: selected === `slice:${slice.id}` ? INK : "#ffffff",
      width: selected === `slice:${slice.id}` ? 3 : 2,
    });
    const mid = (a0 + a1) / 2;
    const tx = cx + Math.cos(mid) * r * 0.62;
    const ty = cy + Math.sin(mid) * r * 0.62;
    texts.push({
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

  cmds.push({ t: "circle", x: cx, y: cy, r, stroke: INK, width: 1.5 });
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
      state.style.fontSize,
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
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const direct = Math.abs(dx) > Math.abs(dy) * 1.2;

  for (let i = 0; i < edge.count; i += 1) {
    const bend = edge.bends[i] ?? (i - (edge.count - 1) / 2) * 28;
    const mx = (a.x + b.x) / 2 + nx * bend;
    const my = (a.y + b.y) / 2 + ny * bend;
    if (direct && Math.abs(bend) < 8) {
      cmds.push({
        t: "line",
        x1: a.x,
        y1: a.y - 28,
        x2: b.x,
        y2: b.y - 28,
        stroke: colors.stroke,
        width: selected ? 2.8 : 2,
      });
    } else {
      cmds.push({
        t: "quad",
        x1: a.x,
        y1: a.y - 24,
        cx: mx,
        cy: my - 24,
        x2: b.x,
        y2: b.y - 24,
        stroke: colors.stroke,
        width: selected ? 2.8 : 2,
      });
    }
    hits.push({
      t: "edge",
      id: edge.id,
      lane: i,
      x: mx - 20,
      y: my - 36,
      w: 40,
      h: 40,
    });
    hits.push({
      t: "edgeControl",
      id: edge.id,
      lane: i,
      x: mx - 8,
      y: my - 32,
      w: 16,
      h: 16,
    });
  }

  const midX = (a.x + b.x) / 2;
  const midY = Math.min(a.y, b.y) - 70;
  uiControls.push({
    id: `${edge.id}-dec`,
    edgeId: edge.id,
    action: "dec",
    x: midX - 28,
    y: midY,
    r: 12,
  });
  uiControls.push({
    id: `${edge.id}-inc`,
    edgeId: edge.id,
    action: "inc",
    x: midX + 28,
    y: midY,
    r: 12,
  });
}

function addPlace(
  place: PlaceNode,
  cmds: SceneCmd[],
  texts: SceneText[],
  hits: CountingHitRegion[],
  fontSize: number,
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
  texts.push({
    id: `place:${place.id}`,
    x: place.x,
    y: place.y + 34,
    runs: parseNameRuns(place.label),
    size: fontSize,
    anchor: "middle",
    fill: INK,
  });
  hits.push({
    t: "place",
    id: place.id,
    x: place.x - 32,
    y: place.y - 40,
    w: 64,
    h: 80,
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
    if (Math.hypot(x - c.x, y - c.y) <= c.r + 4) return c;
  }
  return null;
}

export { SCENE_WIDTH, SCENE_HEIGHT };
