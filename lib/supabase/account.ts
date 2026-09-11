import type { SupabaseClient, User } from "@supabase/supabase-js";

function nicknameFromUser(user: User): string | null {
  const meta = user.user_metadata ?? {};
  if (typeof meta.nickname === "string" && meta.nickname.trim()) {
    return meta.nickname.trim();
  }
  if (typeof meta.name === "string" && meta.name.trim()) {
    return meta.name.trim();
  }
  return null;
}

/**
 * Ensure a pimath profile row exists for the signed-in teacher.
 * Idempotent — safe on every login / OAuth callback.
 *
 * During the shared→independent cutover window, falls back to the legacy
 * foreducator bridge RPC when `pm_ensure_profile` is not deployed yet.
 */
export async function syncPimathAccount(
  supabase: SupabaseClient,
  user: User | null | undefined,
): Promise<void> {
  if (!user?.id) return;

  const { error } = await supabase.rpc("pm_ensure_profile", {
    p_uid: user.id,
    p_email: user.email ?? null,
    p_nickname: nicknameFromUser(user),
  });

  if (!error) return;

  const missing =
    error.message.includes("pm_ensure_profile") ||
    error.code === "PGRST202" ||
    error.code === "42883";

  if (!missing) {
    console.error("[pm] profile ensure failed:", error.message);
    return;
  }

  // Transition fallback — remove after independent cutover.
  const { error: legacyError } = await supabase.rpc(
    "ensure_supabase_django_user",
    {
      p_supabase_uid: user.id,
      p_email: user.email,
    },
  );
  if (legacyError) {
    console.error("[pm] legacy account sync failed:", legacyError.message);
  }

  const { error: schoolError } = await supabase.rpc(
    "pm_sync_teacher_school_from_foreducator",
  );
  if (schoolError) {
    console.error("[pm] teacher school sync failed:", schoolError.message);
  }
}

/** @deprecated Use syncPimathAccount */
export const syncForeducatorAccount = syncPimathAccount;
