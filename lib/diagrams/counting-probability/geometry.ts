import type { CountingHit } from "@/lib/diagrams/counting-probability/scene";
import type { CountingState } from "@/lib/diagrams/counting-probability/model";
import { SCENE_HEIGHT, SCENE_WIDTH } from "@/lib/diagrams/counting-probability/model";

export function canvasToScene(
  canvasX: number,
  canvasY: number,
  canvasW: number,
  canvasH: number,
): { x: number; y: number } {
  const scale = Math.min(canvasW / SCENE_WIDTH, canvasH / SCENE_HEIGHT);
  const ox = (canvasW - SCENE_WIDTH * scale) / 2;
  const oy = (canvasH - SCENE_HEIGHT * scale) / 2;
  return {
    x: (canvasX - ox) / scale,
    y: (canvasY - oy) / scale,
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function moveDice(
  state: CountingState,
  id: string,
  x: number,
  y: number,
): CountingState {
  const pad = 36;
  return {
    ...state,
    dice: state.dice.map((d) =>
      d.id === id
        ? {
            ...d,
            x: clamp(x, pad, SCENE_WIDTH - pad),
            y: clamp(y, pad, SCENE_HEIGHT - pad),
          }
        : d,
    ),
  };
}

export function moveCard(
  state: CountingState,
  id: string,
  x: number,
  y: number,
): CountingState {
  const pad = 30;
  return {
    ...state,
    cards: state.cards.map((c) =>
      c.id === id
        ? {
            ...c,
            x: clamp(x, pad, SCENE_WIDTH - pad),
            y: clamp(y, pad, SCENE_HEIGHT - pad),
          }
        : c,
    ),
  };
}

export function movePouch(
  state: CountingState,
  id: string,
  x: number,
  y: number,
): CountingState {
  const pad = 60;
  const nx = clamp(x, pad, SCENE_WIDTH - pad);
  const ny = clamp(y, pad, SCENE_HEIGHT - pad);
  return {
    ...state,
    pouches: state.pouches.map((p) =>
      p.id === id ? { ...p, x: nx, y: ny } : p,
    ),
  };
}

export function moveBall(
  state: CountingState,
  pouchId: string,
  ballId: string,
  absX: number,
  absY: number,
): CountingState {
  return {
    ...state,
    pouches: state.pouches.map((p) => {
      if (p.id !== pouchId) return p;
      const rx = absX - p.x;
      const ry = absY - p.y;
      return {
        ...p,
        balls: p.balls.map((b) =>
          b.id === ballId
            ? {
                ...b,
                x: clamp(rx, -36, 36),
                y: clamp(ry, -28, 32),
              }
            : b,
        ),
      };
    }),
  };
}

export function movePlace(
  state: CountingState,
  id: string,
  x: number,
  y: number,
): CountingState {
  const pad = 40;
  return {
    ...state,
    paths: {
      ...state.paths,
      places: state.paths.places.map((p) =>
        p.id === id
          ? {
              ...p,
              x: clamp(x, pad, SCENE_WIDTH - pad),
              y: clamp(y, pad, SCENE_HEIGHT - pad),
            }
          : p,
      ),
    },
  };
}

export function setEdgeBend(
  state: CountingState,
  edgeId: string,
  lane: number,
  bend: number,
): CountingState {
  return {
    ...state,
    paths: {
      ...state.paths,
      edges: state.paths.edges.map((e) => {
        if (e.id !== edgeId) return e;
        const bends = [...e.bends];
        bends[lane] = bend;
        return { ...e, bends };
      }),
    },
  };
}

export function patchSelectedText(
  state: CountingState,
  hit: CountingHit,
  text: string,
): CountingState {
  switch (hit.t) {
    case "card":
      return {
        ...state,
        cards: state.cards.map((c) =>
          c.id === hit.id ? { ...c, text } : c,
        ),
      };
    case "ball":
      return {
        ...state,
        pouches: state.pouches.map((p) =>
          p.id === hit.pouchId
            ? {
                ...p,
                balls: p.balls.map((b) =>
                  b.id === hit.id ? { ...b, text } : b,
                ),
              }
            : p,
        ),
      };
    case "slice":
      return {
        ...state,
        spinner: {
          ...state.spinner,
          slices: state.spinner.slices.map((s) =>
            s.id === hit.id ? { ...s, text } : s,
          ),
        },
      };
    case "place":
      return {
        ...state,
        paths: {
          ...state.paths,
          places: state.paths.places.map((p) =>
            p.id === hit.id ? { ...p, label: text } : p,
          ),
        },
      };
    case "pouch":
      return {
        ...state,
        pouches: state.pouches.map((p) =>
          p.id === hit.id ? { ...p, label: text } : p,
        ),
      };
    default:
      return state;
  }
}

export function textIdForHit(hit: CountingHit): string | null {
  switch (hit.t) {
    case "card":
      return `card:${hit.id}`;
    case "ball":
      return `ball:${hit.pouchId}:${hit.id}`;
    case "slice":
      return `slice:${hit.id}`;
    case "place":
      return `place:${hit.id}`;
    case "pouch":
      return `pouch:${hit.id}`;
    default:
      return null;
  }
}

export type DragState =
  | { t: "dice"; id: string; ox: number; oy: number }
  | { t: "card"; id: string; ox: number; oy: number }
  | { t: "pouch"; id: string; ox: number; oy: number }
  | { t: "ball"; pouchId: string; id: string; ox: number; oy: number }
  | { t: "place"; id: string; ox: number; oy: number }
  | { t: "edge"; edgeId: string; lane: number; startBend: number; startY: number };

export function startDrag(
  hit: CountingHit,
  sceneX: number,
  sceneY: number,
  state: CountingState,
): DragState | null {
  switch (hit.t) {
    case "dice": {
      const d = state.dice.find((x) => x.id === hit.id);
      if (!d) return null;
      return { t: "dice", id: hit.id, ox: sceneX - d.x, oy: sceneY - d.y };
    }
    case "card": {
      const c = state.cards.find((x) => x.id === hit.id);
      if (!c) return null;
      return { t: "card", id: hit.id, ox: sceneX - c.x, oy: sceneY - c.y };
    }
    case "pouch": {
      const p = state.pouches.find((x) => x.id === hit.id);
      if (!p) return null;
      return { t: "pouch", id: hit.id, ox: sceneX - p.x, oy: sceneY - p.y };
    }
    case "ball": {
      const p = state.pouches.find((x) => x.id === hit.pouchId);
      const b = p?.balls.find((x) => x.id === hit.id);
      if (!p || !b) return null;
      return {
        t: "ball",
        pouchId: hit.pouchId,
        id: hit.id,
        ox: sceneX - (p.x + b.x),
        oy: sceneY - (p.y + b.y),
      };
    }
    case "place": {
      const pl = state.paths.places.find((x) => x.id === hit.id);
      if (!pl) return null;
      return { t: "place", id: hit.id, ox: sceneX - pl.x, oy: sceneY - pl.y };
    }
    case "edgeControl": {
      const e = state.paths.edges.find((x) => x.id === hit.id);
      if (!e) return null;
      return {
        t: "edge",
        edgeId: hit.id,
        lane: hit.lane,
        startBend: e.bends[hit.lane] ?? 0,
        startY: sceneY,
      };
    }
    default:
      return null;
  }
}

export function applyDrag(
  drag: DragState,
  sceneX: number,
  sceneY: number,
  state: CountingState,
): CountingState {
  switch (drag.t) {
    case "dice":
      return moveDice(state, drag.id, sceneX - drag.ox, sceneY - drag.oy);
    case "card":
      return moveCard(state, drag.id, sceneX - drag.ox, sceneY - drag.oy);
    case "pouch":
      return movePouch(state, drag.id, sceneX - drag.ox, sceneY - drag.oy);
    case "ball":
      return moveBall(
        state,
        drag.pouchId,
        drag.id,
        sceneX - drag.ox,
        sceneY - drag.oy,
      );
    case "place":
      return movePlace(state, drag.id, sceneX - drag.ox, sceneY - drag.oy);
    case "edge":
      return setEdgeBend(
        state,
        drag.edgeId,
        drag.lane,
        drag.startBend + (sceneY - drag.startY),
      );
    default:
      return state;
  }
}

export function isTextEditableHit(hit: CountingHit): boolean {
  return (
    hit.t === "card" ||
    hit.t === "ball" ||
    hit.t === "slice" ||
    hit.t === "place" ||
    hit.t === "pouch"
  );
}

export function isDraggableHit(hit: CountingHit): boolean {
  return (
    hit.t === "dice" ||
    hit.t === "card" ||
    hit.t === "pouch" ||
    hit.t === "ball" ||
    hit.t === "place" ||
    hit.t === "edgeControl"
  );
}

export function selectionFromHit(hit: CountingHit | null): string | null {
  if (!hit) return null;
  switch (hit.t) {
    case "dice":
      return `dice:${hit.id}`;
    case "card":
      return `card:${hit.id}`;
    case "pouch":
      return `pouch:${hit.id}`;
    case "ball":
      return `ball:${hit.pouchId}:${hit.id}`;
    case "slice":
      return `slice:${hit.id}`;
    case "place":
      return `place:${hit.id}`;
    case "edge":
    case "edgeControl":
      return `edge:${hit.id}`;
    default:
      return null;
  }
}

export function parseSelection(sel: string | null): CountingHit | null {
  if (!sel) return null;
  const parts = sel.split(":");
  if (parts[0] === "dice" && parts[1]) return { t: "dice", id: parts[1] };
  if (parts[0] === "card" && parts[1]) return { t: "card", id: parts[1] };
  if (parts[0] === "pouch" && parts[1]) return { t: "pouch", id: parts[1] };
  if (parts[0] === "ball" && parts[1] && parts[2])
    return { t: "ball", pouchId: parts[1], id: parts[2] };
  if (parts[0] === "slice" && parts[1]) return { t: "slice", id: parts[1] };
  if (parts[0] === "place" && parts[1]) return { t: "place", id: parts[1] };
  if (parts[0] === "edge" && parts[1]) return { t: "edge", id: parts[1], lane: 0 };
  return null;
}
