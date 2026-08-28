import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import type {
  HofBoard,
  HofClassRow,
  HofSchoolRow,
  HofStudentRow,
} from "@/lib/hall-of-fame";

const PREVIEW = 8;

function formatXp(n: number): string {
  return n.toLocaleString();
}

function RankBadge({ rank }: { rank: number }) {
  const medal =
    rank === 1
      ? "bg-gold text-wood"
      : rank === 2
        ? "bg-wood/15 text-wood"
        : rank === 3
          ? "bg-[#c4785a]/35 text-wood"
          : "bg-wood/10 text-wood/55";
  return (
    <span
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black ${medal}`}
    >
      {rank}
    </span>
  );
}

function Row({
  rank,
  title,
  meta,
  score,
  highlight,
}: {
  rank: number;
  title: string;
  meta?: string | null;
  score: number;
  highlight?: boolean;
}) {
  return (
    <li
      className={[
        "flex items-center gap-2 rounded-xl px-2.5 py-1.5",
        highlight ? "bg-mint/35 ring-1 ring-mint/50" : "bg-wood/5",
      ].join(" ")}
    >
      <RankBadge rank={rank} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-foreground">
          {title}
        </span>
        {meta ? (
          <span className="block truncate text-[10px] text-foreground/45">
            {meta}
          </span>
        ) : null}
      </span>
      <span className="shrink-0 font-display text-xs tabular-nums text-wood">
        {formatXp(score)}
      </span>
    </li>
  );
}

function PreviewCard({
  badge,
  title,
  hint,
  accentClass,
  character,
  children,
}: {
  badge: string;
  title: string;
  hint: string;
  accentClass: string;
  character?: string;
  children: ReactNode;
}) {
  return (
    <article className="quest-card-static flex flex-col overflow-hidden">
      <div className={`relative bg-gradient-to-br ${accentClass} px-5 pb-3 pt-5`}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="badge-pill">{badge}</span>
            <h3 className="font-display mt-2 text-2xl text-foreground">{title}</h3>
            <p className="text-sm font-semibold text-foreground/70">{hint}</p>
          </div>
          {character ? (
            <Image
              src={character}
              alt=""
              width={80}
              height={80}
              className="h-16 w-16 object-contain drop-shadow-lg sm:h-20 sm:w-20"
            />
          ) : null}
        </div>
      </div>
      <div className="flex flex-1 flex-col p-4">{children}</div>
    </article>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p className="py-6 text-center text-sm text-foreground/45">{text}</p>
  );
}

export default function HallOfFamePreview({
  board,
  showStudentLoginCta = false,
}: {
  board: HofBoard;
  showStudentLoginCta?: boolean;
}) {
  const students = board.students.filter((r) => r.rank <= PREVIEW);
  const schools = board.schools.filter((r) => r.rank <= PREVIEW);
  const classes = board.classes.filter((r) => r.rank <= PREVIEW);

  return (
    <section>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-wood">명예의 전당</p>
          <h2 className="font-display text-2xl text-foreground sm:text-3xl">
            이번 시즌 순위
          </h2>
        </div>
        <p className="text-sm text-foreground/60">
          누적 XP · 다른 학교 이름은 *로 가려요
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <PreviewCard
          badge="✦ 탐험가"
          title="전체"
          hint="모든 학생"
          accentClass="from-gold/40 to-peach/25"
          character="/images/mascot-v2.png"
        >
          {students.length === 0 ? (
            <Empty text="아직 순위가 없어요" />
          ) : (
            <ol className="space-y-1">
              {students.map((row: HofStudentRow) => (
                <Row
                  key={`w-${row.rank}-${row.displayName}`}
                  rank={row.rank}
                  title={row.displayName}
                  meta={[row.schoolName, row.className].filter(Boolean).join(" · ")}
                  score={row.totalXp}
                  highlight={row.isMe}
                />
              ))}
            </ol>
          )}
        </PreviewCard>

        <PreviewCard
          badge="⌂ 대항전"
          title="학교"
          hint="전교 포인트 합"
          accentClass="from-mint/40 to-sky/25"
        >
          {schools.length === 0 ? (
            <Empty text="학교가 등록되면 여기에 올라요" />
          ) : (
            <ol className="space-y-1">
              {schools.map((row: HofSchoolRow) => (
                <Row
                  key={row.schoolInfoId}
                  rank={row.rank}
                  title={row.schoolName}
                  meta={
                    row.region
                      ? `${row.region} · ${row.studentCount}명`
                      : `${row.studentCount}명`
                  }
                  score={row.totalXp}
                  highlight={row.isMine}
                />
              ))}
            </ol>
          )}
        </PreviewCard>

        <PreviewCard
          badge="★ 우리 반"
          title="학급"
          hint="학급 포인트 합"
          accentClass="from-lavender/40 to-peach/20"
        >
          {classes.length === 0 ? (
            <Empty text="아직 학급 순위가 없어요" />
          ) : (
            <ol className="space-y-1">
              {classes.map((row: HofClassRow) => (
                <Row
                  key={row.classId}
                  rank={row.rank}
                  title={row.className}
                  meta={
                    row.schoolName
                      ? `${row.schoolName} · ${row.studentCount}명`
                      : `${row.studentCount}명`
                  }
                  score={row.totalXp}
                  highlight={row.isMine}
                />
              ))}
            </ol>
          )}
        </PreviewCard>
      </div>

      {showStudentLoginCta ? (
        <p className="mt-4 text-center text-sm text-foreground/60">
          <Link
            href="/login/student"
            className="font-display font-bold text-wood underline-offset-2 hover:underline"
          >
            학생 로그인하고 순위에 도전하기 →
          </Link>
        </p>
      ) : null}
    </section>
  );
}
