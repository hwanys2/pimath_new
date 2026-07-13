import Image from "next/image";
import { notFound } from "next/navigation";
import BlockButton from "@/components/BlockButton";
import { getGrade, isValidGrade, GRADES } from "@/lib/grades";

type Props = {
  params: Promise<{ grade: string }>;
};

export function generateStaticParams() {
  return GRADES.map((g) => ({ grade: String(g.id) }));
}

export async function generateMetadata({ params }: Props) {
  const { grade: gradeParam } = await params;
  const id = Number(gradeParam);
  const grade = getGrade(id);
  if (!grade) return { title: "학년 없음" };
  return {
    title: `${grade.label} · ${grade.title} | 수학하는 즐거움`,
    description: grade.description,
  };
}

export default async function GradePage({ params }: Props) {
  const { grade: gradeParam } = await params;
  const id = Number(gradeParam);

  if (!isValidGrade(id)) notFound();

  const grade = getGrade(id)!;

  return (
    <div className="space-y-8">
      <section
        className={`quest-card overflow-hidden bg-gradient-to-br ${grade.accentClass}`}
      >
        <div className="grid items-center gap-6 p-6 sm:grid-cols-[1fr_auto] sm:p-8">
          <div>
            <span className="badge-pill">{grade.badge}</span>
            <h1 className="font-display mt-3 text-3xl sm:text-4xl">
              {grade.label} · {grade.title}
            </h1>
            <p className="mt-2 text-base font-semibold text-foreground/70">
              {grade.subtitle}
            </p>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-foreground/75 sm:text-base">
              {grade.description}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <BlockButton href="/" variant="sky" size="sm">
                ← 홈으로
              </BlockButton>
              <BlockButton variant={grade.theme} size="sm" className="opacity-80">
                첫 미션 준비중
              </BlockButton>
            </div>
          </div>
          <Image
            src={grade.character}
            alt={`${grade.label} 캐릭터`}
            width={200}
            height={200}
            className="mx-auto h-40 w-40 object-contain drop-shadow-xl sm:h-48 sm:w-48"
            priority
          />
        </div>
      </section>

      <section>
        <div className="mb-4">
          <p className="text-sm font-bold text-wood">퀘스트 보드</p>
          <h2 className="font-display text-2xl">미션 목록</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {grade.questPreview.map((quest, index) => {
            const locked = quest.includes("준비중");
            return (
              <div
                key={quest}
                className={`coming-soon-slot flex flex-col gap-3 p-5 ${
                  locked ? "opacity-80" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-lg text-foreground">
                    미션 {index + 1}
                  </span>
                  <span className="rounded-full bg-wood/10 px-2.5 py-0.5 text-xs font-bold text-wood">
                    {locked ? "잠김" : "오픈 예정"}
                  </span>
                </div>
                <p className="font-medium text-foreground/80">{quest}</p>
                <p className="text-xs text-foreground/50">
                  시뮬레이션 · 게임 콘텐츠가 곧 추가됩니다
                </p>
              </div>
            );
          })}

          <div className="coming-soon-slot flex flex-col items-center justify-center gap-2 p-5 text-center">
            <span className="text-3xl" aria-hidden>
              ✨
            </span>
            <p className="font-display text-lg">더 많은 퀘스트</p>
            <p className="text-xs text-foreground/50">
              세부 메뉴와 프로그램이 차근차근 채워질 예정이에요
            </p>
          </div>
        </div>
      </section>

      <section className="quest-card p-6 sm:p-8">
        <h2 className="font-display text-xl">탐험가 현황 (미리보기)</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Stat label="클리어 미션" value="0" />
          <Stat label="획득 배지" value="0" />
          <Stat label="경험치" value={`${grade.xp} XP`} />
        </div>
        <div className="mt-4">
          <div className="mb-1.5 flex justify-between text-xs font-bold text-foreground/60">
            <span>다음 레벨까지</span>
            <span>{grade.xp}%</span>
          </div>
          <div className="xp-bar">
            <div className="xp-bar-fill" style={{ width: `${grade.xp}%` }} />
          </div>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-wood/5 px-4 py-3 text-center">
      <p className="text-xs font-bold text-foreground/50">{label}</p>
      <p className="font-display mt-1 text-2xl text-wood">{value}</p>
    </div>
  );
}
