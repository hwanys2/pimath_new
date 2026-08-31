import type {
  GameDashboardKind,
  GameDashboardLiveMatch,
  GameDashboardLiveSession,
} from "@/lib/game-dashboard-types";

function scopeLabel(scope: string): string {
  if (scope === "class") return "같은 반";
  if (scope === "global") return "전체";
  return scope;
}

function sessionPhaseLabel(phase: string): string {
  switch (phase) {
    case "lobby":
      return "로비";
    case "picking":
      return "고르는 중";
    case "rolling":
      return "주사위";
    case "round_end":
      return "라운드 종료";
    case "playing":
      return "진행 중";
    case "revealed":
      return "정답 공개";
    default:
      return phase;
  }
}

export default function DashboardLiveExtras({
  kind,
  matches,
  session,
}: {
  kind: GameDashboardKind;
  matches: GameDashboardLiveMatch[];
  session: GameDashboardLiveSession | null;
}) {
  if (kind === "pvp") {
    return (
      <section className="rounded-3xl bg-gradient-to-r from-lavender/25 via-white/80 to-sky/20 p-4 ring-1 ring-lavender/40 sm:p-5">
        <div className="flex items-end justify-between gap-2">
          <div>
            <h2 className="font-display text-lg text-wood">진행 중인 대전</h2>
            <p className="text-xs text-foreground/50">
              지금 보드 위에서 맞붙고 있는 판이에요.
            </p>
          </div>
          <span className="rounded-full bg-lavender/50 px-2.5 py-0.5 text-[11px] font-bold text-wood">
            {matches.length}판
          </span>
        </div>
        {matches.length === 0 ? (
          <p className="mt-4 text-sm text-foreground/50">
            진행 중인 대전이 없어요. 대기열에 들어가면 여기에 떠요.
          </p>
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {matches.map((match) => (
              <li
                key={match.gameId}
                className="rounded-2xl bg-white/85 px-4 py-3 ring-1 ring-wood/10"
              >
                <p className="flex items-center justify-center gap-2 font-display text-base text-foreground">
                  <span className="truncate">{match.blackName}</span>
                  <span className="text-xs font-black text-wood/50">VS</span>
                  <span className="truncate">{match.whiteName}</span>
                </p>
                <p className="mt-1 text-center text-[11px] font-semibold text-foreground/55">
                  {scopeLabel(match.scope)}
                  {match.gamePhase && match.gamePhase !== "playing"
                    ? ` · ${match.gamePhase === "rps" ? "가위바위보" : match.gamePhase}`
                    : ""}
                  {match.turn
                    ? ` · ${match.turn === "black" ? match.blackName : match.whiteName} 차례`
                    : ""}
                  {match.moveCount > 0 ? ` · ${match.moveCount}수` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  if (kind === "session" && session) {
    return (
      <section className="rounded-3xl bg-gradient-to-r from-peach/25 via-white/80 to-gold/20 p-4 ring-1 ring-peach/40 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-display text-lg text-wood">현재 수업 세션</h2>
            <p className="text-xs text-foreground/50">
              교사가 진행 중인 판의 실시간 점수예요.
            </p>
          </div>
          <span className="rounded-full bg-peach/60 px-2.5 py-0.5 text-[11px] font-bold text-wood">
            {sessionPhaseLabel(session.phase)} · {session.roundNumber}라운드
          </span>
        </div>
        {session.players.length === 0 ? (
          <p className="mt-4 text-sm text-foreground/50">
            세션에 들어온 학생이 아직 없어요.
          </p>
        ) : (
          <ol className="mt-3 grid gap-1.5 sm:grid-cols-2">
            {session.players.map((player, index) => (
              <li
                key={player.studentId}
                className="flex items-center justify-between rounded-xl bg-white/80 px-3 py-2"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold/70 font-display text-xs text-wood">
                    {index + 1}
                  </span>
                  <span className="truncate text-sm font-semibold">
                    {player.displayName}
                  </span>
                </span>
                <span className="font-display text-base tabular-nums text-wood">
                  {player.score}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    );
  }

  return null;
}
