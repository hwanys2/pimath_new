"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { reorderClasses } from "@/app/teacher/actions";
import ClassQuickNav from "@/components/teacher/ClassQuickNav";
import DeleteClassButton from "@/components/teacher/DeleteClassButton";

export type TeacherClassCard = {
  id: string;
  name: string;
  grade: number | null;
  studentCount: number;
  todayActivity: number;
};

const DRAG_THRESHOLD = 8;

export default function TeacherClassList({
  classes,
}: {
  classes: TeacherClassCard[];
}) {
  const [items, setItems] = useState(classes);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const origin = useRef<{
    x: number;
    y: number;
    id: string;
    pointerId: number;
    started: boolean;
  } | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setItems(classes);
  }, [classes]);

  function move(fromId: string, toId: string) {
    if (fromId === toId) return;
    setItems((prev) => {
      const from = prev.findIndex((c) => c.id === fromId);
      const to = prev.findIndex((c) => c.id === toId);
      if (from < 0 || to < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function persist() {
    const ids = itemsRef.current.map((c) => c.id);
    startTransition(async () => {
      await reorderClasses(ids);
    });
  }

  function onPointerDown(event: React.PointerEvent<HTMLLIElement>, id: string) {
    if (event.button !== 0) return;
    if (
      (event.target as HTMLElement).closest("a, button, input, select, textarea")
    ) {
      return;
    }
    origin.current = {
      x: event.clientX,
      y: event.clientY,
      id,
      pointerId: event.pointerId,
      started: false,
    };
  }

  function onPointerMove(event: React.PointerEvent<HTMLLIElement>) {
    const start = origin.current;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (!start.started) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      start.started = true;
      setActiveId(start.id);
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    event.preventDefault();
    const el = document.elementFromPoint(event.clientX, event.clientY);
    const card = el?.closest("[data-class-id]") as HTMLElement | null;
    const toId = card?.dataset.classId;
    if (toId) move(start.id, toId);
  }

  function onPointerUp() {
    const start = origin.current;
    origin.current = null;
    if (!start?.started) {
      setActiveId(null);
      return;
    }
    setActiveId(null);
    persist();
  }

  return (
    <>
      <p className="mt-1 text-sm text-foreground/55">
        카드를 끌어서 순서를 바꿀 수 있어요. 드롭다운 등 다른 화면도 이 순서를
        따라가요.
      </p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {items.map((c) => {
          const dragging = activeId === c.id;
          return (
            <li
              key={c.id}
              data-class-id={c.id}
              onPointerDown={(event) => onPointerDown(event, c.id)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              className={[
                "quest-card flex cursor-grab flex-col gap-3 p-5 select-none",
                dragging ? "cursor-grabbing opacity-70 ring-2 ring-gold/70" : "",
                isPending ? "pointer-events-none" : "",
              ].join(" ")}
              style={{ touchAction: activeId ? "none" : "pan-y" }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2">
                  <span
                    aria-hidden
                    className="mt-1 shrink-0 text-wood/35"
                    title="끌어서 순서 변경"
                  >
                    ⋮⋮
                  </span>
                  <div className="min-w-0">
                    <Link
                      href={`/teacher/classes/${c.id}`}
                      className="font-display text-xl text-foreground underline-offset-2 hover:underline"
                    >
                      {c.name}
                    </Link>
                    <p className="mt-1 text-sm text-foreground/60">
                      {c.grade ? `중${c.grade} · ` : ""}
                      학생 {c.studentCount}명
                      {c.todayActivity > 0 ? (
                        <span className="ml-2 rounded-full bg-mint/40 px-2 py-0.5 text-[11px] font-bold text-wood">
                          오늘 {c.todayActivity}건
                        </span>
                      ) : null}
                    </p>
                  </div>
                </div>
                <DeleteClassButton
                  classId={c.id}
                  name={c.name}
                  studentCount={c.studentCount}
                />
              </div>
              <ClassQuickNav classId={c.id} />
            </li>
          );
        })}
      </ul>
    </>
  );
}
