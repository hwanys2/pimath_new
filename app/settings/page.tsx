import type { ReactNode } from "react";
import NicknameEditor from "@/components/NicknameEditor";
import MailPrefsForm from "@/components/settings/MailPrefsForm";
import TeacherSchoolPicker from "@/components/teacher/TeacherSchoolPicker";
import { MailIcon, SchoolIcon, UserIcon } from "@/components/icons";
import { requireTeacher } from "@/lib/auth";
import { fetchMyTeacherSchool } from "@/lib/hall-of-fame";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "설정 | 수학하는 즐거움",
};

const PROVIDER_LABEL: Record<string, string> = {
  google: "Google",
  kakao: "카카오",
  email: "이메일",
};

function loginLabels(claims: Record<string, unknown> | undefined): string[] {
  const appMeta = claims?.app_metadata;
  if (!appMeta || typeof appMeta !== "object") return [];
  const meta = appMeta as { provider?: unknown; providers?: unknown };
  const fromList = Array.isArray(meta.providers)
    ? meta.providers.filter((value): value is string => typeof value === "string")
    : [];
  const single = typeof meta.provider === "string" ? [meta.provider] : [];
  const ids = fromList.length > 0 ? fromList : single;
  return [...new Set(ids)].map((id) => PROVIDER_LABEL[id] ?? id);
}

function Section({
  icon,
  title,
  hint,
  children,
}: {
  icon: ReactNode;
  title: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-wood/15 bg-cream/80 p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-wood/10 text-wood">
          {icon}
        </span>
        <div>
          <h2 className="font-display text-lg text-wood-dark">{title}</h2>
          <p className="mt-0.5 text-xs text-wood/60">{hint}</p>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default async function SettingsPage() {
  const teacher = await requireTeacher();
  const supabase = await createClient();
  const [{ data: prefs }, teacherSchool, claimsResult] = await Promise.all([
    supabase.rpc("pm_get_my_mail_prefs"),
    fetchMyTeacherSchool(),
    supabase.auth.getClaims(),
  ]);
  const row = Array.isArray(prefs) ? prefs[0] : prefs;
  const marketingConsent =
    typeof row?.mail_marketing_consent === "boolean"
      ? row.mail_marketing_consent
      : true;
  const providers = loginLabels(
    claimsResult.data?.claims as Record<string, unknown> | undefined,
  );
  const initial = teacher.name.trim().charAt(0) || "나";

  return (
    <div className="mx-auto max-w-2xl px-1 py-4 sm:py-6">
      <header className="flex items-start gap-4">
        <span
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-wood text-2xl text-cream shadow-[0_3px_0_rgba(0,0,0,0.18)]"
          aria-hidden
        >
          {initial}
        </span>
        <div className="min-w-0">
          <h1 className="font-display text-3xl text-wood-dark">설정</h1>
          <p className="mt-1 truncate text-sm text-wood/70">{teacher.name}</p>
          {teacher.email ? (
            <p className="truncate text-xs text-wood/50">{teacher.email}</p>
          ) : null}
        </div>
      </header>

      <div className="mt-8 space-y-5">
        <Section
          icon={<UserIcon className="h-5 w-5" />}
          title="프로필"
          hint="다른 선생님에게 보이는 이름이에요."
        >
          <NicknameEditor name={teacher.name} variant="page" />
          <dl className="mt-4 space-y-2 text-sm">
            {teacher.email ? (
              <div className="flex items-baseline justify-between gap-3 rounded-xl bg-wood/5 px-3 py-2.5">
                <dt className="shrink-0 text-xs font-bold text-wood/55">이메일</dt>
                <dd className="truncate text-wood-dark">{teacher.email}</dd>
              </div>
            ) : null}
            {providers.length > 0 ? (
              <div className="flex items-baseline justify-between gap-3 rounded-xl bg-wood/5 px-3 py-2.5">
                <dt className="shrink-0 text-xs font-bold text-wood/55">로그인</dt>
                <dd className="text-wood-dark">{providers.join(" · ")}</dd>
              </div>
            ) : null}
          </dl>
        </Section>

        <Section
          icon={<SchoolIcon className="h-5 w-5" />}
          title="우리 학교"
          hint="학교 대항전에 올라가는 이름이에요. 언제든 바꿀 수 있어요."
        >
          <TeacherSchoolPicker initial={teacherSchool} variant="plain" />
        </Section>

        <Section
          icon={<MailIcon className="h-5 w-5" />}
          title="메일"
          hint="가입 시 소식 메일은 기본으로 수신 동의돼요."
        >
          <MailPrefsForm initialConsent={marketingConsent} />
        </Section>
      </div>
    </div>
  );
}
