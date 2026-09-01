import type { Metadata } from "next";
import Link from "next/link";
import { getDisplayUser } from "@/lib/auth";
import {
  FORUM_CATEGORIES,
  FORUM_PAGE_SIZE,
  getForumCategory,
  isForumCategoryId,
} from "@/lib/forum/catalog";
import { listForumPosts } from "@/lib/forum/queries";
import { formatForumTime } from "@/lib/forum/time";

export const metadata: Metadata = {
  title: "의견 게시판 | 수학하는 즐거움",
  description:
    "수업 도구를 쓰다 불편한 점이나 새 프로그램 아이디어를 편하게 남기는 게시판",
};

type Props = {
  searchParams: Promise<{ category?: string; page?: string }>;
};

export default async function ForumListPage({ searchParams }: Props) {
  const params = await searchParams;
  const category =
    params.category && isForumCategoryId(params.category)
      ? params.category
      : null;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const [{ posts, totalCount }, user] = await Promise.all([
    listForumPosts({ category, page }),
    getDisplayUser(),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalCount / FORUM_PAGE_SIZE));
  const loginHref = `/login/teacher?next=${encodeURIComponent("/tools/forum/new")}`;

  return (
    <div className="space-y-8">
      <header className="text-center">
        <p className="text-sm font-semibold text-wood">
          <Link href="/tools" className="hover:underline">
            수업 도구
          </Link>
          <span className="mx-1.5 text-foreground/30">/</span>
          의견 게시판
        </p>
        <h1 className="font-display mt-2 text-3xl text-wood-dark sm:text-4xl">
          💬 의견 게시판
        </h1>
        <p className="mx-auto mt-2 max-w-2xl text-foreground/70">
          쓰다 불편한 점, 이런 프로그램이 있으면 좋겠다는 아이디어를 편하게
          남겨 주세요. 그림도 넣을 수 있어요.
        </p>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex flex-wrap gap-2" aria-label="글 종류">
          <FilterChip href="/tools/forum" active={!category} label="전체" />
          {FORUM_CATEGORIES.map((item) => (
            <FilterChip
              key={item.id}
              href={`/tools/forum?category=${item.id}`}
              active={category === item.id}
              label={`${item.emoji} ${item.label}`}
            />
          ))}
        </nav>
        {user ? (
          <Link
            href="/tools/forum/new"
            className="font-display rounded-xl bg-wood px-4 py-2.5 text-sm text-cream shadow-[0_3px_0_rgba(90,58,34,0.35)] transition hover:brightness-105"
          >
            글쓰기
          </Link>
        ) : (
          <Link
            href={loginHref}
            className="font-display rounded-xl bg-wood px-4 py-2.5 text-sm text-cream shadow-[0_3px_0_rgba(90,58,34,0.35)]"
          >
            로그인하고 글쓰기
          </Link>
        )}
      </div>

      {posts.length === 0 ? (
        <div className="quest-card-static px-6 py-12 text-center">
          <p className="font-display text-xl text-wood-dark">아직 글이 없어요</p>
          <p className="mt-2 text-sm text-foreground/60">
            첫 글을 남겨 주시면 다음에 쓰는 분이 편해져요.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {posts.map((post) => {
            const meta = getForumCategory(post.category);
            return (
              <li key={post.id}>
                <Link
                  href={`/tools/forum/${post.id}`}
                  className="quest-card group block p-5 no-underline transition hover:-translate-y-0.5"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-wood/10 px-2 py-0.5 text-[11px] font-bold text-wood">
                      {meta ? `${meta.emoji} ${meta.label}` : post.category}
                    </span>
                    {post.imageCount > 0 ? (
                      <span className="text-[11px] font-semibold text-foreground/45">
                        그림 {post.imageCount}
                      </span>
                    ) : null}
                    <span className="text-[11px] font-semibold text-foreground/45">
                      댓글 {post.commentCount}
                    </span>
                  </div>
                  <h2 className="font-display mt-2 text-lg text-wood-dark group-hover:underline">
                    {post.title}
                  </h2>
                  {post.bodyPreview ? (
                    <p className="mt-1 line-clamp-2 text-sm text-foreground/65">
                      {post.bodyPreview}
                    </p>
                  ) : null}
                  <p className="mt-2 text-xs text-foreground/45">
                    {post.authorName}
                    {post.isAdminAuthor ? " · 관리자" : ""}
                    {post.isAuthor ? " · 나" : ""} ·{" "}
                    {formatForumTime(post.createdAt)}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {totalPages > 1 ? (
        <nav className="flex justify-center gap-2" aria-label="페이지">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => {
            const href = category
              ? `/tools/forum?category=${category}&page=${n}`
              : `/tools/forum?page=${n}`;
            return (
              <Link
                key={n}
                href={href}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                  n === page
                    ? "bg-wood text-cream"
                    : "bg-white/80 text-wood-dark hover:bg-white"
                }`}
              >
                {n}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
}

function FilterChip({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
        active
          ? "bg-wood text-cream"
          : "bg-white/80 text-wood-dark hover:bg-white"
      }`}
    >
      {label}
    </Link>
  );
}
