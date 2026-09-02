export type PublicGameRankRow = {
  rank: number;
  displayName: string;
  className: string | null;
  schoolName: string | null;
  score: number;
  isMe: boolean;
  isMasked: boolean;
};

/** Copy under the top-5 preview so players know the bar before they start. */
export function publicGameRankingCutoffHint(
  rows: Pick<PublicGameRankRow, "rank" | "score">[],
): string {
  if (rows.length === 0) {
    return "아직 기록이 없어요. 첫 순위는 바로 당신!";
  }
  const fifth = rows.find((row) => row.rank === 5);
  if (fifth) {
    return `지금 5등은 ${fifth.score.toLocaleString()}점이에요. 이보다 높으면 순위에 들어요!`;
  }
  return `아직 ${rows.length}명뿐이에요. 지금 플레이하면 바로 순위에 올라가요!`;
}

export function publicGameRankingMeta(row: PublicGameRankRow): string | null {
  const parts = [row.schoolName, row.className].filter(
    (value): value is string => Boolean(value && value.trim()),
  );
  return parts.length > 0 ? parts.join(" · ") : null;
}
