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

export default function AlkagiRatingBoard({
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
            기울기 알까기 누적 랭킹
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
              className={`flex items-center justify-center gap-1.5 rounded-2xl py-2 text-xs font-bold transition-all sm:text-sm ${
                active
                  ? "bg-wood text-white shadow-sm ring-2 ring-wood/30"
                  : "bg-white/80 text-wood/70 hover:bg-white hover:text-wood"
              }`}
            >
              <span>{s.icon}</span>
              <span>{s.label}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <p className="py-8 text-center text-xs text-foreground/50">
          랭킹 불러오는 중...
        </p>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-xs text-foreground/50">
          아직 기록이 없어요. 첫 대결을 시작해 보세요!
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          {top.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-3">
              {top.map((r) => (
                <div
                  key={r.studentId}
                  className={`flex items-center gap-3 rounded-2xl p-3 ring-1 transition-all ${
                    r.isMe
                      ? "bg-amber-100/90 ring-amber-400"
                      : "bg-white/80 ring-wood/10"
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm font-black ${
                      r.rank === 1
                        ? "bg-gold text-wood"
                        : r.rank === 2
                          ? "bg-slate-300 text-slate-800"
                          : "bg-amber-700/20 text-amber-900"
                    }`}
                  >
                    {r.rank}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-wood">
                      {r.displayName}
                      {r.isMe && (
                        <span className="ml-1 text-[10px] text-amber-700">
                          (나)
                        </span>
                      )}
                    </p>
                    {showClassName && r.className && (
                      <p className="truncate text-[11px] text-foreground/50">
                        {r.className}
                      </p>
                    )}
                  </div>
                  <span className="font-mono text-sm font-black tabular-nums text-wood">
                    {r.score}점
                  </span>
                </div>
              ))}
            </div>
          )}

          {rest.length > 0 && (
            <div className="divide-y divide-wood/5 rounded-2xl bg-white/60 ring-1 ring-wood/10">
              {rest.map((r) => (
                <div
                  key={r.studentId}
                  className={`flex items-center gap-3 px-4 py-2.5 text-xs transition-colors ${
                    r.isMe ? "bg-amber-50 font-bold" : ""
                  }`}
                >
                  <span className="w-6 font-mono font-bold text-wood/50">
                    {r.rank}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-wood">
                    {r.displayName}
                    {r.isMe && (
                      <span className="ml-1 text-[10px] text-amber-700">
                        (나)
                      </span>
                    )}
                  </span>
                  {showClassName && r.className && (
                    <span className="max-w-[100px] truncate text-foreground/50 sm:max-w-[160px]">
                      {r.className}
                    </span>
                  )}
                  <span className="font-mono font-black tabular-nums text-wood">
                    {r.score}점
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
