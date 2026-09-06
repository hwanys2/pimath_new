import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateRun } from "@/lib/shadow-temple-math";

describe("generateRun play order", () => {
  it("goes tan → area → construction → finale", () => {
    const { rooms } = generateRun();
    assert.deepEqual(
      rooms.map((r) => r.kind),
      [
        "giantGate",
        "guardianShield",
        "sunAltar",
        "lavaFloor",
        "brokenBridge",
        "goldenStar",
      ],
    );
    assert.deepEqual(
      rooms.map((r) => r.id),
      [1, 2, 3, 4, 5, 6],
    );
  });

  it("hands the story off room-to-room without skipping a beat", () => {
    const { rooms } = generateRun();
    const [gate, shield, altar, lava, bridge, star] = rooms;

    assert.match(gate!.enterStory.join(" "), /거인/);
    assert.match(gate!.puzzles[0]!.solvedLine, /첫 번째 문/);

    assert.match(shield!.enterStory.join(" "), /거인의 문/);
    assert.match(shield!.puzzles[0]!.solvedLine, /수호자/);

    assert.match(altar!.enterStory.join(" "), /수호자/);
    assert.match(altar!.puzzles[1]!.solvedLine, /아래/);

    assert.match(lava!.enterStory.join(" "), /제단/);
    assert.match(lava!.puzzles[0]!.solvedLine, /협곡/);

    assert.match(bridge!.enterStory.join(" "), /용암/);
    assert.match(bridge!.puzzles[0]!.solvedLine, /유리 돔/);

    assert.match(star!.enterStory.join(" "), /다리/);
    assert.match(star!.enterStory.join(" "), /마지막 방/);
  });

  it("always provides 1 acute triangle and 1 obtuse triangle in the sun altar room", () => {
    for (let i = 0; i < 50; i++) {
      const { rooms } = generateRun();
      const altar = rooms.find((r) => r.kind === "sunAltar");
      assert.ok(altar, "sunAltar room must exist");
      assert.equal(altar.puzzles.length, 2, "must have two altar puzzles");

      const [p1, p2] = altar.puzzles;
      assert.match(p1!.prompt, /예각삼각형/);
      assert.match(p2!.prompt, /둔각삼각형/);

      const params = altar.params;
      // Puzzle 1: acute triangle (a1, b1, deg1)
      const a1 = params.a1!;
      const b1 = params.b1!;
      const deg1 = params.deg1!;
      const rad1 = (deg1 * Math.PI) / 180;
      const c1Sq = a1 * a1 + b1 * b1 - 2 * a1 * b1 * Math.cos(rad1);
      // All three angles < 90°:
      assert.ok(
        a1 * a1 + b1 * b1 > c1Sq && b1 * b1 + c1Sq > a1 * a1 && a1 * a1 + c1Sq > b1 * b1,
        `Altar 1 (a=${a1}, b=${b1}, deg=${deg1}) must be an acute triangle`,
      );

      // Puzzle 2: obtuse triangle (a2, b2, deg2)
      const a2 = params.a2!;
      const b2 = params.b2!;
      const deg2 = params.deg2!;
      const rad2 = (deg2 * Math.PI) / 180;
      const c2Sq = a2 * a2 + b2 * b2 - 2 * a2 * b2 * Math.cos(rad2);
      // One angle > 90°:
      assert.ok(
        deg2 > 90 || a2 * a2 + b2 * b2 < c2Sq || b2 * b2 + c2Sq < a2 * a2 || a2 * a2 + c2Sq < b2 * b2,
        `Altar 2 (a=${a2}, b=${b2}, deg=${deg2}) must be an obtuse triangle`,
      );
    }
  });
});

