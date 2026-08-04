import "server-only";

import { createClient } from "@/lib/supabase/server";
import { canonicalInquiryStepCount } from "@/lib/inquiry-step-counts";
import { getStudentSessionToken } from "@/lib/student-session";
import type {
  InquiryParticipantRow,
  InquiryPhase,
  InquiryPollState,
  InquiryResponseRow,
  InquiryResult,
} from "@/lib/inquiry-types";

export type { InquiryPollState } from "@/lib/inquiry-types";

function firstRows<T>(data: T | T[] | null): T[] {
  if (!data) return [];
  return Array.isArray(data) ? data : [data];
}

function parsePhase(s: string | null | undefined): InquiryPhase | "idle" {
  if (s === "setup" || s === "live" || s === "closed") return s;
  return "idle";
}

function parseResult(s: string | null | undefined): InquiryResult | null {
  if (s === "correct" || s === "wrong" || s === "neutral") return s;
  return null;
}

type PollRow = {
  session_id: string;
  class_id: string | null;
  class_name: string | null;
  content_key: string | null;
  phase: string;
  step_index: number;
  step_count: number;
  student_id: string | null;
  display_name: string | null;
  last_seen_at: string | null;
  step_result: string | null;
  is_me: boolean;
};

const IDLE: InquiryPollState = {
  sessionId: null,
  classId: null,
  className: null,
  contentKey: null,
  phase: "idle",
  stepIndex: 0,
  stepCount: 0,
  participants: [],
  myStepResult: null,
};

function mapPollRows(rows: PollRow[]): InquiryPollState {
  if (rows.length === 0) return IDLE;

  const head = rows[0]!;
  const participants: InquiryParticipantRow[] = rows
    .filter((r) => r.student_id != null)
    .map((r) => ({
      studentId: r.student_id as string,
      displayName: r.display_name ?? "탐험가",
      lastSeenAt: r.last_seen_at,
      stepResult: parseResult(r.step_result),
      isMe: Boolean(r.is_me),
    }));

  const me = participants.find((p) => p.isMe);

  return {
    sessionId: head.session_id,
    classId: head.class_id,
    className: head.class_name,
    contentKey: head.content_key,
    phase: parsePhase(head.phase),
    stepIndex: head.step_index,
    stepCount: head.step_count,
    participants,
    myStepResult: me?.stepResult ?? null,
  };
}

export async function inquiryCreateSession(input: {
  classId: string;
  contentKey: string;
  stepCount: number;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pm_inquiry_create_session", {
    p_class_id: input.classId,
    p_content_key: input.contentKey,
    p_step_count: input.stepCount,
  });

  if (error) {
    console.error("[pm] pm_inquiry_create_session failed:", error.message);
    return { error: "세션을 만들지 못했어요." };
  }

  return { sessionId: data as string };
}

export async function inquiryStart(input: { sessionId: string }) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("pm_inquiry_start", {
    p_session_id: input.sessionId,
  });

  if (error) {
    console.error("[pm] pm_inquiry_start failed:", error.message);
    return { error: "수업을 시작하지 못했어요." };
  }

  return { ok: true as const };
}

export async function inquiryAdvanceStep(input: {
  sessionId: string;
  delta: number;
  contentKey?: string | null;
}) {
  if (input.contentKey) {
    await ensureSessionStepCount(input.sessionId, input.contentKey);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pm_inquiry_advance_step", {
    p_session_id: input.sessionId,
    p_delta: input.delta,
  });

  if (error) {
    console.error("[pm] pm_inquiry_advance_step failed:", error.message);
    return { error: "페이지를 넘기지 못했어요." };
  }

  return { stepIndex: data as number };
}

export async function inquiryClose(input: { sessionId: string }) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("pm_inquiry_close", {
    p_session_id: input.sessionId,
  });

  if (error) {
    console.error("[pm] pm_inquiry_close failed:", error.message);
    return { error: "수업을 종료하지 못했어요." };
  }

  return { ok: true as const };
}

export async function inquiryJoin(input: { classId: string }) {
  const token = await getStudentSessionToken();
  if (!token) return { error: "학생 로그인이 필요해요." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pm_inquiry_join", {
    p_session_token: token,
    p_class_id: input.classId,
  });

  if (error) {
    console.error("[pm] pm_inquiry_join failed:", error.message);
    if (error.message.includes("no active session")) {
      return { error: "no_session" as const };
    }
    return { error: "참가하지 못했어요." };
  }

  return { sessionId: data as string };
}

export async function inquirySubmitResponse(input: {
  sessionId: string;
  stepIndex: number;
  response: Record<string, unknown>;
  result: InquiryResult | null;
}) {
  const token = await getStudentSessionToken();
  if (!token) return { error: "학생 로그인이 필요해요." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("pm_inquiry_submit_response", {
    p_session_token: token,
    p_session_id: input.sessionId,
    p_step_index: input.stepIndex,
    p_response: input.response,
    p_result: input.result,
  });

  if (error) {
    console.error("[pm] pm_inquiry_submit_response failed:", error.message);
    return { error: "제출하지 못했어요." };
  }

  return { ok: true as const };
}

export async function inquiryFindActiveForStudent(input: { classId: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pm_inquiry_find_active", {
    p_class_id: input.classId,
  });

  if (error) {
    console.error("[pm] pm_inquiry_find_active failed:", error.message);
    return { sessionId: null };
  }

  return { sessionId: (data as string | null) ?? null };
}

export async function inquiryFindActiveForTeacher(input: { classId: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pm_inquiry_teacher_find_active", {
    p_class_id: input.classId,
  });

  if (error) {
    console.error("[pm] pm_inquiry_teacher_find_active failed:", error.message);
    return { sessionId: null };
  }

  return { sessionId: (data as string | null) ?? null };
}

export async function inquiryStudentPoll(
  input: { sessionId: string },
): Promise<InquiryPollState | null> {
  const token = await getStudentSessionToken();
  if (!token) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pm_inquiry_poll", {
    p_session_token: token,
    p_session_id: input.sessionId,
  });

  if (error) {
    console.error("[pm] pm_inquiry_poll failed:", error.message);
    return null;
  }

  return mapPollRows(firstRows(data as PollRow[]));
}

async function ensureSessionStepCount(
  sessionId: string,
  contentKey: string | null,
): Promise<void> {
  const canonical = canonicalInquiryStepCount(contentKey);
  if (canonical <= 0) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("pm_inquiry_sync_step_count", {
    p_session_id: sessionId,
    p_step_count: canonical,
  });

  if (error) {
    console.warn(
      "[pm] pm_inquiry_sync_step_count failed:",
      error.message,
    );
  }
}

async function syncSessionStepCountIfNeeded(
  sessionId: string,
  contentKey: string | null,
  currentStepCount: number,
): Promise<void> {
  const canonical = canonicalInquiryStepCount(contentKey);
  if (canonical <= 0 || currentStepCount >= canonical) return;
  await ensureSessionStepCount(sessionId, contentKey);
}

export async function inquiryTeacherPoll(input: { sessionId: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pm_inquiry_teacher_poll", {
    p_session_id: input.sessionId,
  });

  if (error) {
    console.error("[pm] pm_inquiry_teacher_poll failed:", error.message);
    return IDLE;
  }

  const state = mapPollRows(firstRows(data as PollRow[]));
  if (state.sessionId) {
    await syncSessionStepCountIfNeeded(
      state.sessionId,
      state.contentKey,
      state.stepCount,
    );
    if (state.stepCount < canonicalInquiryStepCount(state.contentKey)) {
      const { data: refreshed, error: refreshError } = await supabase.rpc(
        "pm_inquiry_teacher_poll",
        { p_session_id: input.sessionId },
      );
      if (!refreshError) {
        return mapPollRows(firstRows(refreshed as PollRow[]));
      }
    }
  }

  return state;
}

export async function inquiryListResponses(input: { sessionId: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pm_inquiry_list_responses", {
    p_session_id: input.sessionId,
  });

  if (error) {
    console.error("[pm] pm_inquiry_list_responses failed:", error.message);
    return { responses: [] as InquiryResponseRow[] };
  }

  const rows = firstRows(data as {
    student_id: string;
    display_name: string;
    step_index: number;
    result: string | null;
    response: Record<string, unknown>;
    submitted_at: string;
  }[]);

  return {
    responses: rows.map((r) => ({
      studentId: r.student_id,
      displayName: r.display_name,
      stepIndex: r.step_index,
      result: parseResult(r.result),
      response: r.response ?? {},
      submittedAt: r.submitted_at,
    })),
  };
}

export async function inquiryRecordSessionRuns(input: {
  sessionId: string;
  runs: Array<{
    studentId: string;
    score: number;
    details: Record<string, unknown>;
  }>;
}) {
  const supabase = await createClient();
  const payload = input.runs.map((r) => ({
    student_id: r.studentId,
    score: r.score,
    details: r.details,
  }));

  const { data, error } = await supabase.rpc("pm_inquiry_record_session_runs", {
    p_session_id: input.sessionId,
    p_runs: payload,
  });

  if (error) {
    console.error("[pm] pm_inquiry_record_session_runs failed:", error.message);
    return { error: "결과를 저장하지 못했어요.", recorded: 0 };
  }

  return { recorded: (data as number) ?? 0 };
}
