"use client";

import Link from "next/link";
import BlockButton from "@/components/BlockButton";
import { useActor } from "@/components/auth/ActorProvider";

export default function NotFoundActions() {
  const { actor } = useActor();
  const homeHref = actor?.type === "student" ? "/adventure" : "/";
  const homeLabel =
    actor?.type === "student" ? "나의 모험으로 돌아가기" : "홈으로 돌아가기";
  const hint =
    actor?.type === "student"
      ? "나의 모험으로 돌아가 다시 선택해 주세요."
      : "홈으로 돌아가 다시 선택해 주세요.";

  return (
    <>
      <p className="mt-2 text-sm text-foreground/70">
        존재하지 않는 모험 맵입니다. {hint}
      </p>
      <div className="mt-6 flex justify-center">
        <BlockButton href={homeHref} variant="gold">
          {homeLabel}
        </BlockButton>
      </div>
      <p className="mt-4 text-xs text-foreground/40">
        <Link href={homeHref}>또는 여기를 클릭</Link>
      </p>
    </>
  );
}
