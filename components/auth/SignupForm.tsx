"use client";

import { useActionState } from "react";
import { signUpWithEmail, type AuthState } from "@/app/auth/actions";

const inputClass =
  "w-full rounded-xl border-2 border-wood/15 bg-white px-4 py-3 text-foreground outline-none transition placeholder:text-foreground/35 focus:border-mint focus:ring-2 focus:ring-mint/40";

const initialState: AuthState = {};

export default function SignupForm() {
  const [state, action, pending] = useActionState(
    signUpWithEmail,
    initialState,
  );

  if (state.message) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-mint/50 text-2xl">
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

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-bold text-wood">
          비밀번호
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="8자 이상"
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="confirm" className="text-sm font-bold text-wood">
          비밀번호 확인
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="비밀번호를 다시 입력"
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
        {pending ? "가입 중…" : "회원가입"}
      </button>
    </form>
  );
}
