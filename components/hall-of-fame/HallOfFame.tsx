"use client";

import { useState, useTransition } from "react";
import { fetchHofBoardAction } from "@/app/hof/actions";
import type {
  HofBoard,
  HofClassRow,
  HofSchoolRow,
  HofStudentRow,
  HofTab,
} from "@/lib/hall-of-fame";

const TABS: { id: HofTab; label: string }[] = [
  { id: "world", label: "전체" },
  { id: "school", label: "학교" },
  { id: "class", label: "학급" },
];

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

function StudentRows({
  rows,
  showSchool,
}: {
  rows: HofStudentRow[];
  showSchool: boolean;
}) {
  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-xs text-foreground/40">
        아직 순위가 없어요
      </p>
    );
  }

  const items: (
    | { kind: "gap"; after: number }
    | { kind: "row"; row: HofStudentRow }
  )[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (i > 0 && row.rank > rows[i - 1].rank + 1) {
      items.push({ kind: "gap", after: rows[i - 1].rank });
    }
    items.push({ kind: "row", row });
  }

  return (
    <ol className="space-y-1">
      {items.map((item) =>
        item.kind === "gap" ? (
          <li
            key={`gap-${item.after}`}
            aria-hidden
            className="py-0.5 text-center text-[10px] tracking-[0.3em] text-wood/30"
          >
            ···
          </li>
        ) : (
          <li
            key={`s-${item.row.rank}-${item.row.displayName}`}
            className={[
              "flex items-center gap-2 rounded-xl px-2 py-1.5",
              item.row.isMe ? "bg-mint/40 ring-1 ring-mint/60" : "bg-wood/5",
            ].join(" ")}
          >
            <RankBadge rank={item.row.rank} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-foreground">
                {item.row.displayName}
                {item.row.isMe ? (
                  <span className="ml-1 text-[10px] text-wood/60">(나)</span>
                ) : null}
              </span>
              <span className="block truncate text-[10px] text-foreground/45">
                Lv.{item.row.level}
                {item.row.className ? ` · ${item.row.className}` : ""}
                {showSchool && item.row.schoolName
                  ? ` · ${item.row.schoolName}`
                  : ""}
              </span>
            </span>
            <span className="shrink-0 font-display text-xs tabular-nums text-wood">
              {formatXp(item.row.totalXp)}
            </span>
          </li>
        ),
      )}
    </ol>
  );
}

type HofMyClass = { id: string; name: string };

type Props = {
  initial: HofBoard;
  lockClassId?: string | null;
  myClasses?: HofMyClass[];
  classOnly?: boolean;
  fillHeight?: boolean;
};

export default function HallOfFame({
  initial,
  lockClassId = null,
  myClasses = [],
  classOnly = false,
  fillHeight = false,
}: Props) {
  const [board, setBoard] = useState(initial);
  const [activeClassId, setActiveClassId] = useState(
    lockClassId ?? myClasses[0]?.id ?? initial.selectedClassId,
  );
  const [drillSchool, setDrillSchool] = useState(false);
  const [drillClass, setDrillClass] = useState(
    initial.tab === "class" &&
      (Boolean(lockClassId) ||
        classOnly ||
        initial.viewer.kind === "student" ||
        myClasses.length > 0),
  );
  const [isPending, startTransition] = useTransition();

  const teacherClassId =
    activeClassId ?? myClasses[0]?.id ?? null;
  const effectiveLock = classOnly ? teacherClassId : lockClassId;

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
        lockClassId: classOnly ? classId : lockClassId,
      });
      setBoard(next);
    });
  };

  const changeTab = (tab: HofTab) => {
    if (tab === board.tab) return;
    setDrillSchool(false);
    if (tab === "class") {
      const classId =
        lockClassId ??
        teacherClassId ??
        (board.viewer.kind === "student" ? board.selectedClassId : null);
      const shouldDrill = Boolean(classId) || classOnly;
      setDrillClass(shouldDrill);
      if (classId) setActiveClassId(classId);
      load(tab, board.selectedSchoolId, classId);
      return;
    }
    setDrillClass(false);
    load(tab, board.selectedSchoolId, effectiveLock ?? board.selectedClassId);
  };

  const pickClass = (classId: string) => {
    if (classId === activeClassId && board.tab === "class") return;
    setActiveClassId(classId);
    setDrillClass(true);
    load("class", board.selectedSchoolId, classId);
  };

  const selectedSchool = board.schools.find(
    (s) => s.schoolInfoId === board.selectedSchoolId,
  );
  const selectedClass = board.classes.find(
    (c) => c.classId === board.selectedClassId,
  );

  const showSchoolStudents = board.tab === "school" && drillSchool;
  const showClassStudents =
    board.tab === "class" && (drillClass || classOnly);

  const selectedClassName =
    myClasses.find((klass) => klass.id === (activeClassId ?? board.selectedClassId))
      ?.name ??
    selectedClass?.className ??
    "학급 학생";

  const classSelect =
    myClasses.length > 0 && board.tab === "class" && showClassStudents ? (
      <label className="flex min-w-0 max-w-[11.5rem] shrink-0 items-center">
        <span className="sr-only">학급 선택</span>
        <select
          value={activeClassId ?? myClasses[0]?.id ?? ""}
          onChange={(event) => pickClass(event.target.value)}
          disabled={isPending || Boolean(lockClassId) || myClasses.length < 2}
          className="w-full truncate rounded-lg border-2 border-wood/15 bg-white px-2 py-1 text-xs font-bold text-wood outline-none focus:border-sky focus:ring-2 focus:ring-sky/30 disabled:opacity-80"
        >
          {myClasses.map((klass) => (
            <option key={klass.id} value={klass.id}>
              {klass.name}
            </option>
          ))}
        </select>
      </label>
    ) : null;

  const body = isPending ? (
    <p className="py-6 text-center text-xs text-foreground/40">불러오는 중…</p>
  ) : board.tab === "world" && !classOnly ? (
    <StudentRows rows={board.students} showSchool />
  ) : board.tab === "school" && !showSchoolStudents && !classOnly ? (
    board.schools.length === 0 ? (
      <p className="py-6 text-center text-xs text-foreground/40">
        학교가 등록되면 대항전이 열려요
      </p>
    ) : (
      <ol className="space-y-1">
        {board.schools.map((row: HofSchoolRow) => (
          <li key={row.schoolInfoId}>
            <button
              type="button"
              onClick={() => {
                setDrillSchool(true);
                load("school", row.schoolInfoId, board.selectedClassId);
              }}
              className={[
                "flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left transition hover:bg-gold/20",
                row.isMine ? "bg-mint/35 ring-1 ring-mint/50" : "bg-wood/5",
              ].join(" ")}
            >
              <RankBadge rank={row.rank} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">
                  {row.schoolName}
                  {row.isMine ? (
                    <span className="ml-1 text-[10px] text-wood/60">(우리)</span>
                  ) : null}
                </span>
                <span className="text-[10px] text-foreground/45">
                  {row.studentCount}명
                  {row.region ? ` · ${row.region}` : ""}
                </span>
              </span>
              <span className="shrink-0 font-display text-xs tabular-nums text-wood">
                {formatXp(row.totalXp)}
              </span>
            </button>
          </li>
        ))}
      </ol>
    )
  ) : board.tab === "class" && !showClassStudents ? (
    board.classes.length === 0 ? (
      <p className="py-6 text-center text-xs text-foreground/40">
        아직 학급 순위가 없어요
      </p>
    ) : (
      <ol className="space-y-1">
        {board.classes.map((row: HofClassRow) => (
          <li key={row.classId}>
            <button
              type="button"
              onClick={() => {
                setDrillClass(true);
                setActiveClassId(row.classId);
                load("class", board.selectedSchoolId, row.classId);
              }}
              className={[
                "flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left transition hover:bg-gold/20",
                row.isMine ? "bg-mint/35 ring-1 ring-mint/50" : "bg-wood/5",
              ].join(" ")}
            >
              <RankBadge rank={row.rank} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">
                  {row.className}
                  {row.isMine ? (
                    <span className="ml-1 text-[10px] text-wood/60">(우리)</span>
                  ) : null}
                </span>
                <span className="block truncate text-[10px] text-foreground/45">
                  {row.schoolName
                    ? `${row.schoolName} · ${row.studentCount}명`
                    : `${row.studentCount}명`}
                </span>
              </span>
              <span className="shrink-0 font-display text-xs tabular-nums text-wood">
                {formatXp(row.totalXp)}
              </span>
            </button>
          </li>
        ))}
      </ol>
    )
  ) : (
    <div>
      {board.tab === "school" && !lockClassId && !classOnly ? (
        <button
          type="button"
          onClick={() => setDrillSchool(false)}
          className="mb-2 text-[11px] font-bold text-wood/70 underline-offset-2 hover:underline"
        >
          ← 학교 대항전
        </button>
      ) : null}
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          {board.tab === "class" && !lockClassId && !classOnly ? (
            <button
              type="button"
              onClick={() => setDrillClass(false)}
              className="text-[11px] font-bold text-wood/70 underline-offset-2 hover:underline"
            >
              ← 학급 대항전
            </button>
          ) : null}
          {!classSelect && !classOnly ? (
            <p className="truncate text-[11px] font-semibold text-foreground/50">
              {board.tab === "school"
                ? (selectedSchool?.schoolName ?? "학교 학생")
                : selectedClassName}
            </p>
          ) : null}
        </div>
        {classSelect}
      </div>
      <StudentRows
        rows={board.students}
        showSchool={board.tab !== "class"}
      />
    </div>
  );

  return (
    <article
      className={[
        "quest-card-static overflow-hidden",
        fillHeight ? "flex h-full min-h-0 flex-col" : "",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-wood/10 px-4 py-3">
        <div>
          <p className="text-[10px] font-bold tracking-wide text-wood/55">
            {classOnly ? "학급 랭킹" : "명예의 전당"}
          </p>
          <h2 className="font-display text-lg text-wood">
            {classOnly ? "학급 학생 포인트 순위" : "포인트 랭킹"}
          </h2>
        </div>
        {board.viewer.kind === "student" && board.viewer.worldRank ? (
          <p className="text-[11px] font-bold text-wood/70">
            전체 {board.viewer.worldRank}위
            {board.viewer.schoolRank ? ` · 학교 ${board.viewer.schoolRank}위` : ""}
            {board.viewer.classRank ? ` · 학급 ${board.viewer.classRank}위` : ""}
          </p>
        ) : null}
      </div>

      {classOnly ? null : (
        <div
          className="grid grid-cols-3 gap-1 bg-wood/5 p-1.5"
          role="tablist"
          aria-label="랭킹 범위"
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
                  "rounded-lg py-1.5 text-xs font-black transition",
                  active
                    ? "bg-white text-wood shadow-sm"
                    : "text-wood/60 hover:bg-white/60",
                ].join(" ")}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      <div
        className={[
          "overflow-y-auto p-3",
          fillHeight ? "min-h-0 flex-1" : "max-h-80",
        ].join(" ")}
      >
        {body}
      </div>
    </article>
  );
}
