/**
 * Resolve Supabase URL / anon key for server-side clients.
 *
 * Prefer server-only `PM_*` vars (Vercel / .env.local). Fall back to
 * `NEXT_PUBLIC_PM_*` when those are set (e.g. dashboard duplicates).
 */
export function getSupabaseUrl(): string {
  const url =
    process.env.PM_SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_PM_SUPABASE_URL?.trim();

  if (!url) {
    throw new Error(
      "[pm] Missing PM_SUPABASE_URL (or NEXT_PUBLIC_PM_SUPABASE_URL)",
    );
  }

  return url;
}

export function getSupabaseAnonKey(): string {
  const key =
    process.env.PM_SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_PM_SUPABASE_ANON_KEY?.trim();

  if (!key) {
    throw new Error(
      "[pm] Missing PM_SUPABASE_ANON_KEY (or NEXT_PUBLIC_PM_SUPABASE_ANON_KEY)",
    );
  }

  return key;
}
