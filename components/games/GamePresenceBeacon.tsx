"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useActor } from "@/components/auth/ActorProvider";
import { getContent } from "@/lib/contents";
import {
  GAME_PRESENCE_PING_MS,
  type GamePresencePhase,
} from "@/lib/game-dashboard-types";
import { contentKeyFromPlayPath } from "@/lib/game-dashboard-view";
import { leaveGamePresence, pingGamePresence } from "@/app/play/presence-actions";
import { notifyDashboardChanged } from "@/lib/session-sync";
import { startVisibleInterval } from "@/lib/visible-interval";

/**
 * Auto-heartbeat while a logged-in student is on a game play page.
 * Future games get this for free via PlayBreadcrumb — no per-game wiring.
 */
export default function GamePresenceBeacon() {
  const pathname = usePathname();
  const { actor } = useActor();
  const contentKey = contentKeyFromPlayPath(pathname);
  const content = contentKey ? getContent(contentKey) : undefined;
  const classId = actor?.type === "student" ? actor.classId : null;
  const enabled =
    actor?.type === "student" && content?.type === "game" && Boolean(contentKey);

  useEffect(() => {
    if (!enabled || !contentKey || !classId) return;

    let cancelled = false;
    let sentEnter = false;

    const notify = () => {
      void notifyDashboardChanged(classId, contentKey);
    };

    const ping = () => {
      if (cancelled) return;
      void pingGamePresence({ contentKey, phase: "playing" }).then(() => {
        if (!sentEnter) {
          sentEnter = true;
          notify();
        }
      });
    };

    ping();
    const stop = startVisibleInterval(ping, GAME_PRESENCE_PING_MS);

    return () => {
      cancelled = true;
      stop();
      void leaveGamePresence({ contentKey });
      notify();
    };
  }, [enabled, contentKey, classId]);

  return null;
}

/**
 * Optional richer ping (live score / phase) for a specific game.
 * The auto beacon already marks the student as playing.
 */
export function useGamePresence(
  contentKey: string,
  input: { phase?: GamePresencePhase; liveScore?: number | null } = {},
) {
  const { actor } = useActor();
  const enabled = actor?.type === "student";
  const classId = actor?.type === "student" ? actor.classId : null;
  const phase = input.phase ?? "playing";
  const liveScore = input.liveScore ?? null;
  const latest = useRef({ phase, liveScore });
  latest.current = { phase, liveScore };

  useEffect(() => {
    if (!enabled || !contentKey) return;
    let cancelled = false;
    const ping = () => {
      if (cancelled) return;
      void pingGamePresence({
        contentKey,
        phase: latest.current.phase,
        liveScore: latest.current.liveScore,
      });
    };
    const stop = startVisibleInterval(ping, GAME_PRESENCE_PING_MS);
    return () => {
      cancelled = true;
      stop();
    };
  }, [enabled, contentKey, phase, liveScore]);

  useEffect(() => {
    if (!enabled || !contentKey || !classId) return;
    void notifyDashboardChanged(classId, contentKey);
  }, [enabled, contentKey, classId, phase, liveScore]);
}
