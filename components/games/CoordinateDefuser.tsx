"use client";

import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
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
import { activityDetailsV1 } from "@/lib/activity-result-schemas";
import {
  START_LIVES,
  MAX_LIVES,
  type ActiveBomb,
  type BombExplosion,
  getDifficulty,
  spawnBombCoordinate,
  calculateDefuseScore,
  getQuadrantName,
  applyScoreGain,
} from "@/lib/coordinate-defuser-math";

const CONTENT_KEY = "g1-u2-3-coordinate-defuser";

type Phase = "ready" | "playing" | "ended";
type InputSlot = "x" | "y";
type InputMode = "pad" | "bar"; // "pad": numpad, "bar": quick axis selector buttons

function Volume2Icon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}

function VolumeXIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="22" y1="9" x2="16" y2="15" />
      <line x1="16" y1="9" x2="22" y2="15" />
    </svg>
  );
}

function ZapIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function TargetIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

// Sound synthesis using Web Audio API
class DefuserAudio {
  private ctx: AudioContext | null = null;
  public muted: boolean = false;

  private initCtx() {
    if (this.ctx) return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    } catch {
      // Audio not supported
    }
  }

  playDefuse(combo: number) {
    if (this.muted) return;
    this.initCtx();
    if (!this.ctx) return;

    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Laser zap tone
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";

    const baseFreq = 440 * Math.pow(1.06, Math.min(12, combo * 2));
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 2.2, now + 0.12);

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);

    // Chime pop
    const chime = ctx.createOscillator();
    const chimeGain = ctx.createGain();
    chime.type = "triangle";
    chime.frequency.setValueAtTime(baseFreq * 1.5, now + 0.05);
    chimeGain.gain.setValueAtTime(0.18, now + 0.05);
    chimeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    chime.connect(chimeGain);
    chimeGain.connect(ctx.destination);
    chime.start(now + 0.05);
    chime.stop(now + 0.35);
  }

  playExplosion() {
    if (this.muted) return;
    this.initCtx();
    if (!this.ctx) return;

    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Low rumble sub-bass
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(25, now + 0.45);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.5);
  }

  playAlarm() {
    if (this.muted) return;
    this.initCtx();
    if (!this.ctx) return;

    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.setValueAtTime(980, now + 0.06);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  playMiss() {
    if (this.muted) return;
    this.initCtx();
    if (!this.ctx) return;

    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.linearRampToValueAtTime(120, now + 0.15);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.18);
  }
}

const audio = new DefuserAudio();

export default function CoordinateDefuser() {
  const [phase, setPhase] = useState<Phase>("ready");
  const [lives, setLives] = useState(START_LIVES);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [defusedCount, setDefusedCount] = useState(0);
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [activeBombs, setActiveBombs] = useState<ActiveBomb[]>([]);
  const [explosions, setExplosions] = useState<BombExplosion[]>([]);
  const [screenShake, setScreenShake] = useState(false);
  const [missFlash, setMissFlash] = useState(false);
  const [muted, setMuted] = useState(false);

  // Input state
  const [inputSlot, setInputSlot] = useState<InputSlot>("x");
  const [xInput, setXInput] = useState<string>("");
  const [yInput, setYInput] = useState<string>("");
  const [inputMode, setInputMode] = useState<InputMode>("pad");

  // Status message
  const [statusMsg, setStatusMsg] = useState<string>("");

  // Server ranking
  const [submitResult, setSubmitResult] = useState<GameSubmitClientResult | null>(null);
  const [ranking, setRanking] = useState<RankingRow[]>([]);
  const [rankingScope, setRankingScope] = useState<RankingScope>("class");
  const [rankingMode, setRankingMode] = useState<RankingMode>("best");
  const [isPending, startTransition] = useTransition();

  // Animation frame and refs
  const idRef = useRef(1);
  const nextSpawnAtRef = useRef(0);
  const startedAtRef = useRef(0);
  const lastTsRef = useRef(0);
  const lastAlarmAtRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const endingRef = useRef(false);

  const activeBombsRef = useRef(activeBombs);
  const livesRef = useRef(lives);
  const scoreRef = useRef(score);
  const comboRef = useRef(combo);
  const maxComboRef = useRef(maxCombo);
  const defusedRef = useRef(defusedCount);
  const attemptsRef = useRef(totalAttempts);
  const phaseRef = useRef(phase);

  useEffect(() => {
    activeBombsRef.current = activeBombs;
  }, [activeBombs]);
  useEffect(() => {
    livesRef.current = lives;
  }, [lives]);
  useEffect(() => {
    scoreRef.current = score;
  }, [score]);
  useEffect(() => {
    comboRef.current = combo;
  }, [combo]);
  useEffect(() => {
    maxComboRef.current = maxCombo;
  }, [maxCombo]);
  useEffect(() => {
    defusedRef.current = defusedCount;
  }, [defusedCount]);
  useEffect(() => {
    attemptsRef.current = totalAttempts;
  }, [totalAttempts]);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // Handle Mute toggle
  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    audio.muted = next;
  };

  // End Game
  const endGame = useEffectEvent((finalScore: number) => {
    if (endingRef.current) return;
    endingRef.current = true;
    setPhase("ended");
    setStatusMsg("");

    const accuracy =
      attemptsRef.current > 0
        ? Math.round((defusedRef.current / attemptsRef.current) * 100)
        : 0;
    const diff = getDifficulty(
      defusedRef.current,
      (Date.now() - startedAtRef.current) / 1000,
    );

    startTransition(async () => {
      const result = await submitGameRun({
        contentKey: CONTENT_KEY,
        score: finalScore,
        details: activityDetailsV1({
          defused: defusedRef.current,
          maxCombo: maxComboRef.current,
          accuracy,
          stageReached: diff.stage,
        }),
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
  });

  // Main Loop
  const tick = useEffectEvent((ts: number) => {
    if (phaseRef.current !== "playing") return;

    if (!lastTsRef.current) lastTsRef.current = ts;
    const dt = Math.min(0.05, (ts - lastTsRef.current) / 1000);
    lastTsRef.current = ts;

    const elapsed = (ts - startedAtRef.current) / 1000;
    const diff = getDifficulty(defusedRef.current, elapsed);

    // Update active bomb fuses
    let bombs = activeBombsRef.current.map((b) => ({
      ...b,
      fuseLeft: b.fuseLeft - dt,
      isUrgent: b.fuseLeft - dt <= 1.5,
    }));

    // Alarm beep for urgent bombs
    const hasUrgent = bombs.some((b) => b.isUrgent);
    if (hasUrgent && ts - lastAlarmAtRef.current > 500) {
      audio.playAlarm();
      lastAlarmAtRef.current = ts;
    }

    // Check detonated bombs (fuse <= 0)
    const detonated = bombs.filter((b) => b.fuseLeft <= 0);
    if (detonated.length > 0) {
      const detIds = new Set(detonated.map((b) => b.id));
      bombs = bombs.filter((b) => !detIds.has(b.id));

      const lost = detonated.length;
      const nextLives = Math.max(0, livesRef.current - lost);
      livesRef.current = nextLives;
      setLives(nextLives);
      setCombo(0);
      comboRef.current = 0;

      // Audio & visual feedback
      audio.playExplosion();
      setScreenShake(true);
      window.setTimeout(() => setScreenShake(false), 450);

      // Add explosion animation
      const expList: BombExplosion[] = detonated.map((d) => ({
        id: idRef.current++,
        x: d.x,
        y: d.y,
        kind: "detonated",
        label: "폭발! -1♥",
        until: ts + 900,
      }));
      setExplosions((prev) => [...prev, ...expList]);

      setStatusMsg(
        lost === 1
          ? `(${detonated[0].x}, ${detonated[0].y}) 폭탄이 터졌습니다! 생명 -1`
          : `${lost}개의 폭탄이 터졌습니다! 생명 -${lost}`,
      );

      if (nextLives <= 0) {
        activeBombsRef.current = bombs;
        setActiveBombs(bombs);
        endGame(scoreRef.current);
        return;
      }
    }

    // Spawn new bomb if below limit and interval reached
    if (ts >= nextSpawnAtRef.current && bombs.length < diff.maxActiveBombs) {
      const id = idRef.current++;
      const coord = spawnBombCoordinate(diff.gridRange, bombs);
      bombs.push({
        id,
        x: coord.x,
        y: coord.y,
        totalFuse: diff.fuseSeconds,
        fuseLeft: diff.fuseSeconds,
        spawnedAt: ts,
        isUrgent: false,
      });
      nextSpawnAtRef.current = ts + diff.spawnIntervalSec * 1000;
    }

    activeBombsRef.current = bombs;
    setActiveBombs(bombs);

    // Clean up finished explosion visuals
    setExplosions((prev) => prev.filter((e) => e.until > ts));

    rafRef.current = requestAnimationFrame(tick);
  });

  const stopLoop = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    lastTsRef.current = 0;
  }, []);

  const startGame = useCallback(() => {
    stopLoop();
    endingRef.current = false;
    idRef.current = 1;
    setLives(START_LIVES);
    livesRef.current = START_LIVES;
    setScore(0);
    scoreRef.current = 0;
    setCombo(0);
    comboRef.current = 0;
    setMaxCombo(0);
    maxComboRef.current = 0;
    setDefusedCount(0);
    defusedRef.current = 0;
    setTotalAttempts(0);
    attemptsRef.current = 0;
    setActiveBombs([]);
    activeBombsRef.current = [];
    setExplosions([]);
    setStatusMsg("");
    setSubmitResult(null);
    setXInput("");
    setYInput("");
    setInputSlot("x");

    const now = performance.now();
    startedAtRef.current = now;
    nextSpawnAtRef.current = now + 400; // First bomb spawns quickly
    lastAlarmAtRef.current = 0;
    setPhase("playing");
    rafRef.current = requestAnimationFrame(tick);
  }, [stopLoop, tick]);

  useEffect(() => {
    return () => stopLoop();
  }, [stopLoop]);

  // FIRE DEFUSAL MISSILE / ACTION
  const handleFire = useCallback(() => {
    if (phaseRef.current !== "playing") return;

    const xNum = parseInt(xInput, 10);
    const yNum = parseInt(yInput, 10);

    if (isNaN(xNum) || isNaN(yNum)) {
      setStatusMsg("x와 y 좌표를 모두 입력해 주세요.");
      return;
    }

    const nextAttempts = attemptsRef.current + 1;
    attemptsRef.current = nextAttempts;
    setTotalAttempts(nextAttempts);

    // Check hit against active bombs
    const hitIndex = activeBombsRef.current.findIndex(
      (b) => b.x === xNum && b.y === yNum,
    );

    const now = performance.now();
    const elapsed = (now - startedAtRef.current) / 1000;
    const diff = getDifficulty(defusedRef.current, elapsed);

    if (hitIndex >= 0) {
      // Direct HIT!
      const target = activeBombsRef.current[hitIndex];
      const nextCombo = comboRef.current + 1;
      comboRef.current = nextCombo;
      setCombo(nextCombo);
      if (nextCombo > maxComboRef.current) {
        maxComboRef.current = nextCombo;
        setMaxCombo(nextCombo);
      }

      const { totalGain, isClutch } = calculateDefuseScore(
        diff.basePoints,
        nextCombo,
        target.fuseLeft,
      );

      const nextScore = applyScoreGain(scoreRef.current, totalGain);
      scoreRef.current = nextScore;
      setScore(nextScore);

      const nextDefused = defusedRef.current + 1;
      defusedRef.current = nextDefused;
      setDefusedCount(nextDefused);

      // Audio & burst
      audio.playDefuse(nextCombo);

      const label = isClutch
        ? `위기일발 해체! +${totalGain}`
        : nextCombo > 1
          ? `${nextCombo} COMBO! +${totalGain}`
          : `+${totalGain}`;

      setExplosions((prev) => [
        ...prev,
        {
          id: idRef.current++,
          x: target.x,
          y: target.y,
          kind: "defused",
          label,
          until: now + 850,
        },
      ]);

      // Remove defused bomb
      const nextBombs = [...activeBombsRef.current];
      nextBombs.splice(hitIndex, 1);
      activeBombsRef.current = nextBombs;
      setActiveBombs(nextBombs);

      setStatusMsg(
        `순서쌍 (${xNum}, ${yNum}) [${getQuadrantName(xNum, yNum)}] 해체 완료!`,
      );

      // Reset inputs for next target
      setXInput("");
      setYInput("");
      setInputSlot("x");
    } else {
      // MISS!
      setCombo(0);
      comboRef.current = 0;
      audio.playMiss();
      setMissFlash(true);
      window.setTimeout(() => setMissFlash(false), 250);

      setExplosions((prev) => [
        ...prev,
        {
          id: idRef.current++,
          x: xNum,
          y: yNum,
          kind: "miss",
          label: "빗맞음!",
          until: now + 650,
        },
      ]);

      setStatusMsg(`(${xNum}, ${yNum}) 지점에는 폭탄이 없습니다.`);
      // Clear inputs to quickly re-aim
      setXInput("");
      setYInput("");
      setInputSlot("x");
    }
  }, [xInput, yInput]);

  // KEYBOARD INPUT HANDLING WITH ULTRA-SMOOTH ERGONOMICS
  useEffect(() => {
    if (phase !== "playing") return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      const key = e.key;

      // Numbers 0 ~ 9
      if (/^[0-9]$/.test(key)) {
        e.preventDefault();
        if (inputSlot === "x") {
          // If xInput already has a digit (e.g. "3" or "-2"), typing another digit automatically fills Y!
          if (xInput !== "" && xInput !== "-") {
            setYInput(key);
            setInputSlot("y");
          } else {
            setXInput((prev) => (prev === "-" ? `-${key}` : key));
          }
        } else {
          setYInput((prev) => (prev === "-" ? `-${key}` : key));
        }
        return;
      }

      // Negative sign toggle: "-" or "_"
      if (key === "-" || key === "_") {
        e.preventDefault();
        if (inputSlot === "x") {
          // If X is already a number, pressing "-" implies starting a negative Y!
          if (xInput !== "" && xInput !== "-") {
            setYInput("-");
            setInputSlot("y");
          } else {
            setXInput((prev) => (prev.startsWith("-") ? prev.slice(1) : `-${prev}`));
          }
        } else {
          setYInput((prev) => (prev.startsWith("-") ? prev.slice(1) : `-${prev}`));
        }
        return;
      }

      // Delimiters to advance to Y: Space, Tab, Comma, ArrowRight
      if (key === " " || key === "Tab" || key === "," || key === "ArrowRight") {
        e.preventDefault();
        if (xInput !== "" && yInput !== "" && xInput !== "-" && yInput !== "-") {
          handleFire();
        } else if (inputSlot === "x") {
          setInputSlot("y");
        }
        return;
      }

      // ArrowLeft goes back to X
      if (key === "ArrowLeft") {
        e.preventDefault();
        setInputSlot("x");
        return;
      }

      // Enter key: If both are filled, FIRE! If on X and filled, advance to Y.
      if (key === "Enter") {
        e.preventDefault();
        if (xInput !== "" && yInput !== "" && xInput !== "-" && yInput !== "-") {
          handleFire();
        } else if (inputSlot === "x") {
          if (xInput !== "") {
            setInputSlot("y");
          }
        } else {
          handleFire();
        }
        return;
      }

      // Backspace
      if (key === "Backspace") {
        e.preventDefault();
        if (inputSlot === "y") {
          if (yInput !== "") {
            setYInput("");
          } else {
            setInputSlot("x");
          }
        } else {
          setXInput("");
        }
        return;
      }

      // Escape clears both
      if (key === "Escape") {
        e.preventDefault();
        setXInput("");
        setYInput("");
        setInputSlot("x");
        return;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [phase, inputSlot, xInput, yInput, handleFire]);

  // ON-SCREEN KEYPAD ACTIONS
  const handleKeypadNumber = (num: number) => {
    if (inputSlot === "x") {
      setXInput((prev) => (prev === "-" ? `-${num}` : `${num}`));
      // Auto move to Y for swift ergonomic entry
      setInputSlot("y");
    } else {
      setYInput((prev) => (prev === "-" ? `-${num}` : `${num}`));
    }
  };

  const handleToggleSign = (targetSign?: "+" | "-") => {
    if (inputSlot === "x") {
      setXInput((prev) => {
        const isNeg = prev.startsWith("-");
        const val = isNeg ? prev.slice(1) : prev;
        if (targetSign === "+") return val;
        if (targetSign === "-") return isNeg ? prev : `-${val}`;
        return isNeg ? val : `-${val}`;
      });
    } else {
      setYInput((prev) => {
        const isNeg = prev.startsWith("-");
        const val = isNeg ? prev.slice(1) : prev;
        if (targetSign === "+") return val;
        if (targetSign === "-") return isNeg ? prev : `-${val}`;
        return isNeg ? val : `-${val}`;
      });
    }
  };

  const handleClearSlot = () => {
    if (inputSlot === "x") setXInput("");
    else setYInput("");
  };

  const loadRanking = (next: { scope?: RankingScope; mode?: RankingMode }) => {
    const scope = next.scope ?? rankingScope;
    const mode = next.mode ?? rankingMode;
    if (next.scope) setRankingScope(scope);
    if (next.mode) setRankingMode(mode);
    startTransition(async () => {
      const rows = await fetchGameRanking({
        contentKey: CONTENT_KEY,
        scope,
        mode,
      });
      setRanking(rows);
    });
  };

  // Coordinate plane dimensions and projection
  const currentDiff = getDifficulty(
    defusedCount,
    phase === "playing" ? (performance.now() - startedAtRef.current) / 1000 : 0,
  );
  const gridRange = currentDiff.gridRange; // 4 to 7
  const svgSize = 520;
  const padding = 36;
  const graphSize = svgSize - padding * 2;
  const stepPx = graphSize / (gridRange * 2);

  const toSvgX = (x: number) => padding + (x + gridRange) * stepPx;
  const toSvgY = (y: number) => padding + (gridRange - y) * stepPx;

  // Parsed target coordinates for visual laser crosshairs
  const currentParsedX = xInput !== "" && xInput !== "-" ? parseInt(xInput, 10) : null;
  const currentParsedY = yInput !== "" && yInput !== "-" ? parseInt(yInput, 10) : null;

  return (
    <div className="flex flex-col gap-5 select-none">
      {/* Inline styles for keyframe shake & explosion effects */}
      <style jsx>{`
        @keyframes shake {
          0%, 100% { transform: translate(0, 0); }
          15% { transform: translate(-6px, 4px) rotate(-1deg); }
          30% { transform: translate(5px, -5px) rotate(1deg); }
          45% { transform: translate(-5px, -3px); }
          60% { transform: translate(4px, 4px); }
          75% { transform: translate(-2px, 2px); }
        }
        .shake-screen {
          animation: shake 0.42s ease-in-out;
        }
        @keyframes radarPulse {
          0% { transform: scale(0.95); opacity: 0.8; }
          50% { transform: scale(1.08); opacity: 1; }
          100% { transform: scale(0.95); opacity: 0.8; }
        }
        .radar-pulse {
          animation: radarPulse 1.6s infinite ease-in-out;
        }
      `}</style>

      {/* Header Banner */}
      <section className="quest-card bg-gradient-to-br from-amber-100/70 via-mint/25 to-sky/30 p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-wood">중1 · 2.3 좌표평면과 그래프</p>
            <h1 className="font-display mt-1 text-3xl text-foreground sm:text-4xl flex items-center gap-2.5">
              <span>좌표 폭탄 해체반</span>
              <span className="rounded-full bg-rose-500/15 px-2.5 py-0.5 text-xs font-bold text-rose-700">
                디펜스 액션
              </span>
            </h1>
          </div>
          <button
            type="button"
            onClick={toggleMute}
            className="flex items-center gap-1.5 rounded-xl border border-wood/20 bg-white/70 px-3 py-1.5 text-xs font-semibold text-wood shadow-sm transition hover:bg-white active:scale-95"
            aria-label={muted ? "소리 켜기" : "소리 끄기"}
          >
            {muted ? (
              <>
                <VolumeXIcon className="h-4 w-4 text-rose-500" />
                <span>소리 끔</span>
              </>
            ) : (
              <>
                <Volume2Icon className="h-4 w-4 text-emerald-600" />
                <span>소리 켬</span>
              </>
            )}
          </button>
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-foreground/75 sm:text-base">
          좌표평면에 시한폭탄이 출현했어요! 폭탄의 위치를 읽고 순서쌍{" "}
          <strong className="text-wood font-black">(x, y)</strong>를 빠르게 입력해
          해체하세요. 시간이 다 되면 펑! 터져요.
        </p>
      </section>

      {/* PHASE: READY */}
      {phase === "ready" ? (
        <section className="quest-card border-mint/40 bg-gradient-to-br from-white/90 via-sky/20 to-mint/20 p-6 text-center sm:p-8">
          <div className="mx-auto max-w-lg space-y-4">
            <h2 className="font-display text-2xl text-wood">작전 브리핑</h2>
            <div className="grid gap-3 text-left text-sm font-semibold text-foreground/80 sm:text-base">
              <div className="flex items-start gap-3 rounded-xl bg-white/80 p-3.5 shadow-sm border border-wood/10">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-500 font-black text-white">
                  1
                </span>
                <div>
                  <p className="font-bold text-foreground">폭탄의 순서쌍 (x, y) 읽기</p>
                  <p className="text-xs text-foreground/70 mt-0.5">
                    가로축(x)을 먼저 읽고, 세로축(y)을 읽어 순서쌍을 조준하세요.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl bg-white/80 p-3.5 shadow-sm border border-wood/10">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-500 font-black text-white">
                  2
                </span>
                <div>
                  <p className="font-bold text-foreground">초간편 키보드 & 터치 조작</p>
                  <p className="text-xs text-foreground/70 mt-0.5">
                    키보드로 숫자 연타 또는 <kbd className="rounded bg-wood/10 px-1 font-mono text-wood">Space/Enter</kbd>로 y 이동 후 즉시 발사! 음수는 <kbd className="rounded bg-wood/10 px-1 font-mono text-wood">-</kbd> 키나 원터치 부호 버튼으로 편하게 입력해요.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl bg-white/80 p-3.5 shadow-sm border border-wood/10">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500 font-black text-white">
                  3
                </span>
                <div>
                  <p className="font-bold text-foreground">도화선이 타오르기 전에 해체</p>
                  <p className="text-xs text-foreground/70 mt-0.5">
                    도화선이 다 타면 생명이 줄어요. 연속으로 적중하면 콤보 보너스 폭증!
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={startGame}
              className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-wood px-9 py-4 font-display text-xl text-cream shadow-lg transition hover:bg-wood-dark hover:scale-105 active:scale-95 cursor-pointer"
            >
              <TargetIcon className="h-6 w-6 text-gold" />
              <span>작전 시작하기</span>
            </button>
          </div>
        </section>
      ) : null}

      {/* PHASE: ENDED */}
      {phase === "ended" ? (
        <section
          className="quest-card border-mint/40 bg-gradient-to-br from-mint/45 via-sky/25 to-gold/30 p-5 text-center sm:p-7"
          role="status"
          aria-live="polite"
        >
          <p className="font-display text-4xl text-wood sm:text-5xl">
            {score.toLocaleString()}점
          </p>
          <p className="mt-2 text-sm font-semibold text-foreground/70">
            폭탄 {defusedCount}개를 성공적으로 해체했습니다!
          </p>

          <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs font-bold text-wood/80 sm:text-sm">
            <span className="rounded-xl bg-white/70 px-3 py-1.5 shadow-sm">
              최대 콤보: {maxCombo}연속
            </span>
            <span className="rounded-xl bg-white/70 px-3 py-1.5 shadow-sm">
              명중률:{" "}
              {totalAttempts > 0
                ? Math.round((defusedCount / totalAttempts) * 100)
                : 0}
              %
            </span>
            <span className="rounded-xl bg-white/70 px-3 py-1.5 shadow-sm">
              도달 단계: Wave {currentDiff.stage} ({currentDiff.stageName})
            </span>
          </div>

          {isPending && !submitResult ? (
            <p className="mt-4 text-sm font-bold text-wood/70 animate-pulse">
              점수 반영 중…
            </p>
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
            onClick={startGame}
            className="mt-7 inline-flex items-center gap-2 rounded-xl bg-wood px-8 py-3.5 text-lg font-bold text-cream shadow-md transition hover:bg-wood-dark hover:scale-105 active:scale-95 cursor-pointer"
          >
            <span>다시 도전하기</span>
          </button>
        </section>
      ) : null}

      {/* PHASE: PLAYING */}
      {phase === "playing" ? (
        <section
          className={[
            "quest-card-static overflow-hidden transition-all duration-100",
            screenShake ? "shake-screen" : "",
            missFlash ? "ring-4 ring-rose-500/60" : "",
          ].join(" ")}
        >
          {/* Top Status Bar: Lives, Score, Wave, Combo */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-wood/10 bg-white/75 px-4 py-3 sm:px-5">
            {/* Lives */}
            <div className="flex items-center gap-1.5" aria-label={`생명 ${lives}개`}>
              {Array.from({ length: MAX_LIVES }, (_, i) => (
                <span
                  key={i}
                  className={[
                    "inline-flex h-7 w-7 items-center justify-center rounded-full text-base font-black transition-transform duration-200",
                    i < lives
                      ? "bg-rose-500 text-white shadow-sm scale-110"
                      : "bg-wood/10 text-wood/25 scale-90",
                  ].join(" ")}
                  aria-hidden="true"
                >
                  ♥
                </span>
              ))}
            </div>

            {/* Stage, Score, Combo */}
            <div className="flex flex-wrap items-center gap-2 text-sm font-bold">
              <span className="rounded-xl bg-sky/40 px-3 py-1 text-wood">
                Wave {currentDiff.stage} · {currentDiff.stageName}
              </span>
              <span className="rounded-xl bg-gold/50 px-3 py-1 text-wood">
                {score.toLocaleString()}점
              </span>
              <span className="rounded-xl bg-mint/40 px-3 py-1 text-wood">
                해체 {defusedCount}개
              </span>
              {combo > 1 ? (
                <span className="flex items-center gap-1 rounded-xl bg-gradient-to-r from-orange-400 to-rose-500 px-3 py-1 text-white shadow-sm animate-pulse">
                  <span>🔥</span>
                  <span>{combo} COMBO!</span>
                </span>
              ) : null}
            </div>
          </div>

          {/* Main Play Grid & Controls */}
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,1fr)] gap-4 p-4 sm:p-5">
            {/* LEFT: SVG Coordinate Plane */}
            <div className="relative flex flex-col items-center justify-center rounded-2xl bg-gradient-to-b from-[#eaf6ff] via-[#f7fcf9] to-[#fffbed] p-2 sm:p-4 shadow-inner border border-wood/10">
              {/* Dynamic Status message alert */}
              {statusMsg ? (
                <div className="absolute top-3 inset-x-4 z-20 mx-auto max-w-sm rounded-xl bg-wood/90 px-3 py-1.5 text-center text-xs sm:text-sm font-bold text-cream shadow-md backdrop-blur">
                  {statusMsg}
                </div>
              ) : null}

              <svg
                viewBox={`0 0 ${svgSize} ${svgSize}`}
                className="h-auto w-full max-w-[480px] select-none"
                role="img"
                aria-label="좌표평면 디펜스 그리드"
              >
                <defs>
                  {/* Glowing Laser Filters */}
                  <filter id="laserGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                  <radialGradient id="bombGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#ff5252" />
                    <stop offset="70%" stopColor="#b71c1c" />
                    <stop offset="100%" stopColor="#3e0707" />
                  </radialGradient>
                </defs>

                {/* Subtle Quadrant Watermark Labels */}
                <text
                  x={toSvgX(gridRange * 0.55)}
                  y={toSvgY(gridRange * 0.75)}
                  textAnchor="middle"
                  className="fill-wood/20 font-bold text-[13px] tracking-wide"
                >
                  제1사분면 (+, +)
                </text>
                <text
                  x={toSvgX(-gridRange * 0.55)}
                  y={toSvgY(gridRange * 0.75)}
                  textAnchor="middle"
                  className="fill-wood/20 font-bold text-[13px] tracking-wide"
                >
                  제2사분면 (-, +)
                </text>
                <text
                  x={toSvgX(-gridRange * 0.55)}
                  y={toSvgY(-gridRange * 0.75)}
                  textAnchor="middle"
                  className="fill-wood/20 font-bold text-[13px] tracking-wide"
                >
                  제3사분면 (-, -)
                </text>
                <text
                  x={toSvgX(gridRange * 0.55)}
                  y={toSvgY(-gridRange * 0.75)}
                  textAnchor="middle"
                  className="fill-wood/20 font-bold text-[13px] tracking-wide"
                >
                  제4사분면 (+, -)
                </text>

                {/* Grid Lines */}
                {Array.from({ length: gridRange * 2 + 1 }, (_, i) => {
                  const val = -gridRange + i;
                  const gx = toSvgX(val);
                  const gy = toSvgY(val);
                  const isAxis = val === 0;

                  return (
                    <g key={`grid-${val}`}>
                      {/* Vertical Grid Line */}
                      <line
                        x1={gx}
                        y1={padding}
                        x2={gx}
                        y2={svgSize - padding}
                        stroke={isAxis ? "#8B5E3C" : "#8B5E3C26"}
                        strokeWidth={isAxis ? 2.5 : 1}
                      />
                      {/* Horizontal Grid Line */}
                      <line
                        x1={padding}
                        y1={gy}
                        x2={svgSize - padding}
                        y2={gy}
                        stroke={isAxis ? "#8B5E3C" : "#8B5E3C26"}
                        strokeWidth={isAxis ? 2.5 : 1}
                      />
                    </g>
                  );
                })}

                {/* Tick Numbers & Axis Arrows */}
                {Array.from({ length: gridRange * 2 + 1 }, (_, i) => {
                  const val = -gridRange + i;
                  if (val === 0) return null;
                  const gx = toSvgX(val);
                  const gy = toSvgY(val);

                  return (
                    <g key={`ticks-${val}`}>
                      {/* X-axis tick numbers */}
                      <text
                        x={gx}
                        y={toSvgY(0) + 14}
                        textAnchor="middle"
                        className="fill-wood/75 font-mono text-[10px] font-bold"
                      >
                        {val}
                      </text>
                      {/* Y-axis tick numbers */}
                      <text
                        x={toSvgX(0) - 10}
                        y={gy + 3.5}
                        textAnchor="end"
                        className="fill-wood/75 font-mono text-[10px] font-bold"
                      >
                        {val}
                      </text>
                    </g>
                  );
                })}

                {/* Axis Labels & Origin O */}
                <text
                  x={svgSize - padding + 14}
                  y={toSvgY(0) + 4}
                  className="fill-wood font-display text-[15px] font-black"
                >
                  x
                </text>
                <text
                  x={toSvgX(0)}
                  y={padding - 12}
                  textAnchor="middle"
                  className="fill-wood font-display text-[15px] font-black"
                >
                  y
                </text>
                <text
                  x={toSvgX(0) + 9}
                  y={toSvgY(0) + 14}
                  className="fill-wood/80 font-display text-[12px] font-bold"
                >
                  O
                </text>

                {/* VISUAL AIMING LASER GUIDELINES */}
                {/* Vertical Laser for X */}
                {currentParsedX !== null &&
                  currentParsedX >= -gridRange &&
                  currentParsedX <= gridRange && (
                    <line
                      x1={toSvgX(currentParsedX)}
                      y1={padding}
                      x2={toSvgX(currentParsedX)}
                      y2={svgSize - padding}
                      stroke="#0284c7"
                      strokeWidth={2.5}
                      strokeDasharray="4 3"
                      filter="url(#laserGlow)"
                      className="opacity-80 animate-pulse"
                    />
                  )}

                {/* Horizontal Laser for Y */}
                {currentParsedY !== null &&
                  currentParsedY >= -gridRange &&
                  currentParsedY <= gridRange && (
                    <line
                      x1={padding}
                      y1={toSvgY(currentParsedY)}
                      x2={svgSize - padding}
                      y2={toSvgY(currentParsedY)}
                      stroke="#0284c7"
                      strokeWidth={2.5}
                      strokeDasharray="4 3"
                      filter="url(#laserGlow)"
                      className="opacity-80 animate-pulse"
                    />
                  )}

                {/* CROSSHAIR RETICLE AT TARGET INTERSECTION (X, Y) */}
                {currentParsedX !== null &&
                  currentParsedY !== null &&
                  currentParsedX >= -gridRange &&
                  currentParsedX <= gridRange &&
                  currentParsedY >= -gridRange &&
                  currentParsedY <= gridRange && (
                    <g
                      transform={`translate(${toSvgX(currentParsedX)}, ${toSvgY(currentParsedY)})`}
                    >
                      <circle
                        r={16}
                        fill="none"
                        stroke="#0284c7"
                        strokeWidth={2}
                        className="animate-spin"
                        style={{ animationDuration: "3s" }}
                        strokeDasharray="6 4"
                      />
                      <circle r={3} fill="#0284c7" />
                    </g>
                  )}

                {/* ACTIVE BOMBS */}
                {activeBombs.map((bomb) => {
                  const bx = toSvgX(bomb.x);
                  const by = toSvgY(bomb.y);
                  const fuseRatio = Math.max(0, bomb.fuseLeft / bomb.totalFuse);
                  const radius = 17;
                  const circumference = 2 * Math.PI * radius;
                  const strokeDashoffset = circumference * (1 - fuseRatio);
                  const isUrgent = bomb.fuseLeft <= 1.5;

                  return (
                    <g key={bomb.id} className="transition-transform duration-75">
                      {/* Fuse Ring Background */}
                      <circle
                        cx={bx}
                        cy={by}
                        r={radius}
                        fill="none"
                        stroke="#00000018"
                        strokeWidth={3.5}
                      />
                      {/* Animated Countdown Fuse Ring */}
                      <circle
                        cx={bx}
                        cy={by}
                        r={radius}
                        fill="none"
                        stroke={
                          isUrgent
                            ? "#ef4444"
                            : fuseRatio < 0.5
                              ? "#f59e0b"
                              : "#10b981"
                        }
                        strokeWidth={3.5}
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                        transform={`rotate(-90 ${bx} ${by})`}
                      />

                      {/* Bomb Core Body */}
                      <circle
                        cx={bx}
                        cy={by}
                        r={11}
                        fill="url(#bombGlow)"
                        stroke="#27272a"
                        strokeWidth={1.5}
                        className={isUrgent ? "animate-ping" : ""}
                        style={{
                          animationDuration: isUrgent ? "0.6s" : "1.2s",
                        }}
                      />
                      <circle
                        cx={bx}
                        cy={by}
                        r={11}
                        fill="url(#bombGlow)"
                        stroke="#27272a"
                        strokeWidth={1.5}
                      />

                      {/* Fuse Top & Sparkle */}
                      <path
                        d={`M ${bx} ${by - 11} Q ${bx + 4} ${by - 16} ${bx + 7} ${by - 17}`}
                        fill="none"
                        stroke="#d97706"
                        strokeWidth={2}
                      />
                      <circle
                        cx={bx + 7}
                        cy={by - 17}
                        r={2.5}
                        fill="#fbbf24"
                        className="animate-ping"
                      />

                      {/* Remaining Seconds Tag */}
                      <rect
                        x={bx - 12}
                        y={by + 16}
                        width={24}
                        height={12}
                        rx={4}
                        fill={isUrgent ? "#ef4444" : "#18181b"}
                        opacity={0.88}
                      />
                      <text
                        x={bx}
                        y={by + 25}
                        textAnchor="middle"
                        className="fill-white font-mono text-[9px] font-black"
                      >
                        {Math.max(0.1, bomb.fuseLeft).toFixed(1)}s
                      </text>
                    </g>
                  );
                })}

                {/* EXPLOSIONS & BURST EFFECTS */}
                {explosions.map((exp) => {
                  const ex = toSvgX(exp.x);
                  const ey = toSvgY(exp.y);

                  if (exp.kind === "defused") {
                    return (
                      <g key={exp.id}>
                        <circle
                          cx={ex}
                          cy={ey}
                          r={30}
                          fill="#38bdf8"
                          opacity={0.4}
                          className="animate-ping"
                        />
                        <circle cx={ex} cy={ey} r={18} fill="#38bdf8" opacity={0.7} />
                        {exp.label ? (
                          <text
                            x={ex}
                            y={ey - 22}
                            textAnchor="middle"
                            className="fill-emerald-700 font-display text-[15px] font-black drop-shadow animate-bounce"
                          >
                            {exp.label}
                          </text>
                        ) : null}
                      </g>
                    );
                  }

                  if (exp.kind === "detonated") {
                    return (
                      <g key={exp.id}>
                        <circle
                          cx={ex}
                          cy={ey}
                          r={40}
                          fill="#ef4444"
                          opacity={0.6}
                          className="animate-ping"
                        />
                        <circle cx={ex} cy={ey} r={24} fill="#b91c1c" opacity={0.8} />
                        <text
                          x={ex}
                          y={ey - 24}
                          textAnchor="middle"
                          className="fill-rose-700 font-display text-[14px] font-black drop-shadow animate-bounce"
                        >
                          {exp.label || "폭발!"}
                        </text>
                      </g>
                    );
                  }

                  // Miss
                  return (
                    <g key={exp.id}>
                      <circle
                        cx={ex}
                        cy={ey}
                        r={12}
                        fill="#71717a"
                        opacity={0.5}
                      />
                      <text
                        x={ex}
                        y={ey - 14}
                        textAnchor="middle"
                        className="fill-wood/70 font-display text-[11px] font-bold"
                      >
                        빗맞음!
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* RIGHT: ULTRA-CONVENIENT CONTROLS */}
            <div className="flex flex-col justify-between gap-3 rounded-2xl bg-white/70 p-4 shadow-sm border border-wood/10">
              {/* Top Selector: Dual Slot Display (X, Y) */}
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-wood/60">
                    목표 좌표 조준
                  </span>
                  {/* Mode switcher tab: Keypad vs Direct Bar */}
                  <div className="flex rounded-lg bg-wood/10 p-0.5 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setInputMode("pad")}
                      className={`rounded-md px-2 py-0.5 transition cursor-pointer ${
                        inputMode === "pad"
                          ? "bg-white text-wood shadow-sm font-bold"
                          : "text-wood/60 hover:text-wood"
                      }`}
                    >
                      키패드
                    </button>
                    <button
                      type="button"
                      onClick={() => setInputMode("bar")}
                      className={`rounded-md px-2 py-0.5 transition cursor-pointer ${
                        inputMode === "bar"
                          ? "bg-white text-wood shadow-sm font-bold"
                          : "text-wood/60 hover:text-wood"
                      }`}
                    >
                      직접 선택 바
                    </button>
                  </div>
                </div>

                {/* Big Visual Coordinate Slots */}
                <div className="mt-3 flex items-center justify-center gap-2">
                  <span className="font-display text-3xl font-bold text-wood/40">
                    (
                  </span>

                  {/* X Slot Button */}
                  <button
                    type="button"
                    onClick={() => setInputSlot("x")}
                    className={[
                      "flex min-w-[76px] flex-1 flex-col items-center justify-center rounded-xl p-2.5 transition border-2 cursor-pointer",
                      inputSlot === "x"
                        ? "border-sky-500 bg-sky-50/80 shadow-md ring-2 ring-sky-300"
                        : "border-wood/15 bg-white/80 hover:bg-white",
                    ].join(" ")}
                  >
                    <span className="text-[11px] font-bold text-wood/60">
                      x좌표 (가로)
                    </span>
                    <span className="font-mono text-2xl font-black text-foreground">
                      {xInput || <span className="text-wood/25">?</span>}
                    </span>
                  </button>

                  <span className="font-display text-3xl font-bold text-wood/40">
                    ,
                  </span>

                  {/* Y Slot Button */}
                  <button
                    type="button"
                    onClick={() => setInputSlot("y")}
                    className={[
                      "flex min-w-[76px] flex-1 flex-col items-center justify-center rounded-xl p-2.5 transition border-2 cursor-pointer",
                      inputSlot === "y"
                        ? "border-sky-500 bg-sky-50/80 shadow-md ring-2 ring-sky-300"
                        : "border-wood/15 bg-white/80 hover:bg-white",
                    ].join(" ")}
                  >
                    <span className="text-[11px] font-bold text-wood/60">
                      y좌표 (세로)
                    </span>
                    <span className="font-mono text-2xl font-black text-foreground">
                      {yInput || <span className="text-wood/25">?</span>}
                    </span>
                  </button>

                  <span className="font-display text-3xl font-bold text-wood/40">
                    )
                  </span>
                </div>

                <p className="mt-2 text-center text-xs font-semibold text-wood/70">
                  {inputSlot === "x"
                    ? "가로축(x) 좌표를 입력하세요."
                    : "세로축(y) 좌표를 입력하세요."}
                </p>
              </div>

              {/* INPUT CONTROLS: PAD MODE */}
              {inputMode === "pad" ? (
                <div className="space-y-2">
                  {/* Sign Buttons: One-tap Plus/Minus */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleSign("+")}
                      className="flex items-center justify-center gap-1 rounded-xl border border-emerald-500/30 bg-emerald-50/80 py-2 text-sm font-black text-emerald-800 transition hover:bg-emerald-100 active:scale-95 shadow-sm cursor-pointer"
                    >
                      <span>+ 양수</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleSign("-")}
                      className="flex items-center justify-center gap-1 rounded-xl border border-rose-500/30 bg-rose-50/80 py-2 text-sm font-black text-rose-800 transition hover:bg-rose-100 active:scale-95 shadow-sm cursor-pointer"
                    >
                      <span>− 음수</span>
                    </button>
                  </div>

                  {/* 3x3 + 0 Numpad */}
                  <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                    {[1, 2, 3, 4, 5, 6, 7].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => handleKeypadNumber(num)}
                        className="flex h-11 items-center justify-center rounded-xl bg-white text-lg font-black text-wood shadow-sm border border-wood/10 transition hover:bg-sky-50 active:scale-95 cursor-pointer"
                      >
                        {num}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => handleKeypadNumber(0)}
                      className="flex h-11 items-center justify-center rounded-xl bg-gold/35 text-lg font-black text-wood shadow-sm border border-gold/40 transition hover:bg-gold/50 active:scale-95 cursor-pointer"
                    >
                      0
                    </button>
                    <button
                      type="button"
                      onClick={handleClearSlot}
                      className="flex h-11 items-center justify-center rounded-xl bg-rose-50 text-sm font-bold text-rose-700 shadow-sm border border-rose-200 transition hover:bg-rose-100 active:scale-95 cursor-pointer"
                    >
                      지우기 ⌫
                    </button>
                  </div>
                </div>
              ) : (
                /* INPUT CONTROLS: DIRECT BAR MODE */
                <div className="space-y-3">
                  <div>
                    <span className="text-xs font-bold text-wood">
                      X 좌표 직접 선택:
                    </span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {Array.from({ length: gridRange * 2 + 1 }, (_, i) => {
                        const n = -gridRange + i;
                        const isSelected = xInput === String(n);
                        return (
                          <button
                            key={`bar-x-${n}`}
                            type="button"
                            onClick={() => {
                              setXInput(String(n));
                              setInputSlot("y");
                            }}
                            className={[
                              "h-8 min-w-[28px] rounded-lg px-1 text-xs font-mono font-bold transition shadow-sm cursor-pointer",
                              isSelected
                                ? "bg-sky-600 text-white ring-2 ring-sky-300"
                                : n === 0
                                  ? "bg-gold/40 text-wood hover:bg-gold/60"
                                  : "bg-white text-wood border border-wood/15 hover:bg-sky-50",
                            ].join(" ")}
                          >
                            {n}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <span className="text-xs font-bold text-wood">
                      Y 좌표 직접 선택:
                    </span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {Array.from({ length: gridRange * 2 + 1 }, (_, i) => {
                        const n = -gridRange + i;
                        const isSelected = yInput === String(n);
                        return (
                          <button
                            key={`bar-y-${n}`}
                            type="button"
                            onClick={() => setYInput(String(n))}
                            className={[
                              "h-8 min-w-[28px] rounded-lg px-1 text-xs font-mono font-bold transition shadow-sm cursor-pointer",
                              isSelected
                                ? "bg-sky-600 text-white ring-2 ring-sky-300"
                                : n === 0
                                  ? "bg-gold/40 text-wood hover:bg-gold/60"
                                  : "bg-white text-wood border border-wood/15 hover:bg-sky-50",
                            ].join(" ")}
                          >
                            {n}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* ACTION: LAUNCH / ADVANCE BUTTON */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleFire}
                  disabled={xInput === "" || yInput === "" || xInput === "-" || yInput === "-"}
                  className={[
                    "flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 font-display text-lg shadow-md transition",
                    xInput !== "" && yInput !== "" && xInput !== "-" && yInput !== "-"
                      ? "bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600 text-white shadow-emerald-500/20 hover:brightness-110 active:scale-98 cursor-pointer"
                      : "bg-wood/30 text-wood/50 cursor-not-allowed",
                  ].join(" ")}
                >
                  <ZapIcon className="h-5 w-5" />
                  <span>
                    {xInput !== "" && yInput !== "" && xInput !== "-" && yInput !== "-"
                      ? `(${xInput}, ${yInput}) 해체 발사! (Enter)`
                      : "좌표를 모두 조준하세요"}
                  </span>
                </button>

                <div className="mt-2.5 flex items-center justify-between text-[11px] text-wood/60">
                  <span>
                    단축키: 숫자 타이핑 → <kbd className="rounded bg-wood/10 px-1 font-mono">Space/Enter</kbd> → 발사
                  </span>
                  <span>
                    부호: <kbd className="rounded bg-wood/10 px-1 font-mono">-</kbd>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
