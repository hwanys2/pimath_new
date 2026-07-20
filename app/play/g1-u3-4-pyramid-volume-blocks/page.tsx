import type { Metadata } from "next";
import PyramidVolumeBlocks from "@/components/sims/PyramidVolumeBlocks";
import AssignContentButton from "@/components/content/AssignContentButton";
import PlayBreadcrumb from "@/components/content/PlayBreadcrumb";
import { getContent } from "@/lib/contents";
import { fetchTeacherAssignContext } from "@/lib/teacher-classes";

const CONTENT_KEY = "g1-u3-4-pyramid-volume-blocks";

export const metadata: Metadata = {
  title: "블럭으로 보는 뿔의 부피 | 수학하는 즐거움",
  description:
    "정육면체 단위 블럭 계단으로 사각뿔 부피를 세며 기둥의 1/3에 수렴함을 탐구하는 시뮬레이션. 중1 3.4 입체도형의 성질. 점수는 없고 개념 탐구용입니다.",
};

export default async function PyramidVolumeBlocksPage() {
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

      <PyramidVolumeBlocks />
    </div>
  );
}
