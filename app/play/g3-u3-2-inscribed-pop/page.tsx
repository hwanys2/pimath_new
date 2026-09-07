import type { Metadata } from "next";
import InscribedPop from "@/components/games/InscribedPop";
import PlayBreadcrumb from "@/components/content/PlayBreadcrumb";
import { getContent } from "@/lib/contents";
import TeacherAssignSlot from "@/components/content/TeacherAssignSlot";

const CONTENT_KEY = "g3-u3-2-inscribed-pop";

export const metadata: Metadata = {
  title: "원주각 팡팡: 별빛 서클 핀볼 | 수학하는 즐거움",
  description:
    "원주에서 트윈 볼을 발사해 슬라임을 터뜨리는 원형 핀볼 아케이드 게임. 원주각의 성질을 직관적으로 체감하며 즐겨보세요!",
};

export default async function InscribedPopPage() {
  const content = getContent(CONTENT_KEY);

  return (
    <div className="space-y-4">
      <PlayBreadcrumb
        contentTitle={content?.title}
        assignSlot={<TeacherAssignSlot contentKey={CONTENT_KEY} />}
      />

      <InscribedPop />
    </div>
  );
}
