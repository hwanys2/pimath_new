import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import ForumPostForm from "@/components/tools/forum/ForumPostForm";
import { getDisplayUser } from "@/lib/auth";
import { isForumPostId } from "@/lib/forum/catalog";
import { getForumPost } from "@/lib/forum/queries";

type Props = {
  params: Promise<{ postId: string }>;
};

export const metadata: Metadata = {
  title: "글 수정 | 의견 게시판",
};

export default async function ForumEditPage({ params }: Props) {
  const { postId } = await params;
  if (!isForumPostId(postId)) notFound();

  const user = await getDisplayUser();
  if (!user) {
    redirect(`/login/teacher?next=/tools/forum/${postId}/edit`);
  }

  const post = await getForumPost(postId);
  if (!post) notFound();
  if (!post.isAuthor) {
    redirect(`/tools/forum/${postId}`);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <p className="text-sm font-semibold text-wood">
          <Link href={`/tools/forum/${postId}`} className="hover:underline">
            글
          </Link>
          <span className="mx-1.5 text-foreground/30">/</span>
          수정
        </p>
        <h1 className="font-display mt-2 text-3xl text-wood-dark">글 수정</h1>
      </header>
      <div className="quest-card-static p-5 sm:p-6">
        <ForumPostForm
          mode="edit"
          postId={post.id}
          initialCategory={post.category}
          initialTitle={post.title}
          initialBody={post.body}
          initialImages={post.images}
        />
      </div>
    </div>
  );
}
