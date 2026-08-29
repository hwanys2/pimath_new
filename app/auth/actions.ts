"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Provider } from "@supabase/supabase-js";
import { getAuthCallbackUrl, getAuthOrigin } from "@/lib/auth-origin";
import { safeNextPath } from "@/lib/safe-next-path";
import { createClient } from "@/lib/supabase/server";
import { syncForeducatorAccount } from "@/lib/supabase/account";
import {
  clearStudentSessionCookie,
  getStudentSession,
  setStudentSessionCookie,
} from "@/lib/student-session";
import { isValidLoginId, normalizeLoginId } from "@/lib/students";
import {
  isValidStudentQrToken,
  normalizeStudentQrToken,
} from "@/lib/student-qr";

export type AuthState = {
  error?: string;
  message?: string;
  nickname?: string;
};

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function mapSignInError(message: string, code?: string): string {
  const lower = message.toLowerCase();

  if (lower.includes("email not confirmed")) {
    return "이메일 인증이 아직 완료되지 않았어요. 메일함을 확인해 주세요.";
  }
  if (
    lower.includes("invalid login credentials") ||
    code === "invalid_credentials"
  ) {
    return "이메일 또는 비밀번호가 올바르지 않아요.";
  }
  if (lower.includes("rate limit") || lower.includes("too many requests")) {
    return "요청이 너무 많아요. 잠시 후 다시 시도해 주세요.";
  }

  return `로그인에 실패했어요. (${message})`;
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
    console.error(
      "[pm] signInWithPassword failed:",
      error.message,
      error.code ?? "",
    );
    return { error: mapSignInError(error.message, error.code) };
  }

  await clearStudentSessionCookie();
  await syncForeducatorAccount(supabase, data.user);
  redirect(safeNextPath(formData.get("next")));
}

type StudentAuthRow = {
  id: string;
  login_id: string;
  display_name: string;
  class_id: string;
  class_name: string;
  teacher_id: string;
  session_token: string;
};

function asStudentAuthRow(data: unknown): StudentAuthRow | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return null;
  const student = row as Partial<StudentAuthRow>;
  if (
    !student.id ||
    !student.login_id ||
    !student.display_name ||
    !student.class_id ||
    !student.class_name ||
    !student.teacher_id ||
    !student.session_token
  ) {
    return null;
  }
  return student as StudentAuthRow;
}

async function establishStudentSession(
  student: StudentAuthRow,
): Promise<AuthState> {
  const supabase = await createClient();
  // Clear any teacher session so roles don't mix.
  await supabase.auth.signOut();

  await setStudentSessionCookie({
    id: student.id,
    loginId: student.login_id,
    displayName: student.display_name,
    classId: student.class_id,
    className: student.class_name,
    teacherId: student.teacher_id,
    sessionToken: student.session_token,
  });

  redirect("/adventure");
}

export async function signInAsStudent(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const loginId = normalizeLoginId(String(formData.get("loginId") ?? ""));
  const password = String(formData.get("password") ?? "");

  if (!isValidLoginId(loginId)) {
    return { error: "아이디를 올바르게 입력해 주세요." };
  }
  if (!password) {
    return { error: "비밀번호를 입력해 주세요." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pm_authenticate_student", {
    p_login_id: loginId,
    p_password: password,
  });

  if (error) {
    console.error("[pm] pm_authenticate_student failed:", error.message);
    return { error: "로그인에 실패했어요. 잠시 후 다시 시도해 주세요." };
  }

  const student = asStudentAuthRow(data);
  if (!student) {
    return { error: "아이디 또는 비밀번호가 올바르지 않아요." };
  }

  return establishStudentSession(student);
}

export async function signInWithStudentQrToken(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const token = normalizeStudentQrToken(String(formData.get("token") ?? ""));

  if (!isValidStudentQrToken(token)) {
    return { error: "올바르지 않은 로그인 코드예요." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pm_authenticate_student_qr", {
    p_token: token,
  });

  if (error) {
    console.error("[pm] pm_authenticate_student_qr failed:", error.message);
    return { error: "로그인에 실패했어요. 잠시 후 다시 시도해 주세요." };
  }

  const student = asStudentAuthRow(data);
  if (!student) {
    return {
      error: "이 QR로는 들어갈 수 없어요. 선생님께 새 QR을 받아 주세요.",
    };
  }

  return establishStudentSession(student);
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
  const origin = await getAuthOrigin();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: getAuthCallbackUrl(origin) },
  });

  if (error) {
    console.error("[pm] signUp failed:", error.message, error.code ?? "");
    if (error.message.toLowerCase().includes("already registered")) {
      return { error: "이미 가입된 이메일이에요. 로그인해 주세요." };
    }
    return {
      error: `가입 중 문제가 발생했어요. (${error.message})`,
    };
  }

  if (data.user && (!data.user.identities || data.user.identities.length === 0)) {
    return { error: "이미 가입된 이메일이에요. 로그인해 주세요." };
  }

  await clearStudentSessionCookie();
  // Sync the foreducator account right away (idempotent, email-matched).
  await syncForeducatorAccount(supabase, data.user);

  if (data.session) {
    redirect("/teacher");
  }

  return {
    message:
      "가입 확인 메일을 보냈어요. 메일의 링크를 눌러 인증을 완료하면 로그인돼요!",
  };
}

export async function requestPasswordReset(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();

  if (!isValidEmail(email)) {
    return { error: "올바른 이메일 주소를 입력해 주세요." };
  }

  const supabase = await createClient();
  const origin = await getAuthOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: getAuthCallbackUrl(origin, "/reset-password"),
  });

  if (error) {
    console.error(
      "[pm] resetPasswordForEmail failed:",
      error.message,
      error.code ?? "",
    );
    return {
      error: `재설정 메일을 보내지 못했어요. (${error.message})`,
    };
  }

  return {
    message:
      "비밀번호 재설정 메일을 보냈어요. 메일함(스팸함 포함)을 확인해 주세요.",
  };
}

export async function updatePassword(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 8) {
    return { error: "비밀번호는 8자 이상이어야 해요." };
  }
  if (password !== confirm) {
    return { error: "비밀번호가 서로 일치하지 않아요." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error:
        "재설정 세션이 없어요. 메일 링크를 다시 눌러 주세요.",
    };
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    console.error("[pm] updateUser password failed:", error.message);
    return {
      error: `비밀번호를 바꾸지 못했어요. (${error.message})`,
    };
  }

  redirect("/login/teacher?reset=1");
}

export async function signInWithProvider(formData: FormData): Promise<void> {
  const provider = String(formData.get("provider") ?? "") as Provider;
  const next = safeNextPath(formData.get("next"));
  const supabase = await createClient();
  const origin = await getAuthOrigin();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: getAuthCallbackUrl(origin, next) },
  });

  if (error || !data.url) {
    const errorNext =
      next === "/teacher" ? "" : `&next=${encodeURIComponent(next)}`;
    redirect(`/login/teacher?error=oauth${errorNext}`);
  }

  redirect(data.url);
}

export async function updateDisplayName(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const nickname = String(formData.get("nickname") ?? "").trim();
  if (!nickname) return { error: "닉네임을 입력해 주세요." };
  if (nickname.length > 20) return { error: "닉네임은 20자까지예요." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요해요." };

  const { error } = await supabase.auth.updateUser({
    data: {
      nickname,
      // Keep the JWT display field in sync so getClaims() shows the new name.
      name: nickname,
    },
  });
  if (error) {
    console.error("[pm] updateDisplayName failed:", error.message);
    return { error: "닉네임을 바꾸지 못했어요." };
  }

  const { error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError) {
    console.error("[pm] refreshSession after nickname failed:", refreshError.message);
  }

  revalidatePath("/", "layout");
  return { message: "닉네임을 저장했어요.", nickname };
}

export async function signOut(): Promise<void> {
  const session = await getStudentSession();
  if (session?.sessionToken) {
    try {
      const supabase = await createClient();
      await supabase.rpc("pm_revoke_student_session", {
        p_session_token: session.sessionToken,
      });
    } catch (error) {
      console.error("[pm] revoke student session failed:", error);
    }
  }
  await clearStudentSessionCookie();
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
