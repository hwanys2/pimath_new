import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncForeducatorAccount } from "@/lib/supabase/account";
import { clearStudentSessionCookie } from "@/lib/student-session";
import { safeNextPath } from "@/lib/safe-next-path";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      await clearStudentSessionCookie();
      await syncForeducatorAccount(supabase, data.user);

      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocalEnv = process.env.NODE_ENV === "development";
      if (isLocalEnv) {
        return NextResponse.redirect(new URL(next, origin));
      } else if (forwardedHost) {
        return NextResponse.redirect(new URL(next, `https://${forwardedHost}`));
      } else {
        return NextResponse.redirect(new URL(next, origin));
      }
    }
  }

  return NextResponse.redirect(`${origin}/login/teacher?error=auth`);
}
