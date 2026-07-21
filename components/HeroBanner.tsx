import Image from "next/image";
import BlockButton from "./BlockButton";

export default function HeroBanner() {
  return (
    <section className="relative overflow-hidden rounded-3xl border-[3px] border-wood/15 shadow-[0_10px_0_rgba(139,94,60,0.15)]">
      <div className="absolute inset-0">
        <Image
          src="/images/hero-banner.png"
          alt="탐험 배너 배경"
          fill
          priority
          className="object-cover"
          sizes="(max-width: 1152px) 100vw, 1152px"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#3d2c1e]/75 via-[#3d2c1e]/45 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#3d2c1e]/50 via-transparent to-transparent" />
      </div>

      <div className="relative grid items-center gap-6 px-6 py-10 sm:px-10 sm:py-14 lg:grid-cols-[1.2fr_0.8fr] lg:py-16">
        <div className="text-cream">
          <span className="badge-pill mb-4">🎮 오늘의 메인 퀘스트</span>
          <h1 className="font-display text-3xl leading-tight drop-shadow-md sm:text-4xl lg:text-5xl">
            수학 왕국으로
            <br />
            모험을 떠나자!
          </h1>
          <p className="mt-4 max-w-lg text-sm leading-relaxed text-cream/90 sm:text-base">
            시뮬레이션과 게임으로 배우는 중학교 수학.
            <br />
            미션을 클리어하고 배지를 모아보세요!
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <BlockButton href="/grade/1" variant="gold" size="lg">
              🚀 모험 시작하기
            </BlockButton>
            <BlockButton href="/grade/2" variant="sky" size="lg">
              학년 선택
            </BlockButton>
          </div>
        </div>

        <div className="relative mx-auto hidden h-56 w-56 sm:block lg:h-72 lg:w-72">
          <div className="absolute inset-0 rounded-full bg-gold/30 blur-2xl" />
          <Image
            src="/images/mascot-v2.png"
            alt="수학 모험 마스코트"
            width={320}
            height={320}
            className="relative z-10 h-full w-full object-contain drop-shadow-2xl"
          />
        </div>
      </div>
    </section>
  );
}
