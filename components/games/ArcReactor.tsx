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
import { applyScoreGain } from "@/lib/xp";
import {
  CANVAS_SIZE,
  CENTER_X,
  CENTER_Y,
  CONTENT_KEY,
  FEVER_COMBO_THRESHOLD,
  MAX_LIVES,
  REACTOR_RADIUS,
  START_LIVES,
  WAVE_CONFIGS,
  calcCentralAngle,
  calcInscribedAngle,
  createWaveEntities,
  degToRad,
  distance,
  getCirclePoint,
  isDiameter,
  isPointInSector,
  lineIntersectsCircle,
  normalizeAngle,
  snapToDiameter,
  type Barrier,
  type GameMode,
  type Target,
} from "@/lib/arc-reactor-math";

const POS_O = { x: CENTER_X, y: CENTER_Y };

type Phase = "ready" | "playing" | "ended";

const MUTE_KEY = "pm_arc_reactor_mute";

function Latex({ latex, className }: { latex: string; className?: string }) {
  const html = katex.renderToString(latex, {
    throwOnError: false,
    displayMode: false,
  });
  return (
    <span className={className} dangerouslySetInnerHTML={{ __html: html }} />
  );
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  decay: number;
}

interface FloatingText {
  id: number;
  text: string;
  x: number;
  y: number;
  color: string;
  alpha: number;
  scale: number;
}

/* ---------------------------------------------------- Web Audio Synth */
function playSfx(
  kind: "fire" | "thales_snap" | "overcharge" | "nova" | "hit" | "wrong" | "wave_clear",
  combo = 0,
  muted = false,
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

    if (kind === "fire") {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(740, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.12);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc.start(now);
      osc.stop(now + 0.15);
    } else if (kind === "thales_snap") {
      // Golden right angle chord
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "triangle";
        o.frequency.setValueAtTime(freq, now + idx * 0.035);
        g.gain.setValueAtTime(0.12, now + idx * 0.035);
        g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.035 + 0.3);
        o.connect(g);
        g.connect(ctx.destination);
        o.start(now + idx * 0.035);
        o.stop(now + idx * 0.035 + 0.35);
      });
    } else if (kind === "overcharge") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.linearRampToValueAtTime(660, now + 0.25);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.32);
    } else if (kind === "nova") {
      // 808 Sub-bass shockwave
      osc.type = "sine";
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(28, now + 0.5);
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc.start(now);
      osc.stop(now + 0.58);
    } else if (kind === "hit") {
      const scale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
      const freq = scale[combo % scale.length]!;
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, now + 0.12);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.start(now);
      osc.stop(now + 0.24);
    } else if (kind === "wrong") {
      osc.type = "square";
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.setValueAtTime(95, now + 0.1);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.22);
    } else if (kind === "wave_clear") {
      const fan = [440, 554.37, 659.25, 880];
      fan.forEach((freq, idx) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "triangle";
        o.frequency.setValueAtTime(freq, now + idx * 0.08);
        g.gain.setValueAtTime(0.12, now + idx * 0.08);
        g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.4);
        o.connect(g);
        g.connect(ctx.destination);
        o.start(now + idx * 0.08);
        o.stop(now + idx * 0.08 + 0.45);
      });
    }
  } catch {
    // AudioContext blocked or not supported
  }
}

export default function ArcReactor() {
  const [phase, setPhase] = useState<Phase>("ready");
  const [muted, setMuted] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(MUTE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [lives, setLives] = useState(START_LIVES);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [waveIdx, setWaveIdx] = useState(0); // 0-based index
  const [mode, setMode] = useState<GameMode>("glide");
  const [shakeOffset, setShakeOffset] = useState({ x: 0, y: 0 });

  // Statistics for activity result
  const [stats, setStats] = useState({
    wavesCleared: 0,
    coresDestroyed: 0,
    thalesStrikes: 0,
    overchargeBeams: 0,
    cyclicNovas: 0,
    maxCombo: 0,
  });

  // Ranking & submission state
  const [rankingMode, setRankingMode] = useState<RankingMode>("all");
  const [rankingScope, setRankingScope] = useState<RankingScope>("world");
  const [rankingRows, setRankingRows] = useState<RankingRow[]>([]);
  const [rankingLoading, setRankingLoading] = useState(false);
  const [submitResult, setSubmitResult] = useState<GameSubmitClientResult | null>(null);
  const [, startTransition] = useTransition();

  // Canvas ref
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Geometry node angles (in radians)
  const [angleA, setAngleA] = useState(degToRad(30));
  const [angleB, setAngleB] = useState(degToRad(150));
  const [angleP, setAngleP] = useState(degToRad(270));
  const [angleC, setAngleC] = useState(degToRad(120));
  const [angleD, setAngleD] = useState(degToRad(300));

  // Dragging state
  const draggingNode = useRef<"P" | "A" | "B" | "C" | "D" | null>(null);

  // Game entities in refs for requestAnimationFrame loop
  const targetsRef = useRef<Target[]>([]);
  const barriersRef = useRef<Barrier[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  const beamPulseRef = useRef<{ alpha: number; mode: GameMode; color: string } | null>(null);
  const floatingIdCounter = useRef(1);

  const toggleMute = () => {
    setMuted((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(MUTE_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Trigger screen shake
  const shakeScreen = useCallback((amount = 6) => {
    const rx = (Math.random() - 0.5) * amount;
    const ry = (Math.random() - 0.5) * amount;
    setShakeOffset({ x: rx, y: ry });
    setTimeout(() => setShakeOffset({ x: 0, y: 0 }), 180);
  }, []);

  const dischargeRef = useRef<() => void>(() => {});

  // Add floating text
  const addFloatingText = useCallback((text: string, x: number, y: number, color = "#67e8f9") => {
    floatingTextsRef.current.push({
      id: floatingIdCounter.current++,
      text,
      x,
      y,
      color,
      alpha: 1,
      scale: 1.2,
    });
  }, []);

  // Spawn particle explosion
  const spawnExplosion = useCallback((x: number, y: number, color = "#22d3ee", count = 16) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 4.5;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        size: 3 + Math.random() * 4,
        alpha: 1,
        decay: 0.02 + Math.random() * 0.03,
      });
    }
  }, []);

  // Initialize a wave
  const setupWave = useCallback((index: number) => {
    const waveNum = index + 1;
    const waveConfig = WAVE_CONFIGS[index] || {
      waveNumber: waveNum,
      title: `Overdrive Wave ${waveNum}`,
      subtitle: "극한의 기하 콤보 오버드라이브",
      recommendedMode: "glide" as GameMode,
      description: "원주각의 모든 법칙을 이용해 쏟아지는 다크 매터를 격파하세요!",
      mathHint: "1000점 이상에서는 정답/격파마다 +1점씩 추가됩니다.",
      requiredKills: 12,
      targetCount: 15,
      hasBarrier: true,
      scoreBonus: 50,
    };

    const { targets, barriers } = createWaveEntities(waveNum);
    targetsRef.current = targets;
    barriersRef.current = barriers;
    setMode(waveConfig.recommendedMode);

    // Position default nodes nicely for this wave's mode
    if (waveConfig.recommendedMode === "thales") {
      setAngleA(degToRad(0));
      setAngleB(degToRad(180));
      setAngleP(degToRad(90));
    } else if (waveConfig.recommendedMode === "cyclic") {
      setAngleA(degToRad(45));
      setAngleB(degToRad(135));
      setAngleC(degToRad(225));
      setAngleD(degToRad(315));
      setAngleP(degToRad(45));
    } else if (waveConfig.recommendedMode === "overcharge") {
      setAngleA(degToRad(40));
      setAngleB(degToRad(140));
      setAngleP(degToRad(270));
    } else {
      setAngleA(degToRad(30));
      setAngleB(degToRad(150));
      setAngleP(degToRad(270));
    }
  }, []);

  // Start game
  const startGame = () => {
    setPhase("playing");
    setLives(START_LIVES);
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setWaveIdx(0);
    setStats({
      wavesCleared: 0,
      coresDestroyed: 0,
      thalesStrikes: 0,
      overchargeBeams: 0,
      cyclicNovas: 0,
      maxCombo: 0,
    });
    setupWave(0);
    playSfx("hit", 0, muted);
  };

  // End game and submit score
  const endGame = useCallback(async () => {
    setPhase("ended");
    playSfx("wave_clear", 0, muted);

    const details = activityDetailsV1({
      wavesCleared: stats.wavesCleared,
      coresDestroyed: stats.coresDestroyed,
      thalesStrikes: stats.thalesStrikes,
      overchargeBeams: stats.overchargeBeams,
      cyclicNovas: stats.cyclicNovas,
      maxCombo: Math.max(maxCombo, stats.maxCombo),
    });

    try {
      const res = await submitGameRun({
        contentKey: CONTENT_KEY,
        score,
        details,
      });
      setSubmitResult(res);
    } catch {
      // Offline or guest mode
    }

    // Fetch initial ranking
    setRankingLoading(true);
    try {
      const r = await fetchGameRanking({
        contentKey: CONTENT_KEY,
        scope: "world",
        mode: "all",
      });
      setRankingRows(r);
    } catch {
      // ranking fetch error
    } finally {
      setRankingLoading(false);
    }
  }, [maxCombo, muted, score, stats]);

  // Handle ranking scope/mode changes
  const handleScopeChange = (scope: RankingScope) => {
    setRankingScope(scope);
    setRankingLoading(true);
    startTransition(async () => {
      try {
        const rows = await fetchGameRanking({
          contentKey: CONTENT_KEY,
          scope,
          mode: rankingMode,
        });
        setRankingRows(rows);
      } catch {
        // ignore
      } finally {
        setRankingLoading(false);
      }
    });
  };

  const handleModeChange = (rMode: RankingMode) => {
    setRankingMode(rMode);
    setRankingLoading(true);
    startTransition(async () => {
      try {
        const rows = await fetchGameRanking({
          contentKey: CONTENT_KEY,
          scope: rankingScope,
          mode: rMode,
        });
        setRankingRows(rows);
      } catch {
        // ignore
      } finally {
        setRankingLoading(false);
      }
    });
  };

  // Node Cartesian Positions
  const posP = getCirclePoint(angleP);
  const posA = getCirclePoint(angleA);
  const posB = getCirclePoint(angleB);
  const posC = getCirclePoint(angleC);
  const posD = getCirclePoint(angleD);
  const posO = POS_O;

  // Current Math Values
  const currentInscribed = calcInscribedAngle(posP, posA, posB);
  const currentCentral = calcCentralAngle(posA, posB);
  const { isDiameter: diameterActive } = isDiameter(angleA, angleB, 10);
  const cyclicSumBD =
    calcInscribedAngle(posB, posA, posC) + calcInscribedAngle(posD, posA, posC);

  // Snap B to Diameter action
  const snapDiameterAction = () => {
    const snapped = snapToDiameter(angleA, angleB, 180);
    setAngleB(snapped);
    playSfx("thales_snap", 0, muted);
    shakeScreen(5);
    addFloatingText("THALES 90° LOCKED!", CENTER_X, CENTER_Y - 40, "#fbbf24");
  };

  // Execute Discharge / Fire
  const dischargeWeapon = () => {
    if (phase !== "playing") return;

    let destroyedThisShot = 0;
    let gainedScore = 0;
    const currentTargets = targetsRef.current;
    const currentBarriers = barriersRef.current;

    // Check hit according to current mode
    if (mode === "thales") {
      // Must be diameter
      if (!diameterActive) {
        playSfx("wrong", 0, muted);
        addFloatingText("지름이 아닙니다! (AB를 지름으로 정렬)", posP.x, posP.y - 20, "#ef4444");
        return;
      }

      playSfx("thales_snap", combo, muted);
      shakeScreen(8);
      beamPulseRef.current = { alpha: 1, mode: "thales", color: "#fbbf24" };
      addFloatingText("90° THALES BLADE!", posP.x, posP.y - 30, "#fbbf24");

      // Hits line PA or PB
      currentTargets.forEach((t) => {
        if (!t.alive) return;
        const hitA = lineIntersectsCircle(posP, posA, { x: t.x, y: t.y }, t.radius + 15);
        const hitB = lineIntersectsCircle(posP, posB, { x: t.x, y: t.y }, t.radius + 15);

        if (hitA || hitB) {
          t.alive = false;
          destroyedThisShot++;
          gainedScore += t.scoreValue;
          spawnExplosion(t.x, t.y, "#fbbf24", 20);
        }
      });

      setStats((s) => ({ ...s, thalesStrikes: s.thalesStrikes + 1 }));
    } else if (mode === "overcharge") {
      // Center Overcharge 2X fan
      playSfx("overcharge", combo, muted);
      shakeScreen(9);
      beamPulseRef.current = { alpha: 1, mode: "overcharge", color: "#ec4899" };
      addFloatingText(`2X FLARE (${(currentInscribed * 2).toFixed(0)}°)`, CENTER_X, CENTER_Y - 20, "#ec4899");

      currentTargets.forEach((t) => {
        if (!t.alive) return;
        // Check if inside sector of angleA and angleB from center
        const inSec = isPointInSector(t.x, t.y, CENTER_X, CENTER_Y, REACTOR_RADIUS, angleA, angleB);
        if (inSec) {
          t.alive = false;
          destroyedThisShot++;
          gainedScore += t.scoreValue;
          spawnExplosion(t.x, t.y, "#ec4899", 14);
        }
      });

      setStats((s) => ({ ...s, overchargeBeams: s.overchargeBeams + 1 }));
    } else if (mode === "cyclic") {
      // Cyclic 180 Nova
      playSfx("nova", combo, muted);
      shakeScreen(12);
      beamPulseRef.current = { alpha: 1, mode: "cyclic", color: "#a855f7" };
      addFloatingText("180° CYCLIC NOVA!", CENTER_X, CENTER_Y - 30, "#a855f7");

      currentTargets.forEach((t) => {
        if (!t.alive) return;
        t.alive = false;
        destroyedThisShot++;
        gainedScore += t.scoreValue;
        spawnExplosion(t.x, t.y, "#a855f7", 24);
      });

      setStats((s) => ({ ...s, cyclicNovas: s.cyclicNovas + 1 }));
    } else {
      // Mode: Glide Aim
      playSfx("fire", combo, muted);
      shakeScreen(4);
      beamPulseRef.current = { alpha: 1, mode: "glide", color: "#22d3ee" };

      currentTargets.forEach((t) => {
        if (!t.alive) return;

        // Check barrier collision
        let blocked = false;
        if (currentBarriers.length > 0) {
          const bar = currentBarriers[0]!;
          const targetAngle = Math.atan2(t.y - CENTER_Y, t.x - CENTER_X);
          const normTarget = normalizeAngle(targetAngle);
          const normAperture = normalizeAngle(bar.apertureCenter);
          const diff = Math.min(
            Math.abs(normTarget - normAperture),
            Math.PI * 2 - Math.abs(normTarget - normAperture),
          );
          if (diff > bar.apertureWidth / 2) {
            blocked = true;
          }
        }

        if (blocked) {
          addFloatingText("BLOCKED BY SHIELD!", t.x, t.y - 15, "#f43f5e");
          return;
        }

        // Check if inside angle cone or close to PA/PB rays
        const hitA = lineIntersectsCircle(posP, posA, { x: t.x, y: t.y }, t.radius + 18);
        const hitB = lineIntersectsCircle(posP, posB, { x: t.x, y: t.y }, t.radius + 18);

        if (hitA || hitB || distance(posP, { x: t.x, y: t.y }) < REACTOR_RADIUS) {
          if (t.type === "armor_cube") {
            playSfx("wrong", 0, muted);
            addFloatingText("직각 아머! 탈레스 90°로만 파괴 가능!", t.x, t.y - 20, "#f59e0b");
            return;
          }

          if (t.type === "boss") {
            t.hp -= 200;
            if (t.hp <= 0) {
              t.alive = false;
              destroyedThisShot++;
              gainedScore += t.scoreValue;
              spawnExplosion(t.x, t.y, "#38bdf8", 40);
            } else {
              spawnExplosion(t.x, t.y, "#38bdf8", 10);
              addFloatingText(`BOSS HP: ${t.hp}`, t.x, t.y - 30, "#38bdf8");
            }
          } else {
            t.alive = false;
            destroyedThisShot++;
            gainedScore += t.scoreValue;
            spawnExplosion(t.x, t.y, "#22d3ee", 16);
          }
        }
      });
    }

    if (destroyedThisShot > 0) {
      playSfx("hit", combo + 1, muted);
      const newCombo = combo + 1;
      setCombo(newCombo);
      setMaxCombo((prev) => Math.max(prev, newCombo));

      const comboMultiplier = newCombo >= FEVER_COMBO_THRESHOLD ? 2.5 : 1 + newCombo * 0.2;
      const calculatedPoints = Math.round(gainedScore * comboMultiplier);

      setScore((prev) => applyScoreGain(prev, calculatedPoints));
      setStats((s) => ({
        ...s,
        coresDestroyed: s.coresDestroyed + destroyedThisShot,
        maxCombo: Math.max(s.maxCombo, newCombo),
      }));

      addFloatingText(`+${calculatedPoints} PTS!`, CENTER_X, CENTER_Y + 40, "#4ade80");

      // Check wave clear
      const remaining = currentTargets.filter((t) => t.alive).length;
      if (remaining === 0) {
        // Wave clear bonus
        const curConfig = WAVE_CONFIGS[waveIdx];
        const bonus = curConfig?.scoreBonus ?? 50;
        setScore((prev) => applyScoreGain(prev, bonus));
        setStats((s) => ({ ...s, wavesCleared: s.wavesCleared + 1 }));
        playSfx("wave_clear", 0, muted);
        shakeScreen(10);
        addFloatingText("★ WAVE COMPLETE! ★", CENTER_X, CENTER_Y, "#fde047");

        setTimeout(() => {
          if (waveIdx + 1 < WAVE_CONFIGS.length) {
            setWaveIdx((w) => w + 1);
            setupWave(waveIdx + 1);
          } else {
            // Overdrive loop or victory!
            setWaveIdx((w) => w + 1);
            setupWave(waveIdx + 1);
          }
        }, 1200);
      }
    } else {
      // Miss
      setCombo(0);
    }
  };

  useEffect(() => {
    dischargeRef.current = dischargeWeapon;
  });

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        dischargeRef.current();
      } else if (e.key === "1") {
        setMode("glide");
      } else if (e.key === "2") {
        setMode("thales");
      } else if (e.key === "3") {
        setMode("overcharge");
      } else if (e.key === "4") {
        setMode("cyclic");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Drag mouse/touch event handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_SIZE / rect.width;
    const scaleY = CANVAS_SIZE / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    // Check which node is closest
    const grabThreshold = 36;
    if (distance({ x: mx, y: my }, posP) <= grabThreshold) {
      draggingNode.current = "P";
    } else if (distance({ x: mx, y: my }, posA) <= grabThreshold) {
      draggingNode.current = "A";
    } else if (distance({ x: mx, y: my }, posB) <= grabThreshold) {
      draggingNode.current = "B";
    } else if (mode === "cyclic" && distance({ x: mx, y: my }, posC) <= grabThreshold) {
      draggingNode.current = "C";
    } else if (mode === "cyclic" && distance({ x: mx, y: my }, posD) <= grabThreshold) {
      draggingNode.current = "D";
    } else {
      // Clicked reactor background -> Fire!
      dischargeWeapon();
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!draggingNode.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_SIZE / rect.width;
    const scaleY = CANVAS_SIZE / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    const angle = normalizeAngle(Math.atan2(my - CENTER_Y, mx - CENTER_X));

    if (draggingNode.current === "P") {
      setAngleP(angle);
    } else if (draggingNode.current === "A") {
      setAngleA(angle);
    } else if (draggingNode.current === "B") {
      // If in Thales mode and close to diameter, snap!
      const snapped = snapToDiameter(angleA, angle, 12);
      setAngleB(snapped);
    } else if (draggingNode.current === "C") {
      setAngleC(angle);
    } else if (draggingNode.current === "D") {
      setAngleD(angle);
    }
  };

  const handlePointerUp = () => {
    draggingNode.current = null;
  };

  // Main Canvas Render & Animation Loop
  useEffect(() => {
    let animId: number;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Clear with subtle dark trail
      ctx.fillStyle = "#070b14";
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      // 1. Draw reactor background grid & circles
      ctx.save();
      ctx.strokeStyle = "rgba(34, 211, 238, 0.08)";
      ctx.lineWidth = 1;
      for (let r = 50; r <= REACTOR_RADIUS; r += 45) {
        ctx.beginPath();
        ctx.arc(CENTER_X, CENTER_Y, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Outer collider rail
      ctx.strokeStyle = "#0ea5e9";
      ctx.lineWidth = 3;
      ctx.shadowColor = "#38bdf8";
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(CENTER_X, CENTER_Y, REACTOR_RADIUS, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // 2. Highlight Arc AB on the circle (the base arc)
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 6;
      ctx.shadowColor = "#fbbf24";
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(CENTER_X, CENTER_Y, REACTOR_RADIUS, angleA, angleB, false);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // 3. Draw Barriers & rotate them
      barriersRef.current.forEach((bar) => {
        bar.apertureCenter = normalizeAngle(bar.apertureCenter + bar.rotSpeed);
        const start = bar.apertureCenter + bar.apertureWidth / 2;
        const end = bar.apertureCenter - bar.apertureWidth / 2;

        ctx.save();
        ctx.strokeStyle = "rgba(244, 63, 94, 0.85)";
        ctx.lineWidth = bar.thickness;
        ctx.shadowColor = "#f43f5e";
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(CENTER_X, CENTER_Y, bar.radius, start, end, false);
        ctx.stroke();

        // Draw aperture marker
        const apX = CENTER_X + bar.radius * Math.cos(bar.apertureCenter);
        const apY = CENTER_Y + bar.radius * Math.sin(bar.apertureCenter);
        ctx.fillStyle = "#22d3ee";
        ctx.beginPath();
        ctx.arc(apX, apY, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // 4. Update & Draw Targets
      targetsRef.current.forEach((t) => {
        if (!t.alive) return;
        t.angle = normalizeAngle(t.angle + t.speed);
        t.x = CENTER_X + t.dist * Math.cos(t.angle);
        t.y = CENTER_Y + t.dist * Math.sin(t.angle);

        ctx.save();
        if (t.type === "armor_cube") {
          // 90° Armored Cube
          ctx.strokeStyle = "#fbbf24";
          ctx.lineWidth = 3;
          ctx.shadowColor = "#f59e0b";
          ctx.shadowBlur = 8;
          ctx.strokeRect(t.x - t.radius, t.y - t.radius, t.radius * 2, t.radius * 2);
          ctx.fillStyle = "rgba(251, 191, 36, 0.2)";
          ctx.fillRect(t.x - t.radius, t.y - t.radius, t.radius * 2, t.radius * 2);
          // ∟ 90° mark
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 12px sans-serif";
          ctx.fillText("∟90°", t.x - 12, t.y + 4);
        } else if (t.type === "swarm_parasite") {
          // Swarm parasite
          ctx.fillStyle = "#ec4899";
          ctx.shadowColor = "#f472b6";
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
          ctx.fill();
        } else if (t.type === "boss") {
          // Chaos Singularity Boss
          ctx.fillStyle = "#1e1b4b";
          ctx.strokeStyle = "#818cf8";
          ctx.lineWidth = 4;
          ctx.shadowColor = "#a5b4fc";
          ctx.shadowBlur = 20;
          ctx.beginPath();
          ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // HP bar
          const barW = 80;
          const barH = 8;
          const pct = Math.max(0, t.hp / t.maxHp);
          ctx.fillStyle = "rgba(0,0,0,0.6)";
          ctx.fillRect(t.x - barW / 2, t.y - t.radius - 18, barW, barH);
          ctx.fillStyle = "#38bdf8";
          ctx.fillRect(t.x - barW / 2, t.y - t.radius - 18, barW * pct, barH);
        } else {
          // Standard Dark Core
          ctx.fillStyle = "#06b6d4";
          ctx.strokeStyle = "#a5f3fc";
          ctx.lineWidth = 2;
          ctx.shadowColor = "#22d3ee";
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
        ctx.restore();
      });

      // 5. Draw Chords & Beams according to mode
      if (mode === "thales") {
        // Draw diameter line A-O-B
        ctx.save();
        ctx.strokeStyle = diameterActive ? "#fbbf24" : "rgba(251, 191, 36, 0.4)";
        ctx.lineWidth = diameterActive ? 4 : 1.5;
        ctx.setLineDash(diameterActive ? [] : [6, 4]);
        ctx.beginPath();
        ctx.moveTo(posA.x, posA.y);
        ctx.lineTo(posB.x, posB.y);
        ctx.stroke();
        ctx.restore();

        // Right angle triangle APB
        ctx.save();
        ctx.strokeStyle = diameterActive ? "#fef08a" : "rgba(254, 240, 138, 0.4)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(posP.x, posP.y);
        ctx.lineTo(posA.x, posA.y);
        ctx.lineTo(posB.x, posB.y);
        ctx.closePath();
        ctx.stroke();

        if (diameterActive) {
          // Draw right angle symbol at P
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 2;
          const vPA = { x: (posA.x - posP.x) / distance(posP, posA), y: (posA.y - posP.y) / distance(posP, posA) };
          const vPB = { x: (posB.x - posP.x) / distance(posP, posB), y: (posB.y - posP.y) / distance(posP, posB) };
          const s = 16;
          ctx.beginPath();
          ctx.moveTo(posP.x + vPA.x * s, posP.y + vPA.y * s);
          ctx.lineTo(posP.x + (vPA.x + vPB.x) * s, posP.y + (vPA.y + vPB.y) * s);
          ctx.lineTo(posP.x + vPB.x * s, posP.y + vPB.y * s);
          ctx.stroke();
        }
        ctx.restore();
      } else if (mode === "overcharge") {
        // Sector AOB from Center O
        ctx.save();
        ctx.fillStyle = "rgba(236, 72, 153, 0.2)";
        ctx.strokeStyle = "#ec4899";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(CENTER_X, CENTER_Y);
        ctx.arc(CENTER_X, CENTER_Y, REACTOR_RADIUS, angleA, angleB, false);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Inscribed angle rays from P as well
        ctx.strokeStyle = "rgba(34, 211, 238, 0.5)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(posP.x, posP.y);
        ctx.lineTo(posA.x, posA.y);
        ctx.moveTo(posP.x, posP.y);
        ctx.lineTo(posB.x, posB.y);
        ctx.stroke();
        ctx.restore();
      } else if (mode === "cyclic") {
        // Inscribed quadrilateral ABCD
        ctx.save();
        ctx.strokeStyle = "#c084fc";
        ctx.lineWidth = 3;
        ctx.fillStyle = "rgba(192, 132, 252, 0.12)";
        ctx.beginPath();
        ctx.moveTo(posA.x, posA.y);
        ctx.lineTo(posB.x, posB.y);
        ctx.lineTo(posC.x, posC.y);
        ctx.lineTo(posD.x, posD.y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      } else {
        // Standard Glide Aim mode: rays PA and PB
        ctx.save();
        ctx.strokeStyle = "#22d3ee";
        ctx.lineWidth = 3;
        ctx.shadowColor = "#38bdf8";
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(posP.x, posP.y);
        ctx.lineTo(posA.x, posA.y);
        ctx.moveTo(posP.x, posP.y);
        ctx.lineTo(posB.x, posB.y);
        ctx.stroke();

        // Arc angle sector preview
        ctx.fillStyle = "rgba(34, 211, 238, 0.12)";
        ctx.beginPath();
        ctx.moveTo(posP.x, posP.y);
        ctx.lineTo(posA.x, posA.y);
        ctx.arc(CENTER_X, CENTER_Y, REACTOR_RADIUS, angleA, angleB, false);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // 6. Draw Discharge Pulse effect
      if (beamPulseRef.current && beamPulseRef.current.alpha > 0) {
        ctx.save();
        ctx.strokeStyle = beamPulseRef.current.color;
        ctx.lineWidth = 8 * beamPulseRef.current.alpha;
        ctx.shadowColor = beamPulseRef.current.color;
        ctx.shadowBlur = 25;
        ctx.beginPath();
        ctx.arc(CENTER_X, CENTER_Y, REACTOR_RADIUS * (1.1 - beamPulseRef.current.alpha * 0.1), 0, Math.PI * 2);
        ctx.stroke();
        beamPulseRef.current.alpha -= 0.08;
        ctx.restore();
      }

      // 7. Draw Geometry Nodes (P, A, B, O, C, D)
      const drawNode = (
        p: { x: number; y: number },
        label: string,
        color: string,
        radius = 16,
      ) => {
        ctx.save();
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 13px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, p.x, p.y);
        ctx.restore();
      };

      // Node P (Inscribed vertex)
      drawNode(posP, "P", "#06b6d4", 18);
      // Nodes A and B (Base Arc)
      drawNode(posA, "A", "#f59e0b", 16);
      drawNode(posB, "B", "#f59e0b", 16);
      // Center Node O
      drawNode(posO, "O", "#6366f1", 14);

      if (mode === "cyclic") {
        drawNode(posC, "C", "#a855f7", 16);
        drawNode(posD, "D", "#a855f7", 16);
      }

      // 8. Update & Draw Particles
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i]!;
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= p.decay;

        if (p.alpha <= 0) {
          particlesRef.current.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 9. Update & Draw Floating Texts
      for (let i = floatingTextsRef.current.length - 1; i >= 0; i--) {
        const ft = floatingTextsRef.current[i]!;
        ft.y -= 1.2;
        ft.alpha -= 0.02;

        if (ft.alpha <= 0) {
          floatingTextsRef.current.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.fillStyle = ft.color;
        ctx.globalAlpha = Math.max(0, ft.alpha);
        ctx.font = "bold 15px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.restore();
      }

      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [
    angleA,
    angleB,
    angleC,
    angleD,
    angleP,
    diameterActive,
    mode,
    posA,
    posB,
    posC,
    posD,
    posO,
    posP,
  ]);

  const currentWaveConfig = WAVE_CONFIGS[waveIdx] || {
    waveNumber: waveIdx + 1,
    title: `Overdrive Wave ${waveIdx + 1}`,
    subtitle: "무한 오버드라이브",
    description: "원주각의 모든 법칙으로 다크 매터를 분쇄하세요!",
    mathHint: "1000점 이상 달성! 매 타격마다 +1점씩 랭킹 포인트가 적립됩니다.",
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      {/* Top Status Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-sky/30 bg-slate-950/90 p-4 shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-xl font-black text-white shadow-lg shadow-cyan-500/30">
            ⚛
          </span>
          <div>
            <h1 className="font-display text-xl font-bold text-white sm:text-2xl">
              아크 리액터: 네온 오비탈
            </h1>
            <p className="text-xs font-semibold text-cyan-300 sm:text-sm">
              중3 · 3.2 원의 성질 (원주각의 4대 법칙)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {/* Lives */}
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-bold text-slate-400">생명</span>
            <div className="flex items-center gap-1 mt-0.5" aria-label={`생명 ${lives}개`}>
              {Array.from({ length: MAX_LIVES }, (_, i) => (
                <span
                  key={i}
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                    i < lives ? "bg-rose-500 text-white shadow-sm" : "bg-slate-800 text-slate-600"
                  }`}
                >
                  ♥
                </span>
              ))}
            </div>
          </div>

          {/* Score */}
          <div className="flex flex-col items-end">
            <span className="text-xs font-bold text-slate-400">점수 (XP)</span>
            <span className="font-mono text-2xl font-black text-amber-400">
              {score.toLocaleString()}
            </span>
          </div>

          {/* Combo */}
          {combo > 1 && (
            <div className="flex flex-col items-center rounded-xl bg-gradient-to-r from-pink-600/30 to-purple-600/30 px-3 py-1 border border-pink-500/40 animate-pulse">
              <span className="text-[10px] font-bold text-pink-300">COMBO</span>
              <span className="font-mono text-lg font-black text-pink-400">
                x{combo}
              </span>
            </div>
          )}

          {/* Mute button */}
          <button
            type="button"
            onClick={toggleMute}
            className="rounded-xl border border-slate-700 bg-slate-800/80 p-2 text-sm text-slate-300 hover:bg-slate-700"
            aria-label={muted ? "음소거 해제" : "음소거"}
          >
            {muted ? "🔇" : "🔊"}
          </button>

          {/* Start/Restart */}
          {phase === "ready" ? (
            <button
              type="button"
              onClick={startGame}
              className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2.5 font-display text-sm font-bold text-white shadow-lg shadow-cyan-500/40 hover:brightness-110 active:scale-95 transition"
            >
              게임 시작
            </button>
          ) : (
            <button
              type="button"
              onClick={endGame}
              className="rounded-xl border border-rose-500/40 bg-rose-500/20 px-3 py-2 text-xs font-bold text-rose-300 hover:bg-rose-500/30"
            >
              정리하고 결과 보기
            </button>
          )}
        </div>
      </div>

      {/* Main Game Arena */}
      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        {/* Left: Canvas & Reactor Controls */}
        <div className="flex flex-col gap-3">
          {/* Wave Banner */}
          <div className="rounded-xl border border-cyan-500/20 bg-slate-900/80 p-3 shadow-inner">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="rounded-md bg-cyan-500/20 px-2 py-0.5 text-xs font-bold text-cyan-300">
                  {currentWaveConfig.title}
                </span>
                <h2 className="mt-1 text-sm font-bold text-white sm:text-base">
                  {currentWaveConfig.subtitle}
                </h2>
              </div>
              <p className="max-w-md text-xs text-slate-300">
                {currentWaveConfig.description}
              </p>
            </div>
          </div>

          {/* Interactive Canvas Container with Screen Shake */}
          <div
            className="relative flex items-center justify-center overflow-hidden rounded-2xl border border-cyan-500/30 bg-slate-950 shadow-2xl transition-transform duration-75"
            style={{
              transform:
                shakeOffset.x !== 0 || shakeOffset.y !== 0
                  ? `translate(${shakeOffset.x}px, ${shakeOffset.y}px)`
                  : "none",
            }}
          >
            <canvas
              ref={canvasRef}
              width={CANVAS_SIZE}
              height={CANVAS_SIZE}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              className="touch-none cursor-crosshair max-h-[580px] w-full object-contain"
            />

            {/* In-Game Angle HUD Overlay */}
            <div className="pointer-events-none absolute top-4 left-4 flex flex-col gap-1.5 rounded-xl border border-cyan-500/30 bg-slate-950/85 p-3 backdrop-blur-md">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
                <span className="text-xs font-bold text-cyan-300">
                  원주각 <Latex latex="\angle\text{APB}" />
                </span>
                <span className="font-mono text-base font-black text-white">
                  {currentInscribed.toFixed(1)}°
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-indigo-400" />
                <span className="text-xs font-bold text-indigo-300">
                  중심각 <Latex latex="\angle\text{AOB}" />
                </span>
                <span className="font-mono text-sm font-bold text-slate-200">
                  {currentCentral.toFixed(1)}° (2배)
                </span>
              </div>

              {mode === "thales" && (
                <div className={`mt-1 flex items-center gap-1.5 text-xs font-black ${diameterActive ? "text-amber-300" : "text-slate-400"}`}>
                  <span>{diameterActive ? "⚡ 90° 직각 락온!" : "⚠ AB 지름 미완성"}</span>
                </div>
              )}

              {mode === "cyclic" && (
                <div className="mt-1 text-xs font-black text-purple-300">
                  대각합: {cyclicSumBD.toFixed(1)}° / 180°
                </div>
              )}
            </div>

            {/* Fire Button on Mobile / Quick Touch */}
            <div className="absolute bottom-4 right-4 flex items-center gap-2">
              <button
                type="button"
                onClick={dischargeWeapon}
                className="flex h-14 items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 px-6 font-display text-sm font-black text-white shadow-xl shadow-cyan-500/40 hover:brightness-125 active:scale-95 transition"
              >
                <span>⚡ 방전 발사</span>
                <kbd className="hidden sm:inline-block rounded bg-black/30 px-1.5 py-0.5 text-[10px] text-cyan-200">
                  SPACE
                </kbd>
              </button>
            </div>

            {/* Ready Screen Overlay */}
            {phase === "ready" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-950/85 p-6 text-center backdrop-blur-md">
                <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-3xl font-black text-white shadow-xl shadow-cyan-500/40 animate-bounce">
                  ⚛
                </span>
                <h2 className="font-display text-2xl sm:text-3xl font-black text-white">
                  아크 리액터: 네온 오비탈
                </h2>
                <p className="max-w-md text-sm text-slate-300 leading-relaxed">
                  원형 입자가속기에서 <strong className="text-cyan-400">원주각의 4대 법칙</strong>
                  (동일 호 각도 불변 · 탈레스 90° 직각 · 중심각 2배 · 내접 180°)을
                  광학 무기로 발동해 다크 매터를 분쇄하세요!
                </p>
                <button
                  type="button"
                  onClick={startGame}
                  className="mt-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 px-8 py-3.5 font-display text-base font-black text-white shadow-2xl shadow-cyan-500/50 hover:brightness-110 active:scale-95 transition"
                >
                  리액터 가동 (게임 시작)
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Law Selector & Mathematical Cockpit */}
        <div className="flex flex-col gap-4">
          {/* Mode Selector Tabs */}
          <div className="rounded-2xl border border-cyan-500/30 bg-slate-950/90 p-4 shadow-xl">
            <h3 className="font-display text-xs font-black tracking-wider text-cyan-400 uppercase">
              기하학 무기 법칙 선택
            </h3>
            <div className="mt-3 flex flex-col gap-2">
              {/* Mode 1: Glide */}
              <button
                type="button"
                onClick={() => setMode("glide")}
                className={`flex items-start gap-2.5 rounded-xl border p-2.5 text-left transition ${
                  mode === "glide"
                    ? "border-cyan-400 bg-cyan-500/20 text-white shadow-md shadow-cyan-500/20"
                    : "border-slate-800 bg-slate-900/60 text-slate-400 hover:bg-slate-800"
                }`}
              >
                <span className="font-mono text-sm font-black text-cyan-400">1</span>
                <div>
                  <p className="text-xs font-bold text-cyan-300">글라이드 에임</p>
                  <p className="text-[11px] text-slate-300 leading-tight mt-0.5">
                    호 AB를 쥐면 P를 어디로 옮겨도 <strong>각도 불변</strong>!
                  </p>
                </div>
              </button>

              {/* Mode 2: Thales */}
              <button
                type="button"
                onClick={() => setMode("thales")}
                className={`flex items-start gap-2.5 rounded-xl border p-2.5 text-left transition ${
                  mode === "thales"
                    ? "border-amber-400 bg-amber-500/20 text-white shadow-md shadow-amber-500/20"
                    : "border-slate-800 bg-slate-900/60 text-slate-400 hover:bg-slate-800"
                }`}
              >
                <span className="font-mono text-sm font-black text-amber-400">2</span>
                <div>
                  <p className="text-xs font-bold text-amber-300">탈레스 90° 블레이드</p>
                  <p className="text-[11px] text-slate-300 leading-tight mt-0.5">
                    선분 AB가 지름이면 <strong>원 위 어디서나 90° 직각</strong>!
                  </p>
                </div>
              </button>

              {/* Quick Snap Diameter button when in Thales mode */}
              {mode === "thales" && (
                <button
                  type="button"
                  onClick={snapDiameterAction}
                  className="rounded-lg bg-amber-500/20 border border-amber-500/40 px-2.5 py-1.5 text-xs font-black text-amber-300 hover:bg-amber-500/30 transition"
                >
                  ⚡ AB를 지름으로 자동 정렬
                </button>
              )}

              {/* Mode 3: Overcharge */}
              <button
                type="button"
                onClick={() => setMode("overcharge")}
                className={`flex items-start gap-2.5 rounded-xl border p-2.5 text-left transition ${
                  mode === "overcharge"
                    ? "border-pink-400 bg-pink-500/20 text-white shadow-md shadow-pink-500/20"
                    : "border-slate-800 bg-slate-900/60 text-slate-400 hover:bg-slate-800"
                }`}
              >
                <span className="font-mono text-sm font-black text-pink-400">3</span>
                <div>
                  <p className="text-xs font-bold text-pink-300">코어 오버차지 2X</p>
                  <p className="text-[11px] text-slate-300 leading-tight mt-0.5">
                    중심각은 원주각의 <strong>정확히 2배</strong> 광역 플레어!
                  </p>
                </div>
              </button>

              {/* Mode 4: Cyclic */}
              <button
                type="button"
                onClick={() => setMode("cyclic")}
                className={`flex items-start gap-2.5 rounded-xl border p-2.5 text-left transition ${
                  mode === "cyclic"
                    ? "border-purple-400 bg-purple-500/20 text-white shadow-md shadow-purple-500/20"
                    : "border-slate-800 bg-slate-900/60 text-slate-400 hover:bg-slate-800"
                }`}
              >
                <span className="font-mono text-sm font-black text-purple-400">4</span>
                <div>
                  <p className="text-xs font-bold text-purple-300">사이클릭 180° 노바</p>
                  <p className="text-[11px] text-slate-300 leading-tight mt-0.5">
                    원에 내접하는 사각형 <strong>대각의 합은 180°</strong>!
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Math Insight Card */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 shadow-lg">
            <h3 className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
              <span>💡</span>
              <span>원주각의 비밀</span>
            </h3>
            <p className="mt-2 text-xs text-slate-300 leading-relaxed">
              {currentWaveConfig.mathHint}
            </p>
            <div className="mt-3 rounded-lg bg-slate-900/80 p-2 text-center text-xs font-mono text-cyan-300 border border-slate-800">
              <Latex latex="\angle\text{APB} = \frac{1}{2}\angle\text{AOB}" />
            </div>
          </div>

          {/* Controls Guide */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-xs text-slate-400">
            <h4 className="font-bold text-slate-300 mb-2">조작 가이드</h4>
            <ul className="space-y-1.5 list-disc pl-4 text-[11px]">
              <li>원 둘레의 노드 <strong className="text-cyan-400">P</strong>, <strong className="text-amber-400">A</strong>, <strong className="text-amber-400">B</strong>를 마우스나 터치로 드래그하세요.</li>
              <li>화면을 클릭하거나 <kbd className="rounded bg-slate-800 px-1 py-0.5 text-slate-200">SPACE</kbd>를 누르면 방전 광선이 발사됩니다.</li>
              <li>키보드 <kbd className="rounded bg-slate-800 px-1 py-0.5 text-slate-200">1</kbd>~<kbd className="rounded bg-slate-800 px-1 py-0.5 text-slate-200">4</kbd>로 무기 법칙을 빠르게 바꿀 수 있습니다.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Result Phase Screen with Pimath GameRankingBoard */}
      {phase === "ended" && (
        <div className="rounded-2xl border border-cyan-500/40 bg-slate-950/95 p-6 shadow-2xl backdrop-blur-lg">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <span className="text-xs font-bold text-cyan-400">MISSION COMPLETE</span>
              <h2 className="font-display text-2xl font-black text-white sm:text-3xl">
                리액터 정화 결과
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-amber-500/20 border border-amber-500/40 px-4 py-2 text-right">
                <span className="block text-[10px] font-bold text-amber-300">최종 획득 XP</span>
                <span className="font-mono text-2xl font-black text-amber-400">
                  {score.toLocaleString()}
                </span>
              </div>
              <button
                type="button"
                onClick={startGame}
                className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-3 font-display text-sm font-bold text-white shadow-lg hover:brightness-110 active:scale-95 transition"
              >
                다시 도전
              </button>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-slate-900/80 p-3 border border-slate-800 text-center">
              <span className="text-xs text-slate-400">클리어 웨이브</span>
              <p className="mt-1 font-mono text-xl font-bold text-cyan-300">
                {stats.wavesCleared}
              </p>
            </div>
            <div className="rounded-xl bg-slate-900/80 p-3 border border-slate-800 text-center">
              <span className="text-xs text-slate-400">탈레스 90° 타격</span>
              <p className="mt-1 font-mono text-xl font-bold text-amber-400">
                {stats.thalesStrikes}
              </p>
            </div>
            <div className="rounded-xl bg-slate-900/80 p-3 border border-slate-800 text-center">
              <span className="text-xs text-slate-400">중심각 2배 빔</span>
              <p className="mt-1 font-mono text-xl font-bold text-pink-400">
                {stats.overchargeBeams}
              </p>
            </div>
            <div className="rounded-xl bg-slate-900/80 p-3 border border-slate-800 text-center">
              <span className="text-xs text-slate-400">최대 콤보</span>
              <p className="mt-1 font-mono text-xl font-bold text-purple-400">
                {stats.maxCombo}
              </p>
            </div>
          </div>

          {/* Submission Feedback */}
          {submitResult && (
            <div className="mb-6 rounded-xl bg-cyan-950/60 border border-cyan-800/60 p-3 text-xs text-cyan-300">
              {submitResult.recorded ? (
                <span>🎉 학급 활동 공식 기록 및 경험치(+{submitResult.xpAwarded ?? submitResult.score} XP)가 반영되었습니다!</span>
              ) : (
                <span>연습 모드로 완료되었습니다. (학급에 배정·활성화 시 공식 랭킹 및 XP가 반영됩니다)</span>
              )}
            </div>
          )}

          {/* Pimath Standard Ranking Board */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <GameRankingBoard
              rows={rankingRows}
              scope={rankingScope}
              mode={rankingMode}
              onScopeChange={handleScopeChange}
              onModeChange={handleModeChange}
              loading={rankingLoading}
            />
          </div>
        </div>
      )}
    </div>
  );
}
