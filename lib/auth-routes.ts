export const STUDENT_SESSION_COOKIE = "pm_student_session";

/** Post-login path for OAuth. Kept off `redirectTo` so the allow list can be exact. */
export const AUTH_NEXT_COOKIE = "pm_auth_next";

/**
 * Paths where logged-in students are kept inside the /adventure shell.
 * Must stay in sync with previous server redirects (redirectStudentToAdventure).
 */
export function shouldKeepStudentInAdventure(pathname: string): boolean {
  if (pathname === "/") return true;
  if (pathname.startsWith("/grade/")) return true;
  if (pathname === "/tools") return true;
  if (pathname === "/tools/figures" || pathname.startsWith("/tools/figures/")) {
    return true;
  }
  if (pathname === "/tools/forum" || pathname.startsWith("/tools/forum/")) {
    return true;
  }
  if (pathname === "/tools/graph") return true;
  return false;
}

export function isAuthChooserPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname === "/login/student" ||
    pathname === "/login/teacher" ||
    pathname === "/signup"
  );
}

export function hasSupabaseAuthCookie(
  cookies: { name: string }[] | Iterable<{ name: string }>,
): boolean {
  for (const cookie of cookies) {
    const name = cookie.name;
    if (!name.includes("-auth-token")) continue;
    if (name.includes("code-verifier")) continue;
    return true;
  }
  return false;
}
