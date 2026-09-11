"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import AccountMenu from "@/components/AccountMenu";
import NotificationBell from "@/components/NotificationBell";
import { GRADES } from "@/lib/grades";
import { OPEN_CHAT_URL } from "@/lib/site-links";
import { TOOLS } from "@/lib/tools";
import type { TeacherActor } from "@/lib/auth-types";

function navPillClass(active: boolean, extra = "") {
  return `font-display whitespace-nowrap rounded-xl px-2 py-2 text-center text-sm transition md:px-5 md:text-base ${extra} ${
    active
      ? "bg-cream text-wood-dark shadow-[0_3px_0_rgba(0,0,0,0.25)]"
      : "bg-black/15 text-cream hover:bg-black/25"
  }`;
}

function ToolsMenu({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const active =
    pathname === "/board" ||
    pathname === "/tools" ||
    pathname.startsWith("/tools/");

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

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
    <div ref={ref} className="relative min-w-0 md:flex-none">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`${navPillClass(active, "flex h-full w-full items-center justify-center gap-1")}`}
      >
        도구
        <span
          className={`text-[10px] transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          ▼
        </span>
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(15rem,calc(100vw-1.5rem))] rounded-2xl border-2 border-wood/20 bg-cream p-1.5 shadow-xl md:left-1/2 md:right-auto md:-translate-x-1/2">
          {TOOLS.map((tool) => {
            const toolActive =
              pathname === tool.href || pathname.startsWith(`${tool.href}/`);
            return (
              <Link
                key={tool.key}
                href={tool.href}
                onClick={() => setOpen(false)}
                className={`font-display flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm transition ${
                  toolActive
                    ? "bg-wood/15 text-wood-dark"
                    : "text-wood-dark hover:bg-wood/10"
                }`}
              >
                <span aria-hidden>{tool.emoji}</span>
                {tool.label}
              </Link>
            );
          })}
          <div className="mt-0.5 border-t border-wood/10 pt-0.5">
            <Link
              href="/tools"
              onClick={() => setOpen(false)}
              className="block rounded-xl px-3 py-2 text-center text-xs font-semibold text-wood/70 transition hover:bg-wood/10"
            >
              모든 도구 보기
            </Link>
            <a
              href={OPEN_CHAT_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="font-display flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-wood-dark transition hover:bg-wood/10"
            >
              <span aria-hidden>💬</span>
              오픈채팅방
              <span aria-hidden className="ml-auto text-[10px] opacity-50">
                ↗
              </span>
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AuthLinks({ actor }: { actor: TeacherActor | null }) {
  if (actor) {
    return (
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <NotificationBell />
        <AccountMenu actor={actor} />
      </div>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
      <Link
        href="/login"
        className="font-display whitespace-nowrap rounded-xl bg-black/15 px-2.5 py-2 text-sm text-cream transition hover:bg-black/25 sm:px-3"
      >
        로그인
      </Link>
      <Link
        href="/signup"
        className="font-display whitespace-nowrap rounded-xl bg-gold px-2.5 py-2 text-sm text-[#6b4a00] shadow-[0_3px_0_rgba(107,74,0,0.3)] transition hover:brightness-105 active:translate-y-0.5 sm:px-3"
      >
        가입
      </Link>
    </div>
  );
}

export default function TopMenuBar({
  actor,
}: {
  actor: TeacherActor | null;
}) {
  const pathname = usePathname();

  return (
    <header className="px-3 pt-3 sm:px-4 sm:pt-4">
      <nav className="wood-bar mx-auto flex max-w-6xl flex-wrap items-center gap-x-2 gap-y-0 rounded-2xl px-2.5 py-2 sm:px-5 sm:py-3 md:flex-nowrap md:gap-4">
        <Link
          href="/"
          aria-label="홈"
          className="flex shrink-0 items-center gap-2 rounded-xl bg-black/10 px-1.5 py-1 transition hover:bg-black/20 sm:px-2"
        >
          <Image
            src="/images/mascot-v2.png"
            alt="마스코트"
            width={40}
            height={40}
            className="h-8 w-8 rounded-full border-2 border-white/40 object-cover shadow sm:h-10 sm:w-10"
          />
          <div className="hidden leading-tight md:block">
            <p className="font-display text-base text-cream drop-shadow-sm sm:text-lg">
              수학하는 즐거움
            </p>
            <p className="text-[10px] font-semibold tracking-wide text-wood-light/90">
              Pleasure in Math
            </p>
          </div>
        </Link>

        <div className="order-3 grid w-full min-w-0 grid-cols-4 gap-1 border-t border-black/15 pt-2 md:order-2 md:flex md:w-auto md:flex-1 md:justify-center md:gap-2 md:border-t-0 md:pt-0">
          {GRADES.map((grade) => {
            const href = `/grade/${grade.id}`;
            const active =
              pathname === href || pathname.startsWith(`${href}/`);

            return (
              <Link
                key={grade.id}
                href={href}
                className={navPillClass(active, "min-w-0")}
              >
                {grade.label}
              </Link>
            );
          })}
          <ToolsMenu pathname={pathname} />
        </div>

        <div className="order-2 ml-auto md:order-3 md:ml-0">
          <AuthLinks actor={actor} />
        </div>
      </nav>
    </header>
  );
}
