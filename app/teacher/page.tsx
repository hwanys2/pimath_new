import type { Metadata } from "next";
import Link from "next/link";
import { requireTeacher } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import CreateClassForm from "@/components/teacher/CreateClassForm";
import { deleteClass } from "@/app/teacher/actions";

export const metadata: Metadata = {
  title: "내 학급 | 수학하는 즐거움",
  description: "학급을 만들고 학생을 등록하세요.",
};

export default async function TeacherPage() {
  const teacher = await requireTeacher();
  const supabase = await createClient();

  const { data: classes, error } = await supabase
    .from("pm_classes")
    .select("id, name, grade, created_at")
    .eq("teacher_id", teacher.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[pm] list classes failed:", error.message);
  }

  const classIds = (classes ?? []).map((c) => c.id);
  let counts: Record<string, number> = {};

  if (classIds.length > 0) {
    const { data: students } = await supabase
      .from("pm_students")
      .select("class_id")
      .in("class_id", classIds);

    counts = (students ?? []).reduce<Record<string, number>>((acc, s) => {
      acc[s.class_id] = (acc[s.class_id] ?? 0) + 1;
      return acc;
    }, {});
  }

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="text-sm font-semibold text-wood/70">교사 공간</p>
        <h1 className="font-display mt-1 text-3xl text-foreground sm:text-4xl">
          내 학급
        </h1>
        <p className="mt-2 max-w-xl text-sm text-foreground/65">
          학급을 만들고 학생 아이디·비밀번호를 등록해 주세요. 학생은 별도
          회원가입 없이 바로 로그인할 수 있어요.
        </p>
      </header>

      <section className="quest-card p-5 sm:p-6">
        <h2 className="font-display text-xl text-wood">새 학급</h2>
        <div className="mt-4">
          <CreateClassForm />
        </div>
      </section>

      <section>
        <h2 className="font-display text-xl text-wood">학급 목록</h2>
        {(classes ?? []).length === 0 ? (
          <p className="coming-soon-slot mt-4 px-5 py-10 text-center text-sm text-foreground/55">
            아직 학급이 없어요. 위에서 첫 학급을 만들어 보세요.
          </p>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {(classes ?? []).map((c) => (
              <li key={c.id} className="quest-card flex flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link
                      href={`/teacher/classes/${c.id}`}
                      className="font-display text-xl text-foreground underline-offset-2 hover:underline"
                    >
                      {c.name}
                    </Link>
                    <p className="mt-1 text-sm text-foreground/60">
                      {c.grade ? `중${c.grade} · ` : ""}
                      학생 {counts[c.id] ?? 0}명
                    </p>
                  </div>
                  <form action={deleteClass}>
                    <input type="hidden" name="classId" value={c.id} />
                    <button
                      type="submit"
                      className="text-xs font-semibold text-[#a63a1a] underline-offset-2 hover:underline"
                    >
                      삭제
                    </button>
                  </form>
                </div>
                <Link
                  href={`/teacher/classes/${c.id}`}
                  className="block-btn block-btn-mint font-display self-start px-4 py-2 text-sm"
                >
                  명단 관리
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
