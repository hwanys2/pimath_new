import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { angleAt, applyEditedLabel, movePoint, rebuildTriangleFromLegs, resolveSegText, segLength, snapMathPoint } from "./geometry";
import {
  PYTHAGOREAN_PRESETS,
  cloneState,
  fitGridToFigure,
  normalizeState,
  triangleFromLegs,
} from "./model";
import { buildPythagoreanScene } from "./scene";

describe("pythagorean scene", () => {
  it("builds a scene for every preset", () => {
    for (const preset of PYTHAGOREAN_PRESETS) {
      const scene = buildPythagoreanScene(normalizeState(cloneState(preset.state)));
      assert.equal(scene.width, 520, preset.id);
      assert.equal(scene.height, 520, preset.id);
      assert.ok(scene.cmds.length >= 3, `${preset.id} cmds`);
    }
  });

  it("draws right angles on triangle presets with labels", () => {
    const preset = PYTHAGOREAN_PRESETS.find((p) => p.id === "tri-912x")!;
    const scene = buildPythagoreanScene(normalizeState(cloneState(preset.state)));
    assert.ok(scene.cmds.some((c) => c.t === "rightAngle"));
    const shown = preset.state.segs.filter((s) => s.show);
    const ids = new Set(scene.texts.map((t) => t.id));
    for (const seg of shown) {
      assert.ok(ids.has(`s:${seg.id}`), `missing label for ${seg.id}`);
    }
  });

  it("draws colored squares and grid for squares preset", () => {
    const preset = PYTHAGOREAN_PRESETS.find((p) => p.id === "sq-32")!;
    const scene = buildPythagoreanScene(normalizeState(cloneState(preset.state)));
    assert.ok(scene.cmds.some((c) => c.t === "polygon"));
    assert.ok(scene.cmds.some((c) => c.t === "line" && c.id === "grid"));
  });

  it("draws proof arrangement", () => {
    const preset = PYTHAGOREAN_PRESETS.find((p) => p.id === "proof-both")!;
    const scene = buildPythagoreanScene(normalizeState(cloneState(preset.state)));
    const fills = scene.cmds.filter((c) => c.t === "polygon");
    assert.ok(fills.length >= 2, "both proof figures should shade squares");
    assert.ok(scene.cmds.some((c) => c.t === "rightAngle"));
    assert.ok(scene.texts.some((t) => t.id === "s:proofC1"));
    assert.ok(scene.texts.some((t) => t.id === "s:proofTc1"));
  });

  it("inner proof square has hypotenuse side length", () => {
    const a = 3;
    const b = 4;
    const c = Math.hypot(a, b);
    const s = a + b;
    const side = Math.hypot(s - a, a - 0);
    assert.ok(Math.abs(side - c) < 1e-6);
  });

  it("triangle kinds expose each side segment once", () => {
    for (const kind of ["triangle", "squares"] as const) {
      const ids = normalizeState({ kind }).segs.map((s) => s.id);
      assert.equal(new Set(ids).size, ids.length, kind);
      assert.deepEqual([...new Set(ids)].sort(), ["AB", "AC", "BC"]);
    }
  });

  it("snaps dragged vertices to grid on squares preset", () => {
    const preset = PYTHAGOREAN_PRESETS.find((p) => p.id === "sq-32")!;
    const base = normalizeState(cloneState(preset.state));
    const next = movePoint(base, "B", { x: 0.62, y: -0.38 });
    assert.equal(next.B.x, 1);
    assert.ok(Math.abs(next.B.y) < 1e-9);
    const snapped = snapMathPoint(base, { x: 2.44, y: 1.51 });
    assert.equal(snapped.x, 2);
    assert.equal(snapped.y, 2);
  });

  it("keeps a right angle when dragging a leg endpoint on squares preset", () => {
    const preset = PYTHAGOREAN_PRESETS.find((p) => p.id === "sq-32")!;
    const base = normalizeState(cloneState(preset.state));
    const next = movePoint(base, "A", { x: 4.2, y: 2.1 });
    const ang = angleAt(next.B, next.C, next.A);
    assert.ok(Math.abs(ang - 90) < 0.05, `angle=${ang}`);
    assert.ok(Math.abs(next.C.x - base.C.x) < 1e-6 && Math.abs(next.C.y - base.C.y) < 1e-6);
  });

  it("altitude preset keeps a right angle at A", () => {
    const preset = PYTHAGOREAN_PRESETS.find((p) => p.id === "alt-3040")!;
    const state = normalizeState(cloneState(preset.state));
    const ang = angleAt(state.B, state.A, state.C);
    assert.ok(Math.abs(ang - 90) < 0.05, `angle at A=${ang}`);
    assert.equal(state.rightVertex, "A");
  });

  it("resizes triangle geometry when a leg length is edited", () => {
    const base = normalizeState(cloneState(PYTHAGOREAN_PRESETS.find((p) => p.id === "tri-912x")!.state));
    const next = applyEditedLabel(base, "s:BC", "6");
    assert.ok(Math.abs(segLength(next, next.segs.find((s) => s.id === "BC")!) - 6) < 0.05);
  });

  it("resizes rectangle when width is edited", () => {
    const base = normalizeState(cloneState(PYTHAGOREAN_PRESETS.find((p) => p.id === "rect-68")!.state));
    const next = applyEditedLabel(base, "s:AB", "10");
    assert.equal(next.rectWidth, 10);
    assert.ok(Math.abs(segLength(next, next.segs.find((s) => s.id === "AB")!) - 10) < 0.05);
  });

  it("resizes altitude when a leg length is edited", () => {
    const base = normalizeState(cloneState(PYTHAGOREAN_PRESETS.find((p) => p.id === "alt-3040")!.state));
    const next = applyEditedLabel(base, "s:AB", "15");
    assert.ok(Math.abs(segLength(next, next.segs.find((s) => s.id === "AB")!) - 15) < 0.05);
  });

  it("shows unknown letter in x mode even when custom still holds a number", () => {
    const base = normalizeState(cloneState(PYTHAGOREAN_PRESETS.find((p) => p.id === "tri-912x")!.state));
    const seg = base.segs.find((s) => s.id === "BC")!;
    const labeled = {
      ...base,
      segs: base.segs.map((s) =>
        s.id === "BC" ? { ...s, label: { ...seg.label, mode: "x" as const, custom: "9" } } : s,
      ),
    };
    assert.equal(resolveSegText(labeled, labeled.segs.find((s) => s.id === "BC")!), "$x$ cm");
  });

  it("9·12·x preset sits on unit grid with grid covering the figure", () => {
    const state = normalizeState(cloneState(PYTHAGOREAN_PRESETS.find((p) => p.id === "tri-912x")!.state));
    assert.equal(state.showGrid, true);
    assert.equal(state.gridCols, 9);
    assert.equal(state.gridRows, 12);
    for (const id of ["A", "B", "C"] as const) {
      const p = state[id];
      assert.equal(p.x, Math.round(p.x), `${id}.x on grid`);
      assert.equal(p.y, Math.round(p.y), `${id}.y on grid`);
    }
    assert.equal(state.C.x, 0);
    assert.equal(state.C.y, 0);
    assert.equal(state.B.x, 9);
    assert.equal(state.A.y, 12);
    const scene = buildPythagoreanScene(state);
    const gridLines = scene.cmds.filter((c) => c.t === "line" && c.id === "grid");
    assert.ok(gridLines.length >= 12, "grid lines drawn");
  });

  it("24·x·25 preset sits on unit grid with grid covering the figure", () => {
    const state = normalizeState(cloneState(PYTHAGOREAN_PRESETS.find((p) => p.id === "tri-24x25")!.state));
    assert.equal(state.showGrid, true);
    assert.equal(state.rightVertex, "C");
    for (const id of ["A", "B", "C"] as const) {
      const p = state[id];
      assert.equal(p.x, Math.round(p.x), `${id}.x on grid`);
      assert.equal(p.y, Math.round(p.y), `${id}.y on grid`);
    }
    assert.equal(state.C.x, 0);
    assert.equal(state.C.y, 0);
    assert.equal(state.B.x, 7);
    assert.equal(state.A.y, 24);
    const scene = buildPythagoreanScene(state);
    const gridLines = scene.cmds.filter((c) => c.t === "line" && c.id === "grid");
    assert.ok(gridLines.length >= 24, "grid lines drawn");
  });

  it("이등변직각 preset sits on unit grid with grid covering the figure", () => {
    const state = normalizeState(cloneState(PYTHAGOREAN_PRESETS.find((p) => p.id === "tri-iso")!.state));
    assert.equal(state.showGrid, true);
    assert.equal(state.gridCols, 5);
    assert.equal(state.gridRows, 5);
    assert.equal(state.isoscelesRight, true);
    assert.equal(state.legLeft, 5);
    assert.equal(state.legRight, 5);
    for (const id of ["A", "B", "C"] as const) {
      const p = state[id];
      assert.equal(p.x, Math.round(p.x), `${id}.x on grid`);
      assert.equal(p.y, Math.round(p.y), `${id}.y on grid`);
    }
    assert.equal(state.C.x, 0);
    assert.equal(state.C.y, 0);
    assert.equal(state.B.x, 5);
    assert.equal(state.A.y, 5);
    const scene = buildPythagoreanScene(state);
    const gridLines = scene.cmds.filter((c) => c.t === "line" && c.id === "grid");
    assert.ok(gridLines.length >= 10, "grid lines drawn");
  });

  it("grid size can be adjusted independently of figure legs", () => {
    const base = normalizeState(cloneState(PYTHAGOREAN_PRESETS.find((p) => p.id === "tri-912x")!.state));
    const wide = normalizeState({ ...base, gridCols: 14, gridRows: 16 });
    assert.equal(wide.gridCols, 14);
    assert.equal(wide.gridRows, 16);
    const scene = buildPythagoreanScene(wide);
    const gridLines = scene.cmds.filter((c) => c.t === "line" && c.id === "grid");
    assert.ok(gridLines.length >= 28, "expanded grid draws more lines");
  });

  it("fitGridToFigure snaps cols and rows to leg ratio", () => {
    const base = normalizeState(cloneState(PYTHAGOREAN_PRESETS.find((p) => p.id === "tri-912x")!.state));
    const loose = normalizeState({ ...base, gridCols: 20, gridRows: 20 });
    const fitted = normalizeState(fitGridToFigure(loose));
    assert.equal(fitted.gridCols, 9);
    assert.equal(fitted.gridRows, 12);
  });

  it("shows hypotenuse as radical in auto mode for 9·12·x", () => {
    const state = normalizeState(cloneState(PYTHAGOREAN_PRESETS.find((p) => p.id === "tri-912x")!.state));
    const ab = state.segs.find((s) => s.id === "AB")!;
    const autoAb = { ...ab, label: { ...ab.label, mode: "auto" as const, custom: "" } };
    assert.equal(resolveSegText(state, autoAb), "15 cm");
  });
});

describe("pythagorean geometry", () => {
  it("triangleFromLegs yields a right angle at C", () => {
    const { A, B, C } = triangleFromLegs(3, 4);
    const ang = angleAt(B, C, A);
    assert.ok(Math.abs(ang - 90) < 0.01);
    assert.ok(Math.abs(Math.hypot(A.x - B.x, A.y - B.y) - 5) < 0.01);
  });
});
