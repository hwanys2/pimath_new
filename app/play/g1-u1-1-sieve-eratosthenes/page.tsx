import type { Metadata } from "next";
import Link from "next/link";
import SieveEratosthenes from "@/components/sims/SieveEratosthenes";
import { getContent } from "@/lib/contents";

const CONTENT_KEY = "g1-u1-1-sieve-eratosthenes";

export const metadata: Metadata = {
  title: "에라토스테네스의 체 | 수학하는 즐거움",
  description:
    "배수를 지워 가며 소수를 찾아보는 시뮬레이션. 점수는 없고 개념 탐구용입니다.",
};

export default function SieveEratosthenesPage() {
  const content = getContent(CONTENT_KEY);

  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap gap-3 text-sm font-semibold text-wood/70">
        <Link href="/" className="underline-offset-2 hover:underline">
          홈
        </Link>
        <span aria-hidden>/</span>
        <Link href="/grade/1" className="underline-offset-2 hover:underline">
          중1
        </Link>
        <span aria-hidden>/</span>
        <Link
          href="/grade/1/g1-1-1"
          className="underline-offset-2 hover:underline"
        >
          1.1 소인수분해
        </Link>
        {content ? (
          <>
            <span aria-hidden>/</span>
            <span className="text-foreground/60">{content.title}</span>
          </>
        ) : null}
      </nav>

      <SieveEratosthenes />
    </div>
  );
}
