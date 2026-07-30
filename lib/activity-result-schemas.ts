/** Common activity details envelope (stored in pm_game_runs.details / pm_activity_sessions.details). */
export type ActivityDetailsV1 = {
  v: 1;
  summary: Record<string, string | number | boolean>;
  items?: Array<Record<string, unknown>>;
};

export function activityDetailsV1(
  summary: ActivityDetailsV1["summary"],
  items?: ActivityDetailsV1["items"],
): ActivityDetailsV1 {
  return { v: 1, summary, items };
}

export function parseActivityDetails(raw: unknown): ActivityDetailsV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (obj.v !== 1) return null;
  if (!obj.summary || typeof obj.summary !== "object") return null;
  const summary = obj.summary as Record<string, string | number | boolean>;
  const items = Array.isArray(obj.items) ? obj.items : undefined;
  return { v: 1, summary, items };
}

/** Per-content-key summary field labels for teacher UI. */
export const SUMMARY_LABELS: Record<string, Record<string, string>> = {
  "g3-u1-radical-fill": {
    correctCount: "정답",
    problemCount: "문제 수",
    totalWrongs: "오답 시도",
    inquirySession: "탐구 수업",
  },
  "g1-u2-2-linear-equation-balance": {
    correctCount: "정답",
    problemCount: "문제 수",
    totalWrongs: "오답 시도",
    inquirySession: "탐구 수업",
  },
  "g1-u1-1-prime-hunt": {
    roundsPlayed: "라운드",
    correctCount: "정답",
    maxStreak: "최대 연속",
  },
  "g1-u1-1-factor-rain": {
    cleared: "클리어 수",
    maxCombo: "최대 콤보",
  },
  "g1-u1-1-knight-prime": {
    tilesVisited: "방문 칸",
    primesFound: "소수 발견",
  },
  "g1-u1-2-sign-slime": {
    stagesCleared: "클리어 단계",
    accuracy: "정확도(%)",
  },
  "g1-u3-1-angle-guess": {
    finalTier: "최종 단계",
    guesses: "시도 횟수",
  },
  "g1-u1-1-sieve-eratosthenes": {
    primesFound: "소수 발견",
    explored: "탐색 완료",
  },
  "g1-u3-3-sector-area-rect": {
    explored: "탐색 완료",
  },
  "g1-u3-4-solid-of-revolution": {
    explored: "탐색 완료",
  },
  "g1-u3-4-pyramid-volume-blocks": {
    explored: "탐색 완료",
  },
  "g2-u1-repeating-decimal": {
    explored: "탐색 완료",
  },
  "g2-u4-dice-simulation": {
    rolls: "굴림 횟수",
    explored: "탐색 완료",
  },
  "g3-u1-irrational-square": {
    completed: "완료 문제",
    total: "전체 문제",
  },
};

export function summaryLabel(contentKey: string, key: string): string {
  return SUMMARY_LABELS[contentKey]?.[key] ?? key;
}

/** PvP content keys → pm_teacher_list_pvp_games table arg */
export const PVP_TABLE_BY_CONTENT: Record<string, "omok" | "quad" | "sq"> = {
  "g1-u2-3-ordered-pair-omok": "omok",
  "g2-u3-1-quadrilateral-maker": "quad",
  "g3-u1-square-maker": "sq",
};

/** Session game content keys → pm_teacher_list_session_players game arg */
export const SESSION_GAME_BY_CONTENT: Record<string, "dice_race" | "ball_box"> =
  {
    "g2-u4-dice-sum-race": "dice_race",
    "g2-u4-ball-box-guess": "ball_box",
  };

export function isPvpContent(contentKey: string): boolean {
  return contentKey in PVP_TABLE_BY_CONTENT;
}

export function isSessionGameContent(contentKey: string): boolean {
  return contentKey in SESSION_GAME_BY_CONTENT;
}
