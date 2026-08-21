"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { updateDisplayName } from "@/app/auth/actions";

type Props = {
  name: string;
};

export default function NicknameEditor({ name }: Props) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    setValue(name);
  }, [name]);

  useEffect(() => {
    if (!editing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editing]);

  function cancel() {
    setValue(name);
    setEditing(false);
  }

  function save() {
    if (savingRef.current || pending) return;
    const next = value.trim();
    if (!next || next === name) {
      cancel();
      return;
    }
    savingRef.current = true;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("nickname", next);
      const result = await updateDisplayName(fd);
      savingRef.current = false;
      if (result.error) {
        setValue(name);
      }
      setEditing(false);
    });
  }

  if (!editing) {
    return (
      <button
        type="button"
        title="닉네임 바꾸기"
        aria-label={`${name}, 닉네임 바꾸기`}
        onClick={() => setEditing(true)}
        className="hidden max-w-[8rem] truncate rounded-lg px-1.5 py-1 text-left text-sm font-semibold text-cream transition hover:bg-black/15 sm:inline"
      >
        {name}
      </button>
    );
  }

  return (
    <input
      ref={inputRef}
      value={value}
      maxLength={20}
      disabled={pending}
      aria-label="닉네임"
      onChange={(event) => setValue(event.target.value)}
      onBlur={save}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          save();
        }
        if (event.key === "Escape") {
          event.preventDefault();
          cancel();
        }
      }}
      className="hidden w-[8rem] rounded-lg border border-cream/25 bg-black/20 px-2 py-1 text-sm font-semibold text-cream outline-none focus:border-gold/70 sm:inline disabled:opacity-60"
    />
  );
}
