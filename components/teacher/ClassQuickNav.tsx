import Link from "next/link";

const LINKS = [
  { tab: "content", label: "배정수업", href: (classId: string) => `/teacher/classes/${classId}` },
  {
    tab: "results",
    label: "학습 결과",
    href: (classId: string) => `/teacher/classes/${classId}?tab=results`,
  },
  {
    tab: "roster",
    label: "명단 관리",
    href: (classId: string) => `/teacher/classes/${classId}?tab=roster`,
  },
] as const;

export default function ClassQuickNav({ classId }: { classId: string }) {
  return (
    <nav
      className="flex gap-1 rounded-xl bg-wood/10 p-1"
      aria-label="학급 바로가기"
    >
      {LINKS.map((link) => (
        <Link
          key={link.tab}
          href={link.href(classId)}
          className="flex-1 rounded-lg px-2 py-2.5 text-center text-sm font-bold text-foreground/65 transition hover:bg-wood hover:text-cream sm:px-3"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
