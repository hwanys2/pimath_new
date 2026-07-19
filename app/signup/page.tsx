import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import AuthShell from "@/components/auth/AuthShell";
import OAuthButtons from "@/components/auth/OAuthButtons";
import SignupForm from "@/components/auth/SignupForm";
import { getActor } from "@/lib/auth";

export const metadata: Metadata = {
  title: "교사 회원가입 | 수학하는 즐거움",
  description: "교사 계정을 만들고 학급을 관리하세요.",
};

export default async function SignupPage() {
  const actor = await getActor();
  if (actor?.type === "teacher") redirect("/teacher");
  if (actor?.type === "student") redirect("/adventure");

  return (
    <AuthShell
      title="교사로 시작해요!"
      subtitle="교사 계정을 만들고 학급을 등록해요"
      footer={
        <>
          이미 계정이 있나요?{" "}
          <Link
            href="/login/teacher"
            className="font-bold text-sky underline-offset-2 hover:underline"
          >
            교사 로그인
          </Link>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <p className="rounded-xl bg-sky/10 px-3 py-2 text-xs leading-relaxed text-foreground/70">
          학생은 회원가입이 필요 없어요. 선생님이 아이디를 만들어 주세요.
        </p>
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
