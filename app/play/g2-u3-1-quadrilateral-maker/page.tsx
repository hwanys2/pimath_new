import type { Metadata } from "next";
import QuadrilateralMaker from "@/components/games/QuadrilateralMaker";
import AssignContentButton from "@/components/content/AssignContentButton";
import PlayBreadcrumb from "@/components/content/PlayBreadcrumb";
import { getContent } from "@/lib/contents";
import { fetchTeacherAssignContext } from "@/lib/teacher-classes";

const CONTENT_KEY = "g2-u3-1-quadrilateral-maker";

export const metadata: Metadata = {
  title: "사각형 만들기 | 수학하는 즐거움",
  description:
    "가위바위보 후 도형을 고르고, 격자에 돌을 두어 먼저 사각형을 완성하는 게임. 중2 3.1 삼각형과 사각형의 성질. 학급 배정 시 XP와 랭킹이 쌓입니다.",
};

export default async function QuadrilateralMakerPage() {
  const content = getContent(CONTENT_KEY);
  const assignCtx = await fetchTeacherAssignContext([CONTENT_KEY]);

  return (
    <div className="space-y-4">
      <PlayBreadcrumb
        contentTitle={content?.title}
        gradeHref="/grade/2"
        gradeLabel="중2"
        unitHref="/grade/2/g2-3-1"
        unitLabel="3.1 삼각형과 사각형의 성질"
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

      <QuadrilateralMaker />
    </div>
  );
}
