"use client";

import Link from "next/link";
import type { GraphSessionSummary } from "@/lib/graph-explorer-types";
import MathExpression from "@/components/tools/graph/MathExpression";

function formatDate(iso: string): string {
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

export default function RoomListClient({
  sessions,
}: {
  sessions: GraphSessionSummary[];
}) {
  if (sessions.length === 0) {
    return (
      <p className="rounded-2xl border-2 border-dashed border-wood/20 bg-cream/50 py-12 text-center text-sm text-foreground/60">
        아직 만든 방이 없어요. 위에서 새 방을 만들어 보세요!
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {sessions.map((s) => (
        <Link
          key={s.sessionId}
          href={`/tools/graph/host/${s.sessionId}`}
          className="group rounded-3xl border-2 border-wood/15 bg-cream p-5 transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-display text-lg text-wood-dark">{s.title}</h3>
            <span
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                s.status === "live"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-black/10 text-foreground/60"
              }`}
            >
              {s.status === "live" ? "진행 중" : "기록"}
            </span>
          </div>

          <div className="mt-2 min-h-[2.5rem]">
            <MathExpression
              display={s.expressionDisplay}
              latex={s.expressionLatex}
              className="text-base"
              block={false}
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground/60">
            <span>👥 {s.participantCount}명</span>
            <span>📍 {s.pointCount}점</span>
            <span>✅ {s.correctCount}</span>
            {s.status === "live" && s.joinCode ? (
              <span className="font-mono font-bold tracking-widest text-wood">
                {s.joinCode}
              </span>
            ) : null}
          </div>

          <p className="mt-2 text-[11px] text-foreground/45">
            {formatDate(s.createdAt)}
          </p>

          <p className="font-display mt-3 text-right text-sm text-wood-dark/70 transition group-hover:translate-x-1">
            {s.status === "live" ? "진행하기 →" : "기록 보기 →"}
          </p>
        </Link>
      ))}
    </div>
  );
}
