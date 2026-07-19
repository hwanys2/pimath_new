import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getStudentSessionToken } from "@/lib/student-session";
import { getContent, type ContentMeta } from "@/lib/contents";

export type ClassContentAssignment = {
  contentKey: string;
  isActive: boolean;
  assignedAt: string;
};

export type AssignedContentView = ClassContentAssignment & {
  content: ContentMeta | null;
};

function firstRows<T>(data: T | T[] | null): T[] {
  if (!data) return [];
  return Array.isArray(data) ? data : [data];
}

/** Teacher: list assignments for a class (RLS). */
export async function fetchClassContentAssignments(
  classId: string,
): Promise<ClassContentAssignment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pm_class_contents")
    .select("content_key, is_active, created_at")
    .eq("class_id", classId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[pm] fetchClassContentAssignments failed:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    contentKey: row.content_key as string,
    isActive: Boolean(row.is_active),
    assignedAt: row.created_at as string,
  }));
}

/** Student: list own class assignments via session RPC. */
export async function fetchMyClassContents(
  sessionToken?: string | null,
): Promise<AssignedContentView[]> {
  const token = sessionToken ?? (await getStudentSessionToken());
  if (!token) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pm_list_my_class_contents", {
    p_session_token: token,
  });

  if (error) {
    console.error("[pm] pm_list_my_class_contents failed:", error.message);
    return [];
  }

  const rows = firstRows(data) as {
    content_key: string;
    is_active: boolean;
    assigned_at: string;
  }[];

  return rows.map((row) => ({
    contentKey: row.content_key,
    isActive: Boolean(row.is_active),
    assignedAt: row.assigned_at,
    content: getContent(row.content_key) ?? null,
  }));
}
