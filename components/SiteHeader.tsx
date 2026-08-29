"use client";

import StudentTopBar from "@/components/StudentTopBar";
import TopMenuBar from "@/components/TopMenuBar";
import { useActor } from "@/components/auth/ActorProvider";

export default function SiteHeader() {
  const { actor } = useActor();

  if (actor?.type === "student") {
    return <StudentTopBar actor={actor} />;
  }

  return <TopMenuBar actor={actor?.type === "teacher" ? actor : null} />;
}
