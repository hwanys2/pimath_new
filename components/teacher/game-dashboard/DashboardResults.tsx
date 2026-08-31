"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  summaryLabel,
  type ActivityDetailsV1,
} from "@/lib/activity-result-schemas";
import type {
  GameDashboardKind,
  GameDashboardRun,
  GameDashboardStudent,
} from "@/lib/game-dashboard-types";
import { formatStudentLabel } from "@/lib/students";

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ko-KR", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function SummaryChips({
  contentKey,
  details,
}: {
  contentKey: string;
  details: ActivityDetailsV1 | null;
}) {
  if (!details?.summary) return null;
  const entries = Object.entries(details.summary).slice(0, 4);
  if (entries.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {entries.map(([key, value]) => (
        <span
          key={key}
          className="rounded-full bg-wood/10 px-2 py-0.5 text-[10px] font-semibold text-foreground/70"
        >
          {summaryLabel(contentKey, key)} {String(value)}
        </span>
      ))}
    </div>
  );
}

function scoreCell(
  student: GameDashboardStudent,
  kind: GameDashboardKind,
): string {
  if (kind === "pvp") {
    const wins = student.latestDetails?.summary.wins;
    const losses = student.latestDetails?.summary.losses;
    if (typeof wins === "number") {
      return `${wins}승 ${typeof losses === "number" ? `${losses}패` : ""}`.trim();
    }
    return student.participated ? `${student.runCount}판` : "—";
  }
  if (student.bestScore == null) return "—";
  return `${student.bestScore.toLocaleString()}점`;
}

export default function DashboardResults({
  classId,
  contentKey,
  kind,
  students,
  recentRuns,
}: {
  classId: string;
  contentKey: string;
  kind: GameDashboardKind;
  students: GameDashboardStudent[];
  recentRuns: GameDashboardRun[];
}) {
  const [sort, setSort] = useState<"number" | "score">("score");

  const rows = useMemo(() => {
    return [...students].sort((a, b) => {
      if (sort === "score") {
        const sa = a.bestScore ?? -1;
        const sb = b.bestScore ?? -1;
        if (sb !== sa) return sb - sa;
      }
      const byNumber = (a.studentNumber ?? 9999) - (b.studentNumber ?? 9999);
      if (byNumber !== 0) return byNumber;
      return a.displayName.localeCompare(b.displayName, "ko");
    });
  }, [students, sort]);

  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)]">
      <div className="rounded-3xl bg-white/75 p-4 ring-1 ring-wood/10 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-display text-lg text-wood sm:text-xl">수행 결과</h2>
            <p className="text-xs text-foreground/50">
              최고 기록과 최근 플레이 요약이에요.{" "}
              <Link
                href={`/teacher/classes/${classId}/results/${contentKey}`}
                className="font-bold text-wood underline-offset-2 hover:underline"
              >
                상세 기록
              </Link>
            </p>
          </div>
          <div className="flex rounded-xl bg-wood/10 p-1 text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setSort("score")}
              className={`rounded-lg px-2.5 py-1 ${
                sort === "score" ? "bg-gold/80 text-wood" : "text-foreground/55"
              }`}
            >
              점수순
            </button>
            <button
              type="button"
              onClick={() => setSort("number")}
              className={`rounded-lg px-2.5 py-1 ${
                sort === "number" ? "bg-gold/80 text-wood" : "text-foreground/55"
              }`}
            >
              번호순
            </button>
          </div>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <thead>
              <tr className="border-b border-wood/15 text-[11px] font-bold tracking-wide text-wood/70">
                <th className="py-2 pr-2">학생</th>
                <th className="py-2 pr-2">기록</th>
                <th className="py-2 pr-2">횟수</th>
                <th className="py-2">최근</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((student) => {
                return (
                  <tr
                    key={student.studentId}
                    className="border-b border-wood/8 align-top"
                  >
                    <td className="py-2 pr-2">
                      <p className="font-display text-foreground">
                        {formatStudentLabel(
                          student.displayName,
                          student.studentNumber,
                        )}
                        {!student.participated ? (
                          <span className="ml-2 text-[11px] font-bold text-foreground/40">
                            미참여
                          </span>
                        ) : null}
                      </p>
                      <SummaryChips
                        contentKey={contentKey}
                        details={student.latestDetails}
                      />
                    </td>
                    <td className="py-2 pr-2 font-black tabular-nums text-wood">
                      {scoreCell(student, kind)}
                    </td>
                    <td className="py-2 pr-2 tabular-nums text-foreground/70">
                      {student.runCount || "—"}
                    </td>
                    <td className="py-2 text-[11px] text-foreground/50">
                      {student.lastPlayedAt
                        ? formatWhen(student.lastPlayedAt)
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <aside className="rounded-3xl bg-gradient-to-b from-sky/20 via-white/80 to-mint/15 p-4 ring-1 ring-sky/30 sm:p-5">
        <h2 className="font-display text-lg text-wood">최근 기록</h2>
        <p className="text-xs text-foreground/50">방금 끝난 판이 올라와요.</p>
        {recentRuns.length === 0 ? (
          <p className="mt-6 text-sm text-foreground/50">아직 기록이 없어요.</p>
        ) : (
          <ol className="mt-3 space-y-2">
            {recentRuns.map((run) => (
              <li
                key={run.id}
                className="rounded-2xl bg-white/80 px-3 py-2 ring-1 ring-wood/8"
              >
                <p className="truncate text-sm font-bold text-foreground">
                  {formatStudentLabel(run.displayName, run.studentNumber)}
                </p>
                <p className="mt-0.5 flex items-center justify-between gap-2 text-xs">
                  <span className="font-black text-wood">{run.label}</span>
                  <span className="text-foreground/45">
                    {formatWhen(run.createdAt)}
                  </span>
                </p>
              </li>
            ))}
          </ol>
        )}
      </aside>
    </section>
  );
}
