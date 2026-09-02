"use server";

import { fetchPublicGameRanking } from "@/lib/public-game-ranking-data";
import type { PublicGameRankRow } from "@/lib/public-game-ranking";

export async function fetchPublicGameRankingAction(
  contentKey: string,
): Promise<PublicGameRankRow[]> {
  return fetchPublicGameRanking(contentKey);
}
