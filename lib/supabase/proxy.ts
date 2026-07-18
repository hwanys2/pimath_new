import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  try {
    const supabase = createServerClient(
      getSupabaseUrl(),
      getSupabaseAnonKey(),
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet, headers) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value),
            );
            supabaseResponse = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options),
            );
            Object.entries(headers).forEach(([key, value]) =>
              supabaseResponse.headers.set(key, value),
            );
          },
        },
      },
    );

    // Do not run code between createServerClient and getClaims(). Refreshing the
    // token here keeps sessions in sync between server and browser.
    // NOTE: pimath is a public site — we intentionally do NOT redirect
    // unauthenticated visitors. We only refresh the session.
    await supabase.auth.getClaims();
  } catch (error) {
    // Missing/invalid Supabase config must not break every request.
    console.error("[pm] updateSession failed:", error);
  }

  return supabaseResponse;
}
