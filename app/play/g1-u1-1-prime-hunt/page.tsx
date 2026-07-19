import type { Metadata } from "next";
import PrimeHunt from "@/components/games/PrimeHunt";
import AssignContentButton from "@/components/content/AssignContentButton";
import PlayBreadcrumb from "@/components/content/PlayBreadcrumb";
import { getContent } from "@/lib/contents";
import { fetchTeacherAssignContext } from "@/lib/teacher-classes";

const CONTENT_KEY = "g1-u1-1-prime-hunt";

export const metadata: Metadata = {
  title: "소수 찾기 | 수학하는 즐거움",
  description:
    "제곱근 이하 소수로 나눠 보며 소수인지 판정하는 게임. 학급 배정 시 XP와 랭킹이 쌓입니다.",
};

export default async function PrimeHuntPage() {
  const content = getContent(CONTENT_KEY);
  const assignCtx = await fetchTeacherAssignContext([CONTENT_KEY]);

  return (
    <div className="space-y-4">
      <PlayBreadcrumb
        contentTitle={content?.title}
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

      <PrimeHunt />
    </div>
  );
}
