import { getSupabaseUrl } from "@/lib/supabase/env";
import { FORUM_BUCKET, isForumImagePath } from "@/lib/forum/catalog";

export function forumImagePublicUrl(path: string): string {
  const trimmed = path.trim();
  if (!isForumImagePath(trimmed)) return "";
  const base = getSupabaseUrl().replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${FORUM_BUCKET}/${trimmed}`;
}

export function sanitizeForumImagePaths(paths: unknown): string[] {
  if (!Array.isArray(paths)) return [];
  const out: string[] = [];
  for (const item of paths) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim().toLowerCase();
    if (!isForumImagePath(trimmed)) continue;
    if (!out.includes(trimmed)) out.push(trimmed);
  }
  return out;
}
