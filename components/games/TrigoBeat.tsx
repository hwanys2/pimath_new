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

// 캔버스 가상 좌표계 (800 x 540)
const VW = 800;
const VH = 540;
const BASE_Y = 490; // 지상 방어선 Y좌표
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
  kind: "laser" | "hit" | "bomb" | "wrong" | "base_hit" | "fever" | "pass",
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
      // 퓨웅- 레이저 발사음
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(850, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.12);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
      osc.start(now);
      osc.stop(now + 0.14);
    } else if (kind === "hit") {
      // 쾅! 크리스탈 폭발음 (콤보에 따라 피치 상승)
      const scale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
      const freq = scale[combo % scale.length]!;
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.6, now + 0.15);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.start(now);
      osc.stop(now + 0.3);
    } else if (kind === "fever") {
      // 피버 팡파르
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(523, now);
      osc.frequency.setValueAtTime(659, now + 0.08);
      osc.frequency.setValueAtTime(784, now + 0.16);
      osc.frequency.setValueAtTime(1046, now + 0.24);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.start(now);
      osc.stop(now + 0.47);
    } else if (kind === "pass") {
      // 폭탄 안전 통과 차임
      osc.type = "sine";
      osc.frequency.setValueAtTime(660, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.22);
    } else if (kind === "wrong") {
      // 불발
      osc.type = "square";
      osc.frequency.setValueAtTime(240, now);
      osc.frequency.setValueAtTime(160, now + 0.08);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.start(now);
      osc.stop(now + 0.2);
    } else {
      // bomb or base_hit 둔탁한 폭발
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
  const [lockedTargetId, setLockedTargetId] = useState<number | null>(null);

  const [muted, setMuted] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(MUTE_KEY) === "1";
    } catch {
      return false;
    }
  });

  // 결과 & 랭킹
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

  const turretAngleRef = useRef(-Math.PI / 2); // 위쪽(90도)
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

  // 게임 오버 처리
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
          accuracy: 100, // 격추 위주
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

  // 파티클 생성 헬퍼
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

  // 탄환 발사 & 격추 로직
  const shootBullet = useCallback(
    (bullet: BulletValue) => {
      if (phaseRef.current !== "playing") return;

      const meteors = meteorsRef.current;
      if (meteors.length === 0) return;

      // 타겟 결정: 수동 락온된 타겟이 있으면 그것, 없으면 Y가 가장 큰(가장 낮은) 유효 운석
      let target: Meteor | null = null;
      if (lockedTargetIdRef.current != null) {
        target =
          meteors.find((m) => m.id === lockedTargetIdRef.current) ?? null;
      }

      // 만약 락온된 타겟이 없거나 이미 사라졌으면, 이 탄환과 일치하는 정답 운석 중 가장 위험한(Y가 큰) 것 검색
      if (!target) {
        const matching = meteors
          .filter((m) => m.correctBulletId === bullet.id)
          .sort((a, b) => b.y - a.y);
        if (matching.length > 0) {
          target = matching[0]!;
        } else {
          // 정답이 없다면 화면에서 가장 낮은 운석을 향해 불발 사격
          const sorted = [...meteors].sort((a, b) => b.y - a.y);
          target = sorted[0]!;
        }
      }

      if (!target) return;

      // 포탑 각도 갱신
      const dx = target.x - TURRET_X;
      const dy = target.y - TURRET_Y;
      targetTurretAngleRef.current = Math.atan2(dy, dx);
      turretAngleRef.current = Math.atan2(dy, dx);

      const isHit = target.correctBulletId === bullet.id;
      const isBombHit = target.isBomb;

      // 레이저 빔 생성
      lasersRef.current.push({
        startX: TURRET_X,
        startY: TURRET_Y,
        targetX: target.x,
        targetY: target.y,
        color: isBombHit ? "#ef4444" : isHit ? "#38bdf8" : "#f43f5e",
        progress: 0,
        isHit,
      });

      playSound("laser", comboRef.current, mutedRef.current);

      if (isBombHit) {
        // ☠️ tan 90° 폭탄을 쐈을 때: 기지 대폭발 패널티!
        playSound("bomb", 0, mutedRef.current);
        spawnExplosion(target.x, target.y, "#ef4444", 35);
        screenShakeRef.current = 18;

        floatTextsRef.current.push({
          x: target.x,
          y: target.y,
          text: "DANGER! tan 90° 불능 폭발! -1 HP",
          color: "#ef4444",
          life: 0,
          maxLife: 1.2,
        });

        // 운석 제거
        meteorsRef.current = meteorsRef.current.filter((m) => m.id !== target!.id);
        if (lockedTargetIdRef.current === target.id) {
          setLockedTargetId(null);
        }

        // 실드 감소
        const nextLives = livesRef.current - 1;
        setLives(nextLives);
        livesRef.current = nextLives;
        setCombo(0);
        comboRef.current = 0;

        if (nextLives <= 0) {
          endGame();
        }
      } else if (isHit) {
        // 정답 격추!
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

        // 플로팅 텍스트
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

        // 제거
        meteorsRef.current = meteorsRef.current.filter((m) => m.id !== target!.id);
        if (lockedTargetIdRef.current === target.id) {
          setLockedTargetId(null);
        }
      } else {
        // 오답 빗나감
        playSound("wrong", 0, mutedRef.current);
        setCombo(0);
        comboRef.current = 0;

        floatTextsRef.current.push({
          x: target.x,
          y: target.y - 15,
          text: "MISS...",
          color: "#f43f5e",
          life: 0,
          maxLife: 0.6,
        });
      }
    },
    [spawnExplosion, triggerFever, endGame],
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

      // 1. 운석 스폰 로직
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

        // 벽 튕김
        if (m.x < m.radius + 10) {
          m.x = m.radius + 10;
          m.vx = Math.abs(m.vx);
        } else if (m.x > VW - m.radius - 10) {
          m.x = VW - m.radius - 10;
          m.vx = -Math.abs(m.vx);
        }

        // 지상 도달 체크
        if (m.y + m.radius >= BASE_Y) {
          if (m.isBomb) {
            // ☠️ tan 90° 폭탄은 안전 통과! 보너스 부여
            playSound("pass", 0, mutedRef.current);
            floatTextsRef.current.push({
              x: m.x,
              y: BASE_Y - 20,
              text: "SAFE PASS! +10",
              color: "#34d399",
              life: 0,
              maxLife: 1.0,
            });
            const newScore = scoreRef.current + 10;
            setScore(newScore);
            scoreRef.current = newScore;
          } else {
            // 일반 운석이 지상 기지에 충돌: 실드 파괴!
            playSound("base_hit", 0, mutedRef.current);
            spawnExplosion(m.x, BASE_Y, "#f97316", 30);
            screenShakeRef.current = 15;

            const nextLives = livesRef.current - 1;
            setLives(nextLives);
            livesRef.current = nextLives;
            setCombo(0);
            comboRef.current = 0;

            if (nextLives <= 0) {
              endGame();
              return;
            }
          }
        } else {
          survivingMeteors.push(m);
        }
      }
      meteorsRef.current = survivingMeteors;

      // 3. 파티클 갱신
      const parts = particlesRef.current;
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]!;
        p.life += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 120 * dt; // 중력
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

      // 스크린 쉐이크 적용
      if (screenShakeRef.current > 0) {
        const ox = (Math.random() - 0.5) * screenShakeRef.current;
        const oy = (Math.random() - 0.5) * screenShakeRef.current;
        ctx.translate(ox, oy);
      }

      // 1) 우주 배경 그라디언트
      const bgGrad = ctx.createLinearGradient(0, 0, 0, VH);
      bgGrad.addColorStop(0, isFeverRef.current ? "#1e1305" : "#090d16");
      bgGrad.addColorStop(1, isFeverRef.current ? "#2e1208" : "#111827");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, VW, VH);

      // 2) 반짝이는 배경 별
      for (const st of starsRef.current) {
        ctx.fillStyle = `rgba(255, 255, 255, ${st.b})`;
        ctx.beginPath();
        ctx.arc(st.x, st.y, st.s, 0, Math.PI * 2);
        ctx.fill();
      }

      // 3) 지상 에너지 배리어 라인
      ctx.strokeStyle = isFeverRef.current ? "#fbbf24" : "#38bdf8";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, BASE_Y);
      ctx.lineTo(VW, BASE_Y);
      ctx.stroke();

      // 배리어 글로우
      ctx.fillStyle = isFeverRef.current
        ? "rgba(251, 191, 36, 0.08)"
        : "rgba(56, 189, 248, 0.06)";
      ctx.fillRect(0, BASE_Y, VW, VH - BASE_Y);

      // 4) 레이저 빔 렌더링
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
      for (const m of meteorsRef.current) {
        const isLocked = lockedTargetIdRef.current === m.id;

        // 꼬리 화염 파티클
        ctx.fillStyle = m.color;
        ctx.globalAlpha = 0.25;
        ctx.beginPath();
        ctx.arc(m.x - m.vx * 0.1, m.y - 12, m.radius * 0.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;

        // 운석 구체 글로우
        ctx.shadowColor = m.color;
        ctx.shadowBlur = m.isBomb ? 18 : 12;

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
        sphereGrad.addColorStop(1, m.isBomb ? "#7f1d1d" : "#0f172a");

        ctx.fillStyle = sphereGrad;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = m.isBomb ? "#f87171" : "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // 락온 십자선
        if (isLocked) {
          ctx.strokeStyle = "#fbbf24";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(m.x, m.y, m.radius + 8, 0, Math.PI * 2);
          ctx.stroke();
        }

        // 운석 텍스트 (수식)
        ctx.fillStyle = "#ffffff";
        ctx.font = m.isBomb
          ? "bold 15px 'Pretendard', sans-serif"
          : "bold 16px 'Pretendard', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
        ctx.shadowBlur = 4;
        ctx.fillText(m.promptText, m.x, m.y);
        ctx.shadowBlur = 0;
      }

      // 6) 파티클 렌더링
      for (const p of particlesRef.current) {
        const alpha = Math.max(0, 1 - p.life / p.maxLife);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1.0;

      // 7) 플로팅 텍스트 렌더링
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

      // 8) 메카닉 레이저 포탑 렌더링
      // 각도 보간
      turretAngleRef.current +=
        (targetTurretAngleRef.current - turretAngleRef.current) * 0.25;
      const angle = turretAngleRef.current;

      ctx.save();
      ctx.translate(TURRET_X, TURRET_Y);

      // 포신 (Barrel)
      ctx.save();
      ctx.rotate(angle + Math.PI / 2); // 캔버스 회전 오프셋
      ctx.fillStyle = isFeverRef.current ? "#fbbf24" : "#94a3b8";
      ctx.fillRect(-5, -28, 10, 26);
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-5, -28, 10, 26);

      // 포구 팁
      ctx.fillStyle = "#38bdf8";
      ctx.fillRect(-7, -32, 14, 4);
      ctx.restore();

      // 포탑 원형 베이스
      ctx.fillStyle = "#1e293b";
      ctx.beginPath();
      ctx.arc(0, 0, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = isFeverRef.current ? "#f59e0b" : "#38bdf8";
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // 코어 램프
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
  }, [phase, spawnExplosion, endGame]);

  // 운석 탭 타겟팅 핸들러
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (phaseRef.current !== "playing") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = VW / rect.width;
    const scaleY = VH / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    // 클릭된 운석 탐색
    for (const m of meteorsRef.current) {
      const dist = Math.hypot(m.x - clickX, m.y - clickY);
      if (dist <= m.radius + 15) {
        setLockedTargetId(m.id);
        lockedTargetIdRef.current = m.id;
        const dx = m.x - TURRET_X;
        const dy = m.y - TURRET_Y;
        targetTurretAngleRef.current = Math.atan2(dy, dx);
        return;
      }
    }
    setLockedTargetId(null);
    lockedTargetIdRef.current = null;
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
    setSubmitResult(null);

    meteorsRef.current = [];
    particlesRef.current = [];
    lasersRef.current = [];
    floatTextsRef.current = [];

    setPhase("playing");
    phaseRef.current = "playing";
  }, []);

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

  // ── 렌더링 ──

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
            하늘에서 쏟아지는 특수각 운석들을 회전 레이저 포탑으로 공중 요격하세요!
            <br />
            특수각 삼각비 탄환을 신속히 장전해 지구를 지켜내세요.
          </p>
        </div>

        {/* 조작 안내 및 특수 규칙 */}
        <div className="mt-6 space-y-3 rounded-2xl border border-wood/15 bg-white/70 p-4 dark:bg-black/30 sm:p-5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-wood">
            작전 브리핑
          </h2>

          <div className="grid gap-3 sm:grid-cols-2 text-xs leading-relaxed text-foreground/85">
            <div className="rounded-xl border border-wood/10 bg-wood/5 p-3">
              <span className="font-bold text-blue-600 dark:text-blue-400">
                🚀 실시간 공중 요격
              </span>
              <p className="mt-1">
                낙하하는 운석의 삼각비에 맞는 탄환(0 ~ √3)을 누르면 포탑이 즉시 회전하여 요격 레이저를 쏩니다!
              </p>
            </div>

            <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3">
              <span className="font-bold text-rose-600 dark:text-rose-400">
                ☠️ tan 90° 해골 폭탄 주의!
              </span>
              <p className="mt-1">
                tan 90°는 <strong>값이 정의되지 않습니다!</strong> 건드리면 즉시 대폭발하여 기지 실드가 깎이니 절대 쏘지 말고 통과시키세요!
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-wood/10 bg-wood/5 p-3 text-xs">
            <div className="font-bold text-wood">⚡ 탄환 키보드 단축키 (데스크톱)</div>
            <div className="mt-2 flex flex-wrap gap-2 font-mono text-[11px]">
              <span className="rounded bg-white px-1.5 py-0.5 shadow-sm border border-wood/15">
                [1] = 0
              </span>
              <span className="rounded bg-white px-1.5 py-0.5 shadow-sm border border-wood/15">
                [2] = 1/2
              </span>
              <span className="rounded bg-white px-1.5 py-0.5 shadow-sm border border-wood/15">
                [3] = √2/2
              </span>
              <span className="rounded bg-white px-1.5 py-0.5 shadow-sm border border-wood/15">
                [4] = √3/2
              </span>
              <span className="rounded bg-white px-1.5 py-0.5 shadow-sm border border-wood/15">
                [5] = 1
              </span>
              <span className="rounded bg-emerald-50 text-emerald-700 px-1.5 py-0.5 shadow-sm border border-emerald-500/20">
                [6] = √3/3
              </span>
              <span className="rounded bg-emerald-50 text-emerald-700 px-1.5 py-0.5 shadow-sm border border-emerald-500/20">
                [7] = √3
              </span>
            </div>
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

        {/* 요약 카드 */}
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

        {/* 웨이브 및 콤보 */}
        <div className="flex items-center gap-2">
          <span className="rounded-md border border-wood/20 bg-wood/10 px-2 py-0.5 text-xs font-bold text-foreground/75">
            {waveInfo.title}
          </span>
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
          💡 운석을 탭하면 조준 락온! / 하단 탄환이나 숫자키(1~7)로 격추!
        </div>
      </div>

      {/* 하단 탄환 발사 컨트롤러 (Bullet Deck) */}
      <div className="rounded-3xl border border-wood/20 bg-wood/5 p-3.5 shadow-sm">
        <div className="mb-2 flex items-center justify-between px-1 text-[11px] font-semibold text-foreground/60">
          <span>탄환 선택 (클릭 또는 키보드 1~7)</span>
          <span className="text-emerald-700 dark:text-emerald-400">
            초록색은 tan 전용 탄환
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
                {/* 단축키 뱃지 */}
                <span className="absolute left-1.5 top-1 rounded border border-wood/15 bg-wood/5 px-1 text-[9px] font-mono opacity-60">
                  {bullet.keyLabel}
                </span>

                {/* 탄환 수식 (LaTeX) */}
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
