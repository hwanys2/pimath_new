import {
  isPvpContent,
  isSessionGameContent,
  summaryLabel,
  type ActivityDetailsV1,
} from "@/lib/activity-result-schemas";
import type { ContentType } from "@/lib/contents";
import type { StudentActivitySummary } from "@/lib/activity-results";
import { formatStudentLabel } from "@/lib/students";

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

function SummaryChips({
  contentKey,
  details,
}: {
  contentKey: string;
  details: ActivityDetailsV1 | null;
}) {
  if (!details?.summary) return null;
  const entries = Object.entries(details.summary);
  if (entries.length === 0) return null;

  return (
    <div className="mt-1 flex flex-wrap gap-1.5">
      {entries.map(([key, value]) => (
        <span
          key={key}
          className="rounded-full bg-wood/10 px-2 py-0.5 text-[11px] font-semibold text-foreground/70"
        >
          {summaryLabel(contentKey, key)}: {String(value)}
        </span>
      ))}
    </div>
  );
}

function RadicalFillDetail({ items }: { items: ActivityDetailsV1["items"] }) {
  if (!items?.length) return null;
  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full min-w-[280px] text-left text-xs">
        <thead>
          <tr className="border-b border-wood/15 text-foreground/55">
            <th className="py-1 pr-3 font-semibold">문항</th>
            <th className="py-1 pr-3 font-semibold">점수</th>
            <th className="py-1 pr-3 font-semibold">오답</th>
            <th className="py-1 font-semibold">포기</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} className="border-b border-wood/8">
              <td className="py-1 pr-3">{(item.index as number) + 1}</td>
              <td className="py-1 pr-3">{String(item.score ?? "—")}</td>
              <td className="py-1 pr-3">{String(item.wrongs ?? 0)}</td>
              <td className="py-1">{item.gaveUp ? "예" : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TangentIntroDetail({ items }: { items: ActivityDetailsV1["items"] }) {
  if (!items?.length) return null;
  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full min-w-[280px] text-left text-xs">
        <thead>
          <tr className="border-b border-wood/15 text-foreground/55">
            <th className="py-1 pr-3 font-semibold">문항</th>
            <th className="py-1 pr-3 font-semibold">내용</th>
            <th className="py-1 pr-3 font-semibold">점수</th>
            <th className="py-1 font-semibold">오답</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} className="border-b border-wood/8">
              <td className="py-1 pr-3">{(item.index as number) + 1}</td>
              <td className="py-1 pr-3">
                {item.kind === "define"
                  ? "내용 확인"
                  : item.kind === "table"
                    ? `표 ${String(item.filled ?? "—")}칸`
                    : `높이 ${String(item.height ?? "—")} m`}
                {typeof item.methodText === "string" && item.methodText.trim() ? (
                  <span className="mt-0.5 block max-w-[14rem] truncate text-foreground/55">
                    {item.methodText}
                  </span>
                ) : null}
              </td>
              <td className="py-1 pr-3">{String(item.score ?? "—")}</td>
              <td className="py-1">{String(item.wrongs ?? 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SincosIntroDetail({ items }: { items: ActivityDetailsV1["items"] }) {
  if (!items?.length) return null;
  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full min-w-[280px] text-left text-xs">
        <thead>
          <tr className="border-b border-wood/15 text-foreground/55">
            <th className="py-1 pr-3 font-semibold">문항</th>
            <th className="py-1 pr-3 font-semibold">내용</th>
            <th className="py-1 pr-3 font-semibold">점수</th>
            <th className="py-1 font-semibold">오답</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} className="border-b border-wood/8">
              <td className="py-1 pr-3">{(item.index as number) + 1}</td>
              <td className="py-1 pr-3">
                {item.kind === "table"
                  ? `표 ${String(item.filled ?? "—")}칸`
                  : `거리 ${String(item.adj ?? "—")} · 높이 ${String(item.opp ?? "—")} ${String(item.unit ?? "")}`}
                {typeof item.methodText === "string" && item.methodText.trim() ? (
                  <span className="mt-0.5 block max-w-[14rem] truncate text-foreground/55">
                    {item.methodText}
                  </span>
                ) : null}
              </td>
              <td className="py-1 pr-3">{String(item.score ?? "—")}</td>
              <td className="py-1">{String(item.wrongs ?? 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GenericItemsDetail({ items }: { items: ActivityDetailsV1["items"] }) {
  if (!items?.length) return null;
  return (
    <ul className="mt-2 space-y-1 text-xs text-foreground/70">
      {items.map((item, i) => (
        <li key={i} className="rounded-lg bg-wood/5 px-2 py-1">
          {JSON.stringify(item)}
        </li>
      ))}
    </ul>
  );
}

function TrigoSlashDetail({ items }: { items: ActivityDetailsV1["items"] }) {
  if (!items?.length) return null;
  const resultLabel: Record<string, string> = {
    hit: "맞춤",
    reverse: "순서 반대",
    miss: "오답",
    timeout: "시간 초과",
  };
  const shapeLabel: Record<string, string> = {
    normal: "보통",
    flat: "납작",
    skinny: "뾰족",
  };
  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full min-w-[280px] text-left text-xs">
        <thead>
          <tr className="border-b border-wood/15 text-foreground/55">
            <th className="py-1 pr-3 font-semibold">#</th>
            <th className="py-1 pr-3 font-semibold">미션</th>
            <th className="py-1 pr-3 font-semibold">결과</th>
            <th className="py-1 font-semibold">모양</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} className="border-b border-wood/8">
              <td className="py-1 pr-3">{String(item.i ?? i + 1)}</td>
              <td className="py-1 pr-3">{String(item.mission ?? "—")}</td>
              <td className="py-1 pr-3">
                {resultLabel[String(item.result)] ?? String(item.result ?? "—")}
                {item.boss ? " · 보스" : ""}
                {item.spin ? " · 회전" : ""}
              </td>
              <td className="py-1">
                {shapeLabel[String(item.shape)] ?? String(item.shape ?? "—")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ContentResultDetail({
  contentKey,
  details,
}: {
  contentKey: string;
  details: ActivityDetailsV1 | null;
}) {
  if (!details) return null;

  if (contentKey === "g3-u1-radical-fill") {
    return <RadicalFillDetail items={details.items} />;
  }

  if (contentKey === "g3-u3-1-tangent-intro") {
    return <TangentIntroDetail items={details.items} />;
  }

  if (contentKey === "g3-u3-1-sincos-intro") {
    return <SincosIntroDetail items={details.items} />;
  }

  if (contentKey === "g3-u3-1-trigo-slash") {
    return <TrigoSlashDetail items={details.items} />;
  }

  return <GenericItemsDetail items={details.items} />;
}

export function StudentResultRow({
  contentKey,
  contentType,
  student,
  expanded,
  onToggle,
}: {
  contentKey: string;
  contentType: ContentType;
  student: StudentActivitySummary;
  expanded?: boolean;
  onToggle?: () => void;
}) {
  const pvp = isPvpContent(contentKey);
  const session = isSessionGameContent(contentKey);

  return (
    <div
      className={`rounded-2xl border px-4 py-3 ${
        student.participated
          ? "border-wood/15 bg-white/40"
          : "border-wood/8 bg-wood/5 opacity-70"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display text-base text-foreground">
            {formatStudentLabel(student.displayName, student.studentNumber)}
          </p>
          <p className="text-xs text-foreground/50">{student.loginId}</p>
        </div>
        <div className="text-right text-sm">
          {!student.participated ? (
            <span className="font-semibold text-foreground/45">미참여</span>
          ) : contentType === "simulation" ? (
            <span className="font-semibold text-wood">
              {student.completedCount > 0
                ? `완료 ${student.completedCount}회`
                : "시작함"}
            </span>
          ) : pvp ? (
            <span className="font-semibold text-wood">
              {student.runCount}판 · 승{" "}
              {student.latestDetails?.summary.wins ?? 0}
            </span>
          ) : session ? (
            <span className="font-semibold text-wood">
              최고 {student.bestScore ?? 0}점
            </span>
          ) : (
            <span className="font-semibold text-wood">
              최고 {student.bestScore ?? 0} · 최근 {student.latestScore ?? 0}
            </span>
          )}
        </div>
      </div>

      {student.participated && student.lastPlayedAt ? (
        <p className="mt-1 text-[11px] text-foreground/45">
          마지막: {formatDate(student.lastPlayedAt)}
          {student.runCount > 1 ? ` · 총 ${student.runCount}회` : null}
        </p>
      ) : null}

      {student.participated ? (
        <SummaryChips contentKey={contentKey} details={student.latestDetails} />
      ) : null}

      {onToggle && student.participated && student.latestDetails?.items?.length ? (
        <button
          type="button"
          onClick={onToggle}
          className="mt-2 text-xs font-semibold text-wood underline-offset-2 hover:underline"
        >
          {expanded ? "상세 접기" : "상세 펼치기"}
        </button>
      ) : null}

      {expanded && student.latestDetails ? (
        <ContentResultDetail
          contentKey={contentKey}
          details={student.latestDetails}
        />
      ) : null}
    </div>
  );
}

export function ContentResultTable({
  contentKey,
  contentType,
  students,
}: {
  contentKey: string;
  contentType: ContentType;
  students: StudentActivitySummary[];
}) {
  const participated = students.filter((s) => s.participated).length;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-foreground/65">
        참여 {participated}/{students.length}명
      </p>
      <div className="flex flex-col gap-2">
        {students.map((student) => (
          <StudentResultRow
            key={student.studentId}
            contentKey={contentKey}
            contentType={contentType}
            student={student}
          />
        ))}
      </div>
    </div>
  );
}
