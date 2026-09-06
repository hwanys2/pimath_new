"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import type { RankingMode, RankingRow, RankingScope } from "@/lib/game-types";
import GameRankingBoard from "@/components/games/GameRankingBoard";
import {
  submitGameRun,
  fetchGameRanking,
  type GameSubmitClientResult,
} from "@/app/adventure/actions";
import { activityDetailsV1 } from "@/lib/activity-result-schemas";
import {
  CONTENT_KEY,
  FEVER_COMBO,
  FEVER_DURATION_SEC,
  MAX_LIVES,
  START_LIVES,
  analyzeTrigPerformance,
  calcProblemScore,
  generateBeatProblem,
  type BeatProblem,
  type PadOption,
  type ProblemLogItem,
  type ProblemResultKind,
  type TrigFn,
} from "@/lib/trigo-beat-math";

type Phase = "ready" | "playing" | "ended";

const MUTE_KEY = "pm_trigo_beat_mute";

function Latex({ latex, className }: { latex: string; className?: string }) {
  const html = useMemo(
    () =>
      katex.renderToString(latex, {
        throwOnError: false,
        displayMode: false,
      }),
    [latex],
  );
  return (
    <span className={className} dangerouslySetInnerHTML={{ __html: html }} />
  );
}

function Hearts({ lives, max }: { lives: number; max: number }) {
  return (
    <div className="flex items-center gap-1.5" aria-label={`생명 ${lives}개`}>
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className={[
            "inline-flex h-8 w-8 items-center justify-center rounded-full text-base font-black transition-all duration-300",
            i < lives
              ? "bg-[#e85d4c] text-white shadow-sm scale-100"
              : "bg-wood/10 text-wood/25 scale-90",
          ].join(" ")}
          aria-hidden
        >
          ♥
        </span>
      ))}
    </div>
  );
}

function playSynthTone(
  kind: "perfect" | "great" | "wrong" | "timeout" | "fever" | "life_up",
  combo: number,
  muted: boolean,
) {
  if (muted || typeof window === "undefined") return;
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (kind === "perfect") {
      // 콤보에 맞춰 음계 상승 (Pentatonic scale: C5, D5, E5, G5, A5, C6...)
      const scale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
      const baseFreq = scale[combo % scale.length]!;
      osc.type = "sine";
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + 0.12);
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.27);
    } else if (kind === "great") {
      const baseFreq = 440 + Math.min(combo * 15, 300);
      osc.type = "triangle";
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.25, now + 0.1);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.22);
    } else if (kind === "fever") {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(659.25, now + 0.08);
      osc.frequency.setValueAtTime(783.99, now + 0.16);
      osc.frequency.setValueAtTime(1046.5, now + 0.24);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.start(now);
      osc.stop(now + 0.47);
    } else if (kind === "life_up") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(659.25, now);
      osc.frequency.setValueAtTime(880.0, now + 0.12);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.32);
    } else if (kind === "wrong") {
      osc.type = "square";
      osc.frequency.setValueAtTime(190, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.18);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.start(now);
      osc.stop(now + 0.24);
    } else {
      // timeout
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.25);
      gain.gain.setValueAtTime(0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.32);
    }

    window.setTimeout(() => void ctx.close(), 600);
  } catch {
    /* autoplay context safe */
  }
}

const FN_THEME: Record<
  TrigFn,
  { label: string; bg: string; text: string; badge: string; border: string }
> = {
  sin: {
    label: "사인 (sin)",
    bg: "bg-blue-500/10",
    text: "text-blue-600 dark:text-blue-400",
    badge: "bg-blue-600 text-white",
    border: "border-blue-500/30",
  },
  cos: {
    label: "코사인 (cos)",
    bg: "bg-purple-500/10",
    text: "text-purple-600 dark:text-purple-400",
    badge: "bg-purple-600 text-white",
    border: "border-purple-500/30",
  },
  tan: {
    label: "탄젠트 (tan)",
    bg: "bg-emerald-500/10",
    text: "text-emerald-600 dark:text-emerald-400",
    badge: "bg-emerald-600 text-white",
    border: "border-emerald-500/30",
  },
};

export default function TrigoBeat() {
  const [phase, setPhase] = useState<Phase>("ready");
  const [lives, setLives] = useState(START_LIVES);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [feverCount, setFeverCount] = useState(0);
  const [isFever, setIsFever] = useState(false);
  const [feverSecondsLeft, setFeverSecondsLeft] = useState(0);

  const [problem, setProblem] = useState<BeatProblem | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [feedback, setFeedback] = useState<{
    text: string;
    scoreGain?: number;
    kind: ProblemResultKind;
  } | null>(null);
  const [shake, setShake] = useState(false);
  const [wrongPadId, setWrongPadId] = useState<string | null>(null);
  const [correctHighlightPadId, setCorrectHighlightPadId] = useState<
    string | null
  >(null);

  const [logs, setLogs] = useState<ProblemLogItem[]>([]);
  const [muted, setMuted] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(MUTE_KEY) === "1";
    } catch {
      return false;
    }
  });

  // 결과 및 랭킹
  const [submitResult, setSubmitResult] =
    useState<GameSubmitClientResult | null>(null);
  const [ranking, setRanking] = useState<RankingRow[]>([]);
  const [rankingScope, setRankingScope] = useState<RankingScope>("class");
  const [rankingMode, setRankingMode] = useState<RankingMode>("best");
  const [isPending, startTransition] = useTransition();

  // Refs for requestAnimationFrame / timers
  const phaseRef = useRef(phase);
  const livesRef = useRef(lives);
  const scoreRef = useRef(score);
  const comboRef = useRef(combo);
  const maxComboRef = useRef(0);
  const feverCountRef = useRef(0);
  const isFeverRef = useRef(false);
  const problemRef = useRef<BeatProblem | null>(null);
  const logsRef = useRef<ProblemLogItem[]>([]);
  const mutedRef = useRef(muted);
  const resolvingRef = useRef(false);
  const feverTimeoutRef = useRef<number | null>(null);
  const feverIntervalRef = useRef<number | null>(null);

  const problemStartTimeRef = useRef(0);
  const timerRafRef = useRef<number | null>(null);

  useEffect(() => {
    phaseRef.current = phase;
    livesRef.current = lives;
    scoreRef.current = score;
    comboRef.current = combo;
    problemRef.current = problem;
    logsRef.current = logs;
    mutedRef.current = muted;
  }, [phase, lives, score, combo, problem, logs, muted]);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(MUTE_KEY, next ? "1" : "0");
      } catch {
        /* storage safe */
      }
      return next;
    });
  }, []);

  const triggerFever = useCallback(() => {
    setIsFever(true);
    isFeverRef.current = true;
    setFeverCount((prev) => prev + 1);
    feverCountRef.current++;
    setFeverSecondsLeft(FEVER_DURATION_SEC);
    playSynthTone("fever", comboRef.current, mutedRef.current);

    if (feverTimeoutRef.current) window.clearTimeout(feverTimeoutRef.current);
    if (feverIntervalRef.current) window.clearInterval(feverIntervalRef.current);

    feverTimeoutRef.current = window.setTimeout(() => {
      setIsFever(false);
      isFeverRef.current = false;
      setFeverSecondsLeft(0);
    }, FEVER_DURATION_SEC * 1000);

    feverIntervalRef.current = window.setInterval(() => {
      setFeverSecondsLeft((prev) => {
        if (prev <= 1) {
          if (feverIntervalRef.current)
            window.clearInterval(feverIntervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // 새 문제 출제
  const nextProblem = useCallback((currentCombo: number) => {
    resolvingRef.current = false;
    setWrongPadId(null);
    setCorrectHighlightPadId(null);

    const prob = generateBeatProblem(currentCombo, problemRef.current);
    setProblem(prob);
    problemRef.current = prob;
    setTimeLeft(prob.timeLimitSec);
    problemStartTimeRef.current = performance.now();

    // 타이머 루프 시작
    if (timerRafRef.current) cancelAnimationFrame(timerRafRef.current);

    const loop = () => {
      if (resolvingRef.current || phaseRef.current !== "playing") return;
      const elapsedSec = (performance.now() - problemStartTimeRef.current) / 1000;
      const remaining = Math.max(0, prob.timeLimitSec - elapsedSec);
      setTimeLeft(remaining);

      if (remaining <= 0) {
        // 시간 초과 처리
        handleAnswer(null, true);
        return;
      }
      timerRafRef.current = requestAnimationFrame(loop);
    };

    timerRafRef.current = requestAnimationFrame(loop);
  }, []);

  // 게임 오버
  const endGame = useCallback(async () => {
    if (phaseRef.current === "ended") return;
    setPhase("ended");
    phaseRef.current = "ended";
    if (timerRafRef.current) cancelAnimationFrame(timerRafRef.current);
    if (feverTimeoutRef.current) window.clearTimeout(feverTimeoutRef.current);
    if (feverIntervalRef.current) window.clearInterval(feverIntervalRef.current);

    const finalScore = scoreRef.current;
    const finalLogs = logsRef.current;
    const { summary } = analyzeTrigPerformance(finalLogs);
    summary.maxCombo = maxComboRef.current;
    summary.feverCount = feverCountRef.current;

    // submitGameRun
    try {
      const res = await submitGameRun({
        contentKey: CONTENT_KEY,
        score: finalScore,
        details: activityDetailsV1(
          {
            cleared: summary.cleared,
            maxCombo: summary.maxCombo,
            accuracy: summary.accuracy,
            weakFn: summary.weakFn,
            feverCount: summary.feverCount,
          },
          finalLogs.map((l) => ({
            i: l.i,
            fn: l.fn,
            angle: l.angle,
            result: l.result,
            timeSpentSec: Number(l.timeSpentSec.toFixed(2)),
          })),
        ),
      });
      setSubmitResult(res);
      if (res.recorded) {
        const rows = await fetchGameRanking({
          contentKey: CONTENT_KEY,
          scope: "class",
          mode: "best",
        });
        setRanking(rows);
      }
    } catch {
      // 연습 모드
    }
  }, []);

  // 답변 제출 처리
  const handleAnswer = useCallback(
    (padId: string | null, isTimeout = false) => {
      if (resolvingRef.current || phaseRef.current !== "playing") return;
      const currentProb = problemRef.current;
      if (!currentProb) return;

      resolvingRef.current = true;
      if (timerRafRef.current) cancelAnimationFrame(timerRafRef.current);

      const elapsedSec =
        (performance.now() - problemStartTimeRef.current) / 1000;
      const remainingRatio = isTimeout
        ? 0
        : Math.max(0, currentProb.timeLimitSec - elapsedSec) /
          currentProb.timeLimitSec;

      const isCorrect = !isTimeout && padId === currentProb.correctPadId;

      if (isCorrect) {
        // 정답
        const newCombo = comboRef.current + 1;
        setCombo(newCombo);
        comboRef.current = newCombo;
        if (newCombo > maxComboRef.current) {
          maxComboRef.current = newCombo;
          setMaxCombo(newCombo);
        }

        const { newScore, gained, verdict } = calcProblemScore(
          scoreRef.current,
          remainingRatio,
          newCombo,
          isFeverRef.current,
        );
        setScore(newScore);
        scoreRef.current = newScore;

        playSynthTone(verdict, newCombo, mutedRef.current);

        setFeedback({
          text: verdict === "perfect" ? "PERFECT!" : "GREAT!",
          scoreGain: gained,
          kind: verdict,
        });

        // 콤보 마일스톤 생명 회복 (+1)
        if (
          (newCombo === 15 || newCombo === 35) &&
          livesRef.current < MAX_LIVES
        ) {
          setLives((l) => {
            const next = Math.min(MAX_LIVES, l + 1);
            livesRef.current = next;
            return next;
          });
          playSynthTone("life_up", newCombo, mutedRef.current);
        }

        // 피버 진입 체크 (10콤보 주기)
        if (newCombo > 0 && newCombo % FEVER_COMBO === 0 && !isFeverRef.current) {
          triggerFever();
        }

        const logItem: ProblemLogItem = {
          i: logsRef.current.length + 1,
          fn: currentProb.fn,
          angle: currentProb.angle,
          result: verdict,
          chosenPadId: padId,
          correctPadId: currentProb.correctPadId,
          timeSpentSec: elapsedSec,
        };
        setLogs((prev) => [...prev, logItem]);
        logsRef.current.push(logItem);

        // 다음 문제로 전환 (짧은 대기)
        window.setTimeout(() => {
          setFeedback(null);
          nextProblem(newCombo);
        }, 320);
      } else {
        // 오답 또는 시간초과
        setCombo(0);
        comboRef.current = 0;

        const newLives = livesRef.current - 1;
        setLives(newLives);
        livesRef.current = newLives;

        setShake(true);
        window.setTimeout(() => setShake(false), 340);

        if (isTimeout) {
          playSynthTone("timeout", 0, mutedRef.current);
          setFeedback({ text: "TIME OVER!", kind: "timeout" });
        } else {
          playSynthTone("wrong", 0, mutedRef.current);
          setFeedback({ text: "MISS...", kind: "wrong" });
          setWrongPadId(padId);
        }

        // 정답 버튼 하이라이트 (학습 피드백)
        setCorrectHighlightPadId(currentProb.correctPadId);

        const logItem: ProblemLogItem = {
          i: logsRef.current.length + 1,
          fn: currentProb.fn,
          angle: currentProb.angle,
          result: isTimeout ? "timeout" : "wrong",
          chosenPadId: padId,
          correctPadId: currentProb.correctPadId,
          timeSpentSec: elapsedSec,
        };
        setLogs((prev) => [...prev, logItem]);
        logsRef.current.push(logItem);

        if (newLives <= 0) {
          // 게임 오버
          window.setTimeout(() => {
            endGame();
          }, 850);
        } else {
          // 0.75초간 정답 확인 후 다음 문제
          window.setTimeout(() => {
            setFeedback(null);
            nextProblem(0);
          }, 750);
        }
      }
    },
    [nextProblem, triggerFever, endGame],
  );

  // 키보드 숫자키 (1 ~ 5) 리스너
  useEffect(() => {
    if (phase !== "playing" || !problem) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key;
      const num = parseInt(key, 10);
      if (num >= 1 && num <= problem.pads.length) {
        const pad = problem.pads[num - 1];
        if (pad) {
          e.preventDefault();
          handleAnswer(pad.id);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [phase, problem, handleAnswer]);

  const startGame = useCallback(() => {
    setLives(START_LIVES);
    livesRef.current = START_LIVES;
    setScore(0);
    scoreRef.current = 0;
    setCombo(0);
    comboRef.current = 0;
    setMaxCombo(0);
    maxComboRef.current = 0;
    setFeverCount(0);
    feverCountRef.current = 0;
    setIsFever(false);
    isFeverRef.current = false;
    setLogs([]);
    logsRef.current = [];
    setFeedback(null);
    setSubmitResult(null);

    setPhase("playing");
    phaseRef.current = "playing";

    nextProblem(0);
  }, [nextProblem]);

  // 랭킹 탭 전환
  const handleScopeChange = useCallback(
    (scope: RankingScope) => {
      setRankingScope(scope);
      startTransition(async () => {
        try {
          const rows = await fetchGameRanking({
            contentKey: CONTENT_KEY,
            scope,
            mode: rankingMode,
          });
          setRanking(rows);
        } catch {
          /* rank safe */
        }
      });
    },
    [rankingMode],
  );

  const handleModeChange = useCallback(
    (mode: RankingMode) => {
      setRankingMode(mode);
      startTransition(async () => {
        try {
          const rows = await fetchGameRanking({
            contentKey: CONTENT_KEY,
            scope: rankingScope,
            mode,
          });
          setRanking(rows);
        } catch {
          /* rank safe */
        }
      });
    },
    [rankingScope],
  );

  // 결과 분석 데이터
  const performanceAnalysis = useMemo(() => {
    if (phase !== "ended") return null;
    return analyzeTrigPerformance(logs);
  }, [phase, logs]);

  // --- 화면 렌더링 ---

  // 1. Ready 화면
  if (phase === "ready") {
    return (
      <div className="relative mx-auto max-w-xl overflow-hidden rounded-3xl border border-wood/20 bg-wood/5 p-6 shadow-sm sm:p-8">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-wood/20 bg-wood/10 px-3 py-1 text-xs font-semibold text-foreground/75">
            <span>중3 · 3.1 삼각비</span>
            <span>•</span>
            <span className="text-wood">리듬 서바이벌</span>
          </div>

          <h1 className="mt-4 font-display text-3xl font-extrabold text-foreground sm:text-4xl">
            특수각 비트 탭
          </h1>
          <p className="mt-2 text-sm text-foreground/70 sm:text-base">
            0°부터 90°까지! 비트에 맞춰 특수각 삼각비를 탭하세요.
            <br />
            크기 순서대로 정렬된 패드로 직관적인 삼각비 감각을 깨웁니다.
          </p>
        </div>

        <div className="mt-6 rounded-2xl border border-wood/15 bg-white/60 p-4 dark:bg-black/20 sm:p-5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-wood">
            핵심 공략 팁
          </h2>
          <ul className="mt-2.5 space-y-2 text-xs leading-relaxed text-foreground/85 sm:text-sm">
            <li className="flex items-start gap-2">
              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-blue-600 font-bold text-xs">
                1
              </span>
              <span>
                <strong>사인(sin)</strong>은 각도가 커질수록 값이 커져서{" "}
                <span className="text-blue-600 font-semibold">오른쪽</span> 패드! (0°=0 → 90°=1)
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-500/15 text-purple-600 font-bold text-xs">
                2
              </span>
              <span>
                <strong>코사인(cos)</strong>은 사인의 거울상! 각도가 커질수록{" "}
                <span className="text-purple-600 font-semibold">왼쪽</span> 패드! (0°=1 → 90°=0)
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 font-bold text-xs">
                3
              </span>
              <span>
                <strong>탄젠트(tan)</strong>는 폭발적으로 커짐! (단,{" "}
                <strong className="text-emerald-700 underline">90°는 값이 없으므로 제외</strong>)
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 font-bold text-xs">
                4
              </span>
              <span>
                생명은 3개! 콤보가 쌓일수록 속도가 빨라지며 언젠가는 한계에 다다릅니다.
              </span>
            </li>
          </ul>

          <div className="mt-4 border-t border-wood/10 pt-3 text-[11px] text-foreground/60">
            💡 데스크톱에서는 키보드 숫자키 <kbd className="rounded border bg-wood/10 px-1 py-0.5 font-mono text-xs">1</kbd> ~ <kbd className="rounded border bg-wood/10 px-1 py-0.5 font-mono text-xs">5</kbd> 로 신속하게 탭할 수 있습니다!
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={toggleMute}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-wood/20 bg-white/50 px-3 py-2 text-xs font-semibold text-foreground/70 transition hover:bg-white/80 dark:bg-black/20"
          >
            {muted ? "🔇 효과음 켜기" : "🔊 효과음 끄기"}
          </button>

          <button
            type="button"
            onClick={startGame}
            className="inline-flex flex-1 items-center justify-center rounded-2xl bg-wood px-6 py-3.5 text-base font-bold text-white shadow-md transition-all hover:bg-wood-dark hover:shadow-lg active:scale-98"
          >
            게임 시작하기 ⚡
          </button>
        </div>
      </div>
    );
  }

  // 2. Ended (게임 오버 / 결과) 화면
  if (phase === "ended") {
    const s = performanceAnalysis?.summary;
    const fnStats = performanceAnalysis?.fnStats;

    return (
      <div className="mx-auto max-w-xl space-y-6 rounded-3xl border border-wood/20 bg-wood/5 p-6 shadow-sm sm:p-8">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1 text-xs font-bold text-rose-600">
            GAME OVER
          </div>
          <h2 className="mt-2 font-display text-3xl font-extrabold text-foreground sm:text-4xl">
            도전 종료!
          </h2>
          <div className="mt-3 flex items-baseline justify-center gap-1">
            <span className="font-display text-5xl font-black text-wood sm:text-6xl">
              {score}
            </span>
            <span className="text-sm font-bold text-foreground/50">점</span>
          </div>

          {submitResult ? (
            submitResult.recorded ? (
              <p className="mt-1 text-xs font-semibold text-emerald-600">
                +{submitResult.xpAwarded ?? score} XP 획득!
              </p>
            ) : (
              <p className="mt-2 rounded-xl bg-wood/5 px-3 py-2 text-xs font-medium text-foreground/60">
                연습 모드 · 학급 배정·활성화된 수업이면 XP와 랭킹이 기록됩니다.
              </p>
            )
          ) : (
            <p className="mt-1 text-[11px] text-foreground/45">
              학급에 배정·활성화된 수업이면 점수만큼 XP가 누적됩니다.
            </p>
          )}
        </div>

        {/* 요약 카드 */}
        <div className="grid grid-cols-3 gap-2 text-center sm:gap-3">
          <div className="rounded-2xl border border-wood/15 bg-white/70 p-3 dark:bg-black/20">
            <div className="text-[11px] font-semibold text-foreground/55">
              맞힌 문제
            </div>
            <div className="mt-1 font-display text-2xl font-black text-foreground">
              {s?.cleared ?? 0}
            </div>
          </div>
          <div className="rounded-2xl border border-wood/15 bg-white/70 p-3 dark:bg-black/20">
            <div className="text-[11px] font-semibold text-foreground/55">
              최대 콤보
            </div>
            <div className="mt-1 font-display text-2xl font-black text-amber-600">
              {maxCombo}
            </div>
          </div>
          <div className="rounded-2xl border border-wood/15 bg-white/70 p-3 dark:bg-black/20">
            <div className="text-[11px] font-semibold text-foreground/55">
              정확도
            </div>
            <div className="mt-1 font-display text-2xl font-black text-emerald-600">
              {s?.accuracy ?? 0}%
            </div>
          </div>
        </div>

        {/* 삼각비 함수별 정답률 & 코칭 피드백 */}
        {fnStats && (
          <div className="rounded-2xl border border-wood/15 bg-white/70 p-4 dark:bg-black/20">
            <h3 className="text-xs font-bold uppercase tracking-wider text-wood">
              함수별 숙련도
            </h3>
            <div className="mt-3 space-y-2.5">
              {(["sin", "cos", "tan"] as TrigFn[]).map((fn) => {
                const stat = fnStats[fn];
                const theme = FN_THEME[fn];
                return (
                  <div key={fn} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span className="flex items-center gap-1.5">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${theme.badge}`}
                        >
                          {fn}
                        </span>
                        <span>{theme.label}</span>
                      </span>
                      <span className="font-mono text-foreground/75">
                        {stat.correct}/{stat.total} ({stat.rate}%)
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-wood/10">
                      <div
                        className={`h-full transition-all duration-500 ${
                          fn === "sin"
                            ? "bg-blue-500"
                            : fn === "cos"
                            ? "bg-purple-500"
                            : "bg-emerald-500"
                        }`}
                        style={{ width: `${stat.rate}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {performanceAnalysis?.feedbackMessage && (
              <div className="mt-3.5 rounded-xl border border-wood/10 bg-wood/5 p-3 text-xs leading-relaxed text-foreground/80">
                💬 {performanceAnalysis.feedbackMessage}
              </div>
            )}
          </div>
        )}

        {/* 랭킹 보드 */}
        <div className="rounded-2xl border border-wood/15 bg-white/60 p-4 dark:bg-black/20">
          <GameRankingBoard
            rows={ranking}
            scope={rankingScope}
            mode={rankingMode}
            onScopeChange={handleScopeChange}
            onModeChange={handleModeChange}
            loading={isPending}
          />
        </div>

        {/* 액션 버튼 */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={startGame}
            className="flex-1 rounded-2xl bg-wood py-3.5 text-center text-sm font-bold text-white shadow-md transition hover:bg-wood-dark"
          >
            다시 도전하기 ⚡
          </button>
        </div>
      </div>
    );
  }

  // 3. Playing 화면
  if (!problem) return null;

  const fnTheme = FN_THEME[problem.fn];
  const timeRatio = Math.max(0, timeLeft / problem.timeLimitSec);
  const isUrgent = timeRatio < 0.3;

  return (
    <div
      className={[
        "relative mx-auto max-w-xl select-none overflow-hidden rounded-3xl border border-wood/20 bg-wood/5 p-5 shadow-md transition-colors sm:p-7",
        isFever ? "trigo-beat-fever-bg border-amber-400/50" : "",
        shake ? "trigo-beat-shake" : "",
      ].join(" ")}
    >
      {/* 상단 상태 바 */}
      <div className="flex items-center justify-between border-b border-wood/15 pb-4">
        <Hearts lives={lives} max={MAX_LIVES} />

        {/* 콤보 및 피버 표시 */}
        <div className="flex items-center gap-2">
          {combo > 1 && (
            <div className="trigo-beat-combo flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-black text-amber-600">
              <span>🔥</span>
              <span>{combo} COMBO</span>
            </div>
          )}
          {isFever && (
            <div className="animate-pulse rounded-full bg-gradient-to-r from-amber-500 to-rose-500 px-3 py-0.5 text-xs font-black tracking-wider text-white shadow-sm">
              FEVER {feverSecondsLeft}s
            </div>
          )}
        </div>

        {/* 현재 점수 & 음소거 */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="font-mono text-xl font-black text-wood sm:text-2xl">
              {score}
            </span>
            <span className="text-[10px] text-foreground/50"> pt</span>
          </div>
          <button
            type="button"
            onClick={toggleMute}
            className="rounded-lg border border-wood/20 bg-white/60 p-1.5 text-xs text-foreground/70 transition hover:bg-white dark:bg-black/30"
            aria-label={muted ? "음소거 해제" : "음소거"}
          >
            {muted ? "🔇" : "🔊"}
          </button>
        </div>
      </div>

      {/* 중앙 미션 카드 영역 */}
      <div className="relative my-6 flex flex-col items-center justify-center rounded-3xl border border-wood/15 bg-white/80 py-8 shadow-sm dark:bg-black/40">
        {/* 페이즈 & 함수 라벨 */}
        <div className="mb-2 flex items-center gap-2">
          <span className="rounded-md border border-wood/20 bg-wood/10 px-2 py-0.5 text-[11px] font-semibold text-foreground/70">
            Phase {problem.phase}
          </span>
          <span
            className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${fnTheme.badge}`}
          >
            {fnTheme.label}
          </span>
        </div>

        {/* 대형 LaTeX 미션 프롬프트 */}
        <div className="trigo-beat-pop my-2 flex items-center justify-center text-center">
          <Latex
            latex={problem.promptLatex}
            className={`font-display text-5xl font-black tracking-wide sm:text-6xl ${fnTheme.text}`}
          />
        </div>

        {/* 판정 피드백 플로팅 텍스트 */}
        {feedback && (
          <div className="trigo-beat-pop absolute inset-x-0 bottom-3 flex items-center justify-center">
            <span
              className={[
                "rounded-full px-4 py-1 text-sm font-black shadow-md",
                feedback.kind === "perfect"
                  ? "bg-amber-500 text-white"
                  : feedback.kind === "great"
                  ? "bg-emerald-500 text-white"
                  : "bg-rose-500 text-white",
              ].join(" ")}
            >
              {feedback.text}{" "}
              {feedback.scoreGain ? `+${feedback.scoreGain}` : ""}
            </span>
          </div>
        )}
      </div>

      {/* 타임 바 (Time Bar) */}
      <div className="mb-5 space-y-1">
        <div className="flex justify-between text-[11px] font-medium text-foreground/50">
          <span>TIME</span>
          <span>{timeLeft.toFixed(1)}s</span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-wood/15 p-0.5">
          <div
            className={[
              "h-full rounded-full transition-all duration-75",
              isUrgent
                ? "bg-rose-500 animate-pulse"
                : isFever
                ? "bg-gradient-to-r from-amber-400 to-rose-400"
                : "bg-wood",
            ].join(" ")}
            style={{ width: `${timeRatio * 100}%` }}
          />
        </div>
      </div>

      {/* 하단 크기 순 건반형 패드 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[11px] text-foreground/50 px-1">
          <span>작은 값 (0)</span>
          <span className="font-semibold text-foreground/75">
            {problem.fn === "sin"
              ? "sin: 각이 커질수록 오른쪽 →"
              : problem.fn === "cos"
              ? "cos: 각이 커질수록 왼쪽 ←"
              : "tan: 각이 커질수록 오른쪽 →"}
          </span>
          <span>큰 값</span>
        </div>

        <div
          className={`grid gap-2 ${
            problem.pads.length === 4 ? "grid-cols-4" : "grid-cols-5"
          }`}
        >
          {problem.pads.map((pad, idx) => {
            const isWrong = wrongPadId === pad.id;
            const isCorrectHighlight = correctHighlightPadId === pad.id;

            // Phase 1 가이드 힌트 (초반 학습용)
            let guideHint = "";
            if (problem.showGuideHint && problem.fn === "sin") {
              const angles = [0, 30, 45, 60, 90];
              guideHint = `${angles[idx]}°`;
            }

            return (
              <button
                key={pad.id}
                type="button"
                onClick={() => handleAnswer(pad.id)}
                className={[
                  "group relative flex flex-col items-center justify-center rounded-2xl border py-4 sm:py-5 px-1 transition-all duration-150 active:scale-95",
                  isCorrectHighlight
                    ? "border-emerald-500 bg-emerald-500/20 ring-2 ring-emerald-500"
                    : isWrong
                    ? "border-rose-500 bg-rose-500/20 animate-shake"
                    : "border-wood/20 bg-white shadow-sm hover:border-wood/40 hover:bg-wood/5 dark:bg-black/40",
                ].join(" ")}
              >
                {/* 단축키 뱃지 (1~5) */}
                <span className="absolute left-1.5 top-1.5 rounded border border-wood/15 bg-wood/5 px-1 py-0.2 text-[9px] font-mono text-foreground/50">
                  {idx + 1}
                </span>

                {/* 가이드 힌트 라벨 */}
                {guideHint && (
                  <span className="text-[10px] font-bold text-blue-600/75 -mt-1 mb-1">
                    {guideHint}
                  </span>
                )}

                {/* 삼각비 수식 값 (LaTeX) */}
                <Latex
                  latex={pad.latex}
                  className="font-display text-lg font-bold text-foreground group-hover:scale-105 transition-transform sm:text-xl"
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
