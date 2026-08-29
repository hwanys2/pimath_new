import type { Metadata } from "next";
import SquareMaker from "@/components/games/SquareMaker";
import PlayBreadcrumb from "@/components/content/PlayBreadcrumb";
import { getContent } from "@/lib/contents";
import TeacherAssignSlot from "@/components/content/TeacherAssignSlot";

const CONTENT_KEY = "g3-u1-square-maker";

export const metadata: Metadata = {
  title: "정사각형 만들기 | 수학하는 즐거움",
  description:
    "가위바위보로 선공을 정하고, 격자에 돌을 두어 먼저 정사각형을 완성하는 게임. 중3 1. 제곱근과 실수. 학급 배정 시 XP와 랭킹이 쌓입니다.",
};

export default async function SquareMakerPage() {
  const content = getContent(CONTENT_KEY);

  return (
    <div className="space-y-4">
      <PlayBreadcrumb
        contentTitle={content?.title}
        gradeHref="/grade/3"
        gradeLabel="중3"
        unitHref="/grade/3/g3-1"
        unitLabel="1. 제곱근과 실수"
        assignSlot={<TeacherAssignSlot contentKey={CONTENT_KEY} />}
      />

      <SquareMaker />
    </div>
  );
}
