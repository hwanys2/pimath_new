import type { Metadata } from "next";
import Link from "next/link";
import AuthShell from "@/components/auth/AuthShell";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";
import { getDisplayUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "비밀번호 재설정 | 수학하는 즐거움",
  description: "새 비밀번호를 설정하세요.",
};

export default async function ResetPasswordPage() {
  const user = await getDisplayUser();

  return (
    <AuthShell
      title="새 비밀번호 설정"
      subtitle={
        user
          ? "새 비밀번호를 입력해 주세요"
          : "메일 링크로 들어온 뒤 비밀번호를 바꿔 주세요"
      }
      footer={
        <>
          <Link
            href="/login"
            className="font-bold text-sky underline-offset-2 hover:underline"
          >
            로그인으로 돌아가기
          </Link>
        </>
      }
    >
      {user ? (
        <ResetPasswordForm />
      ) : (
        <div className="flex flex-col gap-3 text-sm leading-relaxed text-foreground/75">
          <p>
            재설정 세션이 없어요.{" "}
            <Link
              href="/forgot-password"
              className="font-bold text-sky underline-offset-2 hover:underline"
            >
              비밀번호 찾기
            </Link>
            에서 메일을 다시 받은 뒤, 메일 속 링크를 눌러 주세요.
          </p>
        </div>
      )}
    </AuthShell>
  );
}
