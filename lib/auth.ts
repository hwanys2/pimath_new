import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import {
  getStudentSession,
  type StudentSessionPayload,
} from "@/lib/student-session";
import { fetchStudentProgress, type StudentProgress } from "@/lib/xp-award";

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
  level: number;
  totalXp: number;
  activeAvatar: string;
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
 * Uses getClaims() (local JWT validation) — proxy already refreshes the session.
 * Prefer getActor() when student sessions also matter.
 */
export const getDisplayUser = cache(async (): Promise<DisplayUser | null> => {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    const claims = data?.claims;
    if (!claims?.sub) return null;

    const meta = claims.user_metadata as Record<string, unknown> | undefined;
    const email = (claims.email as string | undefined) ?? null;

    return {
      id: claims.sub,
      email,
      name: pickName(email, meta),
    };
  } catch (error) {
    if (isNextControlFlowError(error)) throw error;
    console.error("[pm] getDisplayUser failed:", error);
    return null;
  }
});

function studentToActor(
  session: StudentSessionPayload,
  progress: StudentProgress | null,
): StudentActor {
  return {
    type: "student",
    id: session.id,
    name: progress?.displayName ?? session.displayName,
    loginId: session.loginId,
    classId: session.classId,
    className: progress?.className ?? session.className,
    teacherId: session.teacherId,
    level: progress?.level ?? 1,
    totalXp: progress?.totalXp ?? 0,
    activeAvatar: progress?.activeAvatar ?? "pi",
  };
}

/**
 * Teacher Supabase session takes precedence over student cookie
 * when both somehow exist.
 */
export const getActor = cache(async (): Promise<Actor | null> => {
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
    if (!student) return null;

    const progress = await fetchStudentProgress(student.sessionToken);
    return studentToActor(student, progress);
  } catch (error) {
    if (isNextControlFlowError(error)) throw error;
    console.error("[pm] getActor failed:", error);
    return null;
  }
});

export async function requireTeacher(): Promise<TeacherActor> {
  const actor = await getActor();
  if (actor?.type === "teacher") return actor;
  const { redirect } = await import("next/navigation");
  redirect("/login/teacher");
  throw new Error("unreachable");
}

export async function requireStudent(): Promise<StudentActor> {
  const actor = await getActor();
  if (actor?.type === "student") return actor;
  const { redirect } = await import("next/navigation");
  redirect("/login/student");
  throw new Error("unreachable");
}

/** Keep logged-in students inside the /adventure shell. */
export async function redirectStudentToAdventure(
  actor?: Actor | null,
): Promise<void> {
  const resolved = actor !== undefined ? actor : await getActor();
  if (resolved?.type === "student") {
    const { redirect } = await import("next/navigation");
    redirect("/adventure");
  }
}
