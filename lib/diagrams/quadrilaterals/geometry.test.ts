import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyDiagLength,
  applyQuadAngle,
  applyQuadLength,
  diagonalMeet,
  edgeLength,
  isRectangleAngles,
  moveVertexQuad,
  oppositeEdgesParallel,
  sidesEqual,
  snapFamily,
} from "./geometry";
import {
  DEFAULT_QUAD_STATE,
  normalizeState,
  rectanglePoints,
  rhombusDiamond,
  squarePoints,
  trapezoidPoints,
} from "./model";

function almost(a: number, b: number, eps = 1e-3): void {
  assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
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
    const O = diagonalMeet(pts);
    const midAC = {
      x: (pts[0]!.x + pts[2]!.x) / 2,
      y: (pts[0]!.y + pts[2]!.y) / 2,
    };
    almost(O.x, midAC.x, 1e-6);
    almost(O.y, midAC.y, 1e-6);
  });

  it("rectangle has right angles", () => {
    const pts = snapFamily(rectanglePoints(), "rectangle", 1);
    assert.ok(isRectangleAngles(pts, 0.5));
    almost(edgeLength(pts, 0), edgeLength(pts, 2), 1e-6);
    almost(edgeLength(pts, 1), edgeLength(pts, 3), 1e-6);
  });

  it("rhombus has equal sides and perpendicular diagonals", () => {
    const pts = snapFamily(rhombusDiamond(), "rhombus", 1);
    assert.ok(sidesEqual(pts, 1e-6));
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
  });

  it("trapezoid keeps AD parallel to BC", () => {
    const pts = snapFamily(trapezoidPoints(), "trapezoid", 0);
    assert.ok(oppositeEdgesParallel(pts, 1));
  });
});

describe("move and measure", () => {
  it("dragging a parallelogram vertex keeps opposite sides equal", () => {
    const next = moveVertexQuad(DEFAULT_QUAD_STATE, 0, { x: -1.4, y: 2.8 });
    almost(edgeLength(next.points, 0), edgeLength(next.points, 2), 1e-5);
    almost(edgeLength(next.points, 1), edgeLength(next.points, 3), 1e-5);
  });

  it("setting a parallelogram angle keeps opposite angles equal", () => {
    const next = applyQuadAngle(DEFAULT_QUAD_STATE, 3, 100);
    almost(next.interiorAnglesDeg[3]!, 100, 0.8);
    almost(next.interiorAnglesDeg[1]!, 100, 0.8);
    almost(next.interiorAnglesDeg[0]! + next.interiorAnglesDeg[1]!, 180, 0.8);
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
});
