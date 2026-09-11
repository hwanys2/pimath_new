import { SCORE_SOFT_CAP, SCORE_HARD_MAX, applyScoreGain } from "@/lib/xp";

export const START_LIVES = 3;
export const MAX_LIVES = 3;

export type Difficulty = {
  stage: number;
  stageName: string;
  gridRange: number; // e.g. 5 means -5 to 5
  fuseSeconds: number; // countdown time for each bomb
  maxActiveBombs: number; // how many bombs can exist simultaneously
  spawnIntervalSec: number;
  basePoints: number;
};

export type ActiveBomb = {
  id: number;
  x: number;
  y: number;
  totalFuse: number;
  fuseLeft: number; // seconds remaining
  spawnedAt: number;
  isUrgent?: boolean;
};

export type BombExplosion = {
  id: number;
  x: number;
  y: number;
  kind: "defused" | "detonated" | "miss";
  label?: string;
  until: number;
};

/**
 * Determine difficulty based on number of defused bombs and elapsed time.
 */
export function getDifficulty(defused: number, elapsedSec: number): Difficulty {
  if (defused < 5) {
    return {
      stage: 1,
      stageName: "기초 훈련",
      gridRange: 4,
      fuseSeconds: 6.5,
      maxActiveBombs: 1,
      spawnIntervalSec: 2.8,
      basePoints: 50,
    };
  }
  if (defused < 12) {
    return {
      stage: 2,
      stageName: "실전 작전",
      gridRange: 5,
      fuseSeconds: 5.2,
      maxActiveBombs: 1,
      spawnIntervalSec: 2.4,
      basePoints: 60,
    };
  }
  if (defused < 22) {
    return {
      stage: 3,
      stageName: "신속 대응",
      gridRange: 6,
      fuseSeconds: 4.4,
      maxActiveBombs: 2,
      spawnIntervalSec: 2.0,
      basePoints: 70,
    };
  }
  if (defused < 35) {
    return {
      stage: 4,
      stageName: "비상 태세",
      gridRange: 7,
      fuseSeconds: 3.7,
      maxActiveBombs: 2,
      spawnIntervalSec: 1.8,
      basePoints: 80,
    };
  }

  // Endless / Overclock mode
  const over = defused - 35;
  const accel = Math.min(1.2, over * 0.04 + elapsedSec * 0.002);
  const fuseSeconds = Math.max(2.4, 3.5 - accel);
  const spawnIntervalSec = Math.max(1.4, 1.7 - accel * 0.2);

  return {
    stage: 5 + Math.floor(over / 15),
    stageName: "한계 돌파",
    gridRange: 7,
    fuseSeconds,
    maxActiveBombs: 3,
    spawnIntervalSec,
    basePoints: 90,
  };
}

/**
 * Generate a random coordinate within [-gridRange, gridRange].
 * Ensures it doesn't collide with existing active bombs.
 * Gives good variety (quadrants, axis points (x, 0), (0, y), origin).
 */
export function spawnBombCoordinate(
  gridRange: number,
  existingBombs: ActiveBomb[],
): { x: number; y: number } {
  const existingSet = new Set(existingBombs.map((b) => `${b.x},${b.y}`));

  // Try up to 30 times for a non-overlapping spot
  for (let attempt = 0; attempt < 30; attempt++) {
    // 15% chance of picking an axis point (y=0 or x=0 or (0,0)) to train axis reading!
    let x: number;
    let y: number;

    const r = Math.random();
    if (r < 0.15) {
      if (Math.random() < 0.5) {
        // on x-axis
        x = getRandomInt(-gridRange, gridRange);
        y = 0;
      } else {
        // on y-axis
        x = 0;
        y = getRandomInt(-gridRange, gridRange);
      }
    } else {
      // Pick random integer in [-gridRange, gridRange], preferably non-zero
      x = getRandomInt(-gridRange, gridRange);
      y = getRandomInt(-gridRange, gridRange);
    }

    const key = `${x},${y}`;
    if (!existingSet.has(key)) {
      return { x, y };
    }
  }

  // Fallback: systematic search
  for (let r = 1; r <= gridRange; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        if (!existingSet.has(`${dx},${dy}`)) {
          return { x: dx, y: dy };
        }
      }
    }
  }

  return { x: 0, y: 0 };
}

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Calculate points gained for defusing a bomb.
 * - base points from difficulty
 * - combo multiplier bonus (+10% per combo up to +100%)
 * - emergency clutch bonus (+25 pts if fuseLeft < 1.5s)
 */
export function calculateDefuseScore(
  basePoints: number,
  combo: number,
  fuseLeft: number,
): { totalGain: number; isClutch: boolean; comboBonus: number } {
  const isClutch = fuseLeft <= 1.5;
  const comboMultiplier = Math.min(1.0, (combo - 1) * 0.1); // up to +100%
  const comboBonus = Math.round(basePoints * Math.max(0, comboMultiplier));
  const clutchBonus = isClutch ? 25 : 0;

  const totalGain = basePoints + comboBonus + clutchBonus;
  return { totalGain, isClutch, comboBonus };
}

/**
 * Format quadrant name for an ordered pair.
 */
export function getQuadrantName(x: number, y: number): string {
  if (x === 0 && y === 0) return "원점 (0, 0)";
  if (y === 0) return `x축 위의 점 (${x}, 0)`;
  if (x === 0) return `y축 위의 점 (0, ${y})`;
  if (x > 0 && y > 0) return "제1사분면 (+, +)";
  if (x < 0 && y > 0) return "제2사분면 (-, +)";
  if (x < 0 && y < 0) return "제3사분면 (-, -)";
  return "제4사분면 (+, -)";
}

export { SCORE_SOFT_CAP, SCORE_HARD_MAX, applyScoreGain };
