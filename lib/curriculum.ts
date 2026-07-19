import type { GradeId } from "@/lib/grades";

export type CurriculumUnit = {
  id: string;
  grade: GradeId;
  /** Display code e.g. "1.1", "2.4", "1" */
  code: string;
  title: string;
};

export const CURRICULUM_UNITS: CurriculumUnit[] = [
  // 중1
  { id: "g1-1-1", grade: 1, code: "1.1", title: "소인수분해" },
  { id: "g1-1-2", grade: 1, code: "1.2", title: "정수와 유리수" },
  { id: "g1-2-1", grade: 1, code: "2.1", title: "문자의 사용과 식" },
  { id: "g1-2-2", grade: 1, code: "2.2", title: "일차방정식" },
  { id: "g1-2-3", grade: 1, code: "2.3", title: "좌표평면과 그래프" },
  { id: "g1-3-1", grade: 1, code: "3.1", title: "기본도형" },
  { id: "g1-3-2", grade: 1, code: "3.2", title: "작도와 합동" },
  { id: "g1-3-3", grade: 1, code: "3.3", title: "평면도형의 성질" },
  { id: "g1-3-4", grade: 1, code: "3.4", title: "입체도형의 성질" },
  { id: "g1-4-1", grade: 1, code: "4.1", title: "대푯값" },
  { id: "g1-4-2", grade: 1, code: "4.2", title: "도수분포표와 상대도수" },

  // 중2
  { id: "g2-1", grade: 2, code: "1", title: "유리수와 순환소수" },
  { id: "g2-2-1", grade: 2, code: "2.1", title: "식의 계산" },
  { id: "g2-2-2", grade: 2, code: "2.2", title: "일차부등식" },
  { id: "g2-2-3", grade: 2, code: "2.3", title: "연립일차방정식" },
  { id: "g2-2-4", grade: 2, code: "2.4", title: "일차함수와 그래프" },
  { id: "g2-2-5", grade: 2, code: "2.5", title: "일차함수와 일차방정식의 관계" },
  { id: "g2-3-1", grade: 2, code: "3.1", title: "삼각형과 사각형의 성질" },
  { id: "g2-3-2", grade: 2, code: "3.2", title: "도형의 닮음" },
  { id: "g2-3-3", grade: 2, code: "3.3", title: "피타고라스의 정리" },
  { id: "g2-4", grade: 2, code: "4", title: "경우의 수와 확률" },

  // 중3
  { id: "g3-1", grade: 3, code: "1", title: "제곱근과 실수" },
  { id: "g3-2-1", grade: 3, code: "2.1", title: "다항식의 곱셈과 인수분해" },
  { id: "g3-2-2", grade: 3, code: "2.2", title: "이차방정식" },
  { id: "g3-2-3", grade: 3, code: "2.3", title: "이차함수와 그래프" },
  { id: "g3-3-1", grade: 3, code: "3.1", title: "삼각비" },
  { id: "g3-3-2", grade: 3, code: "3.2", title: "원의 성질" },
  { id: "g3-4-1", grade: 3, code: "4.1", title: "산포도" },
  { id: "g3-4-2", grade: 3, code: "4.2", title: "상자그림과 산점도" },
];

export function getUnitsForGrade(grade: GradeId): CurriculumUnit[] {
  return CURRICULUM_UNITS.filter((u) => u.grade === grade);
}

export function getUnit(unitId: string): CurriculumUnit | undefined {
  return CURRICULUM_UNITS.find((u) => u.id === unitId);
}

export function getUnitLabel(unit: CurriculumUnit): string {
  return `${unit.code}. ${unit.title}`;
}
