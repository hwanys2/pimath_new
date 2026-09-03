import type { Metadata } from "next";
import { requireTeacher } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import CreateClassForm from "@/components/teacher/CreateClassForm";
import TeacherSchoolPicker from "@/components/teacher/TeacherSchoolPicker";
import TeacherClassList from "@/components/teacher/TeacherClassList";
import HallOfFame from "@/components/hall-of-fame/HallOfFame";
import { fetchClassTodayActivityCounts } from "@/lib/activity-results";
import { fetchHofBoard, fetchMyTeacherSchool } from "@/lib/hall-of-fame";

export const metadata: Metadata = {
  title: "내 학급 | 수학하는 즐거움",
  description: "학급을 만들고 학생을 등록하세요.",
};

export default async function TeacherPage() {
  const teacher = await requireTeacher();
  const supabase = await createClient();

  const [{ data: classes, error }, teacherSchool, hof] = await Promise.all([
    supabase
      .from("pm_classes")
      .select("id, name, grade, created_at")
      .eq("teacher_id", teacher.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false }),
    fetchMyTeacherSchool(),
    fetchHofBoard({ tab: "world" }),
  ]);

  if (error) {
    console.error("[pm] list classes failed:", error.message);
  }

  const classIds = (classes ?? []).map((c) => c.id);
  let counts: Record<string, number> = {};
  let todayActivity: Record<string, number> = {};

  if (classIds.length > 0) {
    const [{ data: studentRows, error: countError }, activityCounts] =
      await Promise.all([
        supabase.from("pm_students").select("class_id").in("class_id", classIds),
        fetchClassTodayActivityCounts(classIds),
      ]);
    todayActivity = activityCounts;

    if (countError) {
      console.error("[pm] count students failed:", countError.message);
    } else {
      counts = Object.fromEntries(classIds.map((id) => [id, 0]));
      for (const row of studentRows ?? []) {
        const classId = row.class_id as string;
        counts[classId] = (counts[classId] ?? 0) + 1;
      }
    }
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

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-stretch">
        <div className="flex flex-col gap-5">
          <TeacherSchoolPicker initial={teacherSchool} />
          <section className="quest-card p-5 sm:p-6">
            <h2 className="font-display text-xl text-wood">새 학급</h2>
            <div className="mt-4">
              <CreateClassForm />
            </div>
          </section>
        </div>
        <div className="flex h-[24rem] min-h-0 flex-col overflow-hidden lg:h-[30rem]">
          <HallOfFame
            initial={hof}
            fillHeight
            myClasses={(classes ?? []).map((c) => ({ id: c.id, name: c.name }))}
          />
        </div>
      </div>

      <section>
        <h2 className="font-display text-xl text-wood">학급 목록</h2>
        {(classes ?? []).length === 0 ? (
          <p className="coming-soon-slot mt-4 px-5 py-10 text-center text-sm text-foreground/55">
            아직 학급이 없어요. 위에서 첫 학급을 만들어 보세요.
          </p>
        ) : (
          <TeacherClassList
            classes={(classes ?? []).map((c) => ({
              id: c.id,
              name: c.name,
              grade: c.grade,
              studentCount: counts[c.id] ?? 0,
              todayActivity: todayActivity[c.id] ?? 0,
            }))}
          />
        )}
      </section>
    </div>
  );
}
