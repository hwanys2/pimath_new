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

export default function OmokRatingBoard({
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
    <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-white/90 via-mint/10 to-sky/15 p-4 shadow-sm ring-1 ring-wood/10 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-display text-xl text-wood sm:text-2xl">
            오목 누적 랭킹
          </h2>
          <p className="mt-0.5 text-xs text-foreground/50">
            순서쌍 오목 누적 점수 · {SCOPES.find((s) => s.id === scope)?.hint}
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
                "flex flex-col items-center rounded-2xl px-2 py-3 transition",
                active
                  ? "bg-wood text-cream shadow-md"
                  : "bg-white/70 text-wood hover:bg-mint/30",
              ].join(" ")}
            >
              <span className="text-lg leading-none" aria-hidden>
                {s.icon}
              </span>
              <span className="mt-1 text-sm font-black">{s.label}</span>
            </button>
          );
        })}
      </div>

      {loading && rows.length === 0 ? (
        <p className="mt-8 text-center text-sm text-foreground/45">불러오는 중…</p>
      ) : rows.length === 0 ? (
        <p className="mt-8 text-center text-sm text-foreground/45">
          아직 누적 기록이 없어요.
        </p>
      ) : (
        <ol className="mt-4 space-y-2">
          {[...top, ...rest].map((row) => (
            <li
              key={`${row.studentId}-${row.rank}`}
              className={[
                "flex items-center gap-3 rounded-xl px-3 py-2.5",
                row.isMe ? "bg-mint/35 ring-2 ring-mint/60" : "bg-white/55",
              ].join(" ")}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-wood/10 text-sm font-black text-wood/70">
                {row.rank}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-foreground">
                  {row.displayName}
                  {row.isMe ? (
                    <span className="ml-1.5 text-[11px] font-semibold text-wood/70">
                      (나)
                    </span>
                  ) : null}
                </span>
                {showClassName && row.className ? (
                  <span className="block truncate text-[11px] text-foreground/45">
                    {row.className}
                  </span>
                ) : null}
              </span>
              <span className="shrink-0 text-sm font-black tabular-nums text-wood">
                {row.score}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
