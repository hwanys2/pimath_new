"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import NicknameEditor from "@/components/NicknameEditor";
import { useActor } from "@/components/auth/ActorProvider";
import {
  LogoutIcon,
  MailIcon,
  SettingsIcon,
  UsersIcon,
} from "@/components/icons";
import { isAdminEmail } from "@/lib/admin";
import type { TeacherActor } from "@/lib/auth-types";

const itemBase =
  "font-display flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition";

function MenuItem({
  href,
  active,
  onClick,
  icon,
  children,
}: {
  href: string;
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onClick}
      className={`${itemBase} ${
        active
          ? "bg-wood/15 text-wood-dark"
          : "text-wood-dark hover:bg-wood/10"
      }`}
    >
      <span className="shrink-0 text-wood/55">{icon}</span>
      {children}
    </Link>
  );
}

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
        className={`font-display flex max-w-[6.5rem] items-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 py-2 text-sm transition sm:max-w-[12rem] sm:px-3 ${
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

          <MenuItem
            href="/teacher"
            active={teacherActive}
            onClick={() => setOpen(false)}
            icon={<UsersIcon className="h-4 w-4" />}
          >
            내 학급
          </MenuItem>

          <MenuItem
            href="/settings"
            active={settingsActive}
            onClick={() => setOpen(false)}
            icon={<SettingsIcon className="h-4 w-4" />}
          >
            설정
          </MenuItem>

          {isAdmin ? (
            <MenuItem
              href="/admin/mailing"
              active={mailingActive}
              onClick={() => setOpen(false)}
              icon={<MailIcon className="h-4 w-4" />}
            >
              메일 발송
            </MenuItem>
          ) : null}

          <div className="my-0.5 border-t border-wood/10" />

          <form action={logout}>
            <button
              type="submit"
              role="menuitem"
              className={`${itemBase} w-full text-left text-wood-dark hover:bg-wood/10`}
            >
              <span className="shrink-0 text-wood/55">
                <LogoutIcon className="h-4 w-4" />
              </span>
              로그아웃
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
