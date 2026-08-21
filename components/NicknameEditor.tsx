"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { updateDisplayName, type AuthState } from "@/app/auth/actions";

type Props = {
  name: string;
};

const empty: AuthState = {};

export default function NicknameEditor({ name }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [shown, setShown] = useState(name);
  const [state, formAction, pending] = useActionState(updateDisplayName, empty);
  const inputRef = useRef<HTMLInputElement>(null);
  const savedRef = useRef<string | undefined>(undefined);
  const skipBlurRef = useRef(false);

  useEffect(() => {
    setShown(name);
  }, [name]);

  useEffect(() => {
    if (!editing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editing]);

  useEffect(() => {
    if (!state.nickname || state.nickname === savedRef.current) return;
    savedRef.current = state.nickname;
    setShown(state.nickname);
    setEditing(false);
    router.refresh();
  }, [state.nickname, router]);

  if (!editing) {
    return (
      <button
        type="button"
        title="닉네임 바꾸기"
        aria-label={`${shown}, 닉네임 바꾸기`}
        onClick={() => setEditing(true)}
        className="hidden max-w-[8rem] truncate rounded-lg px-1.5 py-1 text-left text-sm font-semibold text-cream transition hover:bg-black/15 sm:inline"
      >
        {shown}
      </button>
    );
  }

  return (
    <form action={formAction} className="hidden sm:block">
      <input
        ref={inputRef}
        name="nickname"
        defaultValue={shown}
        maxLength={20}
        disabled={pending}
        aria-label="닉네임"
        onBlur={(event) => {
          if (pending || skipBlurRef.current) {
            skipBlurRef.current = false;
            return;
          }
          const next = event.currentTarget.value.trim();
          if (!next || next === shown) {
            setEditing(false);
            return;
          }
          event.currentTarget.form?.requestSubmit();
        }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing || event.keyCode === 229) return;
          if (event.key === "Escape") {
            event.preventDefault();
            skipBlurRef.current = true;
            setEditing(false);
          }
        }}
        className="w-[8rem] rounded-lg border border-cream/25 bg-black/20 px-2 py-1 text-sm font-semibold text-cream outline-none focus:border-gold/70 disabled:opacity-60"
      />
    </form>
  );
}
