import { getInquiryContent } from "@/lib/inquiry-content-registry";

/** Canonical step count from the content registry (code source of truth). */
export function canonicalInquiryStepCount(contentKey: string | null): number {
  if (!contentKey) return 0;
  return getInquiryContent(contentKey)?.stepCount ?? 0;
}

/** Session step_count from DB may lag behind catalog updates — use the larger value. */
export function effectiveInquiryStepCount(
  contentKey: string | null,
  sessionStepCount: number,
): number {
  return Math.max(sessionStepCount, canonicalInquiryStepCount(contentKey));
}
