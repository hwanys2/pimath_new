import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyDisplayedAngle,
  applyDisplayedLength,
  applyEditedLabel,
  applySideLength,
  applyVertexAngle,
  angleDegAt,
  circumcenter,
  derive,
  incenter,
  lengthBetween,
  showCircumFootName,
  showInFootName,
  tangentLengths,
  triangleAngles,
} from "./geometry";
import {
  CENTERS_PRESETS,
  DEFAULT_CENTERS_STATE,
  angleId,
  emptyLabel,
  lengthId,
  triangleFromAngles,
  type AngleMark,
  type PointId,
  type Vec,
} from "./model";
import { buildCentersScene } from "./scene";

function almost(a: number, b: number, eps = 1e-6): void {
  assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
}

describe("triangle centers geometry", () => {
  it("keeps the circumcenter equidistant from the three vertices", () => {
    const [A, B, C] = triangleFromAngles(72, 58, 50, 6);
    const O = circumcenter(A, B, C);
    assert.ok(O);
    const ra = Math.hypot(O.x - A.x, O.y - A.y);
    const rb = Math.hypot(O.x - B.x, O.y - B.y);
    const rc = Math.hypot(O.x - C.x, O.y - C.y);
    almost(ra, rb, 1e-8);
    almost(rb, rc, 1e-8);
  });

  it("puts the circumcenter at the hypotenuse midpoint of a right triangle", () => {
    const A = { x: 0, y: 4 };
    const B = { x: 0, y: 0 };
    const C = { x: 3, y: 0 };
    const O = circumcenter(A, B, C);
    assert.ok(O);
    almost(O.x, 1.5);
    almost(O.y, 2);
  });

  it("keeps the incenter equidistant from the three sides", () => {
    const [A, B, C] = triangleFromAngles(70, 55, 55, 6);
    const I = incenter(A, B, C);
    const dist = (P: { x: number; y: number }, U: { x: number; y: number }, V: { x: number; y: number }) => {
      const dx = V.x - U.x;
      const dy = V.y - U.y;
      const l = Math.hypot(dx, dy);
      return Math.abs((P.x - U.x) * dy - (P.y - U.y) * dx) / l;
    };
    const rAB = dist(I, A, B);
    const rBC = dist(I, B, C);
    const rCA = dist(I, C, A);
    almost(rAB, rBC, 1e-8);
    almost(rBC, rCA, 1e-8);
  });

  it("matches tangent lengths s-a, s-b, s-c", () => {
    const A = { x: 3, y: 4 };
    const B = { x: 0, y: 0 };
    const C = { x: 6, y: 0 };
    const [tA, tB, tC] = tangentLengths(A, B, C);
    almost(tA, 2);
    almost(tB, 3);
    almost(tC, 3);
    const d = derive({
      ...CENTERS_PRESETS.find((p) => p.id === "in-circle")!.state,
      points: [A, B, C],
    });
    assert.ok(d);
    almost(lengthBetween(d, "A", "i0"), tA, 1e-6);
    almost(lengthBetween(d, "B", "i0"), tB, 1e-6);
  });
});

describe("triangle centers scene", () => {
  it("draws a circumcircle and right-angle marks on the perpendicular-bisector preset", () => {
    const preset = CENTERS_PRESETS.find((p) => p.id === "circum-circle")!;
    const scene = buildCentersScene(preset.state);
    assert.ok(scene.cmds.some((c) => c.t === "circle"));
    assert.ok(scene.cmds.filter((c) => c.t === "rightAngle").length >= 3);
  });

  it("fills the unknown angle on the circum-base preset", () => {
    const preset = CENTERS_PRESETS.find((p) => p.id === "circum-base")!;
    const scene = buildCentersScene(preset.state);
    assert.ok(scene.cmds.some((c) => c.t === "polygon" && c.fill === "#f7c8d2"));
  });

  it("draws dimension arcs on the incircle side-length preset", () => {
    const preset = CENTERS_PRESETS.find((p) => p.id === "in-circle")!;
    const scene = buildCentersScene(preset.state);
    assert.ok(scene.cmds.some((c) => c.t === "circle"));
    assert.ok(scene.cmds.some((c) => c.t === "arc" && c.dashed));
  });

  it("draws both centers on the combined preset", () => {
    const preset = CENTERS_PRESETS.find((p) => p.id === "both-centers")!;
    const scene = buildCentersScene(preset.state);
    const names = scene.texts.map((t) => t.id);
    assert.ok(names.includes("name:O"));
    assert.ok(names.includes("name:I"));
  });
});

function ang(at: PointId, from: PointId, to: PointId): AngleMark {
  return {
    id: angleId(at, from, to),
    at,
    from,
    to,
    label: emptyLabel("auto"),
    fill: false,
  };
}

function baseState() {
  return {
    ...DEFAULT_CENTERS_STATE,
    points: triangleFromAngles(72, 58, 50, 6),
  };
}

describe("triangle centers angle reshape", () => {
  it("rebuilds ABC when a vertex angle changes and keeps BC horizontal", () => {
    const next = applyVertexAngle(baseState(), 0, 40);
    const [A, B, C] = triangleAngles(next.points);
    almost(A, 40, 1e-6);
    almost(B + C, 140, 1e-6);
    almost(next.points[1]!.y, 0, 1e-8);
    almost(next.points[2]!.y, 0, 1e-8);
    assert.ok(next.points[2]!.x > next.points[1]!.x);
  });

  it("levels a tilted base when an angle is typed", () => {
    const tilted = {
      ...baseState(),
      points: [
        { x: 1, y: 5 },
        { x: 0, y: 1 },
        { x: 5, y: 3 },
      ] as [Vec, Vec, Vec],
    };
    const next = applyVertexAngle(tilted, 1, 60);
    almost(next.points[1]!.y, 0, 1e-8);
    almost(next.points[2]!.y, 0, 1e-8);
    almost(triangleAngles(next.points)[1], 60, 1e-6);
  });

  it("maps circum half-angle ∠OBC to vertex A = 90° − value", () => {
    const next = applyDisplayedAngle(baseState(), ang("B", "O", "C"), 20);
    almost(triangleAngles(next.points)[0], 70, 1e-6);
    const d = derive(next);
    assert.ok(d);
    almost(angleDegAt(d!, "B", "O", "C"), 20, 1e-4);
  });

  it("maps circum central ∠BOC to vertex A = value / 2", () => {
    const next = applyDisplayedAngle(baseState(), ang("O", "B", "C"), 100);
    almost(triangleAngles(next.points)[0], 50, 1e-6);
    const d = derive(next);
    assert.ok(d);
    almost(angleDegAt(d!, "O", "B", "C"), 100, 1e-4);
  });

  it("maps incenter half-angle at A to vertex A = 2 × value", () => {
    const next = applyDisplayedAngle(baseState(), ang("A", "I", "B"), 20);
    almost(triangleAngles(next.points)[0], 40, 1e-6);
    const d = derive(next);
    assert.ok(d);
    almost(angleDegAt(d!, "A", "I", "B"), 20, 1e-4);
  });

  it("maps incenter central ∠BIC to vertex A = 2 × (value − 90°)", () => {
    const next = applyDisplayedAngle(baseState(), ang("I", "B", "C"), 110);
    almost(triangleAngles(next.points)[0], 40, 1e-6);
    const d = derive(next);
    assert.ok(d);
    almost(angleDegAt(d!, "I", "B", "C"), 110, 1e-4);
  });

  it("reshapes from a canvas numeric label and keeps BC horizontal", () => {
    const id = angleId("B", "O", "C");
    const next = applyEditedLabel(baseState(), id, "20");
    almost(triangleAngles(next.points)[0], 70, 1e-6);
    almost(next.points[1]!.y, 0, 1e-8);
    almost(next.points[2]!.y, 0, 1e-8);
  });
});

describe("triangle centers length reshape and feet", () => {
  it("rebuilds ABC when BC changes, keeps the other two sides, and levels the base", () => {
    const start = baseState();
    const ab0 = Math.hypot(
      start.points[0]!.x - start.points[1]!.x,
      start.points[0]!.y - start.points[1]!.y,
    );
    const ca0 = Math.hypot(
      start.points[2]!.x - start.points[0]!.x,
      start.points[2]!.y - start.points[0]!.y,
    );
    const next = applySideLength(start, 1, 8);
    const bc = Math.hypot(
      next.points[2]!.x - next.points[1]!.x,
      next.points[2]!.y - next.points[1]!.y,
    );
    const ab = Math.hypot(
      next.points[0]!.x - next.points[1]!.x,
      next.points[0]!.y - next.points[1]!.y,
    );
    const ca = Math.hypot(
      next.points[2]!.x - next.points[0]!.x,
      next.points[2]!.y - next.points[0]!.y,
    );
    almost(bc, 8, 1e-6);
    almost(ab, ab0, 1e-6);
    almost(ca, ca0, 1e-6);
    almost(next.points[1]!.y, 0, 1e-8);
    almost(next.points[2]!.y, 0, 1e-8);
    assert.notEqual(
      Math.round(triangleAngles(next.points)[0] * 10),
      Math.round(triangleAngles(start.points)[0] * 10),
    );
  });

  it("changing one side is not a uniform similarity scale", () => {
    const start = baseState();
    const before = [0, 1, 2].map((i) =>
      Math.hypot(
        start.points[i]!.x - start.points[(i + 1) % 3]!.x,
        start.points[i]!.y - start.points[(i + 1) % 3]!.y,
      ),
    );
    const next = applySideLength(start, 0, before[0]! * 1.6);
    const after = [0, 1, 2].map((i) =>
      Math.hypot(
        next.points[i]!.x - next.points[(i + 1) % 3]!.x,
        next.points[i]!.y - next.points[(i + 1) % 3]!.y,
      ),
    );
    almost(after[0]!, before[0]! * 1.6, 1e-6);
    const ratios = before.map((len, i) => after[i]! / len);
    const spread = Math.max(...ratios) - Math.min(...ratios);
    assert.ok(spread > 0.05, "other edges should not all scale equally");
  });

  it("scales from a circumradius length without changing angles", () => {
    const start = baseState();
    const d0 = derive(start);
    assert.ok(d0);
    const next = applyDisplayedLength(start, { a: "O", b: "A" }, d0!.circumR * 2);
    const d1 = derive(next);
    assert.ok(d1);
    almost(d1!.circumR, d0!.circumR * 2, 1e-4);
    almost(triangleAngles(next.points)[0], 72, 1e-6);
    almost(next.points[1]!.y, 0, 1e-8);
  });

  it("reshapes from a canvas numeric side label", () => {
    const id = lengthId("B", "C");
    const start = {
      ...baseState(),
      lengths: [{ id, a: "B" as const, b: "C" as const, label: emptyLabel("auto") }],
    };
    const next = applyEditedLabel(start, id, "8");
    const bc = Math.hypot(
      next.points[2]!.x - next.points[1]!.x,
      next.points[2]!.y - next.points[1]!.y,
    );
    almost(bc, 8, 1e-6);
  });

  it("draws a vertex right-angle mark only when that interior is 90°", () => {
    const flaggedAcute = {
      ...baseState(),
      vertexRights: [true, false, false] as [boolean, boolean, boolean],
    };
    const sceneAcute = buildCentersScene(flaggedAcute);
    assert.equal(sceneAcute.cmds.filter((c) => c.t === "rightAngle").length, 0);

    const right = {
      ...baseState(),
      points: triangleFromAngles(90, 45, 45, 6),
      vertexRights: [true, false, false] as [boolean, boolean, boolean],
      angles: [],
    };
    const sceneRight = buildCentersScene(right);
    assert.ok(sceneRight.cmds.some((c) => c.t === "rightAngle"));
  });

  it("shows a foot name only on the chosen perpendicular", () => {
    const preset = CENTERS_PRESETS.find((p) => p.id === "circum-circle")!;
    const state = {
      ...preset.state,
      circum: {
        ...preset.state.circum,
        perps: [true, false, true] as [boolean, boolean, boolean],
        showFeet: [true, true, false] as [boolean, boolean, boolean],
      },
    };
    assert.equal(showCircumFootName(state, 0), true);
    assert.equal(showCircumFootName(state, 1), false);
    assert.equal(showCircumFootName(state, 2), false);
    assert.equal(showInFootName(state, 0), false);
  });
});
