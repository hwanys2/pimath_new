import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireTeacher } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getContent } from "@/lib/contents";
import { fetchGameDashboardSnapshot } from "@/lib/game-dashboard";
import GameDashboard from "@/components/teacher/game-dashboard/GameDashboard";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ classId: string; contentKey: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { contentKey } = await params;
  const content = getContent(contentKey);
  return {
    title: content
      ? `${content.title} 대시보드 | 수학하는 즐거움`
      : "게임 대시보드 | 수학하는 즐거움",
  };
}

export default async function TeacherGameDashboardPage({ params }: Props) {
  const teacher = await requireTeacher();
  const { classId, contentKey } = await params;
  const supabase = await createClient();

  const { data: klass } = await supabase
    .from("pm_classes")
    .select("id, name, teacher_id")
    .eq("id", classId)
    .maybeSingle();

  if (!klass || klass.teacher_id !== teacher.id) {
    notFound();
  }

  const content = getContent(contentKey);
  if (!content || content.type !== "game") {
    notFound();
  }

  const snapshot = await fetchGameDashboardSnapshot(
    classId,
    contentKey,
    klass.name,
  );
  if (!snapshot) notFound();

  return <GameDashboard initial={snapshot} />;
}
