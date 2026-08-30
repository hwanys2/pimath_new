import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyDiagLength,
  applyEditedLabel,
  applyFamily,
  applyQuadAngle,
  applyQuadLength,
  diagonalMeet,
  edgeLength,
  isBaseHorizontal,
  isRectangleAngles,
  moveVertexQuad,
  oppositeEdgesParallel,
  setRotateDeg,
  sidesEqual,
  snapFamily,
  toCanonicalPoint,
  toggleExtension,
  worldPoints,
} from "./geometry";
import {
  DEFAULT_QUAD_STATE,
  generalPoints,
  normalizeState,
  rectanglePoints,
  rhombusDiamond,
  squarePoints,
  trapezoidPoints,
} from "./model";

function almost(a: number, b: number, eps = 1e-3): void {
  assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
}

function withFamily(
  family: "general" | "parallelogram" | "rectangle" | "rhombus" | "square" | "trapezoid",
  points: { x: number; y: number }[],
) {
  return applyFamily(normalizeState({ ...DEFAULT_QUAD_STATE, points }), family);
}

describe("snapFamily", () => {
  it("parallelogram has equal opposite sides and parallel pairs", () => {
    const pts = snapFamily(
      [
        { x: -2, y: 2 },
        { x: -3, y: -2 },
        { x: 4, y: -1.5 },
        { x: 10, y: 9 },
      ],
      "parallelogram",
      2,
    );
    almost(edgeLength(pts, 0), edgeLength(pts, 2), 1e-6);
    almost(edgeLength(pts, 1), edgeLength(pts, 3), 1e-6);
    assert.ok(oppositeEdgesParallel(pts, 0));
    assert.ok(oppositeEdgesParallel(pts, 1));
    assert.ok(isBaseHorizontal(pts));
    const O = diagonalMeet(pts);
    const midAC = {
      x: (pts[0]!.x + pts[2]!.x) / 2,
      y: (pts[0]!.y + pts[2]!.y) / 2,
    };
    almost(O.x, midAC.x, 1e-6);
    almost(O.y, midAC.y, 1e-6);
  });

  it("rectangle has right angles and a flat base", () => {
    const pts = snapFamily(rectanglePoints(), "rectangle", 1);
    assert.ok(isRectangleAngles(pts, 0.5));
    assert.ok(isBaseHorizontal(pts));
    almost(edgeLength(pts, 0), edgeLength(pts, 2), 1e-6);
    almost(edgeLength(pts, 1), edgeLength(pts, 3), 1e-6);
  });

  it("rhombus has equal sides, perpendicular diagonals, and a flat base", () => {
    const pts = snapFamily(rhombusDiamond(), "rhombus", 1);
    assert.ok(sidesEqual(pts, 1e-6));
    assert.ok(isBaseHorizontal(pts));
    const AC = {
      x: pts[2]!.x - pts[0]!.x,
      y: pts[2]!.y - pts[0]!.y,
    };
    const BD = {
      x: pts[3]!.x - pts[1]!.x,
      y: pts[3]!.y - pts[1]!.y,
    };
    almost(AC.x * BD.x + AC.y * BD.y, 0, 1e-5);
  });

  it("square is a rhombus rectangle", () => {
    const pts = snapFamily(squarePoints(), "square", 1);
    assert.ok(sidesEqual(pts, 1e-6));
    assert.ok(isRectangleAngles(pts, 0.5));
    assert.ok(isBaseHorizontal(pts));
  });

  it("trapezoid keeps AD parallel to BC", () => {
    const pts = snapFamily(trapezoidPoints(), "trapezoid", 0);
    assert.ok(oppositeEdgesParallel(pts, 1));
    assert.ok(isBaseHorizontal(pts));
  });

  it("general quad keeps a flat base without forcing parallels", () => {
    const pts = snapFamily(generalPoints(), "general", 0);
    assert.ok(isBaseHorizontal(pts));
    assert.equal(oppositeEdgesParallel(pts, 0), false);
  });
});

describe("constrained dragging", () => {
  it("dragging any parallelogram vertex keeps it a parallelogram on a flat base", () => {
    const state = withFamily("parallelogram", DEFAULT_QUAD_STATE.points);
    for (const i of [0, 1, 2, 3]) {
      const p = state.points[i]!;
      const next = moveVertexQuad(state, i, { x: p.x + 0.7, y: p.y + 0.5 });
      assert.ok(oppositeEdgesParallel(next.points, 0), `vertex ${i} AB∥DC`);
      assert.ok(oppositeEdgesParallel(next.points, 1), `vertex ${i} AD∥BC`);
      assert.ok(isBaseHorizontal(next.points), `vertex ${i} base`);
    }
  });

  it("dragging any rectangle vertex keeps four right angles", () => {
    const state = withFamily("rectangle", rectanglePoints());
    for (const i of [0, 1, 2, 3]) {
      const p = state.points[i]!;
      const next = moveVertexQuad(state, i, { x: p.x + 0.9, y: p.y + 0.6 });
      assert.ok(isRectangleAngles(next.points, 0.5), `vertex ${i}`);
      assert.ok(isBaseHorizontal(next.points), `vertex ${i} base`);
    }
  });

  it("dragging any rhombus vertex keeps equal sides", () => {
    const state = withFamily("rhombus", rhombusDiamond());
    for (const i of [0, 1, 2, 3]) {
      const p = state.points[i]!;
      const next = moveVertexQuad(state, i, { x: p.x + 0.6, y: p.y + 0.4 });
      assert.ok(sidesEqual(next.points, 1e-4), `vertex ${i}`);
      assert.ok(oppositeEdgesParallel(next.points, 0), `vertex ${i} para`);
      assert.ok(isBaseHorizontal(next.points), `vertex ${i} base`);
    }
  });

  it("dragging a square vertex keeps a square", () => {
    const state = withFamily("square", squarePoints());
    const next = moveVertexQuad(state, 2, {
      x: state.points[2]!.x + 1.2,
      y: state.points[2]!.y + 0.4,
    });
    assert.ok(sidesEqual(next.points, 1e-4));
    assert.ok(isRectangleAngles(next.points, 0.5));
    assert.ok(isBaseHorizontal(next.points));
  });

  it("dragging a trapezoid vertex keeps AD ∥ BC", () => {
    const state = withFamily("trapezoid", trapezoidPoints());
    const next = moveVertexQuad(state, 0, {
      x: state.points[0]!.x + 0.8,
      y: state.points[0]!.y + 0.5,
    });
    assert.ok(oppositeEdgesParallel(next.points, 1));
    assert.ok(isBaseHorizontal(next.points));
  });

  it("dragging a general quad vertex does not force a parallelogram", () => {
    const state = withFamily("general", generalPoints());
    const next = moveVertexQuad(state, 0, {
      x: state.points[0]!.x + 1.1,
      y: state.points[0]!.y + 0.4,
    });
    assert.ok(isBaseHorizontal(next.points));
    assert.equal(oppositeEdgesParallel(next.points, 0), false);
  });
});

describe("move and measure", () => {
  it("dragging a parallelogram vertex keeps opposite sides equal", () => {
    const next = moveVertexQuad(DEFAULT_QUAD_STATE, 0, { x: -1.4, y: 2.8 });
    almost(edgeLength(next.points, 0), edgeLength(next.points, 2), 1e-5);
    almost(edgeLength(next.points, 1), edgeLength(next.points, 3), 1e-5);
    assert.ok(isBaseHorizontal(next.points));
  });

  it("setting a parallelogram angle keeps opposite angles equal", () => {
    const next = applyQuadAngle(DEFAULT_QUAD_STATE, 3, 100);
    almost(next.interiorAnglesDeg[3]!, 100, 0.8);
    almost(next.interiorAnglesDeg[1]!, 100, 0.8);
    almost(next.interiorAnglesDeg[0]! + next.interiorAnglesDeg[1]!, 180, 0.8);
    assert.ok(isBaseHorizontal(next.points));
  });

  it("scaling a diagonal half on a parallelogram keeps O the midpoint", () => {
    const state = normalizeState({
      ...DEFAULT_QUAD_STATE,
      showDiagAC: true,
      showDiagBD: true,
      showO: true,
    });
    const next = applyDiagLength(state, "AO", 5);
    const O = diagonalMeet(next.points);
    const ao = Math.hypot(next.points[0]!.x - O.x, next.points[0]!.y - O.y);
    const oc = Math.hypot(next.points[2]!.x - O.x, next.points[2]!.y - O.y);
    almost(ao, oc, 1e-5);
    almost(ao, 5, 0.05);
  });

  it("changing one side of a parallelogram matches the opposite side", () => {
    const next = applyQuadLength(DEFAULT_QUAD_STATE, 0, 6);
    almost(edgeLength(next.points, 0), 6, 0.05);
    almost(edgeLength(next.points, 0), edgeLength(next.points, 2), 1e-5);
  });

  it("typing an interior angle on a parallelogram changes the shape", () => {
    const next = applyEditedLabel(DEFAULT_QUAD_STATE, "v:0:interior", "70");
    almost(next.interiorAnglesDeg[0]!, 70, 1.2);
    almost(next.interiorAnglesDeg[2]!, 70, 1.2);
  });

  it("can extend more than one side at once", () => {
    const one = toggleExtension(DEFAULT_QUAD_STATE, 1, "in");
    const two = toggleExtension(one, 0, "out");
    assert.equal(two.extensions.length, 2);
    assert.equal(two.extensions[0]?.name, "E");
    assert.equal(two.extensions[1]?.name, "F");
  });
});

describe("rotation about O", () => {
  it("keeps the diagonal intersection fixed and preserves side lengths", () => {
    const rotated = setRotateDeg(DEFAULT_QUAD_STATE, 40);
    const O0 = diagonalMeet(DEFAULT_QUAD_STATE.points);
    const world = worldPoints(rotated);
    const O1 = diagonalMeet(world);
    almost(O0.x, O1.x, 1e-6);
    almost(O0.y, O1.y, 1e-6);
    for (let i = 0; i < 4; i += 1) {
      almost(edgeLength(world, i), edgeLength(DEFAULT_QUAD_STATE.points, i), 1e-6);
    }
    assert.equal(isBaseHorizontal(world), false);
  });

  it("wraps angles and inverts back to canonical", () => {
    const spun = setRotateDeg(DEFAULT_QUAD_STATE, 400);
    almost(spun.rotateDeg, 40, 1e-9);
    const back = setRotateDeg(DEFAULT_QUAD_STATE, -15);
    almost(back.rotateDeg, 345, 1e-9);
    const world = worldPoints(spun)[0]!;
    const canonical = toCanonicalPoint(spun, world);
    almost(canonical.x, DEFAULT_QUAD_STATE.points[0]!.x, 1e-6);
    almost(canonical.y, DEFAULT_QUAD_STATE.points[0]!.y, 1e-6);
  });

  it("dragging a rotated rectangle still keeps right angles", () => {
    const state = setRotateDeg(withFamily("rectangle", rectanglePoints()), 35);
    const worldA = worldPoints(state)[0]!;
    const next = moveVertexQuad(
      state,
      0,
      toCanonicalPoint(state, { x: worldA.x + 0.7, y: worldA.y + 0.4 }),
    );
    assert.ok(isRectangleAngles(next.points, 0.5));
    almost(next.rotateDeg, 35, 1e-9);
    assert.ok(isRectangleAngles(worldPoints(next), 0.5));
  });
});
