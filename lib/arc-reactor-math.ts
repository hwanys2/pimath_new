/**
 * Mathematical calculations and game model for "Arc Reactor: Neon Orbital".
 * Unit: Grade 3, Unit 3.2 (원의 성질 - 원주각).
 */

export const CONTENT_KEY = "g3-u3-2-arc-reactor";

export const CANVAS_SIZE = 640;
export const CENTER_X = 320;
export const CENTER_Y = 310;
export const REACTOR_RADIUS = 230;

export const START_LIVES = 3;
export const MAX_LIVES = 3;
export const FEVER_COMBO_THRESHOLD = 5;

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

/** Get coordinate on reactor circumference from angle in radians */
export function getCirclePoint(angleRad: number, radius = REACTOR_RADIUS, cx = CENTER_X, cy = CENTER_Y): { x: number; y: number } {
  return {
    x: cx + radius * Math.cos(angleRad),
    y: cy + radius * Math.sin(angleRad),
  };
}

/** Calculate distance between two 2D points */
export function distance(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
  return Math.hypot(p1.x - p2.x, p1.y - p2.y);
}

/**
 * Calculate the inscribed angle subtended by chord AB at vertex P in degrees.
 * Returns angle in degrees [0, 180].
 */
export function calcInscribedAngle(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
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
 * Calculate the central angle subtended by chord AB at center O in degrees.
 * Returns central angle in degrees [0, 180].
 */
export function calcCentralAngle(
  a: { x: number; y: number },
  b: { x: number; y: number },
  center = { x: CENTER_X, y: CENTER_Y },
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
 * Check if AB is a diameter (passes through center O within degree tolerance).
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

/** Snap angleB to be exact diameter opposite of angleA if within tolerance */
export function snapToDiameter(angleA: number, angleB: number, toleranceDeg = 12): number {
  const { isDiameter: ok } = isDiameter(angleA, angleB, toleranceDeg);
  if (ok) {
    return normalizeAngle(angleA + Math.PI);
  }
  return angleB;
}

/**
 * Enemy & Target types
 */
export type TargetType =
  | "dark_core"      // General target behind spinning aperture (Glide Aim)
  | "armor_cube"     // Heavy armored cube: destroyed ONLY by 90° Thales Blade
  | "swarm_parasite" // Swarm parasite: fast & numerous, vaporized by Core 2x Flare
  | "boss";          // Chaos Singularity boss

export interface Target {
  id: string;
  type: TargetType;
  x: number;
  y: number;
  radius: number;
  hp: number;
  maxHp: number;
  angle: number;       // polar angle from center
  dist: number;        // distance from center
  speed: number;       // angular or radial speed
  shieldAperture?: {
    startAngle: number;
    sizeAngle: number; // width in radians
    rotSpeed: number;
  };
  alive: boolean;
  scoreValue: number;
}

export interface Barrier {
  id: string;
  radius: number;
  thickness: number;
  apertureCenter: number; // angle in radians
  apertureWidth: number;  // angle width in radians
  rotSpeed: number;
}

export type GameMode = "glide" | "thales" | "overcharge" | "cyclic";

export interface WaveConfig {
  waveNumber: number;
  title: string;
  subtitle: string;
  recommendedMode: GameMode;
  description: string;
  mathHint: string;
  requiredKills: number;
  targetCount: number;
  hasBarrier: boolean;
  scoreBonus: number;
}

export const WAVE_CONFIGS: WaveConfig[] = [
  {
    waveNumber: 1,
    title: "Wave 1: 글라이드 에임",
    subtitle: "동일한 호에 대한 원주각의 불변성",
    recommendedMode: "glide",
    description: "회전하는 방어벽의 틈새로 원 위의 점 P를 미끄러뜨려 다크 코어 5체를 저격하세요!",
    mathHint: "점 P를 어디로 옮겨도 같은 호 AB를 바라보는 원주각 θ는 절대 변하지 않습니다.",
    requiredKills: 5,
    targetCount: 5,
    hasBarrier: true,
    scoreBonus: 160,
  },
  {
    waveNumber: 2,
    title: "Wave 2: 탈레스 90° 블레이드",
    subtitle: "지름에 대한 원주각은 항상 90°",
    recommendedMode: "thales",
    description: "지름 AB를 만들어 90° 직각 수직 블레이드로 직각 아머 큐브 6체를 일도양단하세요!",
    mathHint: "선분 AB가 원의 중심을 지나는 지름일 때, 원 위의 점 P에서 이루는 원주각은 무조건 90° 직각입니다.",
    requiredKills: 6,
    targetCount: 6,
    hasBarrier: false,
    scoreBonus: 200,
  },
  {
    waveNumber: 3,
    title: "Wave 3: 코어 오버차지 2X",
    subtitle: "중심각의 크기는 원주각의 2배",
    recommendedMode: "overcharge",
    description: "중심 코어 O를 가동해 각도를 2배(2θ)로 폭발 확장시켜 다크 스웜 24마리를 일망타진하세요!",
    mathHint: "한 호에 대한 중심각의 크기(2θ)는 원주각(θ)의 정확히 2배입니다.",
    requiredKills: 20,
    targetCount: 24,
    hasBarrier: false,
    scoreBonus: 240,
  },
  {
    waveNumber: 4,
    title: "Wave 4: 사이클릭 180° 노바",
    subtitle: "원에 내접하는 사각형 대각의 합은 180°",
    recommendedMode: "cyclic",
    description: "원 둘레에 4개 노드를 배치해 내접사각형을 닫고, 180° 대각 공명 노바로 엘리트 4체를 소멸시키세요!",
    mathHint: "원에 내접하는 사각형에서 마주 보는 두 대각의 합은 항상 180°(보각)입니다.",
    requiredKills: 4,
    targetCount: 4,
    hasBarrier: false,
    scoreBonus: 200,
  },
  {
    waveNumber: 5,
    title: "Wave 5: 카오스 싱귤래리티",
    subtitle: "원주각의 모든 법칙으로 보스를 격파하라",
    recommendedMode: "glide",
    description: "4대 기하 법칙을 자유자재로 전환하여 폭주하는 카오스 코어 보스를 격파하세요!",
    mathHint: "직각 아머엔 탈레스 90°, 스웜 소환엔 코어 2X, 전멸기엔 사이클릭 180°로 카운터!",
    requiredKills: 1,
    targetCount: 1,
    hasBarrier: true,
    scoreBonus: 200,
  },
];

/** Check if point is inside circular sector */
export function isPointInSector(
  px: number,
  py: number,
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number,
): boolean {
  const d = Math.hypot(px - cx, py - cy);
  if (d > radius) return false;

  let angle = Math.atan2(py - cy, px - cx);
  if (angle < 0) angle += Math.PI * 2;

  const s = normalizeAngle(startAngle);
  const e = normalizeAngle(endAngle);

  if (s <= e) {
    return angle >= s && angle <= e;
  } else {
    // Sector wraps around 0
    return angle >= s || angle <= e;
  }
}

/** Check line segment intersection with circle */
export function lineIntersectsCircle(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  c: { x: number; y: number },
  r: number,
): boolean {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return distance(p1, c) <= r;

  // Project c onto line segment p1-p2
  const t = Math.max(0, Math.min(1, ((c.x - p1.x) * dx + (c.y - p1.y) * dy) / lenSq));
  const projX = p1.x + t * dx;
  const projY = p1.y + t * dy;

  return Math.hypot(c.x - projX, c.y - projY) <= r;
}

/**
 * Generate targets and barriers for a given wave
 */
export function createWaveEntities(waveNumber: number): { targets: Target[]; barriers: Barrier[] } {
  const targets: Target[] = [];
  const barriers: Barrier[] = [];

  if (waveNumber === 1) {
    // Wave 1: Glide Aim through barrier aperture
    barriers.push({
      id: "b1",
      radius: 140,
      thickness: 14,
      apertureCenter: 0,
      apertureWidth: degToRad(50),
      rotSpeed: 0.015,
    });

    const angles = [0.4, 1.6, 2.8, 4.1, 5.3];
    angles.forEach((ang, i) => {
      const dist = 75 + (i % 2) * 35;
      targets.push({
        id: `w1-t${i}`,
        type: "dark_core",
        x: CENTER_X + dist * Math.cos(ang),
        y: CENTER_Y + dist * Math.sin(ang),
        radius: 18,
        hp: 1,
        maxHp: 1,
        angle: ang,
        dist,
        speed: 0.005 * ((i % 2 === 0) ? 1 : -1),
        alive: true,
        scoreValue: 30,
      });
    });
  } else if (waveNumber === 2) {
    // Wave 2: Thales 90° Blade only
    const angles = [0.3, 1.2, 2.2, 3.4, 4.4, 5.5];
    angles.forEach((ang, i) => {
      const dist = 90 + (i % 3) * 30;
      targets.push({
        id: `w2-t${i}`,
        type: "armor_cube",
        x: CENTER_X + dist * Math.cos(ang),
        y: CENTER_Y + dist * Math.sin(ang),
        radius: 20,
        hp: 1,
        maxHp: 1,
        angle: ang,
        dist,
        speed: 0.008 * ((i % 2 === 0) ? 1 : -1),
        alive: true,
        scoreValue: 35,
      });
    });
  } else if (waveNumber === 3) {
    // Wave 3: Core 2x Overcharge Swarm
    const count = 24;
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2 + (Math.random() * 0.2);
      const dist = 40 + (i % 4) * 35;
      targets.push({
        id: `w3-t${i}`,
        type: "swarm_parasite",
        x: CENTER_X + dist * Math.cos(ang),
        y: CENTER_Y + dist * Math.sin(ang),
        radius: 10,
        hp: 1,
        maxHp: 1,
        angle: ang,
        dist,
        speed: 0.012 + (i % 3) * 0.006,
        alive: true,
        scoreValue: 10,
      });
    }
  } else if (waveNumber === 4) {
    // Wave 4: 4 Elite Guardians for 180° Cyclic Nova
    const angles = [0.8, 2.3, 3.9, 5.4];
    angles.forEach((ang, i) => {
      const dist = 120;
      targets.push({
        id: `w4-t${i}`,
        type: "dark_core",
        x: CENTER_X + dist * Math.cos(ang),
        y: CENTER_Y + dist * Math.sin(ang),
        radius: 24,
        hp: 1,
        maxHp: 1,
        angle: ang,
        dist,
        speed: 0.004,
        alive: true,
        scoreValue: 50,
      });
    });
  } else if (waveNumber === 5) {
    // Wave 5: Boss - Chaos Singularity
    targets.push({
      id: "boss-1",
      type: "boss",
      x: CENTER_X,
      y: CENTER_Y,
      radius: 46,
      hp: 1000,
      maxHp: 1000,
      angle: 0,
      dist: 0,
      speed: 0,
      alive: true,
      scoreValue: 200,
    });

    barriers.push({
      id: "boss-b1",
      radius: 120,
      thickness: 16,
      apertureCenter: 0,
      apertureWidth: degToRad(60),
      rotSpeed: 0.02,
    });
  } else {
    // Endless Overdrive (Wave 6+)
    const count = 10 + Math.min(20, waveNumber * 2);
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2;
      const dist = 60 + (i % 4) * 30;
      const isArmor = i % 3 === 0;
      targets.push({
        id: `od-${waveNumber}-${i}`,
        type: isArmor ? "armor_cube" : "dark_core",
        x: CENTER_X + dist * Math.cos(ang),
        y: CENTER_Y + dist * Math.sin(ang),
        radius: isArmor ? 18 : 14,
        hp: 1,
        maxHp: 1,
        angle: ang,
        dist,
        speed: 0.01 + (i % 3) * 0.005,
        alive: true,
        scoreValue: 10,
      });
    }

    barriers.push({
      id: `od-b-${waveNumber}`,
      radius: 130,
      thickness: 14,
      apertureCenter: Math.random() * Math.PI * 2,
      apertureWidth: degToRad(45),
      rotSpeed: 0.02,
    });
  }

  return { targets, barriers };
}

