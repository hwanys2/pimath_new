import type { Metadata } from "next";
import "@hwanys2/pm-board/styles/pm-board.css";
import { getActor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BoardApp } from "@hwanys2/pm-board";
import type { ClassRoster } from "@hwanys2/pm-board";
import { formatStudentLabel, withStudentRosterOrder } from "@/lib/students";

export const metadata: Metadata = {
  title: "전자칠판 | 수학하는 즐거움",
  description:
    "수학 수업에 특화된 전자칠판 — 판서, 타이머, 학생 뽑기, 함수 그래프, 자·각도기까지 한 화면에서",
};

/** Teacher-only: class rosters for the random student picker. */
async function fetchRosters(): Promise<ClassRoster[]> {
  const actor = await getActor();
  if (actor?.type !== "teacher") return [];

  const supabase = await createClient();
  const { data: classes, error: classError } = await supabase
    .from("pm_classes")
    .select("id, name")
    .eq("teacher_id", actor.id)
    .order("created_at", { ascending: false });

  if (classError || !classes || classes.length === 0) {
    if (classError) {
      console.error("[pm] board fetch classes failed:", classError.message);
    }
    return [];
  }

  const classIds = classes.map((c) => c.id as string);
  const { data: students, error: studentError } = await withStudentRosterOrder(
    supabase
      .from("pm_students")
      .select("class_id, display_name, student_number")
      .in("class_id", classIds),
  );

  if (studentError) {
    console.error("[pm] board fetch students failed:", studentError.message);
  }

  return classes.map((c) => ({
    id: c.id as string,
    name: c.name as string,
    students: (students ?? [])
      .filter((s) => s.class_id === c.id)
      .map((s) =>
        formatStudentLabel(
          s.display_name as string,
          typeof s.student_number === "number" ? s.student_number : null,
        ),
      ),
  }));
}

export default async function BoardPage() {
  const rosters = await fetchRosters();
  const actor = await getActor();
  const isTeacher = actor?.type === "teacher";
  return (
    <BoardApp
      brand={{ title: "수학하는 즐거움 · 전자칠판", homeHref: "/" }}
      rosters={rosters}
      isTeacher={isTeacher}
    />
  );
}
