import type { Metadata } from "next";
import AlkagiGame from "@/components/games/AlkagiGame";
import PlayBreadcrumb from "@/components/content/PlayBreadcrumb";
import { getContent } from "@/lib/contents";
import TeacherAssignSlot from "@/components/content/TeacherAssignSlot";

const CONTENT_KEY = "g2-u2-4-slope-alkagi";

export const metadata: Metadata = {
  title: "기울기 알까기 | 수학하는 즐거움",
  description:
    "일차함수의 기울기와 발사 파워를 조절하여 상대 바둑알을 밀쳐내는 1:1 알까기 게임. 중2 2.4 일차함수와 그래프. 학급 배정 시 XP와 랭킹이 쌓입니다.",
};

export default async function AlkagiPage() {
  const content = getContent(CONTENT_KEY);

  return (
    <div className="space-y-4">
      <PlayBreadcrumb
        contentTitle={content?.title ?? "기울기 알까기"}
        gradeHref="/grade/2"
        gradeLabel="중2"
        unitHref="/grade/2/g2-2-4"
        unitLabel="2.4. 일차함수와 그래프"
        assignSlot={<TeacherAssignSlot contentKey={CONTENT_KEY} />}
      />

      <AlkagiGame />
    </div>
  );
}
