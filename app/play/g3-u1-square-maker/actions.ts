"use server";

import {
  sqCanUseClassQueue,
  sqClaimResult,
  sqExpandGlobal,
  sqJoinQueue,
  sqLeaveQueue,
  sqPlaceMove,
  sqPoll,
  sqSubmitRps,
  sqTimeoutMove,
} from "@/lib/sq-match";
import {
  applySqRatingFromSession,
  fetchSqRatingRanking,
} from "@/lib/sq-rating";
import type { SqQueueScope } from "@/lib/sq-types";
import type { QuadOutcome, RpsChoice } from "@/lib/quadrilateral-maker-math";
import type { RankingScope } from "@/lib/game-types";
import { submitGameRun } from "@/app/adventure/actions";

const CONTENT_KEY = "g3-u1-square-maker";

export async function sqJoinQueueAction(input: {
  scope: SqQueueScope;
  guestId?: string | null;
}) {
  return sqJoinQueue(input);
}

export async function sqExpandGlobalAction(input: {
  guestId?: string | null;
}) {
  return sqExpandGlobal(input);
}

export async function sqLeaveQueueAction(input: {
  guestId?: string | null;
}) {
  return sqLeaveQueue(input);
}

export async function sqPollAction(input: {
  guestId?: string | null;
  gameId?: string | null;
}) {
  return sqPoll(input);
}

export async function sqSubmitRpsAction(input: {
  guestId?: string | null;
  gameId: string;
  choice: RpsChoice;
}) {
  return sqSubmitRps(input);
}

export async function sqPlaceMoveAction(input: {
  guestId?: string | null;
  gameId: string;
  x: number;
  y: number;
}) {
  return sqPlaceMove(input);
}

export async function sqTimeoutMoveAction(input: {
  guestId?: string | null;
  gameId: string;
}) {
  return sqTimeoutMove(input);
}

export async function sqClaimResultAction(input: {
  guestId?: string | null;
  gameId: string;
}) {
  return sqClaimResult(input);
}

export async function sqLobbyContextAction() {
  return sqCanUseClassQueue();
}

export async function sqFinishWithRatingAction(input: {
  outcome: QuadOutcome;
}) {
  const rating = await applySqRatingFromSession({ outcome: input.outcome });
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

export async function sqFetchRatingRankingAction(input: {
  scope?: RankingScope;
}) {
  return fetchSqRatingRanking({ scope: input.scope ?? "class" });
}
