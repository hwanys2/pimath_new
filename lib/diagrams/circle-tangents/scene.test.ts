import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  deriveQuad,
  deriveThree,
  deriveTri,
  deriveTwo,
  tangentLengths,
} from "@/lib/diagrams/circle-tangents/geometry";
import {
  DEFAULT_TANGENTS_STATE,
  TANGENT_PRESETS,
  normalizeState,
  withKind,
} from "@/lib/diagrams/circle-tangents/model";
import { buildTangentsScene } from "@/lib/diagrams/circle-tangents/scene";

describe("circle-tangents geometry", () => {
  it("derives equal tangents from an external point", () => {
    const d = deriveTwo(DEFAULT_TANGENTS_STATE);
    assert.ok(d);
    assert.ok(Math.abs(d!.tangentLen - Math.sqrt(10 * 10 - 6 * 6)) < 1e-6);
    const pa = Math.hypot(d!.P.x - d!.A.x, d!.P.y - d!.A.y);
    const pb = Math.hypot(d!.P.x - d!.B.x, d!.P.y - d!.B.y);
    assert.ok(Math.abs(pa - pb) < 1e-6);
  });

  it("derives triangle incircle touch points", () => {
    const state = withKind(DEFAULT_TANGENTS_STATE, "incircle-triangle");
    const d = deriveTri(state);
    assert.ok(d);
    const [tA, tB, tC] = tangentLengths(d!.A, d!.B, d!.C);
    assert.ok(Math.abs(d!.tA - tA) < 1e-6);
    assert.ok(Math.abs(d!.r - Math.hypot(d!.O.x - d!.Q.x, d!.O.y - d!.Q.y)) < 1e-4);
  });

  it("derives a tangential quadrilateral", () => {
    const state = withKind(DEFAULT_TANGENTS_STATE, "tangential-quad");
    const d = deriveQuad(state);
    assert.ok(d);
    const ab = Math.hypot(d!.A.x - d!.B.x, d!.A.y - d!.B.y);
    const cd = Math.hypot(d!.C.x - d!.D.x, d!.C.y - d!.D.y);
    const ad = Math.hypot(d!.A.x - d!.D.x, d!.A.y - d!.D.y);
    const bc = Math.hypot(d!.B.x - d!.C.x, d!.B.y - d!.C.y);
    assert.ok(Math.abs(ab + cd - (ad + bc)) < 1e-4);
  });

  it("derives three-tangents excircle figure", () => {
    const state = withKind(DEFAULT_TANGENTS_STATE, "three-tangents");
    const d = deriveThree(state);
    assert.ok(d);
    assert.ok(d!.r > 0.2);
    const ad = Math.hypot(d!.A.x - d!.D.x, d!.A.y - d!.D.y);
    const af = Math.hypot(d!.A.x - d!.F.x, d!.A.y - d!.F.y);
    assert.ok(Math.abs(ad - af) < 1e-4);
  });
});

describe("circle-tangents scene", () => {
  it("builds a scene for every preset", () => {
    for (const preset of TANGENT_PRESETS) {
      const scene = buildTangentsScene(normalizeState(preset.state));
      assert.ok(scene.cmds.some((c) => c.t === "circle"));
      assert.ok(scene.texts.length > 0);
    }
  });

  it("draws right angles for the pythagorean preset", () => {
    const preset = TANGENT_PRESETS.find((p) => p.id === "two-pythag-6-10");
    assert.ok(preset);
    const scene = buildTangentsScene(normalizeState(preset!.state));
    assert.ok(scene.cmds.filter((c) => c.t === "rightAngle").length >= 2);
  });
});
