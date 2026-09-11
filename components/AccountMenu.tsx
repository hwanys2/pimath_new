"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import NicknameEditor from "@/components/NicknameEditor";
import { useActor } from "@/components/auth/ActorProvider";
import { isAdminEmail } from "@/lib/admin";
import type { TeacherActor } from "@/lib/auth-types";

export default function AccountMenu({ actor }: { actor: TeacherActor }) {
  const pathname = usePathname();
  const { logout } = useActor();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const teacherActive = pathname.startsWith("/teacher");
  const settingsActive = pathname.startsWith("/settings");
  const mailingActive = pathname.startsWith("/admin/mailing");
  const isAdmin = isAdminEmail(actor.email);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="계정 메뉴"
        className={`font-display flex max-w-[10rem] items-center gap-1.5 rounded-xl px-3 py-2 text-sm transition sm:max-w-[12rem] ${
          open || teacherActive || settingsActive || mailingActive
            ? "bg-cream text-wood-dark shadow-[0_3px_0_rgba(0,0,0,0.25)]"
            : "bg-black/15 text-cream hover:bg-black/25"
        }`}
      >
        <span className="truncate">{actor.name}</span>
        <span
          className={`shrink-0 text-[10px] transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          ▼
        </span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-2xl border-2 border-wood/20 bg-cream p-1.5 shadow-xl"
        >
          <div className="rounded-xl px-3 py-2">
            <p className="text-[10px] font-bold tracking-wide text-wood/45 uppercase">
              교사
            </p>
            <div className="mt-1">
              <NicknameEditor name={actor.name} variant="menu" />
            </div>
          </div>

          <div className="my-0.5 border-t border-wood/10" />

          <Link
            href="/teacher"
            role="menuitem"
            onClick={() => setOpen(false)}
            className={`font-display flex items-center rounded-xl px-3 py-2.5 text-sm transition ${
              teacherActive
                ? "bg-wood/15 text-wood-dark"
                : "text-wood-dark hover:bg-wood/10"
            }`}
          >
            내 학급
          </Link>

          <Link
            href="/settings"
            role="menuitem"
            onClick={() => setOpen(false)}
            className={`font-display flex items-center rounded-xl px-3 py-2.5 text-sm transition ${
              settingsActive
                ? "bg-wood/15 text-wood-dark"
                : "text-wood-dark hover:bg-wood/10"
            }`}
          >
            설정
          </Link>

          {isAdmin ? (
            <Link
              href="/admin/mailing"
              role="menuitem"
              onClick={() => setOpen(false)}
              className={`font-display flex items-center rounded-xl px-3 py-2.5 text-sm transition ${
                mailingActive
                  ? "bg-wood/15 text-wood-dark"
                  : "text-wood-dark hover:bg-wood/10"
              }`}
            >
              메일 발송
            </Link>
          ) : null}

          <form action={logout}>
            <button
              type="submit"
              role="menuitem"
              className="font-display flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm text-wood-dark transition hover:bg-wood/10"
            >
              로그아웃
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
