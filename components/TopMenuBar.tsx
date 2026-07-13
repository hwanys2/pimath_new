"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { GRADES } from "@/lib/grades";

export default function TopMenuBar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 px-3 pt-3 sm:px-4 sm:pt-4">
      <nav className="wood-bar mx-auto flex max-w-6xl items-center gap-3 rounded-2xl px-3 py-2.5 sm:gap-4 sm:px-5 sm:py-3">
        <Link
          href="/"
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
              MATH ADVENTURE
            </p>
          </div>
        </Link>

        <div className="flex flex-1 items-center justify-center gap-1.5 sm:gap-2">
          {GRADES.map((grade) => {
            const href = `/grade/${grade.id}`;
            const active =
              pathname === href || pathname.startsWith(`${href}/`);

            return (
              <Link
                key={grade.id}
                href={href}
                className={`font-display rounded-xl px-3 py-2 text-sm transition sm:px-5 sm:text-base ${
                  active
                    ? "bg-cream text-wood-dark shadow-[0_3px_0_rgba(0,0,0,0.25)]"
                    : "bg-black/15 text-cream hover:bg-black/25"
                }`}
              >
                {grade.label}
              </Link>
            );
          })}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <span className="badge-pill">Lv.1 탐험가</span>
          <div className="w-24">
            <div className="xp-bar">
              <div className="xp-bar-fill" style={{ width: "28%" }} />
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
}
