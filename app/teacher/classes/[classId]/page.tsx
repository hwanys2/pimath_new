import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireTeacher } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fetchClassContentAssignments } from "@/lib/class-contents";
import EditClassForm from "@/components/teacher/EditClassForm";
import StudentRoster from "@/components/teacher/StudentRoster";
import BulkStudentImport from "@/components/teacher/BulkStudentImport";
import ClassContentManager from "@/components/teacher/ClassContentManager";
import ClassActivitySummary from "@/components/teacher/ClassActivitySummary";
import ClassDetailTabs from "@/components/teacher/ClassDetailTabs";
import DeleteClassButton from "@/components/teacher/DeleteClassButton";
import ClassPointRanking from "@/components/teacher/ClassPointRanking";
import { fetchClassActivityOverview } from "@/lib/activity-results";
import { getAuthOrigin } from "@/lib/auth-origin";
import { withStudentRosterOrder } from "@/lib/students";

type Props = {
  params: Promise<{ classId: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { classId } = await params;
  return {
    title: `학급 명단 | 수학하는 즐거움`,
    description: `학급 ${classId} 학생 명단`,
  };
}

export default async function ClassDetailPage({ params }: Props) {
  const teacher = await requireTeacher();
  const { classId } = await params;
  const supabase = await createClient();

  const { data: klass, error: classError } = await supabase
    .from("pm_classes")
    .select("id, name, grade, teacher_id")
    .eq("id", classId)
    .maybeSingle();

  if (classError) {
    console.error("[pm] load class failed:", classError.message);
  }

  if (!klass || klass.teacher_id !== teacher.id) {
    notFound();
  }

  const [
    { data: students, error: studentError },
    assignments,
    origin,
  ] = await Promise.all([
      withStudentRosterOrder(
        supabase
          .from("pm_students")
          .select("id, student_number, display_name, login_id, level, total_xp")
          .eq("class_id", classId),
      ),
      fetchClassContentAssignments(classId),
      getAuthOrigin(),
    ]);

  const activityOverview = await fetchClassActivityOverview(
    classId,
    assignments.map((a) => ({
      contentKey: a.contentKey,
      isActive: a.isActive,
    })),
  );

  if (studentError) {
    console.error("[pm] load students failed:", studentError.message);
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href="/teacher"
          className="text-sm font-semibold text-wood/70 underline-offset-2 hover:underline"
        >
          ← 내 학급
        </Link>
        <h1 className="font-display mt-2 text-3xl text-foreground sm:text-4xl">
          {klass.name}
        </h1>
        <p className="mt-1 text-sm text-foreground/60">
          {klass.grade ? `중${klass.grade} · ` : ""}
          학생 {(students ?? []).length}명
        </p>
      </div>

      <section className="quest-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl text-wood">학급 정보</h2>
          <DeleteClassButton
            classId={classId}
            name={klass.name}
            studentCount={(students ?? []).length}
            label="학급 삭제"
          />
        </div>
        <div className="mt-4">
          <EditClassForm
            classId={klass.id}
            name={klass.name}
            grade={klass.grade}
          />
        </div>
      </section>

      <Suspense fallback={<div className="quest-card p-5 sm:p-6">불러오는 중…</div>}>
        <ClassDetailTabs
          panels={{
            content: (
              <ClassContentManager
                classId={classId}
                assignments={assignments}
              />
            ),
            results: (
              <div>
                <p className="text-sm text-foreground/65">
                  활성화된 콘텐츠에 대한 학생 참여 현황이에요. 게임은 대시보드에서
                  실시간 현황과 랭킹을 볼 수 있어요.
                </p>
                <div className="mt-4">
                  <ClassActivitySummary
                    classId={classId}
                    activities={activityOverview}
                  />
                </div>
              </div>
            ),
            roster: (
              <div className="flex flex-col gap-6">
                <div>
                  <p className="text-sm text-foreground/65">
                    번호·이름·아이디는 바로 수정하고 저장하세요. 비밀번호는 바꿀
                    때만 입력하면 됩니다. QR을 인쇄해 교과서에 붙이면 학생이
                    카메라로 찍고 바로 들어올 수 있어요.
                  </p>
                  <div className="mt-4">
                    <StudentRoster
                      classId={classId}
                      origin={origin}
                      students={students ?? []}
                    />
                  </div>
                </div>
                <BulkStudentImport classId={classId} />
              </div>
            ),
            ranking: (
              <ClassPointRanking
                className={klass.name}
                students={students ?? []}
              />
            ),
          }}
        />
      </Suspense>
    </div>
  );
}
