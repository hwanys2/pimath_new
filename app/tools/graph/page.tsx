import type { Metadata } from "next";
import Link from "next/link";
import { getActor, redirectStudentToAdventure } from "@/lib/auth";
import { graphListTeacherSessions } from "@/lib/graph-explorer";
import CreateRoomClient from "@/components/tools/graph/CreateRoomClient";
import RoomListClient from "@/components/tools/graph/RoomListClient";
import GraphAnonResume from "@/components/tools/graph/GraphAnonResume";

export const metadata: Metadata = {
  title: "그래프 탐구 | 수학하는 즐거움",
  description:
    "학생들이 제출한 순서쌍이 모여 함수 그래프의 개형이 드러나는 탐구 수업 도구",
};

export default async function GraphToolPage() {
  const actor = await getActor();
  await redirectStudentToAdventure(actor);

  const isTeacher = actor?.type === "teacher";
  const sessions = isTeacher ? await graphListTeacherSessions() : null;
  const roomList = sessions && !("error" in sessions) ? sessions : [];

  return (
    <div className="space-y-8">
      <header className="text-center">
        <h1 className="font-display text-3xl text-wood-dark sm:text-4xl">
          📈 그래프 탐구
        </h1>
        <p className="mx-auto mt-2 max-w-2xl text-foreground/70">
          함수식을 만족하는 순서쌍을 학생들이 제출하면, 좌표평면에 점이 모여
          그래프의 개형이 드러나요.
        </p>
      </header>

      {isTeacher ? (
        <>
          <CreateRoomClient mode="auth" />
          <section className="space-y-4">
            <h2 className="font-display text-xl text-wood-dark">내 방 목록</h2>
            <RoomListClient sessions={roomList} />
          </section>
        </>
      ) : (
        <>
          <GraphAnonResume />
          <CreateRoomClient mode="anon" />
          <div className="text-center">
            <Link
              href="/tools/graph/join"
              className="font-display inline-block rounded-xl bg-wood px-4 py-2.5 text-sm text-cream"
            >
              학생으로 참가하기
            </Link>
            <p className="mt-3 text-xs text-foreground/50">
              로그인하면 방 기록이 저장돼요.{" "}
              <Link href="/login/teacher" className="underline">
                교사 로그인
              </Link>
            </p>
          </div>
        </>
      )}
    </div>
  );
}
