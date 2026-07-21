"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { RankingRow, RankingScope } from "@/lib/game-types";
import QuadGridBoard from "@/components/games/QuadGridBoard";
import QuadShapeIcon from "@/components/games/QuadShapeIcon";
import SqRatingBoard from "@/components/games/SqRatingBoard";
import {
  sqClaimResultAction,
  sqExpandGlobalAction,
  sqFetchRatingRankingAction,
  sqFinishWithRatingAction,
  sqJoinQueueAction,
  sqLeaveQueueAction,
  sqLobbyContextAction,
  sqPlaceMoveAction,
  sqPollAction,
  sqSubmitRpsAction,
  sqTimeoutMoveAction,
} from "@/app/play/g3-u1-square-maker/actions";
import type { SqPollState } from "@/lib/sq-types";
import { SQ_TURN_SECONDS } from "@/lib/sq-types";
import {
  findWinningSquare,
  sqRunScore,
  squareTypeLabel,
  tryPlaceSquare,
  type SquareWinInfo,
} from "@/lib/square-maker-math";
import {
  SHAPE_LABELS,
  RPS_LABELS,
  boardFromObject,
  boardIsFull,
  chooseAiMove,
  emptyBoard,
  opponent,
  rpsWinner,
  stoneLabel,
  type BoardMap,
  type QuadOutcome,
  type QuadShape,
  type RpsChoice,
  type Stone,
} from "@/lib/quadrilateral-maker-math";

const GUEST_KEY = "pm_sq_guest_id";
const TARGET_SHAPE: QuadShape = "square";

type Screen = "lobby" | "waiting" | "rps" | "playing" | "ended";
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
  myStone: Stone | null,
): QuadOutcome | null {
  if (!status || !myStone) return null;
  if (status === "draw") return "draw";
  if (status === "black_win") return myStone === "black" ? "win" : "loss";
  if (status === "white_win") return myStone === "white" ? "win" : "loss";
  return null;
}

function outcomeFromMyScore(score: number | null | undefined): QuadOutcome | null {
  if (score == null) return null;
  if (score === 150) return "draw";
  if (score === 100) return "loss";
  if (score === 200 || score === 300) return "win";
  return null;
}

function winnerStoneFromStatus(
  status: string | null | undefined,
): Stone | null {
  if (status === "black_win") return "black";
  if (status === "white_win") return "white";
  return null;
}

function applyWinDisplay(
  board: BoardMap,
  outcome: QuadOutcome,
  gameStatus: string | null | undefined,
  winnerArea: number | null | undefined,
  winnerAxisAligned: boolean | null | undefined,
  winInfo?: SquareWinInfo | null,
): {
  winArea: number | null;
  axisAligned: boolean | null;
  winVertices: SquareWinInfo["vertices"] | null;
} {
  if (winInfo) {
    return {
      winArea: winInfo.area,
      axisAligned: winInfo.axisAligned,
      winVertices: winInfo.vertices,
    };
  }
  const winner = winnerStoneFromStatus(gameStatus);
  if (!winner) {
    return { winArea: null, axisAligned: null, winVertices: null };
  }
  const detected = findWinningSquare(board, winner);
  if (outcome === "win" || outcome === "loss") {
    return {
      winArea: winnerArea ?? detected?.area ?? null,
      axisAligned: winnerAxisAligned ?? detected?.axisAligned ?? null,
      winVertices: detected?.vertices ?? null,
    };
  }
  return { winArea: null, axisAligned: null, winVertices: null };
}

function randomRps(): RpsChoice {
  const choices: RpsChoice[] = ["rock", "paper", "scissors"];
  return choices[Math.floor(Math.random() * 3)]!;
}

function PlayerTargetCard({
  name,
  stone,
  active,
  placing,
  secondsLeft,
  activeLabel,
}: {
  name: string;
  stone: Stone;
  active: boolean;
  placing: boolean;
  secondsLeft: number | null;
  activeLabel: string;
}) {
  return (
    <div
      className={[
        "rounded-2xl p-3 ring-1 transition",
        active
          ? "bg-gold/20 ring-2 ring-gold shadow-sm"
          : "bg-white/40 ring-wood/10 opacity-60",
      ].join(" ")}
    >
      <div className="flex items-center gap-1.5">
        <span
          className="inline-block h-3.5 w-3.5 rounded-full ring-1 ring-wood/30"
          style={{ backgroundColor: stone === "black" ? "#2a2118" : "#f5f0e8" }}
          aria-hidden="true"
        />
        <span className="truncate text-sm font-bold text-wood">{name}</span>
        <span className="ml-auto text-xs font-semibold text-wood/50">
          {stoneLabel(stone)}
        </span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <QuadShapeIcon shape={TARGET_SHAPE} className="h-9 w-12 shrink-0" />
        <span className="font-display text-lg leading-tight text-wood">
          {SHAPE_LABELS[TARGET_SHAPE]}
        </span>
      </div>
      <div className="mt-2 h-6">
        {active ? (
          <span className="inline-flex animate-pulse items-center gap-1 rounded-full bg-gold px-2.5 py-1 text-xs font-black text-wood">
            {placing ? "두는 중…" : `▶ ${activeLabel}`}
            {secondsLeft != null ? (
              <span
                className={[
                  "tabular-nums",
                  secondsLeft <= 5 ? "text-[#c44]" : "",
                ].join(" ")}
              >
                {secondsLeft}초
              </span>
            ) : null}
          </span>
        ) : (
          <span className="text-xs font-semibold text-wood/40">대기 중</span>
        )}
      </div>
    </div>
  );
}

export default function SquareMaker() {
  const [screen, setScreen] = useState<Screen>("lobby");
  const [mode, setMode] = useState<Mode>("ai");
  const [canUseClass, setCanUseClass] = useState(false);
  const [playerName, setPlayerName] = useState<string | null>(null);
  const [queueScope, setQueueScope] = useState<"class" | "global">("class");
  const [guestId, setGuestId] = useState("");
  const [gameId, setGameId] = useState<string | null>(null);

  const [board, setBoard] = useState<BoardMap>(() => emptyBoard());
  const [turn, setTurn] = useState<Stone>("black");
  const [myStone, setMyStone] = useState<Stone>("black");
  const [lastMove, setLastMove] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [statusMsg, setStatusMsg] = useState("");
  const [opponentName, setOpponentName] = useState("컴퓨터");
  const [outcome, setOutcome] = useState<QuadOutcome | null>(null);
  const [runScore, setRunScore] = useState(0);
  const [winArea, setWinArea] = useState<number | null>(null);
  const [axisAligned, setAxisAligned] = useState<boolean | null>(null);
  const [winVertices, setWinVertices] = useState<SquareWinInfo["vertices"] | null>(
    null,
  );
  const [delta, setDelta] = useState(0);
  const [totalAfter, setTotalAfter] = useState(0);
  const [xpMessage, setXpMessage] = useState<string | null>(null);
  const [practiceOnly, setPracticeOnly] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [turnDeadline, setTurnDeadline] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  const [myRpsChoice, setMyRpsChoice] = useState<RpsChoice | null>(null);
  const [opponentRpsChoice, setOpponentRpsChoice] = useState<RpsChoice | null>(
    null,
  );
  const [rpsSubmitted, setRpsSubmitted] = useState(false);

  const [ranking, setRanking] = useState<RankingRow[]>([]);
  const [rankingScope, setRankingScope] = useState<RankingScope>("class");
  const [rankingLoading, setRankingLoading] = useState(false);
  const [waitSeconds, setWaitSeconds] = useState(0);

  const endingRef = useRef(false);
  const aiThinkingRef = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollInFlightRef = useRef(false);
  const placingRef = useRef(false);
  const timeoutInFlightRef = useRef(false);
  const turnDeadlineRef = useRef<string | null>(null);
  const snapshotRef = useRef({
    gameId: null as string | null,
    moveCount: -1,
    turn: null as Stone | null,
    status: null as string | null,
    phase: null as string | null,
  });
  const gameIdRef = useRef<string | null>(null);
  const guestIdRef = useRef("");
  const myStoneRef = useRef<Stone>("black");
  const modeRef = useRef<Mode>("ai");

  useEffect(() => {
    gameIdRef.current = gameId;
  }, [gameId]);
  useEffect(() => {
    guestIdRef.current = guestId;
  }, [guestId]);
  useEffect(() => {
    myStoneRef.current = myStone;
  }, [myStone]);
  useEffect(() => {
    turnDeadlineRef.current = turnDeadline;
  }, [turnDeadline]);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    setGuestId(ensureGuestId());
    void (async () => {
      const ctx = await sqLobbyContextAction();
      setCanUseClass(ctx.canUseClass);
      setPlayerName(ctx.displayName);
      setQueueScope(ctx.canUseClass ? "class" : "global");
    })();
  }, []);

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    pollInFlightRef.current = false;
  }, []);

  const finishWithOutcome = useCallback(
    async (
      result: QuadOutcome,
      score?: number,
      winInfo?: SquareWinInfo | null,
      display?: {
        board?: BoardMap;
        gameStatus?: string | null;
        winnerArea?: number | null;
        winnerAxisAligned?: boolean | null;
      },
    ) => {
      if (endingRef.current) return;
      endingRef.current = true;
      stopPoll();
      setOutcome(result);
      const resolvedScore = score ?? sqRunScore(result, winInfo);
      setRunScore(resolvedScore);
      const displayBoard = display?.board ?? board;
      const winDisplay = applyWinDisplay(
        displayBoard,
        result,
        display?.gameStatus,
        display?.winnerArea,
        display?.winnerAxisAligned,
        winInfo,
      );
      setWinArea(winDisplay.winArea);
      setAxisAligned(winDisplay.axisAligned);
      setWinVertices(winDisplay.winVertices);
      setScreen("ended");
      setPlacing(false);
      placingRef.current = false;
      setTurnDeadline(null);
      setSecondsLeft(null);

      const finished = await sqFinishWithRatingAction({
        outcome: result,
        runScore: resolvedScore,
      });
      if ("error" in finished && finished.error) {
        setStatusMsg(finished.error);
      }
      setDelta(finished.delta);
      setTotalAfter(finished.totalAfter);
      setPracticeOnly(finished.practiceOnly);
      setXpMessage(finished.xp?.message ?? null);

      if (finished.recorded) {
        setRankingLoading(true);
        const rows = await sqFetchRatingRankingAction({ scope: "class" });
        setRanking(rows);
        setRankingScope("class");
        setRankingLoading(false);
      }
    },
    [board, stopPoll],
  );

  const applyPollState = useCallback(
    (state: SqPollState) => {
      if (state.phase === "waiting") {
        setScreen("waiting");
        if (state.queueScope) setQueueScope(state.queueScope);
        return;
      }

      if (state.phase === "rps") {
        setScreen("rps");
        setMode("pvp");
        if (state.gameId) setGameId(state.gameId);
        if (state.opponentName) setOpponentName(state.opponentName);
        setMyRpsChoice(state.myRpsChoice);
        setOpponentRpsChoice(state.opponentRpsChoice);
        setRpsSubmitted(Boolean(state.myRpsChoice));
        return;
      }

      if (state.phase === "playing" || state.phase === "ended") {
        if (state.myStone) setMyStone(state.myStone);
        if (state.turn) setTurn(state.turn);
        if (state.gameId) setGameId(state.gameId);
        if (state.opponentName) setOpponentName(state.opponentName);
        setBoard(boardFromObject(state.board));
        if (state.lastX != null && state.lastY != null) {
          setLastMove({ x: state.lastX, y: state.lastY });
        }
        setTurnDeadline(state.turnDeadline);
        turnDeadlineRef.current = state.turnDeadline;

        if (state.phase === "ended") {
          const result =
            (state.gameStatus
              ? outcomeFromGameStatus(state.gameStatus, state.myStone)
              : null) ?? outcomeFromMyScore(state.myScore);
          if (result) {
            void (async () => {
              if (state.gameId) {
                await sqClaimResultAction({
                  guestId: guestIdRef.current,
                  gameId: state.gameId!,
                });
              }
              const endBoard = boardFromObject(state.board);
              await finishWithOutcome(result, state.myScore ?? undefined, null, {
                board: endBoard,
                gameStatus: state.gameStatus,
                winnerArea: state.winnerArea,
                winnerAxisAligned: state.winnerAxisAligned,
              });
            })();
          }
          return;
        }

        setScreen("playing");
        setMode("pvp");
        setStatusMsg("흑(선공)부터 시작! 격자를 눌러 돌을 두세요.");
      }
    },
    [finishWithOutcome],
  );

  const applyPollPlaying = useCallback(
    (state: SqPollState) => {
      const snap = snapshotRef.current;
      const sameSnapshot =
        state.gameId === snap.gameId &&
        state.moveCount === snap.moveCount &&
        state.turn === snap.turn &&
        state.gameStatus === snap.status &&
        state.phase === snap.phase &&
        state.phase !== "ended" &&
        state.turnDeadline === turnDeadlineRef.current;

      if (sameSnapshot && state.phase === "playing") return;

      snapshotRef.current = {
        gameId: state.gameId,
        moveCount: state.moveCount,
        turn: state.turn,
        status: state.gameStatus,
        phase: state.phase,
      };

      applyPollState(state);
    },
    [applyPollState],
  );

  const applyTimeoutIfNeeded = useCallback(async (): Promise<boolean> => {
    if (modeRef.current !== "pvp") return false;
    if (endingRef.current || placingRef.current || timeoutInFlightRef.current) {
      return false;
    }
    const gid = gameIdRef.current;
    const deadline = turnDeadlineRef.current;
    if (!gid || !deadline) return false;
    if (Date.now() < new Date(deadline).getTime()) return false;

    timeoutInFlightRef.current = true;
    try {
      const res = await sqTimeoutMoveAction({
        guestId: guestIdRef.current,
        gameId: gid,
      });
      if (!res.ok) return false;
      snapshotRef.current = {
        gameId: gid,
        moveCount: res.moveCount,
        turn: res.turn,
        status: res.status,
        phase: res.outcome ? "ended" : "playing",
      };
      setBoard(boardFromObject(res.board));
      setTurn(res.turn);
      setLastMove({ x: res.lastX, y: res.lastY });
      setTurnDeadline(res.turnDeadline);
      turnDeadlineRef.current = res.turnDeadline;
      const who = res.autoStone === myStoneRef.current ? "내" : "상대";
      setStatusMsg(
        `시간 초과! ${who} 차례에 (${res.autoX}, ${res.autoY})에 자동으로 두었어요.`,
      );
      if (res.outcome) {
        await sqClaimResultAction({
          guestId: guestIdRef.current,
          gameId: gid,
        });
        await finishWithOutcome(res.outcome, undefined, null, {
          board: boardFromObject(res.board),
          gameStatus: res.status,
          winnerArea: res.winnerArea,
          winnerAxisAligned: res.winnerAxisAligned,
        });
      }
      return true;
    } finally {
      timeoutInFlightRef.current = false;
    }
  }, [finishWithOutcome]);

  const startPoll = useCallback(
    (gid?: string | null) => {
      stopPoll();
      const tick = async () => {
        if (pollInFlightRef.current || endingRef.current) return;
        if (placingRef.current) return;
        pollInFlightRef.current = true;
        try {
          await applyTimeoutIfNeeded();
          if (endingRef.current) return;
          const state = await sqPollAction({
            guestId: guestIdRef.current,
            gameId: gid ?? gameIdRef.current,
          });
          if ("error" in state) {
            setStatusMsg(`연결 문제: ${state.error}`);
            return;
          }
          setStatusMsg((prev) =>
            prev.startsWith("연결 문제:") ? "" : prev,
          );
          applyPollPlaying(state);
          if (
            state.phase === "playing" &&
            state.turnDeadline &&
            Date.now() >= new Date(state.turnDeadline).getTime()
          ) {
            await applyTimeoutIfNeeded();
          }
        } finally {
          pollInFlightRef.current = false;
        }
      };
      void tick();
      pollRef.current = setInterval(() => void tick(), 1200);
    },
    [applyPollPlaying, applyTimeoutIfNeeded, stopPoll],
  );

  useEffect(() => () => stopPoll(), [stopPoll]);

  useEffect(() => {
    if (screen !== "playing" || mode !== "pvp" || !turnDeadline) {
      setSecondsLeft(null);
      return;
    }
    const tick = () => {
      const left = Math.max(
        0,
        Math.ceil((new Date(turnDeadline).getTime() - Date.now()) / 1000),
      );
      setSecondsLeft(left);
      if (left <= 0 && !timeoutInFlightRef.current && !endingRef.current) {
        void applyTimeoutIfNeeded();
      }
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [applyTimeoutIfNeeded, mode, screen, turnDeadline]);

  useEffect(() => {
    if (screen !== "waiting") {
      setWaitSeconds(0);
      return;
    }
    const t = setInterval(() => setWaitSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [screen]);

  const resetGameState = () => {
    setBoard(emptyBoard());
    setLastMove(null);
    setMyRpsChoice(null);
    setOpponentRpsChoice(null);
    setRpsSubmitted(false);
    setTurnDeadline(null);
    setSecondsLeft(null);
  };

  const startPlayingAfterRps = useCallback((playerIsBlack: boolean) => {
    setMyStone(playerIsBlack ? "black" : "white");
    setTurn("black");
    setBoard(emptyBoard());
    setLastMove(null);
    setScreen("playing");
    setStatusMsg(
      playerIsBlack
        ? "가위바위보 패배 → 흑(선공)! 격자를 눌러 돌을 두세요."
        : "가위바위보 승리 → 백(후공)! 흑부터 시작해요.",
    );
  }, []);

  const startAiRps = () => {
    endingRef.current = false;
    stopPoll();
    void sqLeaveQueueAction({ guestId: guestIdRef.current });
    resetGameState();
    setMode("ai");
    setMyStone("black");
    setTurn("black");
    setOpponentName("컴퓨터");
    setOutcome(null);
    setRunScore(0);
    setWinArea(null);
    setAxisAligned(null);
    setWinVertices(null);
    setDelta(0);
    setXpMessage(null);
    setGameId(null);
    setScreen("rps");
    setStatusMsg("가위바위보를 선택하세요! 패자가 선공(흑)이에요.");
    setRpsSubmitted(false);
  };

  const startMatchmaking = async (scope: "class" | "global") => {
    endingRef.current = false;
    setOutcome(null);
    setRunScore(0);
    setWinArea(null);
    setAxisAligned(null);
    setWinVertices(null);
    setDelta(0);
    setXpMessage(null);
    resetGameState();
    snapshotRef.current = {
      gameId: null,
      moveCount: -1,
      turn: null,
      status: null,
      phase: null,
    };
    const joined = await sqJoinQueueAction({
      scope,
      guestId: guestIdRef.current,
    });
    if ("error" in joined) {
      setStatusMsg(joined.error ?? "대기열에 들어가지 못했어요.");
      return;
    }
    setQueueScope(joined.scope === "class" ? "class" : "global");
    setMode("pvp");
    if (joined.gameId) {
      setGameId(joined.gameId);
      const state = await sqPollAction({
        guestId: guestIdRef.current,
        gameId: joined.gameId,
      });
      if (!("error" in state)) applyPollPlaying(state);
      startPoll(joined.gameId);
    } else {
      setScreen("waiting");
      setStatusMsg(
        joined.scope === "class"
          ? "같은 반 친구를 찾는 중이에요…"
          : "전체에서 상대를 찾는 중이에요…",
      );
      startPoll(null);
    }
  };

  const expandGlobal = async () => {
    const res = await sqExpandGlobalAction({
      guestId: guestIdRef.current,
    });
    if ("error" in res) {
      setStatusMsg(res.error ?? "전체 대기로 바꾸지 못했어요.");
      return;
    }
    setQueueScope("global");
    setStatusMsg("전체로 확대해서 기다리는 중이에요…");
    if (res.gameId) {
      setGameId(res.gameId);
      const state = await sqPollAction({
        guestId: guestIdRef.current,
        gameId: res.gameId,
      });
      if (!("error" in state)) applyPollPlaying(state);
      startPoll(res.gameId);
    }
  };

  const cancelWait = async () => {
    stopPoll();
    await sqLeaveQueueAction({ guestId: guestIdRef.current });
    setScreen("lobby");
    setStatusMsg("");
  };

  const resolveAiRps = useCallback(
    (playerChoice: RpsChoice, aiChoice: RpsChoice) => {
      const result = rpsWinner(playerChoice, aiChoice);
      if (result === "draw") {
        setStatusMsg("비겼어요! 다시 선택하세요.");
        setMyRpsChoice(null);
        setOpponentRpsChoice(null);
        setRpsSubmitted(false);
        return;
      }
      const playerWon = result === "a";
      const playerIsBlack = !playerWon;
      setMyRpsChoice(playerChoice);
      setOpponentRpsChoice(aiChoice);
      startPlayingAfterRps(playerIsBlack);
    },
    [startPlayingAfterRps],
  );

  const submitRps = async (choice: RpsChoice) => {
    if (mode === "ai") {
      if (rpsSubmitted) return;
      setRpsSubmitted(true);
      setMyRpsChoice(choice);
      const aiChoice = randomRps();
      window.setTimeout(() => {
        setOpponentRpsChoice(aiChoice);
        resolveAiRps(choice, aiChoice);
      }, 400);
      return;
    }
    if (!gameIdRef.current) return;
    setRpsSubmitted(true);
    setMyRpsChoice(choice);
    const res = await sqSubmitRpsAction({
      guestId: guestIdRef.current,
      gameId: gameIdRef.current,
      choice,
    });
    if (!res.ok) {
      setRpsSubmitted(false);
      setStatusMsg("제출에 실패했어요.");
      return;
    }
    if (res.rpsTie) {
      setStatusMsg("비겼어요! 다시 선택하세요.");
      setMyRpsChoice(null);
      setRpsSubmitted(false);
    } else {
      setStatusMsg("상대를 기다리는 중…");
    }
  };

  const placeAt = async (x: number, y: number) => {
    if (screen !== "playing" || placingRef.current) return;
    if (turn !== myStone) {
      setStatusMsg("상대 차례예요.");
      return;
    }

    if (mode === "ai") {
      const placed = tryPlaceSquare(board, x, y, myStone);
      if (!placed.ok) {
        setStatusMsg(placed.message);
        return;
      }
      setBoard(placed.board);
      setLastMove({ x, y });
      if (placed.won) {
        void finishWithOutcome(
          "win",
          sqRunScore("win", placed.winInfo),
          placed.winInfo,
          { board: placed.board },
        );
        return;
      }
      if (boardIsFull(placed.board)) {
        void finishWithOutcome("draw", sqRunScore("draw"));
        return;
      }
      setTurn(opponent(myStone));
      setStatusMsg(`(${x}, ${y})에 두었어요!`);
      return;
    }

    if (!gameIdRef.current) return;
    placingRef.current = true;
    setPlacing(true);
    try {
      const res = await sqPlaceMoveAction({
        guestId: guestIdRef.current,
        gameId: gameIdRef.current,
        x,
        y,
      });
      if (!res.ok) {
        setStatusMsg(res.message ?? "둘 수 없어요.");
        return;
      }
      snapshotRef.current = {
        gameId: gameIdRef.current,
        moveCount: res.moveCount,
        turn: res.turn,
        status: res.status,
        phase: res.outcome ? "ended" : "playing",
      };
      setBoard(boardFromObject(res.board));
      setTurn(res.turn);
      setLastMove({ x: res.lastX, y: res.lastY });
      setTurnDeadline(res.turnDeadline);
      turnDeadlineRef.current = res.turnDeadline;
      setStatusMsg(`(${x}, ${y})에 두었어요!`);
      if (res.outcome) {
        await sqClaimResultAction({
          guestId: guestIdRef.current,
          gameId: gameIdRef.current,
        });
        await finishWithOutcome(res.outcome, undefined, null, {
          board: boardFromObject(res.board),
          gameStatus: res.status,
          winnerArea: res.winnerArea,
          winnerAxisAligned: res.winnerAxisAligned,
        });
      }
    } finally {
      placingRef.current = false;
      setPlacing(false);
    }
  };

  useEffect(() => {
    if (screen !== "playing" || mode !== "ai") return;
    if (turn === myStone) return;
    if (aiThinkingRef.current || endingRef.current) return;

    aiThinkingRef.current = true;
    const timer = window.setTimeout(() => {
      const move = chooseAiMove(board, turn, TARGET_SHAPE, TARGET_SHAPE);
      aiThinkingRef.current = false;
      if (!move) {
        void finishWithOutcome("draw", sqRunScore("draw"));
        return;
      }
      const placed = tryPlaceSquare(board, move.x, move.y, turn);
      if (!placed.ok) {
        setTurn(myStone);
        return;
      }
      setBoard(placed.board);
      setLastMove(move);
      setStatusMsg(`컴퓨터가 (${move.x}, ${move.y})에 두었어요.`);
      if (placed.won) {
        void finishWithOutcome(
          "loss",
          sqRunScore("loss"),
          placed.winInfo,
          { board: placed.board, gameStatus: turn === "black" ? "black_win" : "white_win" },
        );
        return;
      }
      if (boardIsFull(placed.board)) {
        void finishWithOutcome("draw", sqRunScore("draw"));
        return;
      }
      setTurn(myStone);
    }, 350 + Math.random() * 250);

    return () => {
      window.clearTimeout(timer);
      aiThinkingRef.current = false;
    };
  }, [board, finishWithOutcome, mode, myStone, screen, turn]);

  const reloadRanking = async (scope: RankingScope) => {
    setRankingScope(scope);
    setRankingLoading(true);
    const rows = await sqFetchRatingRankingAction({ scope });
    setRanking(rows);
    setRankingLoading(false);
  };

  const backToLobby = () => {
    endingRef.current = false;
    stopPoll();
    setScreen("lobby");
    resetGameState();
    setStatusMsg("");
    setOutcome(null);
    setRunScore(0);
    setWinArea(null);
    setAxisAligned(null);
    setWinVertices(null);
    setDelta(0);
    setXpMessage(null);
  };

  const myTurn = screen === "playing" && turn === myStone;

  return (
    <div className="space-y-4">
      <header className="quest-card relative overflow-hidden p-5 sm:p-6">
        <div
          className="pointer-events-none absolute inset-0 opacity-80"
          style={{
            background:
              "radial-gradient(ellipse at 10% 0%, #C4B5FD55, transparent 50%), radial-gradient(ellipse at 90% 20%, #E9D5FF44, transparent 45%)",
          }}
        />
        <div className="relative flex flex-wrap items-start gap-4">
          <div className="relative h-16 w-16 shrink-0 sm:h-20 sm:w-20">
            <Image
              src="/images/grade-3-v2.png"
              alt="별빛"
              fill
              className="object-contain"
              sizes="80px"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-wood/55">
              중3 · 1. 제곱근과 실수
            </p>
            <h1 className="font-display text-2xl text-wood sm:text-3xl">
              정사각형 만들기
            </h1>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-wood/75">
              가위바위보로 선공을 정하고, 격자에 돌을 두어 먼저 정사각형을
              완성하면 이겨요.
            </p>
          </div>
        </div>
      </header>

      {screen === "lobby" ? (
        <section className="quest-card space-y-4 p-5">
          <h2 className="font-display text-xl text-wood">어떻게 둘까요?</h2>
          <p className="text-sm text-wood/70">
            {canUseClass
              ? `${playerName ?? "학생"}님, 같은 반 친구와 먼저 매칭해 볼 수 있어요.`
              : "비로그인·연습 모드에서는 컴퓨터 또는 전체 매칭을 이용해요."}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => startAiRps()}
              className="rounded-2xl bg-peach/70 px-4 py-5 text-left transition hover:bg-peach"
            >
              <p className="font-display text-lg text-wood">컴퓨터와 두기</p>
              <p className="mt-1 text-sm text-wood/70">
                가위바위보 → 선공 정하기 → 바로 시작
              </p>
            </button>
            <button
              type="button"
              onClick={() =>
                void startMatchmaking(canUseClass ? "class" : "global")
              }
              className="rounded-2xl bg-gold/60 px-4 py-5 text-left transition hover:bg-gold/80"
            >
              <p className="font-display text-lg text-wood">
                {canUseClass ? "같은 반과 대전" : "다른 사람과 대전"}
              </p>
              <p className="mt-1 text-sm text-wood/70">
                {canUseClass
                  ? "대기 중이면 전체 확대나 혼자하기를 고를 수 있어요"
                  : "전체 대기열에서 상대를 찾아요"}
              </p>
            </button>
          </div>
          {statusMsg ? (
            <p className="text-sm font-semibold text-[#c44]">{statusMsg}</p>
          ) : null}
        </section>
      ) : null}

      {screen === "waiting" ? (
        <section className="quest-card space-y-4 p-5 text-center">
          <p className="font-display text-2xl text-wood">상대를 찾는 중…</p>
          <p className="text-sm text-wood/70">
            {queueScope === "class" ? "범위: 같은 반" : "범위: 전체"} ·{" "}
            {waitSeconds}초
          </p>
          <div className="flex flex-col gap-2 sm:mx-auto sm:max-w-md">
            {queueScope === "class" ? (
              <button
                type="button"
                onClick={() => void expandGlobal()}
                className="rounded-xl bg-gold/70 px-4 py-3 font-bold text-wood transition hover:bg-gold"
              >
                전체로 확대해서 기다리기
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => startAiRps()}
              className="rounded-xl bg-peach/70 px-4 py-3 font-bold text-wood transition hover:bg-peach"
            >
              혼자하기 (컴퓨터와 두기)
            </button>
            <button
              type="button"
              onClick={() => void cancelWait()}
              className="rounded-xl bg-white/70 px-4 py-2 text-sm font-semibold text-wood/70 ring-1 ring-wood/15"
            >
              대기 취소
            </button>
          </div>
        </section>
      ) : null}

      {screen === "rps" ? (
        <section className="quest-card space-y-4 p-5 text-center">
          <h2 className="font-display text-2xl text-wood">가위바위보</h2>
          <p className="text-sm text-wood/70">
            {mode === "pvp" ? `상대: ${opponentName}` : "컴퓨터와 가위바위보"}
            <br />
            패자가 선공(흑)이에요!
          </p>
          {myRpsChoice ? (
            <p className="text-sm font-semibold text-wood">
              내 선택: {RPS_LABELS[myRpsChoice]}
              {opponentRpsChoice
                ? ` · 상대: ${RPS_LABELS[opponentRpsChoice]}`
                : " · 상대 대기 중…"}
            </p>
          ) : null}
          <div className="flex flex-wrap justify-center gap-3">
            {(["rock", "paper", "scissors"] as RpsChoice[]).map((c) => (
              <button
                key={c}
                type="button"
                disabled={rpsSubmitted}
                onClick={() => void submitRps(c)}
                className="rounded-2xl bg-peach/60 px-6 py-4 font-display text-lg text-wood transition hover:bg-peach disabled:opacity-50"
              >
                {RPS_LABELS[c]}
              </button>
            ))}
          </div>
          {statusMsg ? (
            <p className="text-sm font-semibold text-wood">{statusMsg}</p>
          ) : null}
        </section>
      ) : null}

      {screen === "playing" ? (
        <section className="space-y-4">
          <div className="quest-card p-3 sm:p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="rounded-full bg-peach/60 px-2 py-0.5 text-xs font-semibold text-wood">
                {mode === "ai" ? "컴퓨터전" : "대전"}
              </span>
              <span className="text-xs font-semibold text-wood/50">
                목표: 정사각형 · 차례
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <PlayerTargetCard
                name="나"
                stone={myStone}
                active={myTurn}
                placing={placing && myTurn}
                secondsLeft={
                  mode === "pvp" && myTurn ? secondsLeft : null
                }
                activeLabel="내 차례"
              />
              <PlayerTargetCard
                name={mode === "ai" ? "컴퓨터" : opponentName}
                stone={opponent(myStone)}
                active={!myTurn}
                placing={placing && !myTurn}
                secondsLeft={
                  mode === "pvp" && !myTurn ? secondsLeft : null
                }
                activeLabel="상대 차례"
              />
            </div>
          </div>

          {statusMsg ? (
            <p
              className="rounded-xl bg-white/60 px-3 py-2 text-center text-sm font-semibold text-wood ring-1 ring-wood/10"
              role="status"
            >
              {statusMsg}
            </p>
          ) : null}

          <div className="quest-card p-3 sm:p-4">
            <QuadGridBoard
              board={board}
              lastMove={lastMove}
              onCellClick={(x, y) => void placeAt(x, y)}
              disabled={!myTurn || placing}
            />
          </div>

          <p className="text-center text-xs text-wood/50">
            격자 교차점을 눌러 돌을 둡니다. 내 돌 4개가 꼭짓점이 되어
            정사각형을 이루면 승리!
            {mode === "pvp" ? (
              <> · 수당 {SQ_TURN_SECONDS}초, 시간 초과 시 자동 착수</>
            ) : null}
          </p>
        </section>
      ) : null}

      {screen === "ended" ? (
        <section className="quest-card space-y-4 p-5">
          <div>
            <p className="mb-2 text-center text-xs font-semibold text-wood/50">
              최종 판
            </p>
            <div className="mb-2 flex justify-center">
              <span className="inline-flex items-center gap-1 text-sm text-wood/70">
                <QuadShapeIcon
                  shape={TARGET_SHAPE}
                  className="h-6 w-8 shrink-0"
                />
                목표: {SHAPE_LABELS[TARGET_SHAPE]}
              </span>
            </div>
            <div className="pointer-events-none select-none">
              <div className="quest-card p-3 sm:p-4">
                <QuadGridBoard
                  board={board}
                  lastMove={lastMove}
                  highlightPoints={winVertices ?? undefined}
                  onCellClick={() => {}}
                  disabled
                />
              </div>
            </div>
          </div>

          <div className="text-center">
            <p className="font-display text-3xl text-wood">
              {outcome === "win"
                ? "승리!"
                : outcome === "draw"
                  ? "무승부"
                  : "아쉬운 패배"}
            </p>
            {winArea != null && outcome !== "draw" ? (
              <p className="mt-2 text-base font-semibold text-wood/80">
                {outcome === "win" ? "정사각형 넓이" : "상대 정사각형 넓이"}:{" "}
                <span className="font-black tabular-nums">{winArea}</span>
              </p>
            ) : null}
            {outcome === "win" && axisAligned != null ? (
              <p className="mt-1 text-sm font-semibold text-violet-700">
                {squareTypeLabel(axisAligned)} · +{runScore}점
              </p>
            ) : null}
            <p className="mt-2 text-lg font-black tabular-nums text-wood">
              {delta >= 0 ? "+" : ""}
              {delta}점
              <span className="ml-2 text-sm font-semibold text-wood/55">
                누적 {totalAfter}점
              </span>
            </p>
            {practiceOnly ? (
              <p className="mt-2 text-sm text-wood/60">
                연습 모드 — 학급에 배정·활성화되면 누적 랭킹과 XP에 반영돼요.
              </p>
            ) : null}
            {xpMessage ? (
              <p className="mt-1 text-sm font-semibold text-wood">
                {xpMessage}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={backToLobby}
              className="rounded-xl bg-wood px-5 py-2.5 font-display text-[#FEF9F0]"
            >
              로비로
            </button>
            <button
              type="button"
              onClick={() => startAiRps()}
              className="rounded-xl bg-peach/80 px-5 py-2.5 font-bold text-wood"
            >
              컴퓨터와 다시
            </button>
          </div>

          {!practiceOnly ? (
            <SqRatingBoard
              rows={ranking}
              scope={rankingScope}
              loading={rankingLoading}
              myTotal={totalAfter}
              onScopeChange={(s) => void reloadRanking(s)}
            />
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
