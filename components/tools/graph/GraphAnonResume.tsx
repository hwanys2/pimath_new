"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { graphAnonFindActiveAction } from "@/app/tools/graph/actions";
import { getOrCreateGuestTeacherKey } from "@/lib/graph-teacher-key";

export default function GraphAnonResume() {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const key = getOrCreateGuestTeacherKey();
    if (!key) return;
    graphAnonFindActiveAction({ guestTeacherKey: key }).then((r) => {
      setActiveId(r.sessionId);
    });
  }, []);

  if (!activeId) return null;

  return (
    <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-gold/60 bg-gold/15 px-5 py-4">
      <p className="text-sm text-foreground/80">
        진행 중인 방이 있어요.{" "}
        <span className="text-foreground/60">(새 방을 만들면 기존 방은 닫혀요)</span>
      </p>
      <Link
        href={`/tools/graph/host/${activeId}`}
        className="font-display rounded-xl bg-gold px-4 py-2 text-sm text-[#6b4a00]"
      >
        이어서 →
      </Link>
    </div>
  );
}
