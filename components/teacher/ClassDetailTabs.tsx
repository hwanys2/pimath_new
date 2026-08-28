"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, type ReactNode } from "react";

export type ClassDetailTab = "content" | "results" | "roster" | "ranking";

const TABS: { id: ClassDetailTab; label: string }[] = [
  { id: "content", label: "수업 콘텐츠" },
  { id: "results", label: "학습 결과" },
  { id: "roster", label: "학생 명단" },
  { id: "ranking", label: "포인트 순위" },
];

type Props = {
  panels: Record<ClassDetailTab, ReactNode>;
};

function parseTab(raw: string | null): ClassDetailTab {
  if (raw === "results" || raw === "roster" || raw === "ranking") return raw;
  return "content";
}

export default function ClassDetailTabs({ panels }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const active = parseTab(searchParams.get("tab"));

  const setTab = useCallback(
    (tab: ClassDetailTab) => {
      const params = new URLSearchParams(searchParams.toString());
      if (tab === "content") {
        params.delete("tab");
      } else {
        params.set("tab", tab);
      }
      const qs = params.toString();
      router.replace(qs ? `?${qs}` : "?", { scroll: false });
    },
    [router, searchParams],
  );

  return (
    <section className="quest-card p-5 sm:p-6">
      <div
        className="flex flex-wrap gap-2 rounded-xl bg-wood/10 p-1"
        role="tablist"
        aria-label="학급 관리"
      >
        {TABS.map((tab) => {
          const selected = active === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setTab(tab.id)}
              className={[
                "flex-1 rounded-lg px-3 py-2.5 text-sm font-bold transition sm:flex-none sm:px-5",
                selected
                  ? "bg-wood text-cream shadow-sm"
                  : "text-foreground/60 hover:text-wood",
              ].join(" ")}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="mt-5" role="tabpanel">
        {panels[active]}
      </div>
    </section>
  );
}
