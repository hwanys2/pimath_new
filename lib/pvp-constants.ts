/** Keep in sync with `pm_pvp_rematch_seconds()` in Supabase. */
export const PVP_REMATCH_SECONDS = 20;

/**
 * PvP hybrid poll interval while the tab is visible.
 * Realtime broadcast may nudge sooner; this is the reliable upper bound.
 * Do not use SESSION_SYNC_FALLBACK_POLL_MS (8s) — that feels like a broken game.
 */
export const PVP_POLL_MS = 1200;
