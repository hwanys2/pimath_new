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
 * 페이지는 항상 DiagramToolShell(스튜디오 + 공통 의견)을 쓴다.
 */
export const DIAGRAM_TOOLS: DiagramToolMeta[] = [
  {
    id: "g1-number-line",
    grade: 1,
    title: "수직선",
    description:
      "정수·분수·소수 점을 찍고 n등분 표시까지, 시험용 수직선을 바로 그려 PNG로 저장해요.",
    unitHint: "1.2 정수와 유리수",
    emoji: "—",
    href: "/tools/figures/g1-number-line",
    status: "ready",
  },
  {
    id: "g1-coordinate-plane",
    grade: 1,
    title: "좌표평면",
    description:
      "격자·축·점을 맞추고 정비례·반비례 그래프까지, 시험용 좌표평면을 바로 그려 PNG로 저장해요.",
    unitHint: "2.3 좌표평면과 그래프",
    emoji: "+",
    href: "/tools/figures/g1-coordinate-plane",
    status: "ready",
  },
  {
    id: "g1-polygon",
    grade: 1,
    title: "다각형",
    description:
      "삼각형부터 정n각형까지 꼭짓점을 끌어 모양을 잡고, 내각·외각·변의 길이·대각선을 바로 붙여 PNG로 저장해요.",
    unitHint: "3.3 평면도형의 성질",
    emoji: "⬠",
    href: "/tools/figures/g1-polygon",
    status: "ready",
  },
  {
    id: "g1-solid-sketch",
    grade: 1,
    title: "겨냥도",
    description:
      "각기둥·각뿔·뿔대·원기둥·원뿔·구·반구와 같은 반지름 조합·정다면체를 겨냥도로 그리고, 점 이름과 길이를 붙여 PNG로 저장해요.",
    unitHint: "3.4 입체도형의 성질",
    emoji: "◇",
    href: "/tools/figures/g1-solid-sketch",
    status: "ready",
  },
  {
    id: "g1-circle-sectors",
    grade: 1,
    title: "원과 부채꼴",
    description:
      "원 위 부채꼴이나 부채꼴만, 중심각·반지름·호 길이·넓이를 시험 그림처럼 붙여 PNG로 저장해요.",
    unitHint: "3.3 평면도형의 성질",
    emoji: "◕",
    href: "/tools/figures/g1-circle-sectors",
    status: "ready",
  },
  {
    id: "g1-histogram",
    grade: 1,
    title: "히스토그램",
    description:
      "계급을 맞추고 막대·점을 끌어 히스토그램과 도수분포다각형을 그리고 PNG로 저장해요. 다각형에서는 비교 그래프도 그릴 수 있어요.",
    unitHint: "4.2 도수분포표와 상대도수",
    emoji: "▮",
    href: "/tools/figures/g1-histogram",
    status: "ready",
  },
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
