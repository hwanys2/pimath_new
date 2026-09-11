import NicknameEditor from "@/components/NicknameEditor";
import MailPrefsForm from "@/components/settings/MailPrefsForm";
import { requireTeacher } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "설정 | 수학하는 즐거움",
};

export default async function SettingsPage() {
  const teacher = await requireTeacher();
  const supabase = await createClient();
  const { data: prefs } = await supabase.rpc("pm_get_my_mail_prefs");
  const row = Array.isArray(prefs) ? prefs[0] : prefs;
  const marketingConsent =
    typeof row?.mail_marketing_consent === "boolean"
      ? row.mail_marketing_consent
      : true;

  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <h1 className="font-display text-3xl text-wood-dark">설정</h1>
      <p className="mt-2 text-sm text-wood/70">
        닉네임과 메일 수신 동의를 관리해요.
      </p>

      <section className="mt-8 rounded-2xl border border-wood/15 bg-cream/80 p-5 shadow-sm">
        <h2 className="font-display text-lg text-wood-dark">프로필</h2>
        <p className="mt-1 text-xs text-wood/60">닉네임을 눌러 바로 수정해요.</p>
        <div className="mt-4 rounded-xl bg-wood/5 px-3 py-3">
          <NicknameEditor name={teacher.name} variant="menu" />
        </div>
        <p className="mt-2 truncate text-xs text-wood/50">{teacher.email}</p>
      </section>

      <section className="mt-6 rounded-2xl border border-wood/15 bg-cream/80 p-5 shadow-sm">
        <h2 className="font-display text-lg text-wood-dark">메일</h2>
        <p className="mt-1 text-xs text-wood/60">
          가입 시 소식 메일은 기본으로 수신 동의돼요.
        </p>
        <div className="mt-4">
          <MailPrefsForm initialConsent={marketingConsent} />
        </div>
      </section>
    </main>
  );
}
