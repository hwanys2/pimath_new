import type { XpRankingRow } from "@/lib/game-types";

export type XpRankingDisplayItem =
  | { kind: "row"; row: XpRankingRow }
  | { kind: "gap"; afterRank: number };

/** Insert ··· separators where ranks are not contiguous. */
export function buildXpRankingDisplayItems(
  rows: XpRankingRow[],
): XpRankingDisplayItem[] {
  const items: XpRankingDisplayItem[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (i > 0) {
      const prev = rows[i - 1];
      if (row.rank > prev.rank + 1) {
        items.push({ kind: "gap", afterRank: prev.rank });
      }
    }
    items.push({ kind: "row", row });
  }
  return items;
}
