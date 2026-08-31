import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SESSION_SYNC_EVENT,
  dashboardSyncChannelName,
  pvpGameSyncChannelName,
  pvpQueueSyncChannelName,
  resolvePvpPollChannel,
  sessionSyncChannelName,
} from "./channel";

describe("sessionSyncChannelName", () => {
  it("prefixes session UUID", () => {
    assert.equal(
      sessionSyncChannelName("abc-123"),
      "pm:session:abc-123",
    );
  });

  it("trims whitespace", () => {
    assert.equal(
      sessionSyncChannelName("  abc  "),
      "pm:session:abc",
    );
  });
});

describe("dashboardSyncChannelName", () => {
  it("combines class id and content key", () => {
    assert.equal(
      dashboardSyncChannelName("class-1", "g2-u4-dice-sum-race"),
      "pm:dashboard:class-1:g2-u4-dice-sum-race",
    );
  });
});

describe("pvpGameSyncChannelName", () => {
  it("prefixes game UUID", () => {
    assert.equal(pvpGameSyncChannelName("game-1"), "pm:pvp:game-1");
  });
});

describe("pvpQueueSyncChannelName", () => {
  it("uses global scope", () => {
    assert.equal(
      pvpQueueSyncChannelName("g1-u2-3-ordered-pair-omok", "global"),
      "pm:pvp-queue:global:g1-u2-3-ordered-pair-omok",
    );
  });

  it("uses class scope with class id", () => {
    assert.equal(
      pvpQueueSyncChannelName(
        "g1-u2-3-ordered-pair-omok",
        "class",
        "class-1",
      ),
      "pm:pvp-queue:class:class-1:g1-u2-3-ordered-pair-omok",
    );
  });
});

describe("resolvePvpPollChannel", () => {
  it("prefers game channel over queue", () => {
    assert.equal(
      resolvePvpPollChannel({
        contentKey: "g1-u2-3-ordered-pair-omok",
        gameId: "game-1",
        queueScope: "class",
        classId: "class-1",
      }),
      "pm:pvp:game-1",
    );
  });
});

describe("SESSION_SYNC_EVENT", () => {
  it("is stable for client and broadcast payloads", () => {
    assert.equal(SESSION_SYNC_EVENT, "changed");
  });
});
