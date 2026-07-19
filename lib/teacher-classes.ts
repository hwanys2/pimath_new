import "server-only";
import { getActor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { TeacherClassOption } from "@/components/content/AssignContentButton";

export type TeacherAssignContext = {
  classes: TeacherClassOption[];
  /** contentKey → class ids that already have this content assigned */
  assignedByContent: Record<string, string[]>;
};

/**
 * Teacher-only: classes + which of those classes already have the given contents.
 * Returns null if the visitor is not a teacher.
 */
export async function fetchTeacherAssignContext(
  contentKeys: string[],
): Promise<TeacherAssignContext | null> {
  const actor = await getActor();
  if (!actor || actor.type !== "teacher") return null;

  const supabase = await createClient();
  const { data: classes, error: classError } = await supabase
    .from("pm_classes")
    .select("id, name, grade")
    .eq("teacher_id", actor.id)
    .order("created_at", { ascending: false });

  if (classError) {
    console.error("[pm] fetchTeacherAssignContext classes failed:", classError.message);
    return { classes: [], assignedByContent: {} };
  }

  const options: TeacherClassOption[] = (classes ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    grade: (row.grade as number | null) ?? null,
  }));

  const assignedByContent: Record<string, string[]> = {};
  for (const key of contentKeys) assignedByContent[key] = [];

  if (options.length === 0 || contentKeys.length === 0) {
    return { classes: options, assignedByContent };
  }

  const classIds = options.map((c) => c.id);
  const { data: rows, error: assignError } = await supabase
    .from("pm_class_contents")
    .select("class_id, content_key")
    .in("class_id", classIds)
    .in("content_key", contentKeys);

  if (assignError) {
    console.error(
      "[pm] fetchTeacherAssignContext assignments failed:",
      assignError.message,
    );
    return { classes: options, assignedByContent };
  }

  for (const row of rows ?? []) {
    const key = row.content_key as string;
    const classId = row.class_id as string;
    if (!assignedByContent[key]) assignedByContent[key] = [];
    assignedByContent[key].push(classId);
  }

  return { classes: options, assignedByContent };
}

/** @deprecated use fetchTeacherAssignContext */
export async function fetchTeacherClassesForAssign(): Promise<
  TeacherClassOption[] | null
> {
  const ctx = await fetchTeacherAssignContext([]);
  return ctx ? ctx.classes : null;
}
