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
import { getStudentRpcCredentialsAction } from "@/app/play/student-rpc-credentials";
import {
  leaveGamePresenceClient,
  pingGamePresenceClient,
} from "@/lib/presence-client";
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
    let sessionToken: string | null = null;
    let stopInterval: (() => void) | null = null;

    const notify = () => {
      void notifyDashboardChanged(classId, contentKey);
    };

    const ping = () => {
      if (cancelled || !sessionToken) return;
      void pingGamePresenceClient({
        sessionToken,
        contentKey,
        phase: "playing",
      }).then(() => {
        if (!sentEnter) {
          sentEnter = true;
          notify();
        }
      });
    };

    void (async () => {
      const creds = await getStudentRpcCredentialsAction();
      if (cancelled) return;
      sessionToken = creds.sessionToken;
      if (!sessionToken) return;
      ping();
      stopInterval = startVisibleInterval(ping, GAME_PRESENCE_PING_MS);
    })();

    return () => {
      cancelled = true;
      stopInterval?.();
      if (sessionToken) {
        void leaveGamePresenceClient({ sessionToken, contentKey });
      }
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
    let sessionToken: string | null = null;
    let stopInterval: (() => void) | null = null;

    const ping = () => {
      if (cancelled || !sessionToken) return;
      void pingGamePresenceClient({
        sessionToken,
        contentKey,
        phase: latest.current.phase,
        liveScore: latest.current.liveScore,
      });
    };

    void (async () => {
      const creds = await getStudentRpcCredentialsAction();
      if (cancelled) return;
      sessionToken = creds.sessionToken;
      if (!sessionToken) return;
      ping();
      stopInterval = startVisibleInterval(ping, GAME_PRESENCE_PING_MS);
    })();

    return () => {
      cancelled = true;
      stopInterval?.();
    };
  }, [enabled, contentKey, phase, liveScore]);

  useEffect(() => {
    if (!enabled || !contentKey || !classId) return;
    void notifyDashboardChanged(classId, contentKey);
  }, [enabled, contentKey, classId, phase, liveScore]);
}
