import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { groundElevationArc } from "@/lib/inquiry-tangent-figure";

describe("groundElevationArc", () => {
  it("at a left vertex, sweeps counterclockwise so the arc sits above the base", () => {
    const arc = groundElevationArc({
      vx: 0,
      vy: 100,
      baseDir: 1,
      radius: 20,
      angleDeg: 45,
    });
    assert.equal(arc.sweep, 0);
    assert.equal(arc.start.x, 20);
    assert.equal(arc.start.y, 100);
    assert.ok(arc.end.x > 0 && arc.end.x < 20);
    assert.ok(arc.end.y < 100, "end must be above the base in SVG (smaller y)");
    assert.match(arc.d, /A 20 20 0 0 0 /);
  });

  it("at a right vertex, sweeps clockwise so the arc still sits above the base", () => {
    const arc = groundElevationArc({
      vx: 200,
      vy: 100,
      baseDir: -1,
      radius: 20,
      angleDeg: 45,
    });
    assert.equal(arc.sweep, 1);
    assert.equal(arc.start.x, 180);
    assert.ok(arc.end.x > 180 && arc.end.x < 200);
    assert.ok(arc.end.y < 100, "end must be above the base in SVG (smaller y)");
    assert.match(arc.d, /A 20 20 0 0 1 /);
  });
});
