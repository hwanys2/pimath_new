import type { Metadata } from "next";
import AssignContentButton from "@/components/content/AssignContentButton";
import PlayBreadcrumb from "@/components/content/PlayBreadcrumb";
import BallBoxGuess from "@/components/games/BallBoxGuess";
import { getActor } from "@/lib/auth";
import { getContent } from "@/lib/contents";
import { fetchTeacherAssignContext } from "@/lib/teacher-classes";

const CONTENT_KEY = "g2-u4-ball-box-guess";

export const metadata: Metadata = {
  title: "상자 속 공 개수 맞히기 | 수학하는 즐거움",
  description:
    "교사가 숨긴 색깔 공 상자에서 복원추출로 뽑으며 색깔별 개수를 추정해 맞히는 확률 게임. 중2 4. 경우의 수와 확률. 학급 배정 시 XP와 랭킹이 쌓입니다.",
};

export default async function BallBoxGuessPage({
  searchParams,
}: {
  searchParams: Promise<{ join?: string }>;
}) {
  const content = getContent(CONTENT_KEY);
  const assignCtx = await fetchTeacherAssignContext([CONTENT_KEY]);
  const actor = await getActor();

  const { join } = await searchParams;
  const joinCode = typeof join === "string" ? join.trim() : null;
  // Not logged in + a join code => guest (QR) mode.
  const guestMode = Boolean(joinCode) && actor == null;

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

      <BallBoxGuess
        actorType={actor?.type ?? null}
        teacherClasses={assignCtx?.classes ?? []}
        studentClassId={actor?.type === "student" ? actor.classId : null}
        studentClassName={actor?.type === "student" ? actor.className : null}
        studentName={actor?.type === "student" ? actor.name : null}
        guestMode={guestMode}
        joinCode={joinCode}
      />
    </div>
  );
}
