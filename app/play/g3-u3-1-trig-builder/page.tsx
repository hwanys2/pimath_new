import type { Metadata } from "next";
import TrigBuilder from "@/components/games/TrigBuilder";
import PlayBreadcrumb from "@/components/content/PlayBreadcrumb";
import { getContent } from "@/lib/contents";
import TeacherAssignSlot from "@/components/content/TeacherAssignSlot";

const CONTENT_KEY = "g3-u3-1-trig-builder";

export const metadata: Metadata = {
  title: "삼각비 다리 놓기 | 수학하는 즐거움",
  description:
    "직각삼각형에서 한 변과 한 각이 주어졌을 때, 미지의 변을 sin·cos·tan 수식 블록으로 조립해 다리를 잇는 게임. 중3 3.1 삼각비. 학급 배정 시 XP와 랭킹이 쌓입니다.",
};

export default async function TrigBuilderPage() {
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

      <TrigBuilder />
    </div>
  );
}
