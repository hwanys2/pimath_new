"use client";

import { useActionState, useState } from "react";
import {
  assignContentToClassActive,
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
};

const empty: ActionResult = {};

export default function AssignContentButton({ contentKey, classes }: Props) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(
    assignContentToClassActive,
    empty,
  );

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

  return (
    <div className="relative inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-xl bg-sky/50 px-4 py-2 text-sm font-bold text-wood shadow-[0_3px_0_rgba(139,94,60,0.15)] hover:bg-sky/70"
      >
        배정
      </button>

      {open ? (
        <div className="absolute top-full left-0 z-20 mt-2 w-64 rounded-2xl border-2 border-wood/15 bg-white p-3 shadow-xl">
          <p className="text-xs font-bold text-wood">학급 선택</p>
          <p className="mt-0.5 text-[11px] text-foreground/55">
            담아두고 바로 활성화해요
          </p>
          <ul className="mt-2 flex max-h-56 flex-col gap-1.5 overflow-y-auto">
            {classes.map((klass) => (
              <li key={klass.id}>
                <form
                  action={action}
                  onSubmit={() => {
                    window.setTimeout(() => setOpen(false), 400);
                  }}
                >
                  <input type="hidden" name="classId" value={klass.id} />
                  <input type="hidden" name="contentKey" value={contentKey} />
                  <button
                    type="submit"
                    disabled={pending}
                    className="flex w-full items-center justify-between rounded-xl bg-wood/5 px-3 py-2 text-left text-sm font-semibold text-foreground hover:bg-mint/30 disabled:opacity-50"
                  >
                    <span className="truncate">{klass.name}</span>
                    {klass.grade != null ? (
                      <span className="ml-2 shrink-0 text-[11px] text-foreground/45">
                        중{klass.grade}
                      </span>
                    ) : null}
                  </button>
                </form>
              </li>
            ))}
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

      {state.message || state.error ? (
        <p
          className={`max-w-[16rem] text-xs font-semibold ${
            state.error ? "text-[#a63a1a]" : "text-wood/80"
          }`}
        >
          {state.error ?? state.message}
        </p>
      ) : null}
    </div>
  );
}
