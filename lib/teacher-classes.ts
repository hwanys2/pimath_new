import "server-only";
import { getActor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { TeacherClassOption } from "@/components/content/AssignContentButton";

/** Load teacher classes for assign UI; empty if not a teacher. */
export async function fetchTeacherClassesForAssign(): Promise<
  TeacherClassOption[] | null
> {
  const actor = await getActor();
  if (!actor || actor.type !== "teacher") return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pm_classes")
    .select("id, name, grade")
    .eq("teacher_id", actor.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[pm] fetchTeacherClassesForAssign failed:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    grade: (row.grade as number | null) ?? null,
  }));
}
