import HeroBanner from "@/components/HeroBanner";
import QuestCard from "@/components/QuestCard";
import HallOfFamePreview from "@/components/hall-of-fame/HallOfFamePreview";
import { GRADES } from "@/lib/grades";
import { fetchHofBoard } from "@/lib/hall-of-fame";

export const revalidate = 3600;

export default async function HomePage() {
  const hof = await fetchHofBoard({ tab: "world", sessionToken: null });

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

      <HallOfFamePreview board={hof} showStudentLoginCta />
    </div>
  );
}
