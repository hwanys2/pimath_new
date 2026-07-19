import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getStudentSessionToken } from "@/lib/student-session";
import { scoreToXp } from "@/lib/xp";
import type { RankingMode, RankingRow, RankingScope } from "@/lib/game-types";

export type { RankingMode, RankingRow, RankingScope } from "@/lib/game-types";

export type SubmitGameRunResult = {
  recorded: boolean;
  practiceOnly: boolean;
  score: number;
  totalXp: number;
  level: number;
  xpAwarded: number;
  levelBefore: number;
  levelAfter: number;
  leveledUp: boolean;
};

function firstRow<T>(data: T | T[] | null): T | null {
  if (!data) return null;
  return Array.isArray(data) ? (data[0] ?? null) : data;
}

function firstRows<T>(data: T | T[] | null): T[] {
  if (!data) return [];
  return Array.isArray(data) ? data : [data];
}

/**
 * Submit a finished game run. XP + ranking only when the student's class
 * has this content assigned and active.
 */
export async function submitGameRunFromSession(input: {
  contentKey: string;
  score: number;
  sessionToken?: string | null;
}): Promise<SubmitGameRunResult | { error: string }> {
  const token = input.sessionToken ?? (await getStudentSessionToken());
  if (!token) {
    return {
      recorded: false,
      practiceOnly: true,
      score: scoreToXp(input.score),
      totalXp: 0,
      level: 1,
      xpAwarded: 0,
      levelBefore: 1,
      levelAfter: 1,
      leveledUp: false,
    };
  }

  const contentKey = input.contentKey.trim();
  if (!contentKey) return { error: "contentKey가 필요해요." };

  const score = scoreToXp(input.score);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pm_submit_game_run", {
    p_session_token: token,
    p_content_key: contentKey,
    p_score: score,
  });

  if (error) {
    console.error("[pm] pm_submit_game_run failed:", error.message);
    if (error.message.includes("invalid session")) {
      return { error: "학생 로그인이 필요해요." };
    }
    return { error: "점수를 반영하지 못했어요." };
  }

  const row = firstRow(data) as {
    recorded: boolean;
    practice_only: boolean;
    score: number;
    total_xp: number | string;
    level: number;
    xp_awarded: number;
    level_before: number;
    level_after: number;
    leveled_up: boolean;
  } | null;

  if (!row) return { error: "제출 결과가 없어요." };

  return {
    recorded: Boolean(row.recorded),
    practiceOnly: Boolean(row.practice_only),
    score: row.score,
    totalXp: Number(row.total_xp),
    level: row.level,
    xpAwarded: row.xp_awarded,
    levelBefore: row.level_before,
    levelAfter: row.level_after,
    leveledUp: row.leveled_up,
  };
}

export async function fetchClassGameRanking(input: {
  contentKey: string;
  scope?: RankingScope;
  mode: RankingMode;
  sessionToken?: string | null;
}): Promise<RankingRow[]> {
  const token = input.sessionToken ?? (await getStudentSessionToken());
  if (!token) return [];

  const contentKey = input.contentKey.trim();
  if (!contentKey) return [];

  const scope = input.scope ?? "class";
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pm_list_game_ranking", {
    p_session_token: token,
    p_content_key: contentKey,
    p_scope: scope,
    p_mode: input.mode,
  });

  if (error) {
    console.error("[pm] pm_list_game_ranking failed:", error.message);
    return [];
  }

  const rows = firstRows(data) as {
    rank: number;
    student_id: string;
    display_name: string;
    class_name: string | null;
    score: number;
    created_at: string;
    is_me: boolean;
  }[];

  return rows.map((row) => ({
    rank: row.rank,
    studentId: row.student_id,
    displayName: row.display_name,
    className: row.class_name,
    score: row.score,
    createdAt: row.created_at,
    isMe: Boolean(row.is_me),
  }));
}
