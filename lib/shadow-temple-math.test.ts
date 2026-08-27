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
});
