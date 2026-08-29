"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import {
  createDiagramFeedbackAction,
  resolveDiagramFeedbackAction,
} from "@/app/tools/figures/actions";
import type {
  DiagramFeedbackItem,
  DiagramFeedbackStatus,
} from "@/lib/diagrams/feedback-types";

type Props = {
  toolId: string;
  toolTitle: string;
  initialComments: DiagramFeedbackItem[];
  isLoggedIn: boolean;
  isAdmin: boolean;
};

const textareaClass =
  "w-full resize-y rounded-xl border-2 border-wood/15 bg-white px-3 py-2.5 text-sm text-foreground outline-none transition placeholder:text-foreground/35 focus:border-sky focus:ring-2 focus:ring-sky/40";

export default function DiagramFeedback({
  toolId,
  toolTitle,
  initialComments,
  isLoggedIn,
  isAdmin,
}: Props) {
  const [comments, setComments] = useState(initialComments);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [resolveId, setResolveId] = useState<string | null>(null);
  const [resolveStatus, setResolveStatus] =
    useState<Exclude<DiagramFeedbackStatus, "open">>("applied");
  const [resolveNote, setResolveNote] = useState("");

  useEffect(() => {
    setComments(initialComments);
  }, [initialComments]);

  const loginHref = `/login/teacher?next=${encodeURIComponent(
    `/tools/figures/${toolId}#feedback`,
  )}`;

  function submitComment() {
    const nextBody = body.trim();
    if (!nextBody) {
      setError("내용을 입력해 주세요.");
      return;
    }
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await createDiagramFeedbackAction({
        toolId,
        body: nextBody,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.comments) setComments(result.comments);
      setBody("");
      setNotice("의견을 남겼어요. 확인 후 반영할게요.");
    });
  }

  function openResolve(
    id: string,
    status: Exclude<DiagramFeedbackStatus, "open">,
  ) {
    setResolveId(id);
    setResolveStatus(status);
    setResolveNote("");
    setError(null);
    setNotice(null);
  }

  function submitResolve() {
    if (!resolveId) return;
    setError(null);
    setNotice(null);
    const id = resolveId;
    const status = resolveStatus;
    const adminNote = resolveNote;
    startTransition(async () => {
      const result = await resolveDiagramFeedbackAction({
        toolId,
        id,
        status,
        adminNote,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.comments) setComments(result.comments);
      setResolveId(null);
      setResolveNote("");
      setNotice(
        status === "applied" ? "반영완료로 표시했어요." : "반려로 표시했어요.",
      );
    });
  }

  return (
    <section
      id="feedback"
      className="quest-card-static scroll-mt-24 space-y-5 p-5 sm:p-6"
      aria-labelledby="diagram-feedback-heading"
    >
      <header>
        <h2
          id="diagram-feedback-heading"
          className="font-display text-2xl text-wood-dark"
        >
          의견
        </h2>
        <p className="mt-1 text-sm text-foreground/65">
          {toolTitle} 도구를 쓰다 불편한 점이나 보완할 점을 남겨 주세요. 확인 후
          고쳐 나갑니다.
        </p>
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
          <label htmlFor="diagram-feedback-body" className="sr-only">
            의견 내용
          </label>
          <textarea
            id="diagram-feedback-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={2000}
            rows={3}
            disabled={pending}
            placeholder="예: 설명선이 점 이름과 겹쳐요, 직각 표시를 키울 수 있으면 좋겠어요"
            className={textareaClass}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-foreground/45">{body.length} / 2000</p>
            <button
              type="submit"
              disabled={pending}
              className="font-display rounded-xl bg-wood px-4 py-2.5 text-sm text-cream shadow-[0_3px_0_rgba(90,58,34,0.35)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "보내는 중…" : "의견 남기기"}
            </button>
          </div>
        </form>
      ) : (
        <p className="rounded-xl bg-sky/10 px-3 py-2.5 text-sm text-foreground/75">
          의견을 남기려면{" "}
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
        <p className="text-sm text-foreground/50">아직 의견이 없어요.</p>
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
                  {formatFeedbackTime(item.createdAt)}
                </time>
                <StatusBadge status={item.status} />
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">
                {item.body}
              </p>
              {item.adminNote ? (
                <p className="mt-2 rounded-xl bg-wood/5 px-3 py-2 text-sm text-wood-dark">
                  <span className="font-semibold">처리 사유 · </span>
                  {item.adminNote}
                </p>
              ) : null}
              {isAdmin ? (
                <div className="mt-3 space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => openResolve(item.id, "applied")}
                      className="rounded-lg bg-mint/50 px-3 py-1.5 text-xs font-bold text-wood-dark hover:bg-mint/70 disabled:opacity-60"
                    >
                      반영완료
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => openResolve(item.id, "rejected")}
                      className="rounded-lg bg-peach/50 px-3 py-1.5 text-xs font-bold text-[#a63a1a] hover:bg-peach/70 disabled:opacity-60"
                    >
                      반려
                    </button>
                  </div>
                  {resolveId === item.id ? (
                    <div className="space-y-2 rounded-xl bg-cream/60 p-3">
                      <p className="text-xs font-semibold text-wood">
                        {resolveStatus === "applied" ? "반영완료" : "반려"}{" "}
                        사유 (선택)
                      </p>
                      <textarea
                        value={resolveNote}
                        onChange={(e) => setResolveNote(e.target.value)}
                        maxLength={2000}
                        rows={2}
                        disabled={pending}
                        placeholder="사용자에게 보여 줄 사유"
                        className={textareaClass}
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={pending}
                          onClick={submitResolve}
                          className="font-display rounded-lg bg-wood px-3 py-1.5 text-xs text-cream disabled:opacity-60"
                        >
                          확인
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => setResolveId(null)}
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

function StatusBadge({ status }: { status: DiagramFeedbackStatus }) {
  if (status === "applied") {
    return (
      <span className="rounded-full bg-mint/50 px-2 py-0.5 text-[11px] font-bold text-wood-dark">
        반영완료
      </span>
    );
  }
  if (status === "rejected") {
    return (
      <span className="rounded-full bg-peach/50 px-2 py-0.5 text-[11px] font-bold text-[#a63a1a]">
        반려
      </span>
    );
  }
  return (
    <span className="rounded-full bg-wood/10 px-2 py-0.5 text-[11px] font-bold text-wood/70">
      대기
    </span>
  );
}

function formatFeedbackTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}시간 전`;
  const day = Math.floor(hour / 24);
  if (day < 7) return `${day}일 전`;
  return date.toLocaleDateString("ko-KR");
}
