import Image from "next/image";
import type { GradeMeta } from "@/lib/grades";
import BlockButton from "./BlockButton";

type Props = {
  grade: GradeMeta;
};

export default function QuestCard({ grade }: Props) {
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

        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs font-bold text-foreground/60">
            <span>탐험 진행도</span>
            <span>{grade.xp}%</span>
          </div>
          <div className="xp-bar">
            <div
              className="xp-bar-fill"
              style={{ width: `${grade.xp}%` }}
            />
          </div>
        </div>

        <ul className="space-y-1.5 text-sm">
          {grade.questPreview.map((quest) => (
            <li
              key={quest}
              className="flex items-center gap-2 rounded-xl bg-wood/5 px-3 py-2 font-medium text-foreground/80"
            >
              <span aria-hidden>⭐</span>
              {quest}
            </li>
          ))}
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
