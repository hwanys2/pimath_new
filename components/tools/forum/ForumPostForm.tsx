"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createForumPostAction,
  updateForumPostAction,
} from "@/app/tools/forum/actions";
import ForumImagePicker, {
  type ForumImageDraft,
} from "@/components/tools/forum/ForumImagePicker";
import {
  FORUM_BODY_MAX,
  FORUM_CATEGORIES,
  FORUM_POST_IMAGE_MAX,
  FORUM_TITLE_MAX,
  type ForumCategoryId,
} from "@/lib/forum/catalog";
import type { ForumStoredImage } from "@/lib/forum/types";

const fieldClass =
  "w-full rounded-xl border-2 border-wood/15 bg-white px-3 py-2.5 text-sm text-foreground outline-none transition placeholder:text-foreground/35 focus:border-sky focus:ring-2 focus:ring-sky/40";

type Props = {
  mode: "create" | "edit";
  postId?: string;
  initialCategory?: ForumCategoryId;
  initialTitle?: string;
  initialBody?: string;
  initialImages?: ForumStoredImage[];
};

export default function ForumPostForm({
  mode,
  postId,
  initialCategory = "talk",
  initialTitle = "",
  initialBody = "",
  initialImages = [],
}: Props) {
  const router = useRouter();
  const [category, setCategory] = useState<ForumCategoryId>(initialCategory);
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const [images, setImages] = useState<ForumImageDraft>({
    kept: initialImages.map((image) => image.path),
    files: [],
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    const nextTitle = title.trim();
    const nextBody = body.trim();
    if (nextTitle.length < 2) {
      setError("제목을 두 글자 이상 적어 주세요.");
      return;
    }
    if (!nextBody) {
      setError("내용을 입력해 주세요.");
      return;
    }
    setError(null);
    const formData = new FormData();
    formData.set("category", category);
    formData.set("title", nextTitle);
    formData.set("body", nextBody);
    for (const path of images.kept) formData.append("keptImages", path);
    for (const file of images.files) formData.append("images", file);
    if (postId) formData.set("postId", postId);

    startTransition(async () => {
      const result =
        mode === "edit"
          ? await updateForumPostAction(formData)
          : await createForumPostAction(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.postId) {
        router.push(`/tools/forum/${result.postId}`);
        router.refresh();
      }
    });
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <fieldset className="space-y-2">
        <legend className="text-sm font-bold text-wood">글 종류</legend>
        <div className="flex flex-wrap gap-2">
          {FORUM_CATEGORIES.map((item) => {
            const active = category === item.id;
            return (
              <button
                key={item.id}
                type="button"
                disabled={pending}
                onClick={() => setCategory(item.id)}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                  active
                    ? "bg-wood text-cream"
                    : "bg-white/80 text-wood-dark hover:bg-white"
                }`}
              >
                {item.emoji} {item.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div>
        <label htmlFor="forum-title" className="text-sm font-bold text-wood">
          제목
        </label>
        <input
          id="forum-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={FORUM_TITLE_MAX}
          disabled={pending}
          placeholder="한눈에 보이게 짧게"
          className={`${fieldClass} mt-1`}
        />
      </div>

      <div>
        <label htmlFor="forum-body" className="text-sm font-bold text-wood">
          내용
        </label>
        <textarea
          id="forum-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={FORUM_BODY_MAX}
          disabled={pending}
          rows={8}
          placeholder="불편한 점, 이런 프로그램이 있으면 좋겠다는 아이디어, 사용하면서 느낀 점을 편하게 적어 주세요."
          className={`${fieldClass} mt-1 resize-y`}
        />
        <p className="mt-1 text-xs text-foreground/45">
          {body.length} / {FORUM_BODY_MAX}
        </p>
      </div>

      <div>
        <p className="text-sm font-bold text-wood">그림</p>
        <p className="mb-2 text-xs text-foreground/50">
          설명에 도움이 되면 넣어 주세요. jpg, png, webp, gif · 최대{" "}
          {FORUM_POST_IMAGE_MAX}장
        </p>
        <ForumImagePicker
          initialImages={initialImages}
          max={FORUM_POST_IMAGE_MAX}
          disabled={pending}
          onChange={setImages}
        />
      </div>

      {error ? (
        <p className="rounded-xl bg-peach/40 px-3 py-2 text-sm font-semibold text-[#a63a1a]">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pending}
          className="font-display rounded-xl bg-wood px-4 py-2.5 text-sm text-cream shadow-[0_3px_0_rgba(90,58,34,0.35)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "저장하는 중…" : mode === "edit" ? "수정하기" : "글 올리기"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => router.back()}
          className="rounded-xl bg-black/5 px-4 py-2.5 text-sm font-semibold text-wood-dark"
        >
          취소
        </button>
      </div>
    </form>
  );
}
