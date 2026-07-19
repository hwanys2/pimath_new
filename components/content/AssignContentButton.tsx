"use client";

import { useState, useTransition } from "react";
import {
  assignContentToClassActive,
  unassignContentFromClass,
  type ActionResult,
} from "@/app/teacher/actions";

export type TeacherClassOption = {
  id: string;
  name: string;
  grade: number | null;
};

type Props = {
  contentKey: string;
  classes: TeacherClassOption[];
  /** Class ids that already have this content assigned */
  assignedClassIds?: string[];
};

export default function AssignContentButton({
  contentKey,
  classes,
  assignedClassIds = [],
}: Props) {
  const [open, setOpen] = useState(false);
  const [assigned, setAssigned] = useState<Set<string>>(
    () => new Set(assignedClassIds),
  );
  const [feedback, setFeedback] = useState<ActionResult>({});
  const [pending, startTransition] = useTransition();

  if (classes.length === 0) {
    return (
      <a
        href="/teacher"
        className="inline-flex items-center justify-center rounded-xl bg-wood/10 px-4 py-2 text-sm font-bold text-wood no-underline hover:bg-wood/15"
      >
        학급 만들기
      </a>
    );
  }

  const assignedCount = assigned.size;

  function toggleClass(klass: TeacherClassOption) {
    const isAssigned = assigned.has(klass.id);

    if (isAssigned) {
      const ok = window.confirm(
        `「${klass.name}」에 대한 배정을 취소할까요?\n학생 목록에서도 사라져요.`,
      );
      if (!ok) return;

      startTransition(async () => {
        const fd = new FormData();
        fd.set("classId", klass.id);
        fd.set("contentKey", contentKey);
        const result = await unassignContentFromClass({}, fd);
        if (result.error) {
          setFeedback({ error: result.error });
          return;
        }
        setAssigned((prev) => {
          const next = new Set(prev);
          next.delete(klass.id);
          return next;
        });
        setFeedback({
          message: result.message ?? "배정을 취소했어요.",
        });
      });
      return;
    }

    startTransition(async () => {
      const fd = new FormData();
      fd.set("classId", klass.id);
      fd.set("contentKey", contentKey);
      const result = await assignContentToClassActive({}, fd);
      if (result.error) {
        setFeedback({ error: result.error });
        return;
      }
      setAssigned((prev) => new Set(prev).add(klass.id));
      setFeedback({
        message: result.message ?? "학급에 배정했어요.",
      });
    });
  }

  return (
    <div className="relative inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-xl bg-sky/50 px-4 py-2 text-sm font-bold text-wood shadow-[0_3px_0_rgba(139,94,60,0.15)] hover:bg-sky/70"
      >
        배정{assignedCount > 0 ? ` · ${assignedCount}` : ""}
      </button>

      {open ? (
        <div className="absolute top-full left-0 z-20 mt-2 w-72 rounded-2xl border-2 border-wood/15 bg-white p-3 shadow-xl">
          <p className="text-xs font-bold text-wood">학급 선택</p>
          <p className="mt-0.5 text-[11px] text-foreground/55">
            체크된 학급은 배정됨 · 다시 누르면 취소
          </p>
          <ul className="mt-2 flex max-h-56 flex-col gap-1.5 overflow-y-auto">
            {classes.map((klass) => {
              const isAssigned = assigned.has(klass.id);
              return (
                <li key={klass.id}>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => toggleClass(klass)}
                    className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-semibold disabled:opacity-50 ${
                      isAssigned
                        ? "bg-mint/25 text-foreground hover:bg-peach/30"
                        : "bg-wood/5 text-foreground hover:bg-mint/20"
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 text-[11px] font-black ${
                        isAssigned
                          ? "border-wood bg-mint text-wood"
                          : "border-wood/30 bg-white text-transparent"
                      }`}
                      aria-hidden
                    >
                      ✓
                    </span>
                    <span className="min-w-0 flex-1 truncate">{klass.name}</span>
                    {klass.grade != null ? (
                      <span className="shrink-0 text-[11px] text-foreground/45">
                        중{klass.grade}
                      </span>
                    ) : null}
                    <span className="sr-only">
                      {isAssigned ? "배정됨, 클릭하면 취소" : "미배정, 클릭하면 배정"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-2 w-full text-center text-[11px] font-semibold text-foreground/45 hover:text-wood"
          >
            닫기
          </button>
        </div>
      ) : null}

      {feedback.message || feedback.error ? (
        <p
          className={`max-w-[18rem] text-xs font-semibold ${
            feedback.error ? "text-[#a63a1a]" : "text-wood/80"
          }`}
        >
          {feedback.error ?? feedback.message}
        </p>
      ) : null}
    </div>
  );
}
