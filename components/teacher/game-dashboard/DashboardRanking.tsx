import type {
  GameDashboardKind,
  GameDashboardRankRow,
} from "@/lib/game-dashboard-types";
import { formatStudentLabel } from "@/lib/students";

function formatScore(kind: GameDashboardKind, score: number): string {
  if (kind === "pvp") return `${Math.round(score / 100)}승`;
  return `${score.toLocaleString()}점`;
}

function PodiumSlot({
  row,
  place,
  kind,
}: {
  row: GameDashboardRankRow | undefined;
  place: 1 | 2 | 3;
  kind: GameDashboardKind;
}) {
  const pedestal =
    place === 1
      ? "h-24 from-gold via-gold/70 to-gold/25 shadow-[0_-6px_24px_rgba(212,160,23,0.35)]"
      : place === 2
        ? "h-16 from-wood-light/70 via-wood/20 to-wood/10"
        : "h-12 from-[#c4785a]/55 via-[#c4785a]/25 to-[#c4785a]/10";
  const medal =
    place === 1
      ? "h-11 w-11 bg-gold text-xl text-wood-dark ring-4 ring-gold/40"
      : place === 2
        ? "h-9 w-9 bg-white text-lg text-wood ring-2 ring-wood/15"
        : "h-9 w-9 bg-[#c4785a]/30 text-lg text-wood-dark ring-2 ring-[#c4785a]/25";
  const card =
    place === 1
      ? "bg-gradient-to-b from-gold/40 to-white ring-2 ring-gold/60"
      : "bg-white/80 ring-1 ring-wood/10";

  if (!row) {
    return <li className="min-w-0 flex-1" aria-hidden />;
  }

  return (
    <li className="flex min-w-0 flex-1 flex-col items-center justify-end">
      <article
        className={`mb-3 w-full max-w-[10.5rem] rounded-2xl px-2.5 py-2.5 text-center ${card}`}
      >
        <span
          className={`mx-auto flex items-center justify-center rounded-full font-black ${medal}`}
        >
          {place === 1 ? "★" : place}
        </span>
        <p className="mt-1 text-[10px] font-black tracking-widest text-wood/70">
          {place}등
        </p>
        <h3 className="font-display mt-0.5 truncate text-base text-foreground sm:text-lg">
          {formatStudentLabel(row.displayName, row.studentNumber)}
        </h3>
        <p className="font-display mt-0.5 text-lg tabular-nums text-wood">
          {formatScore(kind, row.score)}
        </p>
        <p className="text-[10px] font-bold text-wood/45">{row.runCount}회</p>
      </article>
      <div
        className={`w-full rounded-t-2xl bg-gradient-to-b ${pedestal}`}
        aria-hidden
      />
    </li>
  );
}

export default function DashboardRanking({
  rows,
  kind,
}: {
  rows: GameDashboardRankRow[];
  kind: GameDashboardKind;
}) {
  const first = rows.find((r) => r.rank === 1);
  const second = rows.find((r) => r.rank === 2);
  const third = rows.find((r) => r.rank === 3);
  const rest = rows.filter((r) => r.rank > 3);

  return (
    <section className="flex h-full flex-col rounded-3xl bg-gradient-to-br from-gold/20 via-white/80 to-peach/20 p-4 ring-1 ring-gold/30 sm:p-5">
      <div>
        <h2 className="font-display text-lg text-wood sm:text-xl">학급 랭킹</h2>
        <p className="text-xs text-foreground/50">
          {kind === "pvp" ? "개인 승수" : "개인 최고 점수"}
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="mt-8 text-center text-sm text-foreground/50">
          아직 기록이 없어요. 학생들이 클리어하면 시상대가 채워져요.
        </p>
      ) : (
        <>
          <ol className="mt-4 flex items-end gap-2">
            <PodiumSlot row={second} place={2} kind={kind} />
            <PodiumSlot row={first} place={1} kind={kind} />
            <PodiumSlot row={third} place={3} kind={kind} />
          </ol>
          {rest.length > 0 ? (
            <ol className="mt-4 space-y-1.5">
              {rest.slice(0, 12).map((row) => (
                <li
                  key={row.studentId}
                  className="flex items-center justify-between rounded-xl bg-white/70 px-3 py-1.5"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-wood/10 font-display text-xs text-wood">
                      {row.rank}
                    </span>
                    <span className="truncate text-sm font-semibold">
                      {formatStudentLabel(row.displayName, row.studentNumber)}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-black tabular-nums text-wood">
                    {formatScore(kind, row.score)}
                  </span>
                </li>
              ))}
            </ol>
          ) : null}
        </>
      )}
    </section>
  );
}
