"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { fetchHofBoardAction } from "@/app/hof/actions";
import type {
  HofBoard,
  HofClassRow,
  HofSchoolRow,
  HofStudentRow,
  HofTab,
} from "@/lib/hall-of-fame";

const TABS: { id: HofTab; label: string; hint: string; icon: string }[] = [
  { id: "world", label: "전체", hint: "모든 탐험가", icon: "✦" },
  { id: "school", label: "학교", hint: "학교 대항전", icon: "⌂" },
  { id: "class", label: "학급", hint: "우리 반", icon: "★" },
];

type PodiumItem = {
  key: string;
  rank: number;
  title: string;
  subtitle?: string | null;
  score: number;
  highlight?: boolean;
};

function formatXp(n: number): string {
  return n.toLocaleString();
}

function schoolLabel(name: string, region: string | null): string {
  return region ? `${name} · ${region}` : name;
}

function Podium({ items }: { items: PodiumItem[] }) {
  const first = items.find((r) => r.rank === 1);
  const second = items.find((r) => r.rank === 2);
  const third = items.find((r) => r.rank === 3);
  if (!first) return null;

  const Slot = ({
    item,
    place,
  }: {
    item: PodiumItem | undefined;
    place: 1 | 2 | 3;
  }) => {
    const medal =
      place === 1
        ? "bg-gold text-wood shadow-[0_0_20px_rgba(255,215,106,0.55)]"
        : place === 2
          ? "bg-white text-wood/80 ring-1 ring-wood/15"
          : "bg-[#c4785a]/40 text-wood";
    const bar =
      place === 1
        ? "from-gold/80 via-gold/50 to-gold/20 h-[4.5rem] sm:h-24"
        : place === 2
          ? "from-wood/30 to-wood/10 h-14 sm:h-[4.5rem]"
          : "from-[#c4785a]/50 to-[#c4785a]/15 h-11 sm:h-14";

    return (
      <div
        className={`flex min-w-0 flex-1 flex-col items-center justify-end ${
          place === 1 ? "order-2" : place === 2 ? "order-1" : "order-3"
        }`}
      >
        {item ? (
          <div
            className={[
              "mb-2 flex w-full max-w-[10rem] flex-col items-center rounded-2xl px-2 py-2.5",
              item.highlight
                ? "bg-mint/35 ring-2 ring-mint/70"
                : "bg-white/80 ring-1 ring-wood/10",
              place === 1 ? "shadow-lg" : "",
            ].join(" ")}
          >
            {place === 1 ? (
              <Image
                src="/images/mascot-v2.png"
                alt=""
                width={48}
                height={48}
                className="mb-1 h-10 w-10 object-contain drop-shadow sm:h-12 sm:w-12"
              />
            ) : null}
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-black ${medal}`}
            >
              {place}
            </span>
            <p className="mt-1 w-full truncate text-center text-sm font-black text-foreground">
              {item.title}
            </p>
            {item.subtitle ? (
              <p className="w-full truncate text-center text-[10px] text-foreground/45">
                {item.subtitle}
              </p>
            ) : null}
            <p className="mt-0.5 font-display text-base tabular-nums text-wood">
              {formatXp(item.score)}
            </p>
          </div>
        ) : (
          <div className="mb-2 h-16" />
        )}
        <div
          className={`w-full rounded-t-2xl bg-gradient-to-b ${bar}`}
          aria-hidden
        />
      </div>
    );
  };

  return (
    <div className="mt-4 flex items-end gap-2 px-1 sm:gap-4">
      <Slot item={second} place={2} />
      <Slot item={first} place={1} />
      <Slot item={third} place={3} />
    </div>
  );
}

function StudentList({
  rows,
  showSchool,
}: {
  rows: HofStudentRow[];
  showSchool: boolean;
}) {
  const rest = rows.filter((r) => r.rank > 3);
  const items: ({ kind: "gap"; after: number } | { kind: "row"; row: HofStudentRow })[] =
    [];
  for (let i = 0; i < rest.length; i++) {
    const row = rest[i];
    if (i > 0 && row.rank > rest[i - 1].rank + 1) {
      items.push({ kind: "gap", after: rest[i - 1].rank });
    }
    items.push({ kind: "row", row });
  }

  if (rest.length === 0) return null;

  return (
    <ol className="mt-4 space-y-1.5">
      {items.map((item) =>
        item.kind === "gap" ? (
          <li
            key={`gap-${item.after}`}
            aria-hidden
            className="flex items-center justify-center py-0.5"
          >
            <span className="text-[11px] font-black tracking-[0.35em] text-wood/30">
              ···
            </span>
          </li>
        ) : (
          <li
            key={`s-${item.row.rank}-${item.row.displayName}`}
            className={[
              "flex items-center gap-3 rounded-xl px-3 py-2.5",
              item.row.isMe
                ? "bg-mint/40 ring-2 ring-mint/60"
                : "bg-white/70",
            ].join(" ")}
          >
            <span
              className={[
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black",
                item.row.rank <= 3
                  ? "bg-gold/70 text-wood"
                  : "bg-wood/10 text-wood/65",
              ].join(" ")}
            >
              {item.row.rank}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-foreground">
                {item.row.displayName}
                {item.row.isMe ? (
                  <span className="ml-1.5 text-[11px] font-semibold text-wood/70">
                    (나)
                  </span>
                ) : null}
              </span>
              <span className="block truncate text-[11px] text-foreground/45">
                Lv.{item.row.level}
                {item.row.className ? ` · ${item.row.className}` : ""}
                {showSchool && item.row.schoolName
                  ? ` · ${item.row.schoolName}`
                  : ""}
              </span>
            </span>
            <span className="shrink-0 font-display text-sm tabular-nums text-wood">
              {formatXp(item.row.totalXp)}
            </span>
          </li>
        ),
      )}
    </ol>
  );
}

type Props = {
  initial: HofBoard;
  showStudentLoginCta?: boolean;
  lockClassId?: string | null;
};

export default function HallOfFame({
  initial,
  showStudentLoginCta = false,
  lockClassId = null,
}: Props) {
  const [board, setBoard] = useState(initial);
  const [isPending, startTransition] = useTransition();

  const load = (
    tab: HofTab,
    schoolInfoId: number | null,
    classId: string | null,
  ) => {
    startTransition(async () => {
      const next = await fetchHofBoardAction({
        tab,
        schoolInfoId,
        classId,
        lockClassId,
      });
      setBoard(next);
    });
  };

  const changeTab = (tab: HofTab) => {
    if (tab === board.tab) return;
    load(tab, board.selectedSchoolId, lockClassId ?? board.selectedClassId);
  };

  const studentPodium: PodiumItem[] = useMemo(
    () =>
      board.students
        .filter((r) => r.rank <= 3)
        .map((r) => ({
          key: `sp-${r.rank}`,
          rank: r.rank,
          title: r.displayName,
          subtitle: [r.schoolName, r.className].filter(Boolean).join(" · "),
          score: r.totalXp,
          highlight: r.isMe,
        })),
    [board.students],
  );

  const schoolPodium: PodiumItem[] = useMemo(
    () =>
      board.schools
        .filter((r) => r.rank <= 3)
        .map((r) => ({
          key: `sc-${r.schoolInfoId}`,
          rank: r.rank,
          title: r.schoolName,
          subtitle: r.region,
          score: r.totalXp,
          highlight: r.isMine,
        })),
    [board.schools],
  );

  const classPodium: PodiumItem[] = useMemo(
    () =>
      board.classes
        .filter((r) => r.rank <= 3)
        .map((r) => ({
          key: `cl-${r.classId}`,
          rank: r.rank,
          title: r.className,
          subtitle: r.schoolName,
          score: r.totalXp,
          highlight: r.isMine,
        })),
    [board.classes],
  );

  const selectedSchool = board.schools.find(
    (s) => s.schoolInfoId === board.selectedSchoolId,
  );
  const selectedClass = board.classes.find(
    (c) => c.classId === board.selectedClassId,
  );

  const guest = board.viewer.kind === "anon";

  return (
    <section className="overflow-hidden rounded-[1.75rem] border-[3px] border-gold/40 bg-gradient-to-b from-[#3d2c1e] via-[#5a3d24] to-[#3d2c1e] shadow-[0_12px_0_rgba(90,58,34,0.35)]">
      <div className="relative px-5 pb-5 pt-6 sm:px-8 sm:pt-8">
        <div className="pointer-events-none absolute -right-6 -top-8 h-40 w-40 rounded-full bg-gold/20 blur-3xl" />
        <div className="pointer-events-none absolute left-10 top-0 h-24 w-24 rounded-full bg-mint/15 blur-2xl" />

        <div className="relative flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative h-14 w-14 shrink-0 sm:h-16 sm:w-16">
              <Image
                src="/images/mascot-v2.png"
                alt=""
                fill
                className="object-contain drop-shadow-lg"
                sizes="64px"
              />
            </div>
            <div>
              <p className="text-[11px] font-bold tracking-widest text-gold/90">
                HALL OF FAME
              </p>
              <h2 className="font-display text-2xl text-cream sm:text-3xl">
                명예의 전당
              </h2>
              <p className="mt-0.5 text-xs text-cream/70">
                누적 XP로 겨루는 탐험가 · 학교 · 학급 순위
              </p>
            </div>
          </div>
          {board.viewer.kind === "student" && board.viewer.worldRank ? (
            <p className="rounded-full bg-gold/90 px-3 py-1 text-xs font-black text-[#6b4a00]">
              전체 {board.viewer.worldRank}위
              {board.viewer.schoolRank ? ` · 학교 ${board.viewer.schoolRank}위` : ""}
              {board.viewer.classRank ? ` · 학급 ${board.viewer.classRank}위` : ""}
            </p>
          ) : null}
        </div>

        <div
          className="relative mt-5 grid grid-cols-3 gap-2"
          role="tablist"
          aria-label="명예의 전당 범위"
        >
          {TABS.map((tab) => {
            const active = board.tab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => changeTab(tab.id)}
                className={[
                  "rounded-2xl px-2 py-3 text-center transition",
                  active
                    ? "bg-gold text-[#6b4a00] shadow-[0_4px_0_rgba(107,74,0,0.35)]"
                    : "bg-black/25 text-cream hover:bg-black/35",
                ].join(" ")}
              >
                <span className="block text-lg leading-none" aria-hidden>
                  {tab.icon}
                </span>
                <span className="mt-1 block font-display text-sm sm:text-base">
                  {tab.label}
                </span>
                <span
                  className={[
                    "mt-0.5 block text-[10px] font-semibold",
                    active ? "text-[#6b4a00]/70" : "text-cream/55",
                  ].join(" ")}
                >
                  {tab.hint}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-t-[1.5rem] bg-gradient-to-b from-cream to-[#fff6e8] px-4 py-5 sm:px-6 sm:py-6">
        {isPending ? (
          <p className="py-8 text-center text-sm text-foreground/40">
            불러오는 중…
          </p>
        ) : (
          <>
            {board.tab === "school" ? (
              <>
                <SectionTitle
                  title="학교 대항전"
                  caption="같은 학교 학생들의 누적 XP를 모두 더한 순위"
                />
                {board.schools.length === 0 ? (
                  <EmptyNotice text="아직 학교가 등록된 탐험가가 없어요. 선생님이 학교를 선택하면 대항전에 올라가요." />
                ) : (
                  <>
                    <Podium items={schoolPodium} />
                    <AggregateList
                      rows={board.schools}
                      selectedId={board.selectedSchoolId}
                      onSelect={(id) =>
                        load("school", Number(id), board.selectedClassId)
                      }
                      nameOf={(r: HofSchoolRow) =>
                        schoolLabel(r.schoolName, r.region)
                      }
                      idOf={(r: HofSchoolRow) => r.schoolInfoId}
                    />
                  </>
                )}
                <SectionTitle
                  title={
                    selectedSchool
                      ? `${selectedSchool.schoolName} 학생`
                      : "학교 학생 순위"
                  }
                  caption="학교를 누르면 그 학교 학생 순위를 볼 수 있어요"
                  className="mt-8"
                />
              </>
            ) : null}

            {board.tab === "class" ? (
              <>
                <SectionTitle
                  title="학급 대항전"
                  caption="한 학급 학생들의 누적 XP를 모두 더한 순위"
                />
                {board.classes.length === 0 ? (
                  <EmptyNotice text="아직 학급 순위가 없어요." />
                ) : (
                  <>
                    <Podium items={classPodium} />
                    <AggregateList
                      rows={board.classes}
                      selectedId={board.selectedClassId}
                      onSelect={
                        lockClassId
                          ? undefined
                          : (id) =>
                              load("class", board.selectedSchoolId, String(id))
                      }
                      nameOf={(r: HofClassRow) =>
                        r.schoolName
                          ? `${r.className} · ${r.schoolName}`
                          : r.className
                      }
                      idOf={(r: HofClassRow) => r.classId}
                    />
                  </>
                )}
                <SectionTitle
                  title={
                    selectedClass
                      ? `${selectedClass.className} 학생`
                      : board.viewer.kind === "teacher"
                        ? "내 학급 학생"
                        : "학급 학생 순위"
                  }
                  caption={
                    lockClassId
                      ? "이 학급 학생들의 포인트 순위예요"
                      : "학급을 누르면 그 반 학생 순위를 볼 수 있어요"
                  }
                  className="mt-8"
                />
              </>
            ) : null}

            {board.tab === "world" ? (
              <SectionTitle
                title="전체 탐험가"
                caption="게임을 클리어하며 모은 누적 XP 순위"
              />
            ) : null}

            {board.students.length === 0 ? (
              <EmptyNotice
                text={
                  board.tab === "school"
                    ? "이 학교에 아직 순위가 없어요."
                    : board.tab === "class"
                      ? "이 학급에 아직 순위가 없어요."
                      : "아직 순위가 없어요. 첫 탐험가가 되어 보세요!"
                }
              />
            ) : (
              <>
                <Podium items={studentPodium} />
                <StudentList
                  rows={board.students}
                  showSchool={board.tab !== "class"}
                />
              </>
            )}

            {guest ? (
              <p className="mt-5 text-center text-[11px] text-foreground/45">
                다른 학교 학생 이름은 *로 가려 보여요. 로그인하면 우리 학교·반은
                실명으로 보여요.
              </p>
            ) : (
              <p className="mt-5 text-center text-[11px] text-foreground/45">
                우리 학교·반은 실명, 다른 학교 학생만 *로 가려요.
              </p>
            )}

            {showStudentLoginCta && guest ? (
              <p className="mt-3 text-center">
                <Link
                  href="/login/student"
                  className="font-display text-sm font-bold text-wood underline-offset-2 hover:underline"
                >
                  학생 로그인하고 순위에 도전하기 →
                </Link>
              </p>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

function SectionTitle({
  title,
  caption,
  className = "",
}: {
  title: string;
  caption: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <h3 className="font-display text-lg text-wood sm:text-xl">{title}</h3>
      <p className="mt-0.5 text-xs text-foreground/50">{caption}</p>
    </div>
  );
}

function EmptyNotice({ text }: { text: string }) {
  return (
    <p className="mt-4 rounded-2xl bg-white/60 px-4 py-8 text-center text-sm text-foreground/50">
      {text}
    </p>
  );
}

function AggregateList<T extends { rank: number; totalXp: number; isMine: boolean; studentCount: number }>({
  rows,
  selectedId,
  onSelect,
  nameOf,
  idOf,
}: {
  rows: T[];
  selectedId: number | string | null;
  onSelect?: (id: number | string) => void;
  nameOf: (row: T) => string;
  idOf: (row: T) => number | string;
}) {
  const rest = rows.filter((r) => r.rank > 3);
  if (rest.length === 0) return null;

  return (
    <ol className="mt-4 space-y-1.5">
      {rest.map((row) => {
        const id = idOf(row);
        const selected = selectedId != null && String(selectedId) === String(id);
        const className = [
          "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left",
          row.isMine || selected
            ? "bg-mint/35 ring-2 ring-mint/55"
            : "bg-white/70",
          onSelect ? "transition hover:bg-gold/20" : "",
        ].join(" ");

        const body = (
          <>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-wood/10 text-sm font-black text-wood/65">
              {row.rank}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-foreground">
                {nameOf(row)}
                {row.isMine ? (
                  <span className="ml-1.5 text-[11px] font-semibold text-wood/70">
                    (우리)
                  </span>
                ) : null}
              </span>
              <span className="block text-[11px] text-foreground/45">
                {row.studentCount}명
              </span>
            </span>
            <span className="shrink-0 font-display text-sm tabular-nums text-wood">
              {formatXp(row.totalXp)}
            </span>
          </>
        );

        return (
          <li key={String(id)}>
            {onSelect ? (
              <button
                type="button"
                className={className}
                onClick={() => onSelect(id)}
              >
                {body}
              </button>
            ) : (
              <div className={className}>{body}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
