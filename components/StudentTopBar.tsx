"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/auth/actions";
import type { StudentActor } from "@/lib/auth";
import { resolveAvatar } from "@/lib/progression";

export default function StudentTopBar({ actor }: { actor: StudentActor }) {
  const pathname = usePathname();
  const avatar = resolveAvatar(actor.level, actor.activeAvatar);
  const onAdventure =
    pathname === "/adventure" || pathname.startsWith("/adventure/");

  return (
    <header className="sticky top-0 z-50 px-3 pt-3 sm:px-4 sm:pt-4">
      <nav className="wood-bar mx-auto flex max-w-6xl items-center gap-3 rounded-2xl px-3 py-2.5 sm:gap-4 sm:px-5 sm:py-3">
        <Link
          href="/adventure"
          className="flex shrink-0 items-center gap-2 rounded-xl bg-black/10 px-2 py-1 transition hover:bg-black/20"
        >
          <Image
            src="/images/mascot-v2.png"
            alt="마스코트"
            width={40}
            height={40}
            className="h-9 w-9 rounded-full border-2 border-white/40 object-cover shadow sm:h-10 sm:w-10"
            priority
          />
          <div className="hidden leading-tight sm:block">
            <p className="font-display text-base text-cream drop-shadow-sm sm:text-lg">
              수학하는 즐거움
            </p>
            <p className="text-[10px] font-semibold tracking-wide text-wood-light/90">
              MY ADVENTURE
            </p>
          </div>
        </Link>

        <div className="flex flex-1 items-center justify-center">
          <Link
            href="/adventure"
            className={`font-display rounded-xl px-3 py-2 text-sm transition sm:px-5 sm:text-base ${
              onAdventure
                ? "bg-cream text-wood-dark shadow-[0_3px_0_rgba(0,0,0,0.25)]"
                : "bg-black/15 text-cream hover:bg-black/25"
            }`}
          >
            {actor.className || "나의 모험"}
          </Link>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/adventure"
            className={`flex items-center gap-1.5 rounded-xl px-2 py-1.5 transition ${
              onAdventure
                ? "bg-gold text-[#6b4a00] shadow-[0_3px_0_rgba(107,74,0,0.3)]"
                : "bg-black/15 text-cream hover:bg-black/25"
            }`}
          >
            <Image
              src={avatar.image}
              alt=""
              width={28}
              height={28}
              className="h-7 w-7 object-contain"
            />
            <span className="font-display text-sm">Lv.{actor.level}</span>
          </Link>
          <span className="hidden max-w-[8rem] truncate text-sm font-semibold text-cream sm:inline">
            {actor.name}
          </span>
          <form action={signOut}>
            <button
              type="submit"
              className="font-display rounded-xl bg-black/15 px-3 py-2 text-sm text-cream transition hover:bg-black/25"
            >
              로그아웃
            </button>
          </form>
        </div>
      </nav>
    </header>
  );
}
