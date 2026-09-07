"use client";

import {
  useCallback,
  useEffect,
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
import { applyScoreGain, SCORE_SOFT_CAP } from "@/lib/xp";
import {
  BOARD_WIDTH,
  BOARD_HEIGHT,
  CIRCLE_CENTER_X,
  CIRCLE_CENTER_Y,
  CIRCLE_RADIUS,
  CONTENT_KEY,
  START_SHOTS,
  ROUNDS,
  createRoundPegs,
  getCirclePoint,
  degToRad,
  normalizeAngle,
  calcInscribedAngle,
  calcCentralAngle,
  isDiameter,
  snapToDiameter,
  launchTwinBalls,
  stepBallPosition,
  bounceOffCircleWall,
  checkAndResolvePegHit,
  isRoundCleared,
  type SlimePeg,
  type BouncingBall,
  type Point2D,
} from "@/lib/inscribed-pop-math";

type Phase = "ready" | "playing" | "round_cleared" | "ended";

const MUTE_KEY = "pm_inscribed_pop_mute";

function Latex({ latex, className }: { latex: string; className?: string }) {
  const html = katex.renderToString(latex, {
    throwOnError: false,
    displayMode: false,
  });
  return (
    <span className={className} dangerouslySetInnerHTML={{ __html: html }} />
  );
}

// Pentatonic musical scale (C4 - C6) for cheerful marimba chimes
const PENTATONIC_FREQS = [
  261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0,
  1046.5,
];

function playTone(
  type: "pop" | "thales_pop" | "shield" | "center" | "shoot" | "snap" | "clear" | "gameover",
  combo = 0,
  muted = false,
) {
  if (muted || typeof window === "undefined") return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    if (type === "pop") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const noteIdx = Math.min(combo, PENTATONIC_FREQS.length - 1);
      const freq = PENTATONIC_FREQS[noteIdx]!;

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.15, now + 0.08);

      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.start(now);
      osc.stop(now + 0.24);
    } else if (type === "thales_pop") {
      // Glorious dual bell sound for 90° Thales shot!
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.type = "triangle";
      osc2.type = "sine";
      osc1.frequency.setValueAtTime(587.33, now); // D5
      osc2.frequency.setValueAtTime(880.0, now); // A5

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.46);
      osc2.stop(now + 0.46);
    } else if (type === "shield") {
      // Metallic clang
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(240, now);
      osc.frequency.linearRampToValueAtTime(160, now + 0.12);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      osc.start(now);
      osc.stop(now + 0.15);
    } else if (type === "center") {
      // 2X Sun overcharge rising arpeggio
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.exponentialRampToValueAtTime(1046.5, now + 0.25);

      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

      osc.start(now);
      osc.stop(now + 0.34);
    } else if (type === "shoot") {
      // Soft wood/spring whoosh
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = "triangle";
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.15);

      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

      osc.start(now);
      osc.stop(now + 0.17);
    } else if (type === "snap") {
      // Magnetic diameter snap chime
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = "sine";
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.1);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      osc.start(now);
      osc.stop(now + 0.22);
    } else if (type === "clear") {
      // Fanfare
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        const startTime = now + idx * 0.08;
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.14, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.28);

        osc.start(startTime);
        osc.stop(startTime + 0.3);
      });
    }

    window.setTimeout(() => void ctx.close(), 700);
  } catch {
    /* ignore audio errors */
  }
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

interface FloatText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

export default function InscribedPop() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [phase, setPhase] = useState<Phase>("ready");
  const [roundIdx, setRoundIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [shotsLeft, setShotsLeft] = useState(START_SHOTS);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [thalesShots, setThalesShots] = useState(0);
  const [overchargeHits, setOverchargeHits] = useState(0);
  const [pegsPopped, setPegsPopped] = useState(0);
  const [muted, setMuted] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(MUTE_KEY) === "true";
    } catch {
      return false;
    }
  });

  // Geometric angles
  const [angleA, setAngleA] = useState(ROUNDS[0]!.defaultAngleA);
  const [angleB, setAngleB] = useState(ROUNDS[0]!.defaultAngleB);
  const [angleP, setAngleP] = useState(ROUNDS[0]!.defaultAngleP);

  // Ranking & submission
  const [ranking, setRanking] = useState<RankingRow[]>([]);
  const [rankingScope, setRankingScope] = useState<RankingScope>("class");
  const [rankingMode, setRankingMode] = useState<RankingMode>("best");
  const [submitResult, setSubmitResult] = useState<GameSubmitClientResult | null>(
    null,
  );
  const [, startTransition] = useTransition();

  // Internal mutable refs for animation loop
  const phaseRef = useRef<Phase>(phase);
  const roundIdxRef = useRef(roundIdx);
  const scoreRef = useRef(score);
  const shotsLeftRef = useRef(shotsLeft);
  const comboRef = useRef(combo);
  const maxComboRef = useRef(maxCombo);
  const thalesShotsRef = useRef(thalesShots);
  const overchargeHitsRef = useRef(overchargeHits);
  const pegsPoppedRef = useRef(pegsPopped);
  const mutedRef = useRef(muted);

  const angleARef = useRef(angleA);
  const angleBRef = useRef(angleB);
  const anglePRef = useRef(angleP);

  const pegsRef = useRef<SlimePeg[]>([]);
  const ballsRef = useRef<BouncingBall[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const floatTextsRef = useRef<FloatText[]>([]);
  const screenShakeRef = useRef(0);
  const nextBallSeedRef = useRef(1);

  // Dragging state
  const draggingHandleRef = useRef<"none" | "A" | "B" | "P">("none");

  // Sync refs with state
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    roundIdxRef.current = roundIdx;
  }, [roundIdx]);
  useEffect(() => {
    scoreRef.current = score;
  }, [score]);
  useEffect(() => {
    shotsLeftRef.current = shotsLeft;
  }, [shotsLeft]);
  useEffect(() => {
    comboRef.current = combo;
  }, [combo]);
  useEffect(() => {
    maxComboRef.current = maxCombo;
  }, [maxCombo]);
  useEffect(() => {
    thalesShotsRef.current = thalesShots;
  }, [thalesShots]);
  useEffect(() => {
    overchargeHitsRef.current = overchargeHits;
  }, [overchargeHits]);
  useEffect(() => {
    pegsPoppedRef.current = pegsPopped;
  }, [pegsPopped]);
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);
  useEffect(() => {
    angleARef.current = angleA;
  }, [angleA]);
  useEffect(() => {
    angleBRef.current = angleB;
  }, [angleB]);
  useEffect(() => {
    anglePRef.current = angleP;
  }, [angleP]);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(MUTE_KEY, String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  // Compute live angles for UI HUD
  const ptP = getCirclePoint(angleP);
  const ptA = getCirclePoint(angleA);
  const ptB = getCirclePoint(angleB);

  const inscribedAngleVal = calcInscribedAngle(ptP, ptA, ptB);
  const centralAngleVal = calcCentralAngle(ptA, ptB);
  const diameterCheck = isDiameter(angleA, angleB, 10);
  const isThalesActive = diameterCheck.isDiameter;

  const currentRound = ROUNDS[roundIdx] ?? ROUNDS[0]!;

  // Particle and floating text helpers
  const spawnSparks = useCallback((x: number, y: number, color: string, count = 12) => {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 60 + Math.random() * 180;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        color,
        size: 3 + Math.random() * 4,
        life: 0,
        maxLife: 0.35 + Math.random() * 0.35,
      });
    }
  }, []);

  const addFloatText = useCallback((x: number, y: number, text: string, color: string) => {
    floatTextsRef.current.push({
      x,
      y,
      text,
      color,
      life: 0,
      maxLife: 0.8,
    });
  }, []);

  // Initialize round pegs and angles
  const initRound = useCallback((rIdx: number) => {
    const config = ROUNDS[rIdx] ?? ROUNDS[0]!;
    pegsRef.current = createRoundPegs(config.round);
    ballsRef.current = [];
    particlesRef.current = [];
    floatTextsRef.current = [];
    setAngleA(config.defaultAngleA);
    setAngleB(config.defaultAngleB);
    setAngleP(config.defaultAngleP);
    setShotsLeft(START_SHOTS);
    setCombo(0);
  }, []);

  // Start game from beginning
  const startGame = useCallback(() => {
    setScore(0);
    setRoundIdx(0);
    setShotsLeft(START_SHOTS);
    setMaxCombo(0);
    setThalesShots(0);
    setOverchargeHits(0);
    setPegsPopped(0);
    setSubmitResult(null);
    initRound(0);
    setPhase("playing");
  }, [initRound]);

  // Finish whole run
  const endGame = useCallback(async () => {
    if (phaseRef.current === "ended") return;
    setPhase("ended");
    playTone("gameover", 0, mutedRef.current);

    const finalScore = scoreRef.current;
    const finalCleared = roundIdxRef.current + 1;

    try {
      const res = await submitGameRun({
        contentKey: CONTENT_KEY,
        score: finalScore,
        details: activityDetailsV1({
          roundsCleared: finalCleared,
          pegsPopped: pegsPoppedRef.current,
          thalesShots: thalesShotsRef.current,
          overchargeHits: overchargeHitsRef.current,
          maxCombo: maxComboRef.current,
        }),
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
      /* practice mode fallback */
    }
  }, []);

  // Launch twin balls
  const handleShoot = useCallback(() => {
    if (phaseRef.current !== "playing") return;
    if (shotsLeftRef.current <= 0) return;
    if (ballsRef.current.some((b) => b.alive)) return; // wait for current shot

    const p = getCirclePoint(anglePRef.current);
    const a = getCirclePoint(angleARef.current);
    const b = getCirclePoint(angleBRef.current);

    const check = isDiameter(angleARef.current, angleBRef.current, 10);
    const is90 = check.isDiameter;

    if (is90) {
      setThalesShots((prev) => prev + 1);
      screenShakeRef.current = 8;
    }

    setShotsLeft((prev) => prev - 1);
    setCombo(0);

    const seed = nextBallSeedRef.current++;
    const newBalls = launchTwinBalls(p, a, b, is90, 480, seed);
    ballsRef.current = newBalls;

    playTone("shoot", 0, mutedRef.current);
    spawnSparks(p.x, p.y, is90 ? "#fbbf24" : "#a855f7", 10);
  }, [spawnSparks]);

  // Advance to next round
  const handleNextRound = useCallback(() => {
    const nextIdx = roundIdx + 1;
    if (nextIdx >= ROUNDS.length) {
      // Completed all 5 rounds!
      endGame();
    } else {
      setRoundIdx(nextIdx);
      initRound(nextIdx);
      setPhase("playing");
    }
  }, [roundIdx, initRound, endGame]);

  // Snap to Thales 90° button
  const handleSnapDiameter = useCallback(() => {
    const snappedB = snapToDiameter(angleA, angleB, 360);
    setAngleB(snappedB);
    playTone("snap", 0, mutedRef.current);
    addFloatText(CIRCLE_CENTER_X, CIRCLE_CENTER_Y - 40, "⚡ 탈레스 90° 직각 정렬!", "#f59e0b");
  }, [angleA, angleB, addFloatText]);

  // Preset angle quick sets
  const handleSetAnglePreset = useCallback(
    (targetDeg: number) => {
      // Set chord so inscribed angle is targetDeg
      // central angle = 2 * targetDeg
      const centralRad = degToRad(targetDeg * 2);
      const newB = normalizeAngle(angleA + centralRad);
      setAngleB(newB);
      playTone("snap", 0, mutedRef.current);
    },
    [angleA],
  );

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        handleShoot();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleShoot]);

  // Ranking scope changes
  const handleScopeChange = useCallback((nextScope: RankingScope) => {
    setRankingScope(nextScope);
    startTransition(async () => {
      const rows = await fetchGameRanking({
        contentKey: CONTENT_KEY,
        scope: nextScope,
        mode: rankingMode,
      });
      setRanking(rows);
    });
  }, [rankingMode]);

  const handleModeChange = useCallback((nextMode: RankingMode) => {
    setRankingMode(nextMode);
    startTransition(async () => {
      const rows = await fetchGameRanking({
        contentKey: CONTENT_KEY,
        scope: rankingScope,
        mode: nextMode,
      });
      setRanking(rows);
    });
  }, [rankingScope]);

  // Pointer drag interactions on canvas
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (phaseRef.current !== "playing") return;
      const rect = e.currentTarget.getBoundingClientRect();
      const scaleX = BOARD_WIDTH / rect.width;
      const scaleY = BOARD_HEIGHT / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top) * scaleY;

      const ptA = getCirclePoint(angleARef.current);
      const ptB = getCirclePoint(angleBRef.current);
      const ptP = getCirclePoint(anglePRef.current);

      const hitDist = 32;
      if (Math.hypot(mx - ptP.x, my - ptP.y) <= hitDist) {
        draggingHandleRef.current = "P";
      } else if (Math.hypot(mx - ptA.x, my - ptA.y) <= hitDist) {
        draggingHandleRef.current = "A";
      } else if (Math.hypot(mx - ptB.x, my - ptB.y) <= hitDist) {
        draggingHandleRef.current = "B";
      } else {
        // Clicking on circle rim moves cannon P to that position
        const distFromCenter = Math.hypot(mx - CIRCLE_CENTER_X, my - CIRCLE_CENTER_Y);
        if (Math.abs(distFromCenter - CIRCLE_RADIUS) <= 45) {
          const ang = normalizeAngle(Math.atan2(my - CIRCLE_CENTER_Y, mx - CIRCLE_CENTER_X));
          setAngleP(ang);
          draggingHandleRef.current = "P";
        }
      }
    },
    [],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (draggingHandleRef.current === "none") return;
      const rect = e.currentTarget.getBoundingClientRect();
      const scaleX = BOARD_WIDTH / rect.width;
      const scaleY = BOARD_HEIGHT / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top) * scaleY;

      const ang = normalizeAngle(Math.atan2(my - CIRCLE_CENTER_Y, mx - CIRCLE_CENTER_X));

      if (draggingHandleRef.current === "P") {
        setAngleP(ang);
      } else if (draggingHandleRef.current === "A") {
        // Snap to diameter if close to opposite of B
        const snapped = snapToDiameter(angleBRef.current, ang, 12);
        if (snapped !== ang && isDiameter(snapped, angleBRef.current, 1).isDiameter) {
          playTone("snap", 0, mutedRef.current);
        }
        setAngleA(snapped);
      } else if (draggingHandleRef.current === "B") {
        // Snap to diameter if close to opposite of A
        const snapped = snapToDiameter(angleARef.current, ang, 12);
        if (snapped !== ang && isDiameter(angleARef.current, snapped, 1).isDiameter) {
          playTone("snap", 0, mutedRef.current);
        }
        setAngleB(snapped);
      }
    },
    [],
  );

  const handlePointerUp = useCallback(() => {
    draggingHandleRef.current = "none";
  }, []);

  // Main Canvas 60fps Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let lastTs = performance.now();

    const loop = (now: number) => {
      const dt = Math.min((now - lastTs) / 1000, 0.05);
      lastTs = now;

      // Physics update (sub-step 2x for stable ball bounces)
      if (phaseRef.current === "playing") {
        const balls = ballsRef.current;
        const pegs = pegsRef.current;
        const subDt = dt / 2;

        for (let step = 0; step < 2; step++) {
          for (const ball of balls) {
            if (!ball.alive) continue;
            stepBallPosition(ball, subDt);
            bounceOffCircleWall(ball);

            // Check peg hits
            for (const peg of pegs) {
              if (peg.popped) continue;
              const hitRes = checkAndResolvePegHit(ball, peg);

              if (hitRes === "popped") {
                spawnSparks(peg.x, peg.y, peg.type === "armored" ? "#f59e0b" : "#fb923c", 18);
                const isThales = peg.type === "armored";
                playTone(isThales ? "thales_pop" : "pop", comboRef.current, mutedRef.current);

                comboRef.current += 1;
                setCombo(comboRef.current);
                if (comboRef.current > maxComboRef.current) {
                  maxComboRef.current = comboRef.current;
                  setMaxCombo(comboRef.current);
                }

                const comboMultiplier = 1 + comboRef.current * 0.15;
                const gain = Math.round(peg.scoreValue * comboMultiplier);
                scoreRef.current = applyScoreGain(scoreRef.current, gain);
                setScore(scoreRef.current);

                pegsPoppedRef.current += 1;
                setPegsPopped(pegsPoppedRef.current);

                const label = isThales
                  ? `+${gain} ⚡90° THALES!`
                  : comboRef.current > 1
                    ? `+${gain} (${comboRef.current} COMBO!)`
                    : `+${gain}`;
                addFloatText(peg.x, peg.y - 12, label, isThales ? "#f59e0b" : "#fb923c");
                screenShakeRef.current = isThales ? 10 : 4;
              } else if (hitRes === "shielded") {
                spawnSparks(peg.x, peg.y, "#93c5fd", 8);
                playTone("shield", 0, mutedRef.current);
                addFloatText(peg.x, peg.y - 16, "방패 방어! 90° 직각 샷 필요", "#93c5fd");
                screenShakeRef.current = 5;
              } else if (hitRes === "center_overcharge") {
                spawnSparks(peg.x, peg.y, "#f43f5e", 20);
                playTone("center", 0, mutedRef.current);
                overchargeHitsRef.current += 1;
                setOverchargeHits(overchargeHitsRef.current);

                scoreRef.current = applyScoreGain(scoreRef.current, peg.scoreValue * 2);
                setScore(scoreRef.current);

                addFloatText(peg.x, peg.y - 20, "☀️ 2X 중심각 오버차지!", "#f43f5e");
                screenShakeRef.current = 12;

                // Spawn 2 blazing flares
                const flareAng1 = Math.random() * Math.PI * 2;
                const flareAng2 = flareAng1 + Math.PI;
                const spd = 400;
                balls.push({
                  id: `flare-${Date.now()}-1`,
                  x: peg.x,
                  y: peg.y,
                  vx: Math.cos(flareAng1) * spd,
                  vy: Math.sin(flareAng1) * spd,
                  radius: 6,
                  bouncesLeft: 5,
                  isThales90: true,
                  isCenterOvercharge: true,
                  alive: true,
                });
                balls.push({
                  id: `flare-${Date.now()}-2`,
                  x: peg.x,
                  y: peg.y,
                  vx: Math.cos(flareAng2) * spd,
                  vy: Math.sin(flareAng2) * spd,
                  radius: 6,
                  bouncesLeft: 5,
                  isThales90: true,
                  isCenterOvercharge: true,
                  alive: true,
                });
              }
            }
          }
        }

        // Check round cleared or shot ended
        const allBallsDead = balls.every((b) => !b.alive);
        if (allBallsDead && balls.length > 0) {
          ballsRef.current = [];
          if (isRoundCleared(pegs)) {
            // Round Clear!
            const bonus = ROUNDS[roundIdxRef.current]?.scoreClearBonus ?? 200;
            scoreRef.current = applyScoreGain(scoreRef.current, bonus);
            setScore(scoreRef.current);
            setPhase("round_cleared");
            playTone("clear", 0, mutedRef.current);
          } else if (shotsLeftRef.current <= 0) {
            // Out of shots -> Game Over
            endGame();
          }
        }
      }

      // Update particles
      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]!;
        p.life += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 80 * dt;
        if (p.life >= p.maxLife) {
          particles.splice(i, 1);
        }
      }

      // Update float texts
      const floatTexts = floatTextsRef.current;
      for (let i = floatTexts.length - 1; i >= 0; i--) {
        const ft = floatTexts[i]!;
        ft.life += dt;
        ft.y -= 25 * dt;
        if (ft.life >= ft.maxLife) {
          floatTexts.splice(i, 1);
        }
      }

      // Screen shake decay
      if (screenShakeRef.current > 0) {
        screenShakeRef.current = Math.max(0, screenShakeRef.current - dt * 25);
      }

      // ─── RENDERING ───
      ctx.save();
      ctx.clearRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

      if (screenShakeRef.current > 0) {
        const ox = (Math.random() - 0.5) * screenShakeRef.current;
        const oy = (Math.random() - 0.5) * screenShakeRef.current;
        ctx.translate(ox, oy);
      }

      // Background Cream Parchment
      ctx.fillStyle = "#FEF9F0";
      ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

      // Subtle background grid
      ctx.strokeStyle = "rgba(139, 94, 60, 0.05)";
      ctx.lineWidth = 1;
      for (let x = 30; x < BOARD_WIDTH; x += 30) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, BOARD_HEIGHT);
        ctx.stroke();
      }
      for (let y = 30; y < BOARD_HEIGHT; y += 30) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(BOARD_WIDTH, y);
        ctx.stroke();
      }

      // Celestial Inner Ring Field
      const cx = CIRCLE_CENTER_X;
      const cy = CIRCLE_CENTER_Y;
      const r = CIRCLE_RADIUS;

      // Inner disc
      const radialGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, r);
      radialGrad.addColorStop(0, "rgba(255, 255, 255, 0.95)");
      radialGrad.addColorStop(0.85, "rgba(254, 249, 240, 0.9)");
      radialGrad.addColorStop(1, "rgba(238, 230, 218, 0.85)");
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = radialGrad;
      ctx.fill();

      // Outer Wood Rim
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.lineWidth = 14;
      ctx.strokeStyle = "#8B5E3C";
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, r + 7, 0, Math.PI * 2);
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#654321";
      ctx.stroke();

      // Brass tick marks along circle (every 15 degrees)
      for (let deg = 0; deg < 360; deg += 15) {
        const rad = degToRad(deg);
        const isMajor = deg % 45 === 0;
        const tickInner = r - (isMajor ? 12 : 6);
        const x1 = cx + tickInner * Math.cos(rad);
        const y1 = cy + tickInner * Math.sin(rad);
        const x2 = cx + r * Math.cos(rad);
        const y2 = cy + r * Math.sin(rad);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineWidth = isMajor ? 2 : 1;
        ctx.strokeStyle = isMajor ? "#B45309" : "rgba(180, 83, 9, 0.4)";
        ctx.stroke();
      }

      // Arc subtended by AB (highlighted arc on circumference)
      const pA = getCirclePoint(angleARef.current);
      const pB = getCirclePoint(angleBRef.current);
      const pP = getCirclePoint(anglePRef.current);

      // Arc AB in pastel amber
      ctx.beginPath();
      ctx.arc(cx, cy, r, angleARef.current, angleBRef.current, false);
      ctx.lineWidth = 6;
      ctx.strokeStyle = "rgba(245, 158, 11, 0.6)";
      ctx.stroke();

      // Draw chord AB
      const is90Thales = isDiameter(angleARef.current, angleBRef.current, 10).isDiameter;
      ctx.beginPath();
      ctx.moveTo(pA.x, pA.y);
      ctx.lineTo(pB.x, pB.y);
      ctx.lineWidth = is90Thales ? 3.5 : 2;
      ctx.strokeStyle = is90Thales ? "#f59e0b" : "rgba(139, 94, 60, 0.45)";
      if (!is90Thales) ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);

      // If Thales 90°: draw small center diameter indicator
      if (is90Thales) {
        ctx.fillStyle = "rgba(245, 158, 11, 0.15)";
        ctx.beginPath();
        ctx.arc(cx, cy, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#b45309";
        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("지름 (180°)", cx, cy + 4);
      }

      // Central angle lines OA and OB if center peg exists
      const configNow = ROUNDS[roundIdxRef.current];
      if (configNow?.hasCenterPeg) {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(pA.x, pA.y);
        ctx.moveTo(cx, cy);
        ctx.lineTo(pB.x, pB.y);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = "rgba(244, 63, 94, 0.45)";
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Inscribed angle triangle APB
      // Wedge fill
      ctx.beginPath();
      ctx.moveTo(pP.x, pP.y);
      ctx.lineTo(pA.x, pA.y);
      ctx.lineTo(pB.x, pB.y);
      ctx.closePath();
      ctx.fillStyle = is90Thales
        ? "rgba(251, 191, 36, 0.14)"
        : "rgba(168, 85, 247, 0.08)";
      ctx.fill();

      // Launch trajectory guide lines (P -> A and P -> B)
      ctx.beginPath();
      ctx.moveTo(pP.x, pP.y);
      ctx.lineTo(pA.x, pA.y);
      ctx.moveTo(pP.x, pP.y);
      ctx.lineTo(pB.x, pB.y);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = is90Thales ? "#f59e0b" : "#a855f7";
      ctx.stroke();

      // Inscribed angle arc indicator at vertex P
      const curInscribed = calcInscribedAngle(pP, pA, pB);
      const angPToA = Math.atan2(pA.y - pP.y, pA.x - pP.x);
      const angPToB = Math.atan2(pB.y - pP.y, pB.x - pP.x);
      ctx.beginPath();
      ctx.arc(pP.x, pP.y, 26, angPToA, angPToB, false);
      ctx.strokeStyle = is90Thales ? "#d97706" : "#7c3aed";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Right-angle square icon at P if Thales 90°!
      if (is90Thales) {
        const sqSize = 12;
        const uA = { x: (pA.x - pP.x) / Math.hypot(pA.x - pP.x, pA.y - pP.y), y: (pA.y - pP.y) / Math.hypot(pA.x - pP.x, pA.y - pP.y) };
        const uB = { x: (pB.x - pP.x) / Math.hypot(pB.x - pP.x, pB.y - pP.y), y: (pB.y - pP.y) / Math.hypot(pB.x - pP.x, pB.y - pP.y) };
        const p1 = { x: pP.x + uA.x * sqSize, y: pP.y + uA.y * sqSize };
        const p2 = { x: p1.x + uB.x * sqSize, y: p1.y + uB.y * sqSize };
        const p3 = { x: pP.x + uB.x * sqSize, y: pP.y + uB.y * sqSize };

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineTo(p3.x, p3.y);
        ctx.strokeStyle = "#d97706";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Draw Slime Pegs
      for (const peg of pegsRef.current) {
        if (peg.popped) continue;

        ctx.save();
        ctx.translate(peg.x, peg.y);

        if (peg.type === "center") {
          // Center Sun Peg
          const pulse = Math.sin(now * 0.005) * 3;
          ctx.beginPath();
          ctx.arc(0, 0, peg.radius + pulse + 4, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(244, 63, 94, 0.25)";
          ctx.fill();

          ctx.beginPath();
          ctx.arc(0, 0, peg.radius, 0, Math.PI * 2);
          const sunGrad = ctx.createRadialGradient(0, 0, 4, 0, 0, peg.radius);
          sunGrad.addColorStop(0, "#fbbf24");
          sunGrad.addColorStop(0.7, "#f43f5e");
          sunGrad.addColorStop(1, "#be123c");
          ctx.fillStyle = sunGrad;
          ctx.fill();
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = "#ffe4e6";
          ctx.stroke();

          // Sun center label
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 13px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("☀️ 2X", 0, 0);
        } else if (peg.type === "armored") {
          // Armored 90° Gold Slime
          ctx.beginPath();
          ctx.arc(0, 0, peg.radius, 0, Math.PI * 2);
          ctx.fillStyle = "#d97706";
          ctx.fill();

          // Golden Shield outer ring
          ctx.lineWidth = 3.5;
          ctx.strokeStyle = "#fef08a";
          ctx.stroke();

          // Shield emblem with "90°" text
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 12px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("90°", 0, -1);

          // Cute eyes
          ctx.fillStyle = "#451a03";
          ctx.beginPath();
          ctx.arc(-6, 6, 2, 0, Math.PI * 2);
          ctx.arc(6, 6, 2, 0, Math.PI * 2);
          ctx.fill();
        } else if (peg.type === "bonus") {
          // Blue Bonus Star Slime
          ctx.beginPath();
          ctx.arc(0, 0, peg.radius, 0, Math.PI * 2);
          ctx.fillStyle = "#38bdf8";
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = "#e0f2fe";
          ctx.stroke();

          // Cute smile
          ctx.fillStyle = "#0c4a6e";
          ctx.beginPath();
          ctx.arc(-4, -2, 2, 0, Math.PI * 2);
          ctx.arc(4, -2, 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(0, 2, 4, 0, Math.PI);
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = "#0c4a6e";
          ctx.stroke();
        } else {
          // Orange Target Slime (standard)
          ctx.beginPath();
          ctx.arc(0, 0, peg.radius, 0, Math.PI * 2);
          ctx.fillStyle = "#f97316";
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = "#ffedd5";
          ctx.stroke();

          // Cute blinking eyes and smile
          ctx.fillStyle = "#7c2d12";
          ctx.beginPath();
          ctx.arc(-5, -2, 2.2, 0, Math.PI * 2);
          ctx.arc(5, -2, 2.2, 0, Math.PI * 2);
          ctx.fill();

          ctx.beginPath();
          ctx.arc(0, 2, 4, 0, Math.PI);
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = "#7c2d12";
          ctx.stroke();
        }

        ctx.restore();
      }

      // Draw active Bouncing Balls
      for (const ball of ballsRef.current) {
        if (!ball.alive) continue;

        ctx.save();
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius + 3, 0, Math.PI * 2);
        ctx.fillStyle = ball.isCenterOvercharge
          ? "rgba(244, 63, 94, 0.4)"
          : ball.isThales90
            ? "rgba(245, 158, 11, 0.45)"
            : "rgba(168, 85, 247, 0.35)";
        ctx.fill();

        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        ctx.fillStyle = ball.isCenterOvercharge
          ? "#f43f5e"
          : ball.isThales90
            ? "#fbbf24"
            : "#a855f7";
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#ffffff";
        ctx.stroke();
        ctx.restore();
      }

      // Draw Pins A and B
      const drawPin = (pt: Point2D, label: string, color: string) => {
        ctx.save();
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 16, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = "#ffffff";
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 13px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, pt.x, pt.y);
        ctx.restore();
      };
      drawPin(pA, "A", "#d97706");
      drawPin(pB, "B", "#d97706");

      // Draw Cannon P & Mascot Pi
      ctx.save();
      // Cannon Base
      ctx.beginPath();
      ctx.arc(pP.x, pP.y, 18, 0, Math.PI * 2);
      ctx.fillStyle = is90Thales ? "#f59e0b" : "#9333ea";
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 13px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("P", pP.x, pP.y);

      // Angle degree label floating near P
      ctx.fillStyle = "#1e293b";
      ctx.font = "bold 12px sans-serif";
      const degText = `${curInscribed.toFixed(1)}°`;
      const textDist = 36;
      const textX = cx + (r - textDist) * Math.cos(anglePRef.current);
      const textY = cy + (r - textDist) * Math.sin(anglePRef.current);
      ctx.fillText(degText, textX, textY);

      // Mascot Pi standing cheerfully outside Cannon P
      const mascotDist = r + 26;
      const mX = cx + mascotDist * Math.cos(anglePRef.current);
      const mY = cy + mascotDist * Math.sin(anglePRef.current);

      ctx.translate(mX, mY);
      // Small cute Pi mascot
      ctx.fillStyle = "#8B5E3C";
      ctx.beginPath();
      ctx.arc(0, -6, 7, 0, Math.PI * 2); // head
      ctx.fill();
      // Wizard hat
      ctx.fillStyle = "#7c3aed";
      ctx.beginPath();
      ctx.moveTo(-7, -10);
      ctx.lineTo(7, -10);
      ctx.lineTo(0, -22);
      ctx.closePath();
      ctx.fill();
      // Compass staff
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(9, -15);
      ctx.lineTo(9, 12);
      ctx.stroke();

      ctx.restore();

      // Render Particles
      for (const p of particlesRef.current) {
        ctx.save();
        const alpha = 1 - p.life / p.maxLife;
        ctx.globalAlpha = Math.max(0, alpha);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Render Floating Texts
      for (const ft of floatTextsRef.current) {
        ctx.save();
        const alpha = 1 - ft.life / ft.maxLife;
        ctx.globalAlpha = Math.max(0, alpha);
        ctx.fillStyle = ft.color;
        ctx.font = "bold 15px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.restore();
      }

      ctx.restore();

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [spawnSparks, addFloatText, endGame]);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      {/* Top Header Card */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-wood/20 bg-cream-light p-4 shadow-sm">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 items-center rounded-full bg-wood/10 px-2.5 text-xs font-bold text-wood">
              Round {roundIdx + 1} / {ROUNDS.length}
            </span>
            <h1 className="text-xl font-black text-wood">
              원주각 팡팡: 별빛 서클 핀볼
            </h1>
          </div>
          <p className="text-xs font-medium text-wood/70">
            {currentRound.title} — {currentRound.subtitle}
          </p>
        </div>

        <div className="flex items-center gap-4">
          {/* Score */}
          <div className="text-right">
            <div className="text-xs font-bold text-wood/60">현재 점수</div>
            <div className="text-2xl font-black text-wood">
              {score.toLocaleString()}{" "}
              <span className="text-xs font-bold text-wood/40">
                / {SCORE_SOFT_CAP}
              </span>
            </div>
          </div>

          {/* Balls / Shots Left */}
          <div className="flex flex-col items-center rounded-xl bg-wood/5 px-3 py-1.5 border border-wood/10">
            <span className="text-[11px] font-bold text-wood/70">남은 볼</span>
            <div className="flex items-center gap-1 text-sm font-black text-wood">
              <span className="text-amber-500">⚪</span> {shotsLeft}
            </div>
          </div>

          {/* Combo Indicator */}
          {combo > 1 && (
            <div className="animate-bounce rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-black text-white shadow-sm">
              {combo} COMBO! 🔥
            </div>
          )}

          {/* Mute Button */}
          <button
            type="button"
            onClick={toggleMute}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-wood/20 bg-white text-sm text-wood hover:bg-wood/5"
            title={muted ? "소리 켜기" : "소리 끄기"}
          >
            {muted ? "🔇" : "🔊"}
          </button>
        </div>
      </div>

      {/* Main Board & Interactive Controls */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_260px]">
        {/* Left: Canvas Area */}
        <div className="relative flex flex-col items-center justify-center rounded-2xl border-2 border-wood/20 bg-[#FEF9F0] p-2 shadow-sm">
          <canvas
            ref={canvasRef}
            width={BOARD_WIDTH}
            height={BOARD_HEIGHT}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="w-full max-w-[600px] touch-none select-none rounded-xl cursor-crosshair"
          />

          {/* Bottom Tip Bar */}
          <div className="mt-2 flex w-full items-center justify-between px-3 py-1.5 text-xs text-wood/80">
            <span className="font-semibold">💡 조작 팁:</span>
            <span>
              원주 위의 <strong className="text-purple-700">P (발사대)</strong>와{" "}
              <strong className="text-amber-700">A, B (핀)</strong>를 드래그해 각도를 조절하세요!
            </span>
          </div>

          {/* Overlay for Ready State */}
          {phase === "ready" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-wood/60 backdrop-blur-sm rounded-2xl p-6 text-center text-white">
              <div className="mb-2 text-4xl">🌟</div>
              <h2 className="mb-1 text-2xl font-black">원주각 팡팡: 별빛 서클 핀볼</h2>
              <p className="mb-4 max-w-md text-sm text-white/90">
                원주 위의 발사대 P에서 두 핀 A, B를 향해 트윈 볼을 쏘아 모든 슬라임을 터뜨리세요!
                <br />
                동일한 호를 바라보는 원주각은 어디서 쏴도 항상 같습니다.
              </p>
              <button
                type="button"
                onClick={startGame}
                className="rounded-2xl bg-amber-500 px-8 py-3 text-lg font-black text-white shadow-lg hover:bg-amber-600 transition"
              >
                게임 시작하기
              </button>
            </div>
          )}

          {/* Overlay for Round Cleared */}
          {phase === "round_cleared" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-wood/70 backdrop-blur-sm rounded-2xl p-6 text-center text-white">
              <div className="mb-2 text-4xl">🎉</div>
              <h2 className="mb-1 text-2xl font-black">Round {roundIdx + 1} 클리어!</h2>
              <p className="mb-4 text-sm text-white/90">
                원주각의 법칙으로 슬라임들을 멋지게 정화했습니다!
                <br />
                클리어 보너스: +{ROUNDS[roundIdx]?.scoreClearBonus}점
              </p>
              <button
                type="button"
                onClick={handleNextRound}
                className="rounded-2xl bg-amber-500 px-8 py-3 text-base font-black text-white shadow-lg hover:bg-amber-600 transition"
              >
                {roundIdx + 1 < ROUNDS.length ? "다음 라운드 도전 →" : "최종 결과 보기 🏆"}
              </button>
            </div>
          )}

          {/* Overlay for Game Over */}
          {phase === "ended" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-wood/80 backdrop-blur-sm rounded-2xl p-6 text-center text-white">
              <div className="mb-2 text-4xl">✨</div>
              <h2 className="mb-1 text-2xl font-black">별빛 탐험 완료!</h2>
              <p className="mb-2 text-sm text-white/90">
                최종 점수: <strong className="text-amber-400 text-xl">{score.toLocaleString()}점</strong>
              </p>
              <div className="mb-3 flex gap-4 text-xs text-white/80">
                <span>클리어: {roundIdx + 1}라운드</span>
                <span>최대 콤보: {maxCombo}</span>
                <span>90° 샷: {thalesShots}회</span>
              </div>
              {submitResult?.xpAwarded ? (
                <div className="mb-4 rounded-xl bg-amber-400/20 px-4 py-1.5 text-sm font-black text-amber-300 border border-amber-400/30">
                  +{submitResult.xpAwarded} XP 획득! 🌟
                </div>
              ) : null}
              <button
                type="button"
                onClick={startGame}
                className="rounded-2xl bg-amber-500 px-8 py-3 text-base font-black text-white shadow-lg hover:bg-amber-600 transition"
              >
                다시 플레이하기 ↺
              </button>
            </div>
          )}
        </div>

        {/* Right: Angle Controller & Math HUD */}
        <div className="flex flex-col gap-3">
          {/* Live Inscribed Angle Card */}
          <div className="rounded-2xl border-2 border-wood/20 bg-cream-light p-4 shadow-sm space-y-3">
            <h2 className="text-xs font-black tracking-wider text-wood/60 uppercase">
              실시간 원주각 관측기
            </h2>

            <div className="rounded-xl bg-purple-50 p-3 border border-purple-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-900">
                  원주각 <Latex latex="\angle\text{APB}" />
                </span>
                <span className="text-xl font-black text-purple-700">
                  {inscribedAngleVal.toFixed(1)}°
                </span>
              </div>
              <p className="mt-1 text-[11px] text-purple-600">
                발사대 P를 아무리 옮겨도 두 볼의 각도는 유지됩니다!
              </p>
            </div>

            {/* Central Angle */}
            <div className="rounded-xl bg-rose-50 p-3 border border-rose-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-900">
                  중심각 <Latex latex="\angle\text{AOB}" />
                </span>
                <span className="text-xl font-black text-rose-700">
                  {centralAngleVal.toFixed(1)}°
                </span>
              </div>
              <p className="mt-1 text-[11px] text-rose-600">
                중심각 = <Latex latex="2 \times \angle\text{APB}" /> (정확히 2배!)
              </p>
            </div>

            {/* Thales 90° Status Badge */}
            <div
              className={`rounded-xl p-3 border transition ${
                isThalesActive
                  ? "bg-amber-100 border-amber-400 text-amber-950"
                  : "bg-wood/5 border-wood/10 text-wood/60"
              }`}
            >
              <div className="flex items-center gap-1.5 font-black text-xs">
                <span>{isThalesActive ? "⚡" : "🛡️"}</span>
                <span>
                  {isThalesActive
                    ? "탈레스 90° 직각 샷 활성!"
                    : "지름 미정렬 (일반 샷)"}
                </span>
              </div>
              <p className="mt-1 text-[11px]">
                {isThalesActive
                  ? "황금 방패 슬라임을 관통하여 격파할 수 있습니다!"
                  : "핀 AB를 지름으로 연결하면 90° 직각 샷이 발동해요."}
              </p>
            </div>

            {/* Quick Presets */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] font-bold text-wood/60">빠른 각도 설정</span>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={handleSnapDiameter}
                  className="rounded-lg border border-amber-300 bg-amber-50 px-2 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100 transition"
                >
                  ⚡ 지름 정렬 (90°)
                </button>
                <button
                  type="button"
                  onClick={() => handleSetAnglePreset(60)}
                  className="rounded-lg border border-wood/20 bg-white px-2 py-1.5 text-xs font-bold text-wood hover:bg-wood/5 transition"
                >
                  📐 정삼각형 (60°)
                </button>
                <button
                  type="button"
                  onClick={() => handleSetAnglePreset(45)}
                  className="rounded-lg border border-wood/20 bg-white px-2 py-1.5 text-xs font-bold text-wood hover:bg-wood/5 transition"
                >
                  📐 직각이등변 (45°)
                </button>
                <button
                  type="button"
                  onClick={() => handleSetAnglePreset(30)}
                  className="rounded-lg border border-wood/20 bg-white px-2 py-1.5 text-xs font-bold text-wood hover:bg-wood/5 transition"
                >
                  📐 예각 조준 (30°)
                </button>
              </div>
            </div>
          </div>

          {/* Big Shoot Button */}
          <button
            type="button"
            disabled={phase !== "playing" || shotsLeft <= 0}
            onClick={handleShoot}
            className="flex items-center justify-center gap-2 rounded-2xl bg-amber-500 py-4 text-lg font-black text-white shadow-md hover:bg-amber-600 active:scale-95 disabled:opacity-50 transition"
          >
            <span>트윈 볼 발사!</span>
            <span className="rounded-md bg-white/20 px-2 py-0.5 text-xs font-bold">
              Space
            </span>
          </button>
        </div>
      </div>

      {/* Round Math Formula Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-wood/20 bg-cream-light p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-wood/10 text-xl font-black text-wood">
            π
          </span>
          <div>
            <div className="text-xs font-bold text-wood/60">학습 공식</div>
            <div className="text-sm font-black text-wood">
              <Latex latex={currentRound.mathFormula} />
            </div>
          </div>
        </div>
        <div className="text-xs text-wood/70 max-w-md">
          {currentRound.tip}
        </div>
      </div>

      {/* Ranking Board Section */}
      {phase === "ended" && (
        <div className="mt-6">
          <GameRankingBoard
            rows={ranking}
            scope={rankingScope}
            mode={rankingMode}
            onScopeChange={handleScopeChange}
            onModeChange={handleModeChange}
          />
        </div>
      )}
    </div>
  );
}
