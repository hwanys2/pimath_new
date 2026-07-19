"use server";

import {
  omokCanUseClassQueue,
  omokClaimResult,
  omokExpandGlobal,
  omokJoinQueue,
  omokLeaveQueue,
  omokPlaceMove,
  omokPoll,
} from "@/lib/omok-match";
import {
  applyOmokRatingFromSession,
  fetchOmokRatingRanking,
} from "@/lib/omok-rating";
import type { OmokQueueScope } from "@/lib/omok-types";
import type { OmokOutcome } from "@/lib/ordered-pair-omok-math";
import type { RankingScope } from "@/lib/game-types";
import { submitGameRun } from "@/app/adventure/actions";

const CONTENT_KEY = "g1-u2-3-ordered-pair-omok";

export async function omokJoinQueueAction(input: {
  scope: OmokQueueScope;
  guestId?: string | null;
}) {
  return omokJoinQueue(input);
}

export async function omokExpandGlobalAction(input: {
  guestId?: string | null;
}) {
  return omokExpandGlobal(input);
}

export async function omokLeaveQueueAction(input: {
  guestId?: string | null;
}) {
  return omokLeaveQueue(input);
}

export async function omokPollAction(input: {
  guestId?: string | null;
  gameId?: string | null;
}) {
  return omokPoll(input);
}

export async function omokPlaceMoveAction(input: {
  guestId?: string | null;
  gameId: string;
  x: number;
  y: number;
}) {
  return omokPlaceMove(input);
}

export async function omokClaimResultAction(input: {
  guestId?: string | null;
  gameId: string;
}) {
  return omokClaimResult(input);
}

export async function omokLobbyContextAction() {
  return omokCanUseClassQueue();
}

/** Apply omok cumulative rating, then XP only for positive delta. */
export async function omokFinishWithRatingAction(input: {
  outcome: OmokOutcome;
}) {
  const rating = await applyOmokRatingFromSession({ outcome: input.outcome });
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

export async function omokFetchRatingRankingAction(input: {
  scope?: RankingScope;
}) {
  return fetchOmokRatingRanking({ scope: input.scope ?? "class" });
}
