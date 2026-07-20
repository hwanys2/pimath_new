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
      "1000 이하 홀수 · 한 판에 나눠 보기 10번, 문제당 10초. 소수인지 판정하는 게임입니다. 학급 배정·활성 시 XP와 랭킹이 쌓여요.",
  },
  {
    key: "g1-u1-1-factor-rain",
    unitId: "g1-1-1",
    type: "game",
    title: "소인수분해 소나기",
    href: "/play/g1-u1-1-factor-rain",
    awardsXp: true,
    description:
      "떨어지는 숫자를 소수로 나눠 1까지 소인수분해하는 게임입니다. 학급 배정·활성 시 XP와 랭킹이 쌓여요.",
  },
  {
    key: "g1-u2-3-ordered-pair-omok",
    unitId: "g1-2-3",
    type: "game",
    title: "순서쌍 오목",
    href: "/play/g1-u2-3-ordered-pair-omok",
    awardsXp: true,
    description:
      "좌표평면에서 순서쌍 (x, y)만으로 오목을 두는 게임입니다. 컴퓨터·같은 반·전체 매칭. 학급 배정·활성 시 XP와 랭킹이 쌓여요.",
  },
  {
    key: "g1-u3-1-angle-guess",
    unitId: "g1-3-1",
    type: "game",
    title: "각도 맞히기",
    href: "/play/g1-u3-1-angle-guess",
    awardsXp: true,
    description:
      "벌어지는 각의 크기를 맞히는 게임입니다. 30→10→5→1도 간격으로 승급. 학급 배정·활성 시 XP와 랭킹이 쌓여요.",
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

/** Distinct pill colors so sim vs game is obvious at a glance. */
export function contentTypeBadgeClass(type: ContentType): string {
  return type === "simulation"
    ? "bg-sky/55 text-wood"
    : "bg-gold/70 text-wood";
}
