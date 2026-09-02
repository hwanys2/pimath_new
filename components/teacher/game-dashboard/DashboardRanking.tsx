import type {
  GameDashboardKind,
  GameDashboardRankRow,
} from "@/lib/game-dashboard-types";
import { formatStudentLabel } from "@/lib/students";

export type DashboardRankingTone = "class" | "school" | "world";

function formatScore(kind: GameDashboardKind, score: number): string {
  if (kind === "pvp") return `${Math.round(score / 100)}승`;
  return `${score.toLocaleString()}점`;
}

function metaLine(row: GameDashboardRankRow): string | null {
  const parts = [row.className, row.schoolName].filter(
    (value): value is string => Boolean(value && value.trim()),
  );
  if (parts.length === 0) return null;
  return parts.join(" · ");
}

function PodiumSlot({
  row,
  place,
  kind,
  showMeta,
  scoreAsPoints,
}: {
  row: GameDashboardRankRow | undefined;
  place: 1 | 2 | 3;
  kind: GameDashboardKind;
  showMeta: boolean;
  scoreAsPoints: boolean;
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

  const meta = showMeta ? metaLine(row) : null;

  return (
    <li className="flex min-w-0 flex-1 flex-col items-center justify-end">
      <article
        className={`mb-3 w-full max-w-[14rem] rounded-2xl px-3 py-2.5 text-center ${card}`}
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
        {meta ? (
          <p className="truncate text-[10px] font-semibold text-foreground/45">
            {meta}
          </p>
        ) : null}
        <p className="font-display mt-0.5 text-lg tabular-nums text-wood">
          {scoreAsPoints
            ? `${row.score.toLocaleString()}점`
            : formatScore(kind, row.score)}
        </p>
        {row.runCount > 0 ? (
          <p className="text-[10px] font-bold text-wood/45">{row.runCount}회</p>
        ) : null}
      </article>
      <div
        className={`w-full rounded-t-2xl bg-gradient-to-b ${pedestal}`}
        aria-hidden
      />
    </li>
  );
}

const TONE_CLASS: Record<DashboardRankingTone, string> = {
  class: "from-gold/20 via-white/80 to-peach/20 ring-gold/30",
  school: "from-mint/25 via-white/80 to-sky/15 ring-mint/35",
  world: "from-lavender/25 via-white/80 to-sky/20 ring-lavender/35",
};

export default function DashboardRanking({
  rows,
  kind,
  title,
  hint,
  tone = "class",
  showMeta = false,
  scoreAsPoints = false,
}: {
  rows: GameDashboardRankRow[];
  kind: GameDashboardKind;
  title: string;
  hint: string;
  tone?: DashboardRankingTone;
  showMeta?: boolean;
  scoreAsPoints?: boolean;
}) {
  const first = rows.find((r) => r.rank === 1);
  const second = rows.find((r) => r.rank === 2);
  const third = rows.find((r) => r.rank === 3);
  const rest = rows.filter((r) => r.rank > 3);

  return (
    <section
      className={`flex h-full min-w-0 flex-col rounded-3xl bg-gradient-to-br p-4 ring-1 sm:p-5 ${TONE_CLASS[tone]}`}
    >
      <div>
        <h2 className="font-display text-lg text-wood sm:text-xl">{title}</h2>
        <p className="text-xs text-foreground/50">{hint}</p>
      </div>

      {rows.length === 0 ? (
        <p className="mt-8 text-center text-sm text-foreground/50">
          아직 기록이 없어요. 학생들이 클리어하면 시상대가 채워져요.
        </p>
      ) : (
        <>
          <ol className="mt-4 flex items-end gap-2">
            <PodiumSlot
              row={second}
              place={2}
              kind={kind}
              showMeta={showMeta}
              scoreAsPoints={scoreAsPoints}
            />
            <PodiumSlot
              row={first}
              place={1}
              kind={kind}
              showMeta={showMeta}
              scoreAsPoints={scoreAsPoints}
            />
            <PodiumSlot
              row={third}
              place={3}
              kind={kind}
              showMeta={showMeta}
              scoreAsPoints={scoreAsPoints}
            />
          </ol>
          {rest.length > 0 ? (
            <ol className="mt-4 space-y-1.5">
              {rest.slice(0, 15).map((row) => {
                const meta = showMeta ? metaLine(row) : null;
                return (
                  <li
                    key={row.studentId}
                    className="flex items-center justify-between gap-2 rounded-xl bg-white/70 px-3 py-1.5"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-wood/10 font-display text-xs text-wood">
                        {row.rank}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">
                          {formatStudentLabel(row.displayName, row.studentNumber)}
                        </span>
                        {meta ? (
                          <span className="block truncate text-[10px] text-foreground/45">
                            {meta}
                          </span>
                        ) : null}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-black tabular-nums text-wood">
                      {scoreAsPoints
                        ? `${row.score.toLocaleString()}점`
                        : formatScore(kind, row.score)}
                    </span>
                  </li>
                );
              })}
            </ol>
          ) : null}
        </>
      )}
    </section>
  );
}
