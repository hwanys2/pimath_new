"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import Image from "next/image";
import type { RankingMode, RankingRow, RankingScope } from "@/lib/game-types";
import GameRankingBoard from "@/components/games/GameRankingBoard";
import CoordinatePlaneBoard from "@/components/games/CoordinatePlaneBoard";
import OrderedPairPad from "@/components/games/OrderedPairPad";
import {
  submitGameRun,
  fetchGameRanking,
  type GameSubmitClientResult,
} from "@/app/adventure/actions";
import {
  omokClaimResultAction,
  omokExpandGlobalAction,
  omokJoinQueueAction,
  omokLeaveQueueAction,
  omokLobbyContextAction,
  omokPlaceMoveAction,
  omokPollAction,
} from "@/app/play/g1-u2-3-ordered-pair-omok/actions";
import type { OmokPollState } from "@/lib/omok-types";
import {
  boardFromObject,
  boardIsFull,
  chooseAiMove,
  emptyBoard,
  finalizeRunScore,
  formatPair,
  stoneLabel,
  tryPlace,
  type BoardMap,
  type Stone,
} from "@/lib/ordered-pair-omok-math";

const CONTENT_KEY = "g1-u2-3-ordered-pair-omok";
const GUEST_KEY = "pm_omok_guest_id";

type Screen =
  | "lobby"
  | "waiting"
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
  const [outcome, setOutcome] = useState<"win" | "loss" | "draw" | null>(null);
  const [finalScore, setFinalScore] = useState(0);

  const [submitResult, setSubmitResult] =
    useState<GameSubmitClientResult | null>(null);
  const [ranking, setRanking] = useState<RankingRow[]>([]);
  const [rankingScope, setRankingScope] = useState<RankingScope>("class");
  const [rankingMode, setRankingMode] = useState<RankingMode>("best");
  const [isPending, startTransition] = useTransition();
  const [waitSeconds, setWaitSeconds] = useState(0);

  const endingRef = useRef(false);
  const aiThinkingRef = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setGuestId(ensureGuestId());
    startTransition(async () => {
      const ctx = await omokLobbyContextAction();
      setCanUseClass(ctx.canUseClass);
      setPlayerName(ctx.displayName);
      setQueueScope(ctx.canUseClass ? "class" : "global");
    });
  }, []);

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const finishWithScore = useCallback(
    (score: number, result: "win" | "loss" | "draw") => {
      if (endingRef.current) return;
      endingRef.current = true;
      stopPoll();
      setOutcome(result);
      setFinalScore(score);
      setScreen("ended");
      startTransition(async () => {
        const submit = await submitGameRun({
          contentKey: CONTENT_KEY,
          score,
        });
        setSubmitResult(submit);
        if (submit.recorded) {
          const rows = await fetchGameRanking({
            contentKey: CONTENT_KEY,
            scope: "class",
            mode: "best",
          });
          setRanking(rows);
        }
      });
    },
    [stopPoll],
  );

  const applyPollPlaying = useCallback(
    (state: OmokPollState) => {
      setBoard(boardFromObject(state.board));
      if (state.turn) setTurn(state.turn);
      if (state.myStone) setMyStone(state.myStone);
      if (state.gameId) setGameId(state.gameId);
      if (state.opponentName) setOpponentName(state.opponentName);
      if (state.lastX != null && state.lastY != null) {
        setLastMove({ x: state.lastX, y: state.lastY });
      }
      if (state.phase === "ended" && state.myScore != null) {
        const result: "win" | "loss" | "draw" =
          state.myScore === 300
            ? "win"
            : state.myScore === 150
              ? "draw"
              : "loss";
        void (async () => {
          if (state.gameId) {
            await omokClaimResultAction({
              guestId,
              gameId: state.gameId,
            });
          }
          finishWithScore(state.myScore!, result);
        })();
      } else if (state.phase === "playing") {
        setScreen("playing");
        setMode("pvp");
      } else if (state.phase === "waiting") {
        setScreen("waiting");
        if (state.queueScope) setQueueScope(state.queueScope);
      }
    },
    [finishWithScore, guestId],
  );

  const startPoll = useCallback(
    (gid?: string | null) => {
      stopPoll();
      pollRef.current = setInterval(() => {
        startTransition(async () => {
          const state = await omokPollAction({
            guestId,
            gameId: gid ?? gameId,
          });
          if ("error" in state) return;
          applyPollPlaying(state);
        });
      }, 1500);
    },
    [applyPollPlaying, gameId, guestId, stopPoll],
  );

  useEffect(() => {
    return () => stopPoll();
  }, [stopPoll]);

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
    await omokLeaveQueueAction({ guestId });
    setMode("ai");
    setBoard(emptyBoard());
    setTurn("black");
    setMyStone("black");
    setOpponentName("컴퓨터");
    setLastMove(null);
    setStatusMsg("당신은 흑(선공)이에요. 순서쌍으로 첫 수를 두세요!");
    setOutcome(null);
    setSubmitResult(null);
    setGameId(null);
    resetPad();
    setScreen("playing");
  };

  const startMatchmaking = async (scope: "class" | "global") => {
    endingRef.current = false;
    setSubmitResult(null);
    setOutcome(null);
    const joined = await omokJoinQueueAction({ scope, guestId });
    if ("error" in joined) {
      setStatusMsg(joined.error);
      return;
    }
    setQueueScope(joined.scope);
    setMode("pvp");
    if (joined.gameId) {
      setGameId(joined.gameId);
      const state = await omokPollAction({ guestId, gameId: joined.gameId });
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
    const res = await omokExpandGlobalAction({ guestId });
    if ("error" in res) {
      setStatusMsg(res.error);
      return;
    }
    setQueueScope("global");
    setStatusMsg("전체로 확대해서 기다리는 중이에요…");
    if (res.gameId) {
      setGameId(res.gameId);
      const state = await omokPollAction({ guestId, gameId: res.gameId });
      if (!("error" in state)) applyPollPlaying(state);
      startPoll(res.gameId);
    }
  };

  const cancelWait = async () => {
    stopPoll();
    await omokLeaveQueueAction({ guestId });
    setScreen("lobby");
    setStatusMsg("");
  };

  // AI reply after human move
  useEffect(() => {
    if (screen !== "playing" || mode !== "ai") return;
    if (turn !== "white") return;
    if (aiThinkingRef.current) return;
    if (endingRef.current) return;

    aiThinkingRef.current = true;
    const timer = window.setTimeout(() => {
      const move = chooseAiMove(board, "white");
      aiThinkingRef.current = false;
      if (!move) {
        finishWithScore(finalizeRunScore("draw"), "draw");
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
        finishWithScore(finalizeRunScore("loss"), "loss");
        return;
      }
      if (boardIsFull(placed.board)) {
        finishWithScore(finalizeRunScore("draw"), "draw");
        return;
      }
      setTurn("black");
    }, 450 + Math.random() * 350);

    return () => {
      window.clearTimeout(timer);
      aiThinkingRef.current = false;
    };
  }, [board, finishWithScore, mode, screen, turn]);

  const placeHuman = () => {
    if (padX === null || padY === null) return;
    if (screen !== "playing") return;

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
        finishWithScore(finalizeRunScore("win"), "win");
        return;
      }
      if (boardIsFull(placed.board)) {
        finishWithScore(finalizeRunScore("draw"), "draw");
        return;
      }
      setTurn("white");
      return;
    }

    // PvP
    if (!gameId) return;
    if (turn !== myStone) {
      setStatusMsg("상대 차례예요. 순서쌍을 입력하기 전에 기다려 주세요.");
      return;
    }
    startTransition(async () => {
      const res = await omokPlaceMoveAction({
        guestId,
        gameId,
        x: padX,
        y: padY,
      });
      if (!res.ok) {
        setStatusMsg(res.message ?? "둘 수 없어요.");
        return;
      }
      setBoard(boardFromObject(res.board));
      setTurn(res.turn);
      setLastMove({ x: res.lastX, y: res.lastY });
      setStatusMsg(`${formatPair(padX, padY)}에 두었어요!`);
      resetPad();
      if (res.myScore != null) {
        const result: "win" | "loss" | "draw" =
          res.myScore === 300 ? "win" : res.myScore === 150 ? "draw" : "loss";
        await omokClaimResultAction({ guestId, gameId });
        finishWithScore(res.myScore, result);
      }
    });
  };

  const reloadRanking = (scope: RankingScope, modeR: RankingMode) => {
    setRankingScope(scope);
    setRankingMode(modeR);
    startTransition(async () => {
      const rows = await fetchGameRanking({
        contentKey: CONTENT_KEY,
        scope,
        mode: modeR,
      });
      setRanking(rows);
    });
  };

  const backToLobby = () => {
    endingRef.current = false;
    stopPoll();
    setScreen("lobby");
    setBoard(emptyBoard());
    setStatusMsg("");
    setOutcome(null);
    setSubmitResult(null);
    resetPad();
  };

  const preview =
    padX !== null && padY !== null ? { x: padX, y: padY } : null;
  const myTurn = screen === "playing" && turn === myStone;

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
            <p className="text-xs font-bold text-wood/55">중1 · 2.3 좌표평면과 그래프</p>
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
                중학생 난이도 AI · 바로 시작 · 승 300 / 패 100
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
          <div className="mx-auto h-2 w-48 overflow-hidden rounded-full bg-wood/10">
            <div
              className="h-full animate-pulse rounded-full bg-mint"
              style={{ width: `${Math.min(100, 20 + waitSeconds * 4)}%` }}
            />
          </div>
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
              {myTurn ? "내 차례 · 순서쌍을 입력하세요" : "상대 차례"}
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
              <CoordinatePlaneBoard
                board={board}
                preview={preview}
                lastMove={lastMove}
                myStone={myStone}
              />
            </div>
            <OrderedPairPad
              x={padX}
              y={padY}
              onChangeX={setPadX}
              onChangeY={setPadY}
              onPlace={placeHuman}
              disabled={!myTurn || isPending}
            />
          </div>

          <p className="text-center text-xs text-wood/50">
            흑 금수: 한 수로 열린 삼이 두 방향에 생기면 둘 수 없어요 (쌍삼).
            다섯이 만들어지면 금수보다 승리가 우선이에요.
          </p>
        </section>
      ) : null}

      {screen === "ended" ? (
        <section className="quest-card space-y-4 p-5">
          <div className="text-center">
            <p className="font-display text-3xl text-wood">
              {outcome === "win"
                ? "승리!"
                : outcome === "draw"
                  ? "무승부"
                  : "아쉬운 패배"}
            </p>
            <p className="mt-2 text-lg font-black tabular-nums text-wood">
              점수 {finalScore}
              <span className="ml-2 text-sm font-semibold text-wood/55">
                (승 300 · 패 100 · 무 150)
              </span>
            </p>
            {submitResult?.practiceOnly ? (
              <p className="mt-2 text-sm text-wood/60">
                연습 모드 — 학급에 배정·활성화되면 XP와 랭킹에 반영돼요.
              </p>
            ) : null}
            {submitResult?.message ? (
              <p className="mt-1 text-sm font-semibold text-wood">
                {submitResult.message}
              </p>
            ) : null}
            {submitResult?.error ? (
              <p className="mt-1 text-sm text-[#c44]">{submitResult.error}</p>
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
              onClick={() => void startAiGame()}
              className="rounded-xl bg-mint/80 px-5 py-2.5 font-bold text-wood"
            >
              컴퓨터와 다시
            </button>
          </div>

          {submitResult?.recorded ? (
            <GameRankingBoard
              rows={ranking}
              scope={rankingScope}
              mode={rankingMode}
              loading={isPending}
              onScopeChange={(s) => reloadRanking(s, rankingMode)}
              onModeChange={(m) => reloadRanking(rankingScope, m)}
            />
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
