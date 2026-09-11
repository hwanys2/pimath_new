import { redirect } from "next/navigation";
import AdminMailingClient from "@/components/admin/AdminMailingClient";
import { isAdminEmail } from "@/lib/admin";
import { requireTeacher } from "@/lib/auth";

export const metadata = {
  title: "메일 발송 | 수학하는 즐거움",
};

export default async function AdminMailingPage() {
  const teacher = await requireTeacher();
  if (!isAdminEmail(teacher.email)) {
    redirect("/teacher");
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-3xl text-wood-dark">메일 발송</h1>
      <p className="mt-2 text-sm text-wood/70">
        마케팅 수신 동의한 교사에게 SES로 메일을 보내요. From은
        noreply@pimath.kr 입니다.
      </p>
      <div className="mt-8">
        <AdminMailingClient />
      </div>
    </main>
  );
}
