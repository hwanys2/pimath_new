import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import AuthShell from "@/components/auth/AuthShell";
import OAuthButtons from "@/components/auth/OAuthButtons";
import SignupForm from "@/components/auth/SignupForm";
import { getDisplayUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "회원가입 | 수학하는 즐거움",
  description: "가입하고 수학 모험을 시작하세요.",
};

export default async function SignupPage() {
  const user = await getDisplayUser();
  if (user) redirect("/");

  return (
    <AuthShell
      title="모험을 시작해요!"
      subtitle="가입하고 나만의 수학 모험을 떠나요"
      footer={
        <>
          이미 계정이 있나요?{" "}
          <Link
            href="/login"
            className="font-bold text-sky underline-offset-2 hover:underline"
          >
            로그인
          </Link>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <OAuthButtons />
        <Divider />
        <SignupForm />
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
