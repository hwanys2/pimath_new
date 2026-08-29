import type { Metadata } from "next";
import FactorRain from "@/components/games/FactorRain";
import PlayBreadcrumb from "@/components/content/PlayBreadcrumb";
import { getContent } from "@/lib/contents";
import TeacherAssignSlot from "@/components/content/TeacherAssignSlot";

const CONTENT_KEY = "g1-u1-1-factor-rain";

export const metadata: Metadata = {
  title: "소인수분해 소나기 | 수학하는 즐거움",
  description:
    "떨어지는 숫자를 소수(2~19)로 나눠 1까지 소인수분해하는 게임. 학급 배정 시 XP와 랭킹이 쌓입니다.",
};

export default async function FactorRainPage() {
  const content = getContent(CONTENT_KEY);

  return (
    <div className="space-y-4">
      <PlayBreadcrumb
        contentTitle={content?.title}
        assignSlot={<TeacherAssignSlot contentKey={CONTENT_KEY} />}
      />

      <FactorRain />
    </div>
  );
}
