import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  angleDeg,
  derivedPoints,
  figureStrokes,
  movePoint,
  snapKind,
  triangleOk,
} from "./geometry";
import {
  DEFAULT_SIMILAR_STATE,
  SIMILAR_PRESETS,
  cloneState,
  normalizeState,
  withKind,
} from "./model";

function almost(a: number, b: number, eps = 1e-6): void {
  assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
}

function parallel(u: { x: number; y: number }, v: { x: number; y: number }, eps = 1e-6): boolean {
  return Math.abs(u.x * v.y - u.y * v.x) < eps;
}

describe("nested DE ∥ BC", () => {
  it("places D,E by t so DE is parallel to BC", () => {
    const state = normalizeState(cloneState(DEFAULT_SIMILAR_STATE));
    const p = derivedPoints(state);
    const de = { x: p.E!.x - p.D!.x, y: p.E!.y - p.D!.y };
    const bc = { x: p.C!.x - p.B!.x, y: p.C!.y - p.B!.y };
    assert.ok(parallel(de, bc));
    almost(state.t, 1 / 3, 1e-9);
  });

  it("dragging D updates t and keeps E on AC", () => {
    const state = normalizeState(cloneState(DEFAULT_SIMILAR_STATE));
    const p0 = derivedPoints(state);
    const target = {
      x: p0.A!.x + 0.6 * (p0.B!.x - p0.A!.x),
      y: p0.A!.y + 0.6 * (p0.B!.y - p0.A!.y),
    };
    const next = movePoint(state, "D", target);
    almost(next.t, 0.6, 1e-6);
    const p = derivedPoints(next);
    const tE =
      Math.abs(p.C!.x - p.A!.x) > 1e-9
        ? (p.E!.x - p.A!.x) / (p.C!.x - p.A!.x)
        : (p.E!.y - p.A!.y) / (p.C!.y - p.A!.y);
    almost(tE, 0.6, 1e-6);
  });

  it("midpoint locks t = 1/2", () => {
    const state = normalizeState({ ...DEFAULT_SIMILAR_STATE, midpoint: true, t: 0.2 });
    const p = derivedPoints(state);
    const ad = Math.hypot(p.D!.x - p.A!.x, p.D!.y - p.A!.y);
    const db = Math.hypot(p.B!.x - p.D!.x, p.B!.y - p.D!.y);
    almost(ad, db, 1e-6);
  });
});

describe("altitude right triangle", () => {
  it("keeps a right angle at A and AD ⊥ BC", () => {
    const preset = SIMILAR_PRESETS.find((p) => p.id === "alt-hyp")!.state;
    const snapped = snapKind(preset);
    const p = derivedPoints(snapped);
    almost(angleDeg(p.B!, p.A!, p.C!), 90, 1e-4);
    almost(angleDeg(p.A!, p.D!, p.C!), 90, 1e-4);
  });
});

describe("centroid", () => {
  it("G divides each median 2:1 and D is the midpoint of BC", () => {
    const state = withKind(DEFAULT_SIMILAR_STATE, "centroid");
    const p = derivedPoints(state);
    almost(p.D!.x, (p.B!.x + p.C!.x) / 2, 1e-9);
    almost(p.D!.y, (p.B!.y + p.C!.y) / 2, 1e-9);
    const ag = Math.hypot(p.G!.x - p.A!.x, p.G!.y - p.A!.y);
    const gd = Math.hypot(p.D!.x - p.G!.x, p.D!.y - p.G!.y);
    almost(ag / gd, 2, 1e-6);
  });
});

describe("bowtie parallel", () => {
  it("ED ∥ BC when bowtieParallel is on", () => {
    const preset = SIMILAR_PRESETS.find((p) => p.id === "bowtie-par")!.state;
    const p = derivedPoints(preset);
    const ed = { x: p.D!.x - p.E!.x, y: p.D!.y - p.E!.y };
    const bc = { x: p.C!.x - p.B!.x, y: p.C!.y - p.B!.y };
    assert.ok(parallel(ed, bc, 1e-6));
  });
});

describe("presets", () => {
  it("every preset is a valid triangle or parallels figure", () => {
    for (const preset of SIMILAR_PRESETS) {
      const state = normalizeState(cloneState(preset.state));
      const p = derivedPoints(state);
      const strokes = figureStrokes(state);
      assert.ok(strokes.length >= 2, preset.id);
      if (state.kind !== "parallels") {
        assert.ok(triangleOk(p.A!, p.B!, p.C!), preset.id);
      } else {
        assert.ok(p.T0L && p.T0N && p.T1L);
      }
      const shown = state.segs.filter((s) => s.show);
      assert.ok(shown.length >= 0);
    }
  });
});
