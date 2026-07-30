import type { Metadata } from "next";
import AssignContentButton from "@/components/content/AssignContentButton";
import PlayBreadcrumb from "@/components/content/PlayBreadcrumb";
import InquiryHostDashboard from "@/components/inquiry/InquiryHostDashboard";
import InquiryStudentView from "@/components/inquiry/InquiryStudentView";
import RadicalFillQuiz from "@/components/games/RadicalFillQuiz";
import { getActor } from "@/lib/auth";
import { getContent } from "@/lib/contents";
import { fetchTeacherAssignContext } from "@/lib/teacher-classes";

const CONTENT_KEY = "g3-u1-radical-fill";

export const metadata: Metadata = {
  title: "근호 빈칸 채우기 | 수학하는 즐거움",
  description:
    "서로 다른 수로 근호 식을 완성하는 중3 제곱근 탐구 활동. 교사 수업 모드에서는 선생님 속도에 맞춰 진행하고, 수업이 없을 때는 혼자 연습할 수 있어요.",
};

export default async function RadicalFillPage() {
  const content = getContent(CONTENT_KEY);
  const assignCtx = await fetchTeacherAssignContext([CONTENT_KEY]);
  const actor = await getActor();

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
        <InquiryHostDashboard teacherClasses={assignCtx?.classes ?? []} />
      ) : actor?.type === "student" ? (
        <InquiryStudentView
          studentClassId={actor.classId}
          studentClassName={actor.className}
          studentName={actor.name}
        />
      ) : (
        <RadicalFillQuiz />
      )}
    </div>
  );
}
