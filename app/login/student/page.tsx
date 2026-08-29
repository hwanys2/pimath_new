import type { Metadata } from "next";
import Link from "next/link";
import AuthShell from "@/components/auth/AuthShell";
import StudentLoginForm from "@/components/auth/StudentLoginForm";

export const metadata: Metadata = {
  title: "학생 로그인 | 수학하는 즐거움",
  description: "학생 아이디로 로그인하고 모험을 이어가세요.",
};

export default function StudentLoginPage() {
  return (
    <AuthShell
      title="학생 로그인"
      subtitle="아이디로 모험을 이어가요"
      footer={
        <>
          선생님이신가요?{" "}
          <Link
            href="/login/teacher"
            className="font-bold text-sky underline-offset-2 hover:underline"
          >
            교사 로그인
          </Link>
          <span className="mx-2 text-foreground/30">·</span>
          <Link
            href="/login"
            className="font-bold text-wood underline-offset-2 hover:underline"
          >
            로그인 선택
          </Link>
        </>
      }
    >
      <StudentLoginForm />
    </AuthShell>
  );
}
