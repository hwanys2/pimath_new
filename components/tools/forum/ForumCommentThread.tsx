"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createForumCommentAction,
  deleteForumCommentAction,
  deleteForumPostAction,
} from "@/app/tools/forum/actions";
import ForumImagePicker, {
  type ForumImageDraft,
} from "@/components/tools/forum/ForumImagePicker";
import ForumImages from "@/components/tools/forum/ForumImages";
import { FORUM_COMMENT_IMAGE_MAX, FORUM_COMMENT_MAX } from "@/lib/forum/catalog";
import { formatForumTime } from "@/lib/forum/time";
import type { ForumComment } from "@/lib/forum/types";

const fieldClass =
  "w-full resize-y rounded-xl border-2 border-wood/15 bg-white px-3 py-2.5 text-sm text-foreground outline-none transition placeholder:text-foreground/35 focus:border-sky focus:ring-2 focus:ring-sky/40";

type Props = {
  postId: string;
  comments: ForumComment[];
  isLoggedIn: boolean;
  canEditPost: boolean;
  isAdmin: boolean;
};

export default function ForumCommentThread({
  postId,
  comments,
  isLoggedIn,
  canEditPost,
  isAdmin,
}: Props) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [images, setImages] = useState<ForumImageDraft>({
    kept: [],
    files: [],
  });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [pickerKey, setPickerKey] = useState(0);
  const [deleteCommentId, setDeleteCommentId] = useState<string | null>(null);
  const [deletePostOpen, setDeletePostOpen] = useState(false);

  const loginHref = `/login/teacher?next=${encodeURIComponent(
    `/tools/forum/${postId}`,
  )}`;

  function submitComment() {
    const nextBody = body.trim();
    if (!nextBody) {
      setError("내용을 입력해 주세요.");
      return;
    }
    setError(null);
    setNotice(null);
    const formData = new FormData();
    formData.set("postId", postId);
    formData.set("body", nextBody);
    for (const file of images.files) formData.append("images", file);
    startTransition(async () => {
      const result = await createForumCommentAction(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setBody("");
      setImages({ kept: [], files: [] });
      setPickerKey((n) => n + 1);
      setNotice("댓글을 남겼어요.");
      router.refresh();
    });
  }

  function submitDeleteComment() {
    if (!deleteCommentId) return;
    const id = deleteCommentId;
    setError(null);
    startTransition(async () => {
      const result = await deleteForumCommentAction({
        postId,
        commentId: id,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setDeleteCommentId(null);
      setNotice("댓글을 삭제했어요.");
      router.refresh();
    });
  }

  function submitDeletePost() {
    setError(null);
    startTransition(async () => {
      const result = await deleteForumPostAction(postId);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push("/tools/forum");
      router.refresh();
    });
  }

  return (
    <section className="space-y-5" aria-labelledby="forum-comments-heading">
      {canEditPost || isAdmin ? (
        <div className="flex flex-wrap gap-2">
          {canEditPost ? (
            <Link
              href={`/tools/forum/${postId}/edit`}
              className="rounded-lg bg-black/5 px-3 py-1.5 text-xs font-bold text-wood-dark hover:bg-black/10"
            >
              수정
            </Link>
          ) : null}
          <button
            type="button"
            disabled={pending}
            onClick={() => setDeletePostOpen(true)}
            className="rounded-lg bg-black/5 px-3 py-1.5 text-xs font-bold text-wood-dark hover:bg-black/10 disabled:opacity-60"
          >
            삭제
          </button>
        </div>
      ) : null}

      {deletePostOpen ? (
        <div className="space-y-2 rounded-xl bg-cream/60 p-3">
          <p className="text-xs font-semibold text-wood">
            이 글과 댓글을 삭제할까요? 되돌릴 수 없어요.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={submitDeletePost}
              className="font-display rounded-lg bg-wood px-3 py-1.5 text-xs text-cream disabled:opacity-60"
            >
              삭제 확인
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setDeletePostOpen(false)}
              className="rounded-lg bg-black/5 px-3 py-1.5 text-xs font-semibold text-wood-dark"
            >
              취소
            </button>
          </div>
        </div>
      ) : null}

      <header>
        <h2
          id="forum-comments-heading"
          className="font-display text-xl text-wood-dark"
        >
          댓글 {comments.length}
        </h2>
      </header>

      {notice ? (
        <p className="rounded-xl bg-mint/30 px-3 py-2 text-sm text-wood-dark">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl bg-peach/40 px-3 py-2 text-sm font-semibold text-[#a63a1a]">
          {error}
        </p>
      ) : null}

      {isLoggedIn ? (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            submitComment();
          }}
        >
          <label htmlFor="forum-comment-body" className="sr-only">
            댓글
          </label>
          <textarea
            id="forum-comment-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={FORUM_COMMENT_MAX}
            rows={3}
            disabled={pending}
            placeholder="편하게 이어서 이야기해 주세요"
            className={fieldClass}
          />
          <ForumImagePicker
            key={pickerKey}
            max={FORUM_COMMENT_IMAGE_MAX}
            disabled={pending}
            onChange={setImages}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-foreground/45">
              {body.length} / {FORUM_COMMENT_MAX} · 그림 {FORUM_COMMENT_IMAGE_MAX}
              장까지
            </p>
            <button
              type="submit"
              disabled={pending}
              className="font-display rounded-xl bg-wood px-4 py-2.5 text-sm text-cream shadow-[0_3px_0_rgba(90,58,34,0.35)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "보내는 중…" : "댓글 남기기"}
            </button>
          </div>
        </form>
      ) : (
        <p className="rounded-xl bg-sky/10 px-3 py-2.5 text-sm text-foreground/75">
          글을 쓰거나 댓글을 남기려면{" "}
          <Link
            href={loginHref}
            className="font-bold text-sky underline-offset-2 hover:underline"
          >
            교사 로그인
          </Link>
          이 필요해요. (foreducator와 같은 계정)
        </p>
      )}

      {comments.length === 0 ? (
        <p className="text-sm text-foreground/50">아직 댓글이 없어요.</p>
      ) : (
        <ul className="space-y-3">
          {comments.map((item) => (
            <li
              key={item.id}
              className="rounded-2xl border border-wood/10 bg-white/70 px-4 py-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-bold text-wood-dark">
                  {item.authorName}
                  {item.isAdminAuthor ? (
                    <span className="ml-1.5 text-xs font-semibold text-wood/60">
                      관리자
                    </span>
                  ) : null}
                  {item.isAuthor ? (
                    <span className="ml-1.5 text-xs font-semibold text-sky">
                      나
                    </span>
                  ) : null}
                </p>
                <time
                  className="text-xs text-foreground/45"
                  dateTime={item.createdAt}
                >
                  {formatForumTime(item.createdAt)}
                </time>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">
                {item.body}
              </p>
              <ForumImages images={item.images} size="sm" />
              {item.isAuthor || isAdmin ? (
                <div className="mt-3 space-y-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => setDeleteCommentId(item.id)}
                    className="rounded-lg bg-black/5 px-3 py-1.5 text-xs font-bold text-wood-dark hover:bg-black/10 disabled:opacity-60"
                  >
                    삭제
                  </button>
                  {deleteCommentId === item.id ? (
                    <div className="space-y-2 rounded-xl bg-cream/60 p-3">
                      <p className="text-xs font-semibold text-wood">
                        이 댓글을 삭제할까요?
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={pending}
                          onClick={submitDeleteComment}
                          className="font-display rounded-lg bg-wood px-3 py-1.5 text-xs text-cream disabled:opacity-60"
                        >
                          삭제 확인
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => setDeleteCommentId(null)}
                          className="rounded-lg bg-black/5 px-3 py-1.5 text-xs font-semibold text-wood-dark"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
