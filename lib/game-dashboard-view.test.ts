import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { StudentActivitySummary } from "./activity-results";
import {
  buildDashboardKpis,
  buildDashboardStudents,
  contentKeyFromPlayPath,
  deriveStudentStatus,
  rankDashboardStudents,
} from "./game-dashboard-view";
import type { GameDashboardStudent } from "./game-dashboard-types";

function summary(
  id: string,
  name: string,
  number: number | null,
  extra: Partial<StudentActivitySummary> = {},
): StudentActivitySummary {
  return {
    studentId: id,
    displayName: name,
    loginId: id,
    studentNumber: number,
    participated: false,
    runCount: 0,
    bestScore: null,
    latestScore: null,
    lastPlayedAt: null,
    latestDetails: null,
    completedCount: 0,
    lastStatus: null,
    ...extra,
  };
}

function student(
  partial: Partial<GameDashboardStudent> & { studentId: string; displayName: string },
): GameDashboardStudent {
  return {
    loginId: partial.studentId,
    studentNumber: null,
    status: "idle",
    online: false,
    presencePhase: null,
    liveScore: null,
    lastSeenAt: null,
    opponentName: null,
    participated: false,
    runCount: 0,
    bestScore: null,
    latestScore: null,
    lastPlayedAt: null,
    latestDetails: null,
    ...partial,
  };
}

describe("deriveStudentStatus", () => {
  it("treats a live match as playing even if presence is waiting", () => {
    assert.equal(
      deriveStudentStatus({
        online: true,
        inQueue: true,
        inLiveMatch: true,
        presencePhase: "waiting",
        participated: true,
      }),
      "playing",
    );
  });

  it("marks queue-only students as waiting", () => {
    assert.equal(
      deriveStudentStatus({
        online: false,
        inQueue: true,
        inLiveMatch: false,
        presencePhase: null,
        participated: false,
      }),
      "waiting",
    );
  });

  it("marks finished students offline as done", () => {
    assert.equal(
      deriveStudentStatus({
        online: false,
        inQueue: false,
        inLiveMatch: false,
        presencePhase: null,
        participated: true,
      }),
      "done",
    );
  });
});

describe("buildDashboardStudents + ranking", () => {
  it("merges presence, queue, and match seats", () => {
    const rows = buildDashboardStudents({
      students: [
        summary("a", "민수", 1, { participated: true, bestScore: 800, runCount: 2 }),
        summary("b", "지민", 2),
        summary("c", "수아", 3, { participated: true, bestScore: 950, runCount: 1 }),
      ],
      presenceByStudent: new Map([
        [
          "a",
          {
            studentId: "a",
            phase: "playing",
            liveScore: 120,
            lastSeenAt: "2026-08-31T00:00:00.000Z",
          },
        ],
      ]),
      queuedIds: new Set(["b"]),
      matchByStudent: new Map(),
    });

    assert.equal(rows[0]?.status, "playing");
    assert.equal(rows[0]?.liveScore, 120);
    assert.equal(rows[1]?.status, "waiting");
    assert.equal(rows[2]?.status, "done");

    const ranked = rankDashboardStudents(rows);
    assert.deepEqual(
      ranked.map((r) => [r.rank, r.displayName, r.score]),
      [
        [1, "수아", 950],
        [2, "민수", 800],
      ],
    );
    assert.equal(ranked[0]?.isMasked, false);
    assert.equal(ranked[0]?.className, null);
  });
});

describe("buildDashboardKpis", () => {
  it("counts statuses and averages best scores", () => {
    const kpis = buildDashboardKpis(
      [
        student({
          studentId: "a",
          displayName: "A",
          status: "playing",
          online: true,
          participated: true,
          bestScore: 1000,
        }),
        student({
          studentId: "b",
          displayName: "B",
          status: "done",
          participated: true,
          bestScore: 500,
        }),
        student({ studentId: "c", displayName: "C", status: "idle" }),
      ],
      4,
    );
    assert.equal(kpis.playing, 1);
    assert.equal(kpis.done, 1);
    assert.equal(kpis.idle, 1);
    assert.equal(kpis.online, 1);
    assert.equal(kpis.avgBest, 750);
    assert.equal(kpis.topScore, 1000);
    assert.equal(kpis.participationRate, 67);
    assert.equal(kpis.totalRuns, 4);
  });
});

describe("contentKeyFromPlayPath", () => {
  it("reads the play slug", () => {
    assert.equal(
      contentKeyFromPlayPath("/play/g1-u1-1-prime-hunt"),
      "g1-u1-1-prime-hunt",
    );
    assert.equal(contentKeyFromPlayPath("/teacher/classes/x"), null);
  });
});
