import type { Metadata } from "next";
import SolidOfRevolution from "@/components/sims/SolidOfRevolution";
import AssignContentButton from "@/components/content/AssignContentButton";
import PlayBreadcrumb from "@/components/content/PlayBreadcrumb";
import { getContent } from "@/lib/contents";
import { fetchTeacherAssignContext } from "@/lib/teacher-classes";

const CONTENT_KEY = "g1-u3-4-solid-of-revolution";

export const metadata: Metadata = {
  title: "회전체 만들기 | 수학하는 즐거움",
  description:
    "축을 중심으로 평면도형을 회전시켜 회전체를 만들고, 각도를 바꿔 형성 과정을 확인하는 시뮬레이션. 중1 3.4 입체도형의 성질. 점수는 없고 개념 탐구용입니다.",
};

export default async function SolidOfRevolutionPage() {
  const content = getContent(CONTENT_KEY);
  const assignCtx = await fetchTeacherAssignContext([CONTENT_KEY]);

  return (
    <div className="space-y-4">
      <PlayBreadcrumb
        contentTitle={content?.title}
        gradeHref="/grade/1"
        gradeLabel="중1"
        unitHref="/grade/1/g1-3-4"
        unitLabel="3.4 입체도형의 성질"
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

      <SolidOfRevolution />
    </div>
  );
}
