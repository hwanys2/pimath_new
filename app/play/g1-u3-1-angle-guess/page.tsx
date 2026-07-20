import type { Metadata } from "next";
import AngleGuess from "@/components/games/AngleGuess";
import AssignContentButton from "@/components/content/AssignContentButton";
import PlayBreadcrumb from "@/components/content/PlayBreadcrumb";
import { getContent } from "@/lib/contents";
import { fetchTeacherAssignContext } from "@/lib/teacher-classes";

const CONTENT_KEY = "g1-u3-1-angle-guess";

export const metadata: Metadata = {
  title: "각도 맞히기 | 수학하는 즐거움",
  description:
    "벌어지는 각의 크기를 맞히는 게임. 30→10→5→1도 간격으로 승급. 중1 3.1 기본도형. 학급 배정 시 XP와 랭킹이 쌓입니다.",
};

export default async function AngleGuessPage() {
  const content = getContent(CONTENT_KEY);
  const assignCtx = await fetchTeacherAssignContext([CONTENT_KEY]);

  return (
    <div className="space-y-4">
      <PlayBreadcrumb
        contentTitle={content?.title}
        gradeHref="/grade/1"
        gradeLabel="중1"
        unitHref="/grade/1/g1-3-1"
        unitLabel="3.1 기본도형"
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

      <AngleGuess />
    </div>
  );
}
