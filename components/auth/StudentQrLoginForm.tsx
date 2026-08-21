"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  signInWithStudentQrToken,
  type AuthState,
} from "@/app/auth/actions";

const initialState: AuthState = {};

export default function StudentQrLoginForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(
    signInWithStudentQrToken,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const key = `pm-qr-login:${token}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    formRef.current?.requestSubmit();
  }, [token]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <p className="rounded-xl bg-mint/20 px-3 py-2 text-sm leading-relaxed text-foreground/70">
        카메라로 찍은 QR로 바로 들어갈게요.
      </p>
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
        {pending ? "들어가는 중…" : "입장"}
      </button>
    </form>
  );
}
