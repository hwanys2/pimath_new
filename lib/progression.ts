import { cumulativeXpForLevel, levelFromTotalXp, xpProgressInLevel } from "@/lib/xp";

export type PiStageId =
  | "pi_apprentice"
  | "pi_adventurer"
  | "pi_captain"
  | "pi_knight"
  | "pi_archmage"
  | "pi_legend";

export type CompanionId = "pi" | "chowon" | "eondeok" | "byeolbit";

export type PiStage = {
  id: PiStageId;
  minLevel: number;
  maxLevel: number;
  title: string;
  image: string;
  blurb: string;
};

export type CompanionDef = {
  id: CompanionId;
  name: string;
  unlockLevel: number;
  image: string;
  blurb: string;
};

export const PI_STAGES: PiStage[] = [
  {
    id: "pi_apprentice",
    minLevel: 1,
    maxLevel: 9,
    title: "견습 파이",
    image: "/images/mascot-v2.png",
    blurb: "모험을 막 시작한 파이. 컴퍼스 지팡이를 손에 쥐었어요.",
  },
  {
    id: "pi_adventurer",
    minLevel: 10,
    maxLevel: 24,
    title: "모험가 파이",
    image: "/images/pi-adventurer.png",
    blurb: "배낭이 든든해지고, 별 핀이 더 반짝여요.",
  },
  {
    id: "pi_captain",
    minLevel: 25,
    maxLevel: 44,
    title: "탐험대장 파이",
    image: "/images/pi-captain.png",
    blurb: "팀을 이끄는 대장. 두루마리에 퀘스트가 가득해요.",
  },
  {
    id: "pi_knight",
    minLevel: 45,
    maxLevel: 64,
    title: "수식 기사 파이",
    image: "/images/pi-knight.png",
    blurb: "금빛 수식 갑옷과 더 강한 컴퍼스 지팡이!",
  },
  {
    id: "pi_archmage",
    minLevel: 65,
    maxLevel: 84,
    title: "아크메이지 파이",
    image: "/images/pi-archmage.png",
    blurb: "떠다니는 수식 아우라. 마법처럼 문제를 풀어요.",
  },
  {
    id: "pi_legend",
    minLevel: 85,
    maxLevel: 100,
    title: "전설 파이",
    image: "/images/pi-legend.png",
    blurb: "전설이 된 파이. 수학 모험의 상징이에요.",
  },
];

export const COMPANIONS: CompanionDef[] = [
  {
    id: "pi",
    name: "파이",
    unlockLevel: 1,
    image: "/images/mascot-v2.png", // resolved dynamically via stage
    blurb: "언제나 함께하는 메인 동료. 레벨에 따라 모습이 성장해요.",
  },
  {
    id: "chowon",
    name: "초원",
    unlockLevel: 5,
    image: "/images/grade-1-v2.png",
    blurb: "중1의 민트빛 검사. Lv.5에 합류해요.",
  },
  {
    id: "eondeok",
    name: "언덕",
    unlockLevel: 15,
    image: "/images/grade-2-v2.png",
    blurb: "중2의 따뜻한 연금술사. Lv.15에 합류해요.",
  },
  {
    id: "byeolbit",
    name: "별빛",
    unlockLevel: 30,
    image: "/images/grade-3-v2.png",
    blurb: "중3의 별빛 마법사. Lv.30에 합류해요.",
  },
];

export function getPiStage(level: number): PiStage {
  const L = Math.max(1, Math.min(100, Math.floor(level)));
  for (let i = PI_STAGES.length - 1; i >= 0; i--) {
    if (L >= PI_STAGES[i].minLevel) return PI_STAGES[i];
  }
  return PI_STAGES[0];
}

export function getUnlockedCompanions(level: number): CompanionDef[] {
  return COMPANIONS.filter((c) => level >= c.unlockLevel);
}

export function isCompanionUnlocked(
  companionId: CompanionId,
  level: number,
): boolean {
  const def = COMPANIONS.find((c) => c.id === companionId);
  return !!def && level >= def.unlockLevel;
}

export type AvatarChoice = CompanionId;

export type ResolvedAvatar = {
  companionId: AvatarChoice;
  name: string;
  title: string;
  image: string;
  piStage: PiStage;
};

/**
 * Resolve which portrait to show.
 * `activeAvatar` is stored preference; falls back to pi if locked/invalid.
 */
export function resolveAvatar(
  level: number,
  activeAvatar: string | null | undefined,
): ResolvedAvatar {
  const piStage = getPiStage(level);
  const raw = (activeAvatar ?? "pi") as AvatarChoice;
  const choice: AvatarChoice =
    raw === "chowon" || raw === "eondeok" || raw === "byeolbit" || raw === "pi"
      ? raw
      : "pi";

  if (choice !== "pi" && isCompanionUnlocked(choice, level)) {
    const companion = COMPANIONS.find((c) => c.id === choice)!;
    return {
      companionId: choice,
      name: companion.name,
      title: companion.name,
      image: companion.image,
      piStage,
    };
  }

  return {
    companionId: "pi",
    name: "파이",
    title: piStage.title,
    image: piStage.image,
    piStage,
  };
}

export type NextUnlock = {
  kind: "pi_stage" | "companion";
  name: string;
  atLevel: number;
  xpNeeded: number;
};

/** Next motivational goal for the student UI. */
export function getNextUnlock(
  totalXp: number,
  level: number,
): NextUnlock | null {
  const progress = xpProgressInLevel(totalXp);

  // Next companion unlock
  const nextCompanion = COMPANIONS.find((c) => c.unlockLevel > level);
  // Next pi stage
  const nextStage = PI_STAGES.find((s) => s.minLevel > level);

  type Candidate = NextUnlock & { atLevel: number };
  const candidates: Candidate[] = [];

  if (nextCompanion) {
    candidates.push({
      kind: "companion",
      name: nextCompanion.name,
      atLevel: nextCompanion.unlockLevel,
      xpNeeded: Math.max(
        0,
        cumulativeXpForLevel(nextCompanion.unlockLevel) - totalXp,
      ),
    });
  }
  if (nextStage) {
    candidates.push({
      kind: "pi_stage",
      name: nextStage.title,
      atLevel: nextStage.minLevel,
      xpNeeded: Math.max(0, cumulativeXpForLevel(nextStage.minLevel) - totalXp),
    });
  }

  if (candidates.length === 0) {
    if (progress.isMaxLevel) return null;
    return {
      kind: "pi_stage",
      name: "다음 레벨",
      atLevel: level + 1,
      xpNeeded: progress.xpToNextLevel,
    };
  }

  candidates.sort((a, b) => a.atLevel - b.atLevel);
  return candidates[0];
}

export { levelFromTotalXp, xpProgressInLevel, cumulativeXpForLevel };
