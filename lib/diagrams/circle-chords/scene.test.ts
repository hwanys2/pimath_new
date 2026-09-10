import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  nudgeMeasureLabel,
  nudgeMeasureLine,
} from "./geometry";
import { CIRCLE_CHORD_PRESETS, cloneState } from "./model";
import { buildCircleChordsScene, measureFrame, type SceneCmd } from "./scene";

describe("circle chords scene", () => {
  it("nudges chord length number and dim line independently", () => {
    const base = cloneState(CIRCLE_CHORD_PRESETS[0]!.state);
    const chordId = base.chords[0]!.id;
    const dimId = `${chordId}:chordLabel:line`;
    const textId = `${chordId}:chordLabel`;

    const before = buildCircleChordsScene(base);
    const arcBefore = before.cmds.find(
      (c): c is Extract<SceneCmd, { t: "arc" }> => c.t === "arc" && c.id === dimId,
    );
    const textBefore = before.texts.find((t) => t.id === textId);
    assert.ok(arcBefore);
    assert.ok(textBefore);

    // 1. Moving only the length label (dy) moves the text, but the dim line arc stays unchanged
    const afterText = buildCircleChordsScene({
      ...base,
      chords: base.chords.map((c, i) =>
        i === 0 ? { ...c, chordLabel: { ...c.chordLabel, dy: 30 } } : c,
      ),
    });
    const arcAfterText = afterText.cmds.find(
      (c): c is Extract<SceneCmd, { t: "arc" }> => c.t === "arc" && c.id === dimId,
    );
    const textAfter = afterText.texts.find((t) => t.id === textId);
    assert.ok(arcAfterText);
    assert.ok(textAfter);
    assert.equal(arcAfterText.r, arcBefore.r, "dim arc should stay put when only text moves");
    assert.equal(arcAfterText.cy, arcBefore.cy, "dim arc center should stay put when only text moves");
    assert.ok(
      Math.hypot(textAfter.x - textBefore.x, textAfter.y - textBefore.y) > 8,
      "text should move",
    );

    // 2. Moving only the dim line (lineDy) moves the arc, but the length text stays unchanged
    const afterLine = buildCircleChordsScene({
      ...base,
      chords: base.chords.map((c, i) =>
        i === 0 ? { ...c, chordLabel: { ...c.chordLabel, lineDy: 30 } } : c,
      ),
    });
    const arcAfterLine = afterLine.cmds.find(
      (c): c is Extract<SceneCmd, { t: "arc" }> => c.t === "arc" && c.id === dimId,
    );
    const textAfterLine = afterLine.texts.find((t) => t.id === textId);
    assert.ok(arcAfterLine);
    assert.ok(textAfterLine);
    assert.notEqual(arcAfterLine.r, arcBefore.r, "dim arc radius should change with lineDy");
    assert.equal(textAfterLine.x, textBefore.x, "text x should stay put when line moves");
    assert.equal(textAfterLine.y, textBefore.y, "text y should stay put when line moves");
  });

  it("nudgeMeasureLabel and nudgeMeasureLine update separate properties", () => {
    const base = cloneState(CIRCLE_CHORD_PRESETS[0]!.state);
    const scene = buildCircleChordsScene(base);
    const chord = base.chords[0]!;
    const frame = measureFrame(base, scene, `${chord.id}:chordLabel`);
    assert.ok(frame);

    const step = 20;
    const movedLabel = nudgeMeasureLabel(
      chord.chordLabel,
      frame.outward.x * step,
      frame.outward.y * step,
      frame.along,
      frame.outward,
      frame.halfSpan,
    );
    assert.ok(Math.abs(movedLabel.dy - step) < 0.5);
    assert.equal(movedLabel.lineDy ?? 0, 0, "lineDy should not change when label is nudged");

    const movedLine = nudgeMeasureLine(
      chord.chordLabel,
      frame.outward.x * step,
      frame.outward.y * step,
      frame.along,
      frame.outward,
      frame.halfSpan,
    );
    assert.ok(Math.abs((movedLine.lineDy ?? 0) - step) < 0.5);
    assert.equal(movedLine.dy, 0, "dy should not change when line is nudged");
  });

  it("nudges distance number and distance dim line independently", () => {
    const base = cloneState(CIRCLE_CHORD_PRESETS[0]!.state);
    const chordId = base.chords[0]!.id;
    const dimId = `${chordId}:distLabel:line`;
    const textId = `${chordId}:distLabel`;

    const before = buildCircleChordsScene(base);
    const arcBefore = before.cmds.find(
      (c): c is Extract<SceneCmd, { t: "arc" }> => c.t === "arc" && c.id === dimId,
    );
    const textBefore = before.texts.find((t) => t.id === textId);
    assert.ok(arcBefore);
    assert.ok(textBefore);

    const afterText = buildCircleChordsScene({
      ...base,
      chords: base.chords.map((c, i) =>
        i === 0 ? { ...c, distLabel: { ...c.distLabel, dy: 25 } } : c,
      ),
    });
    const arcAfterText = afterText.cmds.find(
      (c): c is Extract<SceneCmd, { t: "arc" }> => c.t === "arc" && c.id === dimId,
    );
    const textAfter = afterText.texts.find((t) => t.id === textId);
    assert.ok(arcAfterText && textAfter);
    assert.equal(arcAfterText.r, arcBefore.r);
    assert.ok(Math.hypot(textAfter.x - textBefore.x, textAfter.y - textBefore.y) > 6);

    const afterLine = buildCircleChordsScene({
      ...base,
      chords: base.chords.map((c, i) =>
        i === 0 ? { ...c, distLabel: { ...c.distLabel, lineDy: 25 } } : c,
      ),
    });
    const arcAfterLine = afterLine.cmds.find(
      (c): c is Extract<SceneCmd, { t: "arc" }> => c.t === "arc" && c.id === dimId,
    );
    const textAfterLine = afterLine.texts.find((t) => t.id === textId);
    assert.ok(arcAfterLine && textAfterLine);
    assert.notEqual(arcAfterLine.r, arcBefore.r);
    assert.equal(textAfterLine.x, textBefore.x);
    assert.equal(textAfterLine.y, textBefore.y);
  });

  it("renders dots and names according to PointDisplayMode", () => {
    const base = cloneState(CIRCLE_CHORD_PRESETS[0]!.state);
    const chordId = base.chords[0]!.id;

    // Mode "none": no endpoint dots, no endpoint names
    const sceneNone = buildCircleChordsScene({
      ...base,
      chords: base.chords.map((c, i) =>
        i === 0 ? { ...c, pointMode: "none" } : c,
      ),
    });
    assert.ok(!sceneNone.texts.some((t) => t.id === `${chordId}:startName`));
    assert.ok(!sceneNone.texts.some((t) => t.id === `${chordId}:endName`));

    // Mode "dot": dots present, but no names
    const sceneDot = buildCircleChordsScene({
      ...base,
      chords: base.chords.map((c, i) =>
        i === 0 ? { ...c, pointMode: "dot" } : c,
      ),
    });
    assert.ok(!sceneDot.texts.some((t) => t.id === `${chordId}:startName`));
    assert.ok(sceneDot.cmds.filter((c) => c.t === "dot").length >= 2);

    // Mode "name": names present, but no dots for this chord
    const sceneName = buildCircleChordsScene({
      ...base,
      centerPointMode: "none",
      chords: [
        {
          ...base.chords[0]!,
          pointMode: "name",
          showMidpoint: false,
        },
      ],
    });
    assert.ok(sceneName.texts.some((t) => t.id === `${chordId}:startName`));
    assert.ok(sceneName.texts.some((t) => t.id === `${chordId}:endName`));
    assert.equal(sceneName.cmds.filter((c) => c.t === "dot").length, 0);

    // Independent startPointMode and endPointMode
    const sceneIndep = buildCircleChordsScene({
      ...base,
      chords: base.chords.map((c, i) =>
        i === 0 ? { ...c, startPointMode: "name", endPointMode: "dot" } : c,
      ),
    });
    assert.ok(sceneIndep.texts.some((t) => t.id === `${chordId}:startName`));
    assert.ok(!sceneIndep.texts.some((t) => t.id === `${chordId}:endName`));
  });
});
