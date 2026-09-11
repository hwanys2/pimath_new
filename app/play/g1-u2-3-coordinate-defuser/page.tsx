import type { Metadata } from "next";
import CoordinateDefuser from "@/components/games/CoordinateDefuser";
import PlayBreadcrumb from "@/components/content/PlayBreadcrumb";
import { getContent } from "@/lib/contents";
import TeacherAssignSlot from "@/components/content/TeacherAssignSlot";

const CONTENT_KEY = "g1-u2-3-coordinate-defuser";

export const metadata: Metadata = {
  title: "좌표 폭탄 해체반 | 수학하는 즐거움",
  description:
    "좌표평면에 출현한 시한폭탄의 순서쌍 (x, y)을 빠르게 입력해 펑! 터뜨려 해체하는 디펜스 게임. 학급 배정 시 XP와 랭킹이 쌓입니다.",
};

export default async function CoordinateDefuserPage() {
  const content = getContent(CONTENT_KEY);

  return (
    <div className="space-y-4">
      <PlayBreadcrumb
        contentTitle={content?.title}
        gradeLabel="중1"
        unitLabel="2.3 좌표평면과 그래프"
        gradeHref="/grade/1"
        unitHref="/grade/1/g1-2-3"
        assignSlot={<TeacherAssignSlot contentKey={CONTENT_KEY} />}
      />

      <CoordinateDefuser />
    </div>
  );
}
