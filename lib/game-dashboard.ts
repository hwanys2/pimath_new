import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getContent } from "@/lib/contents";
import { getUnit, getUnitLabel } from "@/lib/curriculum";
import {
  isPvpContent,
  isSessionGameContent,
  PVP_TABLE_BY_CONTENT,
  SESSION_GAME_BY_CONTENT,
} from "@/lib/activity-result-schemas";
import {
  fetchClassContentResults,
  fetchClassGameRuns,
  fetchClassStudents,
} from "@/lib/activity-results";
import { fetchClassPvpResults } from "@/lib/activity-results-pvp";
import { fetchClassSessionResults } from "@/lib/activity-results-sessions";
import type {
  GameDashboardKind,
  GameDashboardLiveMatch,
  GameDashboardLiveSession,
  GameDashboardRun,
  GameDashboardRankRow,
  GameDashboardSnapshot,
  GamePresencePhase,
} from "@/lib/game-dashboard-types";
import {
  buildDashboardKpis,
  buildDashboardStudents,
  rankDashboardStudents,
  type MatchSeatInput,
  type PresenceInput,
} from "@/lib/game-dashboard-view";

function firstRows<T>(data: T | T[] | null): T[] {
  if (!data) return [];
  return Array.isArray(data) ? data : [data];
}

function asPhase(raw: string | null | undefined): GamePresencePhase {
  if (raw === "lobby" || raw === "waiting" || raw === "playing" || raw === "ended") {
    return raw;
  }
  return "playing";
}

async function fetchPresence(
  classId: string,
  contentKey: string,
): Promise<Map<string, PresenceInput>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pm_teacher_list_game_presence", {
    p_class_id: classId,
    p_content_key: contentKey,
  });
  const map = new Map<string, PresenceInput>();
  if (error) {
    console.error("[pm] pm_teacher_list_game_presence failed:", error.message);
    return map;
  }
  for (const row of firstRows(data)) {
    const r = row as {
      student_id: string;
      phase: string;
      live_score: number | null;
      last_seen_at: string;
    };
    map.set(r.student_id, {
      studentId: r.student_id,
      phase: asPhase(r.phase),
      liveScore: typeof r.live_score === "number" ? r.live_score : null,
      lastSeenAt: r.last_seen_at,
    });
  }
  return map;
}

async function fetchLiveMatches(
  classId: string,
  contentKey: string,
): Promise<GameDashboardLiveMatch[]> {
  const table = PVP_TABLE_BY_CONTENT[contentKey];
  if (!table) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pm_teacher_list_live_pvp", {
    p_class_id: classId,
    p_table: table,
  });
  if (error) {
    console.error("[pm] pm_teacher_list_live_pvp failed:", error.message);
    return [];
  }
  return firstRows(data).map((row) => {
    const r = row as {
      game_id: string;
      black_student_id: string | null;
      white_student_id: string | null;
      black_name: string;
      white_name: string;
      turn: string | null;
      move_count: number;
      game_phase: string | null;
      scope: string;
      updated_at: string;
    };
    return {
      gameId: r.game_id,
      blackName: r.black_name,
      whiteName: r.white_name,
      blackStudentId: r.black_student_id,
      whiteStudentId: r.white_student_id,
      turn: r.turn,
      moveCount: Number(r.move_count ?? 0),
      gamePhase: r.game_phase,
      scope: r.scope,
      updatedAt: r.updated_at,
    };
  });
}

async function fetchQueueIds(
  classId: string,
  contentKey: string,
): Promise<Set<string>> {
  const table = PVP_TABLE_BY_CONTENT[contentKey];
  const ids = new Set<string>();
  if (!table) return ids;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pm_teacher_list_pvp_queue", {
    p_class_id: classId,
    p_table: table,
  });
  if (error) {
    console.error("[pm] pm_teacher_list_pvp_queue failed:", error.message);
    return ids;
  }
  for (const row of firstRows(data)) {
    const r = row as { student_id: string | null };
    if (r.student_id) ids.add(r.student_id);
  }
  return ids;
}

async function fetchLiveSession(
  classId: string,
  contentKey: string,
): Promise<GameDashboardLiveSession | null> {
  const game = SESSION_GAME_BY_CONTENT[contentKey];
  if (!game) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "pm_teacher_list_live_session_players",
    {
      p_class_id: classId,
      p_game: game,
    },
  );
  if (error) {
    console.error(
      "[pm] pm_teacher_list_live_session_players failed:",
      error.message,
    );
    return null;
  }
  const rows = firstRows(data) as {
    session_id: string;
    session_phase: string;
    round_number: number;
    student_id: string;
    display_name: string;
    score: number;
    extra: Record<string, unknown> | null;
    updated_at: string;
  }[];
  if (rows.length === 0) return null;
  const first = rows[0];
  return {
    sessionId: first.session_id,
    phase: first.session_phase,
    roundNumber: first.round_number,
    updatedAt: first.updated_at,
    players: rows.map((r) => ({
      studentId: r.student_id,
      displayName: r.display_name,
      score: r.score,
      extra: r.extra ?? {},
    })),
  };
}

function matchSeats(
  matches: GameDashboardLiveMatch[],
): Map<string, MatchSeatInput> {
  const map = new Map<string, MatchSeatInput>();
  for (const match of matches) {
    if (match.blackStudentId) {
      map.set(match.blackStudentId, {
        studentId: match.blackStudentId,
        opponentName: match.whiteName,
      });
    }
    if (match.whiteStudentId) {
      map.set(match.whiteStudentId, {
        studentId: match.whiteStudentId,
        opponentName: match.blackName,
      });
    }
  }
  return map;
}

async function fetchTeacherScopedRanking(
  classId: string,
  contentKey: string,
  scope: "school" | "world",
): Promise<GameDashboardRankRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pm_teacher_list_game_ranking", {
    p_class_id: classId,
    p_content_key: contentKey,
    p_scope: scope,
    p_mode: "best",
  });
  if (error) {
    console.error("[pm] pm_teacher_list_game_ranking failed:", error.message);
    return [];
  }
  return firstRows(data).map((row) => {
    const r = row as {
      rank: number;
      student_id: string;
      display_name: string;
      class_name: string | null;
      school_name: string | null;
      student_number: number | null;
      score: number;
      created_at: string;
      run_count: number | null;
      is_masked: boolean;
    };
    return {
      rank: r.rank,
      studentId: r.student_id,
      displayName: r.display_name,
      studentNumber:
        typeof r.student_number === "number" ? r.student_number : null,
      className: r.class_name,
      schoolName: r.school_name,
      score: r.score,
      runCount: typeof r.run_count === "number" ? r.run_count : 0,
      isMasked: Boolean(r.is_masked),
    };
  });
}

function buildRecentRuns(input: {
  kind: GameDashboardKind;
  students: { studentId: string; displayName: string; studentNumber: number | null }[];
  soloRuns: { id: string; studentId: string; score: number; createdAt: string }[];
  pvpGames: {
    gameId: string;
    studentId: string;
    displayName: string;
    opponentName: string;
    result: "win" | "loss" | "draw";
    playedAt: string;
  }[];
  sessionRows: {
    sessionId: string;
    studentId: string;
    displayName: string;
    sessionScore: number;
    playedAt: string;
  }[];
}): GameDashboardRun[] {
  const byId = new Map(
    input.students.map((s) => [s.studentId, s] as const),
  );
  if (input.kind === "pvp") {
    return input.pvpGames.slice(0, 16).map((g) => {
      const student = byId.get(g.studentId);
      const result =
        g.result === "win" ? "승" : g.result === "loss" ? "패" : "무";
      return {
        id: `${g.gameId}-${g.studentId}`,
        studentId: g.studentId,
        displayName: student?.displayName ?? g.displayName,
        studentNumber: student?.studentNumber ?? null,
        score: null,
        label: `vs ${g.opponentName} · ${result}`,
        createdAt: g.playedAt,
      };
    });
  }
  if (input.kind === "session") {
    return input.sessionRows.slice(0, 16).map((r, i) => {
      const student = byId.get(r.studentId);
      return {
        id: `${r.sessionId}-${r.studentId}-${i}`,
        studentId: r.studentId,
        displayName: student?.displayName ?? r.displayName,
        studentNumber: student?.studentNumber ?? null,
        score: r.sessionScore,
        label: `${r.sessionScore}점`,
        createdAt: r.playedAt,
      };
    });
  }
  return input.soloRuns.slice(0, 16).map((run) => {
    const student = byId.get(run.studentId);
    return {
      id: run.id,
      studentId: run.studentId,
      displayName: student?.displayName ?? "학생",
      studentNumber: student?.studentNumber ?? null,
      score: run.score,
      label: `${run.score}점`,
      createdAt: run.createdAt,
    };
  });
}

export async function fetchGameDashboardSnapshot(
  classId: string,
  contentKey: string,
  className: string,
): Promise<GameDashboardSnapshot | null> {
  const content = getContent(contentKey);
  if (!content || content.type !== "game") return null;

  const kind: GameDashboardKind = isPvpContent(contentKey)
    ? "pvp"
    : isSessionGameContent(contentKey)
      ? "session"
      : "solo";

  const unit = getUnit(content.unitId);

  const supabase = await createClient();
  const [
    students,
    presenceByStudent,
    liveMatches,
    queuedIds,
    liveSession,
    resultView,
    soloRuns,
    assignment,
    schoolRanking,
    worldRanking,
  ] = await Promise.all([
    fetchClassStudents(classId),
    fetchPresence(classId, contentKey),
    fetchLiveMatches(classId, contentKey),
    fetchQueueIds(classId, contentKey),
    fetchLiveSession(classId, contentKey),
    kind === "pvp"
      ? fetchClassPvpResults(classId, contentKey)
      : kind === "session"
        ? fetchClassSessionResults(classId, contentKey)
        : fetchClassContentResults(classId, contentKey, "game"),
    kind === "solo" ? fetchClassGameRuns(classId, contentKey) : Promise.resolve([]),
    supabase
      .from("pm_class_contents")
      .select("is_active")
      .eq("class_id", classId)
      .eq("content_key", contentKey)
      .maybeSingle(),
    fetchTeacherScopedRanking(classId, contentKey, "school"),
    fetchTeacherScopedRanking(classId, contentKey, "world"),
  ]);

  const dashboardStudents = buildDashboardStudents({
    students: resultView.students,
    presenceByStudent,
    queuedIds,
    matchByStudent: matchSeats(liveMatches),
  });

  if (liveSession) {
    const liveScoreById = new Map(
      liveSession.players.map((p) => [p.studentId, p.score] as const),
    );
    for (const row of dashboardStudents) {
      const live = liveScoreById.get(row.studentId);
      if (typeof live === "number") {
        row.liveScore = live;
        if (row.status === "idle") row.status = "playing";
        row.online = true;
      }
    }
  }

  const ranking = rankDashboardStudents(dashboardStudents);
  const kpis = buildDashboardKpis(dashboardStudents, resultView.totalRuns);
  const pvpGames =
    "games" in resultView && Array.isArray(resultView.games)
      ? resultView.games
      : [];
  const sessionRows =
    "rows" in resultView && Array.isArray(resultView.rows)
      ? resultView.rows
      : [];

  return {
    fetchedAt: new Date().toISOString(),
    classId,
    className,
    contentKey,
    contentTitle: content.title,
    contentHref: content.href,
    kind,
    isActive: Boolean(assignment.data?.is_active),
    unitLabel: unit ? getUnitLabel(unit) : null,
    students: dashboardStudents,
    ranking,
    schoolRanking,
    worldRanking,
    recentRuns: buildRecentRuns({
      kind,
      students: students.map((s) => ({
        studentId: s.id,
        displayName: s.displayName,
        studentNumber: s.studentNumber,
      })),
      soloRuns,
      pvpGames,
      sessionRows,
    }),
    liveMatches,
    liveSession,
    kpis,
  };
}
