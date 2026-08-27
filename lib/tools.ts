export type ToolMeta = {
  key: string;
  label: string;
  title: string;
  description: string;
  href: string;
  emoji: string;
  accentClass: string;
  /** true면 교사 로그인이 있어야 온전히 사용 가능 */
  teacherOnly?: boolean;
};

/**
 * 수업 도구 레지스트리.
 * 여기에 항목을 추가하면 navbar '도구' 드롭다운과 /tools 허브에 자동 반영된다.
 */
export const TOOLS: ToolMeta[] = [
  {
    key: "board",
    label: "전자칠판",
    title: "전자칠판",
    description:
      "필기, 그래프, 타이머, 랜덤뽑기까지 수업에 필요한 모든 것이 담긴 칠판이에요.",
    href: "/board",
    emoji: "🖍️",
    accentClass: "from-mint/40 to-sky/30",
  },
  {
    key: "graph-explorer",
    label: "그래프 탐구",
    title: "그래프 탐구 (순서쌍 모으기)",
    description:
      "교사가 함수식으로 방을 만들면, 학생들이 QR로 들어와 순서쌍을 제출해요. 점이 모이면 그래프의 개형이 스스로 드러나요!",
    href: "/tools/graph",
    emoji: "📈",
    accentClass: "from-peach/50 to-gold/30",
    teacherOnly: true,
  },
  {
    key: "figures",
    label: "문제 그림",
    title: "문제 그림 그리기",
    description:
      "중1·중2·중3 소재별로 시험 문제 그림을 바로 그리고 PNG로 저장해요. 원의 현처럼 그 유형만 최적화된 도구입니다.",
    href: "/tools/figures",
    emoji: "📐",
    accentClass: "from-lavender/45 to-sky/30",
  },
];

export function getTool(key: string): ToolMeta | undefined {
  return TOOLS.find((t) => t.key === key);
}
