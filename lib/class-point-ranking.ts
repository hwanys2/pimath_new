export type ClassRankStudent = {
  id: string;
  student_number: number | null;
  display_name: string;
  level: number;
  total_xp: number;
};

export type RankedClassStudent = ClassRankStudent & { rank: number };

function xpOf(student: ClassRankStudent): number {
  const n = Number(student.total_xp);
  return Number.isFinite(n) ? n : 0;
}

function numberOf(student: ClassRankStudent): number {
  return student.student_number ?? Number.POSITIVE_INFINITY;
}

/** XP desc, then student number. Ties keep consecutive ranks so nobody is skipped. */
export function rankClassStudents(
  students: ClassRankStudent[],
): RankedClassStudent[] {
  return [...students]
    .sort((a, b) => {
      const xp = xpOf(b) - xpOf(a);
      if (xp !== 0) return xp;
      const byNumber = numberOf(a) - numberOf(b);
      if (byNumber !== 0) return byNumber;
      return a.display_name.localeCompare(b.display_name, "ko");
    })
    .map((student, index) => ({ ...student, rank: index + 1 }));
}
