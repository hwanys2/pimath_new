import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { safeNextPath } from "@/lib/safe-next-path";

describe("safeNextPath", () => {
  it("keeps a same-origin path with hash", () => {
    assert.equal(
      safeNextPath("/tools/figures/g3-circle-chords#feedback"),
      "/tools/figures/g3-circle-chords#feedback",
    );
  });

  it("rejects protocol-relative and external URLs", () => {
    assert.equal(safeNextPath("//evil.example/phish"), "/teacher");
    assert.equal(safeNextPath("https://evil.example/"), "/teacher");
    assert.equal(safeNextPath("/ok://not"), "/teacher");
  });

  it("falls back for missing or non-path values", () => {
    assert.equal(safeNextPath(null), "/teacher");
    assert.equal(safeNextPath("teacher"), "/teacher");
    assert.equal(safeNextPath(""), "/teacher");
  });
});
