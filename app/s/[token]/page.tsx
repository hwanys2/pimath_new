import type { Metadata } from "next";
import Link from "next/link";
import AuthShell from "@/components/auth/AuthShell";
import StudentQrLoginForm from "@/components/auth/StudentQrLoginForm";
import {
  isValidStudentQrToken,
  normalizeStudentQrToken,
} from "@/lib/student-qr";

type Props = {
  params: Promise<{ token: string }>;
};

export const metadata: Metadata = {
  title: "학생 QR 로그인 | 수학하는 즐거움",
  description: "QR로 학생 모험에 입장합니다.",
  robots: { index: false, follow: false },
};

export default async function StudentQrLoginPage({ params }: Props) {
  const { token: raw } = await params;
  const token = normalizeStudentQrToken(raw ?? "");
  const valid = isValidStudentQrToken(token);

  return (
    <AuthShell
      title={valid ? "수업 입장" : "QR을 확인할 수 없어요"}
      subtitle={
        valid
          ? "찍은 QR로 바로 들어가요"
          : "선생님께 받은 QR을 다시 찍어 주세요"
      }
      footer={
        <>
          아이디로 로그인할까요?{" "}
          <Link
            href="/login/student"
            className="font-bold text-sky underline-offset-2 hover:underline"
          >
            학생 로그인
          </Link>
        </>
      }
    >
      {valid ? (
        <StudentQrLoginForm token={token} />
      ) : (
        <div className="flex flex-col gap-4">
          <p className="rounded-xl bg-peach/40 px-3 py-2 text-sm font-semibold text-[#a63a1a]">
            올바르지 않은 로그인 코드예요. 교과서에 붙인 QR을 다시 찍어 주세요.
          </p>
          <Link
            href="/login/student"
            className="block-btn block-btn-mint font-display px-6 py-3 text-center text-base"
          >
            아이디로 로그인
          </Link>
        </div>
      )}
    </AuthShell>
  );
}
