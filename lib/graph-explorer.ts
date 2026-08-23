import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  checkPoint,
  compileExpression,
  normalizeGraphExpression,
  parseCoordinate,
} from "@/lib/graph-explorer-math";
import {
  parseGraphSettings,
  type GraphParticipant,
  type GraphPoint,
  type GraphSettings,
  type GraphStudentState,
  type GraphSubmitResult,
  type GraphTeacherState,
} from "@/lib/graph-explorer-types";

function firstRow<T>(data: T | T[] | null): T | null {
  if (!data) return null;
  return Array.isArray(data) ? (data[0] ?? null) : data;
}

function firstRows<T>(data: T | T[] | null): T[] {
  if (!data) return [];
  return Array.isArray(data) ? data : [data];
}

function parseStatus(s: string | null | undefined): "live" | "closed" {
  return s === "closed" ? "closed" : "live";
}

/** 함수식 원문을 검증·정규화. 실패 시 null. */
export function prepareExpression(raw: string): {
  expression: string;
  display: string;
} | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 120) return null;
  const normalized = normalizeGraphExpression(trimmed);
  if (!normalized) return null;
  const fn = compileExpression(normalized);
  if (!fn) return null;
  const display = /^(y\s*=|f\s*\(\s*x\s*\)\s*=)/i.test(trimmed)
    ? trimmed
    : `y = ${normalized}`;
  return { expression: normalized, display };
}

// ---------------------------------------------------------------------------
// 교사
// ---------------------------------------------------------------------------

export async function graphCreateSession(input: {
  expressionRaw: string;
  settings: Partial<GraphSettings>;
}) {
  const prepared = prepareExpression(input.expressionRaw);
  if (!prepared) {
    return { error: "함수식을 이해하지 못했어요. 예: y = 2x + 1" };
  }

  const settings = parseGraphSettings(input.settings);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pm_graph_create_session", {
    p_expression: prepared.expression,
    p_expression_display: prepared.display,
    p_settings: settings,
  });

  if (error) {
    console.error("[pm] pm_graph_create_session failed:", error.message);
    if (error.message.includes("not authenticated")) {
      return { error: "교사 로그인이 필요해요." };
    }
    return { error: "방을 만들지 못했어요." };
  }

  const row = firstRow(data) as {
    session_id: string;
    join_code: string;
  } | null;
  if (!row) return { error: "방 정보가 없어요." };

  return { sessionId: row.session_id, joinCode: row.join_code };
}

export async function graphFindMyActive() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pm_graph_find_my_active");

  if (error) {
    console.error("[pm] pm_graph_find_my_active failed:", error.message);
    return { sessionId: null as string | null };
  }

  return { sessionId: (data as string | null) ?? null };
}

export async function graphUpdateSettings(input: {
  sessionId: string;
  settings: Partial<GraphSettings>;
}) {
  const settings = parseGraphSettings(input.settings);
  const supabase = await createClient();
  const { error } = await supabase.rpc("pm_graph_update_settings", {
    p_session_id: input.sessionId,
    p_settings: settings,
  });

  if (error) {
    console.error("[pm] pm_graph_update_settings failed:", error.message);
    return { error: "설정을 저장하지 못했어요." };
  }

  return { ok: true as const };
}

export async function graphUpdateExpression(input: {
  sessionId: string;
  expressionRaw: string;
}) {
  const prepared = prepareExpression(input.expressionRaw);
  if (!prepared) {
    return { error: "함수식을 이해하지 못했어요. 예: y = 2x + 1" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("pm_graph_update_expression", {
    p_session_id: input.sessionId,
    p_expression: prepared.expression,
    p_expression_display: prepared.display,
  });

  if (error) {
    console.error("[pm] pm_graph_update_expression failed:", error.message);
    return { error: "함수식을 바꾸지 못했어요." };
  }

  return { ok: true as const };
}

export async function graphSetReveal(input: {
  sessionId: string;
  reveal: boolean;
}) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("pm_graph_set_reveal", {
    p_session_id: input.sessionId,
    p_reveal: input.reveal,
  });

  if (error) {
    console.error("[pm] pm_graph_set_reveal failed:", error.message);
    return { error: "개형 공개 상태를 바꾸지 못했어요." };
  }

  return { ok: true as const };
}

export async function graphClearPoints(input: { sessionId: string }) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("pm_graph_clear_points", {
    p_session_id: input.sessionId,
  });

  if (error) {
    console.error("[pm] pm_graph_clear_points failed:", error.message);
    return { error: "점을 지우지 못했어요." };
  }

  return { ok: true as const };
}

export async function graphRemovePoint(input: {
  sessionId: string;
  pointId: string;
}) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("pm_graph_remove_point", {
    p_session_id: input.sessionId,
    p_point_id: input.pointId,
  });

  if (error) {
    console.error("[pm] pm_graph_remove_point failed:", error.message);
    return { error: "점을 지우지 못했어요." };
  }

  return { ok: true as const };
}

export async function graphClose(input: { sessionId: string }) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("pm_graph_close", {
    p_session_id: input.sessionId,
  });

  if (error) {
    console.error("[pm] pm_graph_close failed:", error.message);
    return { error: "방을 닫지 못했어요." };
  }

  return { ok: true as const };
}

type TeacherPollRow = {
  session_id: string;
  status: string;
  join_code: string | null;
  expression: string;
  expression_display: string;
  reveal: boolean;
  settings: unknown;
  participant_id: string | null;
  participant_name: string | null;
  participant_joined_at: string | null;
  point_id: string | null;
  x: number | null;
  y: number | null;
  is_correct: boolean | null;
  point_created_at: string | null;
};

export async function graphTeacherPoll(input: {
  sessionId: string;
}): Promise<GraphTeacherState | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pm_graph_teacher_poll", {
    p_session_id: input.sessionId,
  });

  if (error) {
    console.error("[pm] pm_graph_teacher_poll failed:", error.message);
    if (
      error.message.includes("not authenticated") ||
      error.message.includes("not session owner")
    ) {
      return { error: "교사 권한이 필요해요." };
    }
    return { error: "상태를 불러오지 못했어요." };
  }

  const rows = firstRows(data) as TeacherPollRow[];
  if (rows.length === 0) return { error: "방을 찾을 수 없어요." };

  const head = rows[0]!;
  const participantMap = new Map<string, GraphParticipant>();
  const points: GraphPoint[] = [];

  for (const r of rows) {
    if (r.participant_id) {
      const existing = participantMap.get(r.participant_id);
      if (!existing) {
        participantMap.set(r.participant_id, {
          id: r.participant_id,
          name: r.participant_name ?? "탐험가",
          joinedAt: r.participant_joined_at,
          pointCount: 0,
          correctCount: 0,
        });
      }
      if (r.point_id != null && r.x != null && r.y != null) {
        const p = participantMap.get(r.participant_id)!;
        p.pointCount += 1;
        if (r.is_correct) p.correctCount += 1;
        points.push({
          id: r.point_id,
          participantId: r.participant_id,
          participantName: r.participant_name,
          x: r.x,
          y: r.y,
          isCorrect: Boolean(r.is_correct),
          isMe: false,
          createdAt: r.point_created_at,
        });
      }
    }
  }

  points.sort((a, b) =>
    (a.createdAt ?? "").localeCompare(b.createdAt ?? ""),
  );

  return {
    sessionId: head.session_id,
    status: parseStatus(head.status),
    joinCode: head.join_code,
    expression: head.expression,
    expressionDisplay: head.expression_display,
    reveal: Boolean(head.reveal),
    settings: parseGraphSettings(head.settings),
    participants: [...participantMap.values()],
    points,
  };
}

// ---------------------------------------------------------------------------
// 학생 (익명)
// ---------------------------------------------------------------------------

export async function graphFindByCode(input: { joinCode: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pm_graph_find_by_code", {
    p_join_code: input.joinCode,
  });

  if (error) {
    console.error("[pm] pm_graph_find_by_code failed:", error.message);
    return { sessionId: null as string | null };
  }

  return { sessionId: (data as string | null) ?? null };
}

export async function graphGuestJoin(input: {
  joinCode: string;
  guestKey: string;
  name: string;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pm_graph_guest_join", {
    p_join_code: input.joinCode,
    p_guest_key: input.guestKey,
    p_name: input.name,
  });

  if (error) {
    console.error("[pm] pm_graph_guest_join failed:", error.message);
    if (error.message.includes("no active session")) {
      return { error: "no_session" as const };
    }
    return { error: "입장하지 못했어요." };
  }

  return { sessionId: data as string };
}

export async function graphSubmitPoint(input: {
  sessionId: string;
  guestKey: string;
  xRaw: string;
  yRaw: string;
}): Promise<GraphSubmitResult> {
  const x = parseCoordinate(input.xRaw);
  const y = parseCoordinate(input.yRaw);
  if (x == null || y == null) {
    return { ok: false, error: "좌표는 숫자(분수 가능)로 입력해 주세요." };
  }
  if (Math.abs(x) > 1e6 || Math.abs(y) > 1e6) {
    return { ok: false, error: "너무 큰 수예요." };
  }

  const supabase = await createClient();
  const { data: infoData, error: infoError } = await supabase.rpc(
    "pm_graph_check_info",
    {
      p_session_id: input.sessionId,
      p_guest_key: input.guestKey,
    },
  );

  if (infoError) {
    console.error("[pm] pm_graph_check_info failed:", infoError.message);
    return { ok: false, error: "상태를 확인하지 못했어요." };
  }

  const info = firstRow(infoData) as {
    expression: string;
    settings: unknown;
    status: string;
  } | null;
  if (!info) {
    return { ok: false, error: "방에 먼저 입장해 주세요." };
  }
  if (info.status !== "live") {
    return { ok: false, error: "이미 끝난 활동이에요." };
  }

  const settings = parseGraphSettings(info.settings);

  if (settings.integersOnly && (!Number.isInteger(x) || !Number.isInteger(y))) {
    return { ok: false, error: "이 활동에서는 정수 순서쌍만 제출할 수 있어요." };
  }

  const fn = compileExpression(info.expression);
  if (!fn) {
    return { ok: false, error: "함수식에 문제가 있어요. 선생님께 알려주세요." };
  }

  const verdict = checkPoint(fn, x, y, settings.tolerance);
  const isCorrect = verdict.status === "correct";

  // 오답 비표시 모드: 저장하지 않고 피드백만 (제출 기회를 쓰지 않음)
  if (!isCorrect && !settings.showWrongOnBoard) {
    return { ok: true, stored: false, verdict: verdict.status };
  }

  const { error: submitError } = await supabase.rpc("pm_graph_submit_point", {
    p_session_id: input.sessionId,
    p_guest_key: input.guestKey,
    p_x: x,
    p_y: y,
    p_is_correct: isCorrect,
  });

  if (submitError) {
    console.error("[pm] pm_graph_submit_point failed:", submitError.message);
    if (submitError.message.includes("point limit reached")) {
      return { ok: false, error: "제출 가능한 점을 모두 사용했어요." };
    }
    if (submitError.message.includes("no active session")) {
      return { ok: false, error: "이미 끝난 활동이에요." };
    }
    return { ok: false, error: "점을 제출하지 못했어요." };
  }

  return { ok: true, stored: true, verdict: verdict.status };
}

export async function graphDeleteOwnPoint(input: {
  sessionId: string;
  guestKey: string;
  pointId: string;
}) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("pm_graph_delete_own_point", {
    p_session_id: input.sessionId,
    p_guest_key: input.guestKey,
    p_point_id: input.pointId,
  });

  if (error) {
    console.error("[pm] pm_graph_delete_own_point failed:", error.message);
    return { error: "점을 지우지 못했어요." };
  }

  return { ok: true as const };
}

type GuestPollRow = {
  session_id: string;
  status: string;
  reveal: boolean;
  settings: unknown;
  expression: string | null;
  expression_display: string | null;
  participant_count: number;
  my_name: string | null;
  point_id: string | null;
  participant_name: string | null;
  x: number | null;
  y: number | null;
  is_correct: boolean | null;
  is_me: boolean;
  point_created_at: string | null;
};

export async function graphGuestPoll(input: {
  sessionId: string;
  guestKey: string;
}): Promise<GraphStudentState | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pm_graph_guest_poll", {
    p_session_id: input.sessionId,
    p_guest_key: input.guestKey,
  });

  if (error) {
    console.error("[pm] pm_graph_guest_poll failed:", error.message);
    return { error: "상태를 불러오지 못했어요." };
  }

  const rows = firstRows(data) as GuestPollRow[];
  if (rows.length === 0) return { error: "방을 찾을 수 없어요." };

  const head = rows[0]!;
  const points: GraphPoint[] = rows
    .filter((r) => r.point_id != null && r.x != null && r.y != null)
    .map((r) => ({
      id: r.point_id as string,
      participantId: null,
      participantName: r.participant_name,
      x: r.x as number,
      y: r.y as number,
      isCorrect: Boolean(r.is_correct),
      isMe: Boolean(r.is_me),
      createdAt: r.point_created_at,
    }));

  return {
    sessionId: head.session_id,
    status: parseStatus(head.status),
    reveal: Boolean(head.reveal),
    settings: parseGraphSettings(head.settings),
    expression: head.expression,
    expressionDisplay: head.expression_display,
    participantCount: head.participant_count ?? 0,
    myName: head.my_name,
    points,
  };
}
