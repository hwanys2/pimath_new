import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSideInput, type DecimalValue } from "@/lib/sqrt-approx-math";
import {
  countSidesAroundTarget,
  insertProbeIntoWindow,
  selectVisibleSides,
  windowLabels,
} from "@/lib/sqrt-approx-visual";

function probe(raw: string): DecimalValue {
  const parsed = parseSideInput(raw);
  if (!parsed.ok) throw new Error(`bad probe: ${raw}`);
  return parsed.value;
}

function labels(window: DecimalValue[], area: number): string[] {
  return windowLabels(window, area);
}

function assertSymmetricAtMost2(window: DecimalValue[], area: number) {
  const { below, above } = countSidesAroundTarget(window, area);
  assert.ok(below <= 2, `expected at most 2 below target, got ${below}`);
  assert.ok(above <= 2, `expected at most 2 above target, got ${above}`);
}

describe("insertProbeIntoWindow (area=2)", () => {
  const area = 2;

  it("shows only target before any probe", () => {
    const items = selectVisibleSides({ area, visibleWindow: [] });
    assert.equal(items.length, 1);
    assert.equal(items[0]!.role, "target");
    assert.equal(items[0]!.label, "넓이 2");
    assert.equal(items[0]!.sublabel, undefined);
  });

  it("step 1: probe 1 → 1 · √2", () => {
    const window = insertProbeIntoWindow([], probe("1"), "integer", area);
    assert.deepEqual(labels(window, area), ["1", "√2"]);
  });

  it("step 2: probe 2 → 1 · √2 · 2", () => {
    let window = insertProbeIntoWindow([], probe("1"), "integer", area);
    window = insertProbeIntoWindow(window, probe("2"), "integer", area);
    assert.deepEqual(labels(window, area), ["1", "√2", "2"]);
  });

  it("step 3: probe 1.2 → 1 · 1.2 · √2 · 2", () => {
    let window = insertProbeIntoWindow([], probe("1"), "integer", area);
    window = insertProbeIntoWindow(window, probe("2"), "integer", area);
    window = insertProbeIntoWindow(window, probe("1.2"), "integer", area);
    assert.deepEqual(labels(window, area), ["1", "1.2", "√2", "2"]);
  });

  it("step 4: probe 1.4 → five squares, 1.2 still visible", () => {
    let window = insertProbeIntoWindow([], probe("1"), "integer", area);
    window = insertProbeIntoWindow(window, probe("2"), "integer", area);
    window = insertProbeIntoWindow(window, probe("1.2"), "integer", area);
    window = insertProbeIntoWindow(window, probe("1.4"), "integer", area);
    assert.equal(window.length, 4);
    assert.deepEqual(labels(window, area), ["1", "1.2", "1.4", "√2", "2"]);
  });

  it("step 5: probe 1.5 → 1.2 drops", () => {
    let window = insertProbeIntoWindow([], probe("1"), "integer", area);
    window = insertProbeIntoWindow(window, probe("2"), "integer", area);
    window = insertProbeIntoWindow(window, probe("1.2"), "integer", area);
    window = insertProbeIntoWindow(window, probe("1.4"), "integer", area);
    window = insertProbeIntoWindow(window, probe("1.5"), "integer", area);
    assert.deepEqual(labels(window, area), ["1", "1.4", "√2", "1.5", "2"]);
    assertSymmetricAtMost2(window, area);
  });

  it("step 6: integer confirm does not change window", () => {
    let window = insertProbeIntoWindow([], probe("1"), "integer", area);
    window = insertProbeIntoWindow(window, probe("2"), "integer", area);
    window = insertProbeIntoWindow(window, probe("1.2"), "integer", area);
    window = insertProbeIntoWindow(window, probe("1.4"), "integer", area);
    window = insertProbeIntoWindow(window, probe("1.5"), "integer", area);
    const afterConfirm = window;
    assert.deepEqual(labels(afterConfirm, area), ["1", "1.4", "√2", "1.5", "2"]);
    assert.ok(labels(afterConfirm, area).includes("1"));
  });

  it("step 7: probe 1.41 in decimal stage → 1 drops", () => {
    let window = insertProbeIntoWindow([], probe("1"), "integer", area);
    window = insertProbeIntoWindow(window, probe("2"), "integer", area);
    window = insertProbeIntoWindow(window, probe("1.4"), "integer", area);
    window = insertProbeIntoWindow(window, probe("1.5"), "integer", area);
    window = insertProbeIntoWindow(window, probe("1.41"), "decimal", area);
    assert.deepEqual(labels(window, area), ["1.4", "1.41", "√2", "1.5", "2"]);
    assert.ok(!labels(window, area).includes("1"));
    assertSymmetricAtMost2(window, area);
  });

  it("step 8: probe 1.44 in decimal stage → symmetric 2+2", () => {
    let window = insertProbeIntoWindow([], probe("1"), "integer", area);
    window = insertProbeIntoWindow(window, probe("2"), "integer", area);
    window = insertProbeIntoWindow(window, probe("1.4"), "integer", area);
    window = insertProbeIntoWindow(window, probe("1.5"), "integer", area);
    window = insertProbeIntoWindow(window, probe("1.41"), "decimal", area);
    window = insertProbeIntoWindow(window, probe("1.44"), "decimal", area);
    assert.deepEqual(labels(window, area), ["1.4", "1.41", "√2", "1.44", "1.5"]);
    assert.ok(!labels(window, area).includes("2"));
    assertSymmetricAtMost2(window, area);
  });

  it("keeps at least two items after first probe", () => {
    const window = insertProbeIntoWindow([], probe("1"), "integer", area);
    assert.ok(labels(window, area).length >= 2);
  });

  it("does not duplicate probes in window", () => {
    let window = insertProbeIntoWindow([], probe("1"), "integer", area);
    window = insertProbeIntoWindow(window, probe("1"), "integer", area);
    assert.equal(window.length, 1);
  });
});

describe("insertProbeIntoWindow (area=12)", () => {
  const area = 12;

  it("decimal probes yield symmetric 2+2 around target", () => {
    let window = insertProbeIntoWindow([], probe("3.463"), "decimal", area);
    window = insertProbeIntoWindow(window, probe("3.464"), "decimal", area);
    window = insertProbeIntoWindow(window, probe("3.465"), "decimal", area);
    window = insertProbeIntoWindow(window, probe("3.4641"), "decimal", area);
    window = insertProbeIntoWindow(window, probe("3.4642"), "decimal", area);
    assert.deepEqual(labels(window, area), [
      "3.464",
      "3.4641",
      "√12",
      "3.4642",
      "3.465",
    ]);
    assertSymmetricAtMost2(window, area);
    const sides = countSidesAroundTarget(window, area);
    assert.equal(sides.below, 2);
    assert.equal(sides.above, 2);
  });
});
