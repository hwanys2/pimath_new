import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import AuthShell from "@/components/auth/AuthShell";
import OAuthButtons from "@/components/auth/OAuthButtons";
import LoginForm from "@/components/auth/LoginForm";
import { getDisplayUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "로그인 | 수학하는 즐거움",
  description: "로그인하고 수학 모험을 이어가세요.",
};

type Props = {
  searchParams: Promise<{ error?: string; reset?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const user = await getDisplayUser();
  if (user) redirect("/");

  const params = await searchParams;

  return (
    <AuthShell
      title="다시 만나서 반가워요!"
      subtitle="로그인하고 모험을 이어가요"
      footer={
        <>
          아직 계정이 없나요?{" "}
          <Link
            href="/signup"
            className="font-bold text-sky underline-offset-2 hover:underline"
          >
            회원가입
          </Link>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {params.reset === "1" && (
          <p className="rounded-xl bg-mint/40 px-3 py-2 text-sm font-semibold text-wood">
            비밀번호를 바꿨어요. 새 비밀번호로 로그인해 주세요.
          </p>
        )}
        {params.error === "oauth" && (
          <p className="rounded-xl bg-peach/40 px-3 py-2 text-sm font-semibold text-[#a63a1a]">
            소셜 로그인에 실패했어요. 다시 시도해 주세요.
          </p>
        )}
        {params.error === "auth" && (
          <p className="rounded-xl bg-peach/40 px-3 py-2 text-sm font-semibold text-[#a63a1a]">
            인증 링크가 만료됐거나 올바르지 않아요. 다시 시도해 주세요.
          </p>
        )}
        <OAuthButtons />
        <Divider />
        <LoginForm />
      </div>
    </AuthShell>
  );
}

function Divider() {
  return (
    <div className="flex items-center gap-3">
      <span className="h-px flex-1 bg-wood/15" />
      <span className="text-xs font-semibold text-foreground/40">또는</span>
      <span className="h-px flex-1 bg-wood/15" />
    </div>
  );
}
