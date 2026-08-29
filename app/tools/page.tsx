import type { Metadata } from "next";
import Link from "next/link";
import { TOOLS } from "@/lib/tools";

export const metadata: Metadata = {
  title: "수업 도구 | 수학하는 즐거움",
  description: "전자칠판, 그래프 탐구 등 수학 수업을 위한 도구 모음",
};

export default function ToolsPage() {
  return (
    <div className="space-y-8">
      <header className="text-center">
        <h1 className="font-display text-3xl text-wood-dark sm:text-4xl">
          🧰 수업 도구
        </h1>
        <p className="mt-2 text-foreground/70">
          수업에서 바로 꺼내 쓰는 수학 도구들이에요. 학년에 상관없이 언제든
          활용할 수 있어요.
        </p>
      </header>

      <div className="grid gap-5 sm:grid-cols-2">
        {TOOLS.map((tool) => (
          <Link
            key={tool.key}
            href={tool.href}
            className={`group rounded-3xl border-2 border-wood/15 bg-gradient-to-br ${tool.accentClass} p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg`}
          >
            <div className="flex items-start gap-4">
              <span className="text-4xl" aria-hidden>
                {tool.emoji}
              </span>
              <div>
                <h2 className="font-display text-xl text-wood-dark">
                  {tool.title}
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-foreground/75">
                  {tool.description}
                </p>
                {tool.teacherOnly ? (
                  <span className="mt-3 inline-block rounded-full bg-white/60 px-2.5 py-0.5 text-xs font-semibold text-wood">
                    방 만들기는 교사 로그인 필요 · 학생은 QR로 참여
                  </span>
                ) : null}
              </div>
            </div>
            <p className="font-display mt-4 text-right text-sm text-wood-dark/80 transition group-hover:translate-x-1">
              열기 →
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
