import type { StudentActivitySummary } from "@/lib/activity-results";
import type {
  GameDashboardKpis,
  GameDashboardRankRow,
  GameDashboardStatus,
  GameDashboardStudent,
  GamePresencePhase,
} from "@/lib/game-dashboard-types";

export type PresenceInput = {
  studentId: string;
  phase: GamePresencePhase;
  liveScore: number | null;
  lastSeenAt: string;
};

export type QueueInput = {
  studentId: string;
};

export type MatchSeatInput = {
  studentId: string;
  opponentName: string;
};

function numberOf(studentNumber: number | null): number {
  return studentNumber ?? Number.POSITIVE_INFINITY;
}

export function deriveStudentStatus(input: {
  online: boolean;
  inQueue: boolean;
  inLiveMatch: boolean;
  presencePhase: GamePresencePhase | null;
  participated: boolean;
}): GameDashboardStatus {
  if (input.inLiveMatch) return "playing";
  if (input.inQueue) return "waiting";
  if (input.online) {
    if (input.presencePhase === "waiting" || input.presencePhase === "lobby") {
      return "waiting";
    }
    if (input.presencePhase === "ended") {
      return input.participated ? "done" : "idle";
    }
    return "playing";
  }
  if (input.participated) return "done";
  return "idle";
}

export function buildDashboardStudents(input: {
  students: StudentActivitySummary[];
  presenceByStudent: Map<string, PresenceInput>;
  queuedIds: Set<string>;
  matchByStudent: Map<string, MatchSeatInput>;
}): GameDashboardStudent[] {
  return input.students.map((student) => {
    const presence = input.presenceByStudent.get(student.studentId);
    const match = input.matchByStudent.get(student.studentId);
    const online = Boolean(presence) || Boolean(match) || input.queuedIds.has(student.studentId);
    const presencePhase = presence?.phase ?? null;
    const status = deriveStudentStatus({
      online: Boolean(presence) || Boolean(match),
      inQueue: input.queuedIds.has(student.studentId),
      inLiveMatch: Boolean(match),
      presencePhase,
      participated: student.participated,
    });

    return {
      studentId: student.studentId,
      displayName: student.displayName,
      loginId: student.loginId,
      studentNumber: student.studentNumber,
      status,
      online,
      presencePhase,
      liveScore: presence?.liveScore ?? null,
      lastSeenAt: presence?.lastSeenAt ?? null,
      opponentName: match?.opponentName ?? null,
      participated: student.participated,
      runCount: student.runCount,
      bestScore: student.bestScore,
      latestScore: student.latestScore,
      lastPlayedAt: student.lastPlayedAt,
      latestDetails: student.latestDetails,
    };
  });
}

export function rankDashboardStudents(
  students: GameDashboardStudent[],
): GameDashboardRankRow[] {
  const scored = students.filter(
    (s) => s.bestScore != null && Number.isFinite(s.bestScore),
  );
  return [...scored]
    .sort((a, b) => {
      const score = (b.bestScore ?? 0) - (a.bestScore ?? 0);
      if (score !== 0) return score;
      const byNumber = numberOf(a.studentNumber) - numberOf(b.studentNumber);
      if (byNumber !== 0) return byNumber;
      return a.displayName.localeCompare(b.displayName, "ko");
    })
    .map((student, index) => ({
      rank: index + 1,
      studentId: student.studentId,
      displayName: student.displayName,
      studentNumber: student.studentNumber,
      className: null,
      schoolName: null,
      score: student.bestScore ?? 0,
      runCount: student.runCount,
      isMasked: false,
    }));
}

export function buildDashboardKpis(
  students: GameDashboardStudent[],
  totalRuns: number,
): GameDashboardKpis {
  const studentCount = students.length;
  let playing = 0;
  let waiting = 0;
  let done = 0;
  let idle = 0;
  let online = 0;
  const scores: number[] = [];

  for (const student of students) {
    if (student.online) online += 1;
    if (student.status === "playing") playing += 1;
    else if (student.status === "waiting") waiting += 1;
    else if (student.status === "done") done += 1;
    else idle += 1;
    if (student.bestScore != null && Number.isFinite(student.bestScore)) {
      scores.push(student.bestScore);
    }
  }

  const participantCount = students.filter((s) => s.participated).length;
  const avgBest =
    scores.length > 0
      ? Math.round(scores.reduce((sum, n) => sum + n, 0) / scores.length)
      : null;
  const topScore = scores.length > 0 ? Math.max(...scores) : null;

  return {
    playing,
    waiting,
    done,
    idle,
    online,
    avgBest,
    topScore,
    participationRate:
      studentCount > 0 ? Math.round((participantCount / studentCount) * 100) : 0,
    participantCount,
    studentCount,
    totalRuns,
  };
}

export function contentKeyFromPlayPath(pathname: string): string | null {
  const match = pathname.match(/^\/play\/([^/?#]+)/);
  if (!match) return null;
  const key = match[1]?.trim();
  return key || null;
}
