import type { Metadata } from "next";
import SignSlimeRaid from "@/components/games/SignSlimeRaid";
import AssignContentButton from "@/components/content/AssignContentButton";
import PlayBreadcrumb from "@/components/content/PlayBreadcrumb";
import { getContent } from "@/lib/contents";
import { fetchTeacherAssignContext } from "@/lib/teacher-classes";

const CONTENT_KEY = "g1-u1-2-sign-slime";

export const metadata: Metadata = {
  title: "부호 슬라임 대소동 | 수학하는 즐거움",
  description:
    "슬라임의 수식을 맞춰 수정구슬로 공격! 6가지 연산 단계를 골라 정수·유리수 사칙연산을 연습하는 게임. 학급 배정 시 XP와 랭킹이 쌓입니다.",
};

export default async function SignSlimePage() {
  const content = getContent(CONTENT_KEY);
  const assignCtx = await fetchTeacherAssignContext([CONTENT_KEY]);

  return (
    <div className="space-y-4">
      <PlayBreadcrumb
        contentTitle={content?.title}
        gradeLabel="중1"
        unitLabel="1.2 정수와 유리수"
        gradeHref="/grade/1"
        unitHref="/grade/1/g1-1-2"
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

      <SignSlimeRaid />
    </div>
  );
}
