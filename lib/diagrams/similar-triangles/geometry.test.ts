import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  angleDeg,
  applyEditedLabel,
  applySegLength,
  derivedPoints,
  figureStrokes,
  hitTestSimilar,
  movePoint,
  moveSlide,
  nudgeLabel,
  segDimAxes,
  snapKind,
  triangleOk,
} from "./geometry";
import {
  DEFAULT_SIMILAR_STATE,
  SIMILAR_PRESETS,
  cloneState,
  findSeg,
  normalizeState,
  withKind,
} from "./model";
import { buildSimilarTrianglesScene } from "./scene";

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

describe("drag updates numeric labels", () => {
  it("rewrites custom AD length after D moves", () => {
    const state = normalizeState(cloneState(DEFAULT_SIMILAR_STATE));
    const p0 = derivedPoints(state);
    const target = {
      x: p0.A!.x + 0.55 * (p0.B!.x - p0.A!.x),
      y: p0.A!.y + 0.55 * (p0.B!.y - p0.A!.y),
    };
    const next = movePoint(state, "D", target);
    const ad = findSeg(next, "AD")!;
    assert.equal(ad.label.mode, "custom");
    const shown = Number(ad.label.custom.replace(/[^\d.+-]/g, ""));
    const actual = Math.hypot(
      derivedPoints(next).D!.x - next.A.x,
      derivedPoints(next).D!.y - next.A.y,
    );
    almost(shown, actual, 0.02);
  });

  it("keeps unknown x when dragging", () => {
    const state = normalizeState(cloneState(DEFAULT_SIMILAR_STATE));
    const next = movePoint(state, "B", { x: state.B.x - 0.4, y: state.B.y });
    const de = findSeg(next, "DE")!;
    assert.equal(de.label.mode, "x");
    assert.equal(de.label.custom, "x");
  });
});

describe("typed lengths reshape the figure", () => {
  it("sets nested AD to the typed length", () => {
    const state = normalizeState(cloneState(DEFAULT_SIMILAR_STATE));
    const next = applyEditedLabel(state, "s:AD", "3");
    const p = derivedPoints(next);
    const ad = Math.hypot(p.D!.x - p.A!.x, p.D!.y - p.A!.y);
    almost(ad, 3, 0.05);
  });

  it("sets nested DE so it matches the typed length", () => {
    const state = normalizeState(cloneState(DEFAULT_SIMILAR_STATE));
    const next = applySegLength(state, "DE", 4);
    const p = derivedPoints(next);
    const de = Math.hypot(p.E!.x - p.D!.x, p.E!.y - p.D!.y);
    almost(de, 4, 0.05);
  });

  it("sets a parallels intercept length", () => {
    const preset = SIMILAR_PRESETS.find((p) => p.id === "par-basic")!.state;
    const state = normalizeState(cloneState(preset));
    const next = applySegLength(state, "t0u", 10);
    const p = derivedPoints(next);
    const L = Math.hypot(p.T0M!.x - p.T0L!.x, p.T0M!.y - p.T0L!.y);
    almost(L, 10, 0.08);
  });
});

describe("slide parallel lines", () => {
  it("moves nested DE by changing t", () => {
    const state = normalizeState(cloneState(DEFAULT_SIMILAR_STATE));
    const p0 = derivedPoints(state);
    const mid = {
      x: (p0.A!.x + p0.B!.x + p0.C!.x) / 3,
      y: (p0.A!.y + p0.B!.y + p0.C!.y) / 3,
    };
    const next = moveSlide(state, "DE", mid);
    assert.ok(Math.abs(next.t - state.t) > 0.02);
    const p = derivedPoints(next);
    const de = { x: p.E!.x - p.D!.x, y: p.E!.y - p.D!.y };
    const bc = { x: p.C!.x - p.B!.x, y: p.C!.y - p.B!.y };
    assert.ok(parallel(de, bc));
  });

  it("moves the middle parallel l/m/n line vertically", () => {
    const preset = SIMILAR_PRESETS.find((p) => p.id === "par-basic")!.state;
    const state = normalizeState(cloneState(preset));
    const next = moveSlide(state, "M", { x: 0, y: 1.1 });
    almost(next.parallels.yM, 1.1, 0.02);
    assert.ok(next.parallels.yL > next.parallels.yM);
    assert.ok(next.parallels.yM > next.parallels.yN);
  });
});

describe("length label vs dim line", () => {
  it("projects mouse movement onto the side's outward so the number follows the pointer", () => {
    const state = normalizeState(cloneState(DEFAULT_SIMILAR_STATE));
    const scene = buildSimilarTrianglesScene(state);
    const ad = findSeg(state, "AD")!;
    const axes = segDimAxes(state, scene.layout.canvas, ad.a, ad.b)!;
    const step = 18;
    const next = nudgeLabel(
      state,
      "s:AD",
      axes.outward.x * step,
      axes.outward.y * step,
      false,
      scene.layout.canvas,
    );
    const moved = findSeg(next, "AD")!;
    almost(moved.label.dy - ad.label.dy, step, 0.6);
    almost(moved.label.dx - ad.label.dx, 0, 0.6);
    assert.equal(moved.label.lineDy ?? 0, ad.label.lineDy ?? 0);
  });

  it("moves only the dashed arc when dragging the dim line", () => {
    const state = normalizeState(cloneState(DEFAULT_SIMILAR_STATE));
    const scene = buildSimilarTrianglesScene(state);
    const ad = findSeg(state, "AD")!;
    const axes = segDimAxes(state, scene.layout.canvas, ad.a, ad.b)!;
    const step = 18;
    const next = nudgeLabel(
      state,
      "s:AD",
      axes.outward.x * step,
      axes.outward.y * step,
      true,
      scene.layout.canvas,
    );
    const moved = findSeg(next, "AD")!;
    almost(moved.label.dy, ad.label.dy, 1e-9);
    almost(moved.label.dx, ad.label.dx, 1e-9);
    almost((moved.label.lineDy ?? 0) - (ad.label.lineDy ?? 0), step, 0.6);
  });

  it("hits the dim arc separately from the length text", () => {
    const state = normalizeState(cloneState(DEFAULT_SIMILAR_STATE));
    const scene = buildSimilarTrianglesScene(state);
    const text = scene.texts.find((t) => t.id === "s:AD");
    assert.ok(text);
    const labelHit = hitTestSimilar(
      scene.layout.canvas,
      scene.texts,
      scene.cmds,
      figureStrokes(state),
      state.segs,
      text.x,
      text.y,
      1,
      [],
    );
    assert.deepEqual(labelHit, { kind: "label", id: "s:AD" });

    const arc = scene.cmds.find((c) => c.t === "arc" && c.id === "s:AD:line");
    assert.ok(arc && arc.t === "arc");
    let sweep = arc.a1 - arc.a0;
    if (arc.ccw) {
      while (sweep > 0) sweep -= Math.PI * 2;
      while (sweep > -1e-9) sweep -= Math.PI * 2;
      sweep = -sweep;
      if (sweep < 1e-9) sweep += Math.PI * 2;
    } else {
      while (sweep < 0) sweep += Math.PI * 2;
      if (sweep < 1e-9) sweep += Math.PI * 2;
    }
    const midAng = arc.a0 + (arc.ccw ? -sweep : sweep) / 2;
    const px = arc.cx + arc.r * Math.cos(midAng);
    const py = arc.cy + arc.r * Math.sin(midAng);
    const dimHit = hitTestSimilar(
      scene.layout.canvas,
      scene.texts,
      scene.cmds,
      figureStrokes(state),
      state.segs,
      px,
      py,
      1,
      [],
    );
    assert.deepEqual(dimHit, { kind: "dimLine", id: "s:AD" });
  });
});
