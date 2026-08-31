import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_NEXT_COOKIE, STUDENT_SESSION_COOKIE } from "@/lib/auth-routes";
import { safeNextPath } from "@/lib/safe-next-path";
import { syncForeducatorAccount } from "@/lib/supabase/account";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";

type PendingCookie = {
  name: string;
  value: string;
  options: CookieOptions;
};

function callbackSiteOrigin(request: Request): string {
  const { origin } = new URL(request.url);
  if (process.env.NODE_ENV === "development") return origin;

  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost) {
    const proto = request.headers.get("x-forwarded-proto") ?? "https";
    return `${proto}://${forwardedHost}`;
  }
  return origin;
}

function redirectWithCookies(
  location: URL,
  pending: PendingCookie[],
  extraHeaders: Record<string, string> = {},
) {
  const response = NextResponse.redirect(location);
  for (const cookie of pending) {
    response.cookies.set(cookie.name, cookie.value, cookie.options);
  }
  for (const [key, value] of Object.entries(extraHeaders)) {
    response.headers.set(key, value);
  }
  return response;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const oauthError = requestUrl.searchParams.get("error");
  const origin = callbackSiteOrigin(request);

  const cookieStore = await cookies();
  const next = safeNextPath(
    requestUrl.searchParams.get("next") ??
      cookieStore.get(AUTH_NEXT_COOKIE)?.value,
  );

  const pending: PendingCookie[] = [
    {
      name: AUTH_NEXT_COOKIE,
      value: "",
      options: { path: "/", maxAge: 0 },
    },
  ];
  let cacheHeaders: Record<string, string> = {};

  const fail = () =>
    redirectWithCookies(
      new URL("/login/teacher?error=auth", origin),
      pending,
      cacheHeaders,
    );

  if (oauthError || !code) {
    console.error(
      "[pm] auth callback missing code:",
      oauthError ?? "no-code",
      requestUrl.searchParams.get("error_description") ?? "",
    );
    return fail();
  }

  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value, options }) => {
          pending.push({ name, value, options });
        });
        cacheHeaders = headers;
      },
    },
  });

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    console.error(
      "[pm] exchangeCodeForSession failed:",
      error?.message ?? "no-user",
      error?.code ?? "",
    );
    return fail();
  }

  pending.push({
    name: STUDENT_SESSION_COOKIE,
    value: "",
    options: { path: "/", maxAge: 0 },
  });

  await syncForeducatorAccount(supabase, data.user);

  return redirectWithCookies(new URL(next, origin), pending, cacheHeaders);
}
