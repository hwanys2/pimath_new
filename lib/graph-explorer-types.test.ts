import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_GRAPH_SETTINGS,
  parseGraphSettings,
  sameGraphCoordinate,
} from "@/lib/graph-explorer-types";
import { parseCoordinate } from "@/lib/graph-explorer-math";

describe("graph allowDuplicatePoints setting", () => {
  it("defaults to true for backward compatibility", () => {
    assert.equal(DEFAULT_GRAPH_SETTINGS.allowDuplicatePoints, true);
    assert.equal(parseGraphSettings({}).allowDuplicatePoints, true);
    assert.equal(
      parseGraphSettings({ allowDuplicatePoints: false }).allowDuplicatePoints,
      false,
    );
  });

  it("treats equivalent student inputs as the same coordinate", () => {
    const a = parseCoordinate("1/2");
    const b = parseCoordinate("0.5");
    assert.ok(a != null && b != null);
    assert.equal(sameGraphCoordinate(a, 3, b, 3), true);
    assert.equal(sameGraphCoordinate(a, 3, b, 3.0000000001), true);
    assert.equal(sameGraphCoordinate(2, 4, 2, 5), false);
  });
});
