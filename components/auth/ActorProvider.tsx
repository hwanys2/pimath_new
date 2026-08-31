"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
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

export function ActorProvider({ children }: { children: ReactNode }) {
  const [actor, setActor] = useState<Actor | null>(null);
  const [loading, setLoading] = useState(true);

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

  // 교사 Supabase 세션 변경(로그인·로그아웃·토큰 갱신) 시에만 /api/me 재호출
  useEffect(() => {
    try {
      const supabase = createBrowserSupabaseClient();
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(() => {
        void refresh();
        void supabase.auth.getSession();
      });
      return () => subscription.unsubscribe();
    } catch {
      return;
    }
  }, [refresh]);

  const value = useMemo(
    () => ({ actor, loading, refresh }),
    [actor, loading, refresh],
  );

  return (
    <ActorContext.Provider value={value}>{children}</ActorContext.Provider>
  );
}

export function useActor(): ActorContextValue {
  const ctx = useContext(ActorContext);
  if (!ctx) {
    throw new Error("useActor must be used within ActorProvider");
  }
  return ctx;
}
