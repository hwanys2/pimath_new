import type { Metadata } from "next";
import ArcReactor from "@/components/games/ArcReactor";
import PlayBreadcrumb from "@/components/content/PlayBreadcrumb";
import { getContent } from "@/lib/contents";
import TeacherAssignSlot from "@/components/content/TeacherAssignSlot";

const CONTENT_KEY = "g3-u3-2-arc-reactor";

export const metadata: Metadata = {
  title: "아크 리액터: 네온 오비탈 | 수학하는 즐거움",
  description:
    "원형 입자가속기에서 원주각의 4대 법칙(각도 불변·탈레스 90°·중심각 2배·내접 180°)을 광학 무기로 발동해 다크 매터를 분쇄하는 네온 아케이드 액션 게임. 중3 3.2 원의 성질.",
};

export default async function ArcReactorPage() {
  const content = getContent(CONTENT_KEY);

  return (
    <div className="space-y-4">
      <PlayBreadcrumb
        contentTitle={content?.title ?? "아크 리액터: 네온 오비탈"}
        gradeHref="/grade/3"
        gradeLabel="중3"
        unitHref="/grade/3/g3-3-2"
        unitLabel="3.2 원의 성질"
        assignSlot={<TeacherAssignSlot contentKey={CONTENT_KEY} />}
      />

      <ArcReactor />
    </div>
  );
}
