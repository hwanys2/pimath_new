"use client";

import { useActionState } from "react";
import { requestPasswordReset, type AuthState } from "@/app/auth/actions";

const inputClass =
  "w-full rounded-xl border-2 border-wood/15 bg-white px-4 py-3 text-foreground outline-none transition placeholder:text-foreground/35 focus:border-sky focus:ring-2 focus:ring-sky/40";

const initialState: AuthState = {};

export default function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(
    requestPasswordReset,
    initialState,
  );

  if (state.message) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky/40 text-2xl">
          ✉️
        </div>
        <p className="text-sm leading-relaxed text-foreground/80">
          {state.message}
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <p className="text-sm leading-relaxed text-foreground/70">
        가입한 이메일을 입력하면 비밀번호 재설정 링크를 보내 드릴게요.
      </p>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-bold text-wood">
          이메일
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
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
        className="block-btn block-btn-sky font-display px-6 py-3 text-base disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "보내는 중…" : "재설정 메일 보내기"}
      </button>
    </form>
  );
}
