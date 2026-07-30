import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getStudentSessionToken } from "@/lib/student-session";
import type { ActivityDetailsV1 } from "@/lib/activity-result-schemas";

export type SubmitActivityResult = {
  recorded: boolean;
  practiceOnly: boolean;
  sessionId: string | null;
};

function firstRow<T>(data: T | T[] | null): T | null {
  if (!data) return null;
  return Array.isArray(data) ? (data[0] ?? null) : data;
}

/**
 * Submit a simulation or non-scored activity session.
 * Recorded only when the student's class has content assigned and active.
 */
export async function submitActivityFromSession(input: {
  contentKey: string;
  status: "started" | "completed";
  details?: ActivityDetailsV1;
  durationSec?: number | null;
  sessionToken?: string | null;
}): Promise<SubmitActivityResult | { error: string }> {
  const token = input.sessionToken ?? (await getStudentSessionToken());
  if (!token) {
    return { recorded: false, practiceOnly: true, sessionId: null };
  }

  const contentKey = input.contentKey.trim();
  if (!contentKey) return { error: "contentKey가 필요해요." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pm_submit_activity", {
    p_session_token: token,
    p_content_key: contentKey,
    p_status: input.status,
    p_details: input.details ?? { v: 1, summary: {} },
    p_duration_sec: input.durationSec ?? null,
  });

  if (error) {
    console.error("[pm] pm_submit_activity failed:", error.message);
    if (error.message.includes("invalid session")) {
      return { error: "학생 로그인이 필요해요." };
    }
    return { error: "활동을 기록하지 못했어요." };
  }

  const row = firstRow(data) as {
    recorded: boolean;
    practice_only: boolean;
    session_id: string | null;
  } | null;

  if (!row) return { error: "제출 결과가 없어요." };

  return {
    recorded: Boolean(row.recorded),
    practiceOnly: Boolean(row.practice_only),
    sessionId: row.session_id,
  };
}
