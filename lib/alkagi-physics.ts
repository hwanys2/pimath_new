import {
  ALKAGI_BOUND,
  ALKAGI_MAX_SPEED,
  ALKAGI_STONE_RADIUS,
  type AlkagiShot,
  type AlkagiStone,
  type AlkagiStoneColor,
} from "./alkagi-types";

export function createInitialStones(): AlkagiStone[] {
  return [
    // 5 Black stones (bottom: y < 0)
    { id: "b0", color: "black", x: -4, y: -5, alive: true },
    { id: "b1", color: "black", x: -2, y: -6, alive: true },
    { id: "b2", color: "black", x: 0, y: -5, alive: true },
    { id: "b3", color: "black", x: 2, y: -6, alive: true },
    { id: "b4", color: "black", x: 4, y: -5, alive: true },
    // 5 White stones (top: y > 0)
    { id: "w0", color: "white", x: -4, y: 5, alive: true },
    { id: "w1", color: "white", x: -2, y: 6, alive: true },
    { id: "w2", color: "white", x: 0, y: 5, alive: true },
    { id: "w3", color: "white", x: 2, y: 6, alive: true },
    { id: "w4", color: "white", x: 4, y: 5, alive: true },
  ];
}

export function opponentColor(color: AlkagiStoneColor): AlkagiStoneColor {
  return color === "black" ? "white" : "black";
}

/** Calculate initial velocity vector (grid units / second) */
export function getShotVelocity(
  slope: number | null,
  isVertical: boolean,
  direction: "left" | "right",
  power: number,
): { vx: number; vy: number } {
  const clampedPower = Math.max(0.05, Math.min(1.0, power));
  const speed = clampedPower * ALKAGI_MAX_SPEED;

  if (isVertical) {
    // direction "right" = Up (y+), "left" = Down (y-)
    return {
      vx: 0,
      vy: direction === "right" ? speed : -speed,
    };
  }

  const m = slope ?? 0;
  const denom = Math.sqrt(1 + m * m);
  // direction "right" = positive x, "left" = negative x
  const sgn = direction === "right" ? 1 : -1;

  return {
    vx: (sgn / denom) * speed,
    vy: ((sgn * m) / denom) * speed,
  };
}

export type SimulationCollisionEvent = {
  stoneId1: string;
  stoneId2: string;
  x: number;
  y: number;
  speed: number;
};

export type SimulationFrame = {
  t: number;
  stones: {
    id: string;
    x: number;
    y: number;
    alive: boolean;
    falling?: boolean;
    opacity?: number;
    scale?: number;
  }[];
  collisions?: SimulationCollisionEvent[];
};

export type SimulationResult = {
  finalStones: AlkagiStone[];
  frames: SimulationFrame[];
  eliminated: string[];
  gameStatus: "playing" | "black_win" | "white_win" | "draw";
};

/**
 * Deterministic 2D elastic collision & friction simulation.
 * Runs at 120Hz fixed timestep, recording frames at ~60Hz for smooth playback.
 */
export function simulateAlkagiShot(
  initialStones: AlkagiStone[],
  shot: AlkagiShot,
): SimulationResult {
  type SimBody = {
    id: string;
    color: AlkagiStoneColor;
    x: number;
    y: number;
    vx: number;
    vy: number;
    alive: boolean;
    falling: boolean;
    fallTimer: number;
  };

  const bodies: SimBody[] = initialStones.map((s) => ({
    id: s.id,
    color: s.color,
    x: s.x,
    y: s.y,
    vx: 0,
    vy: 0,
    alive: s.alive,
    falling: false,
    fallTimer: 0,
  }));

  const shooter = bodies.find((b) => b.id === shot.stoneId && b.alive);
  if (shooter) {
    const initV = getShotVelocity(
      shot.slope,
      shot.isVertical,
      shot.direction,
      shot.power,
    );
    shooter.vx = initV.vx;
    shooter.vy = initV.vy;
  }

  const DT = 1 / 120; // 120 Hz
  const FRICTION_DECEL = 6.8; // units / s^2
  const RESTITUTION = 0.94; // bounce elasticity
  const STOP_SPEED = 0.12;
  const FALL_DURATION = 0.35; // seconds
  const BOUND = ALKAGI_BOUND + 0.15;

  const frames: SimulationFrame[] = [];
  const eliminated: string[] = [];
  let currentTime = 0;
  let stepIndex = 0;
  const maxSteps = 120 * 7; // up to 7 seconds

  // Record initial frame
  const snapshotFrame = (collisions?: SimulationCollisionEvent[]) => {
    frames.push({
      t: Math.round(currentTime * 1000) / 1000,
      stones: bodies.map((b) => {
        let opacity = 1;
        let scale = 1;
        if (b.falling) {
          const p = Math.min(1, b.fallTimer / FALL_DURATION);
          opacity = Math.max(0, 1 - p);
          scale = Math.max(0.2, 1 - p * 0.6);
        }
        return {
          id: b.id,
          x: Math.round(b.x * 1000) / 1000,
          y: Math.round(b.y * 1000) / 1000,
          alive: b.alive,
          falling: b.falling,
          opacity,
          scale,
        };
      }),
      collisions: collisions && collisions.length > 0 ? collisions : undefined,
    });
  };

  snapshotFrame();

  while (stepIndex < maxSteps) {
    stepIndex++;
    currentTime += DT;
    const collisionsThisStep: SimulationCollisionEvent[] = [];

    // 1. Position update & friction
    let anyMoving = false;
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i]!;
      if (!b.alive && !b.falling) continue;

      if (b.falling) {
        b.fallTimer += DT;
        // Keep slight drifting while falling
        b.x += b.vx * DT;
        b.y += b.vy * DT;
        if (b.fallTimer >= FALL_DURATION) {
          b.alive = false;
          b.falling = false;
          b.vx = 0;
          b.vy = 0;
        } else {
          anyMoving = true;
        }
        continue;
      }

      const spd = Math.hypot(b.vx, b.vy);
      if (spd > 0) {
        anyMoving = true;
        b.x += b.vx * DT;
        b.y += b.vy * DT;

        // Friction deceleration
        const decel = FRICTION_DECEL * DT;
        if (spd <= decel || spd < STOP_SPEED) {
          b.vx = 0;
          b.vy = 0;
        } else {
          const ratio = (spd - decel) / spd;
          b.vx *= ratio;
          b.vy *= ratio;
        }
      }

      // Check boundary (out of bounds)
      if (Math.abs(b.x) > BOUND || Math.abs(b.y) > BOUND) {
        b.falling = true;
        b.fallTimer = 0;
        eliminated.push(b.id);
        anyMoving = true;
      }
    }

    // 2. Collision resolution (between alive, non-falling bodies)
    for (let i = 0; i < bodies.length; i++) {
      const b1 = bodies[i]!;
      if (!b1.alive || b1.falling) continue;

      for (let j = i + 1; j < bodies.length; j++) {
        const b2 = bodies[j]!;
        if (!b2.alive || b2.falling) continue;

        const dx = b2.x - b1.x;
        const dy = b2.y - b1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = ALKAGI_STONE_RADIUS * 2;

        if (dist < minDist && dist > 0.0001) {
          const overlap = minDist - dist;
          const nx = dx / dist;
          const ny = dy / dist;

          // Relative velocity
          const rvx = b1.vx - b2.vx;
          const rvy = b1.vy - b2.vy;
          const velAlongNormal = rvx * nx + rvy * ny;

          if (velAlongNormal > 0) {
            const impulse = ((1 + RESTITUTION) * velAlongNormal) / 2;
            b1.vx -= impulse * nx;
            b1.vy -= impulse * ny;
            b2.vx += impulse * nx;
            b2.vy += impulse * ny;

            collisionsThisStep.push({
              stoneId1: b1.id,
              stoneId2: b2.id,
              x: (b1.x + b2.x) / 2,
              y: (b1.y + b2.y) / 2,
              speed: velAlongNormal,
            });
          }

          // Positional separation to prevent sinking
          const separation = overlap * 0.5;
          b1.x -= nx * separation;
          b1.y -= ny * separation;
          b2.x += nx * separation;
          b2.y += ny * separation;
        }
      }
    }

    // Record every 2nd step (60Hz) or when collisions occur
    if (stepIndex % 2 === 0 || collisionsThisStep.length > 0) {
      snapshotFrame(collisionsThisStep);
    }

    if (!anyMoving) {
      break;
    }
  }

  // Final snapshot
  snapshotFrame();

  const finalStones: AlkagiStone[] = bodies.map((b) => ({
    id: b.id,
    color: b.color,
    x: Math.round(b.x * 100) / 100,
    y: Math.round(b.y * 100) / 100,
    alive: b.alive && !b.falling,
  }));

  const blackAlive = finalStones.filter((s) => s.color === "black" && s.alive).length;
  const whiteAlive = finalStones.filter((s) => s.color === "white" && s.alive).length;

  let gameStatus: "playing" | "black_win" | "white_win" | "draw" = "playing";
  if (blackAlive === 0 && whiteAlive === 0) {
    gameStatus = "draw";
  } else if (whiteAlive === 0) {
    gameStatus = "black_win";
  } else if (blackAlive === 0) {
    gameStatus = "white_win";
  }

  return {
    finalStones,
    frames,
    eliminated,
    gameStatus,
  };
}

/** Calculate slope from two coordinates (for click/drag aiming) */
export function calculateSlopeFromPoints(
  from: { x: number; y: number },
  to: { x: number; y: number },
): {
  slope: number | null;
  isVertical: boolean;
  direction: "left" | "right";
} {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  if (Math.abs(dx) < 0.08) {
    return {
      slope: null,
      isVertical: true,
      direction: dy >= 0 ? "right" : "left", // right = up (+y), left = down (-y)
    };
  }

  const rawSlope = dy / dx;
  // Snap to clean numbers if close to round numbers/fractions
  const slope = Math.round(rawSlope * 100) / 100;
  return {
    slope,
    isVertical: false,
    direction: dx >= 0 ? "right" : "left",
  };
}

/** Format slope label e.g. "m = 2" or "수직 (y축 평행)" */
export function formatSlopeLabel(
  slope: number | null,
  isVertical: boolean,
): string {
  if (isVertical) return "수직 (y축 평행)";
  if (slope == null) return "0";
  if (Number.isInteger(slope)) return `${slope}`;
  return `${slope}`;
}

/** Get equation of line passing through (x0, y0) with slope m */
export function getLinearEquation(
  from: { x: number; y: number },
  slope: number | null,
  isVertical: boolean,
): {
  formula: string;
  slopeIntercept: string;
} {
  if (isVertical) {
    return {
      formula: `x = ${from.x}`,
      slopeIntercept: `x = ${from.x}`,
    };
  }

  const m = slope ?? 0;
  const b = from.y - m * from.x;
  const roundedB = Math.round(b * 100) / 100;

  // y - y0 = m(x - x0)
  const y0Str = from.y >= 0 ? `y - ${from.y}` : `y + ${Math.abs(from.y)}`;
  const x0Str = from.x >= 0 ? `x - ${from.x}` : `x + ${Math.abs(from.x)}`;
  const formula = `${y0Str} = ${m}(${x0Str})`;

  // y = mx + b
  let bStr = "";
  if (roundedB > 0) bStr = ` + ${roundedB}`;
  else if (roundedB < 0) bStr = ` - ${Math.abs(roundedB)}`;

  const mStr = m === 1 ? "x" : m === -1 ? "-x" : m === 0 ? "" : `${m}x`;
  const slopeIntercept = m === 0 ? `y = ${roundedB}` : `y = ${mStr}${bStr}`;

  return { formula, slopeIntercept };
}

/**
 * AI Shot Selector:
 * Evaluates candidate shots against living opponent stones and picks
 * the highest scoring shot (knocking opponents out without self-elimination).
 */
export function chooseAiAlkagiShot(
  stones: AlkagiStone[],
  aiColor: AlkagiStoneColor,
): AlkagiShot {
  const myStones = stones.filter((s) => s.color === aiColor && s.alive);
  const oppColor = opponentColor(aiColor);
  const oppStones = stones.filter((s) => s.color === oppColor && s.alive);

  if (myStones.length === 0) {
    return {
      stoneId: "w0",
      slope: 0,
      isVertical: false,
      direction: "left",
      power: 0.5,
    };
  }

  type Candidate = {
    shot: AlkagiShot;
    score: number;
  };

  const candidates: Candidate[] = [];

  // For each of our stones, try aiming at each opponent stone
  for (const myStone of myStones) {
    for (const oppStone of oppStones) {
      const aim = calculateSlopeFromPoints(myStone, oppStone);
      const dist = Math.hypot(oppStone.x - myStone.x, oppStone.y - myStone.y);

      // Try varying powers based on distance
      // Approximate power needed: speed proportional to dist
      const basePower = Math.min(0.95, Math.max(0.35, dist / 14 + 0.25));
      const testPowers = [
        Math.max(0.3, basePower - 0.15),
        basePower,
        Math.min(1.0, basePower + 0.18),
      ];

      for (const p of testPowers) {
        // Add small variance to simulate realistic aim
        const shot: AlkagiShot = {
          stoneId: myStone.id,
          slope: aim.slope,
          isVertical: aim.isVertical,
          direction: aim.direction,
          power: Math.round(p * 100) / 100,
        };

        const sim = simulateAlkagiShot(stones, shot);

        let score = 0;
        // Reward opponent elimination
        for (const elimId of sim.eliminated) {
          const elim = stones.find((s) => s.id === elimId);
          if (elim?.color === oppColor) {
            score += 1500;
          } else if (elim?.color === aiColor) {
            score -= 1000;
          }
        }

        // Reward remaining my stones
        const myRemaining = sim.finalStones.filter(
          (s) => s.color === aiColor && s.alive,
        ).length;
        score += myRemaining * 200;

        // Reward pushing opponent closer to edges
        for (const fin of sim.finalStones) {
          if (fin.color === oppColor && fin.alive) {
            const edgeDist = Math.min(
              ALKAGI_BOUND - Math.abs(fin.x),
              ALKAGI_BOUND - Math.abs(fin.y),
            );
            if (edgeDist < 2.5) {
              score += (2.5 - edgeDist) * 120;
            }
          }
        }

        // Slight randomness to avoid repetitive behavior
        score += Math.random() * 80;

        candidates.push({ shot, score });
      }
    }
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => b.score - a.score);
    const topCandidate = candidates[0]!.shot;
    // Add realistic minor human imperfection:
    if (topCandidate.slope != null && !topCandidate.isVertical) {
      const error = (Math.random() - 0.5) * 0.08;
      topCandidate.slope = Math.round((topCandidate.slope + error) * 100) / 100;
    }
    return topCandidate;
  }

  // Fallback random shot
  const randomStone = myStones[Math.floor(Math.random() * myStones.length)]!;
  return {
    stoneId: randomStone.id,
    slope: Math.round((Math.random() * 4 - 2) * 10) / 10,
    isVertical: false,
    direction: Math.random() > 0.5 ? "right" : "left",
    power: 0.6,
  };
}
