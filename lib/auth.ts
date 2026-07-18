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
  try {
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
  } catch (error) {
    // Let Next.js control-flow signals (dynamic rendering, redirect, notFound)
    // propagate so routing still works correctly.
    if (isNextControlFlowError(error)) throw error;
    // Missing/invalid Supabase config must not take down public pages.
    // Degrade to a logged-out state instead.
    console.error("[pm] getDisplayUser failed:", error);
    return null;
  }
}

function isNextControlFlowError(error: unknown): boolean {
  const digest = (error as { digest?: unknown } | null)?.digest;
  return (
    typeof digest === "string" &&
    (digest === "DYNAMIC_SERVER_USAGE" ||
      digest.startsWith("NEXT_REDIRECT") ||
      digest === "NEXT_NOT_FOUND")
  );
}
