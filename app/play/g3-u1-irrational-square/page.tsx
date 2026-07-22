import type { Metadata } from "next";
import IrrationalSquare from "@/components/sims/IrrationalSquare";
import AssignContentButton from "@/components/content/AssignContentButton";
import PlayBreadcrumb from "@/components/content/PlayBreadcrumb";
import { getContent } from "@/lib/contents";
import { fetchTeacherAssignContext } from "@/lib/teacher-classes";

const CONTENT_KEY = "g3-u1-irrational-square";

export const metadata: Metadata = {
  title: "정사각형으로 만나는 무리수 | 수학하는 즐거움",
  description:
    "넓이가 정수인 정사각형의 한 변 길이를 직접 찾아 보며 제곱근 근삿값과 무리수를 탐구하는 시뮬레이션. 중3 1. 제곱근과 실수. 점수는 없고 개념 탐구용입니다.",
};

export default async function IrrationalSquarePage() {
  const content = getContent(CONTENT_KEY);
  const assignCtx = await fetchTeacherAssignContext([CONTENT_KEY]);

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

      <IrrationalSquare />
    </div>
  );
}
