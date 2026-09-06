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
import {
  BULLET_VALUES,
  CONTENT_KEY,
  FEVER_COMBO,
  FEVER_DURATION_SEC,
  MAX_LIVES,
  START_LIVES,
  calcDestroyScore,
  createMeteor,
  getWaveSettings,
  type BulletValue,
  type FloatingText,
  type LaserBeam,
  type Meteor,
  type Particle,
  type WaveSettings,
} from "@/lib/trigo-beat-math";

type Phase = "ready" | "playing" | "ended";

const MUTE_KEY = "pm_trigo_beat_mute";

const VW = 800;
const VH = 540;
const BASE_Y = 490;
const TURRET_X = 400;
const TURRET_Y = 495;

function Latex({ latex, className }: { latex: string; className?: string }) {
  const html = katex.renderToString(latex, {
    throwOnError: false,
    displayMode: false,
  });
  return (
    <span className={className} dangerouslySetInnerHTML={{ __html: html }} />
  );
}

function playSound(
  kind: "laser" | "hit" | "wrong" | "base_hit" | "fever" | "lock",
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

    if (kind === "laser") {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(850, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.12);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
      osc.start(now);
      osc.stop(now + 0.14);
    } else if (kind === "hit") {
      const scale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
      const freq = scale[combo % scale.length]!;
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.6, now + 0.15);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.start(now);
      osc.stop(now + 0.3);
    } else if (kind === "lock") {
      // 삑- 락온 조준음
      osc.type = "sine";
      osc.frequency.setValueAtTime(987.77, now);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.09);
    } else if (kind === "fever") {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(523, now);
      osc.frequency.setValueAtTime(659, now + 0.08);
      osc.frequency.setValueAtTime(784, now + 0.16);
      osc.frequency.setValueAtTime(1046, now + 0.24);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.start(now);
      osc.stop(now + 0.47);
    } else if (kind === "wrong") {
      // 둔탁한 오답 부저음
      osc.type = "square";
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.setValueAtTime(120, now + 0.12);
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.27);
    } else {
      // base_hit 지상 충돌 대폭발음
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(45, now + 0.35);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
      osc.start(now);
      osc.stop(now + 0.4);
    }

    window.setTimeout(() => void ctx.close(), 500);
  } catch {
    /* audio safe */
  }
}

export default function TrigoBeat() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [phase, setPhase] = useState<Phase>("ready");
  const [lives, setLives] = useState(START_LIVES);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [clearedCount, setClearedCount] = useState(0);
  const [waveInfo, setWaveInfo] = useState<WaveSettings>(getWaveSettings(0));
  const [isFever, setIsFever] = useState(false);
  const [feverSec, setFeverSec] = useState(0);

  // 현재 락온된 타겟 (선택된 운석)
  const [lockedTargetId, setLockedTargetId] = useState<number | null>(null);
  const [currentTargetPrompt, setCurrentTargetPrompt] = useState<string | null>(null);
  const [currentTargetLatex, setCurrentTargetLatex] = useState<string | null>(null);

  const [muted, setMuted] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(MUTE_KEY) === "1";
    } catch {
      return false;
    }
  });

  const [submitResult, setSubmitResult] =
    useState<GameSubmitClientResult | null>(null);
  const [ranking, setRanking] = useState<RankingRow[]>([]);
  const [rankingScope, setRankingScope] = useState<RankingScope>("class");
  const [rankingMode, setRankingMode] = useState<RankingMode>("best");
  const [isPending, startTransition] = useTransition();

  // Engine Refs
  const phaseRef = useRef(phase);
  const livesRef = useRef(lives);
  const scoreRef = useRef(score);
  const comboRef = useRef(combo);
  const maxComboRef = useRef(0);
  const clearedRef = useRef(0);
  const isFeverRef = useRef(false);
  const feverCountRef = useRef(0);
  const mutedRef = useRef(muted);
  const lockedTargetIdRef = useRef<number | null>(null);

  const meteorsRef = useRef<Meteor[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const lasersRef = useRef<LaserBeam[]>([]);
  const floatTextsRef = useRef<FloatingText[]>([]);
  const starsRef = useRef<{ x: number; y: number; s: number; b: number }[]>([]);

  const turretAngleRef = useRef(-Math.PI / 2);
  const targetTurretAngleRef = useRef(-Math.PI / 2);
  const screenShakeRef = useRef(0);
  const lastSpawnTimeRef = useRef(0);
  const lastFrameTimeRef = useRef(0);
  const feverTimerRef = useRef<number | null>(null);
  const feverIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    phaseRef.current = phase;
    livesRef.current = lives;
    scoreRef.current = score;
    comboRef.current = combo;
    mutedRef.current = muted;
    lockedTargetIdRef.current = lockedTargetId;
  }, [phase, lives, score, combo, muted, lockedTargetId]);

  // 배경 별 생성
  useEffect(() => {
    const stars: { x: number; y: number; s: number; b: number }[] = [];
    for (let i = 0; i < 60; i++) {
      stars.push({
        x: Math.random() * VW,
        y: Math.random() * BASE_Y,
        s: 1 + Math.random() * 2,
        b: 0.3 + Math.random() * 0.7,
      });
    }
    starsRef.current = stars;
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(MUTE_KEY, next ? "1" : "0");
      } catch {
        /* safe */
      }
      return next;
    });
  }, []);

  const triggerFever = useCallback(() => {
    setIsFever(true);
    isFeverRef.current = true;
    feverCountRef.current++;
    setFeverSec(FEVER_DURATION_SEC);
    playSound("fever", comboRef.current, mutedRef.current);

    if (feverTimerRef.current) window.clearTimeout(feverTimerRef.current);
    if (feverIntervalRef.current) window.clearInterval(feverIntervalRef.current);

    feverTimerRef.current = window.setTimeout(() => {
      setIsFever(false);
      isFeverRef.current = false;
      setFeverSec(0);
    }, FEVER_DURATION_SEC * 1000);

    feverIntervalRef.current = window.setInterval(() => {
      setFeverSec((prev) => {
        if (prev <= 1) {
          if (feverIntervalRef.current)
            window.clearInterval(feverIntervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // 게임 오버
  const endGame = useCallback(async () => {
    if (phaseRef.current === "ended") return;
    setPhase("ended");
    phaseRef.current = "ended";
    if (feverTimerRef.current) window.clearTimeout(feverTimerRef.current);
    if (feverIntervalRef.current) window.clearInterval(feverIntervalRef.current);

    const finalScore = scoreRef.current;
    const finalCleared = clearedRef.current;
    const finalMaxCombo = maxComboRef.current;

    try {
      const res = await submitGameRun({
        contentKey: CONTENT_KEY,
        score: finalScore,
        details: activityDetailsV1({
          cleared: finalCleared,
          maxCombo: finalMaxCombo,
          accuracy: 100,
          weakFn: "스트라이크 요격",
          feverCount: feverCountRef.current,
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
      // 연습 모드
    }
  }, []);

  // 폭발 파티클
  const spawnExplosion = useCallback(
    (x: number, y: number, color: string, count = 22) => {
      screenShakeRef.current = 10;
      const parts: Particle[] = [];
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 40 + Math.random() * 220;
        parts.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color,
          size: 2 + Math.random() * 3.5,
          life: 0,
          maxLife: 0.4 + Math.random() * 0.35,
        });
      }
      particlesRef.current.push(...parts);
    },
    [],
  );

  // 현재 활성화된 타겟 찾기 (수동 락온 또는 가장 낮은 위험 운석)
  const getActiveTarget = useCallback((): Meteor | null => {
    const meteors = meteorsRef.current;
    if (meteors.length === 0) return null;

    if (lockedTargetIdRef.current != null) {
      const found = meteors.find((m) => m.id === lockedTargetIdRef.current);
      if (found) return found;
    }

    // 수동 선택이 없으면 지상에 가장 가까운(y가 가장 큰) 운석 자동 타겟팅
    const sorted = [...meteors].sort((a, b) => b.y - a.y);
    return sorted[0] ?? null;
  }, []);

  // 탄환 선택 및 사격 (먼저 선택된 타겟에 대해 정답 판정!)
  const shootBullet = useCallback(
    (bullet: BulletValue) => {
      if (phaseRef.current !== "playing") return;

      const target = getActiveTarget();
      if (!target) return;

      // 포탑 각도 갱신
      const dx = target.x - TURRET_X;
      const dy = target.y - TURRET_Y;
      targetTurretAngleRef.current = Math.atan2(dy, dx);
      turretAngleRef.current = Math.atan2(dy, dx);

      const isHit = target.correctBulletId === bullet.id;

      // 레이저 빔 생성
      lasersRef.current.push({
        startX: TURRET_X,
        startY: TURRET_Y,
        targetX: target.x,
        targetY: target.y,
        color: isHit ? "#38bdf8" : "#f43f5e",
        progress: 0,
        isHit,
      });

      playSound("laser", comboRef.current, mutedRef.current);

      if (isHit) {
        // [정답 격추 성공!]
        const newCombo = comboRef.current + 1;
        setCombo(newCombo);
        comboRef.current = newCombo;
        if (newCombo > maxComboRef.current) {
          maxComboRef.current = newCombo;
          setMaxCombo(newCombo);
        }

        const newCleared = clearedRef.current + 1;
        setClearedCount(newCleared);
        clearedRef.current = newCleared;

        const altitudeRatio = Math.max(0, (BASE_Y - target.y) / BASE_Y);
        const { newScore, gained } = calcDestroyScore(
          scoreRef.current,
          newCombo,
          isFeverRef.current,
          altitudeRatio,
        );
        setScore(newScore);
        scoreRef.current = newScore;
        setWaveInfo(getWaveSettings(newScore));

        playSound("hit", newCombo, mutedRef.current);
        spawnExplosion(target.x, target.y, target.color, 25);

        const popLabel = altitudeRatio > 0.6 ? `PERFECT! +${gained}` : `+${gained}`;
        floatTextsRef.current.push({
          x: target.x,
          y: target.y,
          text: popLabel,
          color: "#fde047",
          life: 0,
          maxLife: 0.8,
        });

        // 피버 트리거 (10콤보 주기)
        if (newCombo > 0 && newCombo % FEVER_COMBO === 0 && !isFeverRef.current) {
          triggerFever();
        }

        // 운석 제거
        meteorsRef.current = meteorsRef.current.filter((m) => m.id !== target.id);
        if (lockedTargetIdRef.current === target.id) {
          setLockedTargetId(null);
          lockedTargetIdRef.current = null;
        }
      } else {
        // [오답! 즉시 목숨(하트) 차감!]
        playSound("wrong", 0, mutedRef.current);
        screenShakeRef.current = 14;
        setCombo(0);
        comboRef.current = 0;

        const nextLives = livesRef.current - 1;
        setLives(nextLives);
        livesRef.current = nextLives;

        floatTextsRef.current.push({
          x: target.x,
          y: target.y - 20,
          text: "오답! -1 HP 💥",
          color: "#f43f5e",
          life: 0,
          maxLife: 1.0,
        });

        if (nextLives <= 0) {
          endGame();
        }
      }
    },
    [getActiveTarget, spawnExplosion, triggerFever, endGame],
  );

  // 키보드 바인딩 (1~7)
  useEffect(() => {
    if (phase !== "playing") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key;
      const num = parseInt(key, 10);
      if (num >= 1 && num <= BULLET_VALUES.length) {
        e.preventDefault();
        const bullet = BULLET_VALUES[num - 1];
        if (bullet) shootBullet(bullet);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [phase, shootBullet]);

  // 메인 게임 루프 (RequestAnimationFrame 60fps)
  useEffect(() => {
    if (phase !== "playing") return;

    let animId: number;
    lastFrameTimeRef.current = performance.now();
    lastSpawnTimeRef.current = performance.now();

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const loop = (now: number) => {
      const dt = Math.min((now - lastFrameTimeRef.current) / 1000, 0.1);
      lastFrameTimeRef.current = now;

      // 1. 운석 스폰
      const wave = getWaveSettings(scoreRef.current);
      if (
        now - lastSpawnTimeRef.current >= wave.spawnIntervalSec * 1000 &&
        meteorsRef.current.length < wave.maxSimultaneous
      ) {
        meteorsRef.current.push(createMeteor(wave, VW));
        lastSpawnTimeRef.current = now;
      }

      // 2. 물리 갱신 (운석 이동 및 지상 충돌 체크)
      const currentMeteors = meteorsRef.current;
      const survivingMeteors: Meteor[] = [];

      for (const m of currentMeteors) {
        m.y += m.speed * dt;
        m.x += m.vx * dt;

        if (m.x < m.radius + 10) {
          m.x = m.radius + 10;
          m.vx = Math.abs(m.vx);
        } else if (m.x > VW - m.radius - 10) {
          m.x = VW - m.radius - 10;
          m.vx = -Math.abs(m.vx);
        }

        // 지상 충돌 체크 -> 목숨 차감!
        if (m.y + m.radius >= BASE_Y) {
          playSound("base_hit", 0, mutedRef.current);
          spawnExplosion(m.x, BASE_Y, "#f97316", 30);
          screenShakeRef.current = 15;

          const nextLives = livesRef.current - 1;
          setLives(nextLives);
          livesRef.current = nextLives;
          setCombo(0);
          comboRef.current = 0;

          if (lockedTargetIdRef.current === m.id) {
            setLockedTargetId(null);
            lockedTargetIdRef.current = null;
          }

          if (nextLives <= 0) {
            endGame();
            return;
          }
        } else {
          survivingMeteors.push(m);
        }
      }
      meteorsRef.current = survivingMeteors;

      // 현재 타겟 갱신 (상단 HUD용)
      const active = getActiveTarget();
      if (active) {
        setCurrentTargetPrompt(active.promptText);
        setCurrentTargetLatex(active.promptLatex);
        // 포탑 부드럽게 타겟 조준
        const dx = active.x - TURRET_X;
        const dy = active.y - TURRET_Y;
        targetTurretAngleRef.current = Math.atan2(dy, dx);
      } else {
        setCurrentTargetPrompt(null);
        setCurrentTargetLatex(null);
        targetTurretAngleRef.current = -Math.PI / 2;
      }

      // 3. 파티클 갱신
      const parts = particlesRef.current;
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]!;
        p.life += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 120 * dt;
        if (p.life >= p.maxLife) {
          parts.splice(i, 1);
        }
      }

      // 4. 레이저 갱신
      const lasers = lasersRef.current;
      for (let i = lasers.length - 1; i >= 0; i--) {
        const l = lasers[i]!;
        l.progress += dt * 6.5;
        if (l.progress >= 1) {
          lasers.splice(i, 1);
        }
      }

      // 5. 플로팅 텍스트 갱신
      const ftexts = floatTextsRef.current;
      for (let i = ftexts.length - 1; i >= 0; i--) {
        const ft = ftexts[i]!;
        ft.life += dt;
        ft.y -= 35 * dt;
        if (ft.life >= ft.maxLife) {
          ftexts.splice(i, 1);
        }
      }

      // 6. 스크린 쉐이크 감쇠
      if (screenShakeRef.current > 0) {
        screenShakeRef.current = Math.max(0, screenShakeRef.current - dt * 30);
      }

      // ── 렌더링 ──
      ctx.save();
      ctx.clearRect(0, 0, VW, VH);

      if (screenShakeRef.current > 0) {
        const ox = (Math.random() - 0.5) * screenShakeRef.current;
        const oy = (Math.random() - 0.5) * screenShakeRef.current;
        ctx.translate(ox, oy);
      }

      // 1) 배경 그라디언트
      const bgGrad = ctx.createLinearGradient(0, 0, 0, VH);
      bgGrad.addColorStop(0, isFeverRef.current ? "#1e1305" : "#090d16");
      bgGrad.addColorStop(1, isFeverRef.current ? "#2e1208" : "#111827");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, VW, VH);

      // 2) 배경 별
      for (const st of starsRef.current) {
        ctx.fillStyle = `rgba(255, 255, 255, ${st.b})`;
        ctx.beginPath();
        ctx.arc(st.x, st.y, st.s, 0, Math.PI * 2);
        ctx.fill();
      }

      // 3) 지상 방어선
      ctx.strokeStyle = isFeverRef.current ? "#fbbf24" : "#38bdf8";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, BASE_Y);
      ctx.lineTo(VW, BASE_Y);
      ctx.stroke();

      ctx.fillStyle = isFeverRef.current
        ? "rgba(251, 191, 36, 0.08)"
        : "rgba(56, 189, 248, 0.06)";
      ctx.fillRect(0, BASE_Y, VW, VH - BASE_Y);

      // 4) 레이저 빔
      for (const laser of lasers) {
        const curX =
          laser.startX + (laser.targetX - laser.startX) * Math.min(1, laser.progress * 1.4);
        const curY =
          laser.startY + (laser.targetY - laser.startY) * Math.min(1, laser.progress * 1.4);

        ctx.strokeStyle = laser.color;
        ctx.lineWidth = isFeverRef.current ? 5 : 3.5;
        ctx.shadowColor = laser.color;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(laser.startX, laser.startY);
        ctx.lineTo(curX, curY);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // 5) 운석 렌더링
      const activeTargetId = active?.id;

      for (const m of meteorsRef.current) {
        const isTarget = m.id === activeTargetId;

        // 꼬리 화염
        ctx.fillStyle = m.color;
        ctx.globalAlpha = 0.25;
        ctx.beginPath();
        ctx.arc(m.x - m.vx * 0.1, m.y - 12, m.radius * 0.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;

        // 구체 글로우
        ctx.shadowColor = m.color;
        ctx.shadowBlur = isTarget ? 20 : 12;

        const sphereGrad = ctx.createRadialGradient(
          m.x - m.radius * 0.3,
          m.y - m.radius * 0.3,
          m.radius * 0.1,
          m.x,
          m.y,
          m.radius,
        );
        sphereGrad.addColorStop(0, "#ffffff");
        sphereGrad.addColorStop(0.4, m.color);
        sphereGrad.addColorStop(1, "#0f172a");

        ctx.fillStyle = sphereGrad;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = isTarget ? "#facc15" : "#ffffff";
        ctx.lineWidth = isTarget ? 2.5 : 1.5;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // [조준 락온 타겟 표시]
        if (isTarget) {
          ctx.strokeStyle = "#facc15";
          ctx.lineWidth = 2.5;

          // 외곽 회전 점선 링
          ctx.save();
          ctx.translate(m.x, m.y);
          ctx.rotate((now / 1000) * 2);
          ctx.beginPath();
          ctx.arc(0, 0, m.radius + 12, 0, Math.PI * 2);
          ctx.setLineDash([8, 6]);
          ctx.stroke();
          ctx.restore();

          // 상단 TARGET 뱃지
          ctx.fillStyle = "#facc15";
          ctx.font = "bold 11px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("TARGET 🎯", m.x, m.y - m.radius - 14);
        }

        // 운석 수식 텍스트
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 16px 'Pretendard', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
        ctx.shadowBlur = 4;
        ctx.fillText(m.promptText, m.x, m.y);
        ctx.shadowBlur = 0;
      }

      // 6) 파티클
      for (const p of particlesRef.current) {
        const alpha = Math.max(0, 1 - p.life / p.maxLife);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1.0;

      // 7) 플로팅 텍스트
      for (const ft of floatTextsRef.current) {
        const alpha = Math.max(0, 1 - ft.life / ft.maxLife);
        ctx.fillStyle = ft.color;
        ctx.globalAlpha = alpha;
        ctx.font = "bold 17px 'Pretendard', sans-serif";
        ctx.textAlign = "center";
        ctx.shadowColor = "rgba(0,0,0,0.8)";
        ctx.shadowBlur = 6;
        ctx.fillText(ft.text, ft.x, ft.y);
      }
      ctx.globalAlpha = 1.0;
      ctx.shadowBlur = 0;

      // 8) 레이저 포탑
      turretAngleRef.current +=
        (targetTurretAngleRef.current - turretAngleRef.current) * 0.25;
      const angle = turretAngleRef.current;

      ctx.save();
      ctx.translate(TURRET_X, TURRET_Y);

      // 포신
      ctx.save();
      ctx.rotate(angle + Math.PI / 2);
      ctx.fillStyle = isFeverRef.current ? "#fbbf24" : "#94a3b8";
      ctx.fillRect(-5, -28, 10, 26);
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-5, -28, 10, 26);

      ctx.fillStyle = "#38bdf8";
      ctx.fillRect(-7, -32, 14, 4);
      ctx.restore();

      // 원형 베이스
      ctx.fillStyle = "#1e293b";
      ctx.beginPath();
      ctx.arc(0, 0, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = isFeverRef.current ? "#f59e0b" : "#38bdf8";
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // 코어
      ctx.fillStyle = isFeverRef.current ? "#fbbf24" : "#38bdf8";
      ctx.shadowColor = isFeverRef.current ? "#fbbf24" : "#38bdf8";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.restore();

      ctx.restore();
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [phase, getActiveTarget, spawnExplosion, endGame]);

  // 운석 직접 탭 (수동 락온 선택)
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (phaseRef.current !== "playing") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = VW / rect.width;
    const scaleY = VH / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    for (const m of meteorsRef.current) {
      const dist = Math.hypot(m.x - clickX, m.y - clickY);
      if (dist <= m.radius + 16) {
        setLockedTargetId(m.id);
        lockedTargetIdRef.current = m.id;
        playSound("lock", 0, mutedRef.current);
        return;
      }
    }
  }, []);

  const startGame = useCallback(() => {
    setLives(START_LIVES);
    livesRef.current = START_LIVES;
    setScore(0);
    scoreRef.current = 0;
    setCombo(0);
    comboRef.current = 0;
    setMaxCombo(0);
    maxComboRef.current = 0;
    setClearedCount(0);
    clearedRef.current = 0;
    setIsFever(false);
    isFeverRef.current = false;
    setWaveInfo(getWaveSettings(0));
    setLockedTargetId(null);
    lockedTargetIdRef.current = null;
    setSubmitResult(null);

    meteorsRef.current = [];
    particlesRef.current = [];
    lasersRef.current = [];
    floatTextsRef.current = [];

    setPhase("playing");
    phaseRef.current = "playing";
  }, []);

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
          /* safe */
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
          /* safe */
        }
      });
    },
    [rankingScope],
  );

  // 1. Ready 화면
  if (phase === "ready") {
    return (
      <div className="relative mx-auto max-w-2xl overflow-hidden rounded-3xl border border-wood/20 bg-wood/5 p-6 shadow-sm sm:p-8">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-wood/20 bg-wood/10 px-3.5 py-1 text-xs font-semibold text-foreground/75">
            <span>중3 · 3.1 삼각비</span>
            <span>•</span>
            <span className="text-wood">실시간 탄막 아케이드 디펜스</span>
          </div>

          <h1 className="mt-4 font-display text-3xl font-extrabold text-foreground sm:text-4xl">
            특수각 스트라이크: 미티어 디펜스
          </h1>
          <p className="mt-2 text-sm text-foreground/70 sm:text-base">
            하늘에서 쏟아지는 특수각 운석들을 조준하고 정확한 삼각비 탄환으로 요격하세요!
          </p>
        </div>

        <div className="mt-6 space-y-3 rounded-2xl border border-wood/15 bg-white/70 p-4 dark:bg-black/30 sm:p-5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-wood">
            작전 브리핑
          </h2>

          <ul className="space-y-2.5 text-xs leading-relaxed text-foreground/85">
            <li className="flex items-start gap-2.5">
              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-blue-600 font-bold text-xs">
                1
              </span>
              <span>
                <strong>타겟 조준 (선택)</strong>: 화면의 운석을 탭해 공격할 대상을 조준하세요. 탭하지 않아도 <strong>지상에 가장 가까운 운석이 자동 조준</strong>됩니다.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-600 font-bold text-xs">
                2
              </span>
              <span>
                <strong>탄환 발사</strong>: 조준된 운석의 삼각비 값을 하단 탄환(또는 숫자키 1~7)에서 골라 쏘세요!
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-500/20 text-rose-600 font-bold text-xs">
                3
              </span>
              <span>
                <strong className="text-rose-600">오답 시 즉시 목숨(하트) -1 차감!</strong> 또한 운석이 바닥에 닿아도 목숨이 깎입니다! 신중하고 빠르게 격추하세요!
              </span>
            </li>
          </ul>

          <div className="mt-4 border-t border-wood/10 pt-3 text-[11px] text-foreground/60">
            💡 데스크톱에서는 숫자키 <kbd className="rounded border bg-wood/10 px-1 py-0.5 font-mono text-xs">1</kbd> ~ <kbd className="rounded border bg-wood/10 px-1 py-0.5 font-mono text-xs">7</kbd> 로 신속하게 발사할 수 있습니다!
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={toggleMute}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-wood/20 bg-white/60 px-3.5 py-2 text-xs font-semibold text-foreground/70 transition hover:bg-white dark:bg-black/20"
          >
            {muted ? "🔇 효과음 켜기" : "🔊 효과음 끄기"}
          </button>

          <button
            type="button"
            onClick={startGame}
            className="inline-flex flex-1 items-center justify-center rounded-2xl bg-wood px-6 py-3.5 text-base font-bold text-white shadow-md transition-all hover:bg-wood-dark hover:shadow-lg active:scale-98"
          >
            요격 출격하기 🚀
          </button>
        </div>
      </div>
    );
  }

  // 2. Ended (게임 오버) 화면
  if (phase === "ended") {
    return (
      <div className="mx-auto max-w-2xl space-y-6 rounded-3xl border border-wood/20 bg-wood/5 p-6 shadow-sm sm:p-8">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1 text-xs font-bold text-rose-600">
            BASE DESTROYED
          </div>
          <h2 className="mt-2 font-display text-3xl font-extrabold text-foreground sm:text-4xl">
            기지 방어선 돌파!
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
                연습 모드 · 학급 배정·활성화된 수업이면 점수만큼 XP와 랭킹이 기록됩니다.
              </p>
            )
          ) : (
            <p className="mt-1 text-[11px] text-foreground/45">
              학급에 배정·활성화된 수업이면 점수만큼 XP가 누적됩니다.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-3">
          <div className="rounded-2xl border border-wood/15 bg-white/70 p-3 dark:bg-black/20">
            <div className="text-[11px] font-semibold text-foreground/55">
              격추한 운석
            </div>
            <div className="mt-1 font-display text-2xl font-black text-foreground">
              {clearedCount}
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
          <div className="col-span-2 sm:col-span-1 rounded-2xl border border-wood/15 bg-white/70 p-3 dark:bg-black/20">
            <div className="text-[11px] font-semibold text-foreground/55">
              최종 도달 웨이브
            </div>
            <div className="mt-1 font-display text-2xl font-black text-wood">
              Wave {waveInfo.wave}
            </div>
          </div>
        </div>

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

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={startGame}
            className="flex-1 rounded-2xl bg-wood py-3.5 text-center text-sm font-bold text-white shadow-md transition hover:bg-wood-dark"
          >
            다시 요격 출격 ⚡
          </button>
        </div>
      </div>
    );
  }

  // 3. Playing 화면
  return (
    <div className="mx-auto max-w-3xl select-none space-y-3">
      {/* 상태 헤더 바 */}
      <div className="flex items-center justify-between rounded-2xl border border-wood/20 bg-wood/5 px-4 py-2.5">
        {/* 생명 쉴드 */}
        <div className="flex items-center gap-1.5" aria-label={`방어 쉴드 ${lives}개`}>
          {Array.from({ length: MAX_LIVES }, (_, i) => (
            <span
              key={i}
              className={[
                "inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-black transition-all",
                i < lives
                  ? "bg-[#38bdf8] text-white shadow-sm ring-2 ring-sky-300"
                  : "bg-wood/10 text-wood/25",
              ].join(" ")}
            >
              🛡️
            </span>
          ))}
        </div>

        {/* 현재 조준 타겟 안내 뱃지 */}
        <div className="flex items-center gap-2">
          {currentTargetPrompt ? (
            <div className="flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-700 dark:text-amber-300">
              <span>🎯 조준:</span>
              <Latex latex={currentTargetLatex ?? ""} className="font-extrabold text-sm" />
            </div>
          ) : (
            <span className="text-xs text-foreground/50 font-medium">
              대기 중...
            </span>
          )}

          {combo > 1 && (
            <span className="rounded-full border border-amber-500/30 bg-amber-500/15 px-2.5 py-0.5 text-xs font-black text-amber-600 animate-pulse">
              🔥 {combo} COMBO!
            </span>
          )}
          {isFever && (
            <span className="rounded-full bg-gradient-to-r from-amber-500 to-rose-500 px-3 py-0.5 text-xs font-black text-white shadow-sm">
              FEVER {feverSec}s
            </span>
          )}
        </div>

        {/* 점수 & 음소거 */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="font-mono text-xl font-black text-wood">
              {score}
            </span>
            <span className="text-[10px] text-foreground/50"> pt</span>
          </div>
          <button
            type="button"
            onClick={toggleMute}
            className="rounded-lg border border-wood/20 bg-white/60 p-1.5 text-xs text-foreground/70 transition hover:bg-white dark:bg-black/30"
          >
            {muted ? "🔇" : "🔊"}
          </button>
        </div>
      </div>

      {/* 게임 캔버스 (800 x 540) */}
      <div className="relative overflow-hidden rounded-3xl border-2 border-wood/25 bg-slate-950 shadow-lg">
        <canvas
          ref={canvasRef}
          width={VW}
          height={VH}
          onClick={handleCanvasClick}
          className="block h-auto w-full cursor-crosshair touch-none"
        />

        {/* 캔버스 상단 안내 플로팅 팁 */}
        <div className="pointer-events-none absolute left-3 top-3 rounded-lg bg-black/50 px-2.5 py-1 text-[11px] font-semibold text-white/70 backdrop-blur-sm">
          💡 운석을 탭해 타겟을 바꾸거나, 하단 탄환으로 조준된 운석을 격추하세요! (오답 시 목숨 -1)
        </div>
      </div>

      {/* 하단 탄환 발사 컨트롤러 (Bullet Deck) */}
      <div className="rounded-3xl border border-wood/20 bg-wood/5 p-3.5 shadow-sm">
        <div className="mb-2 flex items-center justify-between px-1 text-[11px] font-semibold text-foreground/60">
          <span>탄환 선택 (클릭 또는 키보드 1~7)</span>
          <span className="text-rose-600 dark:text-rose-400 font-bold">
            ⚠️ 오답 시 즉시 목숨 -1
          </span>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {BULLET_VALUES.map((bullet) => {
            const isTanOnly = bullet.category === "tan_only";
            return (
              <button
                key={bullet.id}
                type="button"
                onClick={() => shootBullet(bullet)}
                className={[
                  "group relative flex flex-col items-center justify-center rounded-2xl border py-3 px-1 transition-all duration-100 active:scale-95 shadow-sm",
                  isTanOnly
                    ? "border-emerald-500/40 bg-emerald-500/10 hover:border-emerald-500 hover:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300"
                    : "border-wood/20 bg-white hover:border-sky-500 hover:bg-sky-500/10 dark:bg-black/40 text-foreground",
                ].join(" ")}
              >
                <span className="absolute left-1.5 top-1 rounded border border-wood/15 bg-wood/5 px-1 text-[9px] font-mono opacity-60">
                  {bullet.keyLabel}
                </span>

                <Latex
                  latex={bullet.latex}
                  className="mt-2 font-display text-base font-bold group-hover:scale-105 transition-transform sm:text-lg"
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
