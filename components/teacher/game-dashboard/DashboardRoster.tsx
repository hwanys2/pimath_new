"use client";

import { useMemo, useState } from "react";
import type {
  GameDashboardKind,
  GameDashboardStatus,
  GameDashboardStudent,
} from "@/lib/game-dashboard-types";
import { formatStudentLabel } from "@/lib/students";

type Filter = "all" | GameDashboardStatus;

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "playing", label: "플레이 중" },
  { id: "waiting", label: "대기" },
  { id: "done", label: "완료" },
  { id: "idle", label: "미참여" },
];

function statusMeta(status: GameDashboardStatus): {
  label: string;
  glow: string;
  chip: string;
  dot: string;
} {
  switch (status) {
    case "playing":
      return {
        label: "플레이 중",
        glow: "ring-2 ring-mint/80 bg-gradient-to-br from-mint/35 via-white to-sky/20 shadow-[0_0_24px_rgba(157,232,200,0.45)]",
        chip: "bg-mint/80 text-wood",
        dot: "bg-mint shadow-[0_0_8px_rgba(90,200,160,0.9)]",
      };
    case "waiting":
      return {
        label: "대기",
        glow: "ring-2 ring-gold/70 bg-gradient-to-br from-gold/30 via-white to-peach/20",
        chip: "bg-gold/80 text-wood",
        dot: "bg-gold",
      };
    case "done":
      return {
        label: "완료",
        glow: "ring-1 ring-wood/15 bg-white/80",
        chip: "bg-wood/15 text-wood",
        dot: "bg-wood/40",
      };
    default:
      return {
        label: "미참여",
        glow: "ring-1 ring-dashed ring-wood/20 bg-wood/[0.04]",
        chip: "bg-wood/10 text-foreground/45",
        dot: "bg-wood/20",
      };
  }
}

function initials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  return trimmed.slice(0, 1);
}

function scoreText(
  student: GameDashboardStudent,
  kind: GameDashboardKind,
): string {
  if (student.status === "playing" && student.liveScore != null) {
    return kind === "pvp" ? `대전 중` : `${student.liveScore}`;
  }
  if (kind === "pvp") {
    const wins = student.latestDetails?.summary.wins;
    if (typeof wins === "number") return `${wins}승`;
    return student.participated ? `${student.runCount}판` : "—";
  }
  if (student.bestScore != null) return String(student.bestScore);
  return "—";
}

export default function DashboardRoster({
  students,
  kind,
}: {
  students: GameDashboardStudent[];
  kind: GameDashboardKind;
}) {
  const [filter, setFilter] = useState<Filter>("all");

  const counts = useMemo(() => {
    const map: Record<Filter, number> = {
      all: students.length,
      playing: 0,
      waiting: 0,
      done: 0,
      idle: 0,
    };
    for (const s of students) map[s.status] += 1;
    return map;
  }, [students]);

  const visible = useMemo(() => {
    const rows =
      filter === "all" ? students : students.filter((s) => s.status === filter);
    return [...rows].sort((a, b) => {
      const order = { playing: 0, waiting: 1, done: 2, idle: 3 };
      const byStatus = order[a.status] - order[b.status];
      if (byStatus !== 0) return byStatus;
      const byNumber =
        (a.studentNumber ?? 9999) - (b.studentNumber ?? 9999);
      if (byNumber !== 0) return byNumber;
      return a.displayName.localeCompare(b.displayName, "ko");
    });
  }, [students, filter]);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-display text-lg text-wood sm:text-xl">실시간 현황</h2>
          <p className="text-xs text-foreground/50">
            지금 이 게임에 들어와 있는 학생이에요.
          </p>
        </div>
        <div
          className="flex flex-wrap gap-1 rounded-xl bg-wood/10 p-1"
          role="tablist"
          aria-label="학생 상태 필터"
        >
          {FILTERS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={filter === tab.id}
              onClick={() => setFilter(tab.id)}
              className={[
                "rounded-lg px-2 py-1 text-[11px] font-bold transition sm:px-2.5",
                filter === tab.id
                  ? "bg-wood text-cream"
                  : "text-foreground/55 hover:text-wood",
              ].join(" ")}
            >
              {tab.label}
              <span className="ml-1 tabular-nums opacity-70">
                {counts[tab.id]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-2xl bg-wood/5 px-4 py-8 text-center text-sm text-foreground/50">
          이 상태의 학생이 없어요.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
          {visible.map((student) => {
            const meta = statusMeta(student.status);
            return (
              <li key={student.studentId}>
                <article
                  className={`flex items-center gap-2.5 rounded-2xl px-3 py-2.5 ${meta.glow}`}
                >
                  <span className="relative shrink-0">
                    <span
                      className={[
                        "flex h-10 w-10 items-center justify-center rounded-full font-display text-lg text-wood",
                        student.status === "playing"
                          ? "bg-mint/80"
                          : student.status === "waiting"
                            ? "bg-gold/80"
                            : student.status === "done"
                              ? "bg-sky/60"
                              : "bg-wood/15 text-foreground/40",
                      ].join(" ")}
                    >
                      {initials(student.displayName)}
                    </span>
                    <span
                      className={`absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-cream ${meta.dot} ${
                        student.status === "playing" ? "animate-pulse" : ""
                      }`}
                      aria-hidden
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-sm text-foreground">
                      {formatStudentLabel(
                        student.displayName,
                        student.studentNumber,
                      )}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1">
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${meta.chip}`}
                      >
                        {student.opponentName
                          ? `vs ${student.opponentName}`
                          : meta.label}
                      </span>
                      <span className="text-[11px] font-black tabular-nums text-wood">
                        {scoreText(student, kind)}
                      </span>
                    </div>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
