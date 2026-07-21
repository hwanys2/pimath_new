"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { RankingRow, RankingScope } from "@/lib/game-types";
import CoordinatePlaneBoard from "@/components/games/CoordinatePlaneBoard";
import OrderedPairPad from "@/components/games/OrderedPairPad";
import OmokRatingBoard from "@/components/games/OmokRatingBoard";
import {
  omokClaimResultAction,
  omokExpandGlobalAction,
  omokFetchRatingRankingAction,
  omokFinishWithRatingAction,
  omokJoinQueueAction,
  omokLeaveQueueAction,
  omokLobbyContextAction,
  omokPlaceMoveAction,
  omokPollAction,
  omokTimeoutMoveAction,
} from "@/app/play/g1-u2-3-ordered-pair-omok/actions";
import type { OmokPollState } from "@/lib/omok-types";
import { OMOK_TURN_SECONDS } from "@/lib/omok-types";
import {
  boardFromObject,
  boardIsFull,
  chooseAiMove,
  emptyBoard,
  formatPair,
  stoneLabel,
  tryPlace,
  type BoardMap,
  type OmokOutcome,
  type Stone,
} from "@/lib/ordered-pair-omok-math";

const GUEST_KEY = "pm_omok_guest_id";

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
  myStone: Stone | null,
): OmokOutcome | null {
  if (!status || !myStone) return null;
  if (status === "draw") return "draw";
  if (status === "black_win") return myStone === "black" ? "win" : "loss";
  if (status === "white_win") return myStone === "white" ? "win" : "loss";
  return null;
}

export default function OrderedPairOmok() {
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
  const [padX, setPadX] = useState<number | null>(null);
  const [padY, setPadY] = useState<number | null>(null);
  const [statusMsg, setStatusMsg] = useState("");
  const [opponentName, setOpponentName] = useState("컴퓨터");
  const [outcome, setOutcome] = useState<OmokOutcome | null>(null);
  const [delta, setDelta] = useState(0);
  const [totalAfter, setTotalAfter] = useState(0);
  const [xpMessage, setXpMessage] = useState<string | null>(null);
  const [practiceOnly, setPracticeOnly] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [turnDeadline, setTurnDeadline] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

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
      const ctx = await omokLobbyContextAction();
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
    async (result: OmokOutcome) => {
      if (endingRef.current) return;
      endingRef.current = true;
      stopPoll();
      setOutcome(result);
      setScreen("ended");
      setPlacing(false);
      placingRef.current = false;
      setTurnDeadline(null);
      setSecondsLeft(null);

      const finished = await omokFinishWithRatingAction({ outcome: result });
      if ("error" in finished && finished.error) {
        setStatusMsg(finished.error);
      }
      setDelta(finished.delta);
      setTotalAfter(finished.totalAfter);
      setPracticeOnly(finished.practiceOnly);
      setXpMessage(finished.xp?.message ?? null);

      if (finished.recorded) {
        setRankingLoading(true);
        const rows = await omokFetchRatingRankingAction({ scope: "class" });
        setRanking(rows);
        setRankingScope("class");
        setRankingLoading(false);
      }
    },
    [stopPoll],
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
      const res = await omokTimeoutMoveAction({
        guestId: guestIdRef.current,
        gameId: gid,
      });
      if (!res.ok) {
        if (res.error !== "not_expired") {
          // ignore race; next poll retries
        }
        return false;
      }
      snapshotRef.current = {
        gameId: gid,
        moveCount: res.moveCount,
        turn: res.turn,
        status: res.status,
      };
      setBoard(boardFromObject(res.board));
      setTurn(res.turn);
      setLastMove({ x: res.lastX, y: res.lastY });
      setTurnDeadline(res.turnDeadline);
      turnDeadlineRef.current = res.turnDeadline;
      const who =
        res.autoStone === myStoneRef.current ? "내" : "상대";
      setStatusMsg(
        `시간 초과! ${who} 차례에 ${formatPair(res.autoX, res.autoY)}가 자동으로 두어졌어요.`,
      );
      if (res.outcome) {
        await omokClaimResultAction({
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

  const applyPollPlaying = useCallback(
    (state: OmokPollState) => {
      const snap = snapshotRef.current;
      const sameSnapshot =
        state.gameId === snap.gameId &&
        state.moveCount === snap.moveCount &&
        state.turn === snap.turn &&
        state.gameStatus === snap.status &&
        state.phase !== "ended" &&
        state.turnDeadline === turnDeadlineRef.current;

      if (sameSnapshot && state.phase === "playing") {
        return;
      }

      if (
        state.phase === "playing" &&
        snap.gameId &&
        state.gameId === snap.gameId &&
        state.moveCount < snap.moveCount
      ) {
        return;
      }

      snapshotRef.current = {
        gameId: state.gameId,
        moveCount: state.moveCount,
        turn: state.turn,
        status: state.gameStatus,
      };

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
              await omokClaimResultAction({
                guestId: guestIdRef.current,
                gameId: state.gameId,
              });
            }
            await finishWithOutcome(result);
          })();
        }
        return;
      }

      if (state.phase === "playing") {
        setBoard(boardFromObject(state.board));
        if (state.turn) setTurn(state.turn);
        if (state.myStone) setMyStone(state.myStone);
        if (state.gameId) setGameId(state.gameId);
        if (state.opponentName) setOpponentName(state.opponentName);
        if (state.lastX != null && state.lastY != null) {
          setLastMove({ x: state.lastX, y: state.lastY });
        }
        setTurnDeadline(state.turnDeadline);
        turnDeadlineRef.current = state.turnDeadline;
        setScreen("playing");
        setMode("pvp");
        return;
      }

      if (state.phase === "waiting") {
        setScreen("waiting");
        if (state.queueScope) setQueueScope(state.queueScope);
      }
    },
    [finishWithOutcome],
  );

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
          const state = await omokPollAction({
            guestId: guestIdRef.current,
            gameId: gid ?? gameIdRef.current,
          });
          if ("error" in state) {
            setStatusMsg(
              typeof state.error === "string" && state.error.trim()
                ? `연결 문제: ${state.error}`
                : "연결 문제: 대국 상태를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.",
            );
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
      pollRef.current = setInterval(() => {
        void tick();
      }, 1200);
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

  const resetPad = () => {
    setPadX(null);
    setPadY(null);
  };

  const startAiGame = async () => {
    endingRef.current = false;
    stopPoll();
    await omokLeaveQueueAction({ guestId: guestIdRef.current });
    snapshotRef.current = {
      gameId: null,
      moveCount: -1,
      turn: null,
      status: null,
    };
    setMode("ai");
    setBoard(emptyBoard());
    setTurn("black");
    setMyStone("black");
    setOpponentName("컴퓨터");
    setLastMove(null);
    setStatusMsg("당신은 흑(선공)이에요. 순서쌍으로 첫 수를 두세요!");
    setOutcome(null);
    setDelta(0);
    setXpMessage(null);
    setGameId(null);
    resetPad();
    setScreen("playing");
  };

  const startMatchmaking = async (scope: "class" | "global") => {
    endingRef.current = false;
    setOutcome(null);
    setDelta(0);
    setXpMessage(null);
    snapshotRef.current = {
      gameId: null,
      moveCount: -1,
      turn: null,
      status: null,
    };
    const joined = await omokJoinQueueAction({
      scope,
      guestId: guestIdRef.current,
    });
    if ("error" in joined) {
      setStatusMsg(joined.error);
      return;
    }
    setQueueScope(joined.scope);
    setMode("pvp");
    if (joined.gameId) {
      setGameId(joined.gameId);
      const state = await omokPollAction({
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
    const res = await omokExpandGlobalAction({
      guestId: guestIdRef.current,
    });
    if ("error" in res) {
      setStatusMsg(res.error);
      return;
    }
    setQueueScope("global");
    setStatusMsg("전체로 확대해서 기다리는 중이에요…");
    if (res.gameId) {
      setGameId(res.gameId);
      const state = await omokPollAction({
        guestId: guestIdRef.current,
        gameId: res.gameId,
      });
      if (!("error" in state)) applyPollPlaying(state);
      startPoll(res.gameId);
    }
  };

  const cancelWait = async () => {
    stopPoll();
    await omokLeaveQueueAction({ guestId: guestIdRef.current });
    setScreen("lobby");
    setStatusMsg("");
  };

  // AI reply
  useEffect(() => {
    if (screen !== "playing" || mode !== "ai") return;
    if (turn !== "white") return;
    if (aiThinkingRef.current || endingRef.current) return;

    aiThinkingRef.current = true;
    const timer = window.setTimeout(() => {
      const move = chooseAiMove(board, "white");
      aiThinkingRef.current = false;
      if (!move) {
        void finishWithOutcome("draw");
        return;
      }
      const placed = tryPlace(board, move.x, move.y, "white");
      if (!placed.ok) {
        setStatusMsg(placed.message);
        setTurn("black");
        return;
      }
      setBoard(placed.board);
      setLastMove(move);
      setStatusMsg(`컴퓨터가 ${formatPair(move.x, move.y)}에 두었어요.`);
      if (placed.won) {
        void finishWithOutcome("loss");
        return;
      }
      if (boardIsFull(placed.board)) {
        void finishWithOutcome("draw");
        return;
      }
      setTurn("black");
    }, 380 + Math.random() * 280);

    return () => {
      window.clearTimeout(timer);
      aiThinkingRef.current = false;
    };
  }, [board, finishWithOutcome, mode, screen, turn]);

  const placeHuman = async () => {
    if (padX === null || padY === null) return;
    if (screen !== "playing") return;
    if (placingRef.current) return;

    if (mode === "ai") {
      if (turn !== myStone) {
        setStatusMsg("컴퓨터 차례예요. 잠시만 기다려 주세요.");
        return;
      }
      const placed = tryPlace(board, padX, padY, myStone);
      if (!placed.ok) {
        setStatusMsg(placed.message);
        return;
      }
      setBoard(placed.board);
      setLastMove({ x: padX, y: padY });
      setStatusMsg(`${formatPair(padX, padY)}에 두었어요!`);
      resetPad();
      if (placed.won) {
        void finishWithOutcome("win");
        return;
      }
      if (boardIsFull(placed.board)) {
        void finishWithOutcome("draw");
        return;
      }
      setTurn("white");
      return;
    }

    // PvP
    if (!gameIdRef.current) return;
    if (turn !== myStone) {
      setStatusMsg("상대 차례예요. 순서쌍을 입력하기 전에 기다려 주세요.");
      return;
    }

    placingRef.current = true;
    setPlacing(true);
    try {
      const res = await omokPlaceMoveAction({
        guestId: guestIdRef.current,
        gameId: gameIdRef.current,
        x: padX,
        y: padY,
      });
      if (!res.ok) {
        setStatusMsg(res.message ?? "둘 수 없어요.");
        if (res.error === "not_your_turn" || res.error === "game_over") {
          const state = await omokPollAction({
            guestId: guestIdRef.current,
            gameId: gameIdRef.current,
          });
          if (!("error" in state)) applyPollPlaying(state);
        }
        return;
      }
      snapshotRef.current = {
        gameId: gameIdRef.current,
        moveCount: res.moveCount,
        turn: res.turn,
        status: res.status,
      };
      setBoard(boardFromObject(res.board));
      setTurn(res.turn);
      setLastMove({ x: res.lastX, y: res.lastY });
      setTurnDeadline(res.turnDeadline);
      turnDeadlineRef.current = res.turnDeadline;
      setStatusMsg(`${formatPair(padX, padY)}에 두었어요!`);
      resetPad();
      if (res.outcome) {
        await omokClaimResultAction({
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

  const reloadRanking = async (scope: RankingScope) => {
    setRankingScope(scope);
    setRankingLoading(true);
    const rows = await omokFetchRatingRankingAction({ scope });
    setRanking(rows);
    setRankingLoading(false);
  };

  const backToLobby = () => {
    endingRef.current = false;
    stopPoll();
    setScreen("lobby");
    setBoard(emptyBoard());
    setStatusMsg("");
    setOutcome(null);
    setDelta(0);
    setXpMessage(null);
    resetPad();
  };

  const myTurn = screen === "playing" && turn === myStone;
  const padDisabled = !myTurn || placing;

  return (
    <div className="space-y-4">
      <header className="quest-card relative overflow-hidden p-5 sm:p-6">
        <div
          className="pointer-events-none absolute inset-0 opacity-80"
          style={{
            background:
              "radial-gradient(ellipse at 10% 0%, #9DE8C855, transparent 50%), radial-gradient(ellipse at 90% 20%, #A8D8FF44, transparent 45%)",
          }}
        />
        <div className="relative flex flex-wrap items-start gap-4">
          <div className="relative h-16 w-16 shrink-0 sm:h-20 sm:w-20">
            <Image
              src="/images/grade-1-v2.png"
              alt="초원"
              fill
              className="object-contain"
              sizes="80px"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-wood/55">
              중1 · 2.3 좌표평면과 그래프
            </p>
            <h1 className="font-display text-2xl text-wood sm:text-3xl">
              순서쌍 오목
            </h1>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-wood/75">
              판을 누르지 말고, 순서쌍{" "}
              <span className="font-bold text-wood">(x, y)</span>만으로 오목을
              두며 좌표를 익혀요. 흑은 쌍삼(3×3) 금수가 있어요.
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
              onClick={() => void startAiGame()}
              className="rounded-2xl bg-mint/70 px-4 py-5 text-left transition hover:bg-mint"
            >
              <p className="font-display text-lg text-wood">컴퓨터와 두기</p>
              <p className="mt-1 text-sm text-wood/70">
                중급 AI · 바로 시작 · 누적 점수 반영
              </p>
            </button>
            <button
              type="button"
              onClick={() =>
                void startMatchmaking(canUseClass ? "class" : "global")
              }
              className="rounded-2xl bg-sky/60 px-4 py-5 text-left transition hover:bg-sky/80"
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
                className="rounded-xl bg-sky/70 px-4 py-3 font-bold text-wood transition hover:bg-sky"
              >
                전체로 확대해서 기다리기
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void startAiGame()}
              className="rounded-xl bg-gold/70 px-4 py-3 font-bold text-wood transition hover:bg-gold"
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

      {screen === "playing" ? (
        <section className="space-y-4">
          <div className="quest-card flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="text-sm font-semibold text-wood">
              <span className="mr-2 rounded-full bg-mint/60 px-2 py-0.5 text-xs">
                {mode === "ai" ? "컴퓨터전" : "대전"}
              </span>
              나: {stoneLabel(myStone)} · 상대: {opponentName}
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
                  ? "내 차례 · 순서쌍을 입력하세요"
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

          {statusMsg ? (
            <p
              className="rounded-xl bg-white/60 px-3 py-2 text-center text-sm font-semibold text-wood ring-1 ring-wood/10"
              role="status"
            >
              {statusMsg}
            </p>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="quest-card p-3 sm:p-4">
              <CoordinatePlaneBoard board={board} lastMove={lastMove} />
            </div>
            <OrderedPairPad
              x={padX}
              y={padY}
              onChangeX={setPadX}
              onChangeY={setPadY}
              onPlace={() => void placeHuman()}
              disabled={padDisabled}
            />
          </div>

          <p className="text-center text-xs text-wood/50">
            흑 금수: 한 수로 열린 삼이 두 방향에 생기면 둘 수 없어요 (쌍삼).
            {mode === "pvp" ? (
              <>
                {" "}
                · 대전은 수당 {OMOK_TURN_SECONDS}초, 시간이 끝나면 아무 빈칸에
                자동으로 둡니다.
              </>
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
            <div className="pointer-events-none select-none opacity-80 blur-[1px]">
              <div className="quest-card p-3 sm:p-4">
                <CoordinatePlaneBoard board={board} lastMove={lastMove} />
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
              <p className="mt-1 text-sm font-semibold text-wood">{xpMessage}</p>
            ) : null}
            <p className="mt-3 text-xs text-wood/50">
              누적 &lt;1000: 승+300/패+100 · ≥1000: 승+200/패−100 · ≥2000:
              승+150/패−100 · ≥3000: 승+100/패−100
            </p>
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
              onClick={() => void startAiGame()}
              className="rounded-xl bg-mint/80 px-5 py-2.5 font-bold text-wood"
            >
              컴퓨터와 다시
            </button>
          </div>

          {!practiceOnly ? (
            <OmokRatingBoard
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
