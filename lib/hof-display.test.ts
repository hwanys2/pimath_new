import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hofMyPlace } from "./hof-display";

describe("hofMyPlace", () => {
  it("uses the highlighted row when present", () => {
    assert.equal(
      hofMyPlace({
        students: [
          { isMe: false, rank: 1 },
          { isMe: true, rank: 12 },
        ],
        viewingOwnGroup: true,
        viewerRank: 99,
      }),
      12,
    );
  });

  it("falls back to the viewer rank only inside their own group", () => {
    assert.equal(
      hofMyPlace({
        students: [{ isMe: false, rank: 1 }],
        viewingOwnGroup: true,
        viewerRank: 8,
      }),
      8,
    );
    assert.equal(
      hofMyPlace({
        students: [{ isMe: false, rank: 1 }],
        viewingOwnGroup: false,
        viewerRank: 8,
      }),
      null,
    );
  });
});
