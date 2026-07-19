export type ContentType = "simulation" | "game";

export type ContentMeta = {
  /** Stable id — stored in pm_class_contents.content_key. Do not rename. */
  key: string;
  unitId: string;
  type: ContentType;
  title: string;
  /** Public play path, e.g. /play/g1-u1-1-sieve-eratosthenes */
  href: string;
  /** Always false for simulation, true for game */
  awardsXp: boolean;
  description?: string;
};

/**
 * Code catalog of playable content. DB only stores class assignments.
 * See docs/content-system.md.
 */
export const CONTENTS: ContentMeta[] = [
  {
    key: "g1-u1-1-sieve-eratosthenes",
    unitId: "g1-1-1",
    type: "simulation",
    title: "에라토스테네스의 체",
    href: "/play/g1-u1-1-sieve-eratosthenes",
    awardsXp: false,
    description:
      "숫자 격자에서 배수를 지워 가며 소수를 찾아보는 시뮬레이션입니다. 점수는 없어요.",
  },
  {
    key: "g1-u1-1-prime-hunt",
    unitId: "g1-1-1",
    type: "game",
    title: "소수 찾기",
    href: "/play/g1-u1-1-prime-hunt",
    awardsXp: true,
    description:
      "점점 커지는 홀수가 소수인지 판정하는 게임입니다. 학급 배정·활성 시 XP와 랭킹이 쌓여요.",
  },
];

export function getContent(key: string): ContentMeta | undefined {
  return CONTENTS.find((c) => c.key === key);
}

export function getContentsForUnit(unitId: string): ContentMeta[] {
  return CONTENTS.filter((c) => c.unitId === unitId);
}

export function contentTypeLabel(type: ContentType): string {
  return type === "simulation" ? "시뮬레이션" : "게임";
}
