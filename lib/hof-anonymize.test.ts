import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { anonymizeDisplayName } from "@/lib/hof-anonymize";

describe("anonymizeDisplayName", () => {
  it("masks a single glyph as *", () => {
    assert.equal(anonymizeDisplayName("김"), "*");
    assert.equal(anonymizeDisplayName(" "), "*");
    assert.equal(anonymizeDisplayName(null), "*");
  });

  it("masks the last glyph of a two-character name", () => {
    assert.equal(anonymizeDisplayName("민수"), "민*");
  });

  it("masks the middle glyph of a three-character name", () => {
    assert.equal(anonymizeDisplayName("홍길동"), "홍*동");
  });

  it("masks the later-middle glyph of longer names", () => {
    assert.equal(anonymizeDisplayName("김수한무"), "김수*무");
  });

  it("trims whitespace before masking", () => {
    assert.equal(anonymizeDisplayName("  박서준  "), "박*준");
  });
});
