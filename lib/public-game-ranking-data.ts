import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getContent } from "@/lib/contents";
import { getStudentSessionToken } from "@/lib/student-session";
import type { PublicGameRankRow } from "@/lib/public-game-ranking";

function firstRows<T>(data: T | T[] | null): T[] {
  if (!data) return [];
  return Array.isArray(data) ? data : [data];
}

export async function fetchPublicGameRanking(
  contentKey: string,
): Promise<PublicGameRankRow[]> {
  const content = getContent(contentKey.trim());
  if (!content || content.type !== "game") return [];

  const token = await getStudentSessionToken();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pm_list_public_game_ranking", {
    p_content_key: content.key,
    p_session_token: token,
  });

  if (error) {
    console.error("[pm] pm_list_public_game_ranking failed:", error.message);
    return [];
  }

  return firstRows(data).map((row) => {
    const r = row as {
      rank: number;
      display_name: string;
      class_name: string | null;
      school_name: string | null;
      score: number;
      is_me: boolean;
      is_masked: boolean;
    };
    return {
      rank: r.rank,
      displayName: r.display_name,
      className: r.class_name,
      schoolName: r.school_name,
      score: r.score,
      isMe: Boolean(r.is_me),
      isMasked: Boolean(r.is_masked),
    };
  });
}
