"use server";

import { revalidatePath } from "next/cache";
import {
  fetchClassGameRanking,
  submitGameRunFromSession,
} from "@/lib/game-runs";
import type { RankingMode, RankingRow } from "@/lib/game-types";
import {
  awardStudentXpFromSession,
  setStudentAvatarFromSession,
} from "@/lib/xp-award";

export type AdventureActionResult = {
  error?: string;
  message?: string;
  leveledUp?: boolean;
  level?: number;
  xpAwarded?: number;
};

export type GameSubmitClientResult = {
  error?: string;
  message?: string;
  recorded: boolean;
  practiceOnly: boolean;
  score: number;
  leveledUp?: boolean;
  level?: number;
  xpAwarded?: number;
};

/**
 * Official game finish path: XP + ranking only when the student's class
 * has this content assigned and active. Guests / unassigned → practice mode.
 * See docs/content-system.md and docs/progression-system.md.
 */
export async function submitGameRun(input: {
  contentKey: string;
  score: number;
}): Promise<GameSubmitClientResult> {
  const result = await submitGameRunFromSession(input);
  if ("error" in result) {
    return {
      error: result.error,
      recorded: false,
      practiceOnly: true,
      score: 0,
    };
  }

  if (result.recorded) {
    revalidatePath("/adventure");
    revalidatePath("/");
    revalidatePath("/teacher");
  }

  return {
    recorded: result.recorded,
    practiceOnly: result.practiceOnly,
    score: result.score,
    leveledUp: result.leveledUp,
    level: result.levelAfter,
    xpAwarded: result.xpAwarded,
    message: result.recorded
      ? result.leveledUp
        ? `레벨 업! Lv.${result.levelAfter}이 되었어요 (+${result.xpAwarded} XP)`
        : `+${result.xpAwarded} XP를 얻었어요`
      : undefined,
  };
}

export async function fetchGameRanking(input: {
  contentKey: string;
  mode: RankingMode;
}): Promise<RankingRow[]> {
  return fetchClassGameRanking(input);
}

/**
 * Demo / practice XP only. Real games must use `submitGameRun`.
 * Score must be 0–1000 (clamped server-side).
 */
export async function awardStudentXp(input: {
  gameKey: string;
  score: number;
}): Promise<AdventureActionResult> {
  const result = await awardStudentXpFromSession(input);
  if ("error" in result) return { error: result.error };

  revalidatePath("/adventure");
  revalidatePath("/");
  revalidatePath("/teacher");

  return {
    message: result.leveledUp
      ? `레벨 업! Lv.${result.levelAfter}이 되었어요 (+${result.xpAwarded} XP)`
      : `+${result.xpAwarded} XP를 얻었어요`,
    leveledUp: result.leveledUp,
    level: result.levelAfter,
    xpAwarded: result.xpAwarded,
  };
}

export async function selectAvatar(
  _prev: AdventureActionResult,
  formData: FormData,
): Promise<AdventureActionResult> {
  const avatar = String(formData.get("avatar") ?? "");
  const result = await setStudentAvatarFromSession(avatar);
  if ("error" in result) return { error: result.error };

  revalidatePath("/adventure");
  revalidatePath("/");
  return { message: "아바타를 바꿨어요!" };
}

/**
 * Dev / demo helper: award a practice score so students can feel the loop
 * before real sims ship. Remove or gate later if undesired.
 */
export async function practiceAwardXp(
  _prev: AdventureActionResult,
  formData: FormData,
): Promise<AdventureActionResult> {
  const raw = Number(formData.get("score") ?? 200);
  return awardStudentXp({
    gameKey: "practice-adventure",
    score: raw,
  });
}
