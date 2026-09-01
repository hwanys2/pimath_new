import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import ForumPostForm from "@/components/tools/forum/ForumPostForm";
import { getDisplayUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "글쓰기 | 의견 게시판",
  description: "수업 도구 사용 의견이나 새 프로그램 아이디어를 남깁니다.",
};

export default async function ForumNewPage() {
  const user = await getDisplayUser();
  if (!user) {
    redirect("/login/teacher?next=/tools/forum/new");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <p className="text-sm font-semibold text-wood">
          <Link href="/tools/forum" className="hover:underline">
            의견 게시판
          </Link>
          <span className="mx-1.5 text-foreground/30">/</span>
          글쓰기
        </p>
        <h1 className="font-display mt-2 text-3xl text-wood-dark">새 글</h1>
      </header>
      <div className="quest-card-static p-5 sm:p-6">
        <ForumPostForm mode="create" />
      </div>
    </div>
  );
}
