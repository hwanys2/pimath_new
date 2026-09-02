import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  publicGameRankingCutoffHint,
  publicGameRankingMeta,
  type PublicGameRankRow,
} from "@/lib/public-game-ranking";

function row(
  rank: number,
  score: number,
  extra: Partial<PublicGameRankRow> = {},
): PublicGameRankRow {
  return {
    rank,
    displayName: "홍*동",
    className: "3-2",
    schoolName: "파이중학교",
    score,
    isMe: false,
    isMasked: true,
    ...extra,
  };
}

describe("publicGameRankingCutoffHint", () => {
  it("invites the first player when empty", () => {
    assert.equal(
      publicGameRankingCutoffHint([]),
      "아직 기록이 없어요. 첫 순위는 바로 당신!",
    );
  });

  it("uses 5th place as the cutoff when the board is full", () => {
    const rows = [1, 2, 3, 4, 5].map((rank) => row(rank, 1600 - rank * 100));
    assert.equal(
      publicGameRankingCutoffHint(rows),
      "지금 5등은 1,100점이에요. 이보다 높으면 순위에 들어요!",
    );
  });

  it("encourages joining when fewer than five records exist", () => {
    assert.equal(
      publicGameRankingCutoffHint([row(1, 900), row(2, 800)]),
      "아직 2명뿐이에요. 지금 플레이하면 바로 순위에 올라가요!",
    );
  });
});

describe("publicGameRankingMeta", () => {
  it("joins school and class when present", () => {
    assert.equal(publicGameRankingMeta(row(1, 1000)), "파이중학교 · 3-2");
    assert.equal(
      publicGameRankingMeta(row(1, 1000, { schoolName: null })),
      "3-2",
    );
  });
});
