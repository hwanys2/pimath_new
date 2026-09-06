import type { Metadata } from "next";
import TrigoBeat from "@/components/games/TrigoBeat";
import PlayBreadcrumb from "@/components/content/PlayBreadcrumb";
import { getContent } from "@/lib/contents";
import TeacherAssignSlot from "@/components/content/TeacherAssignSlot";

const CONTENT_KEY = "g3-u3-1-trigo-beat";

export const metadata: Metadata = {
  title: "특수각 비트 탭 | 수학하는 즐거움",
  description:
    "0°부터 90°까지! 비트에 맞춰 직관적인 크기 순 패드를 탭해 특수각 삼각비를 뇌에 새기는 리듬 아케이드 게임. 중3 3.1 삼각비. 학급 배정 시 XP와 랭킹이 쌓입니다.",
};

export default async function TrigoBeatPage() {
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

      <TrigoBeat />
    </div>
  );
}
