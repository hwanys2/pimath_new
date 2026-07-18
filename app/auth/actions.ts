"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Provider } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { syncForeducatorAccount } from "@/lib/supabase/account";

export type AuthState = {
  error?: string;
  message?: string;
};

async function getOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const protocol =
    h.get("x-forwarded-proto") ??
    (process.env.NODE_ENV === "development" ? "http" : "https");
  return `${protocol}://${host}`;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function signInWithEmail(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!isValidEmail(email)) {
    return { error: "올바른 이메일 주소를 입력해 주세요." };
  }
  if (!password) {
    return { error: "비밀번호를 입력해 주세요." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    if (error.message.toLowerCase().includes("email not confirmed")) {
      return { error: "이메일 인증이 아직 완료되지 않았어요. 메일함을 확인해 주세요." };
    }
    return { error: "이메일 또는 비밀번호가 올바르지 않아요." };
  }

  await syncForeducatorAccount(supabase, data.user);
  redirect("/");
}

export async function signUpWithEmail(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!isValidEmail(email)) {
    return { error: "올바른 이메일 주소를 입력해 주세요." };
  }
  if (password.length < 8) {
    return { error: "비밀번호는 8자 이상이어야 해요." };
  }
  if (password !== confirm) {
    return { error: "비밀번호가 서로 일치하지 않아요." };
  }

  const supabase = await createClient();
  const origin = await getOrigin();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });

  if (error) {
    if (error.message.toLowerCase().includes("already registered")) {
      return { error: "이미 가입된 이메일이에요. 로그인해 주세요." };
    }
    return { error: "가입 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요." };
  }

  // Sync the foreducator account right away (idempotent, email-matched).
  await syncForeducatorAccount(supabase, data.user);

  if (data.session) {
    redirect("/");
  }

  return {
    message:
      "가입 확인 메일을 보냈어요. 메일의 링크를 눌러 인증을 완료하면 로그인돼요!",
  };
}

export async function signInWithProvider(formData: FormData): Promise<void> {
  const provider = String(formData.get("provider") ?? "") as Provider;
  const supabase = await createClient();
  const origin = await getOrigin();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${origin}/auth/callback` },
  });

  if (error || !data.url) {
    redirect("/login?error=oauth");
  }

  redirect(data.url);
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
