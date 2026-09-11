"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { updateDisplayName, type AuthState } from "@/app/auth/actions";
import { notifyAuthChange, useActor } from "@/components/auth/ActorProvider";

type Props = {
  name: string;
  /** `bar` = wood nav (legacy). `menu` = cream account dropdown. `page` = settings form. */
  variant?: "bar" | "menu" | "page";
};

const empty: AuthState = {};

const pageInputClass =
  "w-full rounded-xl border-2 border-wood/15 bg-white px-4 py-3 text-sm font-semibold text-wood-dark outline-none transition placeholder:text-wood/35 focus:border-sky focus:ring-2 focus:ring-sky/40 disabled:opacity-60";

export default function NicknameEditor({ name, variant = "bar" }: Props) {
  const router = useRouter();
  const { refresh } = useActor();
  const [editing, setEditing] = useState(false);
  const [shown, setShown] = useState(name);
  const [pageValue, setPageValue] = useState(name);
  const [state, formAction, pending] = useActionState(updateDisplayName, empty);
  const inputRef = useRef<HTMLInputElement>(null);
  const savedRef = useRef<string | undefined>(undefined);
  const skipBlurRef = useRef(false);
  const inMenu = variant === "menu";
  const onPage = variant === "page";

  useEffect(() => {
    setShown(name);
    setPageValue(name);
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
    setPageValue(state.nickname);
    setEditing(false);
    notifyAuthChange();
    void refresh();
    router.refresh();
  }, [state.nickname, router, refresh]);

  if (onPage) {
    const dirty = pageValue.trim() !== shown;
    return (
      <form action={formAction} className="space-y-2">
        <label htmlFor="settings-nickname" className="text-sm font-bold text-wood">
          닉네임
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="settings-nickname"
            name="nickname"
            value={pageValue}
            maxLength={20}
            disabled={pending}
            onChange={(event) => setPageValue(event.target.value)}
            className={pageInputClass}
          />
          <button
            type="submit"
            disabled={pending || !pageValue.trim() || !dirty}
            className="font-display shrink-0 rounded-xl bg-wood px-4 py-3 text-sm text-cream transition hover:brightness-110 disabled:opacity-50"
          >
            {pending ? "저장 중…" : "저장"}
          </button>
        </div>
        <p className="text-xs text-wood/50">{pageValue.trim().length}/20</p>
        {state.error ? (
          <p className="text-sm text-red-700" role="alert">
            {state.error}
          </p>
        ) : null}
        {state.message && !dirty ? (
          <p className="text-sm text-wood/70" role="status">
            {state.message}
          </p>
        ) : null}
      </form>
    );
  }

  if (!editing) {
    return (
      <button
        type="button"
        title="닉네임 바꾸기"
        aria-label={`${shown}, 닉네임 바꾸기`}
        onClick={() => setEditing(true)}
        className={
          inMenu
            ? "w-full truncate rounded-lg px-0 py-0.5 text-left text-sm font-semibold text-wood-dark transition hover:text-wood"
            : "hidden max-w-[8rem] truncate rounded-lg px-1.5 py-1 text-left text-sm font-semibold text-cream transition hover:bg-black/15 sm:inline"
        }
      >
        {shown}
        {inMenu ? (
          <span className="ml-1 text-[10px] font-semibold text-wood/45">
            수정
          </span>
        ) : null}
      </button>
    );
  }

  return (
    <form action={formAction} className={inMenu ? "block" : "hidden sm:block"}>
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
        className={
          inMenu
            ? "w-full rounded-lg border border-wood/25 bg-white/80 px-2 py-1 text-sm font-semibold text-wood-dark outline-none focus:border-wood/50 disabled:opacity-60"
            : "w-[8rem] rounded-lg border border-cream/25 bg-black/20 px-2 py-1 text-sm font-semibold text-cream outline-none focus:border-gold/70 disabled:opacity-60"
        }
      />
    </form>
  );
}
