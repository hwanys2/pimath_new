import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getStudentSessionToken } from "@/lib/student-session";
import { parseCounts } from "@/lib/dice-race-math";
import type {
  DiceRacePhase,
  DiceRacePlayerRow,
  DiceRacePollState,
} from "@/lib/dice-race-types";

export type { DiceRacePollState } from "@/lib/dice-race-types";

const CONTENT_KEY = "g2-u4-dice-sum-race";

function firstRow<T>(data: T | T[] | null): T | null {
  if (!data) return null;
  return Array.isArray(data) ? (data[0] ?? null) : data;
}

function firstRows<T>(data: T | T[] | null): T[] {
  if (!data) return [];
  return Array.isArray(data) ? data : [data];
}

function parsePhase(s: string | null | undefined): DiceRacePhase | "idle" {
  if (
    s === "lobby" ||
    s === "picking" ||
    s === "rolling" ||
    s === "round_end" ||
    s === "closed"
  ) {
    return s;
  }
  return "idle";
}

type PollRow = {
  session_id: string;
  class_id: string | null;
  class_name: string | null;
  phase: string;
  round_number: number;
  counts: unknown;
  winning_sum: number | null;
  last_d1: number | null;
  last_d2: number | null;
  last_sum: number | null;
  roll_count: number;
  join_code?: string | null;
  pid?: string | null;
  student_id: string | null;
  display_name: string | null;
  pick: number | null;
  session_score: number;
  round_score: number;
  xp_claimed_round: number;
  is_me: boolean;
};

const IDLE: DiceRacePollState = {
  sessionId: null,
  classId: null,
  className: null,
  joinCode: null,
  phase: "idle",
  roundNumber: 1,
  counts: parseCounts(null),
  winningSum: null,
  lastD1: null,
  lastD2: null,
  lastSum: null,
  rollCount: 0,
  players: [],
  myPick: null,
  mySessionScore: 0,
  myRoundScore: 0,
  myXpClaimedRound: 0,
};

function mapPollRows(rows: PollRow[]): DiceRacePollState {
  if (rows.length === 0) return IDLE;

  const head = rows[0]!;
  const players: DiceRacePlayerRow[] = rows
    .filter((r) => r.pid != null || r.student_id != null)
    .map((r) => ({
      pid: (r.pid ?? r.student_id) as string,
      studentId: r.student_id ?? null,
      displayName: r.display_name ?? "탐험가",
      pick: r.pick,
      sessionScore: r.session_score,
      roundScore: r.round_score,
      xpClaimedRound: r.xp_claimed_round,
      isMe: Boolean(r.is_me),
    }));

  const me = players.find((p) => p.isMe);

  return {
    sessionId: head.session_id,
    classId: head.class_id,
    className: head.class_name,
    joinCode: head.join_code ?? null,
    phase: parsePhase(head.phase),
    roundNumber: head.round_number,
    counts: parseCounts(head.counts),
    winningSum: head.winning_sum,
    lastD1: head.last_d1,
    lastD2: head.last_d2,
    lastSum: head.last_sum,
    rollCount: head.roll_count,
    players,
    myPick: me?.pick ?? null,
    mySessionScore: me?.sessionScore ?? 0,
    myRoundScore: me?.roundScore ?? 0,
    myXpClaimedRound: me?.xpClaimedRound ?? 0,
  };
}

export async function diceRaceCreateSession(input: { classId: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pm_dice_race_create_session", {
    p_class_id: input.classId,
    p_content_key: CONTENT_KEY,
  });

  if (error) {
    console.error("[pm] pm_dice_race_create_session failed:", error.message);
    return { error: "세션을 만들지 못했어요." };
  }

  return { sessionId: data as string };
}

export async function diceRaceOpenPicking(input: { sessionId: string }) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("pm_dice_race_open_picking", {
    p_session_id: input.sessionId,
  });

  if (error) {
    console.error("[pm] pm_dice_race_open_picking failed:", error.message);
    return { error: "입장을 열지 못했어요." };
  }

  return { ok: true as const };
}

export async function diceRaceJoin(input: { classId: string }) {
  const token = await getStudentSessionToken();
  if (!token) return { error: "학생 로그인이 필요해요." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pm_dice_race_join", {
    p_session_token: token,
    p_class_id: input.classId,
  });

  if (error) {
    console.error("[pm] pm_dice_race_join failed:", error.message);
    if (error.message.includes("no active session")) {
      return { error: "no_session" as const };
    }
    return { error: "참가하지 못했어요." };
  }

  return { sessionId: data as string };
}

export async function diceRacePick(input: {
  sessionId: string;
  pick: number;
}) {
  const token = await getStudentSessionToken();
  if (!token) return { error: "학생 로그인이 필요해요." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("pm_dice_race_pick", {
    p_session_token: token,
    p_session_id: input.sessionId,
    p_pick: input.pick,
  });

  if (error) {
    console.error("[pm] pm_dice_race_pick failed:", error.message);
    return { error: "숫자를 선택하지 못했어요." };
  }

  return { ok: true as const };
}

export async function diceRaceStartRolling(input: { sessionId: string }) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("pm_dice_race_start_rolling", {
    p_session_id: input.sessionId,
  });

  if (error) {
    console.error("[pm] pm_dice_race_start_rolling failed:", error.message);
    return { error: "주사위 굴리기를 시작하지 못했어요." };
  }

  return { ok: true as const };
}

export async function diceRaceRoll(input: { sessionId: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pm_dice_race_roll", {
    p_session_id: input.sessionId,
  });

  if (error) {
    console.error("[pm] pm_dice_race_roll failed:", error.message);
    return { error: "주사위를 굴리지 못했어요." };
  }

  const row = firstRow(data);
  if (!row) return { error: "주사위 결과가 없어요." };

  return {
    d1: row.d1 as number,
    d2: row.d2 as number,
    sum: row.sum as number,
    phase: row.phase as string,
    winningSum: row.winning_sum as number | null,
  };
}

export async function diceRaceNextRound(input: { sessionId: string }) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("pm_dice_race_next_round", {
    p_session_id: input.sessionId,
  });

  if (error) {
    console.error("[pm] pm_dice_race_next_round failed:", error.message);
    return { error: "다음 라운드를 시작하지 못했어요." };
  }

  return { ok: true as const };
}

export async function diceRaceClose(input: { sessionId: string }) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("pm_dice_race_close", {
    p_session_id: input.sessionId,
  });

  if (error) {
    console.error("[pm] pm_dice_race_close failed:", error.message);
    return { error: "세션을 종료하지 못했어요." };
  }

  return { ok: true as const };
}

export async function diceRaceClaimRoundXp(input: { sessionId: string }) {
  const token = await getStudentSessionToken();
  if (!token) return { error: "학생 로그인이 필요해요." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pm_dice_race_claim_round_xp", {
    p_session_token: token,
    p_session_id: input.sessionId,
  });

  if (error) {
    console.error("[pm] pm_dice_race_claim_round_xp failed:", error.message);
    return { error: "XP를 받을 수 없어요." };
  }

  const row = firstRow(data);
  if (!row) return { error: "XP 정보가 없어요." };

  return {
    roundScore: row.round_score as number,
    roundNumber: row.round_number as number,
    alreadyClaimed: Boolean(row.already_claimed),
  };
}

export async function diceRaceStudentPoll(input: { sessionId: string }) {
  const token = await getStudentSessionToken();
  if (!token) return { error: "학생 로그인이 필요해요." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pm_dice_race_poll", {
    p_session_token: token,
    p_session_id: input.sessionId,
  });

  if (error) {
    console.error("[pm] pm_dice_race_poll failed:", error.message);
    return { error: "상태를 불러오지 못했어요." };
  }

  return mapPollRows(firstRows(data) as PollRow[]);
}

export async function diceRaceTeacherPoll(input: { sessionId: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pm_dice_race_teacher_poll", {
    p_session_id: input.sessionId,
  });

  if (error) {
    console.error("[pm] pm_dice_race_teacher_poll failed:", error.message);
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

export async function diceRaceFindActiveForStudent(input: { classId: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pm_dice_race_find_active", {
    p_class_id: input.classId,
  });

  if (error) {
    console.error("[pm] pm_dice_race_find_active failed:", error.message);
    return { sessionId: null as string | null };
  }

  return { sessionId: (data as string | null) ?? null };
}

export async function diceRaceFindActiveForTeacher(input: { classId: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pm_dice_race_teacher_find_active", {
    p_class_id: input.classId,
  });

  if (error) {
    console.error(
      "[pm] pm_dice_race_teacher_find_active failed:",
      error.message,
    );
    return { sessionId: null as string | null };
  }

  return { sessionId: (data as string | null) ?? null };
}

// ---------------------------------------------------------------------------
// Guest (QR, no class) mode
// ---------------------------------------------------------------------------

export async function diceRaceCreateGuestSession() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pm_dice_race_create_guest_session", {
    p_content_key: CONTENT_KEY,
  });

  if (error) {
    console.error("[pm] pm_dice_race_create_guest_session failed:", error.message);
    return { error: "QR 세션을 만들지 못했어요." };
  }

  const row = firstRow(data);
  if (!row) return { error: "세션 정보가 없어요." };

  return {
    sessionId: row.session_id as string,
    joinCode: row.join_code as string,
  };
}

export async function diceRaceTeacherFindGuest() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pm_dice_race_teacher_find_guest");

  if (error) {
    console.error("[pm] pm_dice_race_teacher_find_guest failed:", error.message);
    return { sessionId: null as string | null };
  }

  return { sessionId: (data as string | null) ?? null };
}

export async function diceRaceFindByCode(input: { joinCode: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pm_dice_race_find_by_code", {
    p_join_code: input.joinCode,
  });

  if (error) {
    console.error("[pm] pm_dice_race_find_by_code failed:", error.message);
    return { sessionId: null as string | null };
  }

  return { sessionId: (data as string | null) ?? null };
}

export async function diceRaceGuestJoin(input: {
  joinCode: string;
  guestKey: string;
  name: string;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pm_dice_race_guest_join", {
    p_join_code: input.joinCode,
    p_guest_key: input.guestKey,
    p_name: input.name,
  });

  if (error) {
    console.error("[pm] pm_dice_race_guest_join failed:", error.message);
    if (error.message.includes("no active session")) {
      return { error: "no_session" as const };
    }
    return { error: "입장하지 못했어요." };
  }

  return { sessionId: data as string };
}

export async function diceRaceGuestPick(input: {
  guestKey: string;
  sessionId: string;
  pick: number;
}) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("pm_dice_race_guest_pick", {
    p_guest_key: input.guestKey,
    p_session_id: input.sessionId,
    p_pick: input.pick,
  });

  if (error) {
    console.error("[pm] pm_dice_race_guest_pick failed:", error.message);
    return { error: "숫자를 선택하지 못했어요." };
  }

  return { ok: true as const };
}

export async function diceRaceGuestPoll(input: {
  guestKey: string;
  sessionId: string;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pm_dice_race_guest_poll", {
    p_guest_key: input.guestKey,
    p_session_id: input.sessionId,
  });

  if (error) {
    console.error("[pm] pm_dice_race_guest_poll failed:", error.message);
    return { error: "상태를 불러오지 못했어요." };
  }

  return mapPollRows(firstRows(data) as PollRow[]);
}
