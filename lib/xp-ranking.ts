import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getStudentSessionToken } from "@/lib/student-session";
import type { RankingScope, XpRankingRow } from "@/lib/game-types";

export type { XpRankingRow } from "@/lib/game-types";

function firstRows<T>(data: T | T[] | null): T[] {
  if (!data) return [];
  return Array.isArray(data) ? data : [data];
}

/** Cumulative XP leaderboard for /adventure (world / school / class). */
export async function fetchXpRanking(input: {
  scope?: RankingScope;
  sessionToken?: string | null;
}): Promise<XpRankingRow[]> {
  const token = input.sessionToken ?? (await getStudentSessionToken());
  if (!token) return [];

  const scope = input.scope ?? "class";
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pm_list_xp_ranking", {
    p_session_token: token,
    p_scope: scope,
  });

  if (error) {
    console.error("[pm] pm_list_xp_ranking failed:", error.message);
    return [];
  }

  const rows = firstRows(data) as {
    rank: number;
    student_id: string;
    display_name: string;
    class_name: string | null;
    total_xp: number | string;
    level: number;
    is_me: boolean;
  }[];

  return rows.map((row) => ({
    rank: row.rank,
    studentId: row.student_id,
    displayName: row.display_name,
    className: row.class_name,
    totalXp: Number(row.total_xp),
    level: row.level,
    isMe: Boolean(row.is_me),
  }));
}
