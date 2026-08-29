import type { Metadata } from "next";
import { Suspense } from "react";
import FiguresHub from "@/components/tools/figures/FiguresHub";

export const metadata: Metadata = {
  title: "문제 그림 그리기 | 수학하는 즐거움",
  description:
    "중1·중2·중3 시험 문제용 그림을 소재별로 바로 그리고 이미지로 저장하는 도구",
};

export default function FiguresPage() {
  return (
    <Suspense>
      <FiguresHub />
    </Suspense>
  );
}
