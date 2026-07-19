import type { Metadata } from "next";
import OrderedPairOmok from "@/components/games/OrderedPairOmok";
import AssignContentButton from "@/components/content/AssignContentButton";
import PlayBreadcrumb from "@/components/content/PlayBreadcrumb";
import { getContent } from "@/lib/contents";
import { fetchTeacherAssignContext } from "@/lib/teacher-classes";

const CONTENT_KEY = "g1-u2-3-ordered-pair-omok";

export const metadata: Metadata = {
  title: "순서쌍 오목 | 수학하는 즐거움",
  description:
    "좌표평면에서 순서쌍 (x, y)만으로 오목을 두는 게임. 중1 2.3 좌표평면과 그래프. 학급 배정 시 XP와 랭킹이 쌓입니다.",
};

export default async function OrderedPairOmokPage() {
  const content = getContent(CONTENT_KEY);
  const assignCtx = await fetchTeacherAssignContext([CONTENT_KEY]);

  return (
    <div className="space-y-4">
      <PlayBreadcrumb
        contentTitle={content?.title}
        gradeHref="/grade/1"
        gradeLabel="중1"
        unitHref="/grade/1/g1-2-3"
        unitLabel="2.3 좌표평면과 그래프"
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

      <OrderedPairOmok />
    </div>
  );
}
