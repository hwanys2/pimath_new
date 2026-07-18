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

export default async function LoginPage() {
  const user = await getDisplayUser();
  if (user) redirect("/");

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
