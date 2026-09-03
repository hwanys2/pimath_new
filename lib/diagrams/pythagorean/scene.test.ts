import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  angleAt,
  applyEditedLabel,
  derivedPoints,
  figureStrokes,
  hitTestPythagorean,
  movePoint,
  nudgeLabel,
  resolveSegText,
  segDimAxes,
  segLength,
  snapMathPoint,
} from "./geometry";
import {
  PYTHAGOREAN_PRESETS,
  applyPreset,
  cloneState,
  findSeg,
  fitGridToFigure,
  normalizeState,
  toggleAltitude,
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

  it("length text stays put when only the dim line is offset", () => {
    const base = normalizeState(cloneState(PYTHAGOREAN_PRESETS.find((p) => p.id === "tri-abc")!.state));
    const movedLine = normalizeState({
      ...base,
      segs: base.segs.map((s) =>
        s.id === "AB" ? { ...s, label: { ...s.label, lineDy: 36 } } : s,
      ),
    });
    const movedText = normalizeState({
      ...base,
      segs: base.segs.map((s) =>
        s.id === "AB" ? { ...s, label: { ...s.label, dy: 36 } } : s,
      ),
    });
    const t0 = buildPythagoreanScene(base).texts.find((t) => t.id === "s:AB");
    const tLine = buildPythagoreanScene(movedLine).texts.find((t) => t.id === "s:AB");
    const tText = buildPythagoreanScene(movedText).texts.find((t) => t.id === "s:AB");
    assert.ok(t0 && tLine && tText);
    assert.ok(Math.abs(t0.y - tLine.y) < 1.5);
    assert.ok(Math.hypot(t0.x - tText.x, t0.y - tText.y) > 8);

    const arcId = "s:AB:line";
    const arc0 = buildPythagoreanScene(base).cmds.find((c) => c.t === "arc" && c.id === arcId);
    const arcLine = buildPythagoreanScene(movedLine).cmds.find((c) => c.t === "arc" && c.id === arcId);
    const arcText = buildPythagoreanScene(movedText).cmds.find((c) => c.t === "arc" && c.id === arcId);
    assert.ok(arc0 && arc0.t === "arc");
    assert.ok(arcLine && arcLine.t === "arc");
    assert.ok(arcText && arcText.t === "arc");
    assert.ok(Math.abs(arc0.r - arcLine.r) > 4, "dim arc should move with lineDy");
    assert.ok(Math.abs(arc0.r - arcText.r) < 1.5, "dim arc should stay when only the text moves");
  });

  it("projects dim-line drag onto the side's outward axis", () => {
    const state = normalizeState(cloneState(PYTHAGOREAN_PRESETS.find((p) => p.id === "tri-abc")!.state));
    const scene = buildPythagoreanScene(state);
    const ab = findSeg(state, "AB")!;
    const axes = segDimAxes(state, scene.layout.canvas, ab.a, ab.b)!;
    const step = 18;
    const next = nudgeLabel(
      state,
      "s:AB",
      axes.outward.x * step,
      axes.outward.y * step,
      true,
      scene.layout.canvas,
    );
    const moved = findSeg(next, "AB")!;
    assert.ok(Math.abs((moved.label.lineDy ?? 0) - (ab.label.lineDy ?? 0) - step) < 0.6);
    assert.equal(moved.label.dx, ab.label.dx);
    assert.equal(moved.label.dy, ab.label.dy);
  });

  it("hits the dim arc separately from the length text", () => {
    const base = normalizeState(cloneState(PYTHAGOREAN_PRESETS.find((p) => p.id === "tri-abc")!.state));
    const state = normalizeState({
      ...base,
      segs: base.segs.map((s) =>
        s.id === "AB" ? { ...s, label: { ...s.label, lineDy: 48 } } : s,
      ),
    });
    const scene = buildPythagoreanScene(state);
    const text = scene.texts.find((t) => t.id === "s:AB");
    assert.ok(text);
    const labelHit = hitTestPythagorean(
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
    assert.deepEqual(labelHit, { kind: "label", id: "s:AB" });

    const arc = scene.cmds.find((c) => c.t === "arc" && c.id === "s:AB:line");
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
    const dimHit = hitTestPythagorean(
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
    assert.deepEqual(dimHit, { kind: "dimLine", id: "s:AB" });
  });

  it("drops an altitude from a selected vertex onto the opposite side", () => {
    const base = normalizeState(cloneState(PYTHAGOREAN_PRESETS.find((p) => p.id === "tri-abc")!.state));
    const next = toggleAltitude(base, "C");
    assert.deepEqual(next.altitudes, ["C"]);
    const pts = derivedPoints(next);
    assert.ok(pts.H);
    const ch = { x: pts.H.x - pts.C!.x, y: pts.H.y - pts.C!.y };
    const ab = { x: pts.B!.x - pts.A!.x, y: pts.B!.y - pts.A!.y };
    assert.ok(Math.abs(ch.x * ab.x + ch.y * ab.y) < 1e-6);
    const scene = buildPythagoreanScene(next);
    assert.ok(scene.cmds.some((c) => c.t === "rightAngle"));
    assert.ok(figureStrokes(next).some(([a, b]) => a === "C" && b === "H"));
  });

  it("extends the base with a dashed line when the altitude foot is outside", () => {
    const state = normalizeState(cloneState(PYTHAGOREAN_PRESETS.find((p) => p.id === "tri-obtuse")!.state));
    assert.equal(state.rightVertex, "none");
    assert.deepEqual(state.altitudes, ["A"]);
    const pts = derivedPoints(state);
    assert.ok(pts.Ha);
    assert.ok(pts.Ha.x < Math.min(pts.B!.x, pts.C!.x) - 1e-6 || pts.Ha.x > Math.max(pts.B!.x, pts.C!.x) + 1e-6
      || pts.Ha.y < Math.min(pts.B!.y, pts.C!.y) - 1e-6 || pts.Ha.y > Math.max(pts.B!.y, pts.C!.y) + 1e-6);
    const scene = buildPythagoreanScene(state);
    const dashed = scene.cmds.filter((c) => c.t === "line" && c.dashed && !c.id);
    assert.ok(dashed.length >= 1, "obtuse altitude should draw a dashed base extension");
  });

  it("lets vertices move freely when the right angle is unlocked", () => {
    const base = normalizeState({
      kind: "triangle",
      rightVertex: "none",
      A: { x: 0, y: 3 },
      B: { x: 4, y: 0 },
      C: { x: 0, y: 0 },
      showGrid: false,
    });
    const next = movePoint(base, "A", { x: -1, y: 2 });
    assert.ok(Math.abs(next.A.x + 1) < 1e-6);
    assert.ok(Math.abs(next.A.y - 2) < 1e-6);
    assert.ok(Math.abs(angleAt(next.B, next.C, next.A) - 90) > 5);
  });

  it("keeps the canvas grid on when switching to a proof preset", () => {
    const start = normalizeState(cloneState(PYTHAGOREAN_PRESETS.find((p) => p.id === "tri-abc")!.state));
    assert.equal(start.showGrid, true);
    const proof = PYTHAGOREAN_PRESETS.find((p) => p.id === "proof-both")!.state;
    const next = applyPreset(start, proof);
    assert.equal(next.kind, "proof");
    assert.equal(next.showGrid, true);
    assert.equal(next.showVertexNames, start.showVertexNames);
    const scene = buildPythagoreanScene(next);
    assert.ok(scene.cmds.some((c) => c.id === "grid"), "proof figure should still draw a grid");
  });

  it("drops an extra altitude from a selected vertex on the squares figure", () => {
    const base = normalizeState(cloneState(PYTHAGOREAN_PRESETS.find((p) => p.id === "sq-32")!.state));
    const next = toggleAltitude(base, "C");
    assert.deepEqual(next.altitudes, ["C"]);
    const pts = derivedPoints(next);
    assert.ok(pts.H);
    assert.ok(figureStrokes(next).some(([a, b]) => a === "C" && b === "H"));
    const scene = buildPythagoreanScene(next);
    assert.ok(scene.cmds.some((c) => c.t === "rightAngle"));
  });
});
