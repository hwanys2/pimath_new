import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import BlockButton from "@/components/BlockButton";
import { getGrade, isValidGrade, GRADES } from "@/lib/grades";
import { getUnitsForGrade, getUnitLabel } from "@/lib/curriculum";
import { getContentsForUnit } from "@/lib/contents";

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
  const units = getUnitsForGrade(id);

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
          <p className="text-sm font-bold text-wood">단원 목록</p>
          <h2 className="font-display text-2xl">커리큘럼</h2>
          <p className="mt-1 text-sm text-foreground/60">
            단원을 골라 시뮬레이션·게임을 열어 보세요. 공개 링크는 로그인 없이
            플레이할 수 있어요.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {units.map((unit) => {
            const contents = getContentsForUnit(unit.id);
            const readyCount = contents.length;
            return (
              <Link
                key={unit.id}
                href={`/grade/${id}/${unit.id}`}
                className="quest-card flex flex-col gap-2 p-5 no-underline transition hover:-translate-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full bg-wood/10 px-2.5 py-0.5 text-xs font-bold text-wood">
                    {unit.code}
                  </span>
                  <span className="text-xs font-semibold text-foreground/50">
                    {readyCount > 0
                      ? `콘텐츠 ${readyCount}`
                      : "준비중"}
                  </span>
                </div>
                <p className="font-display text-lg text-foreground">
                  {getUnitLabel(unit)}
                </p>
                <p className="text-xs text-foreground/50">
                  {readyCount > 0
                    ? contents.map((c) => c.title).join(" · ")
                    : "시뮬레이션 · 게임이 곧 추가됩니다"}
                </p>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
