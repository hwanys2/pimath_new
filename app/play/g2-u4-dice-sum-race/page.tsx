import type { Metadata } from "next";
import AssignContentButton from "@/components/content/AssignContentButton";
import PlayBreadcrumb from "@/components/content/PlayBreadcrumb";
import DiceSumRace from "@/components/games/DiceSumRace";
import { getActor } from "@/lib/auth";
import { getContent } from "@/lib/contents";
import { fetchTeacherAssignContext } from "@/lib/teacher-classes";

const CONTENT_KEY = "g2-u4-dice-sum-race";

export const metadata: Metadata = {
  title: "주사위 합 10번 채우기 | 수학하는 즐거움",
  description:
    "교사가 주사위 2개를 굴리며 2~12 합 칸을 채우는 확률 게임. 중2 4. 경우의 수와 확률. 학급 배정 시 XP와 랭킹이 쌓입니다.",
};

export default async function DiceSumRacePage() {
  const content = getContent(CONTENT_KEY);
  const assignCtx = await fetchTeacherAssignContext([CONTENT_KEY]);
  const actor = await getActor();

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
              assignedClassIds={
                assignCtx.assignedByContent[CONTENT_KEY] ?? []
              }
            />
          ) : null
        }
      />

      <DiceSumRace
        actorType={actor?.type ?? null}
        teacherClasses={assignCtx?.classes ?? []}
        studentClassId={
          actor?.type === "student" ? actor.classId : null
        }
        studentClassName={
          actor?.type === "student" ? actor.className : null
        }
        studentName={actor?.type === "student" ? actor.name : null}
      />
    </div>
  );
}
