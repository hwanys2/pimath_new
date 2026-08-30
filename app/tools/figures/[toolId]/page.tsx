import type { ReactNode } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CircleChordsStudio from "@/components/tools/figures/circle-chords/CircleChordsStudio";
import CircleSectorsStudio from "@/components/tools/figures/circle-sectors/CircleSectorsStudio";
import CoordinatePlaneStudio from "@/components/tools/figures/coordinate-plane/CoordinatePlaneStudio";
import HistogramStudio from "@/components/tools/figures/histogram/HistogramStudio";
import InequalityStudio from "@/components/tools/figures/linear-inequality/InequalityStudio";
import IsoscelesStudio from "@/components/tools/figures/isosceles-triangle/IsoscelesStudio";
import NumberLineStudio from "@/components/tools/figures/number-line/NumberLineStudio";
import PolygonStudio from "@/components/tools/figures/polygon/PolygonStudio";
import LinearFunctionStudio from "@/components/tools/figures/linear-function/LinearFunctionStudio";
import QuadrilateralStudio from "@/components/tools/figures/quadrilaterals/QuadrilateralStudio";
import RepeatingDecimalStudio from "@/components/tools/figures/repeating-decimal/RepeatingDecimalStudio";
import SimilarFiguresStudio from "@/components/tools/figures/similar-figures/SimilarFiguresStudio";
import SimilarSolidsStudio from "@/components/tools/figures/similar-solids/SimilarSolidsStudio";
import SolidSketchStudio from "@/components/tools/figures/solid-sketch/SolidSketchStudio";
import TriangleCentersStudio from "@/components/tools/figures/triangle-centers/TriangleCentersStudio";
import DiagramToolShell from "@/components/tools/figures/DiagramToolShell";
import { DIAGRAM_TOOLS, getDiagramTool } from "@/lib/diagrams/catalog";

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

/** Tool-specific studio only. Page chrome (의견 포함) is DiagramToolShell. */
function renderDiagramStudio(toolId: string): ReactNode {
  switch (toolId) {
    case "g1-number-line":
      return <NumberLineStudio />;
    case "g1-coordinate-plane":
      return <CoordinatePlaneStudio />;
    case "g1-polygon":
      return <PolygonStudio />;
    case "g1-solid-sketch":
      return <SolidSketchStudio />;
    case "g1-circle-sectors":
      return <CircleSectorsStudio />;
    case "g1-histogram":
      return <HistogramStudio />;
    case "g2-linear-function":
      return <LinearFunctionStudio />;
    case "g2-repeating-decimal":
      return <RepeatingDecimalStudio />;
    case "g2-linear-inequality":
      return <InequalityStudio />;
    case "g2-isosceles-triangle":
      return <IsoscelesStudio />;
    case "g2-triangle-centers":
      return <TriangleCentersStudio />;
    case "g2-quadrilaterals":
      return <QuadrilateralStudio />;
    case "g2-similar-figures":
      return <SimilarFiguresStudio />;
    case "g2-similar-solids":
      return <SimilarSolidsStudio />;
    case "g3-circle-chords":
      return <CircleChordsStudio />;
    default:
      return null;
  }
}

export default async function DiagramToolPage({ params }: Props) {
  const { toolId } = await params;
  const tool = getDiagramTool(toolId);
  if (!tool) notFound();

  const studio = renderDiagramStudio(toolId);
  if (!studio) notFound();

  return <DiagramToolShell tool={tool}>{studio}</DiagramToolShell>;
}
