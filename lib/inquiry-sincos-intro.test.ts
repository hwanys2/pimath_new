import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFINE_STEP_INDEX,
  EXTREME_ANGLES,
  HYP_SCENES,
  PROBLEM_COUNT,
  TABLE_ANGLES,
  TABLE_STEP_INDEX,
  aggregateSincosScore,
  clampAngle,
  cosDeg,
  cosNameIsCorrect,
  cosRatioIsCorrect,
  emptySincosWorkspace,
  normalizeSincosWorkspace,
  expectedAdj,
  expectedOpp,
  gradeSincosStep,
  hypSceneAt,
  initialAngleDeg,
  isDefineStep,
  isTableStep,
  lengthIsCorrect,
  parseStudentNumber,
  scoreForAttempts,
  seededAngleDeg,
  sinDeg,
  sinNameIsCorrect,
  sinRatioIsCorrect,
  validateSincosSubmit,
} from "@/lib/inquiry-sincos-intro";
import {
  GRID_H,
  GRID_W,
  angleDialPoint,
  dist,
  perpendicularThrough,
} from "@/lib/inquiry-tangent-sketch";
import {
  belowDegFromBase,
  belowRayEndpoint,
  belowSign,
  hypCircleFromSeg,
  originOnSeg,
  perpFromPointToLine,
  projectOnCircle,
  projectOnLine,
  snapPointWithCircle,
} from "@/lib/inquiry-sincos-sketch";

describe("sincos intro scenes", () => {
  it("has 3 hypotenuse scenes, a table step, and a define step", () => {
    assert.equal(HYP_SCENES.length, 3);
    assert.equal(PROBLEM_COUNT, 5);
    assert.equal(TABLE_STEP_INDEX, 3);
    assert.equal(DEFINE_STEP_INDEX, 4);
    assert.equal(isTableStep(2), false);
    assert.equal(isTableStep(3), true);
    assert.equal(isTableStep(4), false);
    assert.equal(isDefineStep(4), true);
    assert.equal(hypSceneAt(0)?.id, "kite");
    assert.equal(hypSceneAt(1)?.id, "ladder");
    assert.equal(hypSceneAt(2)?.id, "tablet");
    assert.equal(hypSceneAt(3), null);
    assert.ok(TABLE_ANGLES.includes(45));
    assert.deepEqual([...EXTREME_ANGLES], [0, 90]);
  });

  it("uses updated hypotenuse lengths and fixed angles for kite and ladder", () => {
    assert.equal(HYP_SCENES[0]!.hyp, 31);
    assert.equal(HYP_SCENES[0]!.angleAdjustable, false);
    assert.equal(HYP_SCENES[1]!.hyp, 4.7);
    assert.equal(HYP_SCENES[1]!.defaultAngleDeg, 60);
    assert.equal(HYP_SCENES[2]!.hyp, 37);
    assert.equal(HYP_SCENES[2]!.angleAdjustable, false);
    assert.equal(HYP_SCENES[2]!.randomizeInitialAngle, true);
  });

  it("assigns a stable random tablet angle per student seed", () => {
    const tablet = HYP_SCENES[2]!;
    const a = initialAngleDeg(tablet, "student-42");
    const b = initialAngleDeg(tablet, "student-42");
    const c = initialAngleDeg(tablet, "student-99");
    assert.equal(a, b);
    assert.ok(a >= 30 && a <= 70);
    assert.ok(c >= 30 && c <= 70);
    assert.equal(seededAngleDeg("fixed", 30, 70), seededAngleDeg("fixed", 30, 70));
  });

  it("keeps seeded tablet angle when normalizing drafts", () => {
    const seed = "student-42";
    const expected = initialAngleDeg(HYP_SCENES[2]!, seed);
    const ws = normalizeSincosWorkspace(
      2,
      { angleDeg: 55, adjText: "10", oppText: "20" },
      { seed },
    );
    assert.equal(ws.angleDeg, expected);
    assert.equal(ws.adjText, "10");
    assert.equal(ws.oppText, "20");
  });

  it("clamps elevation angle to 1 degree within the scene range", () => {
    const kite = HYP_SCENES[0]!;
    assert.equal(clampAngle(kite, 40.4), 40);
    assert.equal(clampAngle(kite, 3), kite.minAngleDeg);
    assert.equal(clampAngle(kite, 89), kite.maxAngleDeg);
  });
});

describe("parseStudentNumber", () => {
  it("accepts decimals, commas, fractions, and unit suffixes", () => {
    assert.equal(parseStudentNumber("23"), 23);
    assert.equal(parseStudentNumber("23m"), 23);
    assert.equal(parseStudentNumber("18cm"), 18);
    assert.equal(parseStudentNumber("1,73"), 1.73);
    assert.equal(parseStudentNumber("3/5"), 0.6);
    assert.equal(parseStudentNumber(""), null);
    assert.equal(parseStudentNumber("abc"), null);
  });
});

describe("scene length grading", () => {
  const kite = HYP_SCENES[0]!;

  it("accepts 31 m kite height and distance at 40°", () => {
    const ang = 40;
    assert.equal(lengthIsCorrect(kite, ang, expectedOpp(kite, ang), "opp"), true);
    assert.equal(lengthIsCorrect(kite, ang, expectedAdj(kite, ang), "adj"), true);
  });

  it("accepts 31 * sin/cos within 12%", () => {
    assert.equal(lengthIsCorrect(kite, 40, 31 * sinDeg(40), "opp"), true);
    assert.equal(lengthIsCorrect(kite, 40, 31 * cosDeg(40), "adj"), true);
    assert.equal(lengthIsCorrect(kite, 40, 5, "opp"), false);
    assert.equal(lengthIsCorrect(kite, 40, 80, "adj"), false);
  });

  it("uses a 0.3 m floor for the short ladder", () => {
    const ladder = HYP_SCENES[1]!;
    const h = expectedOpp(ladder, 60);
    assert.equal(lengthIsCorrect(ladder, 60, h, "opp"), true);
    assert.equal(lengthIsCorrect(ladder, 60, h - 0.25, "opp"), true);
    assert.equal(lengthIsCorrect(ladder, 60, 1, "opp"), false);
  });
});

describe("ratio grading", () => {
  it("accepts sin 30° = 1/2 and cos 60° = 1/2", () => {
    assert.equal(sinRatioIsCorrect(30, 0.5), true);
    assert.equal(cosRatioIsCorrect(60, 0.5), true);
    assert.equal(sinRatioIsCorrect(90, 1), true);
    assert.equal(sinRatioIsCorrect(30, 1), false);
  });

  it("accepts exact 0° and 90° values including zero", () => {
    assert.equal(sinRatioIsCorrect(0, 0), true);
    assert.equal(cosRatioIsCorrect(0, 1), true);
    assert.equal(sinRatioIsCorrect(90, 1), true);
    assert.equal(cosRatioIsCorrect(90, 0), true);
    assert.equal(sinRatioIsCorrect(0, 1), false);
    assert.equal(cosRatioIsCorrect(90, 1), false);
  });

  it("accepts approximate sin 45° and cos 45°", () => {
    const s = Math.SQRT1_2;
    assert.equal(sinRatioIsCorrect(45, s), true);
    assert.equal(cosRatioIsCorrect(45, s), true);
  });
});

describe("validate and grade", () => {
  it("flags empty height or distance as incomplete", () => {
    const ws = emptySincosWorkspace(0);
    const notice = validateSincosSubmit(0, ws);
    assert.equal(notice?.reason, "incomplete");
    assert.ok(notice?.wrongKeys?.includes("adj"));
    assert.ok(notice?.wrongKeys?.includes("opp"));
  });

  it("flags missing method text after a correct scene", () => {
    const kite = HYP_SCENES[0]!;
    const ws = emptySincosWorkspace(0);
    ws.adjText = String(expectedAdj(kite, ws.angleDeg));
    ws.oppText = String(expectedOpp(kite, ws.angleDeg));
    const notice = validateSincosSubmit(0, ws);
    assert.equal(notice?.reason, "incomplete_method");
  });

  it("grades a correct kite scene", () => {
    const kite = HYP_SCENES[0]!;
    const ws = emptySincosWorkspace(0);
    ws.adjText = String(expectedAdj(kite, 40));
    ws.oppText = String(expectedOpp(kite, 40));
    ws.methodText = "빗변을 그리고 원과 수선으로 비를 구한 뒤 31m에 곱했어요.";
    assert.equal(validateSincosSubmit(0, ws), null);
    const graded = gradeSincosStep(0, ws, 1);
    assert.equal(graded.result, "correct");
    if (graded.response.kind !== "scene") throw new Error("expected scene");
    assert.equal(graded.response.sceneId, "kite");
    assert.equal(graded.response.wrongs, 1);
  });

  it("requires all eighteen table cells", () => {
    const ws = emptySincosWorkspace(TABLE_STEP_INDEX);
    ws.sinRatios["10"] = "0.17";
    const notice = validateSincosSubmit(TABLE_STEP_INDEX, ws);
    assert.equal(notice?.reason, "incomplete");
  });

  it("normalizes legacy partial workspaces missing ratio maps", () => {
    const normalized = normalizeSincosWorkspace(TABLE_STEP_INDEX, {
      methodText: "old draft",
    } as Partial<ReturnType<typeof emptySincosWorkspace>>);
    assert.equal(normalized.methodText, "old draft");
    assert.equal(normalized.sinRatios["10"], "");
    assert.equal(normalized.cosRatios["45"], "");
    assert.equal(normalized.sinRatios["0"], "");
    assert.equal(normalized.cosRatios["90"], "");
    assert.equal(normalized.sinNameText, "");
    assert.equal(normalized.cosNameText, "");
    assert.doesNotThrow(() =>
      validateSincosSubmit(TABLE_STEP_INDEX, {
        ...normalized,
        sinRatios: undefined as unknown as Record<string, string>,
        cosRatios: undefined as unknown as Record<string, string>,
      }),
    );
  });

  it("grades a full sin/cos table including 0° and 90°", () => {
    const ws = emptySincosWorkspace(TABLE_STEP_INDEX);
    for (const a of TABLE_ANGLES) {
      ws.sinRatios[String(a)] = String(sinDeg(a));
      ws.cosRatios[String(a)] = String(cosDeg(a));
    }
    ws.sinRatios["0"] = "0";
    ws.cosRatios["0"] = "1";
    ws.sinRatios["90"] = "1";
    ws.cosRatios["90"] = "0";
    ws.methodText = "0도는 높이가 없고 90도는 밑변이 없어서요.";
    assert.equal(validateSincosSubmit(TABLE_STEP_INDEX, ws), null);
    const graded = gradeSincosStep(TABLE_STEP_INDEX, ws, 0);
    assert.equal(graded.result, "correct");
  });

  it("requires 0° and 90° cells after the measured table is filled", () => {
    const ws = emptySincosWorkspace(TABLE_STEP_INDEX);
    for (const a of TABLE_ANGLES) {
      ws.sinRatios[String(a)] = String(sinDeg(a));
      ws.cosRatios[String(a)] = String(cosDeg(a));
    }
    ws.methodText = "이유를 적었어요.";
    const notice = validateSincosSubmit(TABLE_STEP_INDEX, ws);
    assert.equal(notice?.reason, "incomplete");
  });

  it("lists wrong sin and cos cells separately", () => {
    const ws = emptySincosWorkspace(TABLE_STEP_INDEX);
    for (const a of TABLE_ANGLES) {
      ws.sinRatios[String(a)] = "1";
      ws.cosRatios[String(a)] = String(cosDeg(a));
    }
    ws.sinRatios["0"] = "0";
    ws.cosRatios["0"] = "1";
    ws.sinRatios["90"] = "1";
    ws.cosRatios["90"] = "0";
    const notice = validateSincosSubmit(TABLE_STEP_INDEX, ws);
    assert.equal(notice?.reason, "wrong");
    assert.ok(notice?.wrongKeys?.includes("sin:10"));
    assert.ok(!notice?.wrongKeys?.includes("cos:60"));
  });

  it("flags missing 0°/90° reason after a filled table", () => {
    const ws = emptySincosWorkspace(TABLE_STEP_INDEX);
    for (const a of TABLE_ANGLES) {
      ws.sinRatios[String(a)] = String(sinDeg(a));
      ws.cosRatios[String(a)] = String(cosDeg(a));
    }
    ws.sinRatios["0"] = "0";
    ws.cosRatios["0"] = "1";
    ws.sinRatios["90"] = "1";
    ws.cosRatios["90"] = "0";
    const notice = validateSincosSubmit(TABLE_STEP_INDEX, ws);
    assert.equal(notice?.reason, "incomplete_method");
  });

  it("flags missing define names as incomplete", () => {
    const ws = emptySincosWorkspace(DEFINE_STEP_INDEX);
    const notice = validateSincosSubmit(DEFINE_STEP_INDEX, ws);
    assert.equal(notice?.reason, "incomplete");
    assert.ok(notice?.wrongKeys?.includes("sinName"));
    assert.ok(notice?.wrongKeys?.includes("cosName"));
  });

  it("accepts sin and cos naming answers", () => {
    assert.equal(sinNameIsCorrect("사인"), true);
    assert.equal(sinNameIsCorrect("sine"), true);
    assert.equal(cosNameIsCorrect("코사인"), true);
    assert.equal(cosNameIsCorrect("cos"), true);
    assert.equal(sinNameIsCorrect("코사인"), false);
    assert.equal(cosNameIsCorrect("탄젠트"), false);
  });

  it("grades a correct define step", () => {
    const ws = emptySincosWorkspace(DEFINE_STEP_INDEX);
    ws.sinNameText = "사인";
    ws.cosNameText = "코사인";
    assert.equal(validateSincosSubmit(DEFINE_STEP_INDEX, ws), null);
    const graded = gradeSincosStep(DEFINE_STEP_INDEX, ws, 0);
    assert.equal(graded.result, "correct");
    if (graded.response.kind !== "define") throw new Error("expected define");
    assert.equal(graded.response.sinNameText, "사인");
    assert.equal(graded.response.cosNameText, "코사인");
  });
});

describe("score", () => {
  it("penalizes wrong attempts with a floor of 40", () => {
    assert.equal(scoreForAttempts(0), 100);
    assert.equal(scoreForAttempts(1), 85);
    assert.equal(scoreForAttempts(10), 40);
  });

  it("aggregates session score", () => {
    const kite = HYP_SCENES[0]!;
    const ws0 = emptySincosWorkspace(0);
    ws0.adjText = String(expectedAdj(kite, 40));
    ws0.oppText = String(expectedOpp(kite, 40));
    ws0.methodText = "비슷한 삼각형을 그려 계산했어요.";
    const g0 = gradeSincosStep(0, ws0, 0);
    const agg = aggregateSincosScore(
      [{ stepIndex: 0, result: g0.result, response: g0.response }],
      PROBLEM_COUNT,
    );
    assert.equal(agg.correctCount, 1);
    assert.equal(agg.score, 100);
  });
});

describe("sincos sketch geometry", () => {
  it("builds a hypotenuse circle from the first segment", () => {
    const seg = { id: "h", a: { x: 4, y: 4 }, b: { x: 10, y: 4 } };
    const circle = hypCircleFromSeg(seg);
    assert.equal(circle.center.x, 4);
    assert.equal(circle.center.y, 4);
    assert.equal(circle.radius, 6);
    const on = projectOnCircle({ x: 4, y: 20 }, circle);
    assert.ok(Math.abs(dist(on, circle.center) - 6) < 1e-9);
    assert.ok(Math.abs(on.x - 4) < 1e-9);
  });

  it("places a below-angle label on the ground side of the hypotenuse", () => {
    const origin = { x: 4, y: 8 };
    const baseDir = { x: 1, y: 0 };
    const sign = belowSign(baseDir);
    assert.equal(sign, -1);
    const label = angleDialPoint(origin, baseDir, sign * 45, 1.55);
    assert.ok(label.y < origin.y);
  });

  it("sweeps the angle below a rightward hypotenuse", () => {
    const origin = { x: 4, y: 8 };
    const baseDir = { x: 1, y: 0 };
    assert.equal(belowSign(baseDir), -1);
    const down = { x: 8, y: 4 };
    const deg = belowDegFromBase(origin, baseDir, down);
    assert.equal(deg, 45);
    const end = belowRayEndpoint(origin, baseDir, deg);
    assert.ok(end);
    assert.ok(end!.y < origin.y);
  });

  it("uses the circle center as origin on the hypotenuse segment", () => {
    const hyp = { id: "h", a: { x: 2, y: 2 }, b: { x: 8, y: 8 } };
    const nearB = originOnSeg(hyp, { x: 8, y: 8 }, "h");
    assert.equal(nearB.origin.x, 2);
    assert.equal(nearB.origin.y, 2);
    const other = originOnSeg(hyp, { x: 8, y: 8 }, null);
    assert.equal(other.origin.x, 8);
  });

  it("drops a perpendicular from a circle point to a base ray", () => {
    const base = { id: "r", a: { x: 2, y: 2 }, b: { x: 14, y: 2 } };
    const p = { x: 8, y: 8 };
    const line = perpFromPointToLine(p, base);
    assert.ok(line);
    assert.ok(Math.abs(line!.a.x - 8) < 1e-6);
    assert.ok(Math.abs(line!.b.x - 8) < 1e-6);
    const through = perpendicularThrough({ x: 8, y: 2 }, base);
    assert.ok(through);
    assert.equal(Math.min(through!.a.y, through!.b.y), 0);
    assert.equal(Math.max(through!.a.y, through!.b.y), GRID_H);
  });

  it("projects onto an infinite line past the segment", () => {
    const proj = projectOnLine({ x: 20, y: 3 }, { x: 0, y: 0 }, { x: 4, y: 0 });
    assert.equal(proj.point.y, 0);
    assert.ok(proj.t > 1);
  });

  it("snaps onto the hypotenuse circle", () => {
    const hyp = { id: "h", a: { x: 4, y: 4 }, b: { x: 10, y: 4 } };
    const circle = hypCircleFromSeg(hyp);
    const snapped = snapPointWithCircle({ x: 4.05, y: 10.1 }, [hyp], circle);
    assert.ok(Math.abs(dist(snapped, circle.center) - circle.radius) < 0.2);
    assert.equal(GRID_W, 16);
  });
});
