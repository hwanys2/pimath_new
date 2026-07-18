"use client";

import { useActionState } from "react";
import { updatePassword, type AuthState } from "@/app/auth/actions";

const inputClass =
  "w-full rounded-xl border-2 border-wood/15 bg-white px-4 py-3 text-foreground outline-none transition placeholder:text-foreground/35 focus:border-mint focus:ring-2 focus:ring-mint/40";

const initialState: AuthState = {};

export default function ResetPasswordForm() {
  const [state, action, pending] = useActionState(
    updatePassword,
    initialState,
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-bold text-wood">
          새 비밀번호
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
          새 비밀번호 확인
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
        {pending ? "저장 중…" : "비밀번호 바꾸기"}
      </button>
    </form>
  );
}
