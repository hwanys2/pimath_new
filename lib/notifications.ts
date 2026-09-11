export type PmNotification = {
  id: string;
  title: string;
  message: string;
  url: string | null;
  kind: string;
  read_at: string | null;
  created_at: string;
  total_count: number;
};

export function formatNotificationTime(
  iso: string,
  nowMs: number = Date.now(),
): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "";
  const diffSec = Math.max(0, Math.floor((nowMs - then) / 1000));
  if (diffSec < 60) return "방금";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}일 전`;
  return new Date(then).toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric",
  });
}

export function notificationHref(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url, "https://www.pimath.kr");
    if (
      parsed.hostname === "pimath.kr" ||
      parsed.hostname === "www.pimath.kr" ||
      parsed.hostname === "localhost"
    ) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
  } catch {
    return null;
  }
  return null;
}
