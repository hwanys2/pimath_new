import "server-only";
import { createClient } from "@/lib/supabase/server";
import { SESSION_GAME_BY_CONTENT } from "@/lib/activity-result-schemas";
import type { StudentActivitySummary } from "@/lib/activity-results";
import type { ActivityDetailsV1 } from "@/lib/activity-result-schemas";

export type SessionPlayerRow = {
  sessionId: string;
  studentId: string;
  displayName: string;
  sessionScore: number;
  roundScore: number;
  playedAt: string;
};

function firstRows<T>(data: T | T[] | null): T[] {
  if (!data) return [];
  return Array.isArray(data) ? data : [data];
}

export async function fetchClassSessionPlayers(
  classId: string,
  contentKey: string,
): Promise<SessionPlayerRow[]> {
  const game = SESSION_GAME_BY_CONTENT[contentKey];
  if (!game) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pm_teacher_list_session_players", {
    p_class_id: classId,
    p_game: game,
  });

  if (error) {
    console.error("[pm] pm_teacher_list_session_players failed:", error.message);
    return [];
  }

  return firstRows(data).map((row) => {
    const r = row as {
      session_id: string;
      student_id: string;
      display_name: string;
      session_score: number;
      round_score: number;
      played_at: string;
    };
    return {
      sessionId: r.session_id,
      studentId: r.student_id,
      displayName: r.display_name,
      sessionScore: r.session_score,
      roundScore: r.round_score,
      playedAt: r.played_at,
    };
  });
}

export function buildSessionStudentSummaries(
  students: {
    id: string;
    displayName: string;
    loginId: string;
    studentNumber: number | null;
  }[],
  rows: SessionPlayerRow[],
): StudentActivitySummary[] {
  const byStudent = new Map<string, SessionPlayerRow[]>();
  for (const row of rows) {
    const list = byStudent.get(row.studentId) ?? [];
    list.push(row);
    byStudent.set(row.studentId, list);
  }

  return students.map((student) => {
    const studentRows = byStudent.get(student.id) ?? [];
    const best = studentRows.reduce<SessionPlayerRow | null>((acc, r) => {
      if (!acc || r.sessionScore > acc.sessionScore) return r;
      return acc;
    }, null);
    const latest = studentRows[0] ?? null;

    const details: ActivityDetailsV1 | null =
      latest
        ? {
            v: 1,
            summary: {
              sessionScore: latest.sessionScore,
              roundScore: latest.roundScore,
            },
          }
        : null;

    return {
      studentId: student.id,
      displayName: student.displayName,
      loginId: student.loginId,
      studentNumber: student.studentNumber,
      participated: studentRows.length > 0,
      runCount: studentRows.length,
      bestScore: best?.sessionScore ?? null,
      latestScore: latest?.sessionScore ?? null,
      lastPlayedAt: latest?.playedAt ?? null,
      latestDetails: details,
      completedCount: 0,
      lastStatus: null,
    };
  });
}

export async function fetchClassSessionResults(
  classId: string,
  contentKey: string,
): Promise<{
  contentKey: string;
  students: StudentActivitySummary[];
  rows: SessionPlayerRow[];
  totalRuns: number;
}> {
  const { fetchClassStudents } = await import("@/lib/activity-results");
  const [students, rows] = await Promise.all([
    fetchClassStudents(classId),
    fetchClassSessionPlayers(classId, contentKey),
  ]);

  return {
    contentKey,
    students: buildSessionStudentSummaries(students, rows),
    rows,
    totalRuns: rows.length,
  };
}

export async function fetchStudentSessionRows(
  classId: string,
  contentKey: string,
  studentId: string,
): Promise<SessionPlayerRow[]> {
  const rows = await fetchClassSessionPlayers(classId, contentKey);
  return rows.filter((r) => r.studentId === studentId);
}
