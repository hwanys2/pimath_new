import type { Metadata } from "next";
import { requireStudent } from "@/lib/auth";
import { fetchStudentProgress } from "@/lib/xp-award";
import { fetchMyClassContents } from "@/lib/class-contents";
import { getStudentSession } from "@/lib/student-session";
import {
  getEquippedCosmetics,
  getNextUnlock,
  getUnlockedCompanions,
  getUnlockedCosmetics,
  resolveAvatar,
  type AvatarChoice,
} from "@/lib/progression";
import { xpProgressInLevel } from "@/lib/xp";
import AdventureProfile from "@/components/adventure/AdventureProfile";
import ClassAssignedContents from "@/components/adventure/ClassAssignedContents";

export const metadata: Metadata = {
  title: "나의 모험 | 수학하는 즐거움",
  description: "레벨업하고 파이와 동료·장비를 성장시켜 보세요.",
};

export default async function AdventurePage() {
  const student = await requireStudent();
  const session = await getStudentSession();
  const progressRow = session
    ? await fetchStudentProgress(session.sessionToken)
    : null;

  const totalXp = progressRow?.totalXp ?? student.totalXp;
  const level = progressRow?.level ?? student.level;
  const activeAvatar = (progressRow?.activeAvatar ??
    student.activeAvatar) as AvatarChoice;

  const progress = xpProgressInLevel(totalXp);
  const avatar = resolveAvatar(level, activeAvatar);
  const nextUnlock = getNextUnlock(totalXp, level);
  const unlockedIds = getUnlockedCompanions(level).map((c) => c.id);
  const equipped = getEquippedCosmetics(level);
  const unlockedCosmeticIds = getUnlockedCosmetics(level).map((c) => c.id);

  const assignedContents = session
    ? await fetchMyClassContents(session.sessionToken)
    : [];

  return (
    <div className="flex flex-col gap-8">
      <ClassAssignedContents items={assignedContents} />
      <AdventureProfile
        displayName={progressRow?.displayName ?? student.name}
        className={progressRow?.className ?? student.className}
        progress={progress}
        avatar={avatar}
        activeAvatar={activeAvatar}
        nextUnlock={nextUnlock}
        unlockedIds={unlockedIds}
        equipped={equipped}
        unlockedCosmeticIds={unlockedCosmeticIds}
      />
    </div>
  );
}
