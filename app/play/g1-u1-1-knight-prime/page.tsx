import type { Metadata } from "next";
import KnightPrime from "@/components/games/KnightPrime";
import PlayBreadcrumb from "@/components/content/PlayBreadcrumb";
import { getContent } from "@/lib/contents";
import TeacherAssignSlot from "@/components/content/TeacherAssignSlot";

const CONTENT_KEY = "g1-u1-1-knight-prime";

export const metadata: Metadata = {
  title: "나이트 프라임 | 수학하는 즐거움",
  description:
    "체스 나이트처럼 L자로 움직이며 소수를 밟아 점수를 모으는 게임. 학급 배정 시 XP와 랭킹이 쌓입니다.",
};

export default async function KnightPrimePage() {
  const content = getContent(CONTENT_KEY);

  return (
    <div className="space-y-4">
      <PlayBreadcrumb
        contentTitle={content?.title}
        assignSlot={<TeacherAssignSlot contentKey={CONTENT_KEY} />}
      />

      <KnightPrime />
    </div>
  );
}
