import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyEditedLabel,
  applySegNumeric,
  draggableIds,
  findSeg,
  hitTestTrig,
  lengthDimAxes,
  movePoint,
  nudgeLabel,
  rebuildRightForRightVertex,
  rebuildTriangleFromLegs,
  resolveSegText,
  unitCirclePoints,
  isObtuseAtA,
  figureStrokes,
  interiorAngleDeg,
  quadDiagonalIntersection,
  quadDiagAngleDeg,
  segLength,
  setLengthDisplayText,
  setQuadFamily,
  setRotateDeg,
  trianglePoints,
} from "./geometry";
import {
  TRIG_PRESETS,
  cloneState,
  cycleFigurePoint,
  formatThetaLabel,
  findAngle,
  normalizeState,
  patchQuadDiagAngle,
  readPointMark,
  snapRotateDeg,
} from "./model";
import { buildTrigScene } from "./scene";
import { sceneInkBox } from "@/lib/diagrams/render";

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

  it("4·6 puts the right-angle square at A, not C", () => {
    const state = normalizeState(cloneState(TRIG_PRESETS.find((p) => p.id === "right-46")!.state));
    const math = [state.A, state.B, state.C];
    almost(interiorAngleDeg(math, 0), 90, 0.5);
    assert.ok(Math.abs(interiorAngleDeg(math, 2) - 90) > 10);
    assert.equal(state.rightVertex, "A");
    const scene = buildTrigScene(state);
    const mark = scene.cmds.find((c) => c.t === "rightAngle");
    assert.ok(mark && mark.t === "rightAngle");
    const a = scene.layout.canvas.A!;
    const c = scene.layout.canvas.C!;
    assert.ok(Math.hypot(mark.x - a.x, mark.y - a.y) < 2);
    assert.ok(Math.hypot(mark.x - c.x, mark.y - c.y) > 20);
  });

  it("does not draw a right-angle square where the angle is not 90°", () => {
    const start = normalizeState(cloneState(TRIG_PRESETS.find((p) => p.id === "right-sqrt3")!.state));
    const next = { ...start, rightVertex: "C" as const, showRightAngle: true };
    const math = [next.A, next.B, next.C];
    almost(interiorAngleDeg(math, 1), 90, 0.5);
    assert.ok(Math.abs(interiorAngleDeg(math, 2) - 90) > 10);
    const scene = buildTrigScene(next);
    const marks = scene.cmds.filter((c) => c.t === "rightAngle");
    assert.ok(marks.length >= 1);
    const b = scene.layout.canvas.B!;
    const c = scene.layout.canvas.C!;
    for (const mark of marks) {
      assert.ok(Math.hypot(mark.x - b.x, mark.y - b.y) < 3);
      assert.ok(Math.hypot(mark.x - c.x, mark.y - c.y) > 10);
    }
  });

  it("직각 위치 C keeps B on the left and puts the right angle at C on the right", () => {
    const start = normalizeState(cloneState(TRIG_PRESETS.find((p) => p.id === "right-sqrt3")!.state));
    assert.equal(start.rightVertex, "B");
    assert.ok(start.C.x > start.B.x);
    const next = rebuildRightForRightVertex(start, "C");
    assert.equal(next.rightVertex, "C");
    almost(interiorAngleDeg([next.A, next.B, next.C], 2), 90, 0.5);
    assert.ok(Math.abs(interiorAngleDeg([next.A, next.B, next.C], 1) - 90) > 10);
    assert.ok(next.C.x > next.B.x, "C should stay on the right");
    almost(next.A.x, next.C.x);
    almost(next.B.y, next.C.y);
    const rebuilt = rebuildTriangleFromLegs(next, next.legLeft, next.legRight);
    assert.ok(rebuilt.C.x > rebuilt.B.x);
    almost(interiorAngleDeg([rebuilt.A, rebuilt.B, rebuilt.C], 2), 90, 0.5);
    const scene = buildTrigScene(next);
    const mark = scene.cmds.find((c) => c.t === "rightAngle");
    assert.ok(mark && mark.t === "rightAngle");
    const b = scene.layout.canvas.B!;
    const c = scene.layout.canvas.C!;
    assert.ok(Math.hypot(mark.x - c.x, mark.y - c.y) < 2);
    assert.ok(Math.hypot(mark.x - b.x, mark.y - b.y) > 20);
  });

  it("can draw an angle arc without the degree number", () => {
    const start = normalizeState(cloneState(TRIG_PRESETS.find((p) => p.id === "right-306090")!.state));
    const hidden = {
      ...start,
      angles: start.angles.map((a) =>
        a.id === "A"
          ? { ...a, show: true, fill: "none" as const, label: { ...a.label, mode: "hide" as const } }
          : a,
      ),
    };
    const scene = buildTrigScene(hidden);
    assert.equal(scene.texts.find((t) => t.id === "a:A"), undefined);
    assert.ok(scene.cmds.some((c) => c.t === "arc" && c.id === "a:A"));
  });

  it("can fill an angle and still hide the size", () => {
    const start = normalizeState(cloneState(TRIG_PRESETS.find((p) => p.id === "right-306090")!.state));
    const filled = {
      ...start,
      angles: start.angles.map((a) =>
        a.id === "A"
          ? { ...a, show: true, fill: "pink" as const, label: { ...a.label, mode: "hide" as const } }
          : a,
      ),
    };
    const scene = buildTrigScene(filled);
    assert.equal(scene.texts.find((t) => t.id === "a:A"), undefined);
    assert.ok(scene.cmds.some((c) => c.t === "polygon" && c.fill === "#f7c8d2"));
    const arc = scene.cmds.find((c) => c.t === "arc" && c.id === "a:A");
    assert.ok(arc && arc.t === "arc");
    const sweep = arcSweep(arc.a0, arc.a1, arc.ccw);
    const midAng = arc.a0 + (arc.ccw ? -sweep : sweep) / 2;
    const hx = arc.cx + Math.cos(midAng) * arc.r;
    const hy = arc.cy + Math.sin(midAng) * arc.r;
    const hit = hitTestTrig(
      scene.layout.canvas,
      scene.texts,
      scene.cmds,
      figureStrokes(filled),
      filled.segs,
      hx,
      hy,
      1,
      draggableIds(filled),
    );
    assert.equal(hit?.kind, "ang");
    assert.equal(hit && "id" in hit ? hit.id : "", "a:A");
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

  it("triangle-area presets keep base AB horizontal", () => {
    for (const preset of TRIG_PRESETS.filter((p) => p.state.kind === "triangle-area")) {
      const state = normalizeState(cloneState(preset.state));
      assert.equal(state.triA.y, state.triB.y, preset.id);
    }
    const obtuse = normalizeState(cloneState(TRIG_PRESETS.find((p) => p.id === "tri-1357")!.state));
    almost(interiorAngleDeg([obtuse.triA, obtuse.triB, obtuse.triC], 1), 135, 0.5);
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
        const angleArcs = scene.cmds.filter(
          (c) => c.t === "arc" && !c.dashed && typeof c.id === "string" && c.id.startsWith("a:"),
        );
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

  it("nudgeLabel moves an angle number a little", () => {
    const start = normalizeState(cloneState(TRIG_PRESETS.find((p) => p.id === "right-306090")!.state));
    const shown = normalizeState({
      ...start,
      angles: start.angles.map((a) => (a.id === "A" ? { ...a, show: true } : a)),
    });
    const next = nudgeLabel(shown, "a:A", 12, -8);
    const mark = next.angles.find((a) => a.id === "A")!;
    almost(mark.label.dx, 12, 1e-6);
    almost(mark.label.dy, -8, 1e-6);
    const scene = buildTrigScene(next);
    const label = scene.texts.find((t) => t.id === "a:A");
    const base = buildTrigScene(shown).texts.find((t) => t.id === "a:A");
    assert.ok(label && base);
    almost(label.x, base.x + 12, 0.5);
    almost(label.y, base.y - 8, 0.5);
    const hit = hitTestTrig(
      scene.layout.canvas,
      scene.texts,
      scene.cmds,
      figureStrokes(next),
      next.segs,
      label.x,
      label.y,
      1,
      draggableIds(next),
    );
    assert.deepEqual(hit, { kind: "label", id: "a:A" });
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

  it("paints triangle fill and altitude in the chosen colors", () => {
    const base = normalizeState(cloneState(TRIG_PRESETS.find((p) => p.id === "tri-height")!.state));
    const greenPink = buildTrigScene(base);
    assert.ok(greenPink.cmds.some((c) => c.t === "polygon" && c.fill === "#d4edda"));
    assert.ok(greenPink.cmds.some((c) => c.t === "line" && c.stroke === "#e879a8"));

    const next = normalizeState({
      ...base,
      triFill: "blue",
      altitudeColor: "green",
      showTriFill: true,
      showAltitudeHighlight: true,
    });
    const scene = buildTrigScene(next);
    assert.ok(scene.cmds.some((c) => c.t === "polygon" && c.fill === "#c5dff0"));
    assert.ok(scene.cmds.some((c) => c.t === "line" && c.stroke === "#3d9b6d"));
  });

  it("paints quad fill in the chosen color", () => {
    const base = normalizeState(cloneState(TRIG_PRESETS.find((p) => p.id === "quad-para")!.state));
    const next = normalizeState({ ...base, quadFill: "yellow", showQuadFill: true });
    const scene = buildTrigScene(next);
    assert.ok(scene.cmds.some((c) => c.t === "polygon" && c.fill === "#fce88a"));
  });

  it("on-figure length edit of √3·3 keeps the other leg", () => {
    const start = normalizeState(cloneState(TRIG_PRESETS.find((p) => p.id === "right-sqrt3")!.state));
    const ab0 = segLength(start, findSeg(start, "AB")!);
    const next = applyEditedLabel(start, "s:BC", "5");
    almost(segLength(next, findSeg(next, "BC")!), 5, 1e-4);
    almost(segLength(next, findSeg(next, "AB")!), ab0, 1e-4);
    assert.ok(segLength(next, findSeg(next, "BC")!) > segLength(next, findSeg(next, "AB")!));
    assert.equal(resolveSegText(next, findSeg(next, "BC")!), "5");
    assert.equal(resolveSegText(next, findSeg(next, "AB")!), "$\\sqrt{3}$ cm");
  });

  it("length edit with a shown angle scales other sides and rewrites their labels", () => {
    const start = normalizeState(cloneState(TRIG_PRESETS.find((p) => p.id === "right-sqrt3")!.state));
    const shown = normalizeState({
      ...start,
      angles: start.angles.map((a) =>
        a.id === "A" ? { ...a, show: true, label: { ...a.label, mode: "custom" as const, custom: "60°" } } : a,
      ),
    });
    const next = applyEditedLabel(shown, "s:BC", "5");
    almost(segLength(next, findSeg(next, "BC")!), 5, 1e-4);
    almost(segLength(next, findSeg(next, "AB")!), (5 / 3) * Math.sqrt(3), 1e-3);
    assert.equal(resolveSegText(next, findSeg(next, "BC")!), "5");
    const abText = resolveSegText(next, findSeg(next, "AB")!);
    assert.equal(abText, "$\\frac{5\\sqrt{3}}{3}$ cm");
  });

  it("keeps unknown length letters after a numeric side edit", () => {
    const start = normalizeState(cloneState(TRIG_PRESETS.find((p) => p.id === "right-45xy")!.state));
    const next = applyEditedLabel(start, "s:AC", "8");
    almost(segLength(next, findSeg(next, "AC")!), 8, 1e-3);
    assert.equal(findSeg(next, "AB")!.label.mode, "x");
    assert.equal(findSeg(next, "BC")!.label.mode, "x");
    assert.equal(resolveSegText(next, findSeg(next, "AB")!), "$x$");
    assert.equal(resolveSegText(next, findSeg(next, "BC")!), "$y$");
  });

  it("leg number fields rewrite shown length labels to the computed sides", () => {
    const start = normalizeState(cloneState(TRIG_PRESETS.find((p) => p.id === "right-sqrt3")!.state));
    const next = rebuildTriangleFromLegs(start, 5, start.legRight);
    almost(segLength(next, findSeg(next, "AB")!), 5, 1e-4);
    almost(segLength(next, findSeg(next, "BC")!), 3, 1e-4);
    assert.equal(resolveSegText(next, findSeg(next, "AB")!), "5 cm");
    assert.equal(resolveSegText(next, findSeg(next, "BC")!), "3 cm");
  });

  it("직접 length text only changes the label, not the triangle", () => {
    const start = rebuildTriangleFromLegs(
      normalizeState(cloneState(TRIG_PRESETS.find((p) => p.id === "right-306090")!.state)),
      10,
      10 / Math.sqrt(3),
    );
    const ac0 = segLength(start, findSeg(start, "AC")!);
    const angB0 = interiorAngleDeg([start.A, start.B, start.C], 1);
    const next = setLengthDisplayText(start, "AC", "5.7");
    almost(segLength(next, findSeg(next, "AC")!), ac0, 1e-6);
    almost(interiorAngleDeg([next.A, next.B, next.C], 1), angB0, 1e-6);
    assert.equal(findSeg(next, "AC")!.label.mode, "custom");
    assert.equal(resolveSegText(next, findSeg(next, "AC")!), "5.7");
    const fromValue = applySegNumeric(next, "AC", 8);
    almost(segLength(fromValue, findSeg(fromValue, "AC")!), 8, 0.2);
    assert.equal(resolveSegText(fromValue, findSeg(fromValue, "AC")!), "5.7");
  });

  it("shows 30-60-90 sides as simplified radicals, not decimals", () => {
    const start = rebuildTriangleFromLegs(
      normalizeState(cloneState(TRIG_PRESETS.find((p) => p.id === "right-306090")!.state)),
      10,
      10 / Math.sqrt(3),
    );
    const shown = {
      ...start,
      segs: start.segs.map((s) => ({
        ...s,
        show: true,
        label: { ...s.label, mode: "auto" as const, custom: "" },
      })),
    };
    assert.equal(resolveSegText(shown, findSeg(shown, "BC")!), "10 cm");
    assert.equal(resolveSegText(shown, findSeg(shown, "AC")!), "$\\frac{10\\sqrt{3}}{3}$ cm");
    assert.equal(resolveSegText(shown, findSeg(shown, "AB")!), "$\\frac{20\\sqrt{3}}{3}$ cm");
  });

  it("shows the √3·3 hypotenuse as 2√3, not a decimal", () => {
    const start = normalizeState(cloneState(TRIG_PRESETS.find((p) => p.id === "right-sqrt3")!.state));
    const shown = {
      ...start,
      segs: start.segs.map((s) =>
        s.id === "AC" ? { ...s, show: true, label: { ...s.label, mode: "auto" as const, custom: "" } } : s,
      ),
    };
    assert.equal(resolveSegText(shown, findSeg(shown, "AC")!), "$2\\sqrt{3}$ cm");
  });

  it("custom length mode keeps free text like 4m without forcing the unit", () => {
    const start = normalizeState(cloneState(TRIG_PRESETS.find((p) => p.id === "right-sqrt3")!.state));
    const custom = {
      ...start,
      segs: start.segs.map((s) =>
        s.id === "BC"
          ? { ...s, show: true, label: { ...s.label, mode: "custom" as const, custom: "4m" } }
          : s,
      ),
    };
    assert.equal(resolveSegText(custom, findSeg(custom, "BC")!), "4m");
    const plain = applyEditedLabel(start, "s:BC", "4");
    assert.equal(resolveSegText(plain, findSeg(plain, "BC")!), "4");
  });

  it("snaps rotation near multiples of 10°", () => {
    assert.equal(snapRotateDeg(28), 30);
    assert.equal(snapRotateDeg(31.5), 30);
    assert.equal(snapRotateDeg(34), 34);
    assert.equal(snapRotateDeg(358), 0);
  });

  it("crops export bounds tighter than the square canvas", () => {
    const scene = buildTrigScene(normalizeState(cloneState(TRIG_PRESETS.find((p) => p.id === "right-sqrt3")!.state)));
    const box = sceneInkBox(scene, 12);
    // Dim arcs inflate the axis-aligned box; still expect a clear vertical trim for PNG/SVG crop.
    assert.ok(box.h < scene.height - 20, `${box.h} vs ${scene.height}`);
    assert.ok(box.w * box.h < scene.width * scene.height);
  });

  it("on-figure length edit changes the named triangle side", () => {
    const start = normalizeState(cloneState(TRIG_PRESETS.find((p) => p.id === "tri-height")!.state));
    const next = applyEditedLabel(start, "s:AC", "4");
    almost(segLength(next, findSeg(next, "AC")!), 4, 0.2);
    assert.match(findSeg(next, "AB")!.label.custom, /c/);
    assert.equal(resolveSegText(next, findSeg(next, "AB")!), "$c$");
  });

  it("moving a point rewrites shown length and angle numbers", () => {
    const start = normalizeState(cloneState(TRIG_PRESETS.find((p) => p.id === "right-sqrt3")!.state));
    const shown = {
      ...start,
      angles: start.angles.map((a) =>
        a.id === "A" ? { ...a, show: true, label: { ...a.label, mode: "custom" as const, custom: "60°" } } : a,
      ),
    };
    const ab0 = segLength(shown, findSeg(shown, "AB")!);
    const next = movePoint(shown, "A", { x: shown.A.x + 1.2, y: shown.A.y + 0.8 });
    const ab1 = segLength(next, findSeg(next, "AB")!);
    assert.ok(Math.abs(ab1 - ab0) > 0.2);
    assert.equal(findSeg(next, "AB")!.label.mode, "auto");
    assert.equal(findAngle(next, "A")!.label.mode, "auto");
    const scene = buildTrigScene(next);
    const abText = scene.texts.find((t) => t.id === "s:AB");
    assert.ok(abText);
    assert.notEqual(abText.runs.map((r) => r.text).join(""), "$\\sqrt{3}$ cm");
    const angText = scene.texts.find((t) => t.id === "a:A");
    assert.ok(angText);
    assert.match(angText.runs.map((r) => r.text).join(""), /^\d+(\.\d)?°$/);
  });

  it("keeps a previously typed angle when a later side is typed", () => {
    const start = normalizeState(cloneState(TRIG_PRESETS.find((p) => p.id === "right-sqrt3")!.state));
    const withAngle = applyEditedLabel(start, "a:A", "50");
    almost(interiorAngleDeg([withAngle.A, withAngle.B, withAngle.C], 0), 50, 0.6);
    const next = applyEditedLabel(withAngle, "s:BC", "5");
    almost(segLength(next, findSeg(next, "BC")!), 5, 0.2);
    almost(interiorAngleDeg([next.A, next.B, next.C], 0), 50, 0.6);
  });

  it("keeps a previously typed side when a later angle is typed", () => {
    const start = normalizeState(cloneState(TRIG_PRESETS.find((p) => p.id === "right-sqrt3")!.state));
    const withLen = applyEditedLabel(start, "s:BC", "5");
    almost(segLength(withLen, findSeg(withLen, "BC")!), 5, 1e-4);
    const ab = segLength(withLen, findSeg(withLen, "AB")!);
    const next = applyEditedLabel(withLen, "a:A", "40");
    almost(interiorAngleDeg([next.A, next.B, next.C], 0), 40, 0.6);
    almost(segLength(next, findSeg(next, "AB")!), ab, 0.2);
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
    assert.equal(start.showAngleY, false);
    assert.equal(start.showAngleZ, false);
    const hidden = buildTrigScene(start);
    assert.ok(!hidden.texts.some((t) => t.id === "a:y"));
    assert.ok(!hidden.texts.some((t) => t.id === "a:z"));
    const onlyY = normalizeState({ ...start, showAngleY: true, showAngleZ: false });
    const scene = buildTrigScene(onlyY);
    assert.ok(scene.texts.some((t) => t.id === "a:y"));
    assert.ok(!scene.texts.some((t) => t.id === "a:z"));
    const noTan = normalizeState({ ...start, showTanValue: false, showCosValue: true });
    const values = buildTrigScene(noTan);
    assert.ok(values.texts.some((t) => t.id === "axis:Ax"));
    assert.ok(!values.texts.some((t) => t.id === "axis:Dy"));
  });

  it("general quad angle edit preserves previously typed angles and keeps sum to 360°", () => {
    const start = normalizeState({ kind: "quad-area", quadFamily: "general" });
    // Step 1: User edits angle B (v:1) to 60°
    const step1 = applyEditedLabel(start, "v:1", "60");
    almost(interiorAngleDeg(step1.quadPoints, 1), 60, 0.5);
    const sum1 = [0, 1, 2, 3].reduce((acc, i) => acc + interiorAngleDeg(step1.quadPoints, i), 0);
    almost(sum1, 360, 0.5);

    // Step 2: User edits angle A (v:0) to 110° -> B must stay 60°
    const step2 = applyEditedLabel(step1, "v:0", "110");
    almost(interiorAngleDeg(step2.quadPoints, 0), 110, 0.5);
    almost(interiorAngleDeg(step2.quadPoints, 1), 60, 0.5);
    const sum2 = [0, 1, 2, 3].reduce((acc, i) => acc + interiorAngleDeg(step2.quadPoints, i), 0);
    almost(sum2, 360, 0.5);

    // Step 3: User edits angle C (v:2) to 70° -> A(110°) and B(60°) stay, D automatically becomes 120°
    const step3 = applyEditedLabel(step2, "v:2", "70");
    almost(interiorAngleDeg(step3.quadPoints, 0), 110, 0.5);
    almost(interiorAngleDeg(step3.quadPoints, 1), 60, 0.5);
    almost(interiorAngleDeg(step3.quadPoints, 2), 70, 0.5);
    almost(interiorAngleDeg(step3.quadPoints, 3), 120, 0.5);
    const sum3 = [0, 1, 2, 3].reduce((acc, i) => acc + interiorAngleDeg(step3.quadPoints, i), 0);
    almost(sum3, 360, 0.5);

    // Step 4: User edits angle D (v:3) to 80° -> oldest (B) yields, A(110°), C(70°), D(80°) stay, B becomes 100°
    const step4 = applyEditedLabel(step3, "v:3", "80");
    almost(interiorAngleDeg(step4.quadPoints, 0), 110, 0.5);
    almost(interiorAngleDeg(step4.quadPoints, 2), 70, 0.5);
    almost(interiorAngleDeg(step4.quadPoints, 3), 80, 0.5);
    almost(interiorAngleDeg(step4.quadPoints, 1), 100, 0.5);
  });

  it("parallelogram mode keeps opposite sides and angles equal on edits", () => {
    const start = normalizeState(cloneState(TRIG_PRESETS.find((p) => p.id === "quad-60150")!.state));
    const para = setQuadFamily(start, "parallelogram");
    assert.equal(para.quadFamily, "parallelogram");

    // D should be A + (C - B)
    const [A, B, C, D] = para.quadPoints;
    almost(D.x, A.x + C.x - B.x, 1e-4);
    almost(D.y, A.y + C.y - B.y, 1e-4);

    // Opposite angles equal, adjacent sum to 180°
    const angA = interiorAngleDeg(para.quadPoints, 0);
    const angB = interiorAngleDeg(para.quadPoints, 1);
    const angC = interiorAngleDeg(para.quadPoints, 2);
    const angD = interiorAngleDeg(para.quadPoints, 3);
    almost(angA, angC, 0.1);
    almost(angB, angD, 0.1);
    almost(angA + angB, 180, 0.1);

    // Change angle B to 50°
    const editedAng = applyEditedLabel(para, "v:1", "50");
    almost(interiorAngleDeg(editedAng.quadPoints, 1), 50, 0.2);
    almost(interiorAngleDeg(editedAng.quadPoints, 3), 50, 0.2);
    almost(interiorAngleDeg(editedAng.quadPoints, 0), 130, 0.2);
    almost(interiorAngleDeg(editedAng.quadPoints, 2), 130, 0.2);

    // Change side AB to 6
    const editedSide = applyEditedLabel(editedAng, "s:AB", "6");
    const lenAB = Math.hypot(editedSide.quadPoints[0].x - editedSide.quadPoints[1].x, editedSide.quadPoints[0].y - editedSide.quadPoints[1].y);
    const lenCD = Math.hypot(editedSide.quadPoints[2].x - editedSide.quadPoints[3].x, editedSide.quadPoints[2].y - editedSide.quadPoints[3].y);
    almost(lenAB, 6, 0.1);
    almost(lenCD, 6, 0.1);

    // Drag point A -> D moves together, parallelogram preserved
    const dragged = movePoint(editedSide, "A", { x: editedSide.quadPoints[0].x + 1, y: editedSide.quadPoints[0].y + 0.5 });
    const [dA, dB, dC, dD] = dragged.quadPoints;
    almost(dD.x, dA.x + dC.x - dB.x, 1e-4);
    almost(dD.y, dA.y + dC.y - dB.y, 1e-4);
  });

  it("supports rotating triangle-area figure while preserving side lengths and angles", () => {
    const start = normalizeState(cloneState(TRIG_PRESETS.find((p) => p.id === "tri-608")!.state));
    const origMath = trianglePoints(start);
    const origAB = Math.hypot(origMath.B.x - origMath.A.x, origMath.B.y - origMath.A.y);
    const origAngA = interiorAngleDeg([origMath.A, origMath.B, origMath.C], 0);

    const rotated = setRotateDeg(start, 45);
    const rotMath = trianglePoints(rotated);
    const rotAB = Math.hypot(rotMath.B.x - rotMath.A.x, rotMath.B.y - rotMath.A.y);
    const rotAngA = interiorAngleDeg([rotMath.A, rotMath.B, rotMath.C], 0);

    almost(rotAB, origAB, 1e-4);
    almost(rotAngA, origAngA, 1e-4);

    assert.notEqual(rotMath.A.x, origMath.A.x);
    assert.notEqual(rotMath.A.y, origMath.A.y);

    const scene = buildTrigScene(rotated);
    assert.ok(scene.texts.length > 0);
    assert.ok(scene.cmds.length > 0);
  });

  it("supports both quad diagonals AC and BD independently, and 4 intersection angles", () => {
    const base = normalizeState(cloneState(TRIG_PRESETS.find((p) => p.id === "quad-diag")!.state));

    // 1. Initially quad-diag has showQuadDiagBD: true and showQuadDiagAC: false
    assert.equal(base.showQuadDiagBD, true);
    assert.equal(base.showQuadDiagAC, false);
    const sceneBD = buildTrigScene(base);
    const bdLines = sceneBD.cmds.filter((c) => c.t === "line" && c.stroke === "#e879a8");
    assert.equal(bdLines.length, 1);

    // 2. Only showQuadDiagAC
    const onlyAC = { ...base, showQuadDiagAC: true, showQuadDiagBD: false, showQuadDiagonal: false };
    const sceneAC = buildTrigScene(onlyAC);
    const acLines = sceneAC.cmds.filter((c) => c.t === "line" && c.stroke === "#e879a8");
    assert.equal(acLines.length, 1);

    // 3. Both diagonals on
    const both = { ...base, showQuadDiagAC: true, showQuadDiagBD: true };
    const sceneBoth = buildTrigScene(both);
    const bothLines = sceneBoth.cmds.filter((c) => c.t === "line" && c.stroke === "#e879a8");
    assert.equal(bothLines.length, 2);

    // Check intersection math
    const O = quadDiagonalIntersection(both.quadPoints);
    assert.ok(Number.isFinite(O.x) && Number.isFinite(O.y));

    // Check 4 intersection angles: supplementary & vertically opposite
    const aob = quadDiagAngleDeg(both.quadPoints, "AOB");
    const boc = quadDiagAngleDeg(both.quadPoints, "BOC");
    const cod = quadDiagAngleDeg(both.quadPoints, "COD");
    const doa = quadDiagAngleDeg(both.quadPoints, "DOA");

    almost(aob + boc, 180, 0.01);
    almost(cod + doa, 180, 0.01);
    almost(aob, cod, 0.01);
    almost(boc, doa, 0.01);

    // 4. Toggle intersection angles
    const withAngles = patchQuadDiagAngle(
      patchQuadDiagAngle(both, "AOB", { show: true, fill: "pink" }),
      "BOC",
      { show: true, fill: "blue" },
    );
    const sceneAngles = buildTrigScene(withAngles);
    const aobArc = sceneAngles.cmds.find((c) => c.t === "arc" && c.id === "a:AOB");
    const bocArc = sceneAngles.cmds.find((c) => c.t === "arc" && c.id === "a:BOC");
    const codArc = sceneAngles.cmds.find((c) => c.t === "arc" && c.id === "a:COD");
    assert.ok(aobArc, "AOB arc should be rendered");
    assert.ok(bocArc, "BOC arc should be rendered");
    assert.equal(codArc, undefined, "COD arc should not be rendered");

    // Check angle fill polygons rendered
    const pinkFill = sceneAngles.cmds.find((c) => c.t === "polygon" && c.fill === "#f7c8d2");
    const blueFill = sceneAngles.cmds.find((c) => c.t === "polygon" && c.fill === "#c5dff0");
    assert.ok(pinkFill, "AOB pink fill should be rendered");
    assert.ok(blueFill, "BOC blue fill should be rendered");

    // 5. Edit angle label (e.g. unknown x or custom)
    const withX = applyEditedLabel(withAngles, "a:AOB", "x");
    const markAOB = withX.quadDiagAngles.find((a) => a.id === "AOB");
    assert.equal(markAOB?.label.mode, "x");
    const sceneX = buildTrigScene(withX);
    const aobText = sceneX.texts.find((t) => t.id === "a:AOB");
    assert.ok(aobText, "AOB text should be rendered");

    // 6. Nudge angle label
    const nudged = nudgeLabel(withX, "a:AOB", 10, -5);
    const nudgedMark = nudged.quadDiagAngles.find((a) => a.id === "AOB");
    assert.equal(nudgedMark?.label.dx, 10);
    assert.equal(nudgedMark?.label.dy, -5);

    // 7. Diagonal color configuration (global and per-diagonal)
    const withBlue = { ...both, quadDiagColor: "blue" as const, quadDiagColorAC: "blue" as const, quadDiagColorBD: "blue" as const };
    const sceneBlue = buildTrigScene(withBlue);
    const blueLines = sceneBlue.cmds.filter((c) => c.t === "line" && c.stroke === "#5b8fc7");
    assert.equal(blueLines.length, 2);

    const withBlack = { ...both, quadDiagColor: "black" as const, quadDiagColorAC: "black" as const, quadDiagColorBD: "black" as const };
    const sceneBlack = buildTrigScene(withBlack);
    const blackDiagLines = sceneBlack.cmds.filter(
      (c) => c.t === "line" && c.stroke === "#111111" && (c.width ?? 0) > withBlack.style.lineWidth,
    );
    assert.equal(blackDiagLines.length, 2);

    // Independent colors: AC blue, BD green
    const withDiff = { ...both, quadDiagColorAC: "blue" as const, quadDiagColorBD: "green" as const };
    const sceneDiff = buildTrigScene(withDiff);
    const acDiff = sceneDiff.cmds.find((c) => c.t === "line" && c.stroke === "#5b8fc7");
    const bdDiff = sceneDiff.cmds.find((c) => c.t === "line" && c.stroke === "#3d9b6d");
    assert.ok(acDiff, "AC should have blue stroke");
    assert.ok(bdDiff, "BD should have green stroke");
  });

  it("adjusts quadrilateral geometry when diagonal intersection angle is modified", () => {
    // Test parallelogram mode
    const paraBase = normalizeState(cloneState(TRIG_PRESETS.find((p) => p.id === "quad-para")!.state));
    const paraWithDiags = {
      ...paraBase,
      showQuadDiagAC: true,
      showQuadDiagBD: true,
    };

    const origD1 = Math.hypot(
      paraWithDiags.quadPoints[2].x - paraWithDiags.quadPoints[0].x,
      paraWithDiags.quadPoints[2].y - paraWithDiags.quadPoints[0].y,
    );
    const origD2 = Math.hypot(
      paraWithDiags.quadPoints[3].x - paraWithDiags.quadPoints[1].x,
      paraWithDiags.quadPoints[3].y - paraWithDiags.quadPoints[1].y,
    );

    // 1. Adjust AOB to 60° in parallelogram
    const edited60 = applyEditedLabel(paraWithDiags, "a:AOB", "60");
    const aob60 = quadDiagAngleDeg(edited60.quadPoints, "AOB");
    const boc60 = quadDiagAngleDeg(edited60.quadPoints, "BOC");
    almost(aob60, 60, 0.1);
    almost(boc60, 120, 0.1);

    // Check parallelogram properties preserved
    const [A60, B60, C60, D60] = edited60.quadPoints;
    almost(D60.x, A60.x + C60.x - B60.x, 1e-4);
    almost(D60.y, A60.y + C60.y - B60.y, 1e-4);
    almost(B60.y, C60.y, 1e-4); // Base BC is horizontal
    almost(A60.y, D60.y, 1e-4); // Top AD is horizontal

    // Check diagonal lengths preserved
    const newD1 = Math.hypot(C60.x - A60.x, C60.y - A60.y);
    const newD2 = Math.hypot(D60.x - B60.x, D60.y - B60.y);
    almost(newD1, origD1, 1e-3);
    almost(newD2, origD2, 1e-3);

    // 2. Adjust BOC to 100° in parallelogram
    const editedBOC = applyEditedLabel(edited60, "a:BOC", "100");
    const aob100 = quadDiagAngleDeg(editedBOC.quadPoints, "AOB");
    const boc100 = quadDiagAngleDeg(editedBOC.quadPoints, "BOC");
    almost(boc100, 100, 0.1);
    almost(aob100, 80, 0.1);

    const [Ab, Bb, Cb, Db] = editedBOC.quadPoints;
    almost(Db.x, Ab.x + Cb.x - Bb.x, 1e-4);
    almost(Db.y, Ab.y + Cb.y - Bb.y, 1e-4);

    // 3. Test general quad mode
    const genBase = normalizeState(cloneState(TRIG_PRESETS.find((p) => p.id === "quad-diag")!.state));
    const genWithDiags = {
      ...genBase,
      showQuadDiagAC: true,
      showQuadDiagBD: true,
    };

    const genEdited = applyEditedLabel(genWithDiags, "a:AOB", "70");
    const genAOB = quadDiagAngleDeg(genEdited.quadPoints, "AOB");
    const genBOC = quadDiagAngleDeg(genEdited.quadPoints, "BOC");
    almost(genAOB, 70, 0.1);
    almost(genBOC, 110, 0.1);
  });

  it("adjusts diagonal length while preserving diagonal angle and parallelogram properties", () => {
    // 1. Parallelogram test
    const paraBase = normalizeState(cloneState(TRIG_PRESETS.find((p) => p.id === "quad-para")!.state));
    const para = {
      ...paraBase,
      showQuadDiagAC: true,
      showQuadDiagBD: true,
    };

    const origAOB = quadDiagAngleDeg(para.quadPoints, "AOB");
    const origD2 = Math.hypot(
      para.quadPoints[3].x - para.quadPoints[1].x,
      para.quadPoints[3].y - para.quadPoints[1].y,
    );

    // Edit diagonal AC length to 10
    const editedAC = applyEditedLabel(para, "s:AC", "10");
    const lenAC = Math.hypot(
      editedAC.quadPoints[2].x - editedAC.quadPoints[0].x,
      editedAC.quadPoints[2].y - editedAC.quadPoints[0].y,
    );
    const lenBD = Math.hypot(
      editedAC.quadPoints[3].x - editedAC.quadPoints[1].x,
      editedAC.quadPoints[3].y - editedAC.quadPoints[1].y,
    );
    const newAOB = quadDiagAngleDeg(editedAC.quadPoints, "AOB");

    almost(lenAC, 10, 0.1);
    almost(lenBD, origD2, 0.1); // BD length preserved
    almost(newAOB, origAOB, 0.1); // Intersection angle preserved!

    // Check parallelogram properties
    const [A, B, C, D] = editedAC.quadPoints;
    almost(D.x, A.x + C.x - B.x, 1e-4);
    almost(D.y, A.y + C.y - B.y, 1e-4);
    almost(B.y, 0, 1e-4);
    almost(C.y, 0, 1e-4); // Base BC horizontal

    // Check diagonals bisect each other: midpoint of AC == midpoint of BD
    almost((A.x + C.x) / 2, (B.x + D.x) / 2, 1e-4);
    almost((A.y + C.y) / 2, (B.y + D.y) / 2, 1e-4);

    // Check dimension lines painted
    const sceneAC = buildTrigScene(editedAC);
    const acDimText = sceneAC.texts.find((t) => t.id === "s:AC");
    assert.ok(acDimText, "AC dimension label should be rendered");

    // Edit diagonal BD length to 8
    const editedBD = applyEditedLabel(editedAC, "s:BD", "8");
    const lenAC2 = Math.hypot(
      editedBD.quadPoints[2].x - editedBD.quadPoints[0].x,
      editedBD.quadPoints[2].y - editedBD.quadPoints[0].y,
    );
    const lenBD2 = Math.hypot(
      editedBD.quadPoints[3].x - editedBD.quadPoints[1].x,
      editedBD.quadPoints[3].y - editedBD.quadPoints[1].y,
    );
    const newAOB2 = quadDiagAngleDeg(editedBD.quadPoints, "AOB");

    almost(lenAC2, 10, 0.1); // AC length preserved
    almost(lenBD2, 8, 0.1); // BD length updated to 8
    almost(newAOB2, origAOB, 0.1); // Angle still preserved!

    const [A2, B2, C2, D2] = editedBD.quadPoints;
    almost(D2.x, A2.x + C2.x - B2.x, 1e-4);
    almost(D2.y, A2.y + C2.y - B2.y, 1e-4);

    // 2. General quadrilateral test
    const genBase = normalizeState(cloneState(TRIG_PRESETS.find((p) => p.id === "quad-diag")!.state));
    const gen = {
      ...genBase,
      showQuadDiagAC: true,
      showQuadDiagBD: true,
    };
    const genOrigAOB = quadDiagAngleDeg(gen.quadPoints, "AOB");
    const genOrigBD = Math.hypot(
      gen.quadPoints[3].x - gen.quadPoints[1].x,
      gen.quadPoints[3].y - gen.quadPoints[1].y,
    );

    const genEdited = applyEditedLabel(gen, "s:AC", "12");
    const genLenAC = Math.hypot(
      genEdited.quadPoints[2].x - genEdited.quadPoints[0].x,
      genEdited.quadPoints[2].y - genEdited.quadPoints[0].y,
    );
    const genLenBD = Math.hypot(
      genEdited.quadPoints[3].x - genEdited.quadPoints[1].x,
      genEdited.quadPoints[3].y - genEdited.quadPoints[1].y,
    );
    const genNewAOB = quadDiagAngleDeg(genEdited.quadPoints, "AOB");

    almost(genLenAC, 12, 0.1);
    almost(genLenBD, genOrigBD, 0.1);
    almost(genNewAOB, genOrigAOB, 0.1);
  });

  it("preserves custom units and free-form text on diagonals and sides", () => {
    const base = normalizeState(cloneState(TRIG_PRESETS.find((p) => p.id === "quad-para")!.state));
    const withDiags = {
      ...base,
      showQuadDiagAC: true,
      showQuadDiagBD: true,
    };

    // 1. Diagonal AC with "10cm"
    const with10cm = applyEditedLabel(withDiags, "s:AC", "10cm");
    assert.equal(with10cm.quadDiagEdges.AC.length.mode, "custom");
    assert.equal(with10cm.quadDiagEdges.AC.length.custom, "10cm");
    const lenAC = Math.hypot(
      with10cm.quadPoints[2].x - with10cm.quadPoints[0].x,
      with10cm.quadPoints[2].y - with10cm.quadPoints[0].y,
    );
    almost(lenAC, 10, 0.1);

    const scene10cm = buildTrigScene(with10cm);
    const acText = scene10cm.texts.find((t) => t.id === "s:AC");
    assert.ok(acText);
    const combined10cm = acText.runs.map((r) => r.text).join("");
    assert.ok(combined10cm.includes("10") && combined10cm.includes("cm"));

    // 2. Diagonal BD with "cm" only
    const origBD = Math.hypot(
      withDiags.quadPoints[3].x - withDiags.quadPoints[1].x,
      withDiags.quadPoints[3].y - withDiags.quadPoints[1].y,
    );
    const withCm = applyEditedLabel(withDiags, "s:BD", "cm");
    assert.equal(withCm.quadDiagEdges.BD.length.mode, "custom");
    assert.equal(withCm.quadDiagEdges.BD.length.custom, "cm");
    const lenBD = Math.hypot(
      withCm.quadPoints[3].x - withCm.quadPoints[1].x,
      withCm.quadPoints[3].y - withCm.quadPoints[1].y,
    );
    almost(lenBD, origBD, 1e-3);

    const sceneCm = buildTrigScene(withCm);
    const bdText = sceneCm.texts.find((t) => t.id === "s:BD");
    assert.ok(bdText);
    assert.equal(bdText.runs.map((r) => r.text).join(""), "cm");

    // 3. Diagonal with free text "4m" and math sqrt
    const with4m = applyEditedLabel(withDiags, "s:AC", "4m");
    assert.equal(with4m.quadDiagEdges.AC.length.custom, "4m");

    const withSqrt = applyEditedLabel(withDiags, "s:AC", "√3 cm");
    assert.equal(withSqrt.quadDiagEdges.AC.length.custom, "√3 cm");

    // 4. Parallelogram side AB with "6cm"
    const withSideCm = applyEditedLabel(withDiags, "s:AB", "6cm");
    const edgeAB = withSideCm.quadEdges[0]!;
    assert.equal(edgeAB.length.mode, "custom");
    assert.equal(edgeAB.length.custom, "6cm");
  });
});
