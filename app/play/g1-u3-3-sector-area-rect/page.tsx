import type { Metadata } from "next";
import SectorAreaRect from "@/components/sims/SectorAreaRect";
import AssignContentButton from "@/components/content/AssignContentButton";
import PlayBreadcrumb from "@/components/content/PlayBreadcrumb";
import { getContent } from "@/lib/contents";
import { fetchTeacherAssignContext } from "@/lib/teacher-classes";

const CONTENT_KEY = "g1-u3-3-sector-area-rect";

export const metadata: Metadata = {
  title: "부채꼴을 직사각형으로 | 수학하는 즐거움",
  description:
    "부채꼴을 작게 나눠 직사각형으로 재배열하며 넓이 공식(½×r×ℓ)을 유추하는 시뮬레이션. 중1 3.3 평면도형의 성질. 점수는 없고 개념 탐구용입니다.",
};

export default async function SectorAreaRectPage() {
  const content = getContent(CONTENT_KEY);
  const assignCtx = await fetchTeacherAssignContext([CONTENT_KEY]);

  return (
    <div className="space-y-4">
      <PlayBreadcrumb
        contentTitle={content?.title}
        gradeHref="/grade/1"
        gradeLabel="중1"
        unitHref="/grade/1/g1-3-3"
        unitLabel="3.3 평면도형의 성질"
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

      <SectorAreaRect />
    </div>
  );
}
