import { cumulativeXpForLevel, levelFromTotalXp, xpProgressInLevel } from "@/lib/xp";

export type PiStageId = `pi_stage_${string}`;

export type CompanionId = "pi" | "chowon" | "eondeok" | "byeolbit";

export type CosmeticSlot = "pin" | "staff" | "cape" | "badge" | "aura";

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

export type CosmeticDef = {
  id: string;
  unlockLevel: number;
  slot: CosmeticSlot;
  name: string;
  icon: string;
  blurb: string;
};

/** 20 major forms — one every 5 levels. */
export const PI_STAGES: PiStage[] = [
  { id: "pi_stage_01", minLevel: 1, maxLevel: 5, title: "견습 파이", image: "/images/mascot-v2.png", blurb: "모험의 첫걸음. 컴퍼스 지팡이를 처음 쥐었어요." },
  { id: "pi_stage_02", minLevel: 6, maxLevel: 10, title: "새싹 파이", image: "/images/pi-stage-02.png", blurb: "민트빛 기운이 돌기 시작해요." },
  { id: "pi_stage_03", minLevel: 11, maxLevel: 15, title: "모험가 파이", image: "/images/pi-adventurer.png", blurb: "배낭이 든든해지고 별 핀이 반짝여요." },
  { id: "pi_stage_04", minLevel: 16, maxLevel: 20, title: "탐험러너 파이", image: "/images/pi-stage-04.png", blurb: "발걸음이 빨라졌어요. 퀘스트 지도를 펼쳐요." },
  { id: "pi_stage_05", minLevel: 21, maxLevel: 25, title: "별빛 견습", image: "/images/pi-stage-05.png", blurb: "라벤더 스카프에 작은 별이 늘어나요." },
  { id: "pi_stage_06", minLevel: 26, maxLevel: 30, title: "탐험대장 파이", image: "/images/pi-captain.png", blurb: "짧은 망토와 대장 배지. 팀을 이끌어요." },
  { id: "pi_stage_07", minLevel: 31, maxLevel: 35, title: "수식 수련생", image: "/images/pi-stage-07.png", blurb: "떠다니는 기호가 하나둘 생겨요." },
  { id: "pi_stage_08", minLevel: 36, maxLevel: 40, title: "좌표 항해사", image: "/images/pi-stage-08.png", blurb: "나침반 지팡이가 좌표를 비춰요." },
  { id: "pi_stage_09", minLevel: 41, maxLevel: 45, title: "수식 기사 파이", image: "/images/pi-knight.png", blurb: "금테 갑옷 악센트. 당당한 자세!" },
  { id: "pi_stage_10", minLevel: 46, maxLevel: 50, title: "황금 모험가", image: "/images/pi-stage-10.png", blurb: "골드 기운이 스태프를 감싸요." },
  { id: "pi_stage_11", minLevel: 51, maxLevel: 55, title: "함수의 수호자", image: "/images/pi-stage-11.png", blurb: "그래프 문양이 망토에 새겨져요." },
  { id: "pi_stage_12", minLevel: 56, maxLevel: 60, title: "정리의 전사", image: "/images/pi-stage-12.png", blurb: "두루마리가 빛나는 무기가 됐어요." },
  { id: "pi_stage_13", minLevel: 61, maxLevel: 65, title: "아크메이지 파이", image: "/images/pi-archmage.png", blurb: "수식 오브가 둥실둥실 떠다녀요." },
  { id: "pi_stage_14", minLevel: 66, maxLevel: 70, title: "각도의 현자", image: "/images/pi-stage-14.png", blurb: "각도기 방패와 차분한 눈빛." },
  { id: "pi_stage_15", minLevel: 71, maxLevel: 75, title: "확률의 도사", image: "/images/pi-stage-15.png", blurb: "주사위 오브와 하늘빛 오라." },
  { id: "pi_stage_16", minLevel: 76, maxLevel: 80, title: "무한의 탐험가", image: "/images/pi-stage-16.png", blurb: "∞ 문양이 지팡이 꼭대기에." },
  { id: "pi_stage_17", minLevel: 81, maxLevel: 85, title: "별무리 마법사", image: "/images/pi-stage-17.png", blurb: "별가루 아우라가 더 진해져요." },
  { id: "pi_stage_18", minLevel: 86, maxLevel: 90, title: "황금 π 기사", image: "/images/pi-stage-18.png", blurb: "π 문장 방패. 거의 전설이에요." },
  { id: "pi_stage_19", minLevel: 91, maxLevel: 95, title: "천상의 계산사", image: "/images/pi-stage-19.png", blurb: "하늘·금빛 이중 오라." },
  { id: "pi_stage_20", minLevel: 96, maxLevel: 100, title: "전설 파이", image: "/images/pi-legend.png", blurb: "수학 모험의 상징. 전설이 됐어요!" },
];

/** Gear / relics unlocked every few levels. */
export const COSMETICS: CosmeticDef[] = [
  { id: "pin_star", unlockLevel: 2, slot: "pin", name: "금빛 별 핀", icon: "/images/cosmetics/pin-star.png", blurb: "후드에 반짝이는 첫 별." },
  { id: "staff_spark", unlockLevel: 4, slot: "staff", name: "반짝 컴퍼스", icon: "/images/cosmetics/staff-spark.png", blurb: "스태프 끝에 작은 불꽃." },
  { id: "badge_seed", unlockLevel: 7, slot: "badge", name: "새싹 배지", icon: "/images/cosmetics/badge-seed.png", blurb: "성장의 증표." },
  { id: "cape_mint", unlockLevel: 9, slot: "cape", name: "민트 짧은 망토", icon: "/images/cosmetics/cape-mint.png", blurb: "초원 바람 느낌." },
  { id: "aura_soft", unlockLevel: 12, slot: "aura", name: "소프트 오라", icon: "/images/cosmetics/aura-soft.png", blurb: "은은한 하늘빛 기운." },
  { id: "pin_pi", unlockLevel: 14, slot: "pin", name: "π 핀", icon: "/images/cosmetics/pin-pi.png", blurb: "파이의 상징." },
  { id: "staff_crystal", unlockLevel: 17, slot: "staff", name: "수정 컴퍼스", icon: "/images/cosmetics/staff-crystal.png", blurb: "파란 수정이 커졌어요." },
  { id: "badge_map", unlockLevel: 19, slot: "badge", name: "지도 배지", icon: "/images/cosmetics/badge-map.png", blurb: "탐험 지도 문양." },
  { id: "cape_lavender", unlockLevel: 22, slot: "cape", name: "라벤더 망토", icon: "/images/cosmetics/cape-lavender.png", blurb: "별빛 톤의 망토." },
  { id: "aura_gold", unlockLevel: 24, slot: "aura", name: "골드 스파클", icon: "/images/cosmetics/aura-gold.png", blurb: "금빛 반짝임." },
  { id: "pin_captain", unlockLevel: 27, slot: "pin", name: "대장 휘장", icon: "/images/cosmetics/pin-captain.png", blurb: "리더의 표시." },
  { id: "staff_rune", unlockLevel: 29, slot: "staff", name: "룬 스태프", icon: "/images/cosmetics/staff-rune.png", blurb: "수식 룬이 새겨져요." },
  { id: "badge_triangle", unlockLevel: 32, slot: "badge", name: "삼각형 배지", icon: "/images/cosmetics/badge-triangle.png", blurb: "a²+b²=c² 문양." },
  { id: "cape_teal", unlockLevel: 34, slot: "cape", name: "청록 망토", icon: "/images/cosmetics/cape-teal.png", blurb: "배낭과 어울리는 색." },
  { id: "aura_formula", unlockLevel: 37, slot: "aura", name: "수식 파티클", icon: "/images/cosmetics/aura-formula.png", blurb: "＋−×÷가 둥둥." },
  { id: "pin_shield", unlockLevel: 39, slot: "pin", name: "방패 핀", icon: "/images/cosmetics/pin-shield.png", blurb: "수호의 마음." },
  { id: "staff_knight", unlockLevel: 42, slot: "staff", name: "기사 컴퍼스", icon: "/images/cosmetics/staff-knight.png", blurb: "금테 강화 지팡이." },
  { id: "badge_gold", unlockLevel: 44, slot: "badge", name: "골드 배지", icon: "/images/cosmetics/badge-gold.png", blurb: "반짝이는 성취." },
  { id: "cape_gold", unlockLevel: 47, slot: "cape", name: "골드 트림 망토", icon: "/images/cosmetics/cape-gold.png", blurb: "가장자리 금실." },
  { id: "aura_graph", unlockLevel: 49, slot: "aura", name: "그래프 오라", icon: "/images/cosmetics/aura-graph.png", blurb: "곡선이 맴돌아요." },
  { id: "pin_crown", unlockLevel: 52, slot: "pin", name: "작은 왕관 핀", icon: "/images/cosmetics/pin-crown.png", blurb: "자신감 UP." },
  { id: "staff_orbit", unlockLevel: 55, slot: "staff", name: "궤도 스태프", icon: "/images/cosmetics/staff-orbit.png", blurb: "기호가 공전해요." },
  { id: "badge_infinity", unlockLevel: 58, slot: "badge", name: "∞ 배지", icon: "/images/cosmetics/badge-infinity.png", blurb: "끝없는 도전." },
  { id: "cape_star", unlockLevel: 62, slot: "cape", name: "별무리 망토", icon: "/images/cosmetics/cape-star.png", blurb: "안감에 별." },
  { id: "aura_legend", unlockLevel: 68, slot: "aura", name: "전설 전야 오라", icon: "/images/cosmetics/aura-legend.png", blurb: "전설에 한 걸음." },
  { id: "staff_legend", unlockLevel: 75, slot: "staff", name: "전설의 컴퍼스", icon: "/images/cosmetics/staff-legend.png", blurb: "가장 밝은 수정." },
  { id: "pin_legend", unlockLevel: 88, slot: "pin", name: "전설 별 핀", icon: "/images/cosmetics/pin-legend.png", blurb: "최고의 증표." },
  { id: "aura_max", unlockLevel: 96, slot: "aura", name: "만렙 후광", icon: "/images/cosmetics/aura-max.png", blurb: "최고 레벨의 빛." },
];

export const COMPANIONS: CompanionDef[] = [
  { id: "pi", name: "파이", unlockLevel: 1, image: "/images/mascot-v2.png", blurb: "언제나 함께하는 메인 동료. 레벨에 따라 모습이 성장해요." },
  { id: "chowon", name: "초원", unlockLevel: 5, image: "/images/grade-1-v2.png", blurb: "중1의 민트빛 검사. Lv.5에 합류해요." },
  { id: "eondeok", name: "언덕", unlockLevel: 15, image: "/images/grade-2-v2.png", blurb: "중2의 따뜻한 연금술사. Lv.15에 합류해요." },
  { id: "byeolbit", name: "별빛", unlockLevel: 30, image: "/images/grade-3-v2.png", blurb: "중3의 별빛 마법사. Lv.30에 합류해요." },
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

export function isCompanionUnlocked(companionId: CompanionId, level: number): boolean {
  const def = COMPANIONS.find((c) => c.id === companionId);
  return !!def && level >= def.unlockLevel;
}

export function getUnlockedCosmetics(level: number): CosmeticDef[] {
  return COSMETICS.filter((c) => level >= c.unlockLevel);
}

/** Best cosmetic per slot for current level (highest unlockLevel <= level). */
export function getEquippedCosmetics(level: number): Partial<Record<CosmeticSlot, CosmeticDef>> {
  const equipped: Partial<Record<CosmeticSlot, CosmeticDef>> = {};
  for (const item of COSMETICS) {
    if (level < item.unlockLevel) continue;
    const prev = equipped[item.slot];
    if (!prev || item.unlockLevel >= prev.unlockLevel) {
      equipped[item.slot] = item;
    }
  }
  return equipped;
}

export type AvatarChoice = CompanionId;

export type ResolvedAvatar = {
  companionId: AvatarChoice;
  name: string;
  title: string;
  image: string;
  piStage: PiStage;
};

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
  kind: "pi_stage" | "companion" | "cosmetic";
  name: string;
  atLevel: number;
  xpNeeded: number;
};

/** Next motivational goal — prefers soonest visual/companion reward. */
export function getNextUnlock(totalXp: number, level: number): NextUnlock | null {
  const progress = xpProgressInLevel(totalXp);
  type Candidate = NextUnlock;
  const candidates: Candidate[] = [];

  const nextCompanion = COMPANIONS.find((c) => c.unlockLevel > level);
  if (nextCompanion) {
    candidates.push({
      kind: "companion",
      name: nextCompanion.name,
      atLevel: nextCompanion.unlockLevel,
      xpNeeded: Math.max(0, cumulativeXpForLevel(nextCompanion.unlockLevel) - totalXp),
    });
  }

  const nextStage = PI_STAGES.find((s) => s.minLevel > level);
  if (nextStage) {
    candidates.push({
      kind: "pi_stage",
      name: nextStage.title,
      atLevel: nextStage.minLevel,
      xpNeeded: Math.max(0, cumulativeXpForLevel(nextStage.minLevel) - totalXp),
    });
  }

  const nextCosmetic = COSMETICS.find((c) => c.unlockLevel > level);
  if (nextCosmetic) {
    candidates.push({
      kind: "cosmetic",
      name: nextCosmetic.name,
      atLevel: nextCosmetic.unlockLevel,
      xpNeeded: Math.max(0, cumulativeXpForLevel(nextCosmetic.unlockLevel) - totalXp),
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

  candidates.sort((a, b) => a.atLevel - b.atLevel || a.xpNeeded - b.xpNeeded);
  return candidates[0];
}

export function getNextVisualReward(totalXp: number, level: number): NextUnlock | null {
  return getNextUnlock(totalXp, level);
}

export { levelFromTotalXp, xpProgressInLevel, cumulativeXpForLevel };
