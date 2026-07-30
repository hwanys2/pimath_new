"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import type { RankingMode, RankingRow, RankingScope } from "@/lib/game-types";
import GameRankingBoard from "@/components/games/GameRankingBoard";
import {
  submitGameRun,
  fetchGameRanking,
  type GameSubmitClientResult,
} from "@/app/adventure/actions";
import {
  GRID,
  type Cell,
  type EndReason,
  applyScoreGain,
  cellKind,
  clampScore,
  countUnvisitedPrimes,
  createBoard,
  endReasonLabel,
  evaluateEnd,
  formatFactorization,
  idx,
  isKnightMove,
  legalMoves,
  penaltyFor,
  visitStart,
} from "@/lib/knight-prime-math";

const CONTENT_KEY = "g1-u1-1-knight-prime";

type Phase = "ready" | "playing" | "ended";

type Feedback = {
  tone: "good" | "bad" | "warn" | "info";
  text: string;
};

function freshRun(): {
  board: Cell[];
  row: number;
  col: number;
} {
  const board = createBoard();
  const pos = visitStart(board);
  return { board, row: pos.row, col: pos.col };
}

export default function KnightPrime() {
  const [board, setBoard] = useState<Cell[] | null>(null);
  const [row, setRow] = useState(0);
  const [col, setCol] = useState(0);
  const [score, setScore] = useState(0);
  const [phase, setPhase] = useState<Phase>("ready");
  const [endReason, setEndReason] = useState<EndReason | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [submitResult, setSubmitResult] = useState<GameSubmitClientResult | null>(
    null,
  );
  const [ranking, setRanking] = useState<RankingRow[]>([]);
  const [rankingScope, setRankingScope] = useState<RankingScope>("class");
  const [rankingMode, setRankingMode] = useState<RankingMode>("best");
  const [isPending, startTransition] = useTransition();

  const startFresh = useCallback(() => {
    const next = freshRun();
    setBoard(next.board);
    setRow(next.row);
    setCol(next.col);
    setScore(0);
    setPhase("playing");
    setEndReason(null);
    setFeedback({
      tone: "info",
      text: "노란색 나이트에서 출발해요. 이동할 빈 칸을 클릭하세요.",
    });
    setSubmitResult(null);
    setRanking([]);
    setRankingScope("class");
    setRankingMode("best");
  }, []);

  useEffect(() => {
    startFresh();
  }, [startFresh]);

  const primesLeft = board ? countUnvisitedPrimes(board) : 0;
  const moves = useMemo(
    () =>
      board && phase === "playing" ? legalMoves(board, row, col) : [],
    [board, row, col, phase],
  );
  const moveKey = useMemo(
    () => new Set(moves.map((m) => idx(m.row, m.col))),
    [moves],
  );

  const finishRun = useCallback(
    (reason: EndReason, finalScore: number) => {
      setEndReason(reason);
      setPhase("ended");
      setFeedback({
        tone: reason === "all_primes" ? "good" : "bad",
        text: endReasonLabel(reason),
      });
      const submitScore = clampScore(finalScore);
      startTransition(async () => {
        const result = await submitGameRun({
          contentKey: CONTENT_KEY,
          score: submitScore,
        });
        setSubmitResult(result);
        if (result.recorded) {
          const rows = await fetchGameRanking({
            contentKey: CONTENT_KEY,
            scope: "class",
            mode: "best",
          });
          setRanking(rows);
        }
      });
    },
    [startTransition],
  );

  const onCellClick = (r: number, c: number) => {
    if (phase !== "playing" || !board) return;
    const i = idx(r, c);
    const cell = board[i]!;

    if (cell.visited) {
      setFeedback({
        tone: "warn",
        text: "지나간 자리는 다시 갈 수 없어요.",
      });
      return;
    }
    if (!isKnightMove(row, col, r, c)) {
      setFeedback({
        tone: "warn",
        text: "나이트는 상하좌우 2칸 직진 후 수직 1칸(L자)으로만 이동해요.",
      });
      return;
    }

    const nextBoard = board.map((cella, j) =>
      j === i ? { ...cella, visited: true } : cella,
    );
    const val = cell.val;
    const kind = cellKind(val);
    let nextScore = score;
    let fb: Feedback;

    if (kind === "prime") {
      nextScore = applyScoreGain(score, val);
      const gained = nextScore - score;
      fb = {
        tone: "good",
        text: `${val}은(는) 소수예요. +${gained}점`,
      };
    } else if (kind === "one") {
      nextScore = score - 1;
      fb = {
        tone: "bad",
        text: "1은 소수도 합성수도 아니에요. 빌런 함정! −1점",
      };
    } else if (kind === "composite") {
      const pen = penaltyFor(val);
      nextScore = score - pen;
      fb = {
        tone: "bad",
        text: `${formatFactorization(val)} · 합성수 −${pen}점`,
      };
    } else {
      fb = { tone: "info", text: "출발 칸이에요." };
    }

    setBoard(nextBoard);
    setRow(r);
    setCol(c);
    setScore(nextScore);
    setFeedback(fb);

    const reason = evaluateEnd(nextBoard, nextScore, r, c);
    if (reason) {
      finishRun(reason, nextScore);
    }
  };

  const loadRanking = (next: {
    scope?: RankingScope;
    mode?: RankingMode;
  }) => {
    const scope = next.scope ?? rankingScope;
    const mode = next.mode ?? rankingMode;
    if (next.scope) setRankingScope(next.scope);
    if (next.mode) setRankingMode(next.mode);
    startTransition(async () => {
      const rows = await fetchGameRanking({
        contentKey: CONTENT_KEY,
        scope,
        mode,
      });
      setRanking(rows);
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <section className="quest-card bg-gradient-to-br from-mint/40 via-sky/20 to-gold/25 p-5 sm:p-7">
        <p className="text-sm font-bold text-wood">중1 · 1.1 소인수분해</p>
        <h1 className="font-display mt-1 text-3xl text-foreground sm:text-4xl">
          나이트 프라임
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-foreground/75 sm:text-base">
          체스 나이트처럼 L자로만 움직이며 소수를 밟아 점수를 모아요. 합성수나
          1을 밟으면 감점되고, 점수가 0 미만이면 바로 끝나요.
        </p>
        <button
          type="button"
          onClick={() => setShowHelp((v) => !v)}
          className="mt-4 rounded-xl bg-wood/10 px-4 py-2 text-sm font-bold text-wood transition hover:bg-wood/15"
        >
          {showHelp ? "설명 닫기" : "게임 설명"}
        </button>
        {showHelp ? (
          <ul className="mt-4 max-w-2xl space-y-2 text-sm leading-relaxed text-foreground/75">
            <li>
              나이트는 상하좌우 중 2칸 직진 후 수직 1칸(L자)으로만 이동할 수
              있어요.
            </li>
            <li>노란색 나이트에서 출발해요. 이동하고 싶은 빈 칸을 클릭하세요.</li>
            <li>소수를 밟으면 그 수만큼 점수를 얻어요.</li>
            <li>합성수 또는 1을 밟으면 그 수만큼 감점돼요. (1은 −1점 함정)</li>
            <li>지나간 자리는 다시 갈 수 없어요.</li>
            <li>
              종료: 점수 0 미만 · 모든 소수 획득(클리어) · 더 이상 이동 불가
            </li>
            <li>
              점수가 1000에 가까워지면 이후 획득량은 매우 작아져요 (소프트 캡).
            </li>
          </ul>
        ) : null}
      </section>

      {phase === "ended" ? (
        <section
          className="quest-card border-mint/40 bg-gradient-to-br from-mint/45 via-sky/25 to-gold/30 p-5 text-center sm:p-7"
          role="status"
          aria-live="polite"
        >
          <p className="font-display text-3xl text-wood sm:text-4xl">
            {clampScore(score)}점
          </p>
          <p className="mt-2 text-sm font-semibold text-foreground/70">
            {endReason ? endReasonLabel(endReason) : "게임 종료"}
          </p>

          {isPending && !submitResult ? (
            <p className="mt-4 text-sm font-bold text-wood/70">점수 반영 중…</p>
          ) : null}

          {submitResult?.error ? (
            <p className="mt-4 text-sm font-bold text-[#a63a1a]">
              {submitResult.error}
            </p>
          ) : null}

          {submitResult && !submitResult.error ? (
            submitResult.recorded ? (
              <p className="mt-4 text-sm font-bold text-wood">
                {submitResult.message}
              </p>
            ) : (
              <p className="mt-4 rounded-2xl bg-wood/5 px-4 py-3 text-sm font-semibold text-foreground/65">
                연습 모드 · 점수는 반영되지 않아요
                <span className="mt-1 block text-xs font-medium text-foreground/50">
                  학급에 배정·활성화된 게임을 학생 로그인으로 플레이하면 XP와
                  랭킹이 쌓여요.
                </span>
              </p>
            )
          ) : null}

          {submitResult?.recorded ? (
            <div className="mt-6 text-left">
              <GameRankingBoard
                rows={ranking}
                scope={rankingScope}
                mode={rankingMode}
                onScopeChange={(scope) => loadRanking({ scope })}
                onModeChange={(mode) => loadRanking({ mode })}
                loading={isPending}
              />
            </div>
          ) : null}

          <button
            type="button"
            onClick={startFresh}
            className="mt-6 rounded-xl bg-wood px-6 py-3 text-base font-bold text-cream"
          >
            다시 하기
          </button>
        </section>
      ) : !board ? (
        <section className="quest-card p-6 text-center text-sm font-semibold text-foreground/60">
          보드 준비 중…
        </section>
      ) : (
        <section className="quest-card p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-wood">
              <span className="rounded-xl bg-gold/50 px-3 py-1 tabular-nums">
                {score}점
              </span>
              <span className="rounded-xl bg-mint/40 px-3 py-1 tabular-nums">
                남은 소수 {primesLeft}
              </span>
            </div>
            <button
              type="button"
              onClick={startFresh}
              className="rounded-xl bg-wood/10 px-3 py-1.5 text-sm font-bold text-wood transition hover:bg-wood/15"
            >
              새 판
            </button>
          </div>

          <div
            className={[
              "mt-4 min-h-[3rem] rounded-2xl px-4 py-3 text-sm font-semibold",
              feedback?.tone === "good"
                ? "bg-mint/35 text-wood"
                : feedback?.tone === "bad"
                  ? "bg-[#e85d4c]/15 text-[#a63a1a]"
                  : feedback?.tone === "warn"
                    ? "bg-gold/30 text-wood"
                    : "bg-sky/20 text-foreground/75",
            ].join(" ")}
            role="status"
            aria-live="polite"
          >
            {feedback?.text ?? " "}
          </div>

          <div
            className="mx-auto mt-4 grid max-w-[min(100%,28rem)] gap-1 sm:gap-1.5"
            style={{ gridTemplateColumns: `repeat(${GRID}, minmax(0, 1fr))` }}
            role="grid"
            aria-label="나이트 프라임 보드"
          >
            {board.map((cell, i) => {
              const r = Math.floor(i / GRID);
              const c = i % GRID;
              const isCurrent = r === row && c === col;
              const isLegal = moveKey.has(i);
              const visited = cell.visited && !isCurrent;
              const zebra = (r + c) % 2 === 1;
              const showVal = isCurrent
                ? String(score)
                : visited
                  ? ""
                  : String(cell.val);

              let cellClass =
                "relative aspect-square rounded-md text-[0.65rem] font-bold tabular-nums transition sm:rounded-lg sm:text-xs";
              if (isCurrent) {
                cellClass +=
                  " bg-[#fef08a] text-[#92400e] shadow-sm ring-2 ring-[#eab308]";
              } else if (visited) {
                cellClass += " bg-wood/10 text-wood/30";
              } else if (isLegal) {
                cellClass +=
                  " bg-cream text-foreground ring-2 ring-mint/70 hover:bg-mint/25";
              } else {
                cellClass += zebra
                  ? " bg-sky/10 text-foreground/80 hover:bg-sky/20"
                  : " bg-cream text-foreground/80 hover:bg-sky/15";
              }

              return (
                <button
                  key={i}
                  type="button"
                  role="gridcell"
                  aria-label={
                    isCurrent
                      ? `현재 위치, 점수 ${score}`
                      : visited
                        ? "지나간 칸"
                        : isLegal
                          ? `이동 가능, ${cell.val}`
                          : `${cell.val}`
                  }
                  disabled={phase !== "playing"}
                  onClick={() => onCellClick(r, c)}
                  className={cellClass}
                >
                  <span className="pointer-events-none">{showVal}</span>
                  {isCurrent ? (
                    <span
                      className="pointer-events-none absolute inset-x-0 bottom-0 text-center text-[0.7rem] leading-none sm:text-sm"
                      aria-hidden
                    >
                      ♞
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <p className="mt-3 text-center text-xs font-medium text-foreground/50">
            mint 테두리 칸이 지금 이동할 수 있는 자리예요
          </p>
        </section>
      )}
    </div>
  );
}
