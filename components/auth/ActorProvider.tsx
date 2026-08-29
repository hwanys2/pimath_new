"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import type { Actor } from "@/lib/auth-types";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

type ActorContextValue = {
  actor: Actor | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

const ActorContext = createContext<ActorContextValue | null>(null);

async function fetchActor(): Promise<Actor | null> {
  const res = await fetch("/api/me", { cache: "no-store" });
  if (!res.ok) return null;
  const data = (await res.json()) as { actor?: Actor | null };
  return data.actor ?? null;
}

function TeacherSessionKeepAlive({ actor }: { actor: Actor | null }) {
  useEffect(() => {
    if (actor?.type !== "teacher") return;
    try {
      const supabase = createBrowserSupabaseClient();
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(() => {
        /* Browser client refreshes the teacher session on public pages. */
      });
      void supabase.auth.getSession();
      return () => subscription.unsubscribe();
    } catch {
      return;
    }
  }, [actor?.type]);

  return null;
}

export function ActorProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [actor, setActor] = useState<Actor | null>(null);
  const [loading, setLoading] = useState(true);
  const actorRef = useRef<Actor | null>(null);
  actorRef.current = actor;

  const refresh = useCallback(async () => {
    try {
      const next = await fetchActor();
      setActor(next);
    } catch {
      setActor(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!actorRef.current) return;
    void refresh();
  }, [pathname, refresh]);

  const value = useMemo(
    () => ({ actor, loading, refresh }),
    [actor, loading, refresh],
  );

  return (
    <ActorContext.Provider value={value}>
      <TeacherSessionKeepAlive actor={actor} />
      {children}
    </ActorContext.Provider>
  );
}

export function useActor(): ActorContextValue {
  const ctx = useContext(ActorContext);
  if (!ctx) {
    throw new Error("useActor must be used within ActorProvider");
  }
  return ctx;
}
