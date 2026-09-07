"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import Image from "next/image";
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
  CHAPTERS,
  CONTENT_KEY,
  FEVER_THRESHOLD,
  LAKE_CENTER_X,
  LAKE_CENTER_Y,
  LAKE_HEIGHT,
  LAKE_RADIUS,
  LAKE_WIDTH,
  MAX_HEARTS,
  START_HEARTS,
  calcArcLength,
  calcCentralAngle,
  calcInscribedAngle,
  createChapterEntities,
  degToRad,
  distance,
  getLakeShorePoint,
  isDiameter,
  normalizeAngle,
  snapToDiameter,
  type Ball,
  type Obstacle,
  type Point2D,
  type Slime,
} from "@/lib/starlight-slingshot-math";

type Phase = "ready" | "playing" | "ended";

const MUTE_KEY = "pm_starlight_slingshot_mute";

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
}

/* ---------------------------------------------------- Web Audio Synth */
function playSfx(
  kind: "launch" | "bounce" | "pop" | "thales_snap" | "overcharge" | "shield_clank" | "stage_clear" | "miss",
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

    if (kind === "launch") {
      // Warm slingshot release sound
      osc.type = "sine";
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.12);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc.start(now);
      osc.stop(now + 0.15);
    } else if (kind === "bounce") {
      // Gentle water rim bounce
      osc.type = "triangle";
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(260, now + 0.1);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.start(now);
      osc.stop(now + 0.13);
    } else if (kind === "pop") {
      // Cheerful marimba hit with rising pitch
      const scale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
      const freq = scale[combo % scale.length]!;
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.25, now + 0.14);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.start(now);
      osc.stop(now + 0.24);
    } else if (kind === "thales_snap") {
      // Golden right-angle chime arpeggio (C-E-G-C)
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((f, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "triangle";
        o.frequency.setValueAtTime(f, now + i * 0.04);
        g.gain.setValueAtTime(0.14, now + i * 0.04);
        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.04 + 0.3);
        o.connect(g);
        g.connect(ctx.destination);
        o.start(now + i * 0.04);
        o.stop(now + i * 0.04 + 0.35);
      });
    } else if (kind === "overcharge") {
      // 2X Sun Crystal flare sound
      osc.type = "sine";
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.25);
      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (kind === "shield_clank") {
      // Metallic clank on wrong angle
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.setValueAtTime(120, now + 0.1);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.22);
    } else if (kind === "stage_clear") {
      // Victory harp fanfare
      const chord = [440, 554.37, 659.25, 880, 1108.73];
      chord.forEach((f, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sine";
        o.frequency.setValueAtTime(f, now + i * 0.08);
        g.gain.setValueAtTime(0.15, now + i * 0.08);
        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.45);
        o.connect(g);
        g.connect(ctx.destination);
        o.start(now + i * 0.08);
        o.stop(now + i * 0.08 + 0.5);
      });
    } else if (kind === "miss") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.linearRampToValueAtTime(140, now + 0.15);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.start(now);
      osc.stop(now + 0.2);
    }
  } catch {
    // AudioContext blocked
  }
}

export default function StarlightSlingshot() {
  const [phase, setPhase] = useState<Phase>("ready");
  const [muted, setMuted] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(MUTE_KEY) === "1";
    } catch {
      return false;
    }
  });

  const [hearts, setHearts] = useState(START_HEARTS);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [chapterIdx, setChapterIdx] = useState(0);
  const [shakeOffset, setShakeOffset] = useState({ x: 0, y: 0 });

  // Statistics for teacher learning dashboard
  const [stats, setStats] = useState({
    chaptersCleared: 0,
    slimesPurified: 0,
    thalesSnaps: 0,
    overchargeShots: 0,
    maxCombo: 0,
  });

  // Ranking state
  const [rankingScope, setRankingScope] = useState<RankingScope>("world");
  const [rankingMode, setRankingMode] = useState<RankingMode>("all");
  const [rankingRows, setRankingRows] = useState<RankingRow[]>([]);
  const [rankingLoading, setRankingLoading] = useState(false);
  const [submitResult, setSubmitResult] = useState<GameSubmitClientResult | null>(null);
  const [, startTransition] = useTransition();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Shore geometry pin angles (radians)
  const [angleA, setAngleA] = useState(degToRad(30));
  const [angleB, setAngleB] = useState(degToRad(120));
  const [angleP, setAngleP] = useState(degToRad(270));
  const [angleC, setAngleC] = useState(degToRad(225));
  const [angleD, setAngleD] = useState(degToRad(315));

  // Dragging state
  const draggingPin = useRef<"P" | "A" | "B" | "C" | "D" | null>(null);

  // Simulation entities
  const slimesRef = useRef<Slime[]>([]);
  const obstaclesRef = useRef<Obstacle[]>([]);
  const ballsRef = useRef<Ball[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  const textIdCounter = useRef(1);
  const ballIdCounter = useRef(1);

  // Toggle audio mute
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

  // Screen shake
  const shakeScreen = useCallback((amount = 5) => {
    const rx = (Math.random() - 0.5) * amount;
    const ry = (Math.random() - 0.5) * amount;
    setShakeOffset({ x: rx, y: ry });
    setTimeout(() => setShakeOffset({ x: 0, y: 0 }), 160);
  }, []);

  // Floating text
  const addFloatingText = useCallback((text: string, x: number, y: number, color = "#8b5e3c") => {
    floatingTextsRef.current.push({
      id: textIdCounter.current++,
      text,
      x,
      y,
      color,
      alpha: 1,
    });
  }, []);

  // Spawn star dust particles
  const spawnStarDust = useCallback((x: number, y: number, color = "#ffd76a", count = 12) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 3.5;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        size: 3 + Math.random() * 3,
        alpha: 1,
        decay: 0.02 + Math.random() * 0.02,
      });
    }
  }, []);

  // Setup Chapter
  const setupChapter = useCallback((idx: number) => {
    const cfg = CHAPTERS[idx] || {
      chapter: idx + 1,
      title: `오버드라이브 스테이지 ${idx + 1}`,
      subtitle: "별빛 호수 무한 탐험",
      mechanicName: "원주각의 모든 비밀",
      description: "원주각의 성질을 자유자재로 활용해 호수를 정화하세요!",
      piDialogue: "1000점 만점 돌파! 이제부터는 실력자 랭킹 경쟁이야!",
      mathFormula: "\\angle\\text{APB} = \\frac{1}{2}\\angle\\text{AOB}",
      defaultAngleA: degToRad(30),
      defaultAngleB: degToRad(120),
      defaultAngleP: degToRad(270),
      hasCenterSunCrystal: true,
      scoreClearBonus: 50,
    };

    const { slimes, obstacles } = createChapterEntities(idx + 1);
    slimesRef.current = slimes;
    obstaclesRef.current = obstacles;
    ballsRef.current = [];

    setAngleA(cfg.defaultAngleA);
    setAngleB(cfg.defaultAngleB);
    setAngleP(cfg.defaultAngleP);
    if (cfg.defaultAngleC !== undefined) setAngleC(cfg.defaultAngleC);
    if (cfg.defaultAngleD !== undefined) setAngleD(cfg.defaultAngleD);
  }, []);

  // Start game
  const startGame = () => {
    setPhase("playing");
    setHearts(START_HEARTS);
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setChapterIdx(0);
    setStats({
      chaptersCleared: 0,
      slimesPurified: 0,
      thalesSnaps: 0,
      overchargeShots: 0,
      maxCombo: 0,
    });
    setupChapter(0);
    playSfx("launch", 0, muted);
  };

  // End game
  const endGame = useCallback(async () => {
    setPhase("ended");
    playSfx("stage_clear", 0, muted);

    const details = activityDetailsV1({
      chaptersCleared: stats.chaptersCleared,
      slimesPurified: stats.slimesPurified,
      thalesSnaps: stats.thalesSnaps,
      overchargeShots: stats.overchargeShots,
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
      // offline / guest
    }

    setRankingLoading(true);
    try {
      const r = await fetchGameRanking({
        contentKey: CONTENT_KEY,
        scope: "world",
        mode: "all",
      });
      setRankingRows(r);
    } catch {
      // fetch error
    } finally {
      setRankingLoading(false);
    }
  }, [maxCombo, muted, score, stats]);

  // Ranking tabs
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
      } finally {
        setRankingLoading(false);
      }
    });
  };

  // Positions on Lake Shore
  const posP = getLakeShorePoint(angleP);
  const posA = getLakeShorePoint(angleA);
  const posB = getLakeShorePoint(angleB);
  const posC = getLakeShorePoint(angleC);
  const posD = getLakeShorePoint(angleD);

  // Geometric Values
  const currentInscribed = calcInscribedAngle(posP, posA, posB);
  const currentCentral = calcCentralAngle(posA, posB);
  const { isDiameter: diameterActive } = isDiameter(angleA, angleB, 10);
  const currentArcLength = calcArcLength(angleA, angleB);

  // Snap to Diameter action (Thales theorem)
  const snapToDiameterAction = () => {
    const snapped = snapToDiameter(angleA, angleB, 180);
    setAngleB(snapped);
    playSfx("thales_snap", 0, muted);
    shakeScreen(5);
    addFloatingText("✨ 90° 직각 락온! (탈레스 정리)", LAKE_CENTER_X, LAKE_CENTER_Y - 40, "#c4785a");
    setStats((s) => ({ ...s, thalesSnaps: s.thalesSnaps + 1 }));
  };

  // Launch slingshot projectiles
  const launchSlingshot = () => {
    if (phase !== "playing") return;

    playSfx("launch", combo, muted);
    shakeScreen(4);

    // Target vectors towards A and B from P
    const distA = distance(posP, posA);
    const distB = distance(posP, posB);
    const speed = 7.5;

    const vPA = {
      x: ((posA.x - posP.x) / (distA || 1)) * speed,
      y: ((posA.y - posP.y) / (distA || 1)) * speed,
    };
    const vPB = {
      x: ((posB.x - posP.x) / (distB || 1)) * speed,
      y: ((posB.y - posP.y) / (distB || 1)) * speed,
    };

    const isThales = diameterActive;

    // Check if shot passes through center Sun Crystal (Chapter 3 or Overdrive)
    const currentCfg = CHAPTERS[chapterIdx];
    const hasSun = currentCfg ? currentCfg.hasCenterSunCrystal : true;

    ballsRef.current = [
      {
        id: `ball-${ballIdCounter.current++}`,
        x: posP.x,
        y: posP.y,
        vx: vPA.x,
        vy: vPA.y,
        radius: 8,
        bouncesLeft: 3,
        isThales90: isThales,
        isOvercharge2X: hasSun,
        alive: true,
      },
      {
        id: `ball-${ballIdCounter.current++}`,
        x: posP.x,
        y: posP.y,
        vx: vPB.x,
        vy: vPB.y,
        radius: 8,
        bouncesLeft: 3,
        isThales90: isThales,
        isOvercharge2X: hasSun,
        alive: true,
      },
    ];

    if (isThales) {
      addFloatingText("⚡ 90° 직각 크로스샷!", posP.x, posP.y - 25, "#d97706");
    }
  };

  const launchRef = useRef<() => void>(() => {});
  useEffect(() => {
    launchRef.current = launchSlingshot;
  });

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        launchRef.current();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Pointer drag interactions on shoreline
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = LAKE_WIDTH / rect.width;
    const scaleY = LAKE_HEIGHT / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    const grabRadius = 38;
    if (distance({ x: mx, y: my }, posP) <= grabRadius) {
      draggingPin.current = "P";
    } else if (distance({ x: mx, y: my }, posA) <= grabRadius) {
      draggingPin.current = "A";
    } else if (distance({ x: mx, y: my }, posB) <= grabRadius) {
      draggingPin.current = "B";
    } else if (chapterIdx === 4 && distance({ x: mx, y: my }, posC) <= grabRadius) {
      draggingPin.current = "C";
    } else if (chapterIdx === 4 && distance({ x: mx, y: my }, posD) <= grabRadius) {
      draggingPin.current = "D";
    } else {
      // Tap lake to fire
      launchSlingshot();
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!draggingPin.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = LAKE_WIDTH / rect.width;
    const scaleY = LAKE_HEIGHT / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    const angle = normalizeAngle(Math.atan2(my - LAKE_CENTER_Y, mx - LAKE_CENTER_X));

    if (draggingPin.current === "P") {
      setAngleP(angle);
    } else if (draggingPin.current === "A") {
      setAngleA(angle);
    } else if (draggingPin.current === "B") {
      // Snap to diameter if close
      const snapped = snapToDiameter(angleA, angle, 12);
      setAngleB(snapped);
    } else if (draggingPin.current === "C") {
      setAngleC(angle);
    } else if (draggingPin.current === "D") {
      setAngleD(angle);
    }
  };

  const handlePointerUp = () => {
    draggingPin.current = null;
  };

  // Main Canvas Render & Physical Physics Animation Loop
  useEffect(() => {
    let animId: number;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // 1. Background (Warm Cream #FEF9F0)
      ctx.fillStyle = "#fef9f0";
      ctx.fillRect(0, 0, LAKE_WIDTH, LAKE_HEIGHT);

      // 2. Lake Circular Basin (Lavender Water #EAE3F7 to #D4C4FF)
      ctx.save();
      const lakeGrad = ctx.createRadialGradient(
        LAKE_CENTER_X,
        LAKE_CENTER_Y,
        40,
        LAKE_CENTER_X,
        LAKE_CENTER_Y,
        LAKE_RADIUS,
      );
      lakeGrad.addColorStop(0, "#f3effa");
      lakeGrad.addColorStop(0.7, "#e4d9f5");
      lakeGrad.addColorStop(1, "#c9b6eb");

      ctx.fillStyle = lakeGrad;
      ctx.beginPath();
      ctx.arc(LAKE_CENTER_X, LAKE_CENTER_Y, LAKE_RADIUS, 0, Math.PI * 2);
      ctx.fill();

      // Outer Shoreline Rim (Wood #8B5E3C)
      ctx.strokeStyle = "#8b5e3c";
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(LAKE_CENTER_X, LAKE_CENTER_Y, LAKE_RADIUS, 0, Math.PI * 2);
      ctx.stroke();

      // Soft water ripple lines
      ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
      ctx.lineWidth = 2;
      for (let r = 70; r < LAKE_RADIUS; r += 50) {
        ctx.beginPath();
        ctx.arc(LAKE_CENTER_X, LAKE_CENTER_Y, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      // 3. Highlight Arc AB on Shoreline (Gold #FFD76A)
      ctx.save();
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 14;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(LAKE_CENTER_X, LAKE_CENTER_Y, LAKE_RADIUS, angleA, angleB, false);
      ctx.stroke();
      ctx.restore();

      // 4. Center Sun Crystal (Chapter 3)
      const currentCfg = CHAPTERS[chapterIdx];
      if (currentCfg?.hasCenterSunCrystal) {
        ctx.save();
        ctx.fillStyle = "#f59e0b";
        ctx.shadowColor = "#fbbf24";
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(LAKE_CENTER_X, LAKE_CENTER_Y, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("☀️O", LAKE_CENTER_X, LAKE_CENTER_Y);
        ctx.restore();
      }

      // 5. Draw Obstacles (Lily Pads)
      obstaclesRef.current.forEach((obs) => {
        ctx.save();
        ctx.fillStyle = "#6ee7b7";
        ctx.strokeStyle = "#10b981";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(obs.x, obs.y, obs.radius, 0.3, Math.PI * 2 - 0.3);
        ctx.lineTo(obs.x, obs.y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      });

      // 6. Draw Slimes (Bobbing gently on the water)
      slimesRef.current.forEach((slime) => {
        if (!slime.alive) return;
        slime.bobPhase += 0.04;
        slime.angle = normalizeAngle(slime.angle + slime.speed);
        slime.x = LAKE_CENTER_X + slime.dist * Math.cos(slime.angle);
        slime.y = LAKE_CENTER_Y + slime.dist * Math.sin(slime.angle) + Math.sin(slime.bobPhase) * 3;

        ctx.save();
        if (slime.type === "knight_slime") {
          // Knight slime with 90° right-angle shield
          ctx.fillStyle = "#93c5fd";
          ctx.strokeStyle = "#3b82f6";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(slime.x, slime.y, slime.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Golden 90° shield
          ctx.fillStyle = "#f59e0b";
          ctx.fillRect(slime.x - slime.radius, slime.y - slime.radius, slime.radius * 2, 8);
          ctx.fillStyle = "#1e3a8a";
          ctx.font = "bold 10px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("∟90° 방패", slime.x, slime.y - slime.radius - 4);
        } else if (slime.type === "stardrop_slime") {
          // Cute tiny star slime
          ctx.fillStyle = "#f472b6";
          ctx.beginPath();
          ctx.arc(slime.x, slime.y, slime.radius, 0, Math.PI * 2);
          ctx.fill();
        } else if (slime.type === "basket_slime") {
          // Golden basket target
          ctx.fillStyle = "#fbbf24";
          ctx.strokeStyle = "#b45309";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(slime.x, slime.y, slime.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = "#78350f";
          ctx.font = "bold 10px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(`${slime.requiredAngle}°`, slime.x, slime.y + 4);
        } else if (slime.type === "king_slime") {
          // Giant King Slime
          ctx.fillStyle = "#a855f7";
          ctx.strokeStyle = "#6b21a8";
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(slime.x, slime.y, slime.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Crown
          ctx.fillStyle = "#fbbf24";
          ctx.font = "24px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("👑", slime.x, slime.y - slime.radius + 6);
        } else {
          // Standard cute blue slime
          ctx.fillStyle = "#7dd3fc";
          ctx.strokeStyle = "#0284c7";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(slime.x, slime.y, slime.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Smiling face (Eyes & Smile)
          ctx.fillStyle = "#0f172a";
          ctx.beginPath();
          ctx.arc(slime.x - 6, slime.y - 2, 2.5, 0, Math.PI * 2);
          ctx.arc(slime.x + 6, slime.y - 2, 2.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#0f172a";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(slime.x, slime.y + 3, 5, 0.2, Math.PI - 0.2);
          ctx.stroke();
        }
        ctx.restore();
      });

      // 7. Slingshot Elastic Bands & Aiming Guide (from P to A and B)
      ctx.save();
      // Elastic band PA
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(posP.x, posP.y);
      ctx.lineTo(posA.x, posA.y);
      ctx.stroke();

      // Elastic band PB
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(posP.x, posP.y);
      ctx.lineTo(posB.x, posB.y);
      ctx.stroke();

      // If diameter (Thales 90°), draw right-angle marker
      if (diameterActive) {
        ctx.strokeStyle = "#d97706";
        ctx.lineWidth = 2.5;
        const vPA = { x: (posA.x - posP.x) / distance(posP, posA), y: (posA.y - posP.y) / distance(posP, posA) };
        const vPB = { x: (posB.x - posP.x) / distance(posP, posB), y: (posB.y - posP.y) / distance(posP, posB) };
        const s = 14;
        ctx.beginPath();
        ctx.moveTo(posP.x + vPA.x * s, posP.y + vPA.y * s);
        ctx.lineTo(posP.x + (vPA.x + vPB.x) * s, posP.y + (vPA.y + vPB.y) * s);
        ctx.lineTo(posP.x + vPB.x * s, posP.y + vPB.y * s);
        ctx.stroke();
      }

      // Trajectory dashed guide lines extending across the lake
      ctx.strokeStyle = "rgba(56, 189, 248, 0.4)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(posA.x, posA.y);
      ctx.lineTo(posA.x + (posA.x - posP.x) * 1.5, posA.y + (posA.y - posP.y) * 1.5);
      ctx.moveTo(posB.x, posB.y);
      ctx.lineTo(posB.x + (posB.x - posP.x) * 1.5, posB.y + (posB.y - posP.y) * 1.5);
      ctx.stroke();
      ctx.restore();

      // Inscribed quadrilateral mode (Chapter 5)
      if (chapterIdx === 4) {
        ctx.save();
        ctx.strokeStyle = "rgba(168, 85, 247, 0.7)";
        ctx.lineWidth = 3;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(posA.x, posA.y);
        ctx.lineTo(posB.x, posB.y);
        ctx.lineTo(posC.x, posC.y);
        ctx.lineTo(posD.x, posD.y);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      }

      // 8. Update & Draw Bouncing Slingshot Balls
      for (let i = ballsRef.current.length - 1; i >= 0; i--) {
        const b = ballsRef.current[i]!;
        b.x += b.vx;
        b.y += b.vy;

        // Check bounce off circular lake shore
        const distFromCenter = Math.hypot(b.x - LAKE_CENTER_X, b.y - LAKE_CENTER_Y);
        if (distFromCenter >= LAKE_RADIUS - b.radius) {
          b.bouncesLeft--;
          playSfx("bounce", 0, muted);
          spawnStarDust(b.x, b.y, "#38bdf8", 6);

          // Normal vector from center
          const nx = (b.x - LAKE_CENTER_X) / distFromCenter;
          const ny = (b.y - LAKE_CENTER_Y) / distFromCenter;
          const dot = b.vx * nx + b.vy * ny;
          b.vx -= 2 * dot * nx;
          b.vy -= 2 * dot * ny;

          // Push back inside
          b.x = LAKE_CENTER_X + (LAKE_RADIUS - b.radius - 2) * nx;
          b.y = LAKE_CENTER_Y + (LAKE_RADIUS - b.radius - 2) * ny;

          if (b.bouncesLeft <= 0) {
            b.alive = false;
          }
        }

        // Check hit slimes
        slimesRef.current.forEach((slime) => {
          if (!slime.alive) return;
          if (distance(b, slime) <= b.radius + slime.radius) {
            // Knight slime requires 90° Thales shot!
            if (slime.type === "knight_slime" && !b.isThales90) {
              playSfx("shield_clank", 0, muted);
              shakeScreen(4);
              addFloatingText("90° 직각만 관통 가능!", slime.x, slime.y - 20, "#b45309");
              b.alive = false;
              return;
            }

            // Pop slime!
            slime.hp--;
            if (slime.hp <= 0) {
              slime.alive = false;
              playSfx("pop", combo + 1, muted);
              shakeScreen(5);
              spawnStarDust(slime.x, slime.y, "#ffd76a", 16);

              const pointsGained = slime.scoreValue * (combo > FEVER_THRESHOLD ? 2 : 1);
              setScore((prev) => applyScoreGain(prev, pointsGained));
              setCombo((c) => {
                const next = c + 1;
                setMaxCombo((m) => Math.max(m, next));
                return next;
              });
              setStats((s) => ({
                ...s,
                slimesPurified: s.slimesPurified + 1,
                maxCombo: Math.max(s.maxCombo, combo + 1),
              }));
              addFloatingText(`+${pointsGained} PTS!`, slime.x, slime.y - 15, "#15803d");
            }
          }
        });

        // Draw ball
        ctx.save();
        ctx.fillStyle = b.isThales90 ? "#f59e0b" : "#38bdf8";
        ctx.shadowColor = b.isThales90 ? "#fbbf24" : "#7dd3fc";
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        if (!b.alive) {
          ballsRef.current.splice(i, 1);
        }
      }

      // Check if all slimes in chapter are cleared
      const remaining = slimesRef.current.filter((s) => s.alive).length;
      if (remaining === 0 && slimesRef.current.length > 0) {
        slimesRef.current = []; // prevent multi-trigger
        const bonus = CHAPTERS[chapterIdx]?.scoreClearBonus ?? 50;
        setScore((prev) => applyScoreGain(prev, bonus));
        setStats((s) => ({ ...s, chaptersCleared: s.chaptersCleared + 1 }));
        playSfx("stage_clear", 0, muted);
        shakeScreen(8);
        addFloatingText("🎉 챕터 클리어!", LAKE_CENTER_X, LAKE_CENTER_Y, "#b45309");

        setTimeout(() => {
          setChapterIdx((c) => {
            const next = c + 1;
            setupChapter(next);
            return next;
          });
        }, 1200);
      }

      // 9. Draw shoreline pins A and B
      const drawPin = (p: Point2D, label: string, color: string, radius = 16) => {
        ctx.save();
        ctx.fillStyle = color;
        ctx.strokeStyle = "#8b5e3c";
        ctx.lineWidth = 3;
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 13px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, p.x, p.y);
        ctx.restore();
      };

      drawPin(posA, "A", "#f59e0b", 16);
      drawPin(posB, "B", "#f59e0b", 16);
      if (chapterIdx === 4) {
        drawPin(posC, "C", "#a855f7", 15);
        drawPin(posD, "D", "#a855f7", 15);
      }

      // 10. Draw Pi at Point P (Mascot Vertex)
      ctx.save();
      ctx.fillStyle = "#0284c7";
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.shadowColor = "#38bdf8";
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(posP.x, posP.y, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 13px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("파이", posP.x, posP.y);
      ctx.restore();

      // 11. Particles update & draw
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
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 12. Floating text update & draw
      for (let i = floatingTextsRef.current.length - 1; i >= 0; i--) {
        const ft = floatingTextsRef.current[i]!;
        ft.y -= 1;
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
    chapterIdx,
    combo,
    diameterActive,
    muted,
    posA,
    posB,
    posC,
    posD,
    posP,
    setupChapter,
    shakeScreen,
    spawnStarDust,
    addFloatingText,
  ]);

  const currentCfg = CHAPTERS[chapterIdx] || {
    chapter: chapterIdx + 1,
    title: `오버드라이브 스테이지 ${chapterIdx + 1}`,
    subtitle: "별빛 호수 무한 탐험",
    mechanicName: "원주각의 모든 비밀",
    description: "원주각의 성질을 자유자재로 활용해 호수를 정화하세요!",
    piDialogue: "1000점 만점 돌파! 이제부터는 실력자 랭킹 경쟁이야!",
    mathFormula: "\\angle\\text{APB} = \\frac{1}{2}\\angle\\text{AOB}",
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      {/* Top Header Card (Warm Pimath Cream & Wood Style) */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border-2 border-wood/20 bg-white/95 p-4 shadow-md backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-lavender/40 border border-lavender text-2xl shadow-inner">
            🌟
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-lavender/60 px-2.5 py-0.5 text-xs font-bold text-wood">
                중3 · 3.2 원의 성질
              </span>
              <span className="rounded-full bg-gold/50 px-2.5 py-0.5 text-xs font-bold text-wood">
                원주각 아케이드
              </span>
            </div>
            <h1 className="font-display text-2xl font-bold text-wood mt-0.5">
              별빛 호수: 원주각 슬링샷
            </h1>
          </div>
        </div>

        {/* Status badges */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Hearts */}
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-bold text-wood/60">생명</span>
            <div className="flex items-center gap-1 mt-0.5" aria-label={`생명 ${hearts}개`}>
              {Array.from({ length: MAX_HEARTS }, (_, i) => (
                <span
                  key={i}
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold shadow-sm transition ${
                    i < hearts ? "bg-[#e85d4c] text-white" : "bg-wood/10 text-wood/25"
                  }`}
                >
                  ♥
                </span>
              ))}
            </div>
          </div>

          {/* Score */}
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold text-wood/60">점수 (XP)</span>
            <span className="font-mono text-2xl font-black text-wood">
              {score.toLocaleString()}
            </span>
          </div>

          {/* Combo */}
          {combo > 1 && (
            <div className="flex flex-col items-center rounded-xl bg-gold/30 border border-gold/60 px-3 py-1 animate-bounce">
              <span className="text-[10px] font-bold text-wood">COMBO</span>
              <span className="font-mono text-base font-black text-wood">
                x{combo}
              </span>
            </div>
          )}

          {/* Sound Mute */}
          <button
            type="button"
            onClick={toggleMute}
            className="rounded-xl border border-wood/20 bg-cream p-2 text-sm text-wood hover:bg-wood/10"
            aria-label={muted ? "음소거 해제" : "음소거"}
          >
            {muted ? "🔇" : "🔊"}
          </button>

          {/* Start/Restart */}
          {phase === "ready" ? (
            <button
              type="button"
              onClick={startGame}
              className="rounded-xl bg-gold px-5 py-2.5 font-display text-sm font-bold text-wood shadow-md hover:brightness-105 active:scale-95 transition"
            >
              호수로 모험 떠나기
            </button>
          ) : (
            <button
              type="button"
              onClick={endGame}
              className="rounded-xl border border-wood/30 bg-wood/10 px-3 py-2 text-xs font-bold text-wood hover:bg-wood/20"
            >
              종료하고 결과 보기
            </button>
          )}
        </div>
      </div>

      {/* Main Lake Arena & Math Cockpit */}
      <div className="grid gap-5 lg:grid-cols-[1fr_310px]">
        {/* Left: Lake Canvas */}
        <div className="flex flex-col gap-3">
          {/* Chapter Banner */}
          <div className="rounded-2xl border border-lavender bg-white/90 p-3.5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="rounded-md bg-lavender/50 px-2.5 py-0.5 text-xs font-bold text-wood">
                  {currentCfg.title}
                </span>
                <h2 className="mt-1 text-base font-bold text-wood">
                  {currentCfg.subtitle}
                </h2>
              </div>
              <p className="max-w-md text-xs text-foreground/75 font-medium">
                {currentCfg.description}
              </p>
            </div>
          </div>

          {/* Interactive Lake Canvas Container */}
          <div
            className="relative flex items-center justify-center overflow-hidden rounded-3xl border-4 border-wood/30 bg-[#fef9f0] shadow-xl transition-transform duration-75"
            style={{
              transform:
                shakeOffset.x !== 0 || shakeOffset.y !== 0
                  ? `translate(${shakeOffset.x}px, ${shakeOffset.y}px)`
                  : "none",
            }}
          >
            <canvas
              ref={canvasRef}
              width={LAKE_WIDTH}
              height={LAKE_HEIGHT}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              className="touch-none cursor-crosshair max-h-[560px] w-full object-contain"
            />

            {/* In-Game Angle HUD Badge */}
            <div className="pointer-events-none absolute top-4 left-4 flex flex-col gap-1.5 rounded-2xl border border-wood/20 bg-white/90 p-3 shadow-md backdrop-blur-md">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-sky-400 animate-ping" />
                <span className="text-xs font-bold text-wood">
                  원주각 <Latex latex="\angle\text{APB}" />
                </span>
                <span className="font-mono text-base font-black text-sky-600">
                  {currentInscribed.toFixed(1)}°
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                <span className="text-xs font-bold text-wood">
                  중심각 <Latex latex="\angle\text{AOB}" />
                </span>
                <span className="font-mono text-xs font-bold text-amber-700">
                  {currentCentral.toFixed(1)}° (2배)
                </span>
              </div>

              {chapterIdx === 1 && (
                <div className={`mt-0.5 text-xs font-black ${diameterActive ? "text-amber-600" : "text-foreground/50"}`}>
                  {diameterActive ? "✨ 탈레스 90° 직각 락온!" : "⚠ AB 지름 미완성"}
                </div>
              )}

              {chapterIdx === 3 && (
                <div className="text-[11px] font-bold text-wood/75">
                  호의 길이: {currentArcLength.toFixed(0)}px
                </div>
              )}
            </div>

            {/* Fire Button on Canvas */}
            <div className="absolute bottom-4 right-4 flex items-center gap-2">
              <button
                type="button"
                onClick={launchSlingshot}
                className="flex h-14 items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 px-6 font-display text-sm font-black text-wood shadow-lg hover:brightness-110 active:scale-95 transition"
              >
                <span>⚡ 슬링샷 발사!</span>
                <kbd className="hidden sm:inline-block rounded bg-black/20 px-1.5 py-0.5 text-[10px] text-white">
                  SPACE
                </kbd>
              </button>
            </div>

            {/* Ready Screen Overlay */}
            {phase === "ready" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-white/85 p-6 text-center backdrop-blur-md">
                <div className="relative h-28 w-28 animate-bounce">
                  <Image
                    src="/images/grade-3-v2.png"
                    alt="별빛의 현자 파이"
                    fill
                    className="object-contain"
                  />
                </div>
                <h2 className="font-display text-2xl sm:text-3xl font-black text-wood">
                  별빛 호수: 원주각 슬링샷
                </h2>
                <p className="max-w-md text-sm text-foreground/80 leading-relaxed font-medium">
                  호숫가를 달리는 파이와 두 개의 황금 핀!  
                  <strong className="text-sky-700"> 동일 호 원주각 불변 · 탈레스 90° · 중심각 2배</strong>의
                  비밀로 장난꾸러기 슬라임들을 정화하세요!
                </p>
                <button
                  type="button"
                  onClick={startGame}
                  className="mt-2 rounded-2xl bg-gold border-2 border-wood/20 px-8 py-3.5 font-display text-base font-black text-wood shadow-xl hover:brightness-105 active:scale-95 transition"
                >
                  호수로 출동하기
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Pi's Math Guide & Cockpit Controls */}
        <div className="flex flex-col gap-4">
          {/* Pi's Dialogue & Aha Moment Box */}
          <div className="rounded-2xl border-2 border-lavender bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="relative h-10 w-10 shrink-0">
                <Image
                  src="/images/mascot-v2.png"
                  alt="파이"
                  fill
                  className="object-contain"
                />
              </div>
              <div>
                <span className="text-xs font-bold text-wood">동료 파이의 힌트</span>
                <h3 className="text-xs font-bold text-sky-700">
                  {currentCfg.mechanicName}
                </h3>
              </div>
            </div>
            <p className="mt-2.5 text-xs text-foreground/85 leading-relaxed bg-lavender/20 rounded-xl p-3 border border-lavender/40 font-medium">
              &ldquo;{currentCfg.piDialogue}&rdquo;
            </p>

            <div className="mt-3 rounded-xl bg-wood/5 p-2 text-center text-xs font-mono text-wood border border-wood/10">
              <Latex latex={currentCfg.mathFormula} />
            </div>
          </div>

          {/* Quick Theorem Action Buttons */}
          <div className="rounded-2xl border-2 border-wood/20 bg-white p-4 shadow-sm">
            <h3 className="text-xs font-bold text-wood uppercase">
              기하학 마법 도구
            </h3>
            <div className="mt-3 flex flex-col gap-2">
              {/* Thales Snap Button */}
              <button
                type="button"
                onClick={snapToDiameterAction}
                className="flex items-center justify-between gap-2 rounded-xl border border-amber-400/60 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100 transition shadow-sm"
              >
                <span>📍 지름 90° 직각 자동 정렬</span>
                <span className="font-mono text-[11px] bg-amber-200/80 px-1.5 py-0.5 rounded">탈레스</span>
              </button>

              {/* Angle Slider Info */}
              <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-2.5 text-xs text-sky-900">
                <div className="flex justify-between font-semibold">
                  <span>호 AB의 벌림 각도</span>
                  <span className="font-mono font-bold">{currentCentral.toFixed(0)}°</span>
                </div>
                <p className="mt-1 text-[11px] text-sky-700">
                  핀 A, B 사이의 호 길이를 조절하면 원주각도 정비례해서 변해요!
                </p>
              </div>
            </div>
          </div>

          {/* Play Instructions */}
          <div className="rounded-2xl border border-wood/15 bg-white/70 p-4 text-xs text-foreground/70">
            <h4 className="font-bold text-wood mb-1.5">조작 방법</h4>
            <ul className="space-y-1 list-disc pl-4 text-[11px]">
              <li>호숫가의 <strong className="text-sky-600">파이(P)</strong>와 황금 핀 <strong className="text-amber-600">A, B</strong>를 드래그하세요.</li>
              <li>호수를 클릭하거나 <kbd className="rounded bg-wood/10 px-1 py-0.5 text-wood font-mono">SPACE</kbd>를 누르면 슬링샷이 발사됩니다.</li>
              <li>슬라임을 모두 정화하면 다음 챕터로 진행됩니다!</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Result Screen & Pimath GameRankingBoard */}
      {phase === "ended" && (
        <div className="rounded-2xl border-2 border-wood/20 bg-white p-6 shadow-xl">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-wood/15 pb-4">
            <div>
              <span className="text-xs font-bold text-sky-700">QUEST CLEAR</span>
              <h2 className="font-display text-2xl font-black text-wood sm:text-3xl">
                별빛 호수 모험 결과
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-gold/40 border border-gold/80 px-4 py-2 text-right">
                <span className="block text-[10px] font-bold text-wood">최종 획득 점수</span>
                <span className="font-mono text-2xl font-black text-wood">
                  {score.toLocaleString()} XP
                </span>
              </div>
              <button
                type="button"
                onClick={startGame}
                className="rounded-xl bg-gold px-6 py-3 font-display text-sm font-bold text-wood shadow-md hover:brightness-105 active:scale-95 transition"
              >
                다시 모험하기
              </button>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-cream p-3 border border-wood/15 text-center">
              <span className="text-xs text-wood/60">클리어 챕터</span>
              <p className="mt-1 font-mono text-xl font-bold text-wood">
                {stats.chaptersCleared}
              </p>
            </div>
            <div className="rounded-xl bg-cream p-3 border border-wood/15 text-center">
              <span className="text-xs text-wood/60">정화한 슬라임</span>
              <p className="mt-1 font-mono text-xl font-bold text-sky-700">
                {stats.slimesPurified}
              </p>
            </div>
            <div className="rounded-xl bg-cream p-3 border border-wood/15 text-center">
              <span className="text-xs text-wood/60">탈레스 90° 정렬</span>
              <p className="mt-1 font-mono text-xl font-bold text-amber-700">
                {stats.thalesSnaps}
              </p>
            </div>
            <div className="rounded-xl bg-cream p-3 border border-wood/15 text-center">
              <span className="text-xs text-wood/60">최대 콤보</span>
              <p className="mt-1 font-mono text-xl font-bold text-purple-700">
                {stats.maxCombo}
              </p>
            </div>
          </div>

          {/* Submission Status */}
          {submitResult && (
            <div className="mb-6 rounded-xl bg-lavender/30 border border-lavender p-3 text-xs text-wood font-medium">
              {submitResult.recorded ? (
                <span>🎉 학급 공식 랭킹 및 경험치(+{submitResult.xpAwarded ?? submitResult.score} XP)가 반영되었습니다!</span>
              ) : (
                <span>연습 모드로 완료되었습니다. (선생님이 학급에 배정·활성화 시 공식 랭킹과 XP가 기록됩니다)</span>
              )}
            </div>
          )}

          {/* Pimath Standard Ranking Board */}
          <div className="rounded-xl border border-wood/15 bg-cream/40 p-4">
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
