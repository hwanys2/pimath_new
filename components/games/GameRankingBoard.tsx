"use client";

import type { RankingMode, RankingRow, RankingScope } from "@/lib/game-types";

type Props = {
  rows: RankingRow[];
  scope: RankingScope;
  mode: RankingMode;
  onScopeChange: (scope: RankingScope) => void;
  onModeChange: (mode: RankingMode) => void;
  loading?: boolean;
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

function Podium({ rows }: { rows: RankingRow[] }) {
  const first = rows.find((r) => r.rank === 1);
  const second = rows.find((r) => r.rank === 2);
  const third = rows.find((r) => r.rank === 3);
  if (!first) return null;

  const Slot = ({
    row,
    place,
    height,
  }: {
    row: RankingRow | undefined;
    place: 1 | 2 | 3;
    height: string;
  }) => {
    if (!row) {
      return <div className={`flex flex-1 flex-col items-center ${height}`} />;
    }
    const medal =
      place === 1 ? "bg-gold/80" : place === 2 ? "bg-wood/20" : "bg-[#c4785a]/35";
    const bar =
      place === 1
        ? "from-gold/70 to-gold/30"
        : place === 2
          ? "from-wood/25 to-wood/10"
          : "from-[#c4785a]/40 to-[#c4785a]/15";

    return (
      <div className={`flex flex-1 flex-col items-center justify-end ${height}`}>
        <div
          className={[
            "mb-2 flex w-full max-w-[7.5rem] flex-col items-center rounded-2xl px-2 py-2",
            row.isMe ? "ring-2 ring-mint/70 bg-mint/20" : "bg-white/60",
          ].join(" ")}
        >
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-black text-wood ${medal}`}
          >
            {place}
          </span>
          <p className="mt-1 w-full truncate text-center text-xs font-bold text-foreground">
            {row.displayName}
          </p>
          {row.className ? (
            <p className="w-full truncate text-center text-[10px] text-foreground/45">
              {row.className}
            </p>
          ) : null}
          <p className="mt-0.5 text-sm font-black tabular-nums text-wood">
            {row.score}
          </p>
        </div>
        <div
          className={`w-full rounded-t-xl bg-gradient-to-b ${bar} ${
            place === 1 ? "h-16" : place === 2 ? "h-11" : "h-8"
          }`}
          aria-hidden
        />
      </div>
    );
  };

  return (
    <div className="mt-5 flex items-end gap-2 px-1 sm:gap-3">
      <Slot row={second} place={2} height="min-h-[9rem]" />
      <Slot row={first} place={1} height="min-h-[11rem]" />
      <Slot row={third} place={3} height="min-h-[8rem]" />
    </div>
  );
}

export default function GameRankingBoard({
  rows,
  scope,
  mode,
  onScopeChange,
  onModeChange,
  loading,
}: Props) {
  const rest = rows.filter((r) => r.rank > 3);
  const showClassName = scope === "world" || scope === "school";

  return (
    <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-white/90 via-mint/10 to-sky/15 p-4 shadow-sm ring-1 ring-wood/10 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-display text-xl text-wood sm:text-2xl">랭킹</h2>
          <p className="mt-0.5 text-xs text-foreground/50">
            {SCOPES.find((s) => s.id === scope)?.hint}
          </p>
        </div>
        <div
          className="flex rounded-xl bg-wood/10 p-1 text-[11px] font-bold sm:text-xs"
          role="tablist"
          aria-label="집계 방식"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === "best"}
            onClick={() => onModeChange("best")}
            className={[
              "rounded-lg px-2.5 py-1.5 transition sm:px-3",
              mode === "best"
                ? "bg-mint/70 text-wood"
                : "text-foreground/55 hover:text-wood",
            ].join(" ")}
          >
            개인 최고
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "all"}
            onClick={() => onModeChange("all")}
            className={[
              "rounded-lg px-2.5 py-1.5 transition sm:px-3",
              mode === "all"
                ? "bg-mint/70 text-wood"
                : "text-foreground/55 hover:text-wood",
            ].join(" ")}
          >
            전체 기록
          </button>
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
              <span
                className={[
                  "mt-0.5 text-[10px] font-semibold",
                  active ? "text-cream/70" : "text-foreground/40",
                ].join(" ")}
              >
                {s.hint}
              </span>
            </button>
          );
        })}
      </div>

      {loading && rows.length === 0 ? (
        <p className="mt-8 text-center text-sm text-foreground/45">불러오는 중…</p>
      ) : rows.length === 0 ? (
        <p className="mt-8 text-center text-sm text-foreground/45">
          아직 기록이 없어요. 첫 순위는 바로 당신!
        </p>
      ) : (
        <>
          <Podium rows={rows} />

          {rest.length > 0 ? (
            <ol className="mt-4 space-y-2">
              {rest.map((row) => (
                <li
                  key={`${row.studentId}-${row.createdAt}-${row.rank}`}
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
          ) : null}
        </>
      )}
    </div>
  );
}
