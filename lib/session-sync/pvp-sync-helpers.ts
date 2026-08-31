"use client";

import {
  notifyDashboardChanged,
  notifyPvpGameChanged,
  notifyPvpQueueChanged,
} from "./broadcast-client";

type PvpJoinResult = {
  gameId: string | null;
  scope: "class" | "global";
  classId: string | null;
};

/** Notify peers and teacher dashboard after queue join or rematch. */
export function notifyPvpJoinResult(
  contentKey: string,
  joined: PvpJoinResult,
): void {
  if (joined.gameId) {
    void notifyPvpGameChanged(joined.gameId);
  } else {
    void notifyPvpQueueChanged(contentKey, joined.scope, joined.classId);
  }
  if (joined.classId) {
    void notifyDashboardChanged(joined.classId, contentKey);
  }
}

/** Notify peers and teacher dashboard after a PvP state mutation. */
export function notifyPvpMutation(
  contentKey: string,
  gameId: string,
  classId?: string | null,
): void {
  void notifyPvpGameChanged(gameId);
  if (classId) {
    void notifyDashboardChanged(classId, contentKey);
  }
}
