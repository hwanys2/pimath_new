"use client";

import type { RankingMode, RankingRow } from "@/lib/game-types";

type Props = {
  rows: RankingRow[];
  mode: RankingMode;
  onModeChange: (mode: RankingMode) => void;
  loading?: boolean;
};

export default function ClassGameRanking({
  rows,
  mode,
  onModeChange,
  loading,
}: Props) {
  return (
    <div className="rounded-2xl bg-white/70 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl text-wood">우리 반 랭킹</h2>
        <div
          className="flex rounded-xl bg-wood/10 p-1 text-xs font-bold"
          role="tablist"
          aria-label="랭킹 방식"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === "best"}
            onClick={() => onModeChange("best")}
            className={[
              "rounded-lg px-3 py-1.5 transition",
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
              "rounded-lg px-3 py-1.5 transition",
              mode === "all"
                ? "bg-mint/70 text-wood"
                : "text-foreground/55 hover:text-wood",
            ].join(" ")}
          >
            전체 기록
          </button>
        </div>
      </div>
      <p className="mt-2 text-xs text-foreground/50">
        {mode === "best"
          ? "학생마다 최고점만 보여 줘요."
          : "한 사람이 1·2·3등을 모두 차지할 수 있어요."}
      </p>

      {loading && rows.length === 0 ? (
        <p className="mt-4 text-center text-sm text-foreground/45">불러오는 중…</p>
      ) : rows.length === 0 ? (
        <p className="mt-4 text-center text-sm text-foreground/45">
          아직 기록이 없어요. 첫 순위는 바로 당신!
        </p>
      ) : (
        <ol className="mt-4 space-y-2">
          {rows.map((row) => (
            <li
              key={`${row.studentId}-${row.createdAt}-${row.rank}`}
              className={[
                "flex items-center gap-3 rounded-xl px-3 py-2.5",
                row.isMe ? "bg-mint/35 ring-2 ring-mint/60" : "bg-wood/5",
              ].join(" ")}
            >
              <span
                className={[
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black",
                  row.rank <= 3
                    ? "bg-gold/70 text-wood"
                    : "bg-wood/10 text-wood/70",
                ].join(" ")}
              >
                {row.rank}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-bold text-foreground">
                {row.displayName}
                {row.isMe ? (
                  <span className="ml-1.5 text-[11px] font-semibold text-wood/70">
                    (나)
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
