import { type NextRequest, NextResponse } from "next/server";
import {
  STUDENT_SESSION_COOKIE,
  hasSupabaseAuthCookie,
} from "@/lib/auth-routes";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const hasStudent = request.cookies.has(STUDENT_SESSION_COOKIE);
  const hasTeacherSession = hasSupabaseAuthCookie(request.cookies.getAll());

  if (!hasStudent && !hasTeacherSession) {
    return NextResponse.next({ request });
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    "/teacher",
    "/teacher/:path*",
    "/adventure",
    "/adventure/:path*",
    "/auth/:path*",
    "/api/:path*",
    "/board",
    "/board/:path*",
    "/reset-password",
    "/forgot-password",
    "/tools/graph/host/:path*",
  ],
};
