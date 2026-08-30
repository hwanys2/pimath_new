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
    id: "g2-repeating-decimal",
    grade: 2,
    title: "순환소수 나눗셈",
    description:
      "피제수·제수를 넣으면 순환소수로 바꾸는 나눗셈 과정이 그려집니다. 몫·나머지 색·같다 표시를 켜고 끄고 PNG로 저장해요.",
    unitHint: "1. 유리수와 순환소수",
    emoji: "÷",
    href: "/tools/figures/g2-repeating-decimal",
    status: "ready",
  },
  {
    id: "g2-linear-inequality",
    grade: 2,
    title: "일차부등식",
    description:
      "빈 수직선부터 x>a, a≤x<b까지, 빈 점·칠한 점과 색으로 해의 범위를 그리고 PNG로 저장해요.",
    unitHint: "2.2 일차부등식",
    emoji: "≥",
    href: "/tools/figures/g2-linear-inequality",
    status: "ready",
  },
  {
    id: "g2-linear-function",
    grade: 2,
    title: "일차함수 그래프",
    description:
      "좌표평면에 y=ax+b와 x=a·y=b를 여러 개 그리고, 절편·점의 수선·기울기 화살·평행이동을 붙여 PNG로 저장해요.",
    unitHint: "2.4 일차함수와 그래프",
    emoji: "/",
    href: "/tools/figures/g2-linear-function",
    status: "ready",
  },
  {
    id: "g2-isosceles-triangle",
    grade: 2,
    title: "이등변삼각형",
    description:
      "등변 표시·밑각·외각·수선·이등분선을 붙여 중2 삼각형의 성질 문제를 바로 그려 PNG로 저장해요.",
    unitHint: "3.1 삼각형과 사각형의 성질",
    emoji: "△",
    href: "/tools/figures/g2-isosceles-triangle",
    status: "ready",
  },
  {
    id: "g2-triangle-centers",
    grade: 2,
    title: "외심과 내심",
    description:
      "삼각형을 끌어 외심·내심을 맞추고, 외접원·내접원·반지름·이등분선·수선·각·길이를 시험 그림처럼 붙여 PNG로 저장해요.",
    unitHint: "3.1 삼각형과 사각형의 성질",
    emoji: "△",
    href: "/tools/figures/g2-triangle-centers",
    status: "ready",
  },
  {
    id: "g2-quadrilaterals",
    grade: 2,
    title: "사각형의 성질",
    description:
      "일반 사각형부터 평행사변형·직사각형·마름모·사다리꼴까지, 밑변을 가로로 두고 점을 끌면 성질이 유지됩니다. 대변·대각선·맞꼭지각·설명선을 붙여 PNG로 저장해요.",
    unitHint: "3.1 삼각형과 사각형의 성질",
    emoji: "▱",
    href: "/tools/figures/g2-quadrilaterals",
    status: "ready",
  },
  {
    id: "g2-similar-figures",
    grade: 2,
    title: "평면도형의 닮음",
    description:
      "한 도형을 그리면 닮음비에 맞춰 짝이 그려집니다. 오른쪽은 회전·대칭하고, 변·각을 붙여 PNG로 저장해요.",
    unitHint: "4.1 평면도형의 닮음",
    emoji: "∽",
    href: "/tools/figures/g2-similar-figures",
    status: "ready",
  },
  {
    id: "g2-similar-triangles",
    grade: 2,
    title: "삼각형의 닮음",
    description:
      "평행선·나비꼴·직각삼각형 높이·중점연결·무게중심까지, 중2 닮음 문제 그림을 바로 그려 PNG로 저장해요.",
    unitHint: "3.2 도형의 닮음",
    emoji: "△",
    href: "/tools/figures/g2-similar-triangles",
    status: "ready",
  },
  {
    id: "g2-similar-solids",
    grade: 2,
    title: "입체도형의 닮음",
    description:
      "입체 하나를 그리고 닮음비만 넣으면 같은 모양의 쌍이 나란히 그려집니다. 꼭짓점 이름·길이·PNG로 저장해요.",
    unitHint: "3.2 도형의 닮음",
    emoji: "◇",
    href: "/tools/figures/g2-similar-solids",
    status: "ready",
  },
  {
    id: "g2-pythagorean",
    grade: 2,
    title: "피타고라스의 정리",
    description:
      "직각삼각형·세 변 위 정사각형·넓이 증명·빗변 수선·사각형 대각선을 시험 그림처럼 그리고 PNG로 저장해요.",
    unitHint: "3.3 피타고라스의 정리",
    emoji: "△",
    href: "/tools/figures/g2-pythagorean",
    status: "ready",
  },
  {
    id: "g2-counting-probability",
    grade: 2,
    title: "경우의 수와 확률",
    description:
      "주사위·카드·주머니·등분할 원판·길 그림을 고르고, 개수와 내용을 맞춘 뒤 끌어 재배치하고 PNG로 저장해요.",
    unitHint: "4. 경우의 수와 확률",
    emoji: "🎲",
    href: "/tools/figures/g2-counting-probability",
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
