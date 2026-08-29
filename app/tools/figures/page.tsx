import type { Metadata } from "next";
import FiguresHub from "@/components/tools/figures/FiguresHub";
import { isValidGrade, type GradeId } from "@/lib/grades";
import { redirectStudentToAdventure } from "@/lib/auth";

export const metadata: Metadata = {
  title: "문제 그림 그리기 | 수학하는 즐거움",
  description:
    "중1·중2·중3 시험 문제용 그림을 소재별로 바로 그리고 이미지로 저장하는 도구",
};

type Props = {
  searchParams: Promise<{ grade?: string }>;
};

export default async function FiguresPage({ searchParams }: Props) {
  await redirectStudentToAdventure();
  const { grade: raw } = await searchParams;
  const parsed = Number(raw ?? 1);
  const grade: GradeId = isValidGrade(parsed) ? parsed : 1;

  return <FiguresHub grade={grade} />;
}
