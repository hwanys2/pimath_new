import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { chordMath } from "./geometry";
import { CIRCLE_CHORD_PRESETS, cloneState } from "./model";
import {
  buildCircleChordsScene,
  hitTestFigure,
  mathToCanvas,
  type SceneCmd,
} from "./scene";

function fixture() {
  const state = cloneState(CIRCLE_CHORD_PRESETS[0]!.state);
  const scene = buildCircleChordsScene(state);
  const chord = state.chords[0]!;
  const { A, B, M } = chordMath(chord, state.radius);
  return {
    state,
    scene,
    chord,
    A: mathToCanvas(A, scene.layout),
    B: mathToCanvas(B, scene.layout),
    M: mathToCanvas(M, scene.layout),
    O: scene.layout.origin,
  };
}

function midArc(cmd: Extract<SceneCmd, { t: "arc" }>) {
  let sweep = cmd.a1 - cmd.a0;
  if (cmd.ccw) {
    if (sweep <= 0) sweep += Math.PI * 2;
  } else if (sweep >= 0) {
    sweep -= Math.PI * 2;
  }
  const a = cmd.a0 + sweep * 0.5;
  return { x: cmd.cx + cmd.r * Math.cos(a), y: cmd.cy + cmd.r * Math.sin(a) };
}

describe("circle chord hit testing", () => {
  it("grabs a chord endpoint even when a 설명선 tick starts on that point", () => {
    const { state, scene, chord, A } = fixture();
    const hit = hitTestFigure(state, scene, A.x, A.y);
    assert.deepEqual(hit, {
      kind: "point",
      chordId: chord.id,
      which: "start",
    });
  });

  it("still selects the point a few pixels off the endpoint toward the 설명선", () => {
    const { state, scene, chord, A, M } = fixture();
    const outwardX = A.x - M.x;
    const outwardY = A.y - M.y;
    const len = Math.hypot(outwardX, outwardY) || 1;
    const hit = hitTestFigure(
      state,
      scene,
      A.x + (outwardX / len) * 8,
      A.y + (outwardY / len) * 8,
    );
    assert.equal(hit?.kind, "point");
    assert.equal(hit?.kind === "point" && hit.chordId, chord.id);
  });

  it("picks the point-name letter instead of the point when clicking the label", () => {
    const { state, scene, chord } = fixture();
    const text = scene.texts.find((item) => item.id === `${chord.id}:startName`);
    assert.ok(text);
    const hit = hitTestFigure(state, scene, text.x, text.y);
    assert.deepEqual(hit, { kind: "label", id: `${chord.id}:startName` });
  });

  it("grabs the dashed 설명선 in the middle, not a nearby point", () => {
    const { state, scene, chord } = fixture();
    const arc = scene.cmds.find(
      (cmd): cmd is Extract<SceneCmd, { t: "arc" }> =>
        cmd.t === "arc" && cmd.id === `${chord.id}:chordLabel:line`,
    );
    assert.ok(arc);
    const p = midArc(arc);
    const hit = hitTestFigure(state, scene, p.x, p.y);
    assert.deepEqual(hit, { kind: "dimLine", id: `${chord.id}:chordLabel` });
  });

  it("edits the length text when clicking the measure label", () => {
    const { state, scene, chord } = fixture();
    const text = scene.texts.find(
      (item) => item.id === `${chord.id}:chordLabel`,
    );
    assert.ok(text);
    const hit = hitTestFigure(state, scene, text.x, text.y);
    assert.deepEqual(hit, { kind: "label", id: `${chord.id}:chordLabel` });
  });

  it("selects the center even when a distance 설명선 is attached", () => {
    const { state, scene, O } = fixture();
    const hit = hitTestFigure(state, scene, O.x, O.y);
    assert.deepEqual(hit, { kind: "center" });
  });

  it("drags the chord body from the midpoint", () => {
    const { state, scene, chord, M } = fixture();
    const hit = hitTestFigure(state, scene, M.x, M.y);
    assert.equal(hit?.kind, "chord");
    assert.equal(hit?.kind === "chord" && hit.chordId, chord.id);
  });
});
