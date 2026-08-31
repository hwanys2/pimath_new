/** Realtime Broadcast event name for session-scoped game sync. */
export const SESSION_SYNC_EVENT = "changed" as const;

/** Supabase Realtime channel for a live classroom session (UUID). */
export function sessionSyncChannelName(sessionId: string): string {
  return `pm:session:${sessionId.trim()}`;
}

/** Slow fallback poll while subscribed — catches missed broadcasts. */
export const SESSION_SYNC_FALLBACK_POLL_MS = 8000;
