export type GradeId = 1 | 2 | 3;

export type GradeMeta = {
  id: GradeId;
  label: string;
  title: string;
  subtitle: string;
  description: string;
  theme: "mint" | "peach" | "lavender";
  accentClass: string;
  buttonClass: string;
  character: string;
  badge: string;
  xp: number;
  questPreview: string[];
};

export const GRADES: GradeMeta[] = [
  {
    id: 1,
    label: "중1",
    title: "초원의 탐험가",
    subtitle: "기초를 다지는 첫 모험",
    description:
      "수와 연산, 도형의 기초를 게임처럼 탐험해요. 시뮬레이션과 미니게임으로 개념을 몸소 느껴보세요!",
    theme: "mint",
    accentClass: "from-mint/40 to-sky/30",
    buttonClass: "block-btn-mint",
    character: "/images/grade-1-v2.png",
    badge: "새싹 배지",
    xp: 35,
    questPreview: ["수와 연산 미션", "도형 탐험", "좌표 모험 (준비중)"],
  },
  {
    id: 2,
    label: "중2",
    title: "언덕의 모험가",
    subtitle: "한 단계 더 깊은 퀘스트",
    description:
      "일차함수, 확률, 도형의 성질을 퀘스트로 정복해요. 인터랙티브 도구로 직접 실험해보세요!",
    theme: "peach",
    accentClass: "from-peach/50 to-gold/30",
    buttonClass: "block-btn-peach",
    character: "/images/grade-2-v2.png",
    badge: "불꽃 배지",
    xp: 55,
    questPreview: ["일차함수 레이스", "확률 주사위", "도형 증명 (준비중)"],
  },
  {
    id: 3,
    label: "중3",
    title: "별빛의 용사",
    subtitle: "최고의 수학 모험",
    description:
      "이차방정식, 삼각비, 통계까지! 보스 스테이지처럼 도전적인 미션을 클리어해보세요.",
    theme: "lavender",
    accentClass: "from-lavender/50 to-sky/30",
    buttonClass: "block-btn-lavender",
    character: "/images/grade-3-v2.png",
    badge: "별빛 배지",
    xp: 72,
    questPreview: ["이차함수 성좌", "삼각비 등반", "통계 던전 (준비중)"],
  },
];

export function getGrade(id: number): GradeMeta | undefined {
  return GRADES.find((g) => g.id === id);
}

export function isValidGrade(id: number): id is GradeId {
  return id === 1 || id === 2 || id === 3;
}
