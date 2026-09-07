/**
 * Mathematical calculations and physics model for "Starlight Lake: Inscribed Slingshot".
 * Unit: Grade 3, Unit 3.2 (원의 성질 - 원주각).
 * Theme: Middle 3rd Grade "별빛의 현자" (Starlight Sage).
 */

export const CONTENT_KEY = "g3-u3-2-starlight-slingshot";

export const LAKE_WIDTH = 600;
export const LAKE_HEIGHT = 580;
export const LAKE_CENTER_X = 300;
export const LAKE_CENTER_Y = 280;
export const LAKE_RADIUS = 220;

export const START_HEARTS = 3;
export const MAX_HEARTS = 3;
export const FEVER_THRESHOLD = 4;

export type SlimeType =
  | "blue_slime"      // Standard friendly slime bobbing on water
  | "knight_slime"    // Armored slime with a 90° right-angle shield
  | "stardrop_slime"  // Tiny swarm slimes (sun crystal flare)
  | "basket_slime"    // Chest target with specific angle width
  | "king_slime";     // Giant boss slime with dual front/back barriers

export interface Point2D {
  x: number;
  y: number;
}

export interface Slime {
  id: string;
  type: SlimeType;
  x: number;
  y: number;
  radius: number;
  hp: number;
  maxHp: number;
  angle: number;       // polar angle in lake
  dist: number;        // distance from center
  bobPhase: number;    // floating wave animation phase
  speed: number;       // drift speed
  alive: boolean;
  scoreValue: number;
  requiredAngle?: number; // for basket/target matching
}

export interface Obstacle {
  id: string;
  x: number;
  y: number;
  radius: number;
  type: "lily_pad" | "rock";
}

export interface Ball {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  bouncesLeft: number;
  isThales90: boolean;
  isOvercharge2X: boolean;
  alive: boolean;
}

export interface ChapterConfig {
  chapter: number;
  title: string;
  subtitle: string;
  mechanicName: string;
  description: string;
  piDialogue: string;
  mathFormula: string;
  defaultAngleA: number;
  defaultAngleB: number;
  defaultAngleP: number;
  defaultAngleC?: number;
  defaultAngleD?: number;
  hasCenterSunCrystal: boolean;
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

/** Get coordinate on lake circular shoreline */
export function getLakeShorePoint(
  angleRad: number,
  radius = LAKE_RADIUS,
  cx = LAKE_CENTER_X,
  cy = LAKE_CENTER_Y,
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
 * Theorem: Angle subtended by arc AB at vertex P is 1/2 of central angle.
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
 */
export function calcCentralAngle(
  a: Point2D,
  b: Point2D,
  center: Point2D = { x: LAKE_CENTER_X, y: LAKE_CENTER_Y },
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
 * Check if line AB is a diameter of the lake (passes through center within tolerance).
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

/**
 * Calculate arc length along the circle between angleA and angleB
 */
export function calcArcLength(angleA: number, angleB: number, radius = LAKE_RADIUS): number {
  let diff = Math.abs(normalizeAngle(angleB - angleA));
  if (diff > Math.PI) diff = Math.PI * 2 - diff;
  return radius * diff;
}

/**
 * Check if ray from p1 towards p2 hits a circle obstacle or slime
 */
export function rayHitsCircle(
  p1: Point2D,
  p2: Point2D,
  target: Point2D,
  targetRadius: number,
): boolean {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return distance(p1, target) <= targetRadius;

  const t = Math.max(0, Math.min(1, ((target.x - p1.x) * dx + (target.y - p1.y) * dy) / lenSq));
  const projX = p1.x + t * dx;
  const projY = p1.y + t * dy;

  return Math.hypot(target.x - projX, target.y - projY) <= targetRadius;
}

export const CHAPTERS: ChapterConfig[] = [
  {
    chapter: 1,
    title: "제1장: 별빛 호수의 틈새",
    subtitle: "동일한 호에 대한 원주각의 크기는 항상 같다",
    mechanicName: "호숫가 슬라이딩 조준",
    description: "수초 바위 뒤에 숨은 파란 슬라임 3마리를 호숫가를 따라 움직이며 저격하세요!",
    piDialogue: "호 AB를 고정하면, 내가 호숫가 어디로 달려가도 발사 사잇각은 절대로 변하지 않아!",
    mathFormula: "\\angle\\text{APB} = \\text{일정 (동일한 호)}",
    defaultAngleA: degToRad(30),
    defaultAngleB: degToRad(120),
    defaultAngleP: degToRad(270),
    hasCenterSunCrystal: false,
    scoreClearBonus: 180,
  },
  {
    chapter: 2,
    title: "제2장: 탈레스와 직각 기사 슬라임",
    subtitle: "반원(지름)에 대한 원주각은 항상 90° 직각",
    mechanicName: "탈레스 90° 직각 크로스샷",
    description: "90도 직각 방패를 든 기사 슬라임 2체! 핀 AB를 지름으로 정렬하여 90도 직각으로 방패를 부수세요!",
    piDialogue: "두 핀 AB가 호수 중심을 지나는 지름이 되는 순간, 호숫가 어디서 쏴도 무조건 90도 직각이야!",
    mathFormula: "\\text{지름에 대한 원주각 } \\angle\\text{APB} = 90^\\circ",
    defaultAngleA: degToRad(15),
    defaultAngleB: degToRad(170), // slightly off, invites snapping to diameter
    defaultAngleP: degToRad(85),
    hasCenterSunCrystal: false,
    scoreClearBonus: 220,
  },
  {
    chapter: 3,
    title: "제3장: 호수의 태양 수정",
    subtitle: "한 호에 대한 중심각의 크기는 원주각의 2배",
    mechanicName: "중심각 2배 광역 버스트",
    description: "호수 중앙의 태양 수정을 조준하여 2배(2θ) 광역 부채꼴로 별빛 슬라임 무리를 일망타진하세요!",
    piDialogue: "호수 한가운데의 태양 수정 O를 거쳐 쏘면, 각도가 마법처럼 2배로 뻥튀기되어 쏟아져!",
    mathFormula: "\\angle\\text{AOB} = 2 \\times \\angle\\text{APB}",
    defaultAngleA: degToRad(40),
    defaultAngleB: degToRad(130),
    defaultAngleP: degToRad(270),
    hasCenterSunCrystal: true,
    scoreClearBonus: 220,
  },
  {
    chapter: 4,
    title: "제4장: 호의 길이와 보물 바구니",
    subtitle: "원주각의 크기는 호의 길이에 정비례한다",
    mechanicName: "호의 길이 정비례 조절",
    description: "황금 바구니의 크기에 맞춰 호 AB의 길이를 늘려 넓은 각도로 별빛 보석을 골인시키세요!",
    piDialogue: "호의 길이를 2배, 3배로 늘리면 원주각도 똑같이 2배, 3배로 넓어져!",
    mathFormula: "l \\propto \\angle\\text{APB} \\text{ (호의 길이와 원주각은 정비례)}",
    defaultAngleA: degToRad(45),
    defaultAngleB: degToRad(90),
    defaultAngleP: degToRad(270),
    hasCenterSunCrystal: false,
    scoreClearBonus: 200,
  },
  {
    chapter: 5,
    title: "제5장: 킹 슬라임의 별빛 결계",
    subtitle: "원에 내접하는 사각형의 대각의 합은 180°",
    mechanicName: "180° 대각 공명 결계",
    description: "4개의 핀 ABCD로 내접사각형을 만들어 마주보는 대각의 합 180°로 킹 슬라임의 앞뒤 결계를 봉인하세요!",
    piDialogue: "원 안에 4개의 핀을 꽂으면, 마주보는 두 각의 합은 항상 180도 평각을 이뤄!",
    mathFormula: "\\angle\\text{B} + \\angle\\text{D} = 180^\\circ",
    defaultAngleA: degToRad(45),
    defaultAngleB: degToRad(135),
    defaultAngleP: degToRad(45),
    defaultAngleC: degToRad(225),
    defaultAngleD: degToRad(315),
    hasCenterSunCrystal: false,
    scoreClearBonus: 240,
  },
];

/**
 * Generate slimes and obstacles for a chapter
 */
export function createChapterEntities(chapterNum: number): {
  slimes: Slime[];
  obstacles: Obstacle[];
} {
  const slimes: Slime[] = [];
  const obstacles: Obstacle[] = [];

  if (chapterNum === 1) {
    // Chapter 1: Slimes behind lily pad obstacles (Angle Invariance)
    obstacles.push({
      id: "obs-1",
      x: LAKE_CENTER_X - 40,
      y: LAKE_CENTER_Y + 10,
      radius: 36,
      type: "lily_pad",
    });

    const angles = [0.6, 1.3, 2.2];
    angles.forEach((ang, i) => {
      const dist = 90 + i * 25;
      slimes.push({
        id: `c1-s${i}`,
        type: "blue_slime",
        x: LAKE_CENTER_X + dist * Math.cos(ang),
        y: LAKE_CENTER_Y + dist * Math.sin(ang),
        radius: 22,
        hp: 1,
        maxHp: 1,
        angle: ang,
        dist,
        bobPhase: i * 1.5,
        speed: 0.006 * (i % 2 === 0 ? 1 : -1),
        alive: true,
        scoreValue: 40,
      });
    });
  } else if (chapterNum === 2) {
    // Chapter 2: Armored Knight Slimes with 90° shields (Thales)
    const angles = [0.8, 2.4];
    angles.forEach((ang, i) => {
      const dist = 110;
      slimes.push({
        id: `c2-k${i}`,
        type: "knight_slime",
        x: LAKE_CENTER_X + dist * Math.cos(ang),
        y: LAKE_CENTER_Y + dist * Math.sin(ang),
        radius: 26,
        hp: 1,
        maxHp: 1,
        angle: ang,
        dist,
        bobPhase: i * 2,
        speed: 0.005 * (i % 2 === 0 ? 1 : -1),
        alive: true,
        scoreValue: 70,
      });
    });
  } else if (chapterNum === 3) {
    // Chapter 3: Sun Crystal in center + 12 Stardrop slimes (2X Flare)
    const count = 12;
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2;
      const dist = 70 + (i % 3) * 35;
      slimes.push({
        id: `c3-star-${i}`,
        type: "stardrop_slime",
        x: LAKE_CENTER_X + dist * Math.cos(ang),
        y: LAKE_CENTER_Y + dist * Math.sin(ang),
        radius: 14,
        hp: 1,
        maxHp: 1,
        angle: ang,
        dist,
        bobPhase: i * 0.8,
        speed: 0.012,
        alive: true,
        scoreValue: 20,
      });
    }
  } else if (chapterNum === 4) {
    // Chapter 4: Target Baskets requiring wide arc
    const angles = [0.9, 1.8, 2.7];
    const angleRequirements = [30, 50, 70];
    angles.forEach((ang, i) => {
      const dist = 115;
      slimes.push({
        id: `c4-b${i}`,
        type: "basket_slime",
        x: LAKE_CENTER_X + dist * Math.cos(ang),
        y: LAKE_CENTER_Y + dist * Math.sin(ang),
        radius: 24,
        hp: 1,
        maxHp: 1,
        angle: ang,
        dist,
        bobPhase: i * 1.8,
        speed: 0.004,
        alive: true,
        scoreValue: 60,
        requiredAngle: angleRequirements[i],
      });
    });
  } else if (chapterNum === 5) {
    // Chapter 5: Giant King Slime Boss in center (180° Cyclic Quad)
    slimes.push({
      id: "king-boss",
      type: "king_slime",
      x: LAKE_CENTER_X,
      y: LAKE_CENTER_Y,
      radius: 48,
      hp: 3,
      maxHp: 3,
      angle: 0,
      dist: 0,
      bobPhase: 0,
      speed: 0,
      alive: true,
      scoreValue: 250,
    });
  } else {
    // Endless Mode / Overdrive: Mixed slimes drifting
    const count = 6 + Math.min(10, chapterNum);
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2;
      const dist = 60 + (i % 4) * 35;
      const isKnight = i % 3 === 0;
      slimes.push({
        id: `od-${chapterNum}-${i}`,
        type: isKnight ? "knight_slime" : "blue_slime",
        x: LAKE_CENTER_X + dist * Math.cos(ang),
        y: LAKE_CENTER_Y + dist * Math.sin(ang),
        radius: isKnight ? 24 : 18,
        hp: 1,
        maxHp: 1,
        angle: ang,
        dist,
        bobPhase: i * 1.2,
        speed: 0.008 + (i % 3) * 0.004,
        alive: true,
        scoreValue: 25,
      });
    }

    obstacles.push({
      id: `od-obs-${chapterNum}`,
      x: LAKE_CENTER_X + 50 * Math.cos(chapterNum),
      y: LAKE_CENTER_Y + 50 * Math.sin(chapterNum),
      radius: 30,
      type: "lily_pad",
    });
  }

  return { slimes, obstacles };
}
