import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  gameRankingDisplayName,
  shouldRevealGameRankingName,
} from "@/lib/game-ranking-privacy";

describe("shouldRevealGameRankingName", () => {
  it("reveals self, same class, and same teacher", () => {
    assert.equal(shouldRevealGameRankingName({ isMe: true }), true);
    assert.equal(shouldRevealGameRankingName({ sameClass: true }), true);
    assert.equal(shouldRevealGameRankingName({ sameTeacher: true }), true);
  });

  it("reveals the same actual school even if the teacher differs", () => {
    assert.equal(
      shouldRevealGameRankingName({
        viewerSchoolId: 12,
        rowSchoolId: 12,
      }),
      true,
    );
  });

  it("masks other schools and missing school snapshots", () => {
    assert.equal(
      shouldRevealGameRankingName({
        viewerSchoolId: 12,
        rowSchoolId: 99,
      }),
      false,
    );
    assert.equal(
      shouldRevealGameRankingName({
        viewerSchoolId: 12,
        rowSchoolId: null,
      }),
      false,
    );
    assert.equal(
      shouldRevealGameRankingName({
        viewerSchoolId: null,
        rowSchoolId: null,
      }),
      false,
    );
  });
});

describe("gameRankingDisplayName", () => {
  it("keeps the real name when revealed", () => {
    assert.equal(gameRankingDisplayName("홍길동", true), "홍길동");
  });

  it("masks a middle glyph when hidden", () => {
    assert.equal(gameRankingDisplayName("홍길동", false), "홍*동");
    assert.equal(gameRankingDisplayName("민수", false), "민*");
  });
});
