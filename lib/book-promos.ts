import type { GradeId } from "@/lib/grades";

export type BookPromo =
  | { kind: "link"; imageUrl: string; href: string; label: string }
  | { kind: "coming-soon"; message: string };

export const BOOK_PROMOS: Record<GradeId, BookPromo> = {
  1: {
    kind: "link",
    imageUrl: "https://image.yes24.com/goods/145423321/XL",
    href: "https://www.yes24.com/product/goods/145423321",
    label: "수학하는 즐거움 중1",
  },
  2: {
    kind: "link",
    imageUrl: "https://image.yes24.com/goods/193602856/XL",
    href: "https://www.yes24.com/product/goods/193602856",
    label: "수학하는 즐거움 중2",
  },
  3: {
    kind: "coming-soon",
    message: "중3 은 2027년 발간 예정",
  },
};

export function getBookPromo(gradeId: GradeId): BookPromo {
  return BOOK_PROMOS[gradeId];
}
