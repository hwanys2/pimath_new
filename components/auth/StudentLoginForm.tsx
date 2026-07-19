"use client";

import { useActionState } from "react";
import { signInAsStudent, type AuthState } from "@/app/auth/actions";

const inputClass =
  "w-full rounded-xl border-2 border-wood/15 bg-white px-4 py-3 text-foreground outline-none transition placeholder:text-foreground/35 focus:border-sky focus:ring-2 focus:ring-sky/40";

const initialState: AuthState = {};

export default function StudentLoginForm() {
  const [state, action, pending] = useActionState(
    signInAsStudent,
    initialState,
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <p className="rounded-xl bg-mint/20 px-3 py-2 text-xs leading-relaxed text-foreground/70">
        선생님이 알려 준{" "}
        <span className="font-semibold text-wood">아이디와 비밀번호</span>로
        로그인해요.
      </p>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="loginId" className="text-sm font-bold text-wood">
          아이디
        </label>
        <input
          id="loginId"
          name="loginId"
          type="text"
          autoComplete="username"
          required
          placeholder="학생 아이디"
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-bold text-wood">
          비밀번호
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="비밀번호"
          className={inputClass}
        />
      </div>

      {state.error && (
        <p className="rounded-xl bg-peach/40 px-3 py-2 text-sm font-semibold text-[#a63a1a]">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="block-btn block-btn-mint font-display px-6 py-3 text-base disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "로그인 중…" : "학생 로그인"}
      </button>
    </form>
  );
}
