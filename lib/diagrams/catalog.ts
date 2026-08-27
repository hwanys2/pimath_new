import type { GradeId } from "@/lib/grades";

export type DiagramToolStatus = "ready" | "soon";

export type DiagramToolMeta = {
  id: string;
  grade: GradeId;
  title: string;
  description: string;
  /** 커리큘럼 힌트. 예: "3.2 원의 성질" */
  unitHint: string;
  emoji: string;
  href: string;
  status: DiagramToolStatus;
};

/**
 * 문제 그림 도구 카탈로그.
 * 허브 카드와 /tools/figures/[toolId] 연결의 단일 출처.
 * 추가 방법: docs/problem-diagram-tools.md
 */
export const DIAGRAM_TOOLS: DiagramToolMeta[] = [
  {
    id: "g3-circle-chords",
    grade: 3,
    title: "원의 현",
    description:
      "원, 현, 수선, 반지름, 길이를 시험 그림처럼 바로 그리고 PNG로 저장해요.",
    unitHint: "3.2 원의 성질",
    emoji: "◯",
    href: "/tools/figures/g3-circle-chords",
    status: "ready",
  },
];

export function getDiagramTool(id: string): DiagramToolMeta | undefined {
  return DIAGRAM_TOOLS.find((t) => t.id === id);
}

export function getDiagramToolsForGrade(grade: GradeId): DiagramToolMeta[] {
  return DIAGRAM_TOOLS.filter((t) => t.grade === grade);
}

export const DIAGRAM_TOOL_IDS = DIAGRAM_TOOLS.map((t) => t.id);
