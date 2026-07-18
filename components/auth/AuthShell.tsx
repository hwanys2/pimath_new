import Image from "next/image";
import Link from "next/link";
import { type ReactNode } from "react";

type Props = {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
};

export default function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: Props) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center py-6 sm:py-10">
      <div className="mb-5 flex flex-col items-center text-center">
        <div className="relative mb-3 h-24 w-24 drop-shadow-md sm:h-28 sm:w-28">
          <Image
            src="/images/mascot-v2.png"
            alt="파이"
            fill
            sizes="112px"
            className="object-contain"
            priority
          />
        </div>
        <h1 className="font-display text-2xl text-foreground sm:text-3xl">
          {title}
        </h1>
        <p className="mt-1 text-sm text-foreground/60">{subtitle}</p>
      </div>

      <div className="quest-card w-full p-6 sm:p-8">{children}</div>

      <p className="mt-5 text-center text-sm text-foreground/70">{footer}</p>

      <Link
        href="/"
        className="mt-4 text-xs font-semibold text-wood/70 transition hover:text-wood"
      >
        ← 모험 맵으로 돌아가기
      </Link>
    </div>
  );
}
