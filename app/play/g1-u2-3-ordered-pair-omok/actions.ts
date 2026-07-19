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
import type { OmokQueueScope } from "@/lib/omok-types";

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
