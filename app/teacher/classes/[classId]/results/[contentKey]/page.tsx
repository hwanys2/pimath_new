import { notFound } from "next/navigation";
import Link from "next/link";
import { requireTeacher } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getContent } from "@/lib/contents";
import {
  isPvpContent,
  isSessionGameContent,
} from "@/lib/activity-result-schemas";
import {
  fetchClassContentResults,
  fetchClassStudents,
} from "@/lib/activity-results";
import { fetchClassPvpResults } from "@/lib/activity-results-pvp";
import { fetchClassSessionResults } from "@/lib/activity-results-sessions";
import { ContentResultTable } from "@/components/teacher/ContentResultDetail";
import StudentRunHistory from "@/components/teacher/StudentRunHistory";
import { formatStudentLabel } from "@/lib/students";
import { teacherGameDashboardHref } from "@/lib/game-dashboard-types";

type Props = {
  params: Promise<{ classId: string; contentKey: string }>;
};

async function fetchResults(classId: string, contentKey: string) {
  const content = getContent(contentKey);
  if (!content) return null;

  if (isPvpContent(contentKey)) {
    const view = await fetchClassPvpResults(classId, contentKey);
    return { content, view, kind: "pvp" as const };
  }

  if (isSessionGameContent(contentKey)) {
    const view = await fetchClassSessionResults(classId, contentKey);
    return { content, view, kind: "session" as const };
  }

  const kind = content.type === "simulation" ? "simulation" : "game";
  const view = await fetchClassContentResults(classId, contentKey, kind);
  return { content, view, kind: kind as "game" | "simulation" };
}

export default async function ContentResultsPage({ params }: Props) {
  const teacher = await requireTeacher();
  const { classId, contentKey } = await params;
  const supabase = await createClient();

  const { data: klass } = await supabase
    .from("pm_classes")
    .select("id, name, teacher_id")
    .eq("id", classId)
    .maybeSingle();

  if (!klass || klass.teacher_id !== teacher.id) {
    notFound();
  }

  const result = await fetchResults(classId, contentKey);
  if (!result) notFound();

  // Inquiry: recover scores that were lost when a live session was
  // auto-closed by "수업 준비" without finalize (needs DB migration).
  if (result.content.type === "inquiry") {
    const { backfillMissingInquiryGameRuns } = await import(
      "@/lib/inquiry-results-recover"
    );
    const recovered = await backfillMissingInquiryGameRuns(classId, contentKey);
    if (recovered.recorded > 0) {
      const refreshed = await fetchResults(classId, contentKey);
      if (refreshed) {
        const students = await fetchClassStudents(classId);
        return (
          <ResultsPageBody
            klass={klass}
            classId={classId}
            contentKey={contentKey}
            result={refreshed}
            students={students}
            recoveryNote={`${recovered.recorded}명의 탐구 결과를 복구했어요.`}
          />
        );
      }
    }
  }

  const students = await fetchClassStudents(classId);

  return (
    <ResultsPageBody
      klass={klass}
      classId={classId}
      contentKey={contentKey}
      result={result}
      students={students}
    />
  );
}

function ResultsPageBody({
  klass,
  classId,
  contentKey,
  result,
  students,
  recoveryNote,
}: {
  klass: { id: string; name: string };
  classId: string;
  contentKey: string;
  result: NonNullable<Awaited<ReturnType<typeof fetchResults>>>;
  students: Awaited<ReturnType<typeof fetchClassStudents>>;
  recoveryNote?: string;
}) {
  const { content, view, kind } = result;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/teacher/classes/${classId}`}
          className="text-sm font-semibold text-wood/70 underline-offset-2 hover:underline"
        >
          ← {klass.name}
        </Link>
        <h1 className="font-display mt-2 text-2xl text-foreground sm:text-3xl">
          {content.title}
        </h1>
        <p className="mt-1 text-sm text-foreground/60">학습 결과</p>
        {content.type === "game" ? (
          <Link
            href={teacherGameDashboardHref(classId, contentKey)}
            className="mt-3 inline-flex rounded-xl bg-gold/80 px-3 py-1.5 text-xs font-bold text-wood transition hover:brightness-105"
          >
            게임 대시보드
          </Link>
        ) : null}
        {recoveryNote ? (
          <p className="mt-2 text-sm font-bold text-wood" role="status">
            {recoveryNote}
          </p>
        ) : null}
      </div>

      <section className="quest-card p-5 sm:p-6">
        <ContentResultTable
          contentKey={contentKey}
          contentType={content.type}
          students={view.students}
        />
      </section>

      {kind === "game" || kind === "simulation" ? (
        <section className="quest-card p-5 sm:p-6">
          <h2 className="font-display text-lg text-wood">학생별 기록</h2>
          <p className="mt-1 text-sm text-foreground/60">
            최근 플레이 기록을 학생별로 볼 수 있어요.
          </p>
          <div className="mt-4 flex flex-col gap-4">
            {students.map((student) => (
              <StudentRunHistory
                key={student.id}
                classId={classId}
                contentKey={contentKey}
                contentType={content.type}
                studentId={student.id}
                displayName={formatStudentLabel(
                  student.displayName,
                  student.studentNumber,
                )}
              />
            ))}
          </div>
        </section>
      ) : kind === "pvp" ? (
        <section className="quest-card p-5 sm:p-6">
          <h2 className="font-display text-lg text-wood">대전 기록</h2>
          <ul className="mt-3 space-y-1 text-sm text-foreground/70">
            {"games" in view &&
              view.games.slice(0, 30).map((g) => (
                <li key={`${g.gameId}-${g.studentId}`}>
                  {g.displayName} vs {g.opponentName} —{" "}
                  {g.result === "win" ? "승" : g.result === "loss" ? "패" : "무"}
                </li>
              ))}
          </ul>
        </section>
      ) : kind === "session" ? (
        <section className="quest-card p-5 sm:p-6">
          <h2 className="font-display text-lg text-wood">세션 기록</h2>
          <ul className="mt-3 space-y-1 text-sm text-foreground/70">
            {"rows" in view &&
              view.rows.slice(0, 30).map((r, i) => (
                <li key={`${r.sessionId}-${r.studentId}-${i}`}>
                  {r.displayName} — {r.sessionScore}점
                </li>
              ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
