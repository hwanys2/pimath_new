"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import {
  formatNotificationTime,
  notificationHref,
  type PmNotification,
} from "@/lib/notifications";

const POLL_MS = 60_000;
const PAGE_SIZE = 20;

function BellIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<PmNotification[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  async function refreshUnread() {
    const supabase = createBrowserSupabaseClient();
    const { data, error: rpcError } = await supabase.rpc(
      "pm_unread_notification_count",
    );
    if (rpcError) {
      console.error("[pm] unread notifications:", rpcError.message);
      return;
    }
    setUnread(typeof data === "number" ? data : Number(data) || 0);
  }

  async function loadList() {
    setLoadingList(true);
    setError(null);
    const supabase = createBrowserSupabaseClient();
    const { data, error: rpcError } = await supabase.rpc(
      "pm_list_my_notifications",
      { p_limit: PAGE_SIZE, p_offset: 0 },
    );
    setLoadingList(false);
    if (rpcError) {
      console.error("[pm] list notifications:", rpcError.message);
      setError("알림을 불러오지 못했어요.");
      return;
    }
    setItems((data as PmNotification[] | null) ?? []);
  }

  useEffect(() => {
    void refreshUnread();
    const id = window.setInterval(() => {
      void refreshUnread();
    }, POLL_MS);
    const onFocus = () => {
      void refreshUnread();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadList();
    void refreshUnread();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function markRead(id: string) {
    startTransition(async () => {
      const supabase = createBrowserSupabaseClient();
      const { error: rpcError } = await supabase.rpc(
        "pm_mark_notification_read",
        { p_id: id },
      );
      if (rpcError) {
        console.error("[pm] mark notification read:", rpcError.message);
        return;
      }
      setItems((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, read_at: n.read_at ?? new Date().toISOString() } : n,
        ),
      );
      setUnread((n) => Math.max(0, n - 1));
    });
  }

  function markAllRead() {
    startTransition(async () => {
      const supabase = createBrowserSupabaseClient();
      const { error: rpcError } = await supabase.rpc(
        "pm_mark_all_notifications_read",
      );
      if (rpcError) {
        console.error("[pm] mark all read:", rpcError.message);
        return;
      }
      setItems((prev) =>
        prev.map((n) => ({
          ...n,
          read_at: n.read_at ?? new Date().toISOString(),
        })),
      );
      setUnread(0);
    });
  }

  const badge = unread > 99 ? "99+" : unread > 0 ? String(unread) : null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={
          unread > 0 ? `알림 ${unread}개 읽지 않음` : "알림"
        }
        className={`relative flex h-10 w-10 items-center justify-center rounded-xl transition ${
          open
            ? "bg-cream text-wood-dark shadow-[0_3px_0_rgba(0,0,0,0.25)]"
            : "bg-black/15 text-cream hover:bg-black/25"
        }`}
      >
        <BellIcon className="h-5 w-5" />
        {badge ? (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-[#6b4a00] shadow">
            {badge}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="알림"
          className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border-2 border-wood/20 bg-cream shadow-xl"
        >
          <div className="flex items-center justify-between gap-2 border-b border-wood/10 px-3 py-2.5">
            <p className="font-display text-sm text-wood-dark">알림</p>
            {unread > 0 ? (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs font-semibold text-wood/70 transition hover:text-wood-dark"
              >
                모두 읽음
              </button>
            ) : null}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loadingList && items.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-wood/60">
                불러오는 중…
              </p>
            ) : error ? (
              <p className="px-3 py-8 text-center text-sm text-wood/70">{error}</p>
            ) : items.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-wood/60">
                새 알림이 없어요.
              </p>
            ) : (
              <ul className="divide-y divide-wood/10">
                {items.map((item) => {
                  const href = notificationHref(item.url);
                  const unreadItem = !item.read_at;
                  const body = (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={`text-sm font-semibold leading-snug ${
                            unreadItem ? "text-wood-dark" : "text-wood/70"
                          }`}
                        >
                          {item.title}
                        </p>
                        {unreadItem ? (
                          <span
                            className="mt-1 h-2 w-2 shrink-0 rounded-full bg-gold"
                            aria-label="읽지 않음"
                          />
                        ) : null}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-wood/65">
                        {item.message}
                      </p>
                      <p className="mt-1 text-[10px] font-semibold text-wood/45">
                        {formatNotificationTime(item.created_at)}
                      </p>
                    </>
                  );

                  const className = `block w-full px-3 py-2.5 text-left transition hover:bg-wood/10 ${
                    unreadItem ? "bg-gold/10" : ""
                  }`;

                  if (href) {
                    return (
                      <li key={item.id}>
                        <Link
                          href={href}
                          className={className}
                          onClick={() => {
                            if (unreadItem) markRead(item.id);
                            setOpen(false);
                          }}
                        >
                          {body}
                        </Link>
                      </li>
                    );
                  }

                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        className={className}
                        onClick={() => {
                          if (unreadItem) markRead(item.id);
                        }}
                      >
                        {body}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
