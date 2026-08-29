"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useActor } from "@/components/auth/ActorProvider";
import {
  isAuthChooserPath,
  shouldKeepStudentInAdventure,
} from "@/lib/auth-routes";
import { safeNextPath } from "@/lib/safe-next-path";

/** Mirrors previous server-side redirects without dynamizing public pages. */
export default function ActorRedirects() {
  const { actor } = useActor();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!actor) return;

    if (actor.type === "student" && shouldKeepStudentInAdventure(pathname)) {
      router.replace("/adventure");
      return;
    }

    if (isAuthChooserPath(pathname)) {
      if (actor.type === "student") {
        router.replace("/adventure");
        return;
      }
      if (actor.type === "teacher") {
        const next =
          pathname === "/login/teacher"
            ? safeNextPath(searchParams.get("next"))
            : "/teacher";
        router.replace(next);
      }
    }
  }, [actor, pathname, router, searchParams]);

  return null;
}
