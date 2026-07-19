import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  getStudentSession,
  type StudentSessionPayload,
} from "@/lib/student-session";

export type DisplayUser = {
  id: string;
  email: string | null;
  name: string;
};

export type TeacherActor = {
  type: "teacher";
  id: string;
  email: string | null;
  name: string;
};

export type StudentActor = {
  type: "student";
  id: string;
  name: string;
  loginId: string;
  classId: string;
  className: string;
  teacherId: string;
};

export type Actor = TeacherActor | StudentActor;

function pickName(
  email: string | null | undefined,
  meta: Record<string, unknown> | undefined,
): string {
  const candidate =
    (meta?.name as string) ||
    (meta?.full_name as string) ||
    (meta?.nickname as string) ||
    (meta?.user_name as string);
  if (candidate) return candidate;
  if (email) return email.split("@")[0];
  return "탐험가";
}

function isNextControlFlowError(error: unknown): boolean {
  const digest = (error as { digest?: unknown } | null)?.digest;
  return (
    typeof digest === "string" &&
    (digest === "DYNAMIC_SERVER_USAGE" ||
      digest.startsWith("NEXT_REDIRECT") ||
      digest === "NEXT_NOT_FOUND")
  );
}

/**
 * Returns the current signed-in teacher for display, or null.
 * Uses getUser() (validated) rather than getSession().
 * Prefer getActor() when student sessions also matter.
 */
export async function getDisplayUser(): Promise<DisplayUser | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    return {
      id: user.id,
      email: user.email ?? null,
      name: pickName(user.email, user.user_metadata),
    };
  } catch (error) {
    if (isNextControlFlowError(error)) throw error;
    console.error("[pm] getDisplayUser failed:", error);
    return null;
  }
}

function studentToActor(session: StudentSessionPayload): StudentActor {
  return {
    type: "student",
    id: session.id,
    name: session.displayName,
    loginId: session.loginId,
    classId: session.classId,
    className: session.className,
    teacherId: session.teacherId,
  };
}

/**
 * Teacher Supabase session takes precedence over student cookie
 * when both somehow exist.
 */
export async function getActor(): Promise<Actor | null> {
  try {
    const teacher = await getDisplayUser();
    if (teacher) {
      return {
        type: "teacher",
        id: teacher.id,
        email: teacher.email,
        name: teacher.name,
      };
    }

    const student = await getStudentSession();
    if (student) return studentToActor(student);
    return null;
  } catch (error) {
    if (isNextControlFlowError(error)) throw error;
    console.error("[pm] getActor failed:", error);
    return null;
  }
}

export async function requireTeacher(): Promise<TeacherActor> {
  const actor = await getActor();
  if (actor?.type === "teacher") return actor;
  const { redirect } = await import("next/navigation");
  redirect("/login/teacher");
  // redirect() never returns; satisfy the type checker.
  throw new Error("unreachable");
}
