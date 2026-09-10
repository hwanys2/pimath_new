import type { Metadata } from "next";
import StarlightSeal from "@/components/games/StarlightSeal";
import PlayBreadcrumb from "@/components/content/PlayBreadcrumb";
import { getContent } from "@/lib/contents";
import TeacherAssignSlot from "@/components/content/TeacherAssignSlot";

const CONTENT_KEY = "g3-u3-2-starlight-seal";

export const metadata: Metadata = {
  title: "결계 수리공 별빛: 현과 접선 | 수학하는 즐거움",
  description:
    "무너진 마법진을 고치세요. 현·접선 성질로 값을 계산해 12개 봉인을 잠그는 게임. 중3 3.2 원의 성질. 학급 배정 시 XP와 랭킹이 쌓입니다.",
};

export default async function StarlightSealPage() {
  const content = getContent(CONTENT_KEY);

  return (
    <div className="space-y-4">
      <PlayBreadcrumb
        contentTitle={content?.title}
        gradeHref="/grade/3"
        gradeLabel="중3"
        unitHref="/grade/3/g3-3-2"
        unitLabel="3.2 원의 성질"
        assignSlot={<TeacherAssignSlot contentKey={CONTENT_KEY} />}
      />

      <StarlightSeal />
    </div>
  );
}
