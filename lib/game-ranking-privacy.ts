import { anonymizeDisplayName } from "@/lib/hof-anonymize";

/** Same reveal rule as `pm_list_game_ranking` / `pm_teacher_list_game_ranking`. */
export function shouldRevealGameRankingName(input: {
  isMe?: boolean;
  sameClass?: boolean;
  sameTeacher?: boolean;
  viewerSchoolId?: number | null;
  rowSchoolId?: number | null;
}): boolean {
  if (input.isMe || input.sameClass || input.sameTeacher) return true;
  const viewerSchool = input.viewerSchoolId ?? null;
  const rowSchool = input.rowSchoolId ?? null;
  return viewerSchool != null && rowSchool === viewerSchool;
}

export function gameRankingDisplayName(
  name: string | null | undefined,
  reveal: boolean,
): string {
  if (reveal) {
    const trimmed = (name ?? "").trim();
    return trimmed || "*";
  }
  return anonymizeDisplayName(name);
}
