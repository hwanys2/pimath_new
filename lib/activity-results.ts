import "server-only";
import { createClient } from "@/lib/supabase/server";
import { parseActivityDetails } from "@/lib/activity-result-schemas";
import type { ActivityDetailsV1 } from "@/lib/activity-result-schemas";
import type { ContentType } from "@/lib/contents";

export type GameRunRow = {
  id: string;
  studentId: string;
  score: number;
  details: ActivityDetailsV1 | null;
  createdAt: string;
};

export type ActivitySessionRow = {
  id: string;
  studentId: string;
  status: "started" | "completed";
  details: ActivityDetailsV1 | null;
  durationSec: number | null;
  createdAt: string;
  completedAt: string | null;
};

export type StudentActivitySummary = {
  studentId: string;
  displayName: string;
  loginId: string;
  participated: boolean;
  runCount: number;
  bestScore: number | null;
  latestScore: number | null;
  lastPlayedAt: string | null;
  latestDetails: ActivityDetailsV1 | null;
  /** For simulations */
  completedCount: number;
  lastStatus: "started" | "completed" | null;
};

export type ClassContentResultView = {
  contentKey: string;
  students: StudentActivitySummary[];
  totalRuns: number;
};

function mapGameRun(row: {
  id: string;
  student_id: string;
  score: number;
  details: unknown;
  created_at: string;
}): GameRunRow {
  return {
    id: row.id,
    studentId: row.student_id,
    score: row.score,
    details: parseActivityDetails(row.details),
    createdAt: row.created_at,
  };
}

function mapActivitySession(row: {
  id: string;
  student_id: string;
  status: string;
  details: unknown;
  duration_sec: number | null;
  created_at: string;
  completed_at: string | null;
}): ActivitySessionRow {
  return {
    id: row.id,
    studentId: row.student_id,
    status: row.status as "started" | "completed",
    details: parseActivityDetails(row.details),
    durationSec: row.duration_sec,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

export async function fetchClassGameRuns(
  classId: string,
  contentKey: string,
): Promise<GameRunRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pm_game_runs")
    .select("id, student_id, score, details, created_at")
    .eq("class_id", classId)
    .eq("content_key", contentKey)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[pm] fetchClassGameRuns failed:", error.message);
    return [];
  }

  return (data ?? []).map(mapGameRun);
}

export async function fetchClassActivitySessions(
  classId: string,
  contentKey: string,
): Promise<ActivitySessionRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pm_activity_sessions")
    .select(
      "id, student_id, status, details, duration_sec, created_at, completed_at",
    )
    .eq("class_id", classId)
    .eq("content_key", contentKey)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[pm] fetchClassActivitySessions failed:", error.message);
    return [];
  }

  return (data ?? []).map(mapActivitySession);
}

export async function fetchClassStudents(classId: string): Promise<
  { id: string; displayName: string; loginId: string }[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pm_students")
    .select("id, display_name, login_id")
    .eq("class_id", classId)
    .order("display_name", { ascending: true });

  if (error) {
    console.error("[pm] fetchClassStudents failed:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    displayName: row.display_name,
    loginId: row.login_id,
  }));
}

function buildStudentSummariesFromRuns(
  students: { id: string; displayName: string; loginId: string }[],
  runs: GameRunRow[],
): StudentActivitySummary[] {
  const byStudent = new Map<string, GameRunRow[]>();
  for (const run of runs) {
    const list = byStudent.get(run.studentId) ?? [];
    list.push(run);
    byStudent.set(run.studentId, list);
  }

  return students.map((student) => {
    const studentRuns = byStudent.get(student.id) ?? [];
    const best = studentRuns.reduce<GameRunRow | null>((acc, r) => {
      if (!acc || r.score > acc.score) return r;
      return acc;
    }, null);
    const latest = studentRuns[0] ?? null;

    return {
      studentId: student.id,
      displayName: student.displayName,
      loginId: student.loginId,
      participated: studentRuns.length > 0,
      runCount: studentRuns.length,
      bestScore: best?.score ?? null,
      latestScore: latest?.score ?? null,
      lastPlayedAt: latest?.createdAt ?? null,
      latestDetails: latest?.details ?? null,
      completedCount: 0,
      lastStatus: null,
    };
  });
}

function buildStudentSummariesFromSessions(
  students: { id: string; displayName: string; loginId: string }[],
  sessions: ActivitySessionRow[],
): StudentActivitySummary[] {
  const byStudent = new Map<string, ActivitySessionRow[]>();
  for (const session of sessions) {
    const list = byStudent.get(session.studentId) ?? [];
    list.push(session);
    byStudent.set(session.studentId, list);
  }

  return students.map((student) => {
    const studentSessions = byStudent.get(student.id) ?? [];
    const latest = studentSessions[0] ?? null;
    const completedCount = studentSessions.filter(
      (s) => s.status === "completed",
    ).length;

    return {
      studentId: student.id,
      displayName: student.displayName,
      loginId: student.loginId,
      participated: studentSessions.length > 0,
      runCount: studentSessions.length,
      bestScore: null,
      latestScore: null,
      lastPlayedAt: latest?.createdAt ?? null,
      latestDetails: latest?.details ?? null,
      completedCount,
      lastStatus: latest?.status ?? null,
    };
  });
}

export async function fetchClassContentResults(
  classId: string,
  contentKey: string,
  kind: "game" | "simulation" = "game",
): Promise<ClassContentResultView> {
  const students = await fetchClassStudents(classId);

  if (kind === "simulation") {
    const sessions = await fetchClassActivitySessions(classId, contentKey);
    return {
      contentKey,
      students: buildStudentSummariesFromSessions(students, sessions),
      totalRuns: sessions.length,
    };
  }

  const runs = await fetchClassGameRuns(classId, contentKey);
  return {
    contentKey,
    students: buildStudentSummariesFromRuns(students, runs),
    totalRuns: runs.length,
  };
}

export type AssignedContentActivity = {
  contentKey: string;
  title: string;
  type: ContentType;
  participantCount: number;
  studentCount: number;
  totalRuns: number;
  lastActivityAt: string | null;
};

export async function fetchClassActivityOverview(
  classId: string,
  assignedKeys: { contentKey: string; isActive: boolean }[],
): Promise<AssignedContentActivity[]> {
  const { getContent } = await import("@/lib/contents");
  const { fetchClassPvpResults } = await import("@/lib/activity-results-pvp");
  const { fetchClassSessionResults } = await import(
    "@/lib/activity-results-sessions"
  );
  const {
    isPvpContent,
    isSessionGameContent,
  } = await import("@/lib/activity-result-schemas");

  const students = await fetchClassStudents(classId);
  const studentCount = students.length;
  const activeKeys = assignedKeys.filter((a) => a.isActive);

  const results: AssignedContentActivity[] = [];

  for (const { contentKey } of activeKeys) {
    const content = getContent(contentKey);
    if (!content) continue;

    let view: { students: StudentActivitySummary[]; totalRuns: number };

    if (isPvpContent(contentKey)) {
      const pvp = await fetchClassPvpResults(classId, contentKey);
      view = pvp;
    } else if (isSessionGameContent(contentKey)) {
      const session = await fetchClassSessionResults(classId, contentKey);
      view = session;
    } else {
      const kind = content.type === "simulation" ? "simulation" : "game";
      view = await fetchClassContentResults(classId, contentKey, kind);
    }

    const participantCount = view.students.filter((s) => s.participated).length;
    const lastActivityAt = view.students.reduce<string | null>((acc, s) => {
      if (!s.lastPlayedAt) return acc;
      if (!acc || s.lastPlayedAt > acc) return s.lastPlayedAt;
      return acc;
    }, null);

    results.push({
      contentKey,
      title: content.title,
      type: content.type,
      participantCount,
      studentCount,
      totalRuns: view.totalRuns,
      lastActivityAt,
    });
  }

  return results.sort((a, b) => {
    if (a.lastActivityAt && b.lastActivityAt) {
      return b.lastActivityAt.localeCompare(a.lastActivityAt);
    }
    if (a.lastActivityAt) return -1;
    if (b.lastActivityAt) return 1;
    return a.title.localeCompare(b.title, "ko");
  });
}

export async function fetchClassTodayActivityCounts(
  classIds: string[],
): Promise<Record<string, number>> {
  if (classIds.length === 0) return {};

  const supabase = await createClient();
  const since = new Date();
  since.setHours(0, 0, 0, 0);

  const counts = Object.fromEntries(classIds.map((id) => [id, 0]));

  const [{ data: runs }, { data: sessions }] = await Promise.all([
    supabase
      .from("pm_game_runs")
      .select("class_id")
      .in("class_id", classIds)
      .gte("created_at", since.toISOString()),
    supabase
      .from("pm_activity_sessions")
      .select("class_id")
      .in("class_id", classIds)
      .gte("created_at", since.toISOString()),
  ]);

  for (const row of runs ?? []) {
    counts[row.class_id] = (counts[row.class_id] ?? 0) + 1;
  }
  for (const row of sessions ?? []) {
    counts[row.class_id] = (counts[row.class_id] ?? 0) + 1;
  }

  return counts;
}

export async function fetchStudentGameRuns(
  classId: string,
  contentKey: string,
  studentId: string,
): Promise<GameRunRow[]> {
  const runs = await fetchClassGameRuns(classId, contentKey);
  return runs.filter((r) => r.studentId === studentId);
}

export async function fetchStudentActivitySessions(
  classId: string,
  contentKey: string,
  studentId: string,
): Promise<ActivitySessionRow[]> {
  const sessions = await fetchClassActivitySessions(classId, contentKey);
  return sessions.filter((s) => s.studentId === studentId);
}
