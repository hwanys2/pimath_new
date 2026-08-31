"use server";

import { requireTeacher } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fetchGameDashboardSnapshot } from "@/lib/game-dashboard";
import type { GameDashboardSnapshot } from "@/lib/game-dashboard-types";

export async function pollGameDashboard(input: {
  classId: string;
  contentKey: string;
}): Promise<GameDashboardSnapshot | { error: string }> {
  const teacher = await requireTeacher();
  const classId = input.classId.trim();
  const contentKey = input.contentKey.trim();
  if (!classId || !contentKey) {
    return { error: "학급 또는 콘텐츠가 없어요." };
  }

  const supabase = await createClient();
  const { data: klass } = await supabase
    .from("pm_classes")
    .select("id, name, teacher_id")
    .eq("id", classId)
    .maybeSingle();

  if (!klass || klass.teacher_id !== teacher.id) {
    return { error: "학급을 찾을 수 없어요." };
  }

  const snapshot = await fetchGameDashboardSnapshot(
    classId,
    contentKey,
    klass.name,
  );
  if (!snapshot) {
    return { error: "게임 대시보드를 열 수 없는 콘텐츠예요." };
  }
  return snapshot;
}
