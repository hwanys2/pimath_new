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

/**
 * Auto-heartbeat while a logged-in student is on a game play page.
 * Future games get this for free via PlayBreadcrumb — no per-game wiring.
 */
export default function GamePresenceBeacon() {
  const pathname = usePathname();
  const { actor } = useActor();
  const contentKey = contentKeyFromPlayPath(pathname);
  const content = contentKey ? getContent(contentKey) : undefined;
  const enabled =
    actor?.type === "student" && content?.type === "game" && Boolean(contentKey);

  useEffect(() => {
    if (!enabled || !contentKey) return;

    let cancelled = false;
    const ping = () => {
      if (cancelled) return;
      void pingGamePresence({ contentKey, phase: "playing" });
    };

    ping();
    const timer = window.setInterval(ping, GAME_PRESENCE_PING_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      void leaveGamePresence({ contentKey });
    };
  }, [enabled, contentKey]);

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
    ping();
    const timer = window.setInterval(ping, GAME_PRESENCE_PING_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [enabled, contentKey, phase, liveScore]);
}
