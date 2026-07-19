"use client";

import { useState, useTransition } from "react";
import type { RankingScope, XpRankingRow } from "@/lib/game-types";
import { fetchXpRankingAction } from "@/app/adventure/actions";

type Props = {
  initialRows: XpRankingRow[];
  initialScope?: RankingScope;
};

const SCOPES: { id: RankingScope; label: string }[] = [
  { id: "world", label: "월드" },
  { id: "school", label: "학교" },
  { id: "class", label: "학급" },
];

export default function AdventureXpRanking({
  initialRows,
  initialScope = "class",
}: Props) {
  const [scope, setScope] = useState<RankingScope>(initialScope);
  const [rows, setRows] = useState(initialRows);
  const [isPending, startTransition] = useTransition();

  const changeScope = (next: RankingScope) => {
    if (next === scope) return;
    setScope(next);
    startTransition(async () => {
      const nextRows = await fetchXpRankingAction(next);
      setRows(nextRows);
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col rounded-2xl bg-gradient-to-b from-wood/10 via-white/80 to-mint/20 p-3 ring-1 ring-wood/10 sm:p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-display text-lg text-wood">포인트 랭킹</h3>
        <span className="text-[10px] font-semibold text-foreground/40">
          누적 XP
        </span>
      </div>

      <div
        className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-wood/10 p-1"
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
              onClick={() => changeScope(s.id)}
              className={[
                "rounded-lg py-1.5 text-xs font-black transition",
                active
                  ? "bg-wood text-cream shadow-sm"
                  : "text-wood/70 hover:bg-white/60",
              ].join(" ")}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      <div className="relative mt-3 min-h-0 flex-1 overflow-y-auto">
        {isPending ? (
          <p className="py-6 text-center text-xs text-foreground/40">
            불러오는 중…
          </p>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-xs text-foreground/40">
            아직 순위가 없어요
          </p>
        ) : (
          <ol className="space-y-1.5">
            {rows.map((row) => (
              <li
                key={`${row.studentId}-${row.rank}`}
                className={[
                  "flex items-center gap-2 rounded-xl px-2 py-1.5",
                  row.isMe
                    ? "bg-mint/40 ring-1 ring-mint/70"
                    : "bg-white/60",
                ].join(" ")}
              >
                <span
                  className={[
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black",
                    row.rank <= 3
                      ? "bg-gold/70 text-wood"
                      : "bg-wood/10 text-wood/60",
                  ].join(" ")}
                >
                  {row.rank}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-bold text-foreground">
                    {row.displayName}
                    {row.isMe ? (
                      <span className="ml-1 text-[10px] text-wood/60">(나)</span>
                    ) : null}
                  </span>
                  <span className="block truncate text-[10px] text-foreground/45">
                    Lv.{row.level}
                    {scope !== "class" && row.className
                      ? ` · ${row.className}`
                      : ""}
                  </span>
                </span>
                <span className="shrink-0 text-[11px] font-black tabular-nums text-wood">
                  {row.totalXp.toLocaleString()}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
