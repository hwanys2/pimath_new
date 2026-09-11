"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTeacher } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type MailPrefsState = {
  error?: string;
  message?: string;
  mailMarketingConsent?: boolean;
};

export async function setMailMarketingConsent(
  _prev: MailPrefsState,
  formData: FormData,
): Promise<MailPrefsState> {
  await requireTeacher();
  const raw = String(formData.get("consent") ?? "");
  const consent = raw === "1" || raw === "true" || raw === "on";

  const supabase = await createClient();
  const { error } = await supabase.rpc("pm_set_mail_marketing_consent", {
    p_consent: consent,
  });
  if (error) {
    console.error("[pm] setMailMarketingConsent:", error.message);
    return { error: "수신 동의를 저장하지 못했어요." };
  }

  revalidatePath("/settings");
  return {
    message: consent
      ? "메일 수신에 동의했어요."
      : "마케팅 메일 수신을 거부했어요.",
    mailMarketingConsent: consent,
  };
}

export type DeleteAccountPreview = {
  name: string;
  classCount: number;
  studentCount: number;
};

export async function getDeleteAccountPreview(): Promise<DeleteAccountPreview> {
  const teacher = await requireTeacher();
  const supabase = await createClient();
  const [classes, students] = await Promise.all([
    supabase
      .from("pm_classes")
      .select("id", { count: "exact", head: true })
      .eq("teacher_id", teacher.id),
    supabase
      .from("pm_students")
      .select("id", { count: "exact", head: true })
      .eq("teacher_id", teacher.id),
  ]);
  return {
    name: teacher.name,
    classCount: classes.count ?? 0,
    studentCount: students.count ?? 0,
  };
}

export type DeleteAccountState = {
  error?: string;
};

export async function deleteMyAccount(
  _prev: DeleteAccountState,
  formData: FormData,
): Promise<DeleteAccountState> {
  const teacher = await requireTeacher();
  const typed = String(formData.get("confirm") ?? "").trim();
  if (!typed || typed !== teacher.name.trim()) {
    return { error: "닉네임이 일치하지 않아요." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("pm_delete_my_account");
  if (error) {
    console.error("[pm] pm_delete_my_account:", error.message);
    return { error: "탈퇴하지 못했어요. 잠시 후 다시 시도해 주세요." };
  }

  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch (signOutError) {
    console.error("[pm] signOut after delete:", signOutError);
  }

  revalidatePath("/", "layout");
  redirect("/");
}
