import Link from "next/link";
import type { AssignedContentActivity } from "@/lib/activity-results";
import { contentTypeBadgeClass, contentTypeLabel } from "@/lib/contents";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
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

export default function ClassActivitySummary({
  classId,
  activities,
}: {
  classId: string;
  activities: AssignedContentActivity[];
}) {
  if (activities.length === 0) {
    return (
      <p className="text-sm text-foreground/55">
        활성화된 콘텐츠가 없어요. 위 「수업 콘텐츠」에서 담아두고 활성화해 주세요.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {activities.map((activity) => {
        const rate =
          activity.studentCount > 0
            ? Math.round(
                (activity.participantCount / activity.studentCount) * 100,
              )
            : 0;

        return (
          <li
            key={activity.contentKey}
            className="flex flex-col gap-2 rounded-2xl bg-wood/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${contentTypeBadgeClass(activity.type)}`}
                >
                  {contentTypeLabel(activity.type)}
                </span>
                <span className="text-[11px] font-semibold text-foreground/50">
                  참여 {activity.participantCount}/{activity.studentCount}명 (
                  {rate}%)
                </span>
              </div>
              <p className="mt-1 font-display text-base text-foreground">
                {activity.title}
              </p>
              <p className="text-xs text-foreground/50">
                기록 {activity.totalRuns}건 · 마지막{" "}
                {formatDate(activity.lastActivityAt)}
              </p>
            </div>
            <Link
              href={`/teacher/classes/${classId}/results/${activity.contentKey}`}
              className="shrink-0 rounded-xl bg-gold/70 px-4 py-2 text-center text-xs font-bold text-wood transition hover:brightness-105"
            >
              결과 보기
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
