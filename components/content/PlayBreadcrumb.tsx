import Link from "next/link";
import type { ReactNode } from "react";
import { getActor } from "@/lib/auth";

type Props = {
  contentTitle?: string;
  assignSlot?: ReactNode;
  /** Public grade crumb (non-student). Defaults to 중1. */
  gradeHref?: string;
  gradeLabel?: string;
  /** Public unit crumb (non-student). Defaults to 1.1 소인수분해. */
  unitHref?: string;
  unitLabel?: string;
};

export default async function PlayBreadcrumb({
  contentTitle,
  assignSlot,
  gradeHref = "/grade/1",
  gradeLabel = "중1",
  unitHref = "/grade/1/g1-1-1",
  unitLabel = "1.1 소인수분해",
}: Props) {
  const actor = await getActor();

  if (actor?.type === "student") {
    return (
      <nav className="flex flex-wrap items-center gap-3 text-sm font-semibold text-wood/70">
        <Link
          href="/adventure"
          className="underline-offset-2 hover:underline"
        >
          나의 모험
        </Link>
        {contentTitle ? (
          <>
            <span aria-hidden>/</span>
            <span className="text-foreground/60">{contentTitle}</span>
          </>
        ) : null}
        {assignSlot ? <span className="ml-auto">{assignSlot}</span> : null}
      </nav>
    );
  }

  return (
    <nav className="flex flex-wrap items-center gap-3 text-sm font-semibold text-wood/70">
      <Link href="/" className="underline-offset-2 hover:underline">
        홈
      </Link>
      <span aria-hidden>/</span>
      <Link href={gradeHref} className="underline-offset-2 hover:underline">
        {gradeLabel}
      </Link>
      <span aria-hidden>/</span>
      <Link href={unitHref} className="underline-offset-2 hover:underline">
        {unitLabel}
      </Link>
      {contentTitle ? (
        <>
          <span aria-hidden>/</span>
          <span className="text-foreground/60">{contentTitle}</span>
        </>
      ) : null}
      {assignSlot ? <span className="ml-auto">{assignSlot}</span> : null}
    </nav>
  );
}
