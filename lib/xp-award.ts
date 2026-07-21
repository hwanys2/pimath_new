import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getStudentSessionToken } from "@/lib/student-session";
import { scoreToXp } from "@/lib/xp";

export type StudentProgress = {
  id: string;
  loginId: string;
  displayName: string;
  classId: string;
  className: string;
  teacherId: string;
  totalXp: number;
  level: number;
  activeAvatar: string;
};

export type AwardXpResult = {
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

export const fetchStudentProgress = cache(
  async (sessionToken?: string | null): Promise<StudentProgress | null> => {
    const token = sessionToken ?? (await getStudentSessionToken());
    if (!token) return null;

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("pm_get_student_progress", {
      p_session_token: token,
    });

    if (error) {
      console.error("[pm] pm_get_student_progress failed:", error.message);
      return null;
    }

    const row = firstRow(data) as {
      id: string;
      login_id: string;
      display_name: string;
      class_id: string;
      class_name: string;
      teacher_id: string;
      total_xp: number | string;
      level: number;
      active_avatar: string;
    } | null;

    if (!row) return null;

    return {
      id: row.id,
      loginId: row.login_id,
      displayName: row.display_name,
      classId: row.class_id,
      className: row.class_name,
      teacherId: row.teacher_id,
      totalXp: Number(row.total_xp),
      level: row.level,
      activeAvatar: row.active_avatar,
    };
  },
);

/**
 * Award XP from a finished **game** run (not simulations).
 * score is hard-clamped 0–5000 and mapped 1:1 to XP.
 */
export async function awardStudentXpFromSession(input: {
  gameKey: string;
  score: number;
  sessionToken?: string | null;
}): Promise<AwardXpResult | { error: string }> {
  const token = input.sessionToken ?? (await getStudentSessionToken());
  if (!token) return { error: "학생 로그인이 필요해요." };

  const gameKey = input.gameKey.trim();
  if (!gameKey) return { error: "gameKey가 필요해요." };

  const score = scoreToXp(input.score);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pm_award_student_xp", {
    p_session_token: token,
    p_game_key: gameKey,
    p_score: score,
  });

  if (error) {
    console.error("[pm] pm_award_student_xp failed:", error.message);
    return { error: "경험치를 반영하지 못했어요." };
  }

  const row = firstRow(data) as {
    total_xp: number | string;
    level: number;
    xp_awarded: number;
    level_before: number;
    level_after: number;
    leveled_up: boolean;
  } | null;

  if (!row) return { error: "경험치 결과가 없어요." };

  return {
    totalXp: Number(row.total_xp),
    level: row.level,
    xpAwarded: row.xp_awarded,
    levelBefore: row.level_before,
    levelAfter: row.level_after,
    leveledUp: row.leveled_up,
  };
}

export async function setStudentAvatarFromSession(
  avatar: string,
  sessionToken?: string | null,
): Promise<{ avatar: string } | { error: string }> {
  const token = sessionToken ?? (await getStudentSessionToken());
  if (!token) return { error: "학생 로그인이 필요해요." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pm_set_student_avatar", {
    p_session_token: token,
    p_avatar: avatar,
  });

  if (error) {
    console.error("[pm] pm_set_student_avatar failed:", error.message);
    if (error.message.includes("locked")) {
      return { error: "아직 해금되지 않은 동료예요." };
    }
    return { error: "아바타를 바꾸지 못했어요." };
  }

  return { avatar: String(data) };
}
