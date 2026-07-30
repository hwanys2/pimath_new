import type { Metadata } from "next";
import AssignContentButton from "@/components/content/AssignContentButton";
import PlayBreadcrumb from "@/components/content/PlayBreadcrumb";
import InquiryHostDashboard from "@/components/inquiry/InquiryHostDashboard";
import InquirySpectatorView from "@/components/inquiry/InquirySpectatorView";
import InquiryStudentView from "@/components/inquiry/InquiryStudentView";
import { getActor } from "@/lib/auth";
import { fetchMyClassContents } from "@/lib/class-contents";
import { getContent } from "@/lib/contents";
import { fetchTeacherAssignContext } from "@/lib/teacher-classes";

const CONTENT_KEY = "g1-u2-2-linear-equation-balance";

export const metadata: Metadata = {
  title: "대수막대와 저울로 일차방정식 | 수학하는 즐거움",
  description:
    "양팔저울과 대수막대로 등식의 성질을 탐구하고 일차방정식을 풀어 보는 중1 탐구 활동. 학생은 선생님이 수업을 시작할 때만 참여하고, 비로그인·교사는 미리볼 수 있어요.",
};

export default async function LinearEquationBalancePage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string }>;
}) {
  const content = getContent(CONTENT_KEY);
  const assignCtx = await fetchTeacherAssignContext([CONTENT_KEY]);
  const actor = await getActor();

  const { classId: classIdParam } = await searchParams;
  const initialClassId =
    typeof classIdParam === "string" ? classIdParam.trim() : null;

  let studentCanParticipate = false;
  if (actor?.type === "student") {
    const assignments = await fetchMyClassContents();
    const item = assignments.find((a) => a.contentKey === CONTENT_KEY);
    studentCanParticipate = Boolean(item?.isActive);
  }

  return (
    <div className="space-y-4">
      <PlayBreadcrumb
        contentTitle={content?.title}
        gradeHref="/grade/1"
        gradeLabel="중1"
        unitHref="/grade/1/g1-2-2"
        unitLabel="2.2. 일차방정식"
        assignSlot={
          assignCtx ? (
            <AssignContentButton
              contentKey={CONTENT_KEY}
              classes={assignCtx.classes}
              assignedClassIds={
                assignCtx.assignedByContent[CONTENT_KEY] ?? []
              }
            />
          ) : null
        }
      />

      {actor?.type === "teacher" ? (
        <InquiryHostDashboard
          contentKey={CONTENT_KEY}
          teacherClasses={assignCtx?.classes ?? []}
          initialClassId={initialClassId}
        />
      ) : actor?.type === "student" ? (
        <InquiryStudentView
          contentKey={CONTENT_KEY}
          studentClassId={actor.classId}
          studentClassName={actor.className}
          studentName={actor.name}
          canParticipate={studentCanParticipate}
          contentTitle={content?.title ?? "대수막대와 저울로 일차방정식"}
        />
      ) : (
        <InquirySpectatorView
          contentKey={CONTENT_KEY}
          title={content?.title ?? "대수막대와 저울로 일차방정식"}
        />
      )}
    </div>
  );
}
