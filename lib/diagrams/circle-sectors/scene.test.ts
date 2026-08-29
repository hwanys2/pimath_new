import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CIRCLE_SECTOR_PRESETS, cloneState } from "./model";
import { buildCircleSectorsScene } from "./scene";

describe("circle sector scenes", () => {
  it("builds every preset without empty geometry", () => {
    for (const preset of CIRCLE_SECTOR_PRESETS) {
      const scene = buildCircleSectorsScene(cloneState(preset.state));
      assert.ok(scene.cmds.length > 2, preset.id);
      assert.equal(scene.width, 480);
      assert.equal(scene.height, 520);
    }
  });

  it("fills shaded sectors and keeps a major-arc dim", () => {
    const area = buildCircleSectorsScene(
      cloneState(CIRCLE_SECTOR_PRESETS[1]!.state),
    );
    const fills = area.cmds.filter((c) => c.t === "sector");
    assert.equal(fills.length, 2);

    const major = buildCircleSectorsScene(
      cloneState(CIRCLE_SECTOR_PRESETS[5]!.state),
    );
    const rim = major.cmds.find(
      (c) => c.t === "arc" && !c.id && c.r > 80,
    );
    assert.ok(rim && rim.t === "arc");
    const sweep = canvasCcw(rim.a0, rim.a1);
    assert.ok(sweep > Math.PI, `major sweep ${sweep}`);
  });

  it("nudges arc-length number and dim arc independently", () => {
    const base = cloneState(CIRCLE_SECTOR_PRESETS[0]!.state);
    const sectorId = base.sectors[0]!.id;
    const dimId = `${sectorId}:arcLabel:line`;
    const textId = `${sectorId}:arcLabel`;

    const before = buildCircleSectorsScene(base);
    const arcBefore = before.cmds.find((c) => c.t === "arc" && c.id === dimId);
    const textBefore = before.texts.find((t) => t.id === textId);
    assert.ok(arcBefore && arcBefore.t === "arc");
    assert.ok(textBefore);

    const afterText = buildCircleSectorsScene({
      ...base,
      sectors: base.sectors.map((s, i) =>
        i === 0 ? { ...s, arcLabel: { ...s.arcLabel, dy: 24 } } : s,
      ),
    });
    const arcAfterText = afterText.cmds.find(
      (c) => c.t === "arc" && c.id === dimId,
    );
    const textAfter = afterText.texts.find((t) => t.id === textId);
    assert.ok(arcAfterText && arcAfterText.t === "arc");
    assert.equal(arcAfterText.r, arcBefore.r);
    assert.ok(
      Math.hypot(textAfter!.x - textBefore.x, textAfter!.y - textBefore.y) > 4,
    );

    const afterLine = buildCircleSectorsScene({
      ...base,
      sectors: base.sectors.map((s, i) =>
        i === 0 ? { ...s, arcLabel: { ...s.arcLabel, lineDy: 24 } } : s,
      ),
    });
    const arcAfterLine = afterLine.cmds.find(
      (c) => c.t === "arc" && c.id === dimId,
    );
    const textAfterLine = afterLine.texts.find((t) => t.id === textId);
    assert.ok(arcAfterLine && arcAfterLine.t === "arc");
    assert.notEqual(arcAfterLine.r, arcBefore.r);
    assert.equal(textAfterLine!.x, textBefore.x);
    assert.equal(textAfterLine!.y, textBefore.y);
  });

  it("hides the parent circle on standalone sector presets", () => {
    const standalone = buildCircleSectorsScene(
      cloneState(CIRCLE_SECTOR_PRESETS[2]!.state),
    );
    assert.equal(
      standalone.cmds.filter((c) => c.t === "circle").length,
      0,
    );
  });
});

function canvasCcw(a0: number, a1: number): number {
  const two = Math.PI * 2;
  const n = (a: number) => ((a % two) + two) % two;
  let m = n(a0) - n(a1);
  if (m < 0) m += two;
  return m;
}
