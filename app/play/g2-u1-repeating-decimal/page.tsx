import type { Metadata } from "next";
import RepeatingDecimal from "@/components/sims/RepeatingDecimal";
import AssignContentButton from "@/components/content/AssignContentButton";
import PlayBreadcrumb from "@/components/content/PlayBreadcrumb";
import { getContent } from "@/lib/contents";
import { fetchTeacherAssignContext } from "@/lib/teacher-classes";

const CONTENT_KEY = "g2-u1-repeating-decimal";

export const metadata: Metadata = {
  title: "분수를 순환소수로 | 수학하는 즐거움",
  description:
    "분자·분모를 넣으면 소수로 바꾸고, 순환마디 길이와 한국식 순환 표기를 보여 주는 시뮬레이션. 중2 1. 유리수와 순환소수. 점수는 없고 개념 탐구용입니다.",
};

export default async function RepeatingDecimalPage() {
  const content = getContent(CONTENT_KEY);
  const assignCtx = await fetchTeacherAssignContext([CONTENT_KEY]);

  return (
    <div className="space-y-4">
      <PlayBreadcrumb
        contentTitle={content?.title}
        gradeHref="/grade/2"
        gradeLabel="중2"
        unitHref="/grade/2/g2-1"
        unitLabel="1. 유리수와 순환소수"
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

      <RepeatingDecimal />
    </div>
  );
}
