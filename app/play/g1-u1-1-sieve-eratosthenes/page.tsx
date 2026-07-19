import type { Metadata } from "next";
import SieveEratosthenes from "@/components/sims/SieveEratosthenes";
import AssignContentButton from "@/components/content/AssignContentButton";
import PlayBreadcrumb from "@/components/content/PlayBreadcrumb";
import { getContent } from "@/lib/contents";
import { fetchTeacherAssignContext } from "@/lib/teacher-classes";

const CONTENT_KEY = "g1-u1-1-sieve-eratosthenes";

export const metadata: Metadata = {
  title: "에라토스테네스의 체 | 수학하는 즐거움",
  description:
    "배수를 지워 가며 소수를 찾아보는 시뮬레이션. 점수는 없고 개념 탐구용입니다.",
};

export default async function SieveEratosthenesPage() {
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

      <SieveEratosthenes />
    </div>
  );
}
