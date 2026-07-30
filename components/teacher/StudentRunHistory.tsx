import {
  fetchStudentActivitySessions,
  fetchStudentGameRuns,
} from "@/lib/activity-results";
import { fetchStudentPvpGames } from "@/lib/activity-results-pvp";
import { fetchStudentSessionRows } from "@/lib/activity-results-sessions";
import {
  isPvpContent,
  isSessionGameContent,
} from "@/lib/activity-result-schemas";
import { ContentResultDetail } from "@/components/teacher/ContentResultDetail";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ko-KR", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default async function StudentRunHistory({
  classId,
  contentKey,
  contentType,
  studentId,
  displayName,
}: {
  classId: string;
  contentKey: string;
  contentType: "game" | "simulation";
  studentId: string;
  displayName: string;
}) {
  if (isPvpContent(contentKey)) {
    const games = await fetchStudentPvpGames(classId, contentKey, studentId);
    if (games.length === 0) return null;

    return (
      <details className="rounded-2xl bg-wood/5 px-4 py-3">
        <summary className="cursor-pointer font-semibold text-foreground">
          {displayName} · PvP {games.length}판
        </summary>
        <ul className="mt-2 space-y-1 text-xs text-foreground/70">
          {games.slice(0, 10).map((g) => (
            <li key={g.gameId}>
              {formatDate(g.playedAt)} — vs {g.opponentName} ·{" "}
              {g.result === "win" ? "승" : g.result === "loss" ? "패" : "무"}
            </li>
          ))}
        </ul>
      </details>
    );
  }

  if (isSessionGameContent(contentKey)) {
    const rows = await fetchStudentSessionRows(classId, contentKey, studentId);
    if (rows.length === 0) return null;

    return (
      <details className="rounded-2xl bg-wood/5 px-4 py-3">
        <summary className="cursor-pointer font-semibold text-foreground">
          {displayName} · 세션 {rows.length}회
        </summary>
        <ul className="mt-2 space-y-1 text-xs text-foreground/70">
          {rows.slice(0, 10).map((r, i) => (
            <li key={`${r.sessionId}-${i}`}>
              {formatDate(r.playedAt)} — {r.sessionScore}점 (라운드{" "}
              {r.roundScore})
            </li>
          ))}
        </ul>
      </details>
    );
  }

  if (contentType === "simulation") {
    const sessions = await fetchStudentActivitySessions(
      classId,
      contentKey,
      studentId,
    );
    if (sessions.length === 0) return null;

    return (
      <details className="rounded-2xl bg-wood/5 px-4 py-3">
        <summary className="cursor-pointer font-semibold text-foreground">
          {displayName} · {sessions.length}회
        </summary>
        <ul className="mt-2 space-y-2">
          {sessions.slice(0, 5).map((s) => (
            <li key={s.id} className="text-xs text-foreground/70">
              <p>
                {formatDate(s.createdAt)} —{" "}
                {s.status === "completed" ? "완료" : "시작"}
                {s.durationSec ? ` · ${s.durationSec}초` : ""}
              </p>
              <ContentResultDetail contentKey={contentKey} details={s.details} />
            </li>
          ))}
        </ul>
      </details>
    );
  }

  const runs = await fetchStudentGameRuns(classId, contentKey, studentId);
  if (runs.length === 0) return null;

  return (
    <details className="rounded-2xl bg-wood/5 px-4 py-3">
      <summary className="cursor-pointer font-semibold text-foreground">
        {displayName} · {runs.length}판
      </summary>
      <ul className="mt-2 space-y-2">
        {runs.slice(0, 5).map((run) => (
          <li key={run.id} className="text-xs text-foreground/70">
            <p>
              {formatDate(run.createdAt)} — {run.score}점
            </p>
            <ContentResultDetail contentKey={contentKey} details={run.details} />
          </li>
        ))}
      </ul>
    </details>
  );
}
