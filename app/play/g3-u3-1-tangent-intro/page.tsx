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

const CONTENT_KEY = "g3-u3-1-tangent-intro";

export const metadata: Metadata = {
  title: "높이 재기 탐구 | 수학하는 즐거움",
  description:
    "건물·나무·등대 높이를 거리와 각만으로 구하고 표를 만들며 삼각비를 만나는 중3 탐구 활동. 학생은 선생님이 수업을 시작할 때만 참여하고, 비로그인·교사는 직접 조작해 볼 수 있어요.",
};

export default async function TangentIntroPage({
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
        unitHref="/grade/3/g3-3-1"
        unitLabel="3.1. 삼각비"
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
          contentTitle={content?.title ?? "높이 재기 탐구"}
        />
      ) : (
        <InquirySpectatorView
          contentKey={CONTENT_KEY}
          title={content?.title ?? "높이 재기 탐구"}
        />
      )}
    </div>
  );
}
