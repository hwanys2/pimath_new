"use client";

import { useMemo } from "react";
import { buildLiveRanking } from "@/lib/inquiry-equation-ops";
import type { InquiryResponseRow } from "@/lib/inquiry-types";
import type { EquationOpsResponsePayload } from "@/lib/inquiry-equation-ops";

type Props = {
  responses: InquiryResponseRow[];
  stepCount: number;
  highlightStudentId?: string | null;
  title?: string;
};

function formatMs(ms: number): string {
  if (ms <= 0) return "—";
  const sec = ms / 1000;
  return sec < 60 ? `${sec.toFixed(1)}초` : `${Math.floor(sec / 60)}분 ${Math.round(sec % 60)}초`;
}

export default function InquiryLiveRanking({
  responses,
  stepCount,
  highlightStudentId = null,
  title = "누적 랭킹",
}: Props) {
  const ranking = useMemo(() => {
    const rows = responses.map((r) => ({
      studentId: r.studentId,
      displayName: r.displayName,
      stepIndex: r.stepIndex,
      result: r.result,
      response: r.response as EquationOpsResponsePayload,
    }));
    return buildLiveRanking(rows, stepCount);
  }, [responses, stepCount]);

  return (
    <div className="rounded-2xl border border-wood/10 bg-white/70 p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="font-display text-lg text-wood">{title}</h3>
        <span className="text-xs text-foreground/50">속도 점수 합계</span>
      </div>
      {ranking.length === 0 ? (
        <p className="mt-3 text-sm text-foreground/50">아직 점수가 없어요</p>
      ) : (
        <ol className="mt-3 space-y-2">
          {ranking.map((p, i) => {
            const rank = i + 1;
            const medal =
              rank === 1
                ? "bg-gold/70 text-wood"
                : rank === 2
                  ? "bg-wood/20 text-wood"
                  : rank === 3
                    ? "bg-[#c4785a]/35 text-wood"
                    : "bg-cream text-wood/70";
            const isMe = highlightStudentId === p.studentId;
            return (
              <li
                key={p.studentId}
                className={[
                  "flex items-center justify-between rounded-xl px-2.5 py-2 text-sm",
                  isMe ? "bg-gold/35 ring-1 ring-gold/50" : "bg-cream/80",
                ].join(" ")}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className={[
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-display text-xs",
                      medal,
                    ].join(" ")}
                  >
                    {rank}
                  </span>
                  <span className="truncate font-medium">{p.displayName}</span>
                  <span className="shrink-0 text-xs text-foreground/50">
                    {p.correctCount}문제
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <strong className="font-display text-sm text-wood">
                    {p.sessionScore}
                  </strong>
                  <span className="text-xs text-foreground/50">점</span>
                  <span className="ml-2 text-xs text-foreground/45">
                    {formatMs(p.totalTimeMs)}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
