import type { Metadata } from "next";
import DiceSimulation from "@/components/sims/DiceSimulation";
import AssignContentButton from "@/components/content/AssignContentButton";
import PlayBreadcrumb from "@/components/content/PlayBreadcrumb";
import { getContent } from "@/lib/contents";
import { fetchTeacherAssignContext } from "@/lib/teacher-classes";

const CONTENT_KEY = "g2-u4-dice-simulation";

export const metadata: Metadata = {
  title: "주사위 확률 시뮬레이션 | 수학하는 즐거움",
  description:
    "일반 주사위와 직육면체 주사위(윗·아랫면 0.1, 옆면 0.2)를 굴리며 특정 눈의 상대도수가 이론적 확률에 수렴함(큰 수의 법칙)을 그래프로 확인하는 시뮬레이션. 중2 4. 경우의 수와 확률. 점수는 없고 개념 탐구용입니다.",
};

export default async function DiceSimulationPage() {
  const content = getContent(CONTENT_KEY);
  const assignCtx = await fetchTeacherAssignContext([CONTENT_KEY]);

  return (
    <div className="space-y-4">
      <PlayBreadcrumb
        contentTitle={content?.title}
        gradeHref="/grade/2"
        gradeLabel="중2"
        unitHref="/grade/2/g2-4"
        unitLabel="4. 경우의 수와 확률"
        assignSlot={
          assignCtx ? (
            <AssignContentButton
              contentKey={CONTENT_KEY}
              classes={assignCtx.classes}
              assignedClassIds={assignCtx.assignedByContent[CONTENT_KEY] ?? []}
            />
          ) : null
        }
      />

      <DiceSimulation />
    </div>
  );
}
