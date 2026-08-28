import type { Metadata } from "next";
import AssignContentButton from "@/components/content/AssignContentButton";
import PlayBreadcrumb from "@/components/content/PlayBreadcrumb";
import InquiryHostDashboard from "@/components/inquiry/InquiryHostDashboard";
import InquirySpectatorView from "@/components/inquiry/InquirySpectatorView";
import InquiryStudentView from "@/components/inquiry/InquiryStudentView";
import { getActor } from "@/lib/auth";
import { fetchMyClassContents } from "@/lib/class-contents";
import { getContent } from "@/lib/contents";
import { assignedClassesForContent, fetchTeacherAssignContext } from "@/lib/teacher-classes";

const CONTENT_KEY = "g1-u2-2-linear-equation-race";

export const metadata: Metadata = {
  title: "일차방정식 레이스 | 수학하는 즐거움",
  description:
    "연산을 선택해 일차방정식을 풀고 속도로 점수를 겨루는 중1 탐구 게임. 학생은 선생님이 수업을 시작할 때만 참여하고, 비로그인·교사는 미리 체험할 수 있어요.",
};

export default async function LinearEquationRacePage({
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
          teacherClasses={assignedClassesForContent(assignCtx, CONTENT_KEY)}
          initialClassId={initialClassId}
        />
      ) : actor?.type === "student" ? (
        <InquiryStudentView
          contentKey={CONTENT_KEY}
          studentClassId={actor.classId}
          studentClassName={actor.className}
          studentName={actor.name}
          canParticipate={studentCanParticipate}
          contentTitle={content?.title ?? "일차방정식 레이스"}
        />
      ) : (
        <InquirySpectatorView
          contentKey={CONTENT_KEY}
          title={content?.title ?? "일차방정식 레이스"}
        />
      )}
    </div>
  );
}
