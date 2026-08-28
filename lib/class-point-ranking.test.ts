import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { rankClassStudents } from "./class-point-ranking";

function s(
  id: string,
  student_number: number | null,
  display_name: string,
  total_xp: number,
) {
  return { id, student_number, display_name, level: 1, total_xp };
}

describe("rankClassStudents", () => {
  it("puts tied XP in student-number order with consecutive ranks", () => {
    const ranked = rankClassStudents([
      s("a", 6, "김찬휘", 500),
      s("b", 8, "박유이", 500),
      s("c", 3, "김시현", 500),
      s("d", 5, "김지한", 470),
    ]);
    assert.deepEqual(
      ranked.map((row) => [row.rank, row.student_number, row.display_name]),
      [
        [1, 3, "김시현"],
        [2, 6, "김찬휘"],
        [3, 8, "박유이"],
        [4, 5, "김지한"],
      ],
    );
  });

  it("keeps every student when several share first place", () => {
    const ranked = rankClassStudents([
      s("a", 2, "을", 100),
      s("b", 1, "갑", 100),
      s("c", 3, "병", 100),
    ]);
    assert.equal(ranked.length, 3);
    assert.deepEqual(
      ranked.map((row) => row.rank),
      [1, 2, 3],
    );
  });
});
