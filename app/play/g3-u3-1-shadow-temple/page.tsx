import type { Metadata } from "next";
import ShadowTemple from "@/components/games/ShadowTemple";
import PlayBreadcrumb from "@/components/content/PlayBreadcrumb";
import { getContent } from "@/lib/contents";
import TeacherAssignSlot from "@/components/content/TeacherAssignSlot";

const CONTENT_KEY = "g3-u3-1-shadow-temple";

export const metadata: Metadata = {
  title: "그림자 신전: 여섯 개의 시련 | 수학하는 즐거움",
  description:
    "고대 신전에 갇혔다! 단서를 조사하고 삼각비로 여섯 개의 방을 풀어 15분 안에 탈출하는 방탈출 게임. 중3 3.1 삼각비. 학급 배정 시 XP와 랭킹이 쌓입니다.",
};

export default async function ShadowTemplePage() {
  const content = getContent(CONTENT_KEY);

  return (
    <div className="space-y-4">
      <PlayBreadcrumb
        contentTitle={content?.title}
        gradeHref="/grade/3"
        gradeLabel="중3"
        unitHref="/grade/3/g3-3-1"
        unitLabel="3.1 삼각비"
        assignSlot={<TeacherAssignSlot contentKey={CONTENT_KEY} />}
      />

      <ShadowTemple />
    </div>
  );
}
