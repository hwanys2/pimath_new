import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  altitudeFoot,
  angleBisectorFoot,
  applyEditedLabel,
  applyEqualApex,
  applyIsoAngle,
  applyIsoLength,
  cevianFromIndex,
  edgeLength,
  footPoint,
  moveVertexIso,
  oppositeSide,
  snapIsosceles,
  wedgeDeg,
} from "./geometry";
import {
  ISO_PRESETS,
  cloneState,
  isoscelesFromVertex,
  makeCevian,
  mapCevian,
  normalizeState,
  setCevianRole,
  toggleCevian,
  triangleFromAngles,
} from "./model";
import { buildIsoscelesScene } from "./scene";

function almost(a: number, b: number, eps = 1e-3): void {
  assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
}

describe("isosceles geometry", () => {
  it("snapIsosceles makes the legs equal", () => {
    const pts = [
      { x: 0.4, y: 4 },
      { x: -2.5, y: 0 },
      { x: 2.5, y: 0 },
    ];
    const snapped = snapIsosceles(pts, 0);
    const ab = Math.hypot(snapped[0]!.x - snapped[1]!.x, snapped[0]!.y - snapped[1]!.y);
    const ac = Math.hypot(snapped[0]!.x - snapped[2]!.x, snapped[0]!.y - snapped[2]!.y);
    almost(ab, ac, 1e-6);
  });

  it("altitude foot is perpendicular", () => {
    const A = { x: 0, y: 4 };
    const B = { x: -3, y: 0 };
    const C = { x: 3, y: 0 };
    const D = altitudeFoot(A, B, C);
    const BC = { x: C.x - B.x, y: C.y - B.y };
    const DA = { x: A.x - D.x, y: A.y - D.y };
    almost(BC.x * DA.x + BC.y * DA.y, 0, 1e-6);
  });

  it("angle bisector divides the opposite side in the ratio of the legs", () => {
    const pts = triangleFromAngles(40, 60, 80, 6);
    const A = pts[0]!;
    const B = pts[1]!;
    const C = pts[2]!;
    const D = angleBisectorFoot(A, B, C);
    const ab = Math.hypot(A.x - B.x, A.y - B.y);
    const ac = Math.hypot(A.x - C.x, A.y - C.y);
    const db = Math.hypot(D.x - B.x, D.y - B.y);
    const dc = Math.hypot(D.x - C.x, D.y - C.y);
    almost(db / dc, ab / ac, 1e-4);
  });

  it("changing the vertex angle of a locked isosceles keeps the legs equal", () => {
    const state = normalizeState(ISO_PRESETS[0]!.state);
    const next = applyIsoAngle(state, 0, 40);
    const ab = Math.hypot(
      next.points[0]!.x - next.points[1]!.x,
      next.points[0]!.y - next.points[1]!.y,
    );
    const ac = Math.hypot(
      next.points[0]!.x - next.points[2]!.x,
      next.points[0]!.y - next.points[2]!.y,
    );
    almost(ab, ac, 1e-4);
    almost(next.interiorAnglesDeg[0]!, 40, 0.3);
  });

  it("changing a vertex angle keeps the base horizontal", () => {
    const state = normalizeState(ISO_PRESETS[0]!.state);
    const next = applyIsoAngle(state, 0, 30);
    almost(next.points[1]!.y, next.points[2]!.y, 1e-6);
    almost(next.interiorAnglesDeg[0]!, 30, 0.3);
    assert.equal(next.vertices[0]!.interior.custom, "30°");
    assert.equal(next.vertices[1]!.interior.mode, "x");
  });

  it("levels a tilted base after an angle edit", () => {
    const state = normalizeState({
      ...ISO_PRESETS[0]!.state,
      points: [
        { x: 0.2, y: 4 },
        { x: -2.5, y: 0 },
        { x: 2.4, y: 1.2 },
      ],
    });
    const next = applyEditedLabel(state, "v:0:interior", "30°");
    almost(next.points[1]!.y, next.points[2]!.y, 1e-6);
    assert.ok(next.points[0]!.y > next.points[1]!.y);
    almost(next.interiorAnglesDeg[0]!, 30, 0.3);
  });

  it("clears equal-side ticks when isosceles is turned off", () => {
    const state = normalizeState(ISO_PRESETS[0]!.state);
    assert.ok(state.edges.some((e) => e.ticks > 0));
    const next = applyEqualApex(state, "none");
    assert.equal(next.equalApex, "none");
    assert.equal(next.lockEqual, false);
    assert.ok(next.edges.every((e) => e.ticks === 0));
  });

  it("redraws so the newly chosen equal sides match", () => {
    const state = normalizeState(ISO_PRESETS[0]!.state);
    const next = applyEqualApex(state, "B");
    assert.equal(next.equalApex, "B");
    almost(edgeLength(next.points, 0), edgeLength(next.points, 1), 1e-4);
    assert.equal(next.edges[0]!.ticks > 0, true);
    assert.equal(next.edges[1]!.ticks > 0, true);
    assert.equal(next.edges[2]!.ticks, 0);
  });

  it("keeps the other equal side in lockstep when one leg length changes", () => {
    const state = normalizeState(ISO_PRESETS[0]!.state);
    const next = applyIsoLength(state, 0, 8);
    almost(edgeLength(next.points, 0), 8, 1e-3);
    almost(edgeLength(next.points, 0), edgeLength(next.points, 2), 1e-4);
    const base = edgeLength(state.points, 1);
    almost(edgeLength(next.points, 1), base, 1e-3);
  });

  it("updates numeric angle labels when a vertex is dragged", () => {
    const state = normalizeState(ISO_PRESETS[0]!.state);
    const apex = state.points[0]!;
    const next = moveVertexIso(state, 0, { x: apex.x, y: apex.y + 2 });
    almost(next.points[1]!.y, next.points[2]!.y, 1e-6);
    assert.notEqual(next.vertices[0]!.interior.custom, "50°");
    assert.match(next.vertices[0]!.interior.custom, /°$/);
    assert.equal(next.vertices[1]!.interior.mode, "x");
    assert.equal(next.vertices[1]!.interior.custom, "x");
  });
});

describe("presets", () => {
  it("every preset builds a finite scene", () => {
    for (const preset of ISO_PRESETS) {
      const state = normalizeState(cloneState(preset.state));
      const scene = buildIsoscelesScene(state);
      assert.ok(scene.cmds.length > 2, preset.id);
      assert.equal(scene.layout.canvas.length, 3);
      for (const p of scene.layout.canvas) {
        assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y), preset.id);
      }
      for (const text of scene.texts) {
        assert.ok(Number.isFinite(text.x) && Number.isFinite(text.y), text.id);
      }
    }
  });

  it("base-angle draws equal-side ticks and a filled unknown", () => {
    const scene = buildIsoscelesScene(ISO_PRESETS[0]!.state);
    const ticks = scene.cmds.filter((c) => c.t === "line" && !c.id && !c.dashed);
    assert.ok(ticks.length >= 4, "two sides × two ticks");
    assert.ok(scene.cmds.some((c) => c.t === "polygon"));
    assert.ok(scene.texts.some((t) => t.id === "v:0:interior"));
    assert.ok(scene.texts.some((t) => t.id === "v:1:interior"));
  });

  it("exterior preset extends a side", () => {
    const scene = buildIsoscelesScene(ISO_PRESETS[1]!.state);
    assert.ok(scene.texts.some((t) => t.id === "v:2:exterior"));
    assert.ok(scene.texts.some((t) => t.id === "v:0:interior"));
  });

  it("altitude preset drops D on BC and marks a right angle", () => {
    const state = ISO_PRESETS[2]!.state;
    const D = footPoint(state);
    assert.ok(D);
    const from = cevianFromIndex(state);
    assert.equal(from, 0);
    const [i, j] = oppositeSide(0);
    almost(D!.y, state.points[i]!.y, 0.05);
    almost(D!.x, (state.points[i]!.x + state.points[j]!.x) / 2, 0.05);
    const scene = buildIsoscelesScene(state);
    assert.ok(scene.cmds.some((c) => c.t === "rightAngle"));
    assert.ok(scene.texts.some((t) => t.id === "w:A:apexLeft"));
    assert.ok(scene.texts.some((t) => t.id === "p:A:left:length"));
    assert.ok(scene.layout.foot);
  });

  it("nested preset keeps D on AB with a 28° split at C", () => {
    const state = ISO_PRESETS[4]!.state;
    const D = footPoint(state)!;
    const A = state.points[0]!;
    const B = state.points[1]!;
    const C = state.points[2]!;
    const cross = (B.x - A.x) * (D.y - A.y) - (B.y - A.y) * (D.x - A.x);
    almost(cross, 0, 0.05);
    const bcd = wedgeDeg(C, B, D);
    almost(bcd, 28, 1.2);
    const scene = buildIsoscelesScene(state);
    assert.ok(scene.texts.some((t) => t.id === "w:C:apexRight"));
    assert.ok(scene.texts.some((t) => t.id === "p:C:right:length"));
  });

  it("golden preset places a bisector from B and dots on the split angles", () => {
    const state = ISO_PRESETS[5]!.state;
    assert.equal(state.cevians[0]?.from, "B");
    assert.equal(state.cevians[0]?.role, "bisector");
    const scene = buildIsoscelesScene(state);
    const dots = scene.cmds.filter((c) => c.t === "dot");
    assert.ok(dots.length >= 5, "A,B,C,D plus two angle dots");
    assert.ok(scene.cmds.some((c) => c.t === "polygon"));
  });

  it("can draw two cevians at once", () => {
    let state = normalizeState(ISO_PRESETS[2]!.state);
    const added = toggleCevian(state, "B");
    state = setCevianRole(added.state, "B", "bisector");
    assert.equal(state.cevians.length, 2);
    const scene = buildIsoscelesScene(state);
    assert.equal(scene.layout.feet.length, 2);
    assert.ok(scene.cmds.some((c) => c.t === "rightAngle"));
    assert.equal(state.cevians.find((c) => c.from === "B")?.showBisectorMarks, true);
  });

  it("toggles altitude right-angle and midpoint ticks", () => {
    let state = normalizeState({
      ...ISO_PRESETS[0]!.state,
      cevians: [makeCevian({ from: "A", role: "altitude", showRightAtD: true })],
    });
    let scene = buildIsoscelesScene(state);
    assert.ok(scene.cmds.some((c) => c.t === "rightAngle"));
    state = mapCevian(state, "A", (c) => ({ ...c, showRightAtD: false }));
    scene = buildIsoscelesScene(state);
    assert.ok(!scene.cmds.some((c) => c.t === "rightAngle"));

    state = mapCevian(state, "A", (c) => ({
      ...c,
      role: "midpoint" as const,
      showMidpointTicks: true,
    }));
    scene = buildIsoscelesScene(state);
    const tickLines = scene.cmds.filter((c) => c.t === "line" && !c.id && !c.dashed);
    assert.ok(tickLines.length >= 2);
  });
});

describe("construction helpers", () => {
  it("isoscelesFromVertex matches the vertex angle", () => {
    const pts = isoscelesFromVertex(0, 50, 5);
    const u = { x: pts[1]!.x - pts[0]!.x, y: pts[1]!.y - pts[0]!.y };
    const w = { x: pts[2]!.x - pts[0]!.x, y: pts[2]!.y - pts[0]!.y };
    const lu = Math.hypot(u.x, u.y);
    const lw = Math.hypot(w.x, w.y);
    const deg = (Math.acos((u.x * w.x + u.y * w.y) / (lu * lw)) * 180) / Math.PI;
    almost(deg, 50, 0.2);
  });
});
