import type { Metadata } from "next";
import RadicalFillQuiz from "@/components/games/RadicalFillQuiz";
import AssignContentButton from "@/components/content/AssignContentButton";
import PlayBreadcrumb from "@/components/content/PlayBreadcrumb";
import { getContent } from "@/lib/contents";
import { fetchTeacherAssignContext } from "@/lib/teacher-classes";

const CONTENT_KEY = "g3-u1-radical-fill";

export const metadata: Metadata = {
  title: "근호 빈칸 채우기 | 수학하는 즐거움",
  description:
    "서로 다른 수로 근호 식을 완성하는 중3 제곱근 게임. 10문제, 틀리면 재시도·오답 횟수에 따라 감점. 학급 배정 시 XP와 랭킹이 쌓입니다.",
};

export default async function RadicalFillPage() {
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

      <RadicalFillQuiz />
    </div>
  );
}
