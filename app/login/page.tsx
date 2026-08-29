import type { Metadata } from "next";
import Link from "next/link";
import AuthShell from "@/components/auth/AuthShell";

export const metadata: Metadata = {
  title: "로그인 | 수학하는 즐거움",
  description: "교사 또는 학생으로 로그인하세요.",
};

export default function LoginChooserPage() {
  return (
    <AuthShell
      title="어떻게 로그인할까요?"
      subtitle="선생님과 학생 중 골라 주세요"
      footer={
        <>
          선생님 계정이 없나요?{" "}
          <Link
            href="/signup"
            className="font-bold text-sky underline-offset-2 hover:underline"
          >
            교사 회원가입
          </Link>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Link
          href="/login/teacher"
          className="block-btn block-btn-sky font-display w-full px-6 py-4 text-lg"
        >
          교사 로그인
        </Link>
        <Link
          href="/login/student"
          className="block-btn block-btn-mint font-display w-full px-6 py-4 text-lg"
        >
          학생 로그인
        </Link>
        <p className="text-center text-xs leading-relaxed text-foreground/55">
          학생 아이디·비밀번호는 선생님이 만들어 줘요.
        </p>
      </div>
    </AuthShell>
  );
}
