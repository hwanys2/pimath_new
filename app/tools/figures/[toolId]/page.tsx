import type { ReactNode } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CircleChordsStudio from "@/components/tools/figures/circle-chords/CircleChordsStudio";
import DiagramFeedback from "@/components/tools/figures/DiagramFeedback";
import { isDiagramAdminEmail } from "@/lib/diagrams/admin";
import { DIAGRAM_TOOLS, getDiagramTool } from "@/lib/diagrams/catalog";
import { listDiagramFeedback } from "@/lib/diagrams/feedback";
import { getDisplayUser, redirectStudentToAdventure } from "@/lib/auth";

type Props = {
  params: Promise<{ toolId: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { toolId } = await params;
  const tool = getDiagramTool(toolId);
  if (!tool) return { title: "그림 도구 없음" };
  return {
    title: `${tool.title} | 문제 그림 그리기`,
    description: tool.description,
  };
}

export function generateStaticParams() {
  return DIAGRAM_TOOLS.filter((t) => t.status === "ready").map((t) => ({
    toolId: t.id,
  }));
}

export default async function DiagramToolPage({ params }: Props) {
  await redirectStudentToAdventure();
  const { toolId } = await params;
  const tool = getDiagramTool(toolId);
  if (!tool) notFound();

  const [user, comments] = await Promise.all([
    getDisplayUser(),
    listDiagramFeedback(toolId),
  ]);

  let studio: ReactNode = null;
  if (toolId === "g3-circle-chords") {
    studio = <CircleChordsStudio />;
  } else {
    notFound();
  }

  return (
    <div className="space-y-10">
      {studio}
      <DiagramFeedback
        toolId={toolId}
        toolTitle={tool.title}
        initialComments={comments}
        isLoggedIn={user != null}
        isAdmin={isDiagramAdminEmail(user?.email)}
      />
    </div>
  );
}
