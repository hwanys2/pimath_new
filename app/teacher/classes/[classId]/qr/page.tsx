import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listOrCreateClassQrTokens } from "@/app/teacher/actions";
import ClassQrPrintSheet from "@/components/teacher/ClassQrPrintSheet";
import { requireTeacher } from "@/lib/auth";
import { getAuthOrigin } from "@/lib/auth-origin";
import { getStudentQrLoginUrl } from "@/lib/student-qr";
import { qrDataUrl } from "@/lib/student-qr-image";
import { createClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ classId: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { classId } = await params;
  return {
    title: `학생 QR | 수학하는 즐거움`,
    description: `학급 ${classId} 학생 로그인 QR`,
    robots: { index: false, follow: false },
  };
}

export default async function ClassQrPrintPage({ params }: Props) {
  const teacher = await requireTeacher();
  const { classId } = await params;
  const supabase = await createClient();

  const { data: klass, error: classError } = await supabase
    .from("pm_classes")
    .select("id, name, teacher_id")
    .eq("id", classId)
    .maybeSingle();

  if (classError) {
    console.error("[pm] load class for qr failed:", classError.message);
  }

  if (!klass || klass.teacher_id !== teacher.id) {
    notFound();
  }

  const [{ rows, error }, origin] = await Promise.all([
    listOrCreateClassQrTokens(classId),
    getAuthOrigin(),
  ]);

  const students = error
    ? []
    : await Promise.all(
        rows.map(async (row) => ({
          id: row.student_id,
          displayName: row.display_name,
          loginId: row.login_id,
          studentNumber: row.student_number,
          qrDataUrl: await qrDataUrl(
            getStudentQrLoginUrl(origin, row.token),
            512,
          ),
        })),
      );

  return (
    <div className="flex flex-col gap-6">
      <div className="no-print">
        <Link
          href={`/teacher/classes/${classId}?tab=roster`}
          className="text-sm font-semibold text-wood/70 underline-offset-2 hover:underline"
        >
          ← 학생 명단
        </Link>
        <h1 className="font-display mt-2 text-3xl text-foreground sm:text-4xl">
          {klass.name} 로그인 QR
        </h1>
      </div>

      {error ? (
        <p className="no-print rounded-xl bg-peach/40 px-3 py-2 text-sm font-semibold text-[#a63a1a]">
          {error}
        </p>
      ) : (
        <ClassQrPrintSheet
          classId={classId}
          className={klass.name}
          students={students}
        />
      )}
    </div>
  );
}
