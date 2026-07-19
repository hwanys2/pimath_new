import Link from "next/link";
import { notFound } from "next/navigation";
import BlockButton from "@/components/BlockButton";
import AssignContentButton from "@/components/content/AssignContentButton";
import { getGrade, isValidGrade } from "@/lib/grades";
import {
  CURRICULUM_UNITS,
  getUnit,
  getUnitLabel,
} from "@/lib/curriculum";
import {
  contentTypeLabel,
  getContentsForUnit,
} from "@/lib/contents";
import { fetchTeacherClassesForAssign } from "@/lib/teacher-classes";

type Props = {
  params: Promise<{ grade: string; unitId: string }>;
};

export function generateStaticParams() {
  return CURRICULUM_UNITS.map((u) => ({
    grade: String(u.grade),
    unitId: u.id,
  }));
}

export async function generateMetadata({ params }: Props) {
  const { unitId } = await params;
  const unit = getUnit(unitId);
  if (!unit) return { title: "단원 없음" };
  const grade = getGrade(unit.grade);
  return {
    title: `${grade?.label ?? ""} ${getUnitLabel(unit)} | 수학하는 즐거움`,
    description: `${getUnitLabel(unit)} 시뮬레이션·게임`,
  };
}

export default async function UnitPage({ params }: Props) {
  const { grade: gradeParam, unitId } = await params;
  const gradeNum = Number(gradeParam);

  if (!isValidGrade(gradeNum)) notFound();

  const unit = getUnit(unitId);
  if (!unit || unit.grade !== gradeNum) notFound();

  const grade = getGrade(gradeNum)!;
  const contents = getContentsForUnit(unit.id);
  const teacherClasses = await fetchTeacherClassesForAssign();

  return (
    <div className="space-y-8">
      <section
        className={`quest-card overflow-hidden bg-gradient-to-br ${grade.accentClass} p-6 sm:p-8`}
      >
        <Link
          href={`/grade/${gradeNum}`}
          className="text-sm font-semibold text-wood/70 underline-offset-2 hover:underline"
        >
          ← {grade.label} 단원 목록
        </Link>
        <p className="mt-3 text-sm font-bold text-wood">{grade.label}</p>
        <h1 className="font-display mt-1 text-3xl sm:text-4xl">
          {getUnitLabel(unit)}
        </h1>
        <p className="mt-2 max-w-xl text-sm text-foreground/70">
          아래에서 콘텐츠를 열어 연습해 보세요. 공개 링크로도 공유할 수 있어요.
        </p>
      </section>

      <section>
        <div className="mb-4">
          <p className="text-sm font-bold text-wood">콘텐츠</p>
          <h2 className="font-display text-2xl">시뮬레이션 · 게임</h2>
        </div>

        {contents.length === 0 ? (
          <div className="coming-soon-slot flex flex-col items-center justify-center gap-2 p-8 text-center">
            <p className="font-display text-lg">준비중</p>
            <p className="text-sm text-foreground/50">
              이 단원의 시뮬레이션·게임이 곧 추가됩니다
            </p>
            <BlockButton href={`/grade/${gradeNum}`} variant="sky" size="sm">
              단원 목록으로
            </BlockButton>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {contents.map((content) => (
              <div key={content.key} className="quest-card flex flex-col gap-3 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-mint/30 px-2.5 py-0.5 text-xs font-bold text-wood">
                    {contentTypeLabel(content.type)}
                  </span>
                  {!content.awardsXp && (
                    <span className="rounded-full bg-wood/10 px-2.5 py-0.5 text-xs font-semibold text-foreground/60">
                      점수 없음
                    </span>
                  )}
                </div>
                <h3 className="font-display text-xl text-foreground">
                  {content.title}
                </h3>
                {content.description ? (
                  <p className="text-sm text-foreground/65">
                    {content.description}
                  </p>
                ) : null}
                <div className="mt-auto flex flex-wrap items-start gap-2 pt-2">
                  <BlockButton
                    href={content.href}
                    variant={grade.theme}
                    size="sm"
                  >
                    {content.type === "simulation"
                      ? "시뮬레이션 시작"
                      : "게임 시작"}
                  </BlockButton>
                  {teacherClasses ? (
                    <AssignContentButton
                      contentKey={content.key}
                      classes={teacherClasses}
                    />
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
