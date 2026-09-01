"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  FORUM_BODY_MAX,
  FORUM_BUCKET,
  FORUM_COMMENT_IMAGE_MAX,
  FORUM_COMMENT_MAX,
  FORUM_IMAGE_MAX_BYTES,
  FORUM_POST_IMAGE_MAX,
  FORUM_TITLE_MAX,
  isForumCategoryId,
  isForumPostId,
  mimeToForumExt,
} from "@/lib/forum/catalog";
import { mapForumError } from "@/lib/forum/errors";
import {
  getForumPost,
  listForumComments,
} from "@/lib/forum/queries";
import { sanitizeForumImagePaths } from "@/lib/forum/storage";
import type { ForumComment, ForumPostDetail } from "@/lib/forum/types";

export type ForumActionResult = {
  error?: string;
  postId?: string;
  post?: ForumPostDetail;
  comments?: ForumComment[];
};

function filesFromForm(formData: FormData, key: string): File[] {
  return formData
    .getAll(key)
    .filter((item): item is File => item instanceof File && item.size > 0);
}

async function requireUid() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const uid = data?.claims?.sub;
  if (typeof uid !== "string" || !uid) {
    return { error: "로그인이 필요해요." as const, supabase, uid: null };
  }
  return { supabase, uid, error: null };
}

async function uploadImages(
  supabase: Awaited<ReturnType<typeof createClient>>,
  uid: string,
  files: File[],
  max: number,
): Promise<{ paths: string[]; error?: string }> {
  if (files.length > max) {
    return { paths: [], error: "그림은 정해진 장수까지예요." };
  }
  const paths: string[] = [];
  for (const file of files) {
    if (file.size > FORUM_IMAGE_MAX_BYTES) {
      return { paths, error: "그림은 장당 4MB까지예요." };
    }
    const ext = mimeToForumExt(file.type);
    if (!ext) {
      return { paths, error: "jpg, png, webp, gif만 올릴 수 있어요." };
    }
    const path = `${uid}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from(FORUM_BUCKET)
      .upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
    if (error) {
      console.error("[pm] forum image upload failed:", error.message);
      return { paths, error: mapForumError(error.message) };
    }
    paths.push(path);
  }
  return { paths };
}

async function removeImages(
  supabase: Awaited<ReturnType<typeof createClient>>,
  paths: string[],
) {
  const clean = sanitizeForumImagePaths(paths);
  if (clean.length === 0) return;
  const { error } = await supabase.storage.from(FORUM_BUCKET).remove(clean);
  if (error) {
    console.error("[pm] forum image remove failed:", error.message);
  }
}

async function refreshPost(postId: string) {
  revalidatePath("/tools/forum");
  revalidatePath(`/tools/forum/${postId}`);
  revalidatePath(`/tools/forum/${postId}/edit`);
  const [post, comments] = await Promise.all([
    getForumPost(postId),
    listForumComments(postId),
  ]);
  return { post: post ?? undefined, comments };
}

export async function createForumPostAction(
  formData: FormData,
): Promise<ForumActionResult> {
  const auth = await requireUid();
  if (auth.error || !auth.uid) return { error: auth.error ?? "로그인이 필요해요." };

  const category = String(formData.get("category") ?? "");
  if (!isForumCategoryId(category)) {
    return { error: "글 종류를 골라 주세요." };
  }
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (title.length < 2) return { error: "제목을 두 글자 이상 적어 주세요." };
  if (title.length > FORUM_TITLE_MAX) return { error: "제목은 80자까지예요." };
  if (!body) return { error: "내용을 입력해 주세요." };
  if (body.length > FORUM_BODY_MAX) return { error: "내용이 너무 길어요." };

  const files = filesFromForm(formData, "images");
  if (files.length > FORUM_POST_IMAGE_MAX) {
    return { error: "그림은 글당 5장까지예요." };
  }
  const uploaded = await uploadImages(
    auth.supabase,
    auth.uid,
    files,
    FORUM_POST_IMAGE_MAX,
  );
  if (uploaded.error) {
    await removeImages(auth.supabase, uploaded.paths);
    return { error: uploaded.error };
  }

  const { data, error } = await auth.supabase.rpc("pm_create_forum_post", {
    p_category: category,
    p_title: title,
    p_body: body,
    p_image_paths: uploaded.paths,
  });
  if (error) {
    await removeImages(auth.supabase, uploaded.paths);
    console.error("[pm] createForumPost failed:", error.message);
    return { error: mapForumError(error.message) };
  }

  const postId = typeof data === "string" ? data : String(data);
  revalidatePath("/tools/forum");
  return { postId };
}

export async function updateForumPostAction(
  formData: FormData,
): Promise<ForumActionResult> {
  const auth = await requireUid();
  if (auth.error || !auth.uid) return { error: auth.error ?? "로그인이 필요해요." };

  const postId = String(formData.get("postId") ?? "");
  if (!isForumPostId(postId)) return { error: "글을 찾을 수 없어요." };

  const existingPost = await getForumPost(postId);
  if (!existingPost) return { error: "글을 찾을 수 없어요." };
  if (!existingPost.isAuthor) return { error: "이 글은 지우거나 고칠 수 없어요." };

  const category = String(formData.get("category") ?? "");
  if (!isForumCategoryId(category)) {
    return { error: "글 종류를 골라 주세요." };
  }
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (title.length < 2) return { error: "제목을 두 글자 이상 적어 주세요." };
  if (title.length > FORUM_TITLE_MAX) return { error: "제목은 80자까지예요." };
  if (!body) return { error: "내용을 입력해 주세요." };
  if (body.length > FORUM_BODY_MAX) return { error: "내용이 너무 길어요." };

  const kept = sanitizeForumImagePaths(formData.getAll("keptImages"));
  const files = filesFromForm(formData, "images");
  if (kept.length + files.length > FORUM_POST_IMAGE_MAX) {
    return { error: "그림은 글당 5장까지예요." };
  }

  const uploaded = await uploadImages(
    auth.supabase,
    auth.uid,
    files,
    FORUM_POST_IMAGE_MAX - kept.length,
  );
  if (uploaded.error) {
    await removeImages(auth.supabase, uploaded.paths);
    return { error: uploaded.error };
  }

  const nextPaths = [...kept, ...uploaded.paths];
  const { error } = await auth.supabase.rpc("pm_update_forum_post", {
    p_id: postId,
    p_category: category,
    p_title: title,
    p_body: body,
    p_image_paths: nextPaths,
  });
  if (error) {
    await removeImages(auth.supabase, uploaded.paths);
    console.error("[pm] updateForumPost failed:", error.message);
    return { error: mapForumError(error.message) };
  }

  const dropped = existingPost.images
    .map((image) => image.path)
    .filter((path) => !kept.includes(path));
  await removeImages(auth.supabase, dropped);

  const refreshed = await refreshPost(postId);
  return { postId, ...refreshed };
}

export async function deleteForumPostAction(
  postId: string,
): Promise<ForumActionResult> {
  const auth = await requireUid();
  if (auth.error || !auth.uid) return { error: auth.error ?? "로그인이 필요해요." };
  if (!isForumPostId(postId)) return { error: "글을 찾을 수 없어요." };

  const [post, comments] = await Promise.all([
    getForumPost(postId),
    listForumComments(postId),
  ]);
  if (!post) return { error: "글을 찾을 수 없어요." };

  const { error } = await auth.supabase.rpc("pm_delete_forum_post", {
    p_id: postId,
  });
  if (error) {
    console.error("[pm] deleteForumPost failed:", error.message);
    return { error: mapForumError(error.message) };
  }

  const paths = [
    ...post.images.map((image) => image.path),
    ...comments.flatMap((comment) => comment.images.map((image) => image.path)),
  ];
  await removeImages(auth.supabase, paths);
  revalidatePath("/tools/forum");
  revalidatePath(`/tools/forum/${postId}`);
  return { postId };
}

export async function createForumCommentAction(
  formData: FormData,
): Promise<ForumActionResult> {
  const auth = await requireUid();
  if (auth.error || !auth.uid) return { error: auth.error ?? "로그인이 필요해요." };

  const postId = String(formData.get("postId") ?? "");
  if (!isForumPostId(postId)) return { error: "글을 찾을 수 없어요." };
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "내용을 입력해 주세요." };
  if (body.length > FORUM_COMMENT_MAX) return { error: "내용이 너무 길어요." };

  const files = filesFromForm(formData, "images");
  if (files.length > FORUM_COMMENT_IMAGE_MAX) {
    return { error: "그림은 댓글당 3장까지예요." };
  }
  const uploaded = await uploadImages(
    auth.supabase,
    auth.uid,
    files,
    FORUM_COMMENT_IMAGE_MAX,
  );
  if (uploaded.error) {
    await removeImages(auth.supabase, uploaded.paths);
    return { error: uploaded.error };
  }

  const { error } = await auth.supabase.rpc("pm_create_forum_comment", {
    p_post_id: postId,
    p_body: body,
    p_image_paths: uploaded.paths,
  });
  if (error) {
    await removeImages(auth.supabase, uploaded.paths);
    console.error("[pm] createForumComment failed:", error.message);
    return { error: mapForumError(error.message) };
  }

  return refreshPost(postId);
}

export async function deleteForumCommentAction(input: {
  postId: string;
  commentId: string;
}): Promise<ForumActionResult> {
  const auth = await requireUid();
  if (auth.error || !auth.uid) return { error: auth.error ?? "로그인이 필요해요." };
  if (!isForumPostId(input.postId) || !isForumPostId(input.commentId)) {
    return { error: "글을 찾을 수 없어요." };
  }

  const comments = await listForumComments(input.postId);
  const target = comments.find((item) => item.id === input.commentId);

  const { error } = await auth.supabase.rpc("pm_delete_forum_comment", {
    p_id: input.commentId,
  });
  if (error) {
    console.error("[pm] deleteForumComment failed:", error.message);
    return { error: mapForumError(error.message) };
  }

  if (target) {
    await removeImages(
      auth.supabase,
      target.images.map((image) => image.path),
    );
  }
  return refreshPost(input.postId);
}
