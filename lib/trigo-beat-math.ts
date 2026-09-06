/**
 * Math helpers & physics types for 「특수각 스트라이크: 미티어 디펜스」 (중3 · 3.1 삼각비).
 *
 * 하늘에서 떨어지는 특수각 운석들을 실시간 레이저 포탑으로 격추하는 아케이드 디펜스 게임.
 * - 특수각 0°, 30°, 45°, 60°, 90°
 * - tan 90°는 "값이 정의되지 않음(불능)"을 이용한 해골 폭탄 기믹으로 구현!
 */

import { SCORE_HARD_MAX, applyScoreGain } from "@/lib/xp";

export const CONTENT_KEY = "g3-u3-1-trigo-beat";

export const START_LIVES = 3;
export const MAX_LIVES = 3;
export const FEVER_COMBO = 10;
export const FEVER_DURATION_SEC = 8;

export type TrigFn = "sin" | "cos" | "tan";
export type SpecialAngle = 0 | 30 | 45 | 60 | 90;

export type BulletValue = {
  id: string;
  latex: string;
  display: string;
  keyLabel: string;
  category: "common" | "tan_only";
};

/**
 * 7개의 특수각 탄환 정의:
 * 1: 0
 * 2: 1/2
 * 3: √2/2
 * 4: √3/2
 * 5: 1
 * 6: √3/3
 * 7: √3
 */
export const BULLET_VALUES: BulletValue[] = [
  { id: "0", latex: "0", display: "0", keyLabel: "1", category: "common" },
  { id: "1/2", latex: "\\frac{1}{2}", display: "1/2", keyLabel: "2", category: "common" },
  { id: "sqrt2/2", latex: "\\frac{\\sqrt{2}}{2}", display: "√2/2", keyLabel: "3", category: "common" },
  { id: "sqrt3/2", latex: "\\frac{\\sqrt{3}}{2}", display: "√3/2", keyLabel: "4", category: "common" },
  { id: "1", latex: "1", display: "1", keyLabel: "5", category: "common" },
  { id: "sqrt3/3", latex: "\\frac{\\sqrt{3}}{3}", display: "√3/3", keyLabel: "6", category: "tan_only" },
  { id: "sqrt3", latex: "\\sqrt{3}", display: "√3", keyLabel: "7", category: "tan_only" },
];

export type Meteor = {
  id: number;
  fn: TrigFn;
  angle: SpecialAngle;
  isBomb: boolean; // tan 90° 해골 폭탄 여부
  correctBulletId: string; // isBomb이면 "NONE"
  promptLatex: string;
  promptText: string;
  x: number;
  y: number;
  radius: number;
  speed: number;
  vx: number; // 지그재그 흔들림
  spawnTime: number;
  color: string;
};

export type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
};

export type LaserBeam = {
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  color: string;
  progress: number; // 0 to 1
  isHit: boolean;
};

export type FloatingText = {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
};

export function getExactTrigBulletId(fn: TrigFn, angle: SpecialAngle): string {
  if (fn === "sin") {
    switch (angle) {
      case 0:
        return "0";
      case 30:
        return "1/2";
      case 45:
        return "sqrt2/2";
      case 60:
        return "sqrt3/2";
      case 90:
        return "1";
    }
  } else if (fn === "cos") {
    switch (angle) {
      case 0:
        return "1";
      case 30:
        return "sqrt3/2";
      case 45:
        return "sqrt2/2";
      case 60:
        return "1/2";
      case 90:
        return "0";
    }
  } else {
    switch (angle) {
      case 0:
        return "0";
      case 30:
        return "sqrt3/3";
      case 45:
        return "1";
      case 60:
        return "sqrt3";
      case 90:
        return "BOMB"; // tan 90°는 폭탄!
    }
  }
}

export type WaveSettings = {
  wave: number;
  title: string;
  spawnIntervalSec: number;
  meteorSpeed: number;
  allowTan: boolean;
  allowBomb: boolean;
  maxSimultaneous: number;
};

export function getWaveSettings(score: number): WaveSettings {
  if (score < 180) {
    return {
      wave: 1,
      title: "Wave 1: 사인의 공습",
      spawnIntervalSec: 2.8,
      meteorSpeed: 38,
      allowTan: false,
      allowBomb: false,
      maxSimultaneous: 2,
    };
  }
  if (score < 420) {
    return {
      wave: 2,
      title: "Wave 2: 코사인과 역방향 교차",
      spawnIntervalSec: 2.3,
      meteorSpeed: 48,
      allowTan: false,
      allowBomb: false,
      maxSimultaneous: 3,
    };
  }
  if (score < 720) {
    return {
      wave: 3,
      title: "Wave 3: 탄젠트 합류 & tan 90° 폭탄 주의!",
      spawnIntervalSec: 1.8,
      meteorSpeed: 58,
      allowTan: true,
      allowBomb: true,
      maxSimultaneous: 4,
    };
  }
  if (score < 1050) {
    return {
      wave: 4,
      title: "Wave 4: 초고속 탄막 세례",
      spawnIntervalSec: 1.4,
      meteorSpeed: 70,
      allowTan: true,
      allowBomb: true,
      maxSimultaneous: 5,
    };
  }

  // Wave 5: 무한 서바이벌 (점점 빨라져 결국 뚫림)
  const over = Math.floor((score - 1050) / 200);
  return {
    wave: 5,
    title: "Wave 5: 종말의 유성우 (SURVIVAL)",
    spawnIntervalSec: Math.max(0.8, 1.2 - over * 0.1),
    meteorSpeed: Math.min(115, 82 + over * 6),
    allowTan: true,
    allowBomb: true,
    maxSimultaneous: 6,
  };
}

let nextMeteorId = 1;

export function createMeteor(
  waveSettings: WaveSettings,
  fieldWidth: number,
): Meteor {
  const allowTan = waveSettings.allowTan;
  const fns: TrigFn[] = allowTan ? ["sin", "cos", "tan", "tan"] : ["sin", "cos"];
  const fn = fns[Math.floor(Math.random() * fns.length)]!;

  let angle: SpecialAngle;
  let isBomb = false;

  if (fn === "tan") {
    // tan 90° 폭탄 출현 확률 (allowBomb일 때 약 18%)
    if (waveSettings.allowBomb && Math.random() < 0.18) {
      angle = 90;
      isBomb = true;
    } else {
      const tanAngles: SpecialAngle[] = [0, 30, 45, 60];
      angle = tanAngles[Math.floor(Math.random() * tanAngles.length)]!;
    }
  } else {
    const sinCosAngles: SpecialAngle[] = [0, 30, 45, 60, 90];
    angle = sinCosAngles[Math.floor(Math.random() * sinCosAngles.length)]!;
  }

  const correctBulletId = getExactTrigBulletId(fn, angle);

  let color = "#38bdf8"; // sin 하늘색
  if (fn === "cos") color = "#c084fc"; // cos 보라색
  if (fn === "tan") color = isBomb ? "#ef4444" : "#34d399"; // tan 에메랄드 / 폭탄 빨간색

  const fnSymbol = fn === "sin" ? "\\sin" : fn === "cos" ? "\\cos" : "\\tan";
  const promptLatex = isBomb ? "\\tan 90^\\circ \\; ☠️" : `${fnSymbol} ${angle}^\\circ`;
  const promptText = isBomb ? "tan 90° ☠️" : `${fn} ${angle}°`;

  // X 좌표는 좌우 패딩을 고려하여 랜덤 배치
  const padding = 60;
  const x = padding + Math.random() * (fieldWidth - padding * 2);
  const vx = (Math.random() - 0.5) * 15; // 미세한 좌우 흔들림

  return {
    id: nextMeteorId++,
    fn,
    angle,
    isBomb,
    correctBulletId,
    promptLatex,
    promptText,
    x,
    y: -30,
    radius: isBomb ? 34 : 30,
    speed: waveSettings.meteorSpeed * (0.9 + Math.random() * 0.25),
    vx,
    spawnTime: performance.now(),
    color,
  };
}

export function calcDestroyScore(
  currentScore: number,
  combo: number,
  isFever: boolean,
  altitudeRatio: number, // 높을수록(일찍 맞힐수록) 추가 보너스
): { newScore: number; gained: number } {
  const base = 25;
  const speedBonus = Math.round(altitudeRatio * 15);
  const comboBonus = Math.min(combo * 2, 20);

  let totalGain = base + speedBonus + comboBonus;
  if (isFever) {
    totalGain = Math.round(totalGain * 1.5);
  }

  const newScore = applyScoreGain(currentScore, totalGain);
  return {
    newScore: Math.min(newScore, SCORE_HARD_MAX),
    gained: totalGain,
  };
}
