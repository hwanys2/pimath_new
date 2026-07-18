import type { Metadata } from "next";
import { Jua, Noto_Sans_KR } from "next/font/google";
import TopMenuBar from "@/components/TopMenuBar";
import { getDisplayUser } from "@/lib/auth";
import "./globals.css";

const jua = Jua({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-jua",
  display: "swap",
});

const notoSansKr = Noto_Sans_KR({
  subsets: ["latin"],
  variable: "--font-noto-sans-kr",
  display: "swap",
});

export const metadata: Metadata = {
  title: "수학하는 즐거움 | Math Adventure",
  description:
    "중학교 수학을 시뮬레이션과 게임으로 탐험하는 모험 학습 사이트",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getDisplayUser();

  return (
    <html lang="ko" className={`${jua.variable} ${notoSansKr.variable} h-full`}>
      <body className="flex min-h-full flex-col antialiased">
        <TopMenuBar user={user} />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </main>
        <footer className="border-t border-wood/10 bg-wood/5 py-6 text-center text-sm text-foreground/60">
          <p className="font-display text-base text-wood">수학하는 즐거움</p>
          <p className="mt-1">중학교 수학 모험 · 시뮬레이션 · 게임</p>
        </footer>
      </body>
    </html>
  );
}
