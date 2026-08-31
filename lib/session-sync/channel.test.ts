import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SESSION_SYNC_EVENT,
  dashboardSyncChannelName,
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

describe("SESSION_SYNC_EVENT", () => {
  it("is stable for client and broadcast payloads", () => {
    assert.equal(SESSION_SYNC_EVENT, "changed");
  });
});
