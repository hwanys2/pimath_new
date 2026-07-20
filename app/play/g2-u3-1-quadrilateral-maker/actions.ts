"use server";

import {
  quadCanUseClassQueue,
  quadClaimResult,
  quadExpandGlobal,
  quadJoinQueue,
  quadLeaveQueue,
  quadPickShape,
  quadPlaceMove,
  quadPoll,
  quadSubmitRps,
  quadTimeoutMove,
} from "@/lib/quad-match";
import {
  applyQuadRatingFromSession,
  fetchQuadRatingRanking,
} from "@/lib/quad-rating";
import type { QuadQueueScope } from "@/lib/quad-types";
import type { QuadOutcome, QuadShape, RpsChoice } from "@/lib/quadrilateral-maker-math";
import type { RankingScope } from "@/lib/game-types";
import { submitGameRun } from "@/app/adventure/actions";

const CONTENT_KEY = "g2-u3-1-quadrilateral-maker";

export async function quadJoinQueueAction(input: {
  scope: QuadQueueScope;
  guestId?: string | null;
}) {
  return quadJoinQueue(input);
}

export async function quadExpandGlobalAction(input: {
  guestId?: string | null;
}) {
  return quadExpandGlobal(input);
}

export async function quadLeaveQueueAction(input: {
  guestId?: string | null;
}) {
  return quadLeaveQueue(input);
}

export async function quadPollAction(input: {
  guestId?: string | null;
  gameId?: string | null;
}) {
  return quadPoll(input);
}

export async function quadSubmitRpsAction(input: {
  guestId?: string | null;
  gameId: string;
  choice: RpsChoice;
}) {
  return quadSubmitRps(input);
}

export async function quadPickShapeAction(input: {
  guestId?: string | null;
  gameId: string;
  shape: QuadShape;
}) {
  return quadPickShape(input);
}

export async function quadPlaceMoveAction(input: {
  guestId?: string | null;
  gameId: string;
  x: number;
  y: number;
}) {
  return quadPlaceMove(input);
}

export async function quadTimeoutMoveAction(input: {
  guestId?: string | null;
  gameId: string;
}) {
  return quadTimeoutMove(input);
}

export async function quadClaimResultAction(input: {
  guestId?: string | null;
  gameId: string;
}) {
  return quadClaimResult(input);
}

export async function quadLobbyContextAction() {
  return quadCanUseClassQueue();
}

export async function quadFinishWithRatingAction(input: {
  outcome: QuadOutcome;
}) {
  const rating = await applyQuadRatingFromSession({ outcome: input.outcome });
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

export async function quadFetchRatingRankingAction(input: {
  scope?: RankingScope;
}) {
  return fetchQuadRatingRanking({ scope: input.scope ?? "class" });
}
