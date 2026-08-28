"use server";

import { revalidatePath } from "next/cache";
import {
  fetchHofBoard,
  searchSchools,
  setTeacherSchool,
  type HofBoard,
  type HofTab,
  type SchoolSearchHit,
  type TeacherSchool,
} from "@/lib/hall-of-fame";

export async function fetchHofBoardAction(input: {
  tab?: HofTab;
  schoolInfoId?: number | null;
  classId?: string | null;
  lockClassId?: string | null;
}): Promise<HofBoard> {
  return fetchHofBoard(input);
}

export async function searchSchoolsAction(
  query: string,
): Promise<SchoolSearchHit[]> {
  return searchSchools(query);
}

export async function setTeacherSchoolAction(
  schoolInfoId: number,
): Promise<TeacherSchool | { error: string }> {
  const result = await setTeacherSchool(schoolInfoId);
  if (!("error" in result)) {
    revalidatePath("/");
    revalidatePath("/teacher");
    revalidatePath("/teacher", "layout");
    revalidatePath("/adventure");
  }
  return result;
}
