import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  circumcenter,
  derive,
  incenter,
  lengthBetween,
  tangentLengths,
} from "./geometry";
import {
  CENTERS_PRESETS,
  triangleFromAngles,
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
