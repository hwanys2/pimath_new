import type { Metadata } from "next";
import Link from "next/link";
import AuthShell from "@/components/auth/AuthShell";
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";

export const metadata: Metadata = {
  title: "비밀번호 찾기 | 수학하는 즐거움",
  description: "비밀번호 재설정 메일을 받아보세요.",
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="비밀번호를 잊으셨나요?"
      subtitle="재설정 메일을 보내 드릴게요"
      footer={
        <>
          비밀번호가 기억났나요?{" "}
          <Link
            href="/login"
            className="font-bold text-sky underline-offset-2 hover:underline"
          >
            로그인
          </Link>
        </>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
