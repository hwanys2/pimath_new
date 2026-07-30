import { submitActivity } from "@/app/adventure/actions";
import { activityDetailsV1 } from "@/lib/activity-result-schemas";

/** Client-side helper to record simulation completion. See docs/activity-results.md */
export async function recordActivityComplete(
  contentKey: string,
  summary: Record<string, string | number | boolean>,
  durationSec?: number,
) {
  return submitActivity({
    contentKey,
    status: "completed",
    details: activityDetailsV1(summary),
    durationSec,
  });
}
