"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { RankingRow, RankingScope } from "@/lib/game-types";
import QuadGridBoard from "@/components/games/QuadGridBoard";
import QuadRatingBoard from "@/components/games/QuadRatingBoard";
import {
  quadClaimResultAction,
  quadExpandGlobalAction,
  quadFetchRatingRankingAction,
  quadFinishWithRatingAction,
  quadJoinQueueAction,
  quadLeaveQueueAction,
  quadLobbyContextAction,
  quadPickShapeAction,
  quadPlaceMoveAction,
  quadPollAction,
  quadSubmitRpsAction,
  quadTimeoutMoveAction,
} from "@/app/play/g2-u3-1-quadrilateral-maker/actions";
import type { QuadPollState } from "@/lib/quad-types";
import { QUAD_TURN_SECONDS } from "@/lib/quad-types";
import {
  QUAD_SHAPES,
  SHAPE_LABELS,
  RPS_LABELS,
  boardFromObject,
  boardIsFull,
  chooseAiMove,
  emptyBoard,
  opponent,
  rpsWinner,
  stoneLabel,
  tryPlace,
  type BoardMap,
  type QuadOutcome,
  type QuadShape,
  type RpsChoice,
  type Stone,
} from "@/lib/quadrilateral-maker-math";

const GUEST_KEY = "pm_quad_guest_id";

type Screen =
  | "lobby"
  | "waiting"
  | "rps"
  | "shape_pick"
  | "playing"
  | "ended";
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

function randomRps(): RpsChoice {
  const choices: RpsChoice[] = ["rock", "paper", "scissors"];
  return choices[Math.floor(Math.random() * 3)]!;
}

function randomAiShape(exclude?: QuadShape): QuadShape {
  const pool = exclude
    ? QUAD_SHAPES.filter((s) => s !== exclude)
    : QUAD_SHAPES;
  return pool[Math.floor(Math.random() * pool.length)]!;
}

export default function QuadrilateralMaker() {
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
  const [delta, setDelta] = useState(0);
  const [totalAfter, setTotalAfter] = useState(0);
  const [xpMessage, setXpMessage] = useState<string | null>(null);
  const [practiceOnly, setPracticeOnly] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [turnDeadline, setTurnDeadline] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  const [myShape, setMyShape] = useState<QuadShape | null>(null);
  const [opponentShape, setOpponentShape] = useState<QuadShape | null>(null);
  const [shapePickerRole, setShapePickerRole] = useState<
    "winner" | "loser" | null
  >(null);
  const [myRpsChoice, setMyRpsChoice] = useState<RpsChoice | null>(null);
  const [opponentRpsChoice, setOpponentRpsChoice] = useState<RpsChoice | null>(
    null,
  );
  const [rpsSubmitted, setRpsSubmitted] = useState(false);
  const [takenShape, setTakenShape] = useState<QuadShape | null>(null);

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
  const myShapeRef = useRef<QuadShape | null>(null);
  const opponentShapeRef = useRef<QuadShape | null>(null);

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
    myShapeRef.current = myShape;
  }, [myShape]);
  useEffect(() => {
    opponentShapeRef.current = opponentShape;
  }, [opponentShape]);

  useEffect(() => {
    setGuestId(ensureGuestId());
    void (async () => {
      const ctx = await quadLobbyContextAction();
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
    async (result: QuadOutcome) => {
      if (endingRef.current) return;
      endingRef.current = true;
      stopPoll();
      setOutcome(result);
      setScreen("ended");
      setPlacing(false);
      placingRef.current = false;
      setTurnDeadline(null);
      setSecondsLeft(null);

      const finished = await quadFinishWithRatingAction({ outcome: result });
      if ("error" in finished && finished.error) {
        setStatusMsg(finished.error);
      }
      setDelta(finished.delta);
      setTotalAfter(finished.totalAfter);
      setPracticeOnly(finished.practiceOnly);
      setXpMessage(finished.xp?.message ?? null);

      if (finished.recorded) {
        setRankingLoading(true);
        const rows = await quadFetchRatingRankingAction({ scope: "class" });
        setRanking(rows);
        setRankingScope("class");
        setRankingLoading(false);
      }
    },
    [stopPoll],
  );

  const applyPollState = useCallback((state: QuadPollState) => {
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

    if (state.phase === "shape_pick") {
      setScreen("shape_pick");
      setMode("pvp");
      if (state.gameId) setGameId(state.gameId);
      if (state.opponentName) setOpponentName(state.opponentName);
      setShapePickerRole(state.shapePickerRole);
      setMyShape(state.myShape);
      setOpponentShape(state.opponentShape);
      setTakenShape(state.shapeWhite ?? state.shapeBlack ?? null);
      if (state.shapeWhite && state.gamePhase === "shape_loser") {
        setTakenShape(state.shapeWhite);
      }
      return;
    }

    if (state.phase === "playing" || state.phase === "ended") {
      if (state.myStone) setMyStone(state.myStone);
      if (state.turn) setTurn(state.turn);
      if (state.gameId) setGameId(state.gameId);
      if (state.opponentName) setOpponentName(state.opponentName);
      setBoard(boardFromObject(state.board));
      setMyShape(state.myShape);
      setOpponentShape(state.opponentShape);
      if (state.lastX != null && state.lastY != null) {
        setLastMove({ x: state.lastX, y: state.lastY });
      }
      setTurnDeadline(state.turnDeadline);
      turnDeadlineRef.current = state.turnDeadline;

      if (state.phase === "ended") {
        const result =
          (state.gameStatus
            ? outcomeFromGameStatus(state.gameStatus, state.myStone)
            : null) ??
          (state.myScore === 300
            ? "win"
            : state.myScore === 150
              ? "draw"
              : state.myScore != null
                ? "loss"
                : null);
        if (result) {
          void (async () => {
            if (state.gameId) {
              await quadClaimResultAction({
                guestId: guestIdRef.current,
                gameId: state.gameId!,
              });
            }
            await finishWithOutcome(result);
          })();
        }
        return;
      }

      setScreen("playing");
      setMode("pvp");
    }
  }, [finishWithOutcome]);

  const applyPollPlaying = useCallback(
    (state: QuadPollState) => {
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
      const res = await quadTimeoutMoveAction({
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
        await quadClaimResultAction({
          guestId: guestIdRef.current,
          gameId: gid,
        });
        await finishWithOutcome(res.outcome);
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
          const state = await quadPollAction({
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
    setMyShape(null);
    setOpponentShape(null);
    setShapePickerRole(null);
    setMyRpsChoice(null);
    setOpponentRpsChoice(null);
    setRpsSubmitted(false);
    setTakenShape(null);
    setTurnDeadline(null);
    setSecondsLeft(null);
  };

  const startAiRps = () => {
    endingRef.current = false;
    stopPoll();
    void quadLeaveQueueAction({ guestId: guestIdRef.current });
    resetGameState();
    setMode("ai");
    setMyStone("black");
    setTurn("black");
    setOpponentName("컴퓨터");
    setOutcome(null);
    setDelta(0);
    setXpMessage(null);
    setGameId(null);
    setScreen("rps");
    setStatusMsg("가위바위보를 선택하세요!");
    setRpsSubmitted(false);
  };

  const startMatchmaking = async (scope: "class" | "global") => {
    endingRef.current = false;
    setOutcome(null);
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
    const joined = await quadJoinQueueAction({
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
      const state = await quadPollAction({
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
    const res = await quadExpandGlobalAction({
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
      const state = await quadPollAction({
        guestId: guestIdRef.current,
        gameId: res.gameId,
      });
      if (!("error" in state)) applyPollPlaying(state);
      startPoll(res.gameId);
    }
  };

  const cancelWait = async () => {
    stopPoll();
    await quadLeaveQueueAction({ guestId: guestIdRef.current });
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
      setMyStone(playerIsBlack ? "black" : "white");
      setTurn("black");
      setMyRpsChoice(playerChoice);
      setOpponentRpsChoice(aiChoice);
      if (playerWon) {
        setShapePickerRole("winner");
        setStatusMsg("가위바위보 승리! 먼저 만들 도형을 고르세요.");
      } else {
        setShapePickerRole("loser");
        setStatusMsg("컴퓨터가 도형을 고르는 중…");
        window.setTimeout(() => {
          const aiShape = randomAiShape();
          setTakenShape(aiShape);
          setOpponentShape(aiShape);
          setStatusMsg(
            `컴퓨터: ${SHAPE_LABELS[aiShape]}. 이제 당신이 도형을 고르세요!`,
          );
        }, 500);
      }
      setScreen("shape_pick");
    },
    [],
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
    const res = await quadSubmitRpsAction({
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

  const pickShape = async (shape: QuadShape) => {
    if (mode === "ai") {
      if (shapePickerRole === "winner") {
        setMyShape(shape);
        setTakenShape(shape);
        setShapePickerRole("loser");
        const aiShape = randomAiShape(shape);
        setOpponentShape(aiShape);
        setStatusMsg(
          `내 목표: ${SHAPE_LABELS[shape]} · 컴퓨터: ${SHAPE_LABELS[aiShape]}`,
        );
        setScreen("playing");
        setStatusMsg(
          `${stoneLabel(myStone)}(나) 선공! 격자를 눌러 돌을 두세요.`,
        );
        return;
      }
      if (shapePickerRole === "loser") {
        setMyShape(shape);
        setOpponentShape(takenShape);
        setScreen("playing");
        setStatusMsg(
          `내 목표: ${SHAPE_LABELS[shape]} · 컴퓨터: ${takenShape ? SHAPE_LABELS[takenShape] : "?"}. 흑(선공)부터 시작!`,
        );
        return;
      }
      return;
    }

    if (!gameIdRef.current) return;
    const res = await quadPickShapeAction({
      guestId: guestIdRef.current,
      gameId: gameIdRef.current,
      shape,
    });
    if (!res.ok) {
      setStatusMsg("도형을 선택하지 못했어요.");
      return;
    }
    setStatusMsg("도형을 선택했어요!");
  };

  const placeAt = async (x: number, y: number) => {
    if (screen !== "playing" || placingRef.current) return;
    if (turn !== myStone) {
      setStatusMsg("상대 차례예요.");
      return;
    }
    if (!myShape) return;

    if (mode === "ai") {
      const placed = tryPlace(board, x, y, myStone, myShape);
      if (!placed.ok) {
        setStatusMsg(placed.message);
        return;
      }
      setBoard(placed.board);
      setLastMove({ x, y });
      if (placed.won) {
        void finishWithOutcome("win");
        return;
      }
      if (boardIsFull(placed.board)) {
        void finishWithOutcome("draw");
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
      const res = await quadPlaceMoveAction({
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
        await quadClaimResultAction({
          guestId: guestIdRef.current,
          gameId: gameIdRef.current,
        });
        await finishWithOutcome(res.outcome);
      }
    } finally {
      placingRef.current = false;
      setPlacing(false);
    }
  };

  // AI reply during playing
  useEffect(() => {
    if (screen !== "playing" || mode !== "ai") return;
    if (turn === myStone) return;
    if (aiThinkingRef.current || endingRef.current) return;
    if (!opponentShape || !myShape) return;

    aiThinkingRef.current = true;
    const timer = window.setTimeout(() => {
      const move = chooseAiMove(board, turn, opponentShape, myShape);
      aiThinkingRef.current = false;
      if (!move) {
        void finishWithOutcome("draw");
        return;
      }
      const placed = tryPlace(board, move.x, move.y, turn, opponentShape);
      if (!placed.ok) {
        setTurn(myStone);
        return;
      }
      setBoard(placed.board);
      setLastMove(move);
      setStatusMsg(`컴퓨터가 (${move.x}, ${move.y})에 두었어요.`);
      if (placed.won) {
        void finishWithOutcome("loss");
        return;
      }
      if (boardIsFull(placed.board)) {
        void finishWithOutcome("draw");
        return;
      }
      setTurn(myStone);
    }, 350 + Math.random() * 250);

    return () => {
      window.clearTimeout(timer);
      aiThinkingRef.current = false;
    };
  }, [
    board,
    finishWithOutcome,
    mode,
    myShape,
    myStone,
    opponentShape,
    screen,
    turn,
  ]);

  const reloadRanking = async (scope: RankingScope) => {
    setRankingScope(scope);
    setRankingLoading(true);
    const rows = await quadFetchRatingRankingAction({ scope });
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
    setDelta(0);
    setXpMessage(null);
  };

  const myTurn = screen === "playing" && turn === myStone;
  const availableShapes =
    shapePickerRole === "loser" && takenShape
      ? QUAD_SHAPES.filter((s) => s !== takenShape)
      : QUAD_SHAPES;

  return (
    <div className="space-y-4">
      <header className="quest-card relative overflow-hidden p-5 sm:p-6">
        <div
          className="pointer-events-none absolute inset-0 opacity-80"
          style={{
            background:
              "radial-gradient(ellipse at 10% 0%, #FFB08855, transparent 50%), radial-gradient(ellipse at 90% 20%, #FFD4A844, transparent 45%)",
          }}
        />
        <div className="relative flex flex-wrap items-start gap-4">
          <div className="relative h-16 w-16 shrink-0 sm:h-20 sm:w-20">
            <Image
              src="/images/grade-2-v2.png"
              alt="언덕"
              fill
              className="object-contain"
              sizes="80px"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-wood/55">
              중2 · 3.1 삼각형과 사각형의 성질
            </p>
            <h1 className="font-display text-2xl text-wood sm:text-3xl">
              사각형 만들기
            </h1>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-wood/75">
              가위바위보로 순서를 정하고, 격자에 돌을 두어 먼저 자신의 목표
              사각형을 완성하면 이겨요.
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
                가위바위보 → 도형 선택 → 바로 시작
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

      {screen === "shape_pick" ? (
        <section className="quest-card space-y-4 p-5">
          <h2 className="text-center font-display text-2xl text-wood">
            도형 선택
          </h2>
          <p className="text-center text-sm text-wood/70">
            {shapePickerRole === "winner"
              ? "가위바위보 승자! 먼저 만들 도형을 고르세요."
              : shapePickerRole === "loser"
                ? "패자 차례! 남은 도형 중 하나를 고르세요."
                : "상대가 도형을 고르는 중…"}
          </p>
          {takenShape ? (
            <p className="text-center text-sm font-semibold text-wood">
              이미 선택됨: {SHAPE_LABELS[takenShape]}
            </p>
          ) : null}
          {shapePickerRole ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {availableShapes.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void pickShape(s)}
                  className="rounded-xl bg-gold/50 px-4 py-4 font-bold text-wood transition hover:bg-gold/70"
                >
                  {SHAPE_LABELS[s]}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-center text-sm text-wood/50">잠시만 기다려 주세요…</p>
          )}
          {statusMsg ? (
            <p className="text-center text-sm font-semibold text-wood">
              {statusMsg}
            </p>
          ) : null}
        </section>
      ) : null}

      {screen === "playing" ? (
        <section className="space-y-4">
          <div className="quest-card flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="text-sm font-semibold text-wood">
              <span className="mr-2 rounded-full bg-peach/60 px-2 py-0.5 text-xs">
                {mode === "ai" ? "컴퓨터전" : "대전"}
              </span>
              나: {stoneLabel(myStone)}
              {myShape ? ` · 목표 ${SHAPE_LABELS[myShape]}` : ""}
            </div>
            <div
              className={[
                "rounded-full px-3 py-1 text-sm font-black",
                myTurn ? "bg-gold text-wood" : "bg-wood/10 text-wood/60",
              ].join(" ")}
            >
              {placing
                ? "두는 중…"
                : myTurn
                  ? "내 차례"
                  : "상대 차례"}
              {mode === "pvp" && secondsLeft != null ? (
                <span
                  className={[
                    "ml-2 tabular-nums",
                    secondsLeft <= 5 ? "text-[#c44]" : "",
                  ].join(" ")}
                >
                  {secondsLeft}초
                </span>
              ) : null}
            </div>
          </div>

          {opponentShape ? (
            <p className="text-center text-sm text-wood/60">
              상대 목표: {SHAPE_LABELS[opponentShape]} · {opponentName}
            </p>
          ) : null}

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
            격자 교차점을 눌러 돌을 둡니다. 내 돌 4개가 꼭짓점이 되어 목표
            사각형을 이루면 승리!
            {mode === "pvp" ? (
              <> · 수당 {QUAD_TURN_SECONDS}초, 시간 초과 시 자동 착수</>
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
            {myShape ? (
              <p className="mb-2 text-center text-sm text-wood/60">
                내 목표: {SHAPE_LABELS[myShape]}
                {opponentShape ? (
                  <> · 상대 목표: {SHAPE_LABELS[opponentShape]}</>
                ) : null}
              </p>
            ) : null}
            <div className="pointer-events-none select-none opacity-80 blur-[1px]">
              <div className="quest-card p-3 sm:p-4">
                <QuadGridBoard
                  board={board}
                  lastMove={lastMove}
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
            <QuadRatingBoard
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
