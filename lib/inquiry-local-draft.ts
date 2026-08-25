import type { TermTexts } from "@/components/inquiry/radical-fill/InquiryRadicalFillStep";
import type { InquiryContentKey } from "@/lib/inquiry-content-registry";
import type { EquationOpsState } from "@/lib/equation-ops-math";
import type { TangentWorkspace } from "@/lib/inquiry-tangent-intro";
import type { SincosWorkspace } from "@/lib/inquiry-sincos-intro";
import type { TileWorkspace } from "@/lib/linear-equation-balance-math";

export type InquiryStepLocalDraft = {
  v: 1;
  wrongAttempts: number;
  submitted: boolean;
  submitFeedback: "correct" | "wrong" | null;
  texts?: TermTexts[];
  balanceWorkspace?: TileWorkspace;
  balanceMoves?: number;
  raceState?: EquationOpsState;
  stepStartedAt?: number | null;
  earnedScore?: number | null;
  tangentWorkspace?: TangentWorkspace;
  sincosWorkspace?: SincosWorkspace;
};

const PREFIX = "pm_inquiry_step:";

function storageKey(
  contentKey: InquiryContentKey,
  sessionId: string,
  stepIndex: number,
): string {
  return `${PREFIX}${contentKey}:${sessionId}:${stepIndex}`;
}

export function readInquiryLocalDraft(
  contentKey: InquiryContentKey,
  sessionId: string,
  stepIndex: number,
): InquiryStepLocalDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(
      storageKey(contentKey, sessionId, stepIndex),
    );
    if (!raw) return null;
    const parsed = JSON.parse(raw) as InquiryStepLocalDraft;
    if (parsed?.v !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeInquiryLocalDraft(
  contentKey: InquiryContentKey,
  sessionId: string,
  stepIndex: number,
  draft: InquiryStepLocalDraft,
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      storageKey(contentKey, sessionId, stepIndex),
      JSON.stringify(draft),
    );
  } catch {
    // ignore
  }
}

export function clearInquiryLocalDraft(
  contentKey: InquiryContentKey,
  sessionId: string,
  stepIndex: number,
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(
      storageKey(contentKey, sessionId, stepIndex),
    );
  } catch {
    // ignore
  }
}
