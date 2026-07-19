import Image from "next/image";
import Link from "next/link";
import HeroBanner from "@/components/HeroBanner";
import QuestCard from "@/components/QuestCard";
import { GRADES } from "@/lib/grades";
import { redirectStudentToAdventure } from "@/lib/auth";

export default async function HomePage() {
  await redirectStudentToAdventure();

  return (
    <div className="space-y-10">
      <HeroBanner />

      <section>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-wood">퀘스트 선택</p>
            <h2 className="font-display text-2xl text-foreground sm:text-3xl">
              학년별 모험 맵
            </h2>
          </div>
          <p className="text-sm text-foreground/60">
            원하는 학년을 골라 미션을 시작해 보세요
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {GRADES.map((grade) => (
            <QuestCard key={grade.id} grade={grade} />
          ))}
        </div>
      </section>

      <section className="quest-card grid gap-6 p-6 sm:grid-cols-[auto_1fr] sm:items-center sm:p-8">
        <div className="relative h-16 w-16">
          <Image
            src="/images/mascot-v2.png"
            alt="파이"
            fill
            className="object-contain"
            sizes="64px"
          />
        </div>
        <div>
          <h2 className="font-display text-xl sm:text-2xl">
            레벨 업 & 캐릭터 육성
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-foreground/70 sm:text-base">
            학생으로 로그인하면 미션 XP로 파이가 성장하고, 초원·언덕·별빛
            동료를 해금할 수 있어요. 한 판 만점 기준은 1000점!
          </p>
          <Link
            href="/login/student"
            className="mt-3 inline-flex font-display text-sm font-bold text-wood underline-offset-2 hover:underline"
          >
            학생 로그인 →
          </Link>
        </div>
      </section>
    </div>
  );
}
