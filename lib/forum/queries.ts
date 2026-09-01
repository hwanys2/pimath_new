import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  FORUM_PAGE_SIZE,
  isForumCategoryId,
  isForumPostId,
  type ForumCategoryId,
} from "@/lib/forum/catalog";
import { forumImagePublicUrl, sanitizeForumImagePaths } from "@/lib/forum/storage";
import type {
  ForumComment,
  ForumPostDetail,
  ForumPostList,
  ForumPostSummary,
  ForumStoredImage,
} from "@/lib/forum/types";

function asText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asInt(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function asCategory(value: unknown): ForumCategoryId | null {
  if (typeof value !== "string") return null;
  return isForumCategoryId(value) ? value : null;
}

function firstRows(data: unknown): Record<string, unknown>[] {
  if (!data) return [];
  if (Array.isArray(data)) {
    return data.filter(
      (row): row is Record<string, unknown> =>
        row != null && typeof row === "object",
    );
  }
  if (typeof data === "object") return [data as Record<string, unknown>];
  return [];
}

function toImages(paths: unknown): ForumStoredImage[] {
  return sanitizeForumImagePaths(paths)
    .map((path) => {
      const url = forumImagePublicUrl(path);
      return url ? { path, url } : null;
    })
    .filter((item): item is ForumStoredImage => item != null);
}

function mapSummary(row: Record<string, unknown>): ForumPostSummary | null {
  const id = asText(row.id);
  const category = asCategory(row.category);
  const title = asText(row.title);
  const createdAt = asText(row.created_at);
  if (!id || !category || !title || !createdAt) return null;
  return {
    id,
    category,
    title,
    bodyPreview: asText(row.body_preview) ?? "",
    authorName: asText(row.author_name) ?? "회원",
    isAuthor: Boolean(row.is_author),
    isAdminAuthor: Boolean(row.is_admin_author),
    commentCount: asInt(row.comment_count),
    imageCount: asInt(row.image_count),
    createdAt,
  };
}

function mapDetail(row: Record<string, unknown>): ForumPostDetail | null {
  const id = asText(row.id);
  const category = asCategory(row.category);
  const title = asText(row.title);
  const body = asText(row.body);
  const createdAt = asText(row.created_at);
  const updatedAt = asText(row.updated_at);
  if (!id || !category || !title || !body || !createdAt || !updatedAt) {
    return null;
  }
  return {
    id,
    category,
    title,
    body,
    images: toImages(row.image_paths),
    authorName: asText(row.author_name) ?? "회원",
    isAuthor: Boolean(row.is_author),
    isAdminAuthor: Boolean(row.is_admin_author),
    createdAt,
    updatedAt,
  };
}

function mapComment(row: Record<string, unknown>): ForumComment | null {
  const id = asText(row.id);
  const body = asText(row.body);
  const createdAt = asText(row.created_at);
  if (!id || !body || !createdAt) return null;
  return {
    id,
    body,
    images: toImages(row.image_paths),
    authorName: asText(row.author_name) ?? "회원",
    isAuthor: Boolean(row.is_author),
    isAdminAuthor: Boolean(row.is_admin_author),
    createdAt,
  };
}

export async function listForumPosts(input: {
  category?: string | null;
  page?: number;
}): Promise<ForumPostList> {
  const category =
    input.category && isForumCategoryId(input.category)
      ? input.category
      : null;
  const page = Number.isFinite(input.page) && (input.page ?? 0) > 0
    ? Math.floor(input.page as number)
    : 1;
  const offset = (page - 1) * FORUM_PAGE_SIZE;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pm_list_forum_posts", {
    p_category: category,
    p_limit: FORUM_PAGE_SIZE,
    p_offset: offset,
  });
  if (error) {
    console.error("[pm] listForumPosts failed:", error.message);
    return { posts: [], totalCount: 0 };
  }
  const rows = firstRows(data);
  const posts = rows
    .map(mapSummary)
    .filter((row): row is ForumPostSummary => row != null);
  const totalCount = asInt(rows[0]?.total_count);
  return { posts, totalCount };
}

export async function getForumPost(
  id: string,
): Promise<ForumPostDetail | null> {
  if (!isForumPostId(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pm_get_forum_post", {
    p_id: id,
  });
  if (error) {
    console.error("[pm] getForumPost failed:", error.message);
    return null;
  }
  const row = firstRows(data)[0];
  return row ? mapDetail(row) : null;
}

export async function listForumComments(
  postId: string,
): Promise<ForumComment[]> {
  if (!isForumPostId(postId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pm_list_forum_comments", {
    p_post_id: postId,
  });
  if (error) {
    console.error("[pm] listForumComments failed:", error.message);
    return [];
  }
  return firstRows(data)
    .map(mapComment)
    .filter((row): row is ForumComment => row != null);
}
