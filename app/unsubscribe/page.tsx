import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/service";
import { verifyUnsubscribeToken } from "@/lib/mailing/unsubscribe";

export const metadata = {
  title: "메일 수신 거부 | 수학하는 즐거움",
};

type Props = {
  searchParams: Promise<{ token?: string }>;
};

export default async function UnsubscribePage({ searchParams }: Props) {
  const { token } = await searchParams;
  let status: "ok" | "invalid" | "error" = "invalid";

  if (token) {
    const userId = verifyUnsubscribeToken(token);
    if (userId) {
      try {
        const admin = createServiceClient();
        const { error } = await admin
          .from("pm_profiles")
          .update({
            mail_marketing_consent: false,
            mail_marketing_consent_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId);
        status = error ? "error" : "ok";
      } catch {
        status = "error";
      }
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="font-display text-2xl text-wood-dark">메일 수신 거부</h1>
      {status === "ok" ? (
        <p className="mt-4 text-sm text-wood/70">
          소식·이벤트 메일 수신을 거부했어요. 계정·보안 안내는 계속 받을 수
          있어요.
        </p>
      ) : status === "error" ? (
        <p className="mt-4 text-sm text-red-700">
          처리 중 문제가 났어요. 잠시 후 다시 시도해 주세요.
        </p>
      ) : (
        <p className="mt-4 text-sm text-wood/70">
          링크가 올바르지 않거나 만료됐어요. 로그인 후 설정에서 끌 수 있어요.
        </p>
      )}
      <Link
        href="/settings"
        className="mt-8 inline-block rounded-xl bg-wood px-4 py-2.5 text-sm font-semibold text-cream"
      >
        설정으로 가기
      </Link>
    </main>
  );
}
