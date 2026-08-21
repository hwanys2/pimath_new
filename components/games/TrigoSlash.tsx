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
import TrigoSlashScene, {
  type Shard,
} from "@/components/games/TrigoSlashScene";
import {
  submitGameRun,
  fetchGameRanking,
  type GameSubmitClientResult,
} from "@/app/adventure/actions";
import { activityDetailsV1 } from "@/lib/activity-result-schemas";
import {
  CONTENT_KEY,
  FEVER_COMBO,
  FEVER_SEC,
  FN_FORMULA,
  HINT_MAX,
  HINT_SEC,
  MAX_LIVES,
  ROLE_LABEL,
  START_LIVES,
  TRIG_FNS,
  applyScoreGain,
  clampScore,
  centroid,
  dealRound,
  evaluateSlash,
  missionLatex,
  missionPlain,
  pointsForHit,
  rotateVertices,
  sidesForRatio,
  splitConvexByLine,
  trianglePoints,
  type Point,
  type ResultKind,
  type Round,
  type RoundLog,
  type VertexMap,
} from "@/lib/trigo-slash-math";

type Phase = "ready" | "playing" | "ended";
type Flash = "hit" | "miss" | "reverse" | null;

const MUTE_KEY = "pm_trigo_slash_mute";

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
            "inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-black transition",
            i < lives
              ? "bg-[#e85d4c] text-white shadow-sm"
              : "bg-wood/10 text-wood/25",
          ].join(" ")}
          aria-hidden
        >
          ♥
        </span>
      ))}
    </div>
  );
}

function playCue(
  kind: "hit" | "miss" | "reverse" | "fever",
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
  if (kind === "hit") {
    osc.type = "triangle";
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1320, now + 0.08);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.start(now);
    osc.stop(now + 0.18);
  } else if (kind === "fever") {
    osc.type = "sine";
    osc.frequency.setValueAtTime(523, now);
    osc.frequency.setValueAtTime(659, now + 0.08);
    osc.frequency.setValueAtTime(784, now + 0.16);
    gain.gain.setValueAtTime(0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
    osc.start(now);
    osc.stop(now + 0.34);
  } else if (kind === "reverse") {
    osc.type = "sine";
    osc.frequency.setValueAtTime(420, now);
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.start(now);
    osc.stop(now + 0.16);
  } else {
    osc.type = "square";
    osc.frequency.setValueAtTime(180, now);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.start(now);
    osc.stop(now + 0.2);
  }
  window.setTimeout(() => void ctx.close(), 500);
  } catch {
    /* autoplay / closed context */
  }
}

function makeShards(verts: VertexMap, slash: Point[]): Shard[] | null {
  if (slash.length < 2) return null;
  const split = splitConvexByLine(
    trianglePoints(verts),
    slash[0]!,
    slash[slash.length - 1]!,
  );
  if (!split) return null;
  const c = centroid(verts);
  return split.map((points, i) => {
    const pc = {
      x: points.reduce((s, p) => s + p.x, 0) / points.length,
      y: points.reduce((s, p) => s + p.y, 0) / points.length,
    };
    return {
      points,
      dx: (pc.x - c.x) * 0.7,
      dy: (pc.y - c.y) * 0.7,
      rot: i === 0 ? -18 : 16,
    };
  });
}

function resultKo(kind: ResultKind): string {
  switch (kind) {
    case "hit":
      return "맞춤";
    case "reverse":
      return "순서 반대";
    case "timeout":
      return "시간 초과";
    default:
      return "오답";
  }
}

export default function TrigoSlash() {
  const [phase, setPhase] = useState<Phase>("ready");
  const [lives, setLives] = useState(START_LIVES);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [cleared, setCleared] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [feverCount, setFeverCount] = useState(0);
  const [hintsLeft, setHintsLeft] = useState(HINT_MAX);
  const [round, setRound] = useState<Round | null>(null);
  const [verts, setVerts] = useState<VertexMap | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [feverLeft, setFeverLeft] = useState(0);
  const [hintLeft, setHintLeft] = useState(0);
  const [flash, setFlash] = useState<Flash>(null);
  const [shards, setShards] = useState<Shard[] | null>(null);
  const [burst, setBurst] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState("");
  const [muted, setMuted] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(MUTE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [reducedMotion, setReducedMotion] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });
  const [logs, setLogs] = useState<RoundLog[]>([]);
  const [locked, setLocked] = useState(false);
  const [submitResult, setSubmitResult] =
    useState<GameSubmitClientResult | null>(null);
  const [ranking, setRanking] = useState<RankingRow[]>([]);
  const [rankingScope, setRankingScope] = useState<RankingScope>("class");
  const [rankingMode, setRankingMode] = useState<RankingMode>("best");
  const [isPending, startTransition] = useTransition();

  const phaseRef = useRef(phase);
  const livesRef = useRef(lives);
  const scoreRef = useRef(score);
  const streakRef = useRef(streak);
  const clearedRef = useRef(cleared);
  const maxComboRef = useRef(0);
  const feverCountRef = useRef(0);
  const hintsUsedRef = useRef(0);
  const missesRef = useRef(0);
  const reverseCountRef = useRef(0);
  const roundRef = useRef<Round | null>(null);
  const vertsRef = useRef<VertexMap | null>(null);
  const spinRef = useRef(0);
  const freezeSpinRef = useRef(false);
  const resolvingRef = useRef(false);
  const endingRef = useRef(false);
  const timeLeftRef = useRef(0);
  const feverUntilRef = useRef(0);
  const hintUntilRef = useRef(0);
  const logsRef = useRef<RoundLog[]>([]);
  const mutedRef = useRef(false);
  const reducedMotionRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef(0);
  const nextTimerRef = useRef<number | null>(null);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);
  useEffect(() => {
    reducedMotionRef.current = reducedMotion;
  }, [reducedMotion]);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    livesRef.current = lives;
  }, [lives]);
  useEffect(() => {
    scoreRef.current = score;
  }, [score]);
  useEffect(() => {
    streakRef.current = streak;
  }, [streak]);
  useEffect(() => {
    clearedRef.current = cleared;
  }, [cleared]);
  useEffect(() => {
    roundRef.current = round;
  }, [round]);
  useEffect(() => {
    vertsRef.current = verts;
  }, [verts]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const toggleMute = () => {
    setMuted((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(MUTE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const spawnRound = useCallback((clearedCount: number) => {
    const next = dealRound(clearedCount);
    spinRef.current = 0;
    freezeSpinRef.current = false;
    resolvingRef.current = false;
    roundRef.current = next;
    vertsRef.current = next.vertices;
    timeLeftRef.current = next.timeLimitSec;
    setRound(next);
    setVerts(next.vertices);
    setTimeLeft(next.timeLimitSec);
    setFlash(null);
    setShards(null);
    setBurst(null);
    setLocked(false);
    if (next.isBoss) {
      setStatusMsg("보스! 삼각형이 돌아요. 직각 □ 과 기준각부터 보세요.");
    } else if (clearedCount < 2) {
      setStatusMsg(
        `${FN_FORMULA[next.fn]} 순서대로 두 변을 한 획으로 베세요.`,
      );
    } else {
      setStatusMsg("기준각에서 높이·밑변·빗변을 찾아 베세요.");
    }
  }, []);

  const endGame = useCallback((finalScore: number) => {
    if (endingRef.current) return;
    endingRef.current = true;
    resolvingRef.current = true;
    setPhase("ended");
    phaseRef.current = "ended";
    setShards(null);
    startTransition(async () => {
      const attempts = clearedRef.current + missesRef.current;
      const accuracy =
        attempts > 0
          ? Math.round((clearedRef.current / attempts) * 100)
          : 0;
      const result = await submitGameRun({
        contentKey: CONTENT_KEY,
        score: finalScore,
        details: activityDetailsV1(
          {
            cleared: clearedRef.current,
            maxCombo: maxComboRef.current,
            feverCount: feverCountRef.current,
            accuracy,
            hintsUsed: hintsUsedRef.current,
            reverseCount: reverseCountRef.current,
          },
          logsRef.current.slice(-16).map((row) => ({
            i: row.i,
            mission: row.mission,
            result: row.result,
            shape: row.shape,
            spin: row.spin,
            boss: row.boss,
          })),
        ),
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
  }, [startTransition]);

  const pushLog = (result: ResultKind) => {
    const r = roundRef.current;
    if (!r) return;
    const row: RoundLog = {
      i: logsRef.current.length + 1,
      mission: missionPlain(r.fn, r.refAt),
      result,
      shape: r.shape,
      spin: r.spinSpeed !== 0,
      boss: r.isBoss,
    };
    const next = [...logsRef.current, row];
    logsRef.current = next;
    setLogs(next);
  };

  const loseLife = useCallback((kind: ResultKind) => {
    const nextLives = Math.max(0, livesRef.current - 1);
    livesRef.current = nextLives;
    setLives(nextLives);
    streakRef.current = 0;
    setStreak(0);
    feverUntilRef.current = 0;
    setFeverLeft(0);
    missesRef.current += 1;
    pushLog(kind);
    if (nextLives <= 0) {
      window.setTimeout(() => endGame(scoreRef.current), 700);
      return true;
    }
    return false;
  }, [endGame]);

  const scheduleNext = useCallback((delay: number) => {
    if (nextTimerRef.current != null) window.clearTimeout(nextTimerRef.current);
    nextTimerRef.current = window.setTimeout(() => {
      nextTimerRef.current = null;
      if (phaseRef.current !== "playing" || livesRef.current <= 0) return;
      spawnRound(clearedRef.current);
    }, delay);
  }, [spawnRound]);

  const onStrokeStart = useCallback(() => {
    freezeSpinRef.current = true;
  }, []);

  const onStrokeEnd = useCallback((pts: Point[]) => {
    if (phaseRef.current !== "playing" || resolvingRef.current) return;
    const r = roundRef.current;
    const v = vertsRef.current;
    if (!r || !v) return;
    freezeSpinRef.current = false;
    const target = sidesForRatio(r.fn, r.rightAt, r.refAt);
    const evald = evaluateSlash(pts, v, target, r.refAt);
    if (evald.verdict === "incomplete") {
      setStatusMsg("변의 한가운데를 지나게, 두 변을 이어서 베세요.");
      return;
    }

    resolvingRef.current = true;
    setLocked(true);
    const [numRole, denRole] =
      r.fn === "sin"
        ? (["opp", "hyp"] as const)
        : r.fn === "cos"
          ? (["adj", "hyp"] as const)
          : (["opp", "adj"] as const);

    if (evald.verdict === "reversed") {
      playCue("reverse", mutedRef.current);
      setFlash("reverse");
      setBurst("반대!");
      streakRef.current = 0;
      setStreak(0);
      feverUntilRef.current = 0;
      setFeverLeft(0);
      setStatusMsg(
        `순서가 반대예요! ${r.fn} ${r.refAt} = ${ROLE_LABEL[denRole]} → ${ROLE_LABEL[numRole]}`,
      );
      reverseCountRef.current += 1;
      pushLog("reverse");
      window.setTimeout(() => {
        if (phaseRef.current !== "playing") return;
        setFlash(null);
        setBurst(null);
        resolvingRef.current = false;
        setLocked(false);
      }, 700);
      return;
    }

    if (evald.verdict === "wrong") {
      playCue("miss", mutedRef.current);
      setFlash("miss");
      setBurst("땡!");
      setStatusMsg(
        `다른 변이에요. ${r.fn} ${r.refAt} 은 ${ROLE_LABEL[denRole]} 다음 ${ROLE_LABEL[numRole]}!`,
      );
      const over = loseLife("miss");
      if (!over) scheduleNext(720);
      return;
    }

    const now = performance.now();
    const fever = now < feverUntilRef.current;
    const speedRatio =
      r.timeLimitSec > 0 ? timeLeftRef.current / r.timeLimitSec : 0;
    const raw = pointsForHit({
      streakBefore: streakRef.current,
      fever,
      speedRatio,
      startedNearRef: evald.startedNearRef,
      isBoss: r.isBoss,
    });
    const nextScore = applyScoreGain(scoreRef.current, raw);
    const gained = nextScore - scoreRef.current;
    scoreRef.current = nextScore;
    setScore(nextScore);

    const nextStreak = streakRef.current + 1;
    streakRef.current = nextStreak;
    setStreak(nextStreak);
    if (nextStreak > maxComboRef.current) {
      maxComboRef.current = nextStreak;
      setMaxCombo(nextStreak);
    }

    let justFever = false;
    if (nextStreak > 0 && nextStreak % FEVER_COMBO === 0) {
      feverUntilRef.current = now + FEVER_SEC * 1000;
      justFever = true;
      feverCountRef.current += 1;
      setFeverCount(feverCountRef.current);
      playCue("fever", mutedRef.current);
    } else {
      playCue("hit", mutedRef.current);
    }

    const nextCleared = clearedRef.current + 1;
    clearedRef.current = nextCleared;
    setCleared(nextCleared);
    pushLog("hit");
    setFlash("hit");
    setBurst(justFever ? "피버!" : "챙!");
    setShards(reducedMotionRef.current ? null : makeShards(v, pts));
    const extra = evald.startedNearRef ? " 기준각에서 출발 보너스!" : "";
    setStatusMsg(
      `${ROLE_LABEL[numRole]} → ${ROLE_LABEL[denRole]}  · +${gained}점${extra}`,
    );
    scheduleNext(justFever ? 900 : 680);
  }, [loseLife, scheduleNext]);

  const useHint = () => {
    if (phase !== "playing" || resolvingRef.current) return;
    if (hintsLeft <= 0) return;
    if (performance.now() < hintUntilRef.current) return;
    const left = hintsLeft - 1;
    setHintsLeft(left);
    hintsUsedRef.current += 1;
    hintUntilRef.current = performance.now() + HINT_SEC * 1000;
    setHintLeft(HINT_SEC);
    setStatusMsg("높이(맞은편) · 밑변(맞닿은 변) · 빗변(직각 맞은편)을 색으로 봤어요.");
  };

  const startGame = () => {
    endingRef.current = false;
    resolvingRef.current = false;
    freezeSpinRef.current = false;
    livesRef.current = START_LIVES;
    scoreRef.current = 0;
    streakRef.current = 0;
    clearedRef.current = 0;
    maxComboRef.current = 0;
    feverCountRef.current = 0;
    hintsUsedRef.current = 0;
    missesRef.current = 0;
    reverseCountRef.current = 0;
    logsRef.current = [];
    feverUntilRef.current = 0;
    hintUntilRef.current = 0;
    setLives(START_LIVES);
    setScore(0);
    setStreak(0);
    setCleared(0);
    setMaxCombo(0);
    setFeverCount(0);
    setHintsLeft(HINT_MAX);
    setLogs([]);
    setFeverLeft(0);
    setHintLeft(0);
    setSubmitResult(null);
    setRanking([]);
    setRankingScope("class");
    setRankingMode("best");
    setPhase("playing");
    phaseRef.current = "playing";
    spawnRound(0);
  };

  useEffect(() => {
    if (phase !== "playing") {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }
    lastTsRef.current = 0;
    const tick = (ts: number) => {
      if (phaseRef.current !== "playing") return;
      if (!lastTsRef.current) lastTsRef.current = ts;
      const dt = Math.min(0.05, (ts - lastTsRef.current) / 1000);
      lastTsRef.current = ts;
      const r = roundRef.current;
      const reduce = reducedMotionRef.current;
      if (r && !freezeSpinRef.current && !resolvingRef.current && r.spinSpeed !== 0 && !reduce) {
        spinRef.current += r.spinSpeed * dt;
        const spun = rotateVertices(r.vertices, spinRef.current);
        vertsRef.current = spun;
        setVerts(spun);
      }
      if (!resolvingRef.current && r) {
        const nextT = Math.max(0, timeLeftRef.current - dt);
        timeLeftRef.current = nextT;
        setTimeLeft(nextT);
        if (nextT <= 0) {
          resolvingRef.current = true;
          setLocked(true);
          playCue("miss", mutedRef.current);
          setFlash("miss");
          setBurst("시간 초과!");
          setStatusMsg("시간이 다 됐어요. 직각과 기준각을 먼저 찾아 보세요.");
          const over = loseLife("timeout");
          if (!over) scheduleNext(720);
        }
      }
      const feverRemain = Math.max(0, (feverUntilRef.current - ts) / 1000);
      if (feverUntilRef.current > 0) {
        setFeverLeft(feverRemain);
        if (feverRemain <= 0) feverUntilRef.current = 0;
      }
      const hintRemain = Math.max(0, (hintUntilRef.current - ts) / 1000);
      if (hintUntilRef.current > 0) {
        setHintLeft(hintRemain);
        if (hintRemain <= 0) hintUntilRef.current = 0;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [phase, loseLife, scheduleNext]);

  useEffect(() => {
    return () => {
      if (nextTimerRef.current != null) window.clearTimeout(nextTimerRef.current);
    };
  }, []);

  const loadRanking = (next: { scope?: RankingScope; mode?: RankingMode }) => {
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

  const fever = feverLeft > 0;
  const showRoles = Boolean(
    round?.showOrderHints || hintLeft > 0,
  );
  const timePct =
    round && round.timeLimitSec > 0
      ? Math.max(0, Math.min(100, (timeLeft / round.timeLimitSec) * 100))
      : 0;

  return (
    <div className="flex flex-col gap-5">
      <section className="quest-card bg-gradient-to-br from-lavender/45 via-sky/20 to-gold/25 p-5 sm:p-7">
        <p className="text-sm font-bold text-wood">중3 · 3.1 삼각비</p>
        <h1 className="font-display mt-1 text-3xl text-foreground sm:text-4xl">
          삼각비 슬래시
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-foreground/75 sm:text-base">
          돌아가거나 뒤집힌 직각삼각형에서 기준각의{" "}
          <strong>높이 · 밑변 · 빗변</strong>을 찾아, 삼각비의 분모→분자 순서로
          한 획에 베세요. 화면의 아래쪽이 항상 밑변이 아니에요!
        </p>
      </section>

      {phase === "ready" ? (
        <section className="quest-card border-lavender/40 bg-gradient-to-br from-lavender/30 via-sky/20 to-gold/20 p-5 sm:p-8">
          <TutorialDiagram />
          <ol className="mx-auto mt-6 max-w-lg space-y-3 text-left text-sm font-semibold text-foreground/80 sm:text-base">
            <li className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-lavender font-black text-wood">
                1
              </span>
              <span>
                직각 표시(□)와 빨간 호가 있는 <strong>기준각</strong>을 먼저
                봐요.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky font-black text-wood">
                2
              </span>
              <span>
                <Latex latex="\sin A" /> 이면 <strong>빗변 → 높이</strong> 순서로
                두 변을 이어서 베요. (분모분에 분자!) 순서가 반대면 다시 그을 수
                있어요.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold font-black text-wood">
                3
              </span>
              <span>
                10연속이면 피버(점수 2배)! 생명 3개가 끝나면 한 판이 끝나요.
              </span>
            </li>
          </ol>
          <button
            type="button"
            onClick={startGame}
            className="mt-8 rounded-xl bg-wood px-8 py-3.5 text-lg font-bold text-cream shadow-md transition hover:bg-wood-dark active:scale-[0.98]"
          >
            베러 가기
          </button>
        </section>
      ) : null}

      {phase === "ended" ? (
        <section
          className="quest-card border-lavender/40 bg-gradient-to-br from-lavender/40 via-sky/20 to-gold/30 p-5 text-center sm:p-7"
          role="status"
          aria-live="polite"
        >
          <p className="font-display text-3xl text-wood sm:text-4xl">
            {clampScore(score)}점
          </p>
          <p className="mt-2 text-sm font-semibold text-foreground/70">
            {cleared}개 성공 · 최고 콤보 {maxCombo}
            {feverCount > 0 ? ` · 피버 ${feverCount}회` : ""}
          </p>

          {logs.length > 0 ? (
            <p className="mt-1 text-xs font-semibold text-foreground/50">
              {logs
                .slice(-6)
                .map((row) => `${row.mission} ${resultKo(row.result)}`)
                .join(" · ")}
            </p>
          ) : null}

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
            onClick={() => {
              setPhase("ready");
              phaseRef.current = "ready";
              setRound(null);
            }}
            className="mt-6 rounded-xl bg-wood px-6 py-3 text-base font-bold text-cream"
          >
            다시 하기
          </button>
        </section>
      ) : null}

      {phase === "playing" && round && verts ? (
        <>
          <section className="quest-card-static overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-wood/10 px-4 py-3 sm:px-5">
              <Hearts lives={lives} max={MAX_LIVES} />
              <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-wood">
                <span className="rounded-xl bg-gold/50 px-3 py-1">
                  {score}점
                </span>
                <span className="rounded-xl bg-lavender/40 px-3 py-1">
                  성공 {cleared}
                </span>
                {streak > 1 ? (
                  <span className="rounded-xl bg-sky/50 px-3 py-1">
                    연속 {streak}
                  </span>
                ) : null}
                {fever ? (
                  <span className="rounded-xl bg-[#e85d4c] px-3 py-1 text-white">
                    피버 ×2 {feverLeft.toFixed(0)}초
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={useHint}
                  disabled={hintsLeft <= 0 || hintLeft > 0}
                  className="rounded-lg bg-lavender/50 px-3 py-1.5 text-xs font-bold text-wood disabled:opacity-40"
                >
                  색 힌트 {hintsLeft}
                </button>
                <button
                  type="button"
                  onClick={toggleMute}
                  className="rounded-lg bg-wood/8 px-3 py-1.5 text-xs font-bold text-wood"
                  aria-pressed={muted}
                >
                  {muted ? "소리 켜기" : "소리 끄기"}
                </button>
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-1.5 border-b border-wood/10 bg-white/40 px-3 py-2">
              {TRIG_FNS.map((fn) => (
                <span
                  key={fn}
                  className={[
                    "rounded-full px-3 py-1 text-[11px] font-bold sm:text-xs",
                    round.fn === fn
                      ? "bg-wood text-cream"
                      : "bg-wood/8 text-wood/70",
                  ].join(" ")}
                >
                  {fn} = {FN_FORMULA[fn]}
                </span>
              ))}
            </div>

            <div className="border-b border-wood/10 px-4 py-2 sm:px-5">
              <div className="flex items-center justify-between text-xs font-semibold text-foreground/55">
                <span>남은 시간</span>
                <span className="tabular-nums">
                  {timeLeft.toFixed(1)}초 / {round.timeLimitSec.toFixed(1)}초
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-wood/10">
                <div
                  className={[
                    "h-full rounded-full",
                    timePct < 30 ? "bg-[#e85d4c]" : "bg-mint",
                  ].join(" ")}
                  style={{ width: `${timePct}%` }}
                />
              </div>
            </div>

            <div className="px-4 pt-3 pb-1 text-center sm:px-5">
              <p
                key={`${cleared}-${round.fn}-${round.refAt}-${round.isBoss ? "b" : "n"}`}
                className="font-display text-3xl text-wood trigo-slash-mission sm:text-4xl"
                aria-live="polite"
              >
                <Latex latex={missionLatex(round.fn, round.refAt)} />
                {round.isBoss ? (
                  <span className="ml-2 align-middle text-sm font-bold text-[#a63a1a]">
                    BOSS
                  </span>
                ) : null}
              </p>
            </div>

            <div
              className={[
                "relative mx-auto aspect-square w-full max-w-lg sm:max-w-xl",
                fever ? "trigo-slash-fever" : "",
                flash === "miss" ? "ring-4 ring-inset ring-[#e85d4c]/50" : "",
              ].join(" ")}
            >
              <TrigoSlashScene
                verts={verts}
                round={round}
                shards={shards}
                showRoles={showRoles}
                flash={flash}
                fever={fever}
                disabled={locked}
                reducedMotion={reducedMotion}
                onStrokeStart={onStrokeStart}
                onStrokeEnd={onStrokeEnd}
              />
              {burst ? (
                <span
                  className={[
                    "pointer-events-none absolute left-1/2 top-5 z-20 -translate-x-1/2",
                    "font-display text-4xl drop-shadow-md trigo-slash-burst",
                    flash === "hit" || burst === "피버!"
                      ? "text-[#d4a017]"
                      : flash === "reverse"
                        ? "text-wood"
                        : "text-[#e85d4c]",
                  ].join(" ")}
                  aria-hidden
                >
                  {burst}
                </span>
              ) : null}
            </div>

            <p
              className="min-h-[2.5rem] border-t border-wood/10 bg-cream/60 px-4 py-2 text-center text-sm font-semibold text-foreground/70"
              role="status"
              aria-live="polite"
            >
              {statusMsg}
            </p>
          </section>
        </>
      ) : null}
    </div>
  );
}

function TutorialDiagram() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-2xl bg-white/55 px-4 py-4">
      <svg viewBox="0 0 100 78" className="h-40 w-full max-w-[16rem]">
        <polygon
          points="22,66 78,66 22,18"
          fill="rgba(168,216,255,0.45)"
          stroke="#8b5e3c"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <polyline
          points="22,58 30,58 30,66"
          fill="none"
          stroke="#8b5e3c"
          strokeWidth="1.3"
        />
        <path
          d="M 22 26 A 8 8 0 0 0 29.2 20.5"
          fill="none"
          stroke="#e85d4c"
          strokeWidth="1.4"
        />
        <text x="18" y="16" fontSize="7" fontWeight="800" fill="#e85d4c">
          A
        </text>
        <text x="80" y="72" fontSize="7" fontWeight="800" fill="#3d2c1e">
          B
        </text>
        <text x="14" y="72" fontSize="7" fontWeight="800" fill="#3d2c1e">
          C
        </text>
        <text x="50" y="74" fontSize="5.5" fontWeight="800" fill="#e85d4c">
          높이
        </text>
        <text x="8" y="44" fontSize="5.5" fontWeight="800" fill="#3d8fd9">
          밑변
        </text>
        <text x="58" y="38" fontSize="5.5" fontWeight="800" fill="#d4a017">
          빗변
        </text>
      </svg>
      <p className="text-center text-xs font-semibold leading-relaxed text-foreground/65 sm:text-sm">
        각 A가 위에 있으면 <span className="text-[#e85d4c]">높이</span>가{" "}
        <strong>아래 변</strong>이 돼요. 삼각형이 돌아도, 기준각의 맞은편이
        높이입니다.
      </p>
    </div>
  );
}
