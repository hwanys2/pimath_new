import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getStudentSessionToken } from "@/lib/student-session";
import {
  deltaForOmokOutcome,
  type OmokOutcome,
} from "@/lib/ordered-pair-omok-math";
import type { RankingRow, RankingScope } from "@/lib/game-types";

function firstRow<T>(data: T | T[] | null): T | null {
  if (!data) return null;
  return Array.isArray(data) ? (data[0] ?? null) : data;
}

export type OmokRatingResult = {
  recorded: boolean;
  practiceOnly: boolean;
  outcome: OmokOutcome;
  delta: number;
  totalBefore: number;
  totalAfter: number;
};

export async function applyOmokRatingFromSession(input: {
  outcome: OmokOutcome;
  sessionToken?: string | null;
}): Promise<OmokRatingResult | { error: string }> {
  const token = input.sessionToken ?? (await getStudentSessionToken());
  if (!token) {
    const delta = deltaForOmokOutcome(0, input.outcome);
    return {
      recorded: false,
      practiceOnly: true,
      outcome: input.outcome,
      delta,
      totalBefore: 0,
      totalAfter: 0,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pm_omok_apply_rating", {
    p_session_token: token,
    p_outcome: input.outcome,
  });

  if (error) {
    console.error("[pm] pm_omok_apply_rating:", error.message);
    if (error.message.includes("invalid session")) {
      return { error: "학생 로그인이 필요해요." };
    }
    return { error: "오목 점수를 반영하지 못했어요." };
  }

  const row = firstRow(data) as {
    recorded: boolean;
    practice_only: boolean;
    outcome: string;
    delta: number;
    total_before: number;
    total_after: number;
  } | null;

  if (!row) return { error: "점수 결과가 없어요." };

  const outcome =
    row.outcome === "win" || row.outcome === "loss" || row.outcome === "draw"
      ? row.outcome
      : input.outcome;

  return {
    recorded: Boolean(row.recorded),
    practiceOnly: Boolean(row.practice_only),
    outcome,
    delta: row.delta,
    totalBefore: row.total_before,
    totalAfter: row.total_after,
  };
}

export async function fetchOmokRatingRanking(input: {
  scope?: RankingScope;
  sessionToken?: string | null;
}): Promise<RankingRow[]> {
  const token = input.sessionToken ?? (await getStudentSessionToken());
  if (!token) return [];

  const scope = input.scope ?? "class";
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pm_omok_list_rating_ranking", {
    p_session_token: token,
    p_scope: scope,
  });

  if (error) {
    console.error("[pm] pm_omok_list_rating_ranking:", error.message);
    return [];
  }

  const rows = (Array.isArray(data) ? data : data ? [data] : []) as {
    rank: number;
    student_id: string;
    display_name: string;
    class_name: string | null;
    score: number;
    is_me: boolean;
  }[];

  return rows.map((row) => ({
    rank: row.rank,
    studentId: row.student_id,
    displayName: row.display_name,
    className: row.class_name,
    score: row.score,
    createdAt: "",
    isMe: Boolean(row.is_me),
  }));
}
