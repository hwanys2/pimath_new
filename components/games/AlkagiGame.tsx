"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RankingRow, RankingScope } from "@/lib/game-types";
import AlkagiBoard from "./AlkagiBoard";
import AlkagiControls from "./AlkagiControls";
import AlkagiSlider from "./AlkagiSlider";
import AlkagiRatingBoard from "./AlkagiRatingBoard";
import {
  alkagiClaimResultAction,
  alkagiExpandGlobalAction,
  alkagiFetchRatingRankingAction,
  alkagiFinishWithRatingAction,
  alkagiForfeitGameAction,
  alkagiJoinQueueAction,
  alkagiLeaveQueueAction,
  alkagiLobbyContextAction,
  alkagiPlaceMoveAction,
  alkagiTimeoutMoveAction,
} from "@/app/play/g2-u2-4-slope-alkagi/actions";
import { alkagiPollClient } from "@/lib/alkagi-client";
import { PVP_POLL_MS, PVP_REMATCH_SECONDS } from "@/lib/pvp-constants";
import {
  notifyPvpJoinResult,
  notifyPvpMutation,
  pvpGameSyncChannelName,
  resolvePvpPollChannel,
  startHybridVisiblePoll,
} from "@/lib/session-sync";
import { isDocumentHidden, startVisibleInterval } from "@/lib/visible-interval";
import type {
  AlkagiOutcome,
  AlkagiPollState,
  AlkagiQueueScope,
  AlkagiShot,
  AlkagiStone,
  AlkagiStoneColor,
} from "@/lib/alkagi-types";
import { ALKAGI_TURN_SECONDS } from "@/lib/alkagi-types";
import {
  chooseAiAlkagiShot,
  createInitialStones,
  opponentColor,
  simulateAlkagiShot,
  type SimulationFrame,
} from "@/lib/alkagi-physics";

const GUEST_KEY = "pm_alkagi_guest_id";
const CONTENT_KEY = "g2-u2-4-slope-alkagi";

type Screen = "lobby" | "waiting" | "playing" | "ended";
type Mode = "ai" | "pvp";

function ensureGuestId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(GUEST_KEY);
  if (!id) {
    id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `g-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(GUEST_KEY, id);
  }
  return id;
}

function outcomeFromGameStatus(
  status: string | null | undefined,
  myColor: AlkagiStoneColor | null,
): AlkagiOutcome | null {
  if (!status || !myColor) return null;
  if (status === "draw") return "draw";
  if (status === "black_win") return myColor === "black" ? "win" : "loss";
  if (status === "white_win") return myColor === "white" ? "win" : "loss";
  return null;
}

export default function AlkagiGame() {
  const [screen, setScreen] = useState<Screen>("lobby");
  const [mode, setMode] = useState<Mode>("ai");
  const [canUseClass, setCanUseClass] = useState(false);
  const [playerName, setPlayerName] = useState<string | null>(null);
  const [queueScope, setQueueScope] = useState<AlkagiQueueScope>("class");
  const [guestId, setGuestId] = useState("");
  const [gameId, setGameId] = useState<string | null>(null);

  // Game state
  const [stones, setStones] = useState<AlkagiStone[]>(() => createInitialStones());
  const [turn, setTurn] = useState<AlkagiStoneColor | null>("black");
  const [myColor, setMyColor] = useState<AlkagiStoneColor>("black");
  const [selectedStoneId, setSelectedStoneId] = useState<string | null>("b2");
  const [slope, setSlope] = useState<number | null>(1);
  const [isVertical, setIsVertical] = useState(false);
  const [animFrames, setAnimFrames] = useState<SimulationFrame[] | null>(null);
  const [animating, setAnimating] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [opponentName, setOpponentName] = useState("컴퓨터");
  const [outcome, setOutcome] = useState<AlkagiOutcome | null>(null);
  const [delta, setDelta] = useState(0);
  const [totalAfter, setTotalAfter] = useState(0);
  const [xpMessage, setXpMessage] = useState<string | null>(null);
  const [practiceOnly, setPracticeOnly] = useState(true);
  const [turnDeadline, setTurnDeadline] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  const [ranking, setRanking] = useState<RankingRow[]>([]);
  const [rankingScope, setRankingScope] = useState<RankingScope>("class");
  const [rankingLoading, setRankingLoading] = useState(false);
  const [requeueSecondsLeft, setRequeueSecondsLeft] = useState<number | null>(null);

  const endingRef = useRef(false);
  const aiThinkingRef = useRef(false);
  const stopVisiblePollRef = useRef<(() => void) | null>(null);
  const pollInFlightRef = useRef(false);
  const placingRef = useRef(false);
  const timeoutInFlightRef = useRef(false);
  const turnDeadlineRef = useRef<string | null>(null);
  const snapshotRef = useRef({
    gameId: null as string | null,
    moveCount: -1,
    turn: null as AlkagiStoneColor | null,
    status: null as string | null,
  });
  const gameIdRef = useRef<string | null>(null);
  const guestIdRef = useRef("");
  const sessionTokenRef = useRef<string | null>(null);
  const myColorRef = useRef<AlkagiStoneColor>("black");
  const modeRef = useRef<Mode>("ai");
  const queueScopeRef = useRef<AlkagiQueueScope>("class");
  const screenRef = useRef<Screen>("lobby");
  const classIdRef = useRef<string | null>(null);
  const pollChannelRef = useRef<string | null>(null);
  const requeueIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pollOnce = useCallback(async (gid?: string | null) => {
    return alkagiPollClient({
      sessionToken: sessionTokenRef.current,
      guestId: guestIdRef.current,
      gameId: gid ?? gameIdRef.current,
    });
  }, []);

  useEffect(() => {
    gameIdRef.current = gameId;
  }, [gameId]);
  useEffect(() => {
    guestIdRef.current = guestId;
  }, [guestId]);
  useEffect(() => {
    myColorRef.current = myColor;
  }, [myColor]);
  useEffect(() => {
    turnDeadlineRef.current = turnDeadline;
  }, [turnDeadline]);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  useEffect(() => {
    queueScopeRef.current = queueScope;
  }, [queueScope]);
  useEffect(() => {
    screenRef.current = screen;
  }, [screen]);

  // Init identity
  useEffect(() => {
    setGuestId(ensureGuestId());
    void (async () => {
      const ctx = await alkagiLobbyContextAction();
      setCanUseClass(ctx.canUseClass);
      setPlayerName(ctx.playerName);
      setQueueScope(ctx.canUseClass ? "class" : "global");
      sessionTokenRef.current = ctx.sessionToken;
      if (ctx.classId) classIdRef.current = ctx.classId;
    })();
  }, []);

  const stopPoll = useCallback(() => {
    stopVisiblePollRef.current?.();
    stopVisiblePollRef.current = null;
    pollInFlightRef.current = false;
  }, []);

  const clearRequeueTimer = useCallback(() => {
    if (requeueIntervalRef.current) {
      clearInterval(requeueIntervalRef.current);
      requeueIntervalRef.current = null;
    }
    setRequeueSecondsLeft(null);
  }, []);

  const finishWithOutcome = useCallback(
    async (result: AlkagiOutcome) => {
      if (endingRef.current) return;
      endingRef.current = true;
      stopPoll();
      setOutcome(result);
      setScreen("ended");

      const runScore = result === "win" ? 300 : result === "draw" ? 150 : 100;

      if (modeRef.current === "pvp") {
        const rating = await alkagiFinishWithRatingAction({
          outcome: result,
          runScore,
        });
        if (!("error" in rating)) {
          setDelta(rating.delta);
          setTotalAfter(rating.totalAfter);
          setPracticeOnly(rating.practiceOnly);
          setXpMessage(rating.xp?.message ?? null);

          if (rating.recorded) {
            setRankingLoading(true);
            const rows = await alkagiFetchRatingRankingAction({
              scope: "class",
              sessionToken: sessionTokenRef.current,
            });
            setRanking(rows);
            setRankingScope("class");
            setRankingLoading(false);
          }
        }
      } else {
        setPracticeOnly(true);
      }
    },
    [stopPoll],
  );

  // Turn timer countdown
  useEffect(() => {
    if (screen !== "playing" || !turnDeadline) {
      setSecondsLeft(null);
      return;
    }
    const updateTime = () => {
      const ms = new Date(turnDeadline).getTime() - Date.now();
      const s = Math.max(0, Math.ceil(ms / 1000));
      setSecondsLeft(s);
      if (
        s === 0 &&
        modeRef.current === "pvp" &&
        turn === myColorRef.current &&
        !timeoutInFlightRef.current &&
        !endingRef.current
      ) {
        timeoutInFlightRef.current = true;
        void (async () => {
          if (!gameIdRef.current) return;
          await alkagiTimeoutMoveAction({
            guestId: guestIdRef.current,
            gameId: gameIdRef.current,
          });
          timeoutInFlightRef.current = false;
        })();
      }
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, [screen, turnDeadline, turn]);

  // Handle Poll States in PvP
  const applyPollPlaying = useCallback(
    (state: AlkagiPollState | { error: string }) => {
      if ("error" in state || endingRef.current) return;

      if (state.phase === "ended") {
        const out = outcomeFromGameStatus(state.gameStatus, myColorRef.current);
        if (out) void finishWithOutcome(out);
        return;
      }

      if (state.phase === "playing") {
        // Did opponent take a shot?
        if (state.moveCount > snapshotRef.current.moveCount && snapshotRef.current.moveCount !== -1) {
          if (state.lastShot && state.lastShot.shooterColor !== myColorRef.current) {
            // Replay opponent shot animation!
            const sim = simulateAlkagiShot(stones, state.lastShot);
            setAnimating(true);
            setAnimFrames(sim.frames);
          } else {
            setStones(state.stones);
          }
        } else if (snapshotRef.current.moveCount === -1) {
          setStones(state.stones);
        }

        setTurn(state.turn);
        setTurnDeadline(state.turnDeadline);
        if (state.opponentName) setOpponentName(state.opponentName);
        if (state.myColor) setMyColor(state.myColor);

        snapshotRef.current = {
          gameId: state.gameId,
          moveCount: state.moveCount,
          turn: state.turn,
          status: state.gameStatus,
        };
      }
    },
    [finishWithOutcome, stones],
  );

  const startPoll = useCallback(
    (gid?: string | null) => {
      stopPoll();
      const pollGameId = gid ?? gameIdRef.current;
      const channel = resolvePvpPollChannel({
        contentKey: CONTENT_KEY,
        gameId: pollGameId,
        queueScope: pollGameId ? null : queueScopeRef.current,
        classId: classIdRef.current,
      });
      pollChannelRef.current = channel;

      const tick = async () => {
        if (endingRef.current || placingRef.current || pollInFlightRef.current) return;
        pollInFlightRef.current = true;
        try {
          const state = await pollOnce(gameIdRef.current ?? pollGameId);
          if (!("error" in state)) {
            if (state.phase === "playing") {
              if (screenRef.current !== "playing") setScreen("playing");
              applyPollPlaying(state);
            } else if (state.phase === "ended") {
              applyPollPlaying(state);
            } else if (state.phase === "waiting") {
              if (screenRef.current !== "waiting") setScreen("waiting");
            }
            if (state.gameId) {
              const nextChannel = pvpGameSyncChannelName(state.gameId);
              if (pollChannelRef.current !== nextChannel) {
                pollChannelRef.current = nextChannel;
                stopVisiblePollRef.current?.();
                stopVisiblePollRef.current = startHybridVisiblePoll(
                  nextChannel,
                  tick,
                  { fallbackMs: PVP_POLL_MS },
                );
              }
            }
          }
        } finally {
          pollInFlightRef.current = false;
        }
      };

      stopVisiblePollRef.current = startHybridVisiblePoll(channel, tick, {
        fallbackMs: PVP_POLL_MS,
      });
    },
    [stopPoll, pollOnce, applyPollPlaying],
  );

  // Auto-select first alive stone for current turn
  useEffect(() => {
    if (!turn) return;
    const isMine = (mode === "ai" && turn === "black") || (mode === "pvp" && turn === myColor);
    if (isMine) {
      const myAlive = stones.filter((s) => s.color === turn && s.alive);
      if (myAlive.length > 0 && (!selectedStoneId || !myAlive.some((s) => s.id === selectedStoneId))) {
        setSelectedStoneId(myAlive[0]!.id);
      }
    }
  }, [turn, stones, myColor, mode, selectedStoneId]);

  // AI Turn Handling
  useEffect(() => {
    if (mode !== "ai" || screen !== "playing" || turn !== "white" || animating || endingRef.current) {
      return;
    }
    if (aiThinkingRef.current) return;
    aiThinkingRef.current = true;
    setStatusMsg("컴퓨터가 조준하고 있습니다...");

    const timer = setTimeout(() => {
      const aiShot = chooseAiAlkagiShot(stones, "white");
      const sim = simulateAlkagiShot(stones, aiShot);

      setStatusMsg("컴퓨터 발사!");
      setAnimating(true);
      setAnimFrames(sim.frames);

      // Animation complete handler will update final state
    }, 700);

    return () => clearTimeout(timer);
  }, [mode, screen, turn, animating, stones]);

  // When animation finishes
  const handleAnimationComplete = useCallback(() => {
    setAnimating(false);
    setAnimFrames(null);
    aiThinkingRef.current = false;

    // Apply simulation outcome
    if (animFrames && animFrames.length > 0) {
      const lastFrame = animFrames[animFrames.length - 1]!;
      const finalStones: AlkagiStone[] = lastFrame.stones.map((fs) => {
        const base = stones.find((s) => s.id === fs.id);
        return {
          id: fs.id,
          color: base?.color ?? "black",
          x: fs.x,
          y: fs.y,
          alive: fs.alive && !fs.falling,
        };
      });
      setStones(finalStones);

      const blackAlive = finalStones.filter((s) => s.color === "black" && s.alive).length;
      const whiteAlive = finalStones.filter((s) => s.color === "white" && s.alive).length;

      let result: AlkagiOutcome | null = null;
      if (blackAlive === 0 && whiteAlive === 0) result = "draw";
      else if (whiteAlive === 0) result = myColorRef.current === "black" ? "win" : "loss";
      else if (blackAlive === 0) result = myColorRef.current === "white" ? "win" : "loss";

      if (result) {
        void finishWithOutcome(result);
      } else {
        // Pass turn in AI mode
        if (modeRef.current === "ai") {
          setTurn((prev) => (prev === "black" ? "white" : "black"));
          setStatusMsg("");
        }
      }
    }
  }, [animFrames, stones, finishWithOutcome]);

  // Shoot button click
  const handleFire = useCallback(
    async (direction: "left" | "right", power: number) => {
      if (animating || endingRef.current) return;
      if (!selectedStoneId) {
        alert("먼저 판에서 발사할 내 바둑알을 클릭하세요!");
        return;
      }

      const shot: AlkagiShot = {
        stoneId: selectedStoneId,
        slope,
        isVertical,
        direction,
        power,
      };

      if (mode === "ai") {
        const sim = simulateAlkagiShot(stones, shot);
        setAnimating(true);
        setAnimFrames(sim.frames);
        return;
      }

      // PvP mode
      if (!gameIdRef.current) return;
      placingRef.current = true;
      try {
        const res = await alkagiPlaceMoveAction({
          guestId: guestIdRef.current,
          gameId: gameIdRef.current,
          shot,
          currentStones: stones,
        });

        if (!res.ok || !res.sim) {
          alert(res.message ?? "수를 둘 수 없어요.");
          return;
        }

        // Animate locally
        setAnimating(true);
        setAnimFrames(res.sim.frames);
        notifyPvpMutation(CONTENT_KEY, gameIdRef.current, classIdRef.current);
      } finally {
        placingRef.current = false;
      }
    },
    [animating, selectedStoneId, slope, isVertical, mode, stones],
  );

  // Matchmaking actions
  const startMatchmaking = async (scope: AlkagiQueueScope) => {
    clearRequeueTimer();
    endingRef.current = false;
    setMode("pvp");
    setQueueScope(scope);
    setScreen("waiting");

    const joined = await alkagiJoinQueueAction({
      scope,
      guestId: guestIdRef.current,
    });

    if ("error" in joined) {
      alert(joined.error);
      setScreen("lobby");
      return;
    }

    notifyPvpJoinResult(CONTENT_KEY, {
      gameId: joined.gameId,
      scope: joined.scope,
      classId: joined.classId,
    });

    if (joined.gameId) {
      setGameId(joined.gameId);
      setScreen("playing");
      startPoll(joined.gameId);
    } else {
      startPoll(null);
    }
  };

  const cancelWait = async () => {
    stopPoll();
    await alkagiLeaveQueueAction({ guestId: guestIdRef.current });
    setScreen("lobby");
  };

  const expandToGlobal = async () => {
    const res = await alkagiExpandGlobalAction({ guestId: guestIdRef.current });
    if ("error" in res) {
      alert(res.error);
      return;
    }
    setQueueScope("global");
    if (res.gameId) {
      setGameId(res.gameId);
      setScreen("playing");
      startPoll(res.gameId);
    }
  };

  const backToLobby = async () => {
    clearRequeueTimer();
    stopPoll();
    if (mode === "pvp") {
      await alkagiLeaveQueueAction({ guestId: guestIdRef.current });
    }
    setScreen("lobby");
    setOutcome(null);
    setStones(createInitialStones());
    setTurn("black");
    setGameId(null);
  };

  const startAiGame = () => {
    clearRequeueTimer();
    stopPoll();
    setMode("ai");
    setMyColor("black");
    setTurn("black");
    setOpponentName("컴퓨터");
    setStones(createInitialStones());
    setSelectedStoneId("b2");
    setSlope(1);
    setIsVertical(false);
    setAnimFrames(null);
    setAnimating(false);
    setOutcome(null);
    endingRef.current = false;
    setScreen("playing");
  };

  // Requeue countdown on ended screen (§7)
  const triggerPvpRequeue = useCallback(async () => {
    clearRequeueTimer();
    await alkagiLeaveQueueAction({ guestId: guestIdRef.current });
    endingRef.current = false;
    setOutcome(null);
    setStones(createInitialStones());
    setAnimFrames(null);
    setAnimating(false);
    setGameId(null);
    await startMatchmaking(queueScopeRef.current);
  }, [clearRequeueTimer]);

  useEffect(() => {
    if (screen !== "ended" || mode !== "pvp") {
      clearRequeueTimer();
      return;
    }
    setRequeueSecondsLeft(PVP_REMATCH_SECONDS);
    requeueIntervalRef.current = setInterval(() => {
      setRequeueSecondsLeft((prev) => {
        if (prev == null || prev <= 1) {
          clearRequeueTimer();
          void triggerPvpRequeue();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearRequeueTimer();
  }, [screen, mode, clearRequeueTimer, triggerPvpRequeue]);

  const selectedStone = stones.find((s) => s.id === selectedStoneId) ?? null;
  const isMyTurn =
    (mode === "ai" && turn === "black") ||
    (mode === "pvp" && turn === myColor);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* 1. LOBBY SCREEN */}
      {screen === "lobby" && (
        <div className="space-y-6">
          <section className="quest-card overflow-hidden bg-gradient-to-br from-amber-50 via-peach/30 to-gold/20 p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="rounded-full bg-amber-500/20 px-3 py-1 text-xs font-black text-amber-900 ring-1 ring-amber-500/30">
                  중2-4 · 일차함수와 그래프
                </span>
                <h1 className="font-display mt-2 text-3xl text-wood sm:text-4xl">
                  기울기 알까기
                </h1>
                <p className="mt-1.5 max-w-xl text-sm text-foreground/75 leading-relaxed">
                  내 바둑알을 지나는 직선의 <strong>기울기</strong>를 조절하고, 좌우 왕복 게이지로 <strong>파워</strong>를 맞춰 상대 바둑알을 좌표평면 밖으로 밀쳐내세요!
                </p>
              </div>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {/* Computer */}
              <button
                type="button"
                onClick={startAiGame}
                className="group flex flex-col items-center justify-center gap-2 rounded-2xl bg-white/90 p-5 shadow-sm ring-1 ring-wood/10 transition-all hover:scale-[1.02] hover:bg-white hover:shadow-md"
              >
                <span className="text-3xl transition-transform group-hover:scale-110">
                  🤖
                </span>
                <span className="font-display text-base text-wood">
                  컴퓨터와 연습
                </span>
                <span className="text-xs text-foreground/60">
                  언제든 바로 플레이 (연습)
                </span>
              </button>

              {/* Class Queue */}
              <button
                type="button"
                disabled={!canUseClass}
                onClick={() => startMatchmaking("class")}
                className={`group flex flex-col items-center justify-center gap-2 rounded-2xl p-5 shadow-sm ring-1 transition-all ${
                  canUseClass
                    ? "bg-amber-500/10 ring-amber-500/30 hover:scale-[1.02] hover:bg-amber-500/20 hover:shadow-md"
                    : "cursor-not-allowed bg-black/5 opacity-50 ring-black/5"
                }`}
              >
                <span className="text-3xl transition-transform group-hover:scale-110">
                  🏫
                </span>
                <span className="font-display text-base text-wood">
                  우리 반 1:1 대전
                </span>
                <span className="text-xs text-foreground/60">
                  {canUseClass ? "같은 반 친구와 매칭" : "학생 로그인 시 가능"}
                </span>
              </button>

              {/* Global Queue */}
              <button
                type="button"
                onClick={() => startMatchmaking("global")}
                className="group flex flex-col items-center justify-center gap-2 rounded-2xl bg-sky-500/10 p-5 shadow-sm ring-1 ring-sky-500/30 transition-all hover:scale-[1.02] hover:bg-sky-500/20 hover:shadow-md"
              >
                <span className="text-3xl transition-transform group-hover:scale-110">
                  🌍
                </span>
                <span className="font-display text-base text-sky-950">
                  전체 1:1 대전
                </span>
                <span className="text-xs text-foreground/60">
                  접속 중인 누구나 매칭
                </span>
              </button>
            </div>
          </section>

          {/* Ranking */}
          <AlkagiRatingBoard
            rows={ranking}
            scope={rankingScope}
            onScopeChange={(s) => {
              setRankingScope(s);
              void (async () => {
                setRankingLoading(true);
                const r = await alkagiFetchRatingRankingAction({
                  scope: s,
                  sessionToken: sessionTokenRef.current,
                });
                setRanking(r);
                setRankingLoading(false);
              })();
            }}
            loading={rankingLoading}
          />
        </div>
      )}

      {/* 2. WAITING SCREEN */}
      {screen === "waiting" && (
        <div className="quest-card flex flex-col items-center justify-center gap-4 bg-white/90 p-10 text-center shadow-sm ring-1 ring-wood/10">
          <div className="h-14 w-14 animate-spin rounded-full border-4 border-wood/20 border-t-amber-600" />
          <h2 className="font-display text-2xl text-wood">
            {queueScope === "class" ? "우리 반 상대를 찾는 중..." : "전체 대기열에서 상대를 찾는 중..."}
          </h2>
          <p className="max-w-md text-xs text-foreground/60">
            직전 상대와는 <strong>{PVP_REMATCH_SECONDS}초간</strong> 다시 매칭되지 않아요.
          </p>

          <div className="mt-4 flex flex-wrap gap-3">
            {queueScope === "class" && (
              <button
                type="button"
                onClick={expandToGlobal}
                className="btn-block rounded-xl bg-sky-500 px-4 py-2 text-xs font-black text-white hover:bg-sky-600"
              >
                전체 대기로 확대
              </button>
            )}
            <button
              type="button"
              onClick={cancelWait}
              className="rounded-xl border border-wood/20 px-4 py-2 text-xs font-bold text-wood hover:bg-wood/5"
            >
              대기 취소
            </button>
          </div>
        </div>
      )}

      {/* 3. PLAYING SCREEN */}
      {screen === "playing" && (
        <div className="space-y-4">
          {/* Header Stats Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/80 px-4 py-3 shadow-sm ring-1 ring-wood/10">
            {/* Black player card */}
            <div
              className={`flex items-center gap-2 rounded-xl px-3 py-1.5 ring-1 ${
                turn === "black"
                  ? "bg-slate-900 text-white ring-slate-800 shadow-sm"
                  : "bg-black/5 text-slate-700 ring-black/5"
              }`}
            >
              <span className="h-4 w-4 rounded-full bg-slate-900 ring-2 ring-white/50" />
              <span className="text-xs font-bold">
                {mode === "ai" ? "나 (흑)" : myColor === "black" ? "나 (흑)" : opponentName}
              </span>
              <span className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-mono font-black">
                {stones.filter((s) => s.color === "black" && s.alive).length}개
              </span>
            </div>

            {/* Turn info & Timer */}
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-3 py-1 text-xs font-black ${
                  isMyTurn
                    ? "bg-amber-500 text-white animate-pulse"
                    : "bg-wood/10 text-wood/80"
                }`}
              >
                {statusMsg || (isMyTurn ? "내 턴!" : "상대방 턴")}
              </span>
              {secondsLeft != null && (
                <span className="font-mono text-xs font-black tabular-nums text-wood">
                  ⏱ {secondsLeft}초
                </span>
              )}
            </div>

            {/* White player card */}
            <div
              className={`flex items-center gap-2 rounded-xl px-3 py-1.5 ring-1 ${
                turn === "white"
                  ? "bg-amber-100 text-amber-950 ring-amber-300 shadow-sm"
                  : "bg-black/5 text-slate-700 ring-black/5"
              }`}
            >
              <span className="h-4 w-4 rounded-full bg-white ring-2 ring-slate-300" />
              <span className="text-xs font-bold">
                {mode === "ai" ? "컴퓨터 (백)" : myColor === "white" ? "나 (백)" : opponentName}
              </span>
              <span className="rounded bg-black/10 px-1.5 py-0.5 text-[10px] font-mono font-black">
                {stones.filter((s) => s.color === "white" && s.alive).length}개
              </span>
            </div>

            {/* Surrender / Back */}
            <button
              type="button"
              onClick={backToLobby}
              className="rounded-lg px-2.5 py-1 text-xs font-bold text-wood/60 hover:bg-wood/10 hover:text-wood"
            >
              로비로
            </button>
          </div>

          {/* Main Play Grid */}
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,1fr)]">
            {/* Left: Coordinate Plane Board */}
            <div>
              <AlkagiBoard
                stones={stones}
                selectedStoneId={selectedStoneId}
                turn={turn}
                myColor={myColor}
                slope={slope}
                isVertical={isVertical}
                disabled={!isMyTurn || animating}
                animFrames={animFrames}
                onSelectStone={(s) => setSelectedStoneId(s.id)}
                onAimSlopeChange={(s, v) => {
                  setSlope(s);
                  setIsVertical(v);
                }}
                onAnimationComplete={handleAnimationComplete}
              />
              <p className="mt-2 text-center text-[11px] text-wood/60">
                💡 보드에서 내 바둑알을 클릭한 뒤 원하는 방향을 누르거나 드래그하면 기울기가 자동 조준됩니다.
              </p>
            </div>

            {/* Right: Controls & Oscillating Slider */}
            <div className="space-y-4">
              <AlkagiControls
                selectedStone={selectedStone}
                slope={slope}
                isVertical={isVertical}
                disabled={!isMyTurn || animating}
                onSelectSlope={(s, v) => {
                  setSlope(s);
                  setIsVertical(v);
                }}
              />

              <AlkagiSlider
                disabled={!isMyTurn || animating}
                isVertical={isVertical}
                onFire={handleFire}
              />
            </div>
          </div>
        </div>
      )}

      {/* 4. ENDED SCREEN (§7 Standard Auto-Requeue) */}
      {screen === "ended" && (
        <div className="quest-card space-y-6 bg-white/95 p-6 text-center shadow-md ring-1 ring-wood/10 sm:p-8">
          <div className="space-y-2">
            <span className="text-5xl">
              {outcome === "win" ? "🏆" : outcome === "draw" ? "🤝" : "💫"}
            </span>
            <h2 className="font-display text-3xl text-wood sm:text-4xl">
              {outcome === "win" ? "승리했습니다!" : outcome === "draw" ? "무승부!" : "아쉽게 패배했습니다"}
            </h2>
            <p className="text-sm text-foreground/70">
              {outcome === "win"
                ? "상대 바둑알을 모두 멋지게 밀쳐냈습니다!"
                : outcome === "draw"
                  ? "양쪽 바둑알이 동시에 모두 장외로 나갔습니다."
                  : "다음 판에는 기울기와 파워를 더 정밀하게 조준해 보세요!"}
            </p>
          </div>

          {mode === "pvp" && (
            <div className="mx-auto max-w-sm rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
              <div className="flex justify-around text-center">
                <div>
                  <span className="text-xs text-foreground/60">획득 점수</span>
                  <p className="font-mono text-xl font-black text-amber-900">
                    +{delta}점
                  </p>
                </div>
                <div className="w-px bg-amber-200" />
                <div>
                  <span className="text-xs text-foreground/60">내 누적 점수</span>
                  <p className="font-mono text-xl font-black text-wood">
                    {totalAfter}점
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* §7 Requeue Countdown & Controls */}
          {mode === "pvp" ? (
            <div className="space-y-3 pt-2">
              {requeueSecondsLeft != null && (
                <div className="space-y-1">
                  <p className="text-sm font-black text-amber-800">
                    {requeueSecondsLeft}초 후 새 상대를 찾아요
                  </p>
                  <p className="text-xs text-foreground/50">
                    직전 상대와는 20초간 다시 매칭되지 않아요
                  </p>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={triggerPvpRequeue}
                  className="btn-block rounded-xl bg-amber-500 px-6 py-2.5 text-sm font-black text-white hover:bg-amber-600 shadow-md"
                >
                  ⚡ 새 상대 즉시 찾기
                </button>
                <button
                  type="button"
                  onClick={startAiGame}
                  className="rounded-xl border border-wood/20 bg-white px-5 py-2.5 text-sm font-bold text-wood hover:bg-wood/5"
                >
                  컴퓨터와 다시
                </button>
                <button
                  type="button"
                  onClick={backToLobby}
                  className="rounded-xl border border-wood/20 bg-white px-5 py-2.5 text-sm font-bold text-wood hover:bg-wood/5"
                >
                  로비로
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={startAiGame}
                className="btn-block rounded-xl bg-amber-500 px-6 py-2.5 text-sm font-black text-white hover:bg-amber-600 shadow-md"
              >
                한 판 더 하기
              </button>
              <button
                type="button"
                onClick={backToLobby}
                className="rounded-xl border border-wood/20 bg-white px-5 py-2.5 text-sm font-bold text-wood hover:bg-wood/5"
              >
                로비로
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
