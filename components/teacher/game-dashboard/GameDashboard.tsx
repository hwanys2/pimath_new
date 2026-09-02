"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import { pollGameDashboard } from "@/app/teacher/game-dashboard-actions";
import ClassQuickNav from "@/components/teacher/ClassQuickNav";
import DashboardLiveExtras from "@/components/teacher/game-dashboard/DashboardLiveExtras";
import DashboardRanking from "@/components/teacher/game-dashboard/DashboardRanking";
import DashboardResults from "@/components/teacher/game-dashboard/DashboardResults";
import DashboardRoster from "@/components/teacher/game-dashboard/DashboardRoster";
import { type GameDashboardSnapshot } from "@/lib/game-dashboard-types";
import { useDashboardPoll } from "@/lib/session-sync";

function formatClock(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "";
  }
}

function KpiCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone: "mint" | "gold" | "sky" | "lavender" | "peach";
}) {
  const bg = {
    mint: "from-mint/50 to-mint/15",
    gold: "from-gold/55 to-gold/15",
    sky: "from-sky/50 to-sky/15",
    lavender: "from-lavender/50 to-lavender/15",
    peach: "from-peach/50 to-peach/15",
  }[tone];

  return (
    <article
      className={`rounded-2xl bg-gradient-to-br ${bg} px-3 py-3 ring-1 ring-white/60`}
    >
      <p className="text-[11px] font-bold tracking-wide text-wood/70">{label}</p>
      <p className="font-display mt-1 text-2xl tabular-nums text-wood sm:text-3xl">
        {value}
      </p>
      {hint ? (
        <p className="mt-0.5 text-[11px] font-semibold text-foreground/45">
          {hint}
        </p>
      ) : null}
    </article>
  );
}

function CopyPlayLink({ href }: { href: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="rounded-xl bg-white/70 px-3 py-1.5 text-xs font-bold text-wood ring-1 ring-wood/10 transition hover:bg-white"
      onClick={async () => {
        const url =
          typeof window !== "undefined"
            ? `${window.location.origin}${href}`
            : href;
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? "복사됨!" : "공개 링크 복사"}
    </button>
  );
}

export default function GameDashboard({
  initial,
}: {
  initial: GameDashboardSnapshot;
}) {
  const [snapshot, setSnapshot] = useState(initial);
  const [isPending, startTransition] = useTransition();
  const [tickOk, setTickOk] = useState(true);

  useEffect(() => {
    setSnapshot(initial);
  }, [initial]);

  const classId = snapshot.classId;
  const contentKey = snapshot.contentKey;

  const tick = useCallback(() => {
    startTransition(() => {
      void pollGameDashboard({ classId, contentKey }).then((next) => {
        if ("error" in next) {
          setTickOk(false);
          return;
        }
        setTickOk(true);
        setSnapshot(next);
      });
    });
  }, [classId, contentKey]);

  useDashboardPoll(classId, contentKey, tick);

  const { kpis, kind } = snapshot;
  const live = kpis.playing + kpis.waiting > 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-wood via-wood-dark to-[#4a2c16] p-5 text-cream shadow-[0_16px_40px_rgba(61,44,30,0.28)] sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              href={`/teacher/classes/${snapshot.classId}`}
              className="text-xs font-semibold text-cream/70 underline-offset-2 hover:underline"
            >
              ← {snapshot.className}
            </Link>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black tracking-wide ${
                  live
                    ? "bg-mint text-wood"
                    : "bg-cream/15 text-cream/80"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    live ? "animate-pulse bg-wood" : "bg-cream/50"
                  }`}
                  aria-hidden
                />
                {live ? "LIVE" : "대기"}
              </span>
              <span className="rounded-full bg-gold/90 px-2.5 py-1 text-[11px] font-black text-wood">
                게임 대시보드
              </span>
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                  snapshot.isActive
                    ? "bg-mint/30 text-cream"
                    : "bg-cream/10 text-cream/70"
                }`}
              >
                {snapshot.isActive ? "배정 · 활성" : "비활성 · 연습만"}
              </span>
            </div>
            <h1 className="font-display mt-3 text-3xl text-cream sm:text-4xl">
              {snapshot.contentTitle}
            </h1>
            <p className="mt-1 text-sm text-cream/70">
              {snapshot.unitLabel ? `${snapshot.unitLabel} · ` : ""}
              {snapshot.className}
              {kind === "pvp" ? " · 1:1 대전" : kind === "session" ? " · 수업 세션" : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <CopyPlayLink href={snapshot.contentHref} />
            <Link
              href={snapshot.contentHref}
              className="rounded-xl bg-gold px-3 py-1.5 text-xs font-bold text-wood transition hover:brightness-105"
            >
              플레이 화면
            </Link>
          </div>
        </div>
        <p className="mt-4 text-[11px] font-semibold text-cream/55">
          {tickOk ? "자동 새로고침 중" : "새로고침 실패 · 다시 시도합니다"}
          {isPending ? " · 동기화…" : ""}
          {" · "}
          {formatClock(snapshot.fetchedAt)}
        </p>
      </div>

      <ClassQuickNav classId={snapshot.classId} />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard
          label="플레이 중"
          value={String(kpis.playing)}
          hint={kpis.waiting > 0 ? `대기 ${kpis.waiting}` : "실시간"}
          tone="mint"
        />
        <KpiCard
          label="참여"
          value={`${kpis.participantCount}/${kpis.studentCount}`}
          hint={`${kpis.participationRate}%`}
          tone="gold"
        />
        <KpiCard
          label="미참여"
          value={String(kpis.idle)}
          hint="아직 안 함"
          tone="peach"
        />
        <KpiCard
          label={kind === "pvp" ? "최다 승" : "최고점"}
          value={
            kpis.topScore == null
              ? "—"
              : kind === "pvp"
                ? `${Math.round(kpis.topScore / 100)}승`
                : kpis.topScore.toLocaleString()
          }
          tone="sky"
        />
        <KpiCard
          label={kind === "pvp" ? "기록" : "평균 최고점"}
          value={
            kind === "pvp"
              ? `${kpis.totalRuns}`
              : kpis.avgBest == null
                ? "—"
                : kpis.avgBest.toLocaleString()
          }
          hint={kind === "pvp" ? "대전 수" : `${kpis.totalRuns}판`}
          tone="lavender"
        />
      </div>

      <DashboardLiveExtras
        kind={kind}
        matches={snapshot.liveMatches}
        session={snapshot.liveSession}
      />

      <div className="rounded-3xl bg-cream/80 p-4 ring-1 ring-wood/10 sm:p-5">
        <DashboardRoster students={snapshot.students} kind={kind} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <DashboardRanking
          rows={snapshot.ranking}
          kind={kind}
          title="학급 랭킹"
          hint={kind === "pvp" ? "이 반 · 개인 승수" : "이 반 · 개인 최고 점수"}
          tone="class"
        />
        <DashboardRanking
          rows={snapshot.schoolRanking}
          kind={kind}
          title="학교 랭킹"
          hint="같은 선생님 학급 · 개인 최고"
          tone="school"
          showMeta
          scoreAsPoints
        />
        <DashboardRanking
          rows={snapshot.worldRanking}
          kind={kind}
          title="전체 랭킹"
          hint="모든 학생 · 다른 학교 이름은 *로 가려요"
          tone="world"
          showMeta
          scoreAsPoints
        />
      </div>

      <DashboardResults
        classId={snapshot.classId}
        contentKey={snapshot.contentKey}
        kind={kind}
        students={snapshot.students}
        recentRuns={snapshot.recentRuns}
      />
    </div>
  );
}
