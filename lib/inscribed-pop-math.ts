/**
 * Mathematical calculations and physical simulation for "Inscribed Angle Pop" (원주각 팡팡).
 * Unit: Grade 3, Unit 3.2 (원의 성질 - 원주각).
 * Theme: Middle 3rd Grade "별빛의 현자" (Sage of Starlight).
 */

export const CONTENT_KEY = "g3-u3-2-inscribed-pop";

export const BOARD_WIDTH = 600;
export const BOARD_HEIGHT = 580;
export const CIRCLE_CENTER_X = 300;
export const CIRCLE_CENTER_Y = 280;
export const CIRCLE_RADIUS = 230;

export const START_SHOTS = 8;
export const MAX_SHOTS = 10;
export const FEVER_COMBO_COUNT = 5;

export interface Point2D {
  x: number;
  y: number;
}

export type PegType =
  | "target"   // Orange star-slime: Must clear all of these to beat the round
  | "bonus"    // Blue slime: Extra points and combo booster
  | "armored"  // Gold slime with 90° shield: Only takes damage from 90° Thales shot!
  | "center";  // Center Sun Peg: Triggers 2X Central Angle split!

export interface SlimePeg {
  id: string;
  type: PegType;
  x: number;
  y: number;
  radius: number;
  hp: number;
  maxHp: number;
  bobPhase: number;
  scoreValue: number;
  popped: boolean;
}

export interface BouncingBall {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  bouncesLeft: number;
  isThales90: boolean;
  isCenterOvercharge: boolean;
  alive: boolean;
}

export interface RoundConfig {
  round: number;
  title: string;
  subtitle: string;
  tip: string;
  mathFormula: string;
  defaultAngleA: number;
  defaultAngleB: number;
  defaultAngleP: number;
  hasCenterPeg: boolean;
  scoreClearBonus: number;
}

/** Convert degrees to radians */
export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Convert radians to degrees */
export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/** Normalize angle in radians to [0, 2pi) */
export function normalizeAngle(rad: number): number {
  const twoPi = Math.PI * 2;
  let a = rad % twoPi;
  if (a < 0) a += twoPi;
  return a;
}

/** Get coordinate on circle circumference */
export function getCirclePoint(
  angleRad: number,
  radius = CIRCLE_RADIUS,
  cx = CIRCLE_CENTER_X,
  cy = CIRCLE_CENTER_Y,
): Point2D {
  return {
    x: cx + radius * Math.cos(angleRad),
    y: cy + radius * Math.sin(angleRad),
  };
}

/** Distance between two points */
export function distance(p1: Point2D, p2: Point2D): number {
  return Math.hypot(p1.x - p2.x, p1.y - p2.y);
}

/**
 * Calculate the inscribed angle subtended by chord AB at vertex P in degrees.
 * Returns angle in degrees [0, 180].
 */
export function calcInscribedAngle(p: Point2D, a: Point2D, b: Point2D): number {
  const vPA = { x: a.x - p.x, y: a.y - p.y };
  const vPB = { x: b.x - p.x, y: b.y - p.y };

  const dot = vPA.x * vPB.x + vPA.y * vPB.y;
  const magPA = Math.hypot(vPA.x, vPA.y);
  const magPB = Math.hypot(vPB.x, vPB.y);

  if (magPA < 1e-4 || magPB < 1e-4) return 0;
  const cosTheta = Math.max(-1, Math.min(1, dot / (magPA * magPB)));
  return radToDeg(Math.acos(cosTheta));
}

/**
 * Calculate central angle subtended by chord AB at center O in degrees.
 * Theorem: Central angle = 2 * Inscribed angle.
 */
export function calcCentralAngle(
  a: Point2D,
  b: Point2D,
  center: Point2D = { x: CIRCLE_CENTER_X, y: CIRCLE_CENTER_Y },
): number {
  const vOA = { x: a.x - center.x, y: a.y - center.y };
  const vOB = { x: b.x - center.x, y: b.y - center.y };

  const dot = vOA.x * vOB.x + vOA.y * vOB.y;
  const magOA = Math.hypot(vOA.x, vOA.y);
  const magOB = Math.hypot(vOB.x, vOB.y);

  if (magOA < 1e-4 || magOB < 1e-4) return 0;
  const cosTheta = Math.max(-1, Math.min(1, dot / (magOA * magOB)));
  return radToDeg(Math.acos(cosTheta));
}

/**
 * Check if line AB is a diameter of the circle (passes through center within tolerance).
 * If AB is a diameter, any point P on semicircle forms a 90° right angle (Thales Theorem).
 */
export function isDiameter(
  angleA: number,
  angleB: number,
  toleranceDeg = 10,
): { isDiameter: boolean; diffDeg: number } {
  const diffRad = Math.abs(normalizeAngle(angleA - angleB));
  const normalizedDiff = Math.min(diffRad, Math.PI * 2 - diffRad);
  const diffFromPi = Math.abs(normalizedDiff - Math.PI);
  const diffDeg = radToDeg(diffFromPi);
  return {
    isDiameter: diffDeg <= toleranceDeg,
    diffDeg,
  };
}

/** Snap angleB to exact opposite diameter of angleA if within tolerance */
export function snapToDiameter(angleA: number, angleB: number, toleranceDeg = 14): number {
  const { isDiameter: ok } = isDiameter(angleA, angleB, toleranceDeg);
  if (ok) {
    return normalizeAngle(angleA + Math.PI);
  }
  return angleB;
}

export const ROUNDS: RoundConfig[] = [
  {
    round: 1,
    title: "Round 1: 트윈 볼의 비밀",
    subtitle: "동일한 호를 바라보는 원주각은 항상 같다!",
    tip: "원 위 어디로 발사대를 옮겨도 두 볼 사이의 각도는 변하지 않아요!",
    mathFormula: "\\angle\\text{APB} = \\text{일정 (동일한 호)}",
    defaultAngleA: degToRad(30),
    defaultAngleB: degToRad(120),
    defaultAngleP: degToRad(270),
    hasCenterPeg: false,
    scoreClearBonus: 180,
  },
  {
    round: 2,
    title: "Round 2: 탈레스의 90° 직각 샷",
    subtitle: "지름에 대한 원주각은 항상 90° 직각!",
    tip: "두 핀 AB를 지름으로 연결하면 무조건 90도 직각으로 발사되어 황금 방패를 깰 수 있어요!",
    mathFormula: "\\text{지름에 대한 원주각 } \\angle\\text{APB} = 90^\\circ",
    defaultAngleA: degToRad(20),
    defaultAngleB: degToRad(170), // slightly off to invite snap
    defaultAngleP: degToRad(95),
    hasCenterPeg: false,
    scoreClearBonus: 220,
  },
  {
    round: 3,
    title: "Round 3: 태양의 중심각 (2배 버스트)",
    subtitle: "중심각의 크기는 원주각의 정확히 2배!",
    tip: "가운데 태양 페그 O를 맞히면 각도가 2배로 넓어지며 멀티볼이 폭발해요!",
    mathFormula: "\\angle\\text{AOB} = 2 \\times \\angle\\text{APB}",
    defaultAngleA: degToRad(40),
    defaultAngleB: degToRad(130),
    defaultAngleP: degToRad(270),
    hasCenterPeg: true,
    scoreClearBonus: 240,
  },
  {
    round: 4,
    title: "Round 4: 황금 아치 콤보",
    subtitle: "호의 길이가 길어지면 원주각도 정비례해서 넓어진다!",
    tip: "핀 A, B 사이를 벌리면 원주각도 커져서 더 넓은 범위를 커버할 수 있어요!",
    mathFormula: "l \\propto \\angle\\text{APB} \\text{ (호의 길이와 원주각은 정비례)}",
    defaultAngleA: degToRad(45),
    defaultAngleB: degToRad(105),
    defaultAngleP: degToRad(270),
    hasCenterPeg: true,
    scoreClearBonus: 260,
  },
  {
    round: 5,
    title: "Round 5: 킹 슬라임의 별빛 결계",
    subtitle: "원주각의 모든 법칙을 마스터하라!",
    tip: "90도 직각과 2배 중심각을 총동원해 킹 슬라임의 결계를 격파하세요!",
    mathFormula: "\\angle\\text{APB} = \\frac{1}{2}\\angle\\text{AOB}, \\; 90^\\circ \\text{ Thales}",
    defaultAngleA: degToRad(25),
    defaultAngleB: degToRad(205),
    defaultAngleP: degToRad(115),
    hasCenterPeg: true,
    scoreClearBonus: 300,
  },
];

/**
 * Generate slime pegs for a round
 */
export function createRoundPegs(roundNum: number): SlimePeg[] {
  const pegs: SlimePeg[] = [];

  if (roundNum === 1) {
    // Round 1: Target orange slimes and bonus blue slimes in arc clusters
    const targetAngles = [0.7, 1.1, 1.5, 1.9, 2.3];
    targetAngles.forEach((ang, i) => {
      pegs.push({
        id: `r1-t-${i}`,
        type: "target",
        x: CIRCLE_CENTER_X + 130 * Math.cos(ang),
        y: CIRCLE_CENTER_Y + 130 * Math.sin(ang),
        radius: 18,
        hp: 1,
        maxHp: 1,
        bobPhase: i * 0.8,
        scoreValue: 40,
        popped: false,
      });
    });

    const bonusAngles = [3.8, 4.4, 5.2, 5.8];
    bonusAngles.forEach((ang, i) => {
      pegs.push({
        id: `r1-b-${i}`,
        type: "bonus",
        x: CIRCLE_CENTER_X + 120 * Math.cos(ang),
        y: CIRCLE_CENTER_Y + 120 * Math.sin(ang),
        radius: 15,
        hp: 1,
        maxHp: 1,
        bobPhase: i * 1.2,
        scoreValue: 20,
        popped: false,
      });
    });
  } else if (roundNum === 2) {
    // Round 2: Armored gold slimes with 90° shields + targets
    const armoredAngles = [0.8, 2.4];
    armoredAngles.forEach((ang, i) => {
      pegs.push({
        id: `r2-armored-${i}`,
        type: "armored",
        x: CIRCLE_CENTER_X + 140 * Math.cos(ang),
        y: CIRCLE_CENTER_Y + 140 * Math.sin(ang),
        radius: 22,
        hp: 1,
        maxHp: 1,
        bobPhase: i * 1.5,
        scoreValue: 80,
        popped: false,
      });
    });

    const targetAngles = [3.6, 4.2, 5.0, 5.6];
    targetAngles.forEach((ang, i) => {
      pegs.push({
        id: `r2-t-${i}`,
        type: "target",
        x: CIRCLE_CENTER_X + 100 * Math.cos(ang),
        y: CIRCLE_CENTER_Y + 100 * Math.sin(ang),
        radius: 18,
        hp: 1,
        maxHp: 1,
        bobPhase: i * 0.9,
        scoreValue: 40,
        popped: false,
      });
    });
  } else if (roundNum === 3) {
    // Round 3: Center Sun Peg + Ring of Target Slimes
    pegs.push({
      id: "center-sun",
      type: "center",
      x: CIRCLE_CENTER_X,
      y: CIRCLE_CENTER_Y,
      radius: 24,
      hp: 999, // permanent trigger
      maxHp: 999,
      bobPhase: 0,
      scoreValue: 50,
      popped: false,
    });

    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      pegs.push({
        id: `r3-t-${i}`,
        type: "target",
        x: CIRCLE_CENTER_X + 135 * Math.cos(ang),
        y: CIRCLE_CENTER_Y + 135 * Math.sin(ang),
        radius: 17,
        hp: 1,
        maxHp: 1,
        bobPhase: i * 0.7,
        scoreValue: 35,
        popped: false,
      });
    }
  } else if (roundNum === 4) {
    // Round 4: Dense clusters requiring wide arc
    for (let r = 70; r <= 150; r += 40) {
      const count = r === 70 ? 4 : r === 110 ? 6 : 8;
      for (let i = 0; i < count; i++) {
        const ang = (i / count) * Math.PI * 2;
        const isTarget = (i + r) % 3 === 0;
        pegs.push({
          id: `r4-peg-${r}-${i}`,
          type: isTarget ? "target" : "bonus",
          x: CIRCLE_CENTER_X + r * Math.cos(ang),
          y: CIRCLE_CENTER_Y + r * Math.sin(ang),
          radius: 16,
          hp: 1,
          maxHp: 1,
          bobPhase: i * 0.5,
          scoreValue: isTarget ? 40 : 20,
          popped: false,
        });
      }
    }
  } else {
    // Round 5+: Grand Boss Arena with armored slimes and center peg
    pegs.push({
      id: "center-sun-5",
      type: "center",
      x: CIRCLE_CENTER_X,
      y: CIRCLE_CENTER_Y,
      radius: 26,
      hp: 999,
      maxHp: 999,
      bobPhase: 0,
      scoreValue: 60,
      popped: false,
    });

    const armAngles = [0.4, 1.8, 3.6, 5.0];
    armAngles.forEach((ang, i) => {
      pegs.push({
        id: `r5-arm-${i}`,
        type: "armored",
        x: CIRCLE_CENTER_X + 140 * Math.cos(ang),
        y: CIRCLE_CENTER_Y + 140 * Math.sin(ang),
        radius: 22,
        hp: 1,
        maxHp: 1,
        bobPhase: i,
        scoreValue: 70,
        popped: false,
      });
    });

    const targetAngles = [1.0, 1.4, 2.7, 3.1, 4.3, 4.7];
    targetAngles.forEach((ang, i) => {
      pegs.push({
        id: `r5-t-${i}`,
        type: "target",
        x: CIRCLE_CENTER_X + 90 * Math.cos(ang),
        y: CIRCLE_CENTER_Y + 90 * Math.sin(ang),
        radius: 17,
        hp: 1,
        maxHp: 1,
        bobPhase: i * 0.8,
        scoreValue: 45,
        popped: false,
      });
    });
  }

  return pegs;
}

export const DEFAULT_BALL_SPEED = 480;
export const DEFAULT_GRAVITY = 160;
export const DEFAULT_MAX_BOUNCES = 9;
export const BALL_RADIUS = 7;

/**
 * Launch twin balls from point P towards pins A and B.
 */
export function launchTwinBalls(
  p: Point2D,
  a: Point2D,
  b: Point2D,
  isThales90 = false,
  speed = DEFAULT_BALL_SPEED,
  seed = 0,
): BouncingBall[] {
  const distA = Math.hypot(a.x - p.x, a.y - p.y) || 1;
  const distB = Math.hypot(b.x - p.x, b.y - p.y) || 1;

  const vxA = ((a.x - p.x) / distA) * speed;
  const vyA = ((a.y - p.y) / distA) * speed;

  const vxB = ((b.x - p.x) / distB) * speed;
  const vyB = ((b.y - p.y) / distB) * speed;

  return [
    {
      id: `ball-a-${seed}-1`,
      x: p.x,
      y: p.y,
      vx: vxA,
      vy: vyA,
      radius: BALL_RADIUS,
      bouncesLeft: DEFAULT_MAX_BOUNCES,
      isThales90,
      isCenterOvercharge: false,
      alive: true,
    },
    {
      id: `ball-b-${seed}-2`,
      x: p.x,
      y: p.y,
      vx: vxB,
      vy: vyB,
      radius: BALL_RADIUS,
      bouncesLeft: DEFAULT_MAX_BOUNCES,
      isThales90,
      isCenterOvercharge: false,
      alive: true,
    },
  ];
}

/**
 * Update single ball position by dt seconds with gravity
 */
export function stepBallPosition(
  ball: BouncingBall,
  dt: number,
  gravity = DEFAULT_GRAVITY,
): void {
  if (!ball.alive) return;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
  ball.vy += gravity * dt;
}

/**
 * Bounce ball off circle outer wall. Returns true if bounce occurred.
 */
export function bounceOffCircleWall(
  ball: BouncingBall,
  cx = CIRCLE_CENTER_X,
  cy = CIRCLE_CENTER_Y,
  radius = CIRCLE_RADIUS,
  restitution = 0.92,
): boolean {
  if (!ball.alive) return false;
  const dx = ball.x - cx;
  const dy = ball.y - cy;
  const dist = Math.hypot(dx, dy);

  if (dist + ball.radius >= radius) {
    const nx = -dx / (dist || 1);
    const ny = -dy / (dist || 1);

    const dot = ball.vx * nx + ball.vy * ny;
    if (dot < 0) {
      // Moving outward, reflect
      ball.vx = ball.vx - (1 + restitution) * dot * nx;
      ball.vy = ball.vy - (1 + restitution) * dot * ny;

      // Clamp position inside circle
      const targetDist = radius - ball.radius - 0.5;
      ball.x = cx + (dx / (dist || 1)) * targetDist;
      ball.y = cy + (dy / (dist || 1)) * targetDist;

      ball.bouncesLeft -= 1;
      if (ball.bouncesLeft <= 0) {
        ball.alive = false;
      }
      return true;
    }
  }
  return false;
}

export type PegHitResult = "popped" | "damaged" | "shielded" | "center_overcharge" | "miss";

/**
 * Handle ball collision with a slime peg
 */
export function checkAndResolvePegHit(
  ball: BouncingBall,
  peg: SlimePeg,
  restitution = 0.88,
): PegHitResult {
  if (!ball.alive || peg.popped) return "miss";

  const dx = ball.x - peg.x;
  const dy = ball.y - peg.y;
  const dist = Math.hypot(dx, dy);
  const minDist = ball.radius + peg.radius;

  if (dist <= minDist) {
    const nx = dx / (dist || 1);
    const ny = dy / (dist || 1);

    const dot = ball.vx * nx + ball.vy * ny;
    if (dot < 0) {
      // Moving into peg: bounce out
      ball.vx = ball.vx - (1 + restitution) * dot * nx;
      ball.vy = ball.vy - (1 + restitution) * dot * ny;

      ball.x = peg.x + nx * (minDist + 0.5);
      ball.y = peg.y + ny * (minDist + 0.5);

      if (peg.type === "center") {
        ball.isCenterOvercharge = true;
        return "center_overcharge";
      }

      if (peg.type === "armored" && !ball.isThales90) {
        // Shield deflected the shot! Needs 90° Thales shot
        return "shielded";
      }

      peg.hp -= 1;
      if (peg.hp <= 0) {
        peg.popped = true;
        return "popped";
      }
      return "damaged";
    }
  }

  return "miss";
}

/**
 * Check whether all required pegs in a round are cleared.
 */
export function isRoundCleared(pegs: SlimePeg[]): boolean {
  return pegs
    .filter((p) => p.type === "target" || p.type === "armored")
    .every((p) => p.popped);
}

