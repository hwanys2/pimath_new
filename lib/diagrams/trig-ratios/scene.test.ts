import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyEditedLabel,
  draggableIds,
  findSeg,
  hitTestTrig,
  lengthDimAxes,
  movePoint,
  nudgeLabel,
  unitCirclePoints,
  isObtuseAtA,
  figureStrokes,
  segLength,
} from "./geometry";
import {
  TRIG_PRESETS,
  cloneState,
  cycleFigurePoint,
  formatThetaLabel,
  normalizeState,
  readPointMark,
} from "./model";
import { buildTrigScene } from "./scene";

function almost(a: number, b: number, eps = 1e-6): void {
  assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
}

function arcSweep(a0: number, a1: number, ccw: boolean): number {
  const two = Math.PI * 2;
  const n = (a: number) => ((a % two) + two) % two;
  if (ccw) {
    let m = n(a0) - n(a1);
    if (m < 0) m += two;
    return m;
  }
  let m = n(a1) - n(a0);
  if (m < 0) m += two;
  return m;
}

describe("trig-ratios scene", () => {
  it("builds a scene for every preset", () => {
    for (const preset of TRIG_PRESETS) {
      const scene = buildTrigScene(normalizeState(cloneState(preset.state)));
      assert.equal(scene.width, 520, preset.id);
      assert.equal(scene.height, 520, preset.id);
      assert.ok(scene.cmds.length >= 3, `${preset.id} cmds`);
    }
  });

  it("draws right angles on right triangle presets", () => {
    const preset = TRIG_PRESETS.find((p) => p.id === "right-sqrt3")!;
    const scene = buildTrigScene(normalizeState(cloneState(preset.state)));
    assert.ok(scene.cmds.some((c) => c.t === "rightAngle" || c.t === "polyline"));
  });

  it("unit circle B and D follow theta", () => {
    const state = normalizeState(cloneState(TRIG_PRESETS.find((p) => p.id === "unit-48")!.state));
    const pts = unitCirclePoints(state);
    assert.ok(Math.abs(pts.B!.x - pts.A!.x) < 1e-9);
    assert.ok(Math.abs(pts.B!.y - Math.sin((48 * Math.PI) / 180)) < 1e-9);
    assert.ok(Math.abs(pts.D!.y - Math.tan((48 * Math.PI) / 180)) < 1e-9);
  });

  it("obtuse triangle preset marks extension angle", () => {
    const preset = TRIG_PRESETS.find((p) => p.id === "tri-obtuse")!;
    const state = normalizeState(cloneState(preset.state));
    assert.ok(isObtuseAtA(state));
    const scene = buildTrigScene(state);
    assert.ok(scene.cmds.some((c) => c.t === "line" && c.dashed));
  });

  it("quad diagonal preset draws pink diagonal", () => {
    const preset = TRIG_PRESETS.find((p) => p.id === "quad-diag")!;
    const scene = buildTrigScene(normalizeState(cloneState(preset.state)));
    assert.ok(
      scene.cmds.some(
        (c) => c.t === "line" && c.stroke === "#e879a8",
      ),
    );
  });

  it("angle arcs stay on the minor interior side", () => {
    for (const id of ["right-306090", "unit-48"]) {
      const preset = TRIG_PRESETS.find((p) => p.id === id)!;
      const scene = buildTrigScene(normalizeState(cloneState(preset.state)));
      const arcs = scene.cmds.filter((c) => c.t === "arc" && !c.dashed);
      assert.ok(arcs.length >= 1, `${id} expected angle arcs`);
      for (const arc of arcs) {
        if (arc.t !== "arc") continue;
        const sweep = arcSweep(arc.a0, arc.a1, arc.ccw);
        assert.ok(sweep <= Math.PI + 1e-6, `${id} reflex arc ${sweep}`);
      }
    }
  });

  it("right-triangle angle marks sit inside the triangle", () => {
    for (const preset of TRIG_PRESETS.filter((p) => p.state.kind === "right")) {
      for (const rotateDeg of [0, 40, 120]) {
        const allOn = normalizeState({
          ...cloneState(preset.state),
          rotateDeg,
          angles: cloneState(preset.state).angles.map((a) => ({ ...a, show: true })),
        });
        const scene = buildTrigScene(allOn);
        const A = scene.layout.canvas.A!;
        const B = scene.layout.canvas.B!;
        const C = scene.layout.canvas.C!;
        const centroid = {
          x: (A.x + B.x + C.x) / 3,
          y: (A.y + B.y + C.y) / 3,
        };
        const angleArcs = scene.cmds.filter((c) => c.t === "arc" && !c.dashed && !c.id);
        assert.ok(angleArcs.length >= 1, `${preset.id} @${rotateDeg}`);
        for (const arc of angleArcs) {
          if (arc.t !== "arc") continue;
          const sweep = arcSweep(arc.a0, arc.a1, arc.ccw);
          const midAng = arc.a0 + (arc.ccw ? -sweep : sweep) / 2;
          const mid = {
            x: arc.cx + Math.cos(midAng) * arc.r,
            y: arc.cy + Math.sin(midAng) * arc.r,
          };
          const inward =
            (mid.x - arc.cx) * (centroid.x - arc.cx) +
            (mid.y - arc.cy) * (centroid.y - arc.cy);
          assert.ok(inward > 0, `${preset.id} @${rotateDeg} angle arc should face the interior`);
        }
      }
    }
  });

  it("unit-circle quarter lies in the first quadrant", () => {
    const state = normalizeState(cloneState(TRIG_PRESETS.find((p) => p.id === "unit-48")!.state));
    const scene = buildTrigScene(state);
    const O = scene.layout.canvas.O!;
    const quarter = scene.cmds.find(
      (c) => c.t === "arc" && !c.dashed && Math.abs(c.cx - O.x) < 1 && Math.abs(c.cy - O.y) < 1,
    );
    assert.ok(quarter && quarter.t === "arc");
    const sweep = arcSweep(quarter.a0, quarter.a1, quarter.ccw);
    const midAng = quarter.a0 + (quarter.ccw ? -sweep : sweep) / 2;
    const px = quarter.cx + quarter.r * Math.cos(midAng);
    const py = quarter.cy + quarter.r * Math.sin(midAng);
    assert.ok(px > O.x + 8, "quarter midpoint should be to the right of O");
    assert.ok(py < O.y - 8, "quarter midpoint should be above O");
  });

  it("dim ticks meet the vertices of a length mark", () => {
    const preset = TRIG_PRESETS.find((p) => p.id === "right-sqrt3")!;
    const scene = buildTrigScene(normalizeState(cloneState(preset.state)));
    const A = scene.layout.canvas.A!;
    const B = scene.layout.canvas.B!;
    const C = scene.layout.canvas.C!;
    const ticks = scene.cmds.filter((c) => c.t === "line" && c.id === "s:AB:line");
    assert.ok(ticks.length >= 2);
    const touches = (p: { x: number; y: number }) =>
      ticks.some(
        (c) =>
          c.t === "line" &&
          (Math.hypot(c.x1 - p.x, c.y1 - p.y) < 1.5 || Math.hypot(c.x2 - p.x, c.y2 - p.y) < 1.5),
      );
    assert.ok(touches(A), "AB dim tick should meet A");
    assert.ok(touches(B), "AB dim tick should meet B");

    const arc = scene.cmds.find((c) => c.t === "arc" && c.id === "s:AB:line");
    assert.ok(arc && arc.t === "arc");
    const sweep = arcSweep(arc.a0, arc.a1, arc.ccw);
    const midAng = arc.a0 + (arc.ccw ? -sweep : sweep) / 2;
    const peak = { x: arc.cx + arc.r * Math.cos(midAng), y: arc.cy + arc.r * Math.sin(midAng) };
    const centroid = {
      x: (A.x + B.x + C.x) / 3,
      y: (A.y + B.y + C.y) / 3,
    };
    const midAB = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
    const out = { x: midAB.x - centroid.x, y: midAB.y - centroid.y };
    const toPeak = { x: peak.x - midAB.x, y: peak.y - midAB.y };
    assert.ok(out.x * toPeak.x + out.y * toPeak.y > 0, "dim arc should bulge outside the triangle");
  });

  it("length text stays put when only the dim line is offset", () => {
    const base = normalizeState(cloneState(TRIG_PRESETS.find((p) => p.id === "right-sqrt3")!.state));
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
    const t0 = buildTrigScene(base).texts.find((t) => t.id === "s:AB");
    const tLine = buildTrigScene(movedLine).texts.find((t) => t.id === "s:AB");
    const tText = buildTrigScene(movedText).texts.find((t) => t.id === "s:AB");
    assert.ok(t0 && tLine && tText);
    assert.ok(Math.abs(t0.y - tLine.y) < 1.5);
    assert.ok(Math.hypot(t0.x - tText.x, t0.y - tText.y) > 8);

    const arcId = "s:AB:line";
    const arc0 = buildTrigScene(base).cmds.find((c) => c.t === "arc" && c.id === arcId);
    const arcLine = buildTrigScene(movedLine).cmds.find((c) => c.t === "arc" && c.id === arcId);
    const arcText = buildTrigScene(movedText).cmds.find((c) => c.t === "arc" && c.id === arcId);
    assert.ok(arc0 && arc0.t === "arc");
    assert.ok(arcLine && arcLine.t === "arc");
    assert.ok(arcText && arcText.t === "arc");
    assert.ok(Math.abs(arc0.r - arcLine.r) > 4, "dim arc should move with lineDy");
    assert.ok(Math.abs(arc0.r - arcText.r) < 1.5, "dim arc should stay when only the text moves");
  });

  it("hits the dim arc separately from the length text", () => {
    const state = normalizeState(cloneState(TRIG_PRESETS.find((p) => p.id === "right-sqrt3")!.state));
    const scene = buildTrigScene(state);
    const text = scene.texts.find((t) => t.id === "s:AB");
    assert.ok(text);
    const labelHit = hitTestTrig(
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
    const sweep = arcSweep(arc.a0, arc.a1, arc.ccw);
    const midAng = arc.a0 + (arc.ccw ? -sweep : sweep) / 2;
    const px = arc.cx + arc.r * Math.cos(midAng);
    const py = arc.cy + arc.r * Math.sin(midAng);
    const dimHit = hitTestTrig(
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

  it("nudgeLabel lineOnly moves only lineDy", () => {
    const state = normalizeState(cloneState(TRIG_PRESETS.find((p) => p.id === "right-sqrt3")!.state));
    const scene = buildTrigScene(state);
    const ab = findSeg(state, "AB")!;
    const axes = lengthDimAxes(state, scene.layout.canvas, "AB")!;
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
    assert.equal(moved.label.dx, ab.label.dx);
    assert.equal(moved.label.dy, ab.label.dy);
    assert.ok(Math.abs((moved.label.lineDy ?? 0) - (ab.label.lineDy ?? 0) - step) < 1);
  });

  it("hides a vertex name and dot independently", () => {
    const start = normalizeState(cloneState(TRIG_PRESETS.find((p) => p.id === "right-sqrt3")!.state));
    const dots = cycleFigurePoint(start, "A");
    assert.equal(readPointMark(dots, "A").showName, false);
    assert.equal(readPointMark(dots, "A").showDot, true);
    const hidden = cycleFigurePoint(dots, "A");
    assert.equal(readPointMark(hidden, "A").showName, false);
    assert.equal(readPointMark(hidden, "A").showDot, false);
    const scene = buildTrigScene(hidden);
    assert.ok(!scene.texts.some((t) => t.id === "n:A"));
    assert.ok(scene.texts.some((t) => t.id === "n:B"));
    const A = scene.layout.canvas.A!;
    assert.ok(
      !scene.cmds.some(
        (c) => c.t === "dot" && Math.hypot(c.x - A.x, c.y - A.y) < 0.5,
      ),
    );
  });

  it("places point names beside the dots, not on them", () => {
    const scene = buildTrigScene(normalizeState(cloneState(TRIG_PRESETS.find((p) => p.id === "unit-48")!.state)));
    for (const id of ["O", "A", "B", "C", "D"]) {
      const p = scene.layout.canvas[id]!;
      const label = scene.texts.find((t) => t.id === `n:${id}`);
      assert.ok(label, id);
      assert.ok(Math.hypot(label.x - p.x, label.y - p.y) > 10, id);
    }
  });

  it("can draw several triangle altitudes at once", () => {
    const base = normalizeState(cloneState(TRIG_PRESETS.find((p) => p.id === "tri-height")!.state));
    assert.deepEqual(base.altitudes, ["C"]);
    const both = normalizeState({ ...base, altitudes: ["A", "C"] });
    const scene = buildTrigScene(both);
    assert.ok(scene.layout.canvas.H);
    assert.ok(scene.layout.canvas.Ha);
    assert.equal(scene.layout.canvas.Hb, undefined);
    const strokes = figureStrokes(both);
    assert.ok(strokes.some(([a, b]) => (a === "C" && b === "H") || (a === "H" && b === "C")));
    assert.ok(strokes.some(([a, b]) => (a === "A" && b === "Ha") || (a === "Ha" && b === "A")));
    assert.ok(scene.cmds.filter((c) => c.t === "rightAngle").length >= 2);
  });

  it("on-figure length edit of √3·3 keeps the other leg", () => {
    const start = normalizeState(cloneState(TRIG_PRESETS.find((p) => p.id === "right-sqrt3")!.state));
    const ab0 = segLength(start, findSeg(start, "AB")!);
    const next = applyEditedLabel(start, "s:BC", "5");
    almost(segLength(next, findSeg(next, "BC")!), 5, 1e-4);
    almost(segLength(next, findSeg(next, "AB")!), ab0, 1e-4);
    assert.ok(segLength(next, findSeg(next, "BC")!) > segLength(next, findSeg(next, "AB")!));
  });

  it("on-figure length edit changes the named triangle side", () => {
    const start = normalizeState(cloneState(TRIG_PRESETS.find((p) => p.id === "tri-height")!.state));
    const ab0 = segLength(start, findSeg(start, "AB")!);
    const next = applyEditedLabel(start, "s:AC", "4");
    almost(segLength(next, findSeg(next, "AC")!), 4, 0.2);
    assert.ok(Math.abs(segLength(next, findSeg(next, "AB")!) - 4) > 1);
    almost(segLength(next, findSeg(next, "AB")!), ab0, 0.35);
  });

  it("unit circle lets B and D set theta to one decimal", () => {
    const start = normalizeState(cloneState(TRIG_PRESETS.find((p) => p.id === "unit-48")!.state));
    assert.deepEqual(draggableIds(start), ["B", "D"]);
    const fromD = movePoint(start, "D", { x: 1, y: Math.tan((37.36 * Math.PI) / 180) });
    assert.equal(fromD.thetaDeg, 37.4);
    const fromB = movePoint(start, "B", { x: Math.cos(Math.PI / 3), y: Math.sin(Math.PI / 3) });
    assert.equal(fromB.thetaDeg, 60);
    const scene = buildTrigScene(fromD);
    const theta = scene.texts.find((t) => t.id === "a:theta");
    assert.ok(theta);
    const label = theta.runs.map((r) => r.text).join("");
    assert.equal(label, formatThetaLabel(37.4));
    assert.match(label, /^\d+(\.\d)?°$/);
  });

  it("hides unit-circle y and z angles independently", () => {
    const start = normalizeState(cloneState(TRIG_PRESETS.find((p) => p.id === "unit-48")!.state));
    const onlyY = normalizeState({ ...start, showAngleY: true, showAngleZ: false });
    const scene = buildTrigScene(onlyY);
    assert.ok(scene.texts.some((t) => t.id === "a:y"));
    assert.ok(!scene.texts.some((t) => t.id === "a:z"));
    const noTan = normalizeState({ ...start, showTanValue: false, showCosValue: true });
    const values = buildTrigScene(noTan);
    assert.ok(values.texts.some((t) => t.id === "axis:Ax"));
    assert.ok(!values.texts.some((t) => t.id === "axis:Dy"));
  });
});
