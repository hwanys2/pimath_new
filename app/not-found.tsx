import Link from "next/link";
import BlockButton from "@/components/BlockButton";

export default function NotFound() {
  return (
    <div className="quest-card mx-auto max-w-lg p-10 text-center">
      <p className="text-5xl" aria-hidden>
        🗺️
      </p>
      <h1 className="font-display mt-4 text-2xl">길을 잃었어요!</h1>
      <p className="mt-2 text-sm text-foreground/70">
        존재하지 않는 모험 맵입니다. 홈으로 돌아가 다시 선택해 주세요.
      </p>
      <div className="mt-6 flex justify-center">
        <BlockButton href="/" variant="gold">
          홈으로 돌아가기
        </BlockButton>
      </div>
      <p className="mt-4 text-xs text-foreground/40">
        <Link href="/">또는 여기를 클릭</Link>
      </p>
    </div>
  );
}
