import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applySourceAngle,
  applySourceLength,
  bbox,
  figureBPoints,
  moveSourceVertex,
  sourceEdgeLength,
} from "./geometry";
import {
  DEFAULT_SIMILAR_STATE,
  SIMILAR_PRESETS,
  autoLengthB,
  cloneState,
  normalizeState,
  similarScale,
  triangleFromAngles,
} from "./model";
import { buildSimilarFiguresScene } from "./scene";

function almost(a: number, b: number, eps = 1e-6): void {
  assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
}

function sideLengths(pts: { x: number; y: number }[]): number[] {
  return pts.map((p, i) => {
    const q = pts[(i + 1) % pts.length]!;
    return Math.hypot(q.x - p.x, q.y - p.y);
  });
}

describe("similar scale and placement", () => {
  it("scales corresponding sides by the similarity ratio", () => {
    const state = normalizeState(cloneState(DEFAULT_SIMILAR_STATE));
    const a = sideLengths(state.points);
    const b = sideLengths(figureBPoints(state));
    const k = similarScale(state);
    assert.equal(a.length, b.length);
    for (let i = 0; i < a.length; i += 1) {
      almost(b[i]!, a[i]! * k, 1e-6);
    }
  });

  it("places figure B to the right of figure A", () => {
    const state = normalizeState(cloneState(DEFAULT_SIMILAR_STATE));
    const a = bbox(state.points);
    const b = bbox(figureBPoints(state));
    assert.ok(b.minX > a.maxX - 1e-6);
  });

  it("horizontal reflection flips left-right while keeping the ratio", () => {
    const base = normalizeState(cloneState(DEFAULT_SIMILAR_STATE));
    const flipped = normalizeState({ ...base, reflect: "horizontal" });
    const k = similarScale(base);
    const a = sideLengths(base.points);
    const b = sideLengths(figureBPoints(flipped));
    for (let i = 0; i < a.length; i += 1) {
      almost(b[i]!, a[i]! * k, 1e-6);
    }
    const none = figureBPoints(base);
    const left = figureBPoints(flipped);
    assert.notDeepEqual(
      left.map((p) => ({ x: Number(p.x.toFixed(4)), y: Number(p.y.toFixed(4)) })),
      none.map((p) => ({ x: Number(p.x.toFixed(4)), y: Number(p.y.toFixed(4)) })),
    );
  });

  it("90° rotation preserves side lengths", () => {
    const base = normalizeState(cloneState(DEFAULT_SIMILAR_STATE));
    const rotated = normalizeState({ ...base, rotateDeg: 90 });
    const a = sideLengths(figureBPoints(base));
    const b = sideLengths(figureBPoints(rotated));
    for (let i = 0; i < a.length; i += 1) {
      almost(b[i]!, a[i]!, 1e-6);
    }
  });
});

describe("auto length on the copy", () => {
  it("scales a custom length on A by the ratio", () => {
    const state = SIMILAR_PRESETS.find((p) => p.id === "tri-5-4")!.state;
    almost(autoLengthB(state, 0, 99), 4, 1e-9);
    almost(autoLengthB(state, 1, 99), 8, 1e-9);
  });
});

describe("presets", () => {
  it("every preset builds two labeled figures", () => {
    for (const preset of SIMILAR_PRESETS) {
      const state = normalizeState(cloneState(preset.state));
      const scene = buildSimilarFiguresScene(state);
      assert.ok(scene.cmds.length > 2, preset.id);
      assert.equal(scene.layout.canvasA.length, state.points.length, preset.id);
      assert.equal(scene.layout.canvasB.length, state.points.length, preset.id);
      assert.ok(scene.texts.some((t) => t.id.startsWith("a:v:")), preset.id);
      assert.ok(scene.texts.some((t) => t.id.startsWith("b:v:")), preset.id);
      for (const p of [...scene.layout.canvasA, ...scene.layout.canvasB]) {
        assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y), preset.id);
      }
    }
  });

  it("grid preset draws a lattice behind both figures", () => {
    const preset = SIMILAR_PRESETS.find((p) => p.id === "grid-kite")!;
    const scene = buildSimilarFiguresScene(preset.state);
    const grid = scene.cmds.filter((c) => c.t === "line" && c.id === "grid");
    assert.ok(grid.length > 8);
  });

  it("triangleFromAngles matches the 9 cm / 6 cm / 39° example", () => {
    const pts = triangleFromAngles(39, 31, 110, 6);
    const ab = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
    const bc = Math.hypot(pts[1]!.x - pts[2]!.x, pts[1]!.y - pts[2]!.y);
    almost(bc, 6, 1e-6);
    almost(ab, 6 * Math.sin((110 * Math.PI) / 180) / Math.sin((39 * Math.PI) / 180), 1e-6);
  });
});

describe("editing the source", () => {
  it("dragging a vertex of A updates B's size through the same ratio", () => {
    const base = normalizeState(cloneState(DEFAULT_SIMILAR_STATE));
    const k = similarScale(base);
    const moved = moveSourceVertex(base, 0, {
      x: base.points[0]!.x + 0.8,
      y: base.points[0]!.y + 0.4,
    });
    const a = sideLengths(moved.points);
    const b = sideLengths(figureBPoints(moved));
    for (let i = 0; i < a.length; i += 1) {
      almost(b[i]!, a[i]! * k, 1e-6);
    }
  });

  it("changing a source length keeps B similar", () => {
    const base = normalizeState(cloneState(DEFAULT_SIMILAR_STATE));
    const next = applySourceLength(base, 1, sourceEdgeLength(base, 1) * 1.2);
    const k = similarScale(next);
    const a = sideLengths(next.points);
    const b = sideLengths(figureBPoints(next));
    for (let i = 0; i < a.length; i += 1) {
      almost(b[i]!, a[i]! * k, 1e-5);
    }
  });

  it("changing a source angle keeps B similar", () => {
    const base = normalizeState(cloneState(DEFAULT_SIMILAR_STATE));
    const next = applySourceAngle(base, 1, 70);
    const k = similarScale(next);
    const a = sideLengths(next.points);
    const b = sideLengths(figureBPoints(next));
    for (let i = 0; i < a.length; i += 1) {
      almost(b[i]!, a[i]! * k, 1e-5);
    }
  });
});
