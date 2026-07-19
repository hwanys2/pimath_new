"use client";

import { useActionState } from "react";
import { createClass, type ActionResult } from "@/app/teacher/actions";

const inputClass =
  "w-full rounded-xl border-2 border-wood/15 bg-white px-4 py-3 text-foreground outline-none transition placeholder:text-foreground/35 focus:border-sky focus:ring-2 focus:ring-sky/40";

const initial: ActionResult = {};

export default function CreateClassForm() {
  const [state, action, pending] = useActionState(createClass, initial);

  return (
    <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex flex-1 flex-col gap-1.5">
        <label htmlFor="name" className="text-sm font-bold text-wood">
          학급 이름
        </label>
        <input
          id="name"
          name="name"
          required
          placeholder="예: 3학년 2반"
          className={inputClass}
        />
      </div>
      <div className="flex w-full flex-col gap-1.5 sm:w-36">
        <label htmlFor="grade" className="text-sm font-bold text-wood">
          학년
        </label>
        <select id="grade" name="grade" className={inputClass} defaultValue="">
          <option value="">선택 안 함</option>
          <option value="1">중1</option>
          <option value="2">중2</option>
          <option value="3">중3</option>
        </select>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="block-btn block-btn-gold font-display shrink-0 px-5 py-3 text-base disabled:opacity-60"
      >
        {pending ? "만드는 중…" : "학급 만들기"}
      </button>
      {state.error && (
        <p className="w-full rounded-xl bg-peach/40 px-3 py-2 text-sm font-semibold text-[#a63a1a] sm:basis-full">
          {state.error}
        </p>
      )}
    </form>
  );
}
