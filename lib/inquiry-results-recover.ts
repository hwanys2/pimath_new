import "server-only";

import { fetchClassGameRuns } from "@/lib/activity-results";
import {
  inquiryBuildRunsForContent,
} from "@/lib/inquiry-finalize";
import { isInquiryContentKey } from "@/lib/inquiry-content-registry";
import {
  inquiryListClassSessions,
  inquiryListResponses,
  inquiryRecordSessionRuns,
} from "@/lib/inquiry-session";

/**
 * Re-score closed inquiry sessions that never made it into pm_game_runs
 * (e.g. "수업 준비" auto-closed a live session without finalize).
 * Only fills students who still have no run for this content.
 */
export async function backfillMissingInquiryGameRuns(
  classId: string,
  contentKey: string,
): Promise<{ recorded: number; skipped: boolean }> {
  if (!isInquiryContentKey(contentKey)) {
    return { recorded: 0, skipped: true };
  }

  const { sessions, error } = await inquiryListClassSessions({
    classId,
    contentKey,
  });

  // RPC not applied yet — leave results as game_runs-only.
  if (error) {
    return { recorded: 0, skipped: true };
  }

  const existing = await fetchClassGameRuns(classId, contentKey);
  const haveRun = new Set(existing.map((r) => r.studentId));
  let recorded = 0;

  for (const session of sessions) {
    if (session.phase !== "closed") continue;
    if (session.responseCount <= 0) continue;

    const { responses } = await inquiryListResponses({
      sessionId: session.sessionId,
    });
    if (responses.length === 0) continue;

    const runs = inquiryBuildRunsForContent(
      contentKey,
      responses.map((r) => ({
        studentId: r.studentId,
        stepIndex: r.stepIndex,
        result: r.result,
        response: r.response,
      })),
    ).filter((r) => !haveRun.has(r.studentId));

    if (runs.length === 0) continue;

    const result = await inquiryRecordSessionRuns({
      sessionId: session.sessionId,
      runs,
    });
    if ("error" in result && result.error) {
      console.error(
        "[pm] backfillMissingInquiryGameRuns record failed:",
        result.error,
      );
      continue;
    }

    const n = result.recorded ?? 0;
    recorded += n;
    for (const run of runs) haveRun.add(run.studentId);
  }

  return { recorded, skipped: false };
}
