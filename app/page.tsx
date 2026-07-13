import HeroBanner from "@/components/HeroBanner";
import QuestCard from "@/components/QuestCard";
import { GRADES } from "@/lib/grades";

export default function HomePage() {
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
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gold text-3xl shadow-[0_4px_0_rgba(0,0,0,0.15)]">
          🏆
        </div>
        <div>
          <h2 className="font-display text-xl sm:text-2xl">
            레벨 업 & 배지 시스템 준비 중!
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-foreground/70 sm:text-base">
            곧 미션을 클리어하면 경험치와 배지를 모을 수 있어요.
            시뮬레이션·게임 콘텐츠가 하나씩 추가될 예정이니 기대해 주세요!
          </p>
        </div>
      </section>
    </div>
  );
}
