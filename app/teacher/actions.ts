"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTeacher } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  isValidLoginId,
  normalizeLoginId,
  type RosterRowInput,
} from "@/lib/students";

export type ActionResult = {
  error?: string;
  message?: string;
  errors?: { index: number; loginId: string; message: string }[];
  createdCount?: number;
};

function mapDbError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("unique") || lower.includes("duplicate")) {
    return "이미 사용 중인 아이디예요.";
  }
  if (lower.includes("invalid login_id")) {
    return "아이디 형식이 올바르지 않아요.";
  }
  if (lower.includes("password required")) {
    return "비밀번호를 입력해 주세요.";
  }
  if (lower.includes("display_name")) {
    return "이름을 입력해 주세요.";
  }
  if (lower.includes("not found") || lower.includes("not owned")) {
    return "학급 또는 학생을 찾을 수 없어요.";
  }
  return message;
}

export async function createClass(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const teacher = await requireTeacher();
  const name = String(formData.get("name") ?? "").trim();
  const gradeRaw = String(formData.get("grade") ?? "").trim();
  const grade = gradeRaw === "" ? null : Number(gradeRaw);

  if (!name) return { error: "학급 이름을 입력해 주세요." };
  if (grade !== null && (grade < 1 || grade > 3 || !Number.isInteger(grade))) {
    return { error: "학년은 1~3 중에서 골라 주세요." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pm_classes")
    .insert({
      teacher_id: teacher.id,
      name,
      grade,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[pm] createClass failed:", error.message);
    return { error: `학급을 만들지 못했어요. (${mapDbError(error.message)})` };
  }

  revalidatePath("/teacher");
  redirect(`/teacher/classes/${data.id}`);
}

export async function updateClass(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireTeacher();
  const classId = String(formData.get("classId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const gradeRaw = String(formData.get("grade") ?? "").trim();
  const grade = gradeRaw === "" ? null : Number(gradeRaw);

  if (!classId) return { error: "학급 정보가 없어요." };
  if (!name) return { error: "학급 이름을 입력해 주세요." };
  if (grade !== null && (grade < 1 || grade > 3 || !Number.isInteger(grade))) {
    return { error: "학년은 1~3 중에서 골라 주세요." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("pm_classes")
    .update({ name, grade })
    .eq("id", classId);

  if (error) {
    console.error("[pm] updateClass failed:", error.message);
    return { error: `학급을 수정하지 못했어요. (${mapDbError(error.message)})` };
  }

  revalidatePath("/teacher");
  revalidatePath(`/teacher/classes/${classId}`);
  return { message: "학급 정보를 저장했어요." };
}

export async function deleteClass(formData: FormData): Promise<void> {
  await requireTeacher();
  const classId = String(formData.get("classId") ?? "");
  if (!classId) redirect("/teacher");

  const supabase = await createClient();
  const { error } = await supabase.from("pm_classes").delete().eq("id", classId);

  if (error) {
    console.error("[pm] deleteClass failed:", error.message);
  }

  revalidatePath("/teacher");
  redirect("/teacher");
}

export async function createStudent(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireTeacher();
  const classId = String(formData.get("classId") ?? "");
  const displayName = String(formData.get("displayName") ?? "").trim();
  const loginId = normalizeLoginId(String(formData.get("loginId") ?? ""));
  const password = String(formData.get("password") ?? "");

  if (!classId) return { error: "학급 정보가 없어요." };
  if (!displayName) return { error: "이름을 입력해 주세요." };
  if (!isValidLoginId(loginId)) {
    return { error: "아이디를 올바르게 입력해 주세요. (공백 불가)" };
  }
  if (!password) return { error: "비밀번호를 입력해 주세요." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("pm_create_student", {
    p_class_id: classId,
    p_display_name: displayName,
    p_login_id: loginId,
    p_password: password,
  });

  if (error) {
    console.error("[pm] createStudent failed:", error.message);
    return { error: mapDbError(error.message) };
  }

  revalidatePath(`/teacher/classes/${classId}`);
  return { message: "학생을 등록했어요." };
}

export async function updateStudent(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireTeacher();
  const classId = String(formData.get("classId") ?? "");
  const studentId = String(formData.get("studentId") ?? "");
  const displayName = String(formData.get("displayName") ?? "").trim();
  const loginId = normalizeLoginId(String(formData.get("loginId") ?? ""));
  const password = String(formData.get("password") ?? "");

  if (!classId || !studentId) return { error: "학생 정보가 없어요." };
  if (!displayName) return { error: "이름을 입력해 주세요." };
  if (!isValidLoginId(loginId)) {
    return { error: "아이디를 올바르게 입력해 주세요. (공백 불가)" };
  }

  const supabase = await createClient();
  const { error: updateError } = await supabase.rpc("pm_update_student", {
    p_student_id: studentId,
    p_display_name: displayName,
    p_login_id: loginId,
  });

  if (updateError) {
    console.error("[pm] updateStudent failed:", updateError.message);
    return { error: mapDbError(updateError.message) };
  }

  if (password) {
    const { error: pwError } = await supabase.rpc("pm_set_student_password", {
      p_student_id: studentId,
      p_password: password,
    });
    if (pwError) {
      console.error("[pm] set password failed:", pwError.message);
      return { error: mapDbError(pwError.message) };
    }
  }

  revalidatePath(`/teacher/classes/${classId}`);
  return { message: "학생 정보를 저장했어요." };
}

export async function deleteStudent(formData: FormData): Promise<void> {
  await requireTeacher();
  const classId = String(formData.get("classId") ?? "");
  const studentId = String(formData.get("studentId") ?? "");

  if (!classId || !studentId) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("pm_students")
    .delete()
    .eq("id", studentId);

  if (error) {
    console.error("[pm] deleteStudent failed:", error.message);
  }

  revalidatePath(`/teacher/classes/${classId}`);
}

export async function bulkCreateStudents(
  classId: string,
  rows: RosterRowInput[],
): Promise<ActionResult> {
  await requireTeacher();

  if (!classId) return { error: "학급 정보가 없어요." };
  if (rows.length === 0) return { error: "등록할 학생이 없어요." };

  const payload = rows.map((r) => ({
    display_name: r.displayName.trim(),
    login_id: normalizeLoginId(r.loginId),
    password: r.password,
  }));

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pm_bulk_create_students", {
    p_class_id: classId,
    p_students: payload,
  });

  if (error) {
    console.error("[pm] bulkCreateStudents failed:", error.message);
    return { error: mapDbError(error.message) };
  }

  const result = data as {
    created?: unknown[];
    errors?: { index: number; login_id: string; message: string }[];
  } | null;

  const createdCount = Array.isArray(result?.created) ? result.created.length : 0;
  const errors = (result?.errors ?? []).map((e) => ({
    index: e.index,
    loginId: e.login_id,
    message: e.message,
  }));

  revalidatePath(`/teacher/classes/${classId}`);

  if (errors.length > 0 && createdCount === 0) {
    return {
      error: "학생을 등록하지 못했어요. 아래 오류를 확인해 주세요.",
      errors,
      createdCount: 0,
    };
  }

  if (errors.length > 0) {
    return {
      message: `${createdCount}명을 등록했어요. 일부 행에 오류가 있어요.`,
      errors,
      createdCount,
    };
  }

  return {
    message: `${createdCount}명을 등록했어요.`,
    createdCount,
  };
}

async function assertClassOwned(
  supabase: Awaited<ReturnType<typeof createClient>>,
  classId: string,
  teacherId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("pm_classes")
    .select("id")
    .eq("id", classId)
    .eq("teacher_id", teacherId)
    .maybeSingle();
  return Boolean(data);
}

export async function assignContentToClass(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const teacher = await requireTeacher();
  const classId = String(formData.get("classId") ?? "");
  const contentKey = String(formData.get("contentKey") ?? "").trim();

  if (!classId || !contentKey) return { error: "콘텐츠 정보가 없어요." };

  const { getContent } = await import("@/lib/contents");
  if (!getContent(contentKey)) {
    return { error: "등록되지 않은 콘텐츠예요." };
  }

  const supabase = await createClient();
  if (!(await assertClassOwned(supabase, classId, teacher.id))) {
    return { error: "학급을 찾을 수 없어요." };
  }

  const { error } = await supabase.from("pm_class_contents").insert({
    class_id: classId,
    content_key: contentKey,
    is_active: false,
  });

  if (error) {
    console.error("[pm] assignContentToClass failed:", error.message);
    return { error: mapDbError(error.message) };
  }

  revalidatePath(`/teacher/classes/${classId}`);
  revalidatePath("/adventure");
  return { message: "학급에 콘텐츠를 담아 두었어요." };
}

export async function unassignContentFromClass(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const teacher = await requireTeacher();
  const classId = String(formData.get("classId") ?? "");
  const contentKey = String(formData.get("contentKey") ?? "").trim();

  if (!classId || !contentKey) return { error: "콘텐츠 정보가 없어요." };

  const supabase = await createClient();
  if (!(await assertClassOwned(supabase, classId, teacher.id))) {
    return { error: "학급을 찾을 수 없어요." };
  }

  const { error } = await supabase
    .from("pm_class_contents")
    .delete()
    .eq("class_id", classId)
    .eq("content_key", contentKey);

  if (error) {
    console.error("[pm] unassignContentFromClass failed:", error.message);
    return { error: mapDbError(error.message) };
  }

  revalidatePath(`/teacher/classes/${classId}`);
  revalidatePath("/adventure");
  return { message: "학급에서 콘텐츠를 빼 두었어요." };
}

export async function setClassContentActive(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const teacher = await requireTeacher();
  const classId = String(formData.get("classId") ?? "");
  const contentKey = String(formData.get("contentKey") ?? "").trim();
  const activeRaw = String(formData.get("isActive") ?? "");
  const isActive = activeRaw === "true" || activeRaw === "1";

  if (!classId || !contentKey) return { error: "콘텐츠 정보가 없어요." };

  const supabase = await createClient();
  if (!(await assertClassOwned(supabase, classId, teacher.id))) {
    return { error: "학급을 찾을 수 없어요." };
  }

  const { error } = await supabase
    .from("pm_class_contents")
    .update({ is_active: isActive })
    .eq("class_id", classId)
    .eq("content_key", contentKey);

  if (error) {
    console.error("[pm] setClassContentActive failed:", error.message);
    return { error: mapDbError(error.message) };
  }

  revalidatePath(`/teacher/classes/${classId}`);
  revalidatePath("/adventure");
  return {
    message: isActive
      ? "콘텐츠를 활성화했어요. 학생 목록에서 플레이할 수 있어요."
      : "콘텐츠를 비활성화했어요.",
  };
}
