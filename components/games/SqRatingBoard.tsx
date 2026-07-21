"use client";

import type { RankingRow, RankingScope } from "@/lib/game-types";

type Props = {
  rows: RankingRow[];
  scope: RankingScope;
  onScopeChange: (scope: RankingScope) => void;
  loading?: boolean;
  myTotal?: number | null;
};

const SCOPES: {
  id: RankingScope;
  label: string;
  hint: string;
  icon: string;
}[] = [
  { id: "world", label: "월드", hint: "모든 학생", icon: "✦" },
  { id: "school", label: "학교", hint: "같은 선생님", icon: "⌂" },
  { id: "class", label: "학급", hint: "우리 반", icon: "★" },
];

export default function SqRatingBoard({
  rows,
  scope,
  onScopeChange,
  loading,
  myTotal,
}: Props) {
  const showClassName = scope === "world" || scope === "school";
  const top = rows.filter((r) => r.rank <= 3);
  const rest = rows.filter((r) => r.rank > 3);

  return (
    <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-white/90 via-peach/15 to-gold/10 p-4 shadow-sm ring-1 ring-wood/10 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-display text-xl text-wood sm:text-2xl">
            정사각형 만들기 누적 랭킹
          </h2>
          <p className="mt-0.5 text-xs text-foreground/50">
            누적 점수 · {SCOPES.find((s) => s.id === scope)?.hint}
          </p>
          {myTotal != null ? (
            <p className="mt-1 text-sm font-black tabular-nums text-wood">
              내 누적 {myTotal}점
            </p>
          ) : null}
        </div>
      </div>

      <div
        className="mt-4 grid grid-cols-3 gap-2"
        role="tablist"
        aria-label="랭킹 범위"
      >
        {SCOPES.map((s) => {
          const active = scope === s.id;
          return (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onScopeChange(s.id)}
              className={[
                "rounded-xl px-2 py-2 text-center text-xs font-bold transition sm:text-sm",
                active
                  ? "bg-peach/80 text-wood ring-2 ring-wood/20"
                  : "bg-white/60 text-wood/60 hover:bg-white/80",
              ].join(" ")}
            >
              <span className="mr-1">{s.icon}</span>
              {s.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <p className="mt-4 text-center text-sm text-wood/50">불러오는 중…</p>
      ) : rows.length === 0 ? (
        <p className="mt-4 text-center text-sm text-wood/50">
          아직 랭킹 기록이 없어요.
        </p>
      ) : (
        <ol className="mt-4 space-y-2">
          {top.map((row) => (
            <li
              key={row.studentId}
              className={[
                "flex items-center gap-3 rounded-2xl px-3 py-2.5",
                row.isMe ? "bg-peach/40 ring-1 ring-peach/60" : "bg-white/50",
              ].join(" ")}
            >
              <span className="w-6 text-center font-display text-lg text-wood">
                {row.rank === 1 ? "🥇" : row.rank === 2 ? "🥈" : "🥉"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-wood">{row.displayName}</p>
                {showClassName && row.className ? (
                  <p className="truncate text-xs text-wood/50">{row.className}</p>
                ) : null}
              </div>
              <span className="font-black tabular-nums text-wood">
                {row.score}
              </span>
            </li>
          ))}
          {rest.map((row) => (
            <li
              key={row.studentId}
              className={[
                "flex items-center gap-3 rounded-xl px-3 py-2",
                row.isMe ? "bg-peach/30" : "",
              ].join(" ")}
            >
              <span className="w-6 text-center text-sm font-bold text-wood/50">
                {row.rank}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-wood">
                  {row.displayName}
                </p>
                {showClassName && row.className ? (
                  <p className="truncate text-xs text-wood/45">
                    {row.className}
                  </p>
                ) : null}
              </div>
              <span className="text-sm font-black tabular-nums text-wood">
                {row.score}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
