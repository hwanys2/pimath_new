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

const CONTENT_KEY = "g3-u1-radical-fill";

export const metadata: Metadata = {
  title: "근호 빈칸 채우기 | 수학하는 즐거움",
  description:
    "서로 다른 수로 근호 식을 완성하는 중3 제곱근 탐구 활동. 학생은 선생님이 수업을 시작할 때만 참여하고, 비로그인·교사는 문제를 미리볼 수 있어요.",
};

export default async function RadicalFillPage({
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
        gradeHref="/grade/3"
        gradeLabel="중3"
        unitHref="/grade/3/g3-1"
        unitLabel="1. 제곱근과 실수"
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
          teacherClasses={assignCtx?.classes ?? []}
          initialClassId={initialClassId}
        />
      ) : actor?.type === "student" ? (
        <InquiryStudentView
          studentClassId={actor.classId}
          studentClassName={actor.className}
          studentName={actor.name}
          canParticipate={studentCanParticipate}
          contentTitle={content?.title ?? "근호 빈칸 채우기"}
        />
      ) : (
        <InquirySpectatorView title={content?.title ?? "근호 빈칸 채우기"} />
      )}
    </div>
  );
}
