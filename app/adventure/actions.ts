"use server";

import { revalidatePath } from "next/cache";
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

/**
 * Award XP after a **game** run ends (not simulations).
 * Score must be 0–1000 (clamped server-side).
 * See docs/content-system.md and docs/progression-system.md.
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
