/** Shared types for the teacher game dashboard (client + server safe). */

import type { ActivityDetailsV1 } from "@/lib/activity-result-schemas";

export type GameDashboardKind = "solo" | "pvp" | "session";

export type GameDashboardStatus = "playing" | "waiting" | "done" | "idle";

export type GamePresencePhase = "lobby" | "waiting" | "playing" | "ended";

export type GameDashboardStudent = {
  studentId: string;
  displayName: string;
  loginId: string;
  studentNumber: number | null;
  status: GameDashboardStatus;
  online: boolean;
  presencePhase: GamePresencePhase | null;
  liveScore: number | null;
  lastSeenAt: string | null;
  opponentName: string | null;
  participated: boolean;
  runCount: number;
  bestScore: number | null;
  latestScore: number | null;
  lastPlayedAt: string | null;
  latestDetails: ActivityDetailsV1 | null;
};

export type GameDashboardRankRow = {
  rank: number;
  studentId: string;
  displayName: string;
  studentNumber: number | null;
  score: number;
  runCount: number;
};

export type GameDashboardRun = {
  id: string;
  studentId: string;
  displayName: string;
  studentNumber: number | null;
  score: number | null;
  label: string;
  createdAt: string;
};

export type GameDashboardLiveMatch = {
  gameId: string;
  blackName: string;
  whiteName: string;
  blackStudentId: string | null;
  whiteStudentId: string | null;
  turn: string | null;
  moveCount: number;
  gamePhase: string | null;
  scope: string;
  updatedAt: string;
};

export type GameDashboardLiveSession = {
  sessionId: string;
  phase: string;
  roundNumber: number;
  updatedAt: string;
  players: {
    studentId: string;
    displayName: string;
    score: number;
    extra: Record<string, unknown>;
  }[];
};

export type GameDashboardKpis = {
  playing: number;
  waiting: number;
  done: number;
  idle: number;
  online: number;
  avgBest: number | null;
  topScore: number | null;
  participationRate: number;
  participantCount: number;
  studentCount: number;
  totalRuns: number;
};

export type GameDashboardSnapshot = {
  fetchedAt: string;
  classId: string;
  className: string;
  contentKey: string;
  contentTitle: string;
  contentHref: string;
  kind: GameDashboardKind;
  isActive: boolean;
  unitLabel: string | null;
  students: GameDashboardStudent[];
  ranking: GameDashboardRankRow[];
  recentRuns: GameDashboardRun[];
  liveMatches: GameDashboardLiveMatch[];
  liveSession: GameDashboardLiveSession | null;
  kpis: GameDashboardKpis;
};

export const GAME_PRESENCE_PING_MS = 10000;
/** Legacy fixed poll interval — dashboard now uses hybrid Realtime sync. */
export const GAME_DASHBOARD_POLL_MS = 3000;
export const GAME_PRESENCE_ONLINE_MS = 20000;

export function teacherGameDashboardHref(
  classId: string,
  contentKey: string,
): string {
  return `/teacher/classes/${classId}/games/${contentKey}`;
}
