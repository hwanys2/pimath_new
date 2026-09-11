"use server";

import { revalidatePath } from "next/cache";
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
