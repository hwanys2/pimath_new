"use server";

import {
  alkagiCanUseClassQueue,
  alkagiClaimResult,
  alkagiExpandGlobal,
  alkagiForfeitGame,
  alkagiJoinQueue,
  alkagiLeaveQueue,
  alkagiPlaceMove,
  alkagiPoll,
  alkagiTimeoutMove,
} from "@/lib/alkagi-match";
import {
  applyAlkagiRatingFromSession,
  fetchAlkagiRatingRanking,
} from "@/lib/alkagi-rating";
import type { AlkagiOutcome, AlkagiQueueScope, AlkagiShot } from "@/lib/alkagi-types";
import type { RankingScope } from "@/lib/game-types";
import { submitGameRun } from "@/app/adventure/actions";

const CONTENT_KEY = "g2-u2-4-slope-alkagi";

export async function alkagiJoinQueueAction(input: {
  scope: AlkagiQueueScope;
  guestId?: string | null;
}) {
  return alkagiJoinQueue(input);
}

export async function alkagiExpandGlobalAction(input: {
  guestId?: string | null;
}) {
  return alkagiExpandGlobal(input);
}

export async function alkagiLeaveQueueAction(input: {
  guestId?: string | null;
}) {
  return alkagiLeaveQueue(input);
}

export async function alkagiPollAction(input: {
  guestId?: string | null;
  gameId?: string | null;
}) {
  return alkagiPoll(input);
}

export async function alkagiPlaceMoveAction(input: {
  guestId?: string | null;
  gameId: string;
  shot: AlkagiShot;
}) {
  return alkagiPlaceMove(input);
}

export async function alkagiTimeoutMoveAction(input: {
  guestId?: string | null;
  gameId: string;
}) {
  return alkagiTimeoutMove(input);
}

export async function alkagiForfeitGameAction(input: {
  guestId?: string | null;
  gameId: string;
}) {
  return alkagiForfeitGame(input);
}

export async function alkagiClaimResultAction(input: {
  guestId?: string | null;
  gameId: string;
}) {
  return alkagiClaimResult(input);
}

export async function alkagiLobbyContextAction() {
  return alkagiCanUseClassQueue();
}

export async function alkagiFinishWithRatingAction(input: {
  outcome: AlkagiOutcome;
  runScore: number;
}) {
  const rating = await applyAlkagiRatingFromSession({
    outcome: input.outcome,
    runScore: input.runScore,
  });
  if ("error" in rating) {
    return {
      error: rating.error,
      recorded: false,
      practiceOnly: true,
      outcome: input.outcome,
      delta: 0,
      totalBefore: 0,
      totalAfter: 0,
      xp: null as Awaited<ReturnType<typeof submitGameRun>> | null,
    };
  }

  const xpGain = Math.max(0, rating.delta);
  let xp: Awaited<ReturnType<typeof submitGameRun>> | null = null;
  if (xpGain > 0) {
    xp = await submitGameRun({ contentKey: CONTENT_KEY, score: xpGain });
  } else {
    xp = {
      recorded: false,
      practiceOnly: true,
      score: 0,
      message: rating.practiceOnly
        ? undefined
        : "이번 판은 누적 점수만 반영됐어요 (XP 변동 없음).",
    };
  }

  return { ...rating, xp };
}

export async function alkagiFetchRatingRankingAction(input: {
  scope?: RankingScope;
  sessionToken?: string | null;
}) {
  return fetchAlkagiRatingRanking({
    scope: input.scope ?? "class",
    sessionToken: input.sessionToken,
  });
}
