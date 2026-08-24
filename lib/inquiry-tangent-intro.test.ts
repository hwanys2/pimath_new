import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFINE_STEP_INDEX,
  GRADED_STEP_COUNT,
  HEIGHT_SCENES,
  PROBLEM_COUNT,
  TABLE_ANGLES,
  TABLE_STEP_INDEX,
  aggregateTangentScore,
  clampDistance,
  elevationAngleDeg,
  emptyTangentWorkspace,
  gradeTangentStep,
  distanceFromSceneX,
  getHeightSceneLayout,
  HEIGHT_SCENE_OBJECT_FACE_X,
  heightIsCorrect,
  heightSceneAt,
  isDefineStep,
  isTableStep,
  parseStudentNumber,
  ratioIsCorrect,
  scoreForAttempts,
  tanDeg,
  tangentNameIsCorrect,
  validateTangentSubmit,
} from "@/lib/inquiry-tangent-intro";
import {
  GRID_H,
  GRID_W,
  allIntersections,
  baseDirection,
  elevationDegFromBase,
  leftVertex,
  perpendicularThrough,
  projectOnSeg,
  rayEndpoint,
  segmentIntersection,
  snapPoint,
  splitPointsOnSeg,
  formatLength,
  nearestSubSegment,
  subSegments,
} from "@/lib/inquiry-tangent-sketch";

describe("tangent intro scenes", () => {
  it("has 3 height scenes, a table step, and a view-only tangent page", () => {
    assert.equal(HEIGHT_SCENES.length, 3);
    assert.equal(PROBLEM_COUNT, 5);
    assert.equal(GRADED_STEP_COUNT, 4);
    assert.equal(TABLE_STEP_INDEX, 3);
    assert.equal(DEFINE_STEP_INDEX, 4);
    assert.equal(isTableStep(2), false);
    assert.equal(isTableStep(3), true);
    assert.equal(isTableStep(4), false);
    assert.equal(isDefineStep(3), false);
    assert.equal(isDefineStep(4), true);
    assert.equal(heightSceneAt(0)?.id, "building");
    assert.equal(heightSceneAt(3), null);
    assert.equal(heightSceneAt(4), null);
    assert.deepEqual([...TABLE_ANGLES], [10, 20, 30, 40, 45, 50, 60, 70, 80]);
  });

  it("rounds elevation angle to 1 degree", () => {
    const building = HEIGHT_SCENES[0]!;
    assert.equal(
      elevationAngleDeg(building.heightM, 32),
      Math.round((Math.atan(24 / 32) * 180) / Math.PI),
    );
    assert.equal(elevationAngleDeg(12, 12), 45);
  });

  it("clamps observer distance to the scene range", () => {
    const building = HEIGHT_SCENES[0]!;
    assert.equal(clampDistance(building, 3), building.minDistanceM);
    assert.equal(clampDistance(building, 99), building.maxDistanceM);
    assert.equal(clampDistance(building, 20.4), 20);
  });

  it("locks tree and lighthouse to a fixed base length", () => {
    const tree = HEIGHT_SCENES[1]!;
    const lighthouse = HEIGHT_SCENES[2]!;
    assert.equal(tree.distanceAdjustable, false);
    assert.equal(lighthouse.distanceAdjustable, false);
    assert.equal(HEIGHT_SCENES[0]!.distanceAdjustable, true);
    assert.equal(tree.defaultDistanceM, 23);
    assert.equal(lighthouse.defaultDistanceM, 67);
    assert.equal(clampDistance(tree, 10), 23);
    assert.equal(clampDistance(tree, 40), 23);
    assert.equal(clampDistance(lighthouse, 25), 67);
    assert.equal(clampDistance(lighthouse, 80), 67);
    assert.equal(emptyTangentWorkspace(1).distanceM, 23);
    assert.equal(emptyTangentWorkspace(2).distanceM, 67);
  });
});

describe("height scene layout", () => {
  it("uses one px/m so the drawn angle equals atan(height/distance)", () => {
    for (const scene of HEIGHT_SCENES) {
      const samples = [
        scene.minDistanceM,
        scene.defaultDistanceM,
        scene.maxDistanceM,
        53,
      ];
      for (const raw of samples) {
        if (raw < scene.minDistanceM || raw > scene.maxDistanceM) continue;
        const layout = getHeightSceneLayout(scene, raw);
        const expectedDeg =
          (Math.atan(scene.heightM / layout.distanceM) * 180) / Math.PI;
        assert.ok(
          Math.abs(layout.visualAngleDeg - expectedDeg) < 1e-9,
          `${scene.id} @ ${layout.distanceM}m: visual ${layout.visualAngleDeg} vs ${expectedDeg}`,
        );
        assert.equal(
          Math.round(layout.visualAngleDeg),
          layout.displayedAngleDeg,
        );
        assert.ok(
          Math.abs(
            layout.heightPx / layout.distancePx -
              scene.heightM / layout.distanceM,
          ) < 1e-9,
        );
        assert.equal(
          distanceFromSceneX(scene, layout.observerX),
          layout.distanceM,
        );
        assert.equal(layout.topX, HEIGHT_SCENE_OBJECT_FACE_X);
        assert.equal(layout.observerX + layout.distancePx, layout.faceX);
      }
    }
  });

  it("keeps the school scene at 53 m near 24° both in math and on screen", () => {
    const building = HEIGHT_SCENES[0]!;
    const layout = getHeightSceneLayout(building, 53);
    assert.equal(layout.displayedAngleDeg, 24);
    assert.ok(layout.visualAngleDeg > 23.5 && layout.visualAngleDeg < 25);
    const pixelDeg =
      (Math.atan2(layout.groundY - layout.topY, layout.faceX - layout.observerX) *
        180) /
      Math.PI;
    assert.ok(Math.abs(pixelDeg - layout.visualAngleDeg) < 1e-9);
  });

  it("draws the tree at 23 m and the lighthouse at 67 m", () => {
    const tree = getHeightSceneLayout(HEIGHT_SCENES[1]!, 10);
    assert.equal(tree.distanceM, 23);
    assert.equal(tree.displayedAngleDeg, Math.round((Math.atan(12 / 23) * 180) / Math.PI));
    const lighthouse = getHeightSceneLayout(HEIGHT_SCENES[2]!, 99);
    assert.equal(lighthouse.distanceM, 67);
    assert.equal(
      lighthouse.displayedAngleDeg,
      Math.round((Math.atan(36 / 67) * 180) / Math.PI),
    );
  });
});

describe("parseStudentNumber", () => {
  it("accepts decimals, commas, fractions, and m suffix", () => {
    assert.equal(parseStudentNumber("24"), 24);
    assert.equal(parseStudentNumber("24m"), 24);
    assert.equal(parseStudentNumber("1,73"), 1.73);
    assert.equal(parseStudentNumber("3/5"), 0.6);
    assert.equal(parseStudentNumber(""), null);
    assert.equal(parseStudentNumber("abc"), null);
  });
});

describe("heightIsCorrect", () => {
  const building = HEIGHT_SCENES[0]!;

  it("accepts the true height", () => {
    assert.equal(heightIsCorrect(building, 32, 24), true);
  });

  it("accepts height from displayed angle within 12%", () => {
    const d = 32;
    const ang = elevationAngleDeg(building.heightM, d);
    const fromAngle = d * tanDeg(ang);
    assert.equal(heightIsCorrect(building, d, fromAngle), true);
  });

  it("rejects a far-off guess", () => {
    assert.equal(heightIsCorrect(building, 32, 8), false);
    assert.equal(heightIsCorrect(building, 32, 80), false);
  });

  it("uses a 1 m floor for the short tree", () => {
    const tree = HEIGHT_SCENES[1]!;
    assert.equal(heightIsCorrect(tree, 23, 12), true);
    assert.equal(heightIsCorrect(tree, 23, 11.2), true);
    assert.equal(heightIsCorrect(tree, 23, 6), false);
  });
});

describe("ratioIsCorrect", () => {
  it("accepts tan 45° = 1", () => {
    assert.equal(ratioIsCorrect(45, 1), true);
    assert.equal(ratioIsCorrect(45, 1.05), true);
    assert.equal(ratioIsCorrect(45, 2), false);
  });

  it("accepts approximate tan 30° and tan 60°", () => {
    assert.equal(ratioIsCorrect(30, 1 / Math.sqrt(3)), true);
    assert.equal(ratioIsCorrect(60, Math.sqrt(3)), true);
  });

  it("uses an absolute floor for small angles", () => {
    assert.equal(ratioIsCorrect(10, 0.18), true);
    assert.equal(ratioIsCorrect(10, 1), false);
  });
});

describe("validate and grade", () => {
  it("flags empty height as incomplete", () => {
    const ws = emptyTangentWorkspace(0);
    const notice = validateTangentSubmit(0, ws);
    assert.equal(notice?.reason, "incomplete");
  });

  it("flags missing method text after a correct height", () => {
    const ws = emptyTangentWorkspace(0);
    ws.heightText = "24";
    const notice = validateTangentSubmit(0, ws);
    assert.equal(notice?.reason, "incomplete_method");
  });

  it("grades a correct building height", () => {
    const ws = emptyTangentWorkspace(0);
    ws.heightText = "24";
    ws.methodText = "비슷한 직각삼각형을 그려 비를 구한 뒤 거리에 곱했어요.";
    assert.equal(validateTangentSubmit(0, ws), null);
    const graded = gradeTangentStep(0, ws, 1);
    assert.equal(graded.result, "correct");
    if (graded.response.kind !== "height") throw new Error("expected height");
    assert.equal(graded.response.sceneId, "building");
    assert.equal(graded.response.wrongs, 1);
    assert.ok(graded.response.methodText.includes("직각삼각형"));
  });

  it("requires all nine table cells", () => {
    const ws = emptyTangentWorkspace(TABLE_STEP_INDEX);
    ws.ratios["10"] = "0.18";
    const notice = validateTangentSubmit(TABLE_STEP_INDEX, ws);
    assert.equal(notice?.reason, "incomplete");
    assert.equal(TABLE_ANGLES.length, 9);
  });

  it("flags missing method text after a full tangent table", () => {
    const ws = emptyTangentWorkspace(TABLE_STEP_INDEX);
    for (const a of TABLE_ANGLES) {
      ws.ratios[String(a)] = String(tanDeg(a));
    }
    const notice = validateTangentSubmit(TABLE_STEP_INDEX, ws);
    assert.equal(notice?.reason, "incomplete_method");
  });

  it("grades a full tangent table", () => {
    const ws = emptyTangentWorkspace(TABLE_STEP_INDEX);
    for (const a of TABLE_ANGLES) {
      ws.ratios[String(a)] = String(tanDeg(a));
    }
    ws.methodText = "각도마다 직각삼각형을 그려 높이÷밑변을 표에 적었어요.";
    assert.equal(validateTangentSubmit(TABLE_STEP_INDEX, ws), null);
    const graded = gradeTangentStep(TABLE_STEP_INDEX, ws, 0);
    assert.equal(graded.result, "correct");
  });

  it("lists wrong table rows and treats 45° = 1 as correct", () => {
    const ws = emptyTangentWorkspace(TABLE_STEP_INDEX);
    for (const a of TABLE_ANGLES) {
      ws.ratios[String(a)] = "1";
    }
    const notice = validateTangentSubmit(TABLE_STEP_INDEX, ws);
    assert.equal(notice?.reason, "wrong");
    assert.ok(notice?.wrongAngles?.includes(10));
    assert.ok(TABLE_ANGLES.includes(45));
    assert.ok(!notice?.wrongAngles?.includes(45));
  });

  it("does not require a name on the view-only tangent page", () => {
    const ws = emptyTangentWorkspace(DEFINE_STEP_INDEX);
    assert.equal(validateTangentSubmit(DEFINE_STEP_INDEX, ws), null);
    const graded = gradeTangentStep(DEFINE_STEP_INDEX, ws, 0);
    assert.equal(graded.result, "neutral");
    if (graded.response.kind !== "define") throw new Error("expected define");
  });

  it("still recognizes 탄젠트, tangent, and tan as names", () => {
    assert.equal(tangentNameIsCorrect("탄젠트"), true);
    assert.equal(tangentNameIsCorrect(" Tangent "), true);
    assert.equal(tangentNameIsCorrect("tan"), true);
    assert.equal(tangentNameIsCorrect("탄젠트(tangent)"), true);
    assert.equal(tangentNameIsCorrect("사인"), false);
    assert.equal(tangentNameIsCorrect(""), false);
  });
});

describe("score", () => {
  it("penalizes wrong attempts with a floor of 40", () => {
    assert.equal(scoreForAttempts(0), 100);
    assert.equal(scoreForAttempts(1), 85);
    assert.equal(scoreForAttempts(10), 40);
  });

  it("aggregates session score", () => {
    const ws0 = emptyTangentWorkspace(0);
    ws0.heightText = "24";
    ws0.methodText = "비슷한 삼각형을 그려 계산했어요.";
    const g0 = gradeTangentStep(0, ws0, 0);
    const agg = aggregateTangentScore(
      [{ stepIndex: 0, result: g0.result, response: g0.response }],
      PROBLEM_COUNT,
    );
    assert.equal(agg.correctCount, 1);
    assert.equal(agg.score, 100);
  });

  it("does not count the view-only tangent page in the score", () => {
    const define = gradeTangentStep(
      DEFINE_STEP_INDEX,
      emptyTangentWorkspace(DEFINE_STEP_INDEX),
      0,
    );
    const agg = aggregateTangentScore(
      [{ stepIndex: DEFINE_STEP_INDEX, result: define.result, response: define.response }],
      PROBLEM_COUNT,
    );
    assert.equal(agg.correctCount, 0);
    assert.equal(agg.score, 0);
  });
});

describe("sketch geometry", () => {
  it("drops a vertical perpendicular on a horizontal base", () => {
    const seg = { id: "s", a: { x: 2, y: 0 }, b: { x: 10, y: 0 } };
    const perp = perpendicularThrough({ x: 10, y: 0 }, seg);
    assert.ok(perp);
    assert.equal(perp!.a.x, 10);
    assert.equal(perp!.b.x, 10);
    assert.equal(Math.min(perp!.a.y, perp!.b.y), 0);
    assert.equal(Math.max(perp!.a.y, perp!.b.y), GRID_H);
  });

  it("projects onto a segment and snaps to vertices", () => {
    const segs = [{ id: "s", a: { x: 0, y: 0 }, b: { x: 8, y: 0 } }];
    const proj = projectOnSeg({ x: 3, y: 0.2 }, segs[0]!.a, segs[0]!.b);
    assert.ok(proj.d < 0.3);
    const snapped = snapPoint({ x: -0.15, y: 0.12 }, segs);
    assert.equal(snapped.x, 0);
    assert.equal(snapped.y, 0);
    assert.equal(GRID_W, 16);
  });

  it("finds left vertex and ray angle", () => {
    const seg = { id: "s", a: { x: 8, y: 0 }, b: { x: 2, y: 0 } };
    const left = leftVertex(seg);
    assert.equal(left.x, 2);
    const dir = baseDirection(seg);
    assert.equal(dir.x, 1);
    const deg = elevationDegFromBase(left, dir, { x: 6, y: 4 });
    assert.equal(deg, 45);
    const end = rayEndpoint(left, dir, deg);
    assert.ok(end);
    assert.ok(end!.y > left.y);
  });

  it("detects intersections and split subsegments", () => {
    const base = { id: "b", a: { x: 0, y: 0 }, b: { x: 10, y: 0 } };
    const up = { id: "u", a: { x: 5, y: 0 }, b: { x: 5, y: 8 } };
    const hits = allIntersections([base, up]);
    assert.equal(hits.length, 1);
    assert.ok(segmentIntersection(base.a, base.b, up.a, up.b));
    const splits = splitPointsOnSeg(base, [base, up]);
    assert.equal(splits.length, 3);
    const parts = subSegments(base, [base, up]);
    assert.equal(parts.length, 2);
    assert.equal(Math.round(parts[0]!.a.x + parts[0]!.b.x), 5);
  });

  it("formats length to two decimals with third-digit rounding", () => {
    assert.equal(formatLength(3.141), "3.14");
    assert.equal(formatLength(3.145), "3.15");
    assert.equal(formatLength(2), "2.00");
  });

  it("picks the nearest sub-segment chunk under the pointer", () => {
    const base = { id: "b", a: { x: 0, y: 0 }, b: { x: 10, y: 0 } };
    const up = { id: "u", a: { x: 5, y: 0 }, b: { x: 5, y: 8 } };
    const segs = [base, up];
    const leftHit = nearestSubSegment({ x: 2, y: 0.1 }, segs);
    assert.ok(leftHit);
    assert.equal(leftHit!.chunkIndex, 0);
    const rightHit = nearestSubSegment({ x: 7, y: 0.1 }, segs);
    assert.ok(rightHit);
    assert.equal(rightHit!.chunkIndex, 1);
  });
});
