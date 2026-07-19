import type { Metadata } from "next";
import Link from "next/link";
import FactorRain from "@/components/games/FactorRain";
import AssignContentButton from "@/components/content/AssignContentButton";
import { getContent } from "@/lib/contents";
import { fetchTeacherAssignContext } from "@/lib/teacher-classes";

const CONTENT_KEY = "g1-u1-1-factor-rain";

export const metadata: Metadata = {
  title: "소인수분해 소나기 | 수학하는 즐거움",
  description:
    "떨어지는 숫자를 소수(2~19)로 나눠 1까지 소인수분해하는 게임. 학급 배정 시 XP와 랭킹이 쌓입니다.",
};

export default async function FactorRainPage() {
  const content = getContent(CONTENT_KEY);
  const assignCtx = await fetchTeacherAssignContext([CONTENT_KEY]);

  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap items-center gap-3 text-sm font-semibold text-wood/70">
        <Link href="/" className="underline-offset-2 hover:underline">
          홈
        </Link>
        <span aria-hidden>/</span>
        <Link href="/grade/1" className="underline-offset-2 hover:underline">
          중1
        </Link>
        <span aria-hidden>/</span>
        <Link
          href="/grade/1/g1-1-1"
          className="underline-offset-2 hover:underline"
        >
          1.1 소인수분해
        </Link>
        {content ? (
          <>
            <span aria-hidden>/</span>
            <span className="text-foreground/60">{content.title}</span>
          </>
        ) : null}
        {assignCtx ? (
          <span className="ml-auto">
            <AssignContentButton
              contentKey={CONTENT_KEY}
              classes={assignCtx.classes}
              assignedClassIds={
                assignCtx.assignedByContent[CONTENT_KEY] ?? []
              }
            />
          </span>
        ) : null}
      </nav>

      <FactorRain />
    </div>
  );
}
