import type { Metadata } from "next";
import TrigoSlash from "@/components/games/TrigoSlash";
import AssignContentButton from "@/components/content/AssignContentButton";
import PlayBreadcrumb from "@/components/content/PlayBreadcrumb";
import { getContent } from "@/lib/contents";
import { fetchTeacherAssignContext } from "@/lib/teacher-classes";

const CONTENT_KEY = "g3-u3-1-trigo-slash";

export const metadata: Metadata = {
  title: "삼각비 슬래시 | 수학하는 즐거움",
  description:
    "돌아가거나 뒤집힌 직각삼각형에서 기준각의 높이·밑변·빗변을 스와이프로 베어 삼각비를 익히는 게임. 중3 3.1 삼각비. 학급 배정 시 XP와 랭킹이 쌓입니다.",
};

export default async function TrigoSlashPage() {
  const content = getContent(CONTENT_KEY);
  const assignCtx = await fetchTeacherAssignContext([CONTENT_KEY]);

  return (
    <div className="space-y-4">
      <PlayBreadcrumb
        contentTitle={content?.title}
        gradeHref="/grade/3"
        gradeLabel="중3"
        unitHref="/grade/3/g3-3-1"
        unitLabel="3.1 삼각비"
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

      <TrigoSlash />
    </div>
  );
}
