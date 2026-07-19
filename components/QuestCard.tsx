import Image from "next/image";
import type { GradeMeta } from "@/lib/grades";
import { getUnitsForGrade, getUnitLabel } from "@/lib/curriculum";
import { getContentsForUnit } from "@/lib/contents";
import BlockButton from "./BlockButton";

type Props = {
  grade: GradeMeta;
};

export default function QuestCard({ grade }: Props) {
  const units = getUnitsForGrade(grade.id);
  const readyUnits = units.filter((u) => getContentsForUnit(u.id).length > 0);
  const preview = (readyUnits.length > 0 ? readyUnits : units).slice(0, 3);

  return (
    <article className="quest-card flex flex-col overflow-hidden">
      <div
        className={`relative bg-gradient-to-br ${grade.accentClass} px-5 pb-2 pt-5`}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="badge-pill">{grade.badge}</span>
            <h3 className="font-display mt-2 text-2xl text-foreground">
              {grade.label}
            </h3>
            <p className="text-sm font-semibold text-foreground/70">
              {grade.title}
            </p>
          </div>
          <Image
            src={grade.character}
            alt={`${grade.label} 캐릭터`}
            width={96}
            height={96}
            className="h-20 w-20 object-contain drop-shadow-lg sm:h-24 sm:w-24"
          />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-5">
        <p className="text-sm leading-relaxed text-foreground/75">
          {grade.description}
        </p>

        <ul className="space-y-1.5 text-sm">
          {preview.map((unit) => {
            const hasContent = getContentsForUnit(unit.id).length > 0;
            return (
              <li
                key={unit.id}
                className="flex items-center gap-2 rounded-xl bg-wood/5 px-3 py-2 font-medium text-foreground/80"
              >
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    hasContent ? "bg-mint" : "bg-wood/30"
                  }`}
                  aria-hidden
                />
                <span className="truncate">{getUnitLabel(unit)}</span>
              </li>
            );
          })}
          {units.length > 3 ? (
            <li className="px-3 text-xs font-semibold text-foreground/45">
              외 {units.length - 3}개 단원
            </li>
          ) : null}
        </ul>

        <div className="mt-auto pt-1">
          <BlockButton
            href={`/grade/${grade.id}`}
            variant={grade.theme}
            className="w-full"
          >
            {grade.label} 입장하기
          </BlockButton>
        </div>
      </div>
    </article>
  );
}
