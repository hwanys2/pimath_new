import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  PVP_TABLE_BY_CONTENT,
  type ActivityDetailsV1,
} from "@/lib/activity-result-schemas";
import type { StudentActivitySummary } from "@/lib/activity-results";

export type PvpGameRow = {
  gameId: string;
  studentId: string;
  displayName: string;
  opponentName: string;
  result: "win" | "loss" | "draw";
  scope: string;
  playedAt: string;
};

function firstRows<T>(data: T | T[] | null): T[] {
  if (!data) return [];
  return Array.isArray(data) ? data : [data];
}

export async function fetchClassPvpGames(
  classId: string,
  contentKey: string,
): Promise<PvpGameRow[]> {
  const table = PVP_TABLE_BY_CONTENT[contentKey];
  if (!table) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pm_teacher_list_pvp_games", {
    p_class_id: classId,
    p_table: table,
  });

  if (error) {
    console.error("[pm] pm_teacher_list_pvp_games failed:", error.message);
    return [];
  }

  return firstRows(data).map((row) => {
    const r = row as {
      game_id: string;
      student_id: string;
      display_name: string;
      opponent_name: string;
      result: string;
      scope: string;
      played_at: string;
    };
    return {
      gameId: r.game_id,
      studentId: r.student_id,
      displayName: r.display_name,
      opponentName: r.opponent_name,
      result: r.result as "win" | "loss" | "draw",
      scope: r.scope,
      playedAt: r.played_at,
    };
  });
}

export function buildPvpStudentSummaries(
  students: {
    id: string;
    displayName: string;
    loginId: string;
    studentNumber: number | null;
  }[],
  games: PvpGameRow[],
): StudentActivitySummary[] {
  const byStudent = new Map<string, PvpGameRow[]>();
  for (const game of games) {
    const list = byStudent.get(game.studentId) ?? [];
    list.push(game);
    byStudent.set(game.studentId, list);
  }

  return students.map((student) => {
    const studentGames = byStudent.get(student.id) ?? [];
    const wins = studentGames.filter((g) => g.result === "win").length;
    const losses = studentGames.filter((g) => g.result === "loss").length;
    const draws = studentGames.filter((g) => g.result === "draw").length;
    const latest = studentGames[0] ?? null;

    const details: ActivityDetailsV1 | null =
      studentGames.length > 0
        ? {
            v: 1,
            summary: { wins, losses, draws, games: studentGames.length },
          }
        : null;

    return {
      studentId: student.id,
      displayName: student.displayName,
      loginId: student.loginId,
      studentNumber: student.studentNumber,
      participated: studentGames.length > 0,
      runCount: studentGames.length,
      bestScore: wins > 0 ? wins * 100 : null,
      latestScore: latest
        ? latest.result === "win"
          ? 100
          : latest.result === "draw"
            ? 50
            : 0
        : null,
      lastPlayedAt: latest?.playedAt ?? null,
      latestDetails: details,
      completedCount: 0,
      lastStatus: null,
    };
  });
}

export async function fetchClassPvpResults(
  classId: string,
  contentKey: string,
): Promise<{
  contentKey: string;
  students: StudentActivitySummary[];
  games: PvpGameRow[];
  totalRuns: number;
}> {
  const { fetchClassStudents } = await import("@/lib/activity-results");
  const [students, games] = await Promise.all([
    fetchClassStudents(classId),
    fetchClassPvpGames(classId, contentKey),
  ]);

  return {
    contentKey,
    students: buildPvpStudentSummaries(students, games),
    games,
    totalRuns: games.length,
  };
}

export async function fetchStudentPvpGames(
  classId: string,
  contentKey: string,
  studentId: string,
): Promise<PvpGameRow[]> {
  const games = await fetchClassPvpGames(classId, contentKey);
  return games.filter((g) => g.studentId === studentId);
}
