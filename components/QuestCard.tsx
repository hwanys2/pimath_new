import Image from "next/image";
import type { GradeMeta } from "@/lib/grades";
import { getBookPromo } from "@/lib/book-promos";
import { getUnitsForGrade, getUnitLabel } from "@/lib/curriculum";
import { getContentsForUnit } from "@/lib/contents";
import BlockButton from "./BlockButton";

type Props = {
  grade: GradeMeta;
};

const promoHoverClass: Record<GradeMeta["theme"], string> = {
  mint: "hover:border-mint/35 hover:bg-mint/8",
  peach: "hover:border-peach/35 hover:bg-peach/8",
  lavender: "hover:border-lavender/35 hover:bg-lavender/8",
};

export default function QuestCard({ grade }: Props) {
  const units = getUnitsForGrade(grade.id);
  const readyUnits = units.filter((u) => getContentsForUnit(u.id).length > 0);
  const preview = (readyUnits.length > 0 ? readyUnits : units).slice(0, 3);
  const bookPromo = getBookPromo(grade.id);

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

          {bookPromo.kind === "link" ? (
            <a
              href={bookPromo.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`group mt-3 block rounded-xl border border-wood/15 bg-gradient-to-b from-white/85 to-wood/5 p-3 transition ${promoHoverClass[grade.theme]}`}
            >
              <div className="relative mx-auto aspect-square h-24 w-24 overflow-hidden rounded-lg bg-white/70 shadow-sm ring-1 ring-wood/10">
                <Image
                  src={bookPromo.imageUrl}
                  alt={bookPromo.label}
                  fill
                  className="object-cover transition duration-200 group-hover:scale-[1.03]"
                  sizes="96px"
                />
              </div>
              <div className="mt-2.5 flex items-center justify-center gap-1.5">
                <p className="font-display text-center text-xs font-bold leading-snug text-foreground/80 transition group-hover:text-foreground">
                  {bookPromo.label}
                </p>
                <span
                  className="shrink-0 text-[10px] font-bold text-foreground/35 transition group-hover:text-foreground/55"
                  aria-hidden
                >
                  ↗
                </span>
              </div>
            </a>
          ) : (
            <div className="mt-3 rounded-xl border border-dashed border-wood/20 bg-wood/5 p-3">
              <div className="mx-auto flex aspect-square h-24 w-24 items-center justify-center rounded-lg bg-white/50 ring-1 ring-wood/10">
                <span className="text-3xl opacity-60" aria-hidden>
                  📚
                </span>
              </div>
              <p className="mt-2.5 text-center text-sm font-medium text-foreground/50">
                {bookPromo.message}
              </p>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
