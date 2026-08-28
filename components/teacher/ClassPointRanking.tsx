type Student = {
  id: string;
  student_number: number | null;
  display_name: string;
  level: number;
  total_xp: number;
};

type Ranked = Student & { rank: number };

function formatXp(n: number): string {
  return n.toLocaleString();
}

function rankStudents(students: Student[]): Ranked[] {
  const sorted = [...students].sort((a, b) => {
    if (b.total_xp !== a.total_xp) return b.total_xp - a.total_xp;
    const an = a.student_number ?? 9999;
    const bn = b.student_number ?? 9999;
    if (an !== bn) return an - bn;
    return a.display_name.localeCompare(b.display_name, "ko");
  });

  let lastXp: number | null = null;
  let lastRank = 0;
  return sorted.map((student, index) => {
    const rank = lastXp === student.total_xp ? lastRank : index + 1;
    lastXp = student.total_xp;
    lastRank = rank;
    return { ...student, rank };
  });
}

function studentLabel(student: Student): string {
  return student.student_number != null
    ? `${student.student_number}번 ${student.display_name}`
    : student.display_name;
}

function PodiumSlot({
  student,
  place,
}: {
  student: Ranked | undefined;
  place: 1 | 2 | 3;
}) {
  const pedestal =
    place === 1
      ? "h-24 from-gold via-gold/70 to-gold/25 shadow-[0_-6px_24px_rgba(212,160,23,0.35)]"
      : place === 2
        ? "h-16 from-wood-light/70 via-wood/20 to-wood/10"
        : "h-12 from-[#c4785a]/55 via-[#c4785a]/25 to-[#c4785a]/10";
  const medal =
    place === 1
      ? "h-12 w-12 bg-gold text-xl text-wood-dark ring-4 ring-gold/40"
      : place === 2
        ? "h-10 w-10 bg-white text-lg text-wood ring-2 ring-wood/15"
        : "h-10 w-10 bg-[#c4785a]/30 text-lg text-wood-dark ring-2 ring-[#c4785a]/25";
  const card =
    place === 1
      ? "bg-gradient-to-b from-gold/40 to-white ring-2 ring-gold/60"
      : "bg-white/80 ring-1 ring-wood/10";

  if (!student) {
    return <li className="min-w-0 flex-1" aria-hidden />;
  }

  return (
    <li className="flex min-w-0 flex-1 flex-col items-center justify-end">
      <article className={`mb-3 w-full max-w-[11rem] rounded-2xl px-3 py-3 text-center ${card}`}>
        <span
          className={`mx-auto flex items-center justify-center rounded-full font-black ${medal}`}
        >
          {place === 1 ? "★" : place}
        </span>
        <p className="mt-1.5 text-[10px] font-black tracking-widest text-wood/70">
          {place}등
        </p>
        <h3 className="font-display mt-1 truncate text-lg text-foreground sm:text-xl">
          {student.display_name}
        </h3>
        <p className="truncate text-[11px] font-semibold text-foreground/50">
          {student.student_number != null ? `${student.student_number}번` : ""}
          {student.student_number != null ? " · " : ""}
          Lv.{student.level}
        </p>
        <p className="font-display mt-1 text-xl tabular-nums text-wood">
          {formatXp(student.total_xp)}
        </p>
        <p className="text-[10px] font-bold tracking-wide text-wood/45">XP</p>
      </article>
      <div
        className={`w-full rounded-t-2xl bg-gradient-to-b ${pedestal}`}
        aria-hidden
      />
    </li>
  );
}

export default function ClassPointRanking({
  className,
  students,
}: {
  className: string;
  students: Student[];
}) {
  const ranked = rankStudents(students);
  const first = ranked.find((s) => s.rank === 1);
  const second = ranked.find((s) => s.rank === 2);
  const third = ranked.find((s) => s.rank === 3);
  const rest = ranked.filter((s) => s.rank > 3);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[11px] font-black tracking-wide text-wood/50">
            {className} · 누적 XP
          </p>
          <h3 className="font-display text-2xl text-wood">포인트 순위</h3>
        </div>
        <p className="text-sm font-semibold text-foreground/50">
          {students.length}명
        </p>
      </div>

      {ranked.length === 0 ? (
        <p className="mt-8 rounded-2xl bg-wood/5 px-4 py-10 text-center text-sm text-foreground/50">
          아직 학생이 없어요. 명단 탭에서 등록하면 순위가 생겨요.
        </p>
      ) : (
        <div className="mt-5 overflow-hidden rounded-[1.75rem] bg-gradient-to-b from-gold/25 via-cream to-mint/20 p-4 ring-1 ring-wood/10 sm:p-6">
          <ol className="flex items-end gap-2 sm:gap-4">
            <PodiumSlot student={second} place={2} />
            <PodiumSlot student={first} place={1} />
            <PodiumSlot student={third} place={3} />
          </ol>
          <div
            className="h-3 rounded-b-xl bg-gradient-to-b from-wood/35 to-wood/15"
            aria-hidden
          />

          {rest.length > 0 ? (
            <ol className="mt-5 grid gap-2 sm:grid-cols-2">
              {rest.map((student) => (
                <li
                  key={student.id}
                  className="flex items-center gap-3 rounded-2xl bg-white/75 px-3 py-2.5 ring-1 ring-wood/10"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-wood/10 text-sm font-black text-wood/70">
                    {student.rank}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-foreground">
                      {studentLabel(student)}
                    </span>
                    <span className="text-[11px] text-foreground/45">
                      Lv.{student.level}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-display text-base tabular-nums text-wood">
                      {formatXp(student.total_xp)}
                    </span>
                    <span className="text-[10px] font-bold text-wood/40">XP</span>
                  </span>
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      )}
    </div>
  );
}
