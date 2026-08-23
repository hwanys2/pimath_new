import type { Metadata } from "next";
import JoinClient from "@/components/tools/graph/JoinClient";

export const metadata: Metadata = {
  title: "그래프 탐구 참여하기 | 수학하는 즐거움",
  description: "참가코드나 QR로 그래프 탐구 활동에 참여하세요",
};

export default async function GraphJoinPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  return <JoinClient initialCode={code ?? ""} />;
}
