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
import { signOut } from "@/app/auth/actions";

type ActorContextValue = {
  actor: Actor | null;
  loading: boolean;
  refresh: () => Promise<Actor | null>;
  setActor: React.Dispatch<React.SetStateAction<Actor | null>>;
  logout: (_formData?: FormData) => Promise<void>;
};

const ActorContext = createContext<ActorContextValue | null>(null);

const AUTH_SYNC_CHANNEL = "pm_auth_sync";

export function notifyAuthChange(): void {
  if (typeof BroadcastChannel !== "undefined") {
    try {
      const channel = new BroadcastChannel(AUTH_SYNC_CHANNEL);
      channel.postMessage("auth_change");
      channel.close();
    } catch {}
  }
}

function isAuthPath(path: string): boolean {
  return (
    path === "/login" ||
    path.startsWith("/login/") ||
    path === "/signup" ||
    path.startsWith("/s/") ||
    path === "/forgot-password" ||
    path === "/reset-password" ||
    path.startsWith("/auth/")
  );
}

async function fetchActor(): Promise<Actor | null> {
  const res = await fetch("/api/me", { cache: "no-store" });
  if (!res.ok) return null;
  const data = (await res.json()) as { actor?: Actor | null };
  return data.actor ?? null;
}

export function ActorProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [actor, setActor] = useState<Actor | null>(null);
  const [loading, setLoading] = useState(true);
  const prevPathRef = useRef(pathname);

  const refresh = useCallback(async (): Promise<Actor | null> => {
    try {
      const next = await fetchActor();
      setActor(next);
      return next;
    } catch {
      setActor(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async (_formData?: FormData): Promise<void> => {
    setActor(null);
    notifyAuthChange();
    try {
      const supabase = createBrowserSupabaseClient();
      await supabase.auth.signOut();
    } catch {}
    await signOut();
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Auth/Login 화면을 벗어나거나 권한이 필요한 구역 진입 시 /api/me 동기화
  useEffect(() => {
    const prev = prevPathRef.current;
    prevPathRef.current = pathname;

    if (prev === pathname) return;

    const wasAuth = isAuthPath(prev);
    const isNowAuth = isAuthPath(pathname);

    // 1. 로그인/가입 경로에서 일반 페이지로 이동한 경우 (로그인 직후 redirect)
    if (wasAuth && !isNowAuth) {
      void refresh();
      return;
    }

    // 2. 교사 화면 진입 시 아직 교사 상태가 반영되지 않은 경우
    if (
      (pathname === "/teacher" || pathname.startsWith("/teacher/")) &&
      actor?.type !== "teacher"
    ) {
      void refresh();
      return;
    }

    // 3. 학생 모험 진입 시 아직 학생 상태가 반영되지 않은 경우
    if (
      (pathname === "/adventure" || pathname.startsWith("/adventure/")) &&
      actor?.type !== "student"
    ) {
      void refresh();
      return;
    }
  }, [pathname, actor, refresh]);

  // 탭 간 로그인/로그아웃 동기화
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(AUTH_SYNC_CHANNEL);
    channel.onmessage = (event) => {
      if (event.data === "auth_change") {
        void refresh();
      }
    };
    return () => {
      channel.close();
    };
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
    () => ({ actor, loading, refresh, setActor, logout }),
    [actor, loading, refresh, logout],
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
