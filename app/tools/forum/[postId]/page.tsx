import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ForumCommentThread from "@/components/tools/forum/ForumCommentThread";
import ForumImages from "@/components/tools/forum/ForumImages";
import { getDisplayUser } from "@/lib/auth";
import { isForumAdminEmail } from "@/lib/forum/admin";
import { getForumCategory, isForumPostId } from "@/lib/forum/catalog";
import { getForumPost, listForumComments } from "@/lib/forum/queries";
import { formatForumTime } from "@/lib/forum/time";

type Props = {
  params: Promise<{ postId: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { postId } = await params;
  const post = await getForumPost(postId);
  if (!post) return { title: "글을 찾을 수 없어요" };
  return {
    title: `${post.title} | 의견 게시판`,
    description: post.body.slice(0, 120),
  };
}

export default async function ForumPostPage({ params }: Props) {
  const { postId } = await params;
  if (!isForumPostId(postId)) notFound();

  const [post, comments, user] = await Promise.all([
    getForumPost(postId),
    listForumComments(postId),
    getDisplayUser(),
  ]);
  if (!post) notFound();

  const meta = getForumCategory(post.category);
  const isAdmin = isForumAdminEmail(user?.email);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <p className="text-sm font-semibold text-wood">
        <Link href="/tools/forum" className="hover:underline">
          의견 게시판
        </Link>
      </p>

      <article className="quest-card-static space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-wood/10 px-2 py-0.5 text-[11px] font-bold text-wood">
            {meta ? `${meta.emoji} ${meta.label}` : post.category}
          </span>
          <time
            className="text-xs text-foreground/45"
            dateTime={post.createdAt}
          >
            {formatForumTime(post.createdAt)}
          </time>
        </div>
        <h1 className="font-display text-3xl text-wood-dark">{post.title}</h1>
        <p className="text-sm text-foreground/55">
          {post.authorName}
          {post.isAdminAuthor ? " · 관리자" : ""}
          {post.isAuthor ? " · 나" : ""}
        </p>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">
          {post.body}
        </p>
        <ForumImages images={post.images} />
      </article>

      <div className="quest-card-static p-5 sm:p-6">
        <ForumCommentThread
          postId={post.id}
          comments={comments}
          isLoggedIn={user != null}
          canEditPost={post.isAuthor}
          isAdmin={isAdmin}
        />
      </div>
    </div>
  );
}
