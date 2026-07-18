import "server-only";
import { createClient } from "@/lib/supabase/server";

export type DisplayUser = {
  id: string;
  email: string | null;
  name: string;
};

function pickName(
  email: string | null | undefined,
  meta: Record<string, unknown> | undefined,
): string {
  const candidate =
    (meta?.name as string) ||
    (meta?.full_name as string) ||
    (meta?.nickname as string) ||
    (meta?.user_name as string);
  if (candidate) return candidate;
  if (email) return email.split("@")[0];
  return "탐험가";
}

/**
 * Returns the current signed-in user for display, or null.
 * Uses getUser() (validated) rather than getSession().
 */
export async function getDisplayUser(): Promise<DisplayUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return {
    id: user.id,
    email: user.email ?? null,
    name: pickName(user.email, user.user_metadata),
  };
}
