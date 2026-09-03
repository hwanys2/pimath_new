"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type RefObject,
} from "react";
import { fetchHofBoardAction } from "@/app/hof/actions";
import { hofMyPlace } from "@/lib/hof-display";
import type {
  HofBoard,
  HofClassRow,
  HofSchoolRow,
  HofStudentRow,
  HofTab,
} from "@/lib/hall-of-fame";

type HofUiTab = "world" | "school" | "class" | "schools";

const TABS: { id: HofUiTab; label: string }[] = [
  { id: "world", label: "전체" },
  { id: "school", label: "학교" },
  { id: "class", label: "학급" },
  { id: "schools", label: "학교별" },
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

function MyPlaceBanner({
  rank,
  label,
}: {
  rank: number;
  label: string;
}) {
  return (
    <p className="mb-2 rounded-xl bg-mint/45 px-3 py-2 text-center text-xs font-black text-wood ring-1 ring-mint/70">
      {label}에서 나는{" "}
      <span className="font-display text-base">{rank}</span>등
    </p>
  );
}

function StudentRows({
  rows,
  showSchool,
  meRef,
}: {
  rows: HofStudentRow[];
  showSchool: boolean;
  meRef: RefObject<HTMLLIElement | null>;
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
            className="py-1 text-center text-[10px] font-black tracking-[0.35em] text-wood/30"
          >
            ···
          </li>
        ) : (
          <li
            key={`s-${item.row.rank}-${item.row.displayName}`}
            ref={item.row.isMe ? meRef : undefined}
            className={[
              "flex items-center gap-2 rounded-xl px-2 py-1.5",
              item.row.isMe
                ? "bg-mint/50 ring-2 ring-wood/25 shadow-[0_2px_0_rgba(139,94,60,0.12)]"
                : "bg-wood/5",
            ].join(" ")}
          >
            <RankBadge rank={item.row.rank} />
            <span className="min-w-0 flex-1">
              <span
                className={[
                  "block truncate font-bold text-foreground",
                  item.row.isMe ? "font-display text-base" : "text-sm",
                ].join(" ")}
              >
                {item.row.displayName}
                {item.row.isMe ? (
                  <span className="ml-1 inline-flex rounded-full bg-wood px-1.5 py-0.5 align-middle text-[9px] font-black text-cream">
                    나
                  </span>
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
  const [uiTab, setUiTab] = useState<HofUiTab>(
    initial.tab === "class"
      ? "class"
      : initial.tab === "school"
        ? "school"
        : "world",
  );
  const [drillSchool, setDrillSchool] = useState(initial.tab === "school");
  const [drillClass, setDrillClass] = useState(
    initial.tab === "class" &&
      (Boolean(lockClassId) ||
        classOnly ||
        initial.viewer.kind === "student" ||
        myClasses.length > 0),
  );
  const [isPending, startTransition] = useTransition();
  const meRef = useRef<HTMLLIElement>(null);

  const teacherClassId = activeClassId ?? myClasses[0]?.id ?? null;
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

  const changeTab = (tab: HofUiTab) => {
    if (tab === uiTab) return;
    setUiTab(tab);
    if (tab === "class") {
      const classId =
        lockClassId ??
        teacherClassId ??
        (board.viewer.kind === "student" ? board.viewer.classId : null);
      const shouldDrill = Boolean(classId) || classOnly;
      setDrillClass(shouldDrill);
      setDrillSchool(false);
      if (classId) setActiveClassId(classId);
      load("class", board.selectedSchoolId, classId);
      return;
    }
    setDrillClass(false);
    if (tab === "school") {
      const schoolId = board.viewer.schoolInfoId;
      setDrillSchool(true);
      if (schoolId == null) return;
      load("school", schoolId, effectiveLock ?? board.selectedClassId);
      return;
    }
    if (tab === "schools") {
      setDrillSchool(false);
      load("school", board.selectedSchoolId, effectiveLock ?? board.selectedClassId);
      return;
    }
    setDrillSchool(false);
    load("world", board.selectedSchoolId, effectiveLock ?? board.selectedClassId);
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

  const showSchoolStudents =
    board.tab === "school" && (uiTab === "school" || drillSchool);
  const showSchoolsBoard =
    board.tab === "school" && uiTab === "schools" && !drillSchool;
  const showClassStudents =
    board.tab === "class" && (drillClass || classOnly);

  const selectedClassName =
    myClasses.find((klass) => klass.id === (activeClassId ?? board.selectedClassId))
      ?.name ??
    selectedClass?.className ??
    "학급 학생";

  const viewingOwnSchool =
    board.selectedSchoolId != null &&
    board.selectedSchoolId === board.viewer.schoolInfoId;
  const viewingOwnClass =
    (activeClassId ?? board.selectedClassId) != null &&
    (activeClassId ?? board.selectedClassId) === board.viewer.classId;

  const mySchoolPlace = showSchoolStudents
    ? hofMyPlace({
        students: board.students,
        viewingOwnGroup: viewingOwnSchool,
        viewerRank: board.viewer.schoolRank,
      })
    : null;
  const myClassPlace = showClassStudents
    ? hofMyPlace({
        students: board.students,
        viewingOwnGroup: viewingOwnClass,
        viewerRank: board.viewer.classRank,
      })
    : null;
  const myWorldPlace =
    board.tab === "world"
      ? hofMyPlace({
          students: board.students,
          viewingOwnGroup: board.viewer.kind === "student",
          viewerRank: board.viewer.worldRank,
        })
      : null;

  useEffect(() => {
    if (isPending) return;
    meRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [
    isPending,
    board.tab,
    board.selectedSchoolId,
    board.selectedClassId,
    showSchoolStudents,
    showClassStudents,
  ]);

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

  const title = classOnly
    ? "학급 학생 포인트 순위"
    : uiTab === "schools" && !showSchoolStudents
      ? "학교별 랭킹"
      : uiTab === "school"
        ? "우리 학교"
        : uiTab === "schools" && showSchoolStudents
          ? (selectedSchool?.schoolName ?? "학교 안 순위")
          : uiTab === "class" && !showClassStudents
            ? "학급 대항전"
            : uiTab === "class"
              ? "우리 학급"
              : "포인트 랭킹";

  const body = isPending ? (
    <p className="py-6 text-center text-xs text-foreground/40">불러오는 중…</p>
  ) : uiTab === "school" && board.viewer.schoolInfoId == null ? (
    <p className="py-6 text-center text-xs text-foreground/40">
      아직 우리 학교가 등록되지 않았어요
    </p>
  ) : board.tab === "world" && !classOnly ? (
    <div>
      {myWorldPlace ? (
        <MyPlaceBanner rank={myWorldPlace} label="전체" />
      ) : null}
      <StudentRows rows={board.students} showSchool meRef={meRef} />
    </div>
  ) : showSchoolsBoard && !classOnly ? (
    board.schools.length === 0 ? (
      <p className="py-6 text-center text-xs text-foreground/40">
        학교가 등록되면 대항전이 열려요
      </p>
    ) : (
      <div>
        <p className="mb-2 text-[11px] font-semibold text-foreground/50">
          학교 누적 XP 합 · 다른 학교를 누르면 그 학교 학생 순위를 봐요
        </p>
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
      </div>
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
      {uiTab === "schools" && showSchoolStudents && !lockClassId && !classOnly ? (
        <button
          type="button"
          onClick={() => setDrillSchool(false)}
          className="mb-2 text-[11px] font-bold text-wood/70 underline-offset-2 hover:underline"
        >
          ← 학교별 랭킹
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
      {board.tab === "school" && mySchoolPlace ? (
        <MyPlaceBanner
          rank={mySchoolPlace}
          label={selectedSchool?.schoolName ?? "이 학교"}
        />
      ) : null}
      {board.tab === "class" && myClassPlace ? (
        <MyPlaceBanner rank={myClassPlace} label={selectedClassName} />
      ) : null}
      <StudentRows
        rows={board.students}
        showSchool={board.tab !== "class"}
        meRef={meRef}
      />
    </div>
  );

  return (
    <article
      className={[
        "quest-card-static flex min-h-0 flex-col overflow-hidden",
        fillHeight ? "h-full" : "max-h-[30rem]",
      ].join(" ")}
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-wood/10 px-4 py-3">
        <div>
          <p className="text-[10px] font-bold tracking-wide text-wood/55">
            {classOnly ? "학급 랭킹" : "명예의 전당"}
          </p>
          <h2 className="font-display text-lg text-wood">{title}</h2>
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
          className="grid shrink-0 grid-cols-4 gap-0.5 bg-wood/5 p-1.5"
          role="tablist"
          aria-label="랭킹 범위"
        >
          {TABS.map((tab) => {
            const active = uiTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => changeTab(tab.id)}
                className={[
                  "truncate rounded-lg px-0.5 py-1.5 text-[11px] font-black transition sm:text-xs",
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
          "min-h-0 flex-1 overflow-y-auto overscroll-contain p-3",
          fillHeight ? "" : "max-h-72",
        ].join(" ")}
      >
        {body}
      </div>
    </article>
  );
}
