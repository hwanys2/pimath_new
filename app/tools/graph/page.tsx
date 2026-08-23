import type { Metadata } from "next";
import Link from "next/link";
import { getActor, redirectStudentToAdventure } from "@/lib/auth";
import { graphFindMyActive } from "@/lib/graph-explorer";
import CreateRoomClient from "@/components/tools/graph/CreateRoomClient";

export const metadata: Metadata = {
  title: "그래프 탐구 | 수학하는 즐거움",
  description:
    "학생들이 제출한 순서쌍이 모여 함수 그래프의 개형이 드러나는 탐구 수업 도구",
};

export default async function GraphToolPage() {
  const actor = await getActor();
  await redirectStudentToAdventure(actor);

  const isTeacher = actor?.type === "teacher";
  const active = isTeacher ? await graphFindMyActive() : { sessionId: null };

  return (
    <div className="space-y-8">
      <header className="text-center">
        <h1 className="font-display text-3xl text-wood-dark sm:text-4xl">
          📈 그래프 탐구
        </h1>
        <p className="mx-auto mt-2 max-w-2xl text-foreground/70">
          함수식을 만족하는 순서쌍을 학생들이 하나씩 제출하면, 커다란
          좌표평면에 점이 실시간으로 모여요. 점이 충분히 모이면{" "}
          <b>그래프의 개형</b>이 스스로 드러나요!
        </p>
      </header>

      <div className="mx-auto grid max-w-3xl gap-3 sm:grid-cols-3">
        {[
          ["1", "교사가 함수식으로 방을 만들어요"],
          ["2", "학생들은 QR을 찍고 이름만 적고 들어와요"],
          ["3", "순서쌍이 모여 그래프 개형이 나타나요"],
        ].map(([n, text]) => (
          <div
            key={n}
            className="rounded-2xl border-2 border-wood/10 bg-cream p-4 text-center"
          >
            <span className="font-display inline-flex h-8 w-8 items-center justify-center rounded-full bg-gold text-[#6b4a00]">
              {n}
            </span>
            <p className="mt-2 text-sm text-foreground/75">{text}</p>
          </div>
        ))}
      </div>

      {isTeacher ? (
        <CreateRoomClient activeSessionId={active.sessionId} />
      ) : (
        <div className="mx-auto max-w-md space-y-4 rounded-3xl border-2 border-wood/15 bg-cream p-8 text-center">
          <p className="font-display text-lg text-wood-dark">
            방 만들기는 교사 로그인이 필요해요
          </p>
          <p className="text-sm text-foreground/70">
            학생이라면 선생님이 보여주는 QR코드를 찍거나, 참가코드로
            입장하세요.
          </p>
          <div className="flex justify-center gap-3">
            <Link
              href="/login/teacher"
              className="font-display rounded-xl bg-gold px-4 py-2.5 text-sm text-[#6b4a00] shadow-[0_3px_0_rgba(107,74,0,0.3)] transition hover:brightness-105"
            >
              교사 로그인
            </Link>
            <Link
              href="/tools/graph/join"
              className="font-display rounded-xl bg-wood px-4 py-2.5 text-sm text-cream transition hover:brightness-110"
            >
              참가코드로 입장
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
