/** Realtime Broadcast event name for session-scoped game sync. */
export const SESSION_SYNC_EVENT = "changed" as const;

/** Supabase Realtime channel for a live classroom session (UUID). */
export function sessionSyncChannelName(sessionId: string): string {
  return `pm:session:${sessionId.trim()}`;
}

/** Supabase Realtime channel for a teacher game dashboard (class + content). */
export function dashboardSyncChannelName(
  classId: string,
  contentKey: string,
): string {
  return `pm:dashboard:${classId.trim()}:${contentKey.trim()}`;
}

/** Supabase Realtime channel for an active 1:1 PvP game (UUID). */
export function pvpGameSyncChannelName(gameId: string): string {
  return `pm:pvp:${gameId.trim()}`;
}

/** Supabase Realtime channel while waiting in a PvP matchmaking queue. */
export function pvpQueueSyncChannelName(
  contentKey: string,
  scope: "class" | "global",
  classId?: string | null,
): string | null {
  const key = contentKey.trim();
  if (!key) return null;
  if (scope === "global") return `pm:pvp-queue:global:${key}`;
  const cid = classId?.trim();
  if (!cid) return null;
  return `pm:pvp-queue:class:${cid}:${key}`;
}

/** Resolve the hybrid poll channel for the current PvP client state. */
export function resolvePvpPollChannel(input: {
  contentKey: string;
  gameId?: string | null;
  queueScope?: "class" | "global" | null;
  classId?: string | null;
}): string | null {
  const gameId = input.gameId?.trim();
  if (gameId) return pvpGameSyncChannelName(gameId);
  if (input.queueScope) {
    return pvpQueueSyncChannelName(
      input.contentKey,
      input.queueScope,
      input.classId,
    );
  }
  return null;
}

/** Slow fallback poll while subscribed — catches missed broadcasts. */
export const SESSION_SYNC_FALLBACK_POLL_MS = 8000;
