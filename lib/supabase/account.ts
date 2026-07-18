import type { SupabaseClient, User } from "@supabase/supabase-js";

/**
 * Sync the signed-in Supabase user with the shared foreducator account.
 *
 * This calls the existing `ensure_supabase_django_user` RPC (owned by
 * foreducator, NOT created by pimath). Same email = same foreducator account,
 * so the ID works identically on both sites. See
 * docs/supabase-pm-conventions.md.
 *
 * Idempotent and safe to call on every login/callback. Failures are logged but
 * do not block the session (it retries on the next auth event).
 */
export async function syncForeducatorAccount(
  supabase: SupabaseClient,
  user: User | null | undefined,
): Promise<void> {
  if (!user?.id || !user.email) return;

  const { error } = await supabase.rpc("ensure_supabase_django_user", {
    p_supabase_uid: user.id,
    p_email: user.email,
  });

  if (error) {
    console.error("[pm] foreducator account sync failed:", error.message);
  }
}
