import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CircleChordsStudio from "@/components/tools/figures/circle-chords/CircleChordsStudio";
import { DIAGRAM_TOOLS, getDiagramTool } from "@/lib/diagrams/catalog";
import { redirectStudentToAdventure } from "@/lib/auth";

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

  if (toolId === "g3-circle-chords") {
    return <CircleChordsStudio />;
  }

  notFound();
}
