import type { Metadata } from "next";
import StarlightSlingshot from "@/components/games/StarlightSlingshot";
import PlayBreadcrumb from "@/components/content/PlayBreadcrumb";
import { getContent } from "@/lib/contents";
import TeacherAssignSlot from "@/components/content/TeacherAssignSlot";

const CONTENT_KEY = "g3-u3-2-starlight-slingshot";

export const metadata: Metadata = {
  title: "별빛 호수: 원주각 슬링샷 | 수학하는 즐거움",
  description:
    "별빛 호수에서 원주각의 성질(동일 호 각도 불변·지름 90° 직각·중심각 2배·내접 180°)로 슬링샷을 조준해 슬라임을 정화하는 캐주얼 아케이드 게임. 중3 3.2 원의 성질.",
};

export default async function StarlightSlingshotPage() {
  const content = getContent(CONTENT_KEY);

  return (
    <div className="space-y-4">
      <PlayBreadcrumb
        contentTitle={content?.title ?? "별빛 호수: 원주각 슬링샷"}
        gradeHref="/grade/3"
        gradeLabel="중3"
        unitHref="/grade/3/g3-3-2"
        unitLabel="3.2 원의 성질"
        assignSlot={<TeacherAssignSlot contentKey={CONTENT_KEY} />}
      />

      <StarlightSlingshot />
    </div>
  );
}
