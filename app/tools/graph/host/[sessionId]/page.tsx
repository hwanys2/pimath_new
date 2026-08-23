import type { Metadata } from "next";
import { getActor } from "@/lib/auth";
import HostDashboard from "@/components/tools/graph/HostDashboard";

export const metadata: Metadata = {
  title: "그래프 탐구 · 교사 대시보드 | 수학하는 즐거움",
};

export default async function GraphHostPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const actor = await getActor();
  const { sessionId } = await params;

  return (
    <HostDashboard
      sessionId={sessionId}
      isLoggedInTeacher={actor?.type === "teacher"}
    />
  );
}
