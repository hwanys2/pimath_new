import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getStudentSessionToken } from "@/lib/student-session";
import {
  parseAnswerColors,
  parseCounts,
  type BallColorKey,
  type BallCounts,
} from "@/lib/ball-box";
import type {
  BallBoxPhase,
  BallBoxPlayerRow,
  BallBoxPollState,
} from "@/lib/ball-box-types";

export type { BallBoxPollState } from "@/lib/ball-box-types";

const CONTENT_KEY = "g2-u4-ball-box-guess";

function firstRow<T>(data: T | T[] | null): T | null {
  if (!data) return null;
  return Array.isArray(data) ? (data[0] ?? null) : data;
}

function firstRows<T>(data: T | T[] | null): T[] {
  if (!data) return [];
  return Array.isArray(data) ? data : [data];
}

function parsePhase(s: string | null | undefined): BallBoxPhase | "idle" {
  if (s === "lobby" || s === "playing" || s === "revealed" || s === "closed") {
    return s;
  }
  return "idle";
}

type PollRow = {
  session_id: string;
  class_id: string;
  class_name: string | null;
  phase: string;
  round_number: number;
  total: number;
  answer_colors: unknown;
  revealed_answer: unknown;
  join_code: string | null;
  pid: string | null;
  student_id: string | null;
  display_name: string | null;
  observed: unknown;
  draw_count: number;
  wrong_attempts: number;
  solved: boolean;
  score: number;
  session_score: number;
  is_me: boolean;
};

const IDLE: BallBoxPollState = {
  sessionId: null,
  classId: null,
  className: null,
  phase: "idle",
  roundNumber: 1,
  total: 0,
  answerColors: [],
  revealedAnswer: null,
  joinCode: null,
  players: [],
  myObserved: {},
  myDrawCount: 0,
  myWrongAttempts: 0,
  mySolved: false,
  myScore: 0,
  mySessionScore: 0,
};

function mapPollRows(rows: PollRow[]): BallBoxPollState {
  if (rows.length === 0) return IDLE;

  const head = rows[0]!;
  const players: BallBoxPlayerRow[] = rows
    .filter((r) => r.pid != null)
    .map((r) => ({
      pid: r.pid as string,
      studentId: r.student_id ?? null,
      displayName: r.display_name ?? "탐험가",
      drawCount: r.draw_count ?? 0,
      solved: Boolean(r.solved),
      score: r.score ?? 0,
      sessionScore: r.session_score ?? 0,
      isMe: Boolean(r.is_me),
    }));

  const me = rows.find((r) => r.is_me);

  const answerColors: BallColorKey[] = parseAnswerColors(head.answer_colors);
  const revealedAnswer: BallCounts | null =
    head.revealed_answer != null ? parseCounts(head.revealed_answer) : null;

  return {
    sessionId: head.session_id,
    classId: head.class_id,
    className: head.class_name,
    phase: parsePhase(head.phase),
    roundNumber: head.round_number,
    total: head.total ?? 0,
    answerColors,
    revealedAnswer,
    joinCode: head.join_code ?? null,
    players,
    myObserved: me ? parseCounts(me.observed) : {},
    myDrawCount: me?.draw_count ?? 0,
    myWrongAttempts: me?.wrong_attempts ?? 0,
    mySolved: Boolean(me?.solved),
    myScore: me?.score ?? 0,
    mySessionScore: me?.session_score ?? 0,
  };
}

export async function ballBoxCreateSession(input: { classId: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pm_ball_box_create_session", {
    p_class_id: input.classId,
    p_content_key: CONTENT_KEY,
  });

  if (error) {
    console.error("[pm] pm_ball_box_create_session failed:", error.message);
    return { error: "세션을 만들지 못했어요." };
  }

  return { sessionId: data as string };
}

export async function ballBoxStart(input: {
  sessionId: string;
  answer: Record<string, number>;
}) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("pm_ball_box_start", {
    p_session_id: input.sessionId,
    p_answer: input.answer,
  });

  if (error) {
    console.error("[pm] pm_ball_box_start failed:", error.message);
    if (error.message.includes("box is empty")) {
      return { error: "공이 1개 이상 들어있게 설정해 주세요." };
    }
    if (error.message.includes("no color entered")) {
      return { error: "색을 1개 이상 입력해 주세요." };
    }
    return { error: "게임을 시작하지 못했어요." };
  }

  return { ok: true as const };
}

export async function ballBoxReveal(input: { sessionId: string }) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("pm_ball_box_reveal", {
    p_session_id: input.sessionId,
  });

  if (error) {
    console.error("[pm] pm_ball_box_reveal failed:", error.message);
    return { error: "정답을 공개하지 못했어요." };
  }

  return { ok: true as const };
}

export async function ballBoxNextRound(input: {
  sessionId: string;
  answer: Record<string, number>;
}) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("pm_ball_box_next_round", {
    p_session_id: input.sessionId,
    p_answer: input.answer,
  });

  if (error) {
    console.error("[pm] pm_ball_box_next_round failed:", error.message);
    if (error.message.includes("box is empty")) {
      return { error: "공이 1개 이상 들어있게 설정해 주세요." };
    }
    if (error.message.includes("no color entered")) {
      return { error: "색을 1개 이상 입력해 주세요." };
    }
    return { error: "다음 라운드를 시작하지 못했어요." };
  }

  return { ok: true as const };
}

export async function ballBoxClose(input: { sessionId: string }) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("pm_ball_box_close", {
    p_session_id: input.sessionId,
  });

  if (error) {
    console.error("[pm] pm_ball_box_close failed:", error.message);
    return { error: "세션을 종료하지 못했어요." };
  }

  return { ok: true as const };
}

export async function ballBoxJoin(input: { classId: string }) {
  const token = await getStudentSessionToken();
  if (!token) return { error: "학생 로그인이 필요해요." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pm_ball_box_join", {
    p_session_token: token,
    p_class_id: input.classId,
  });

  if (error) {
    console.error("[pm] pm_ball_box_join failed:", error.message);
    if (error.message.includes("no active session")) {
      return { error: "no_session" as const };
    }
    return { error: "참가하지 못했어요." };
  }

  return { sessionId: data as string };
}

export async function ballBoxDraw(input: { sessionId: string }) {
  const token = await getStudentSessionToken();
  if (!token) return { error: "학생 로그인이 필요해요." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pm_ball_box_draw", {
    p_session_token: token,
    p_session_id: input.sessionId,
  });

  if (error) {
    console.error("[pm] pm_ball_box_draw failed:", error.message);
    return { error: "공을 뽑지 못했어요." };
  }

  const row = firstRow(data);
  if (!row) return { error: "뽑기 결과가 없어요." };

  return { color: row.color as string };
}

export async function ballBoxGuess(input: {
  sessionId: string;
  guess: Record<string, number>;
}) {
  const token = await getStudentSessionToken();
  if (!token) return { error: "학생 로그인이 필요해요." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pm_ball_box_guess", {
    p_session_token: token,
    p_session_id: input.sessionId,
    p_guess: input.guess,
  });

  if (error) {
    console.error("[pm] pm_ball_box_guess failed:", error.message);
    return { error: "정답을 제출하지 못했어요." };
  }

  const row = firstRow(data);
  if (!row) return { error: "채점 결과가 없어요." };

  return {
    correct: Boolean(row.correct),
    score: row.score as number,
    alreadySolved: Boolean(row.already_solved),
    drawCount: row.draw_count as number,
    wrongAttempts: row.wrong_attempts as number,
  };
}

export async function ballBoxStudentPoll(input: { sessionId: string }) {
  const token = await getStudentSessionToken();
  if (!token) return { error: "학생 로그인이 필요해요." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pm_ball_box_poll", {
    p_session_token: token,
    p_session_id: input.sessionId,
  });

  if (error) {
    console.error("[pm] pm_ball_box_poll failed:", error.message);
    return { error: "상태를 불러오지 못했어요." };
  }

  return mapPollRows(firstRows(data) as PollRow[]);
}

export async function ballBoxTeacherPoll(input: { sessionId: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pm_ball_box_teacher_poll", {
    p_session_id: input.sessionId,
  });

  if (error) {
    console.error("[pm] pm_ball_box_teacher_poll failed:", error.message);
    if (
      error.message.includes("not authenticated") ||
      error.message.includes("not session owner")
    ) {
      return { error: "교사 권한이 필요해요." };
    }
    return { error: "상태를 불러오지 못했어요." };
  }

  return mapPollRows(firstRows(data) as PollRow[]);
}

export async function ballBoxFindActiveForStudent(input: { classId: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pm_ball_box_find_active", {
    p_class_id: input.classId,
  });

  if (error) {
    console.error("[pm] pm_ball_box_find_active failed:", error.message);
    return { sessionId: null as string | null };
  }

  return { sessionId: (data as string | null) ?? null };
}

export async function ballBoxFindActiveForTeacher(input: { classId: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pm_ball_box_teacher_find_active", {
    p_class_id: input.classId,
  });

  if (error) {
    console.error("[pm] pm_ball_box_teacher_find_active failed:", error.message);
    return { sessionId: null as string | null };
  }

  return { sessionId: (data as string | null) ?? null };
}

// ---------------------------------------------------------------------------
// Guest (QR, no class) mode
// ---------------------------------------------------------------------------

export async function ballBoxCreateGuestSession() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pm_ball_box_create_guest_session", {
    p_content_key: CONTENT_KEY,
  });

  if (error) {
    console.error("[pm] pm_ball_box_create_guest_session failed:", error.message);
    return { error: "QR 세션을 만들지 못했어요." };
  }

  const row = firstRow(data);
  if (!row) return { error: "세션 정보가 없어요." };

  return {
    sessionId: row.session_id as string,
    joinCode: row.join_code as string,
  };
}

export async function ballBoxTeacherFindGuest() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pm_ball_box_teacher_find_guest");

  if (error) {
    console.error("[pm] pm_ball_box_teacher_find_guest failed:", error.message);
    return { sessionId: null as string | null };
  }

  return { sessionId: (data as string | null) ?? null };
}

export async function ballBoxFindByCode(input: { joinCode: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pm_ball_box_find_by_code", {
    p_join_code: input.joinCode,
  });

  if (error) {
    console.error("[pm] pm_ball_box_find_by_code failed:", error.message);
    return { sessionId: null as string | null };
  }

  return { sessionId: (data as string | null) ?? null };
}

export async function ballBoxGuestJoin(input: {
  joinCode: string;
  guestKey: string;
  name: string;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pm_ball_box_guest_join", {
    p_join_code: input.joinCode,
    p_guest_key: input.guestKey,
    p_name: input.name,
  });

  if (error) {
    console.error("[pm] pm_ball_box_guest_join failed:", error.message);
    if (error.message.includes("no active session")) {
      return { error: "no_session" as const };
    }
    return { error: "입장하지 못했어요." };
  }

  return { sessionId: data as string };
}

export async function ballBoxGuestDraw(input: {
  guestKey: string;
  sessionId: string;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pm_ball_box_guest_draw", {
    p_guest_key: input.guestKey,
    p_session_id: input.sessionId,
  });

  if (error) {
    console.error("[pm] pm_ball_box_guest_draw failed:", error.message);
    return { error: "공을 뽑지 못했어요." };
  }

  const row = firstRow(data);
  if (!row) return { error: "뽑기 결과가 없어요." };

  return { color: row.color as string };
}

export async function ballBoxGuestGuess(input: {
  guestKey: string;
  sessionId: string;
  guess: Record<string, number>;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pm_ball_box_guest_guess", {
    p_guest_key: input.guestKey,
    p_session_id: input.sessionId,
    p_guess: input.guess,
  });

  if (error) {
    console.error("[pm] pm_ball_box_guest_guess failed:", error.message);
    return { error: "정답을 제출하지 못했어요." };
  }

  const row = firstRow(data);
  if (!row) return { error: "채점 결과가 없어요." };

  return {
    correct: Boolean(row.correct),
    score: row.score as number,
    alreadySolved: Boolean(row.already_solved),
    drawCount: row.draw_count as number,
    wrongAttempts: row.wrong_attempts as number,
  };
}

export async function ballBoxGuestPoll(input: {
  guestKey: string;
  sessionId: string;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pm_ball_box_guest_poll", {
    p_guest_key: input.guestKey,
    p_session_id: input.sessionId,
  });

  if (error) {
    console.error("[pm] pm_ball_box_guest_poll failed:", error.message);
    return { error: "상태를 불러오지 못했어요." };
  }

  return mapPollRows(firstRows(data) as PollRow[]);
}
