import Link from "next/link";
import type { AssignedContentView } from "@/lib/class-contents";
import { contentTypeBadgeClass, contentTypeLabel } from "@/lib/contents";
import { getUnit, getUnitLabel } from "@/lib/curriculum";

type Props = {
  items: AssignedContentView[];
};

function ContentCard({
  item,
  locked,
}: {
  item: AssignedContentView;
  locked: boolean;
}) {
  const content = item.content;
  const unit = content ? getUnit(content.unitId) : null;
  const title = content?.title ?? item.contentKey;

  return (
    <li
      className={`flex h-full flex-col gap-3 rounded-2xl px-4 py-3 ${
        locked ? "bg-wood/5 opacity-80" : "bg-mint/15"
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {content ? (
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${contentTypeBadgeClass(content.type)}`}
            >
              {contentTypeLabel(content.type)}
            </span>
          ) : null}
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
              locked
                ? "bg-wood/15 text-foreground/55"
                : "bg-mint/50 text-wood"
            }`}
          >
            {locked ? "비활성" : "활성"}
          </span>
          {content && !content.awardsXp ? (
            <span className="text-[11px] font-semibold text-foreground/50">
              연습 · 점수 없음
            </span>
          ) : content?.awardsXp ? (
            <span className="text-[11px] font-semibold text-foreground/50">
              XP · 랭킹
            </span>
          ) : null}
        </div>
        <p className="mt-1 font-display text-base text-foreground sm:text-lg">
          {title}
        </p>
        {unit ? (
          <p className="text-xs text-foreground/55">{getUnitLabel(unit)}</p>
        ) : null}
      </div>

      {content && !locked ? (
        <Link
          href={content.href}
          className="inline-flex w-full shrink-0 items-center justify-center rounded-xl bg-mint/60 px-4 py-2 text-sm font-bold text-wood no-underline hover:bg-mint/80"
        >
          {content.type === "simulation" ? "시뮬레이션 시작" : "게임 시작"}
        </Link>
      ) : (
        <span className="inline-flex w-full shrink-0 items-center justify-center rounded-xl bg-wood/10 px-4 py-2 text-sm font-bold text-foreground/40">
          잠김
        </span>
      )}
    </li>
  );
}

export default function ClassAssignedContents({ items }: Props) {
  const active = items.filter((item) => item.isActive);
  const inactive = items.filter((item) => !item.isActive);

  return (
    <section className="quest-card p-5 sm:p-6">
      <h2 className="font-display text-xl text-wood">우리 반 콘텐츠</h2>
      <p className="mt-1 text-sm text-foreground/65">
        선생님이 담아 둔 수업이에요. 활성화된 항목만 여기서 시작할 수 있어요.
      </p>

      {items.length === 0 ? (
        <p className="mt-4 rounded-2xl bg-wood/5 px-4 py-6 text-center text-sm text-foreground/50">
          아직 배정된 콘텐츠가 없어요.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {active.length > 0 ? (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {active.map((item) => (
                <ContentCard
                  key={item.contentKey}
                  item={item}
                  locked={false}
                />
              ))}
            </ul>
          ) : (
            <p className="rounded-2xl bg-wood/5 px-4 py-5 text-center text-sm text-foreground/50">
              지금 활성화된 콘텐츠가 없어요.
            </p>
          )}

          {inactive.length > 0 ? (
            <details className="group rounded-2xl bg-wood/5 open:bg-wood/[0.07]">
              <summary className="cursor-pointer list-none px-4 py-3 text-sm font-bold text-foreground/65 marker:content-none [&::-webkit-details-marker]:hidden">
                <span className="inline-flex items-center gap-2">
                  <span
                    aria-hidden
                    className="inline-block text-xs transition group-open:rotate-90"
                  >
                    ▸
                  </span>
                  비활성 콘텐츠 {inactive.length}개
                </span>
              </summary>
              <ul className="grid grid-cols-1 gap-3 px-3 pb-3 sm:grid-cols-2 lg:grid-cols-3">
                {inactive.map((item) => (
                  <ContentCard
                    key={item.contentKey}
                    item={item}
                    locked
                  />
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      )}
    </section>
  );
}
