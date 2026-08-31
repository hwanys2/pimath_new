/** Shared inquiry session types (client + server safe). */

export type InquiryPhase = "setup" | "live" | "closed";

export type InquiryResult = "correct" | "wrong" | "neutral";

export type InquiryParticipantRow = {
  studentId: string;
  displayName: string;
  lastSeenAt: string | null;
  stepResult: InquiryResult | null;
  isMe: boolean;
};

export type InquiryPollState = {
  sessionId: string | null;
  classId: string | null;
  className: string | null;
  contentKey: string | null;
  phase: InquiryPhase | "idle";
  stepIndex: number;
  stepCount: number;
  participants: InquiryParticipantRow[];
  myStepResult: InquiryResult | null;
  /** Saved response jsonb for the current student + step (for refresh restore). */
  myStepResponse: Record<string, unknown> | null;
};

export type InquiryResponseRow = {
  studentId: string;
  displayName: string;
  stepIndex: number;
  result: InquiryResult | null;
  response: Record<string, unknown>;
  submittedAt: string;
};

export type InquiryHostTab = "problem" | "status" | "responses" | "ranking";

/** Interval for discovering/joining an active inquiry session before sessionId is known. */
export const INQUIRY_POLL_MS = 2000;

/** Online if last_seen within this many ms. */
export const INQUIRY_ONLINE_MS = 5000;
