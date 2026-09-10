import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyAngleNumeric,
  applyEditedLabel,
  applyLengthNumeric,
  autoAngleValue,
  autoLengthValue,
  deriveQuad,
  deriveThree,
  deriveTri,
  deriveTwo,
  isLengthPinned,
  lengthEndpoints,
  nudgeMeasureLabel,
  nudgeMeasureLine,
  tangentLengths,
  toggleLength,
  cycleLength,
  findLength,
} from "@/lib/diagrams/circle-tangents/geometry";
import {
  DEFAULT_TANGENTS_STATE,
  TANGENT_PRESETS,
  normalizeState,
  withKind,
} from "@/lib/diagrams/circle-tangents/model";
import {
  buildTangentsScene,
  hitTestFigure,
  mathToCanvas,
  measureFrame,
} from "@/lib/diagrams/circle-tangents/scene";

describe("circle-tangents geometry", () => {
  it("derives equal tangents from an external point", () => {
    const d = deriveTwo(DEFAULT_TANGENTS_STATE);
    assert.ok(d);
    assert.ok(Math.abs(d!.tangentLen - Math.sqrt(10 * 10 - 6 * 6)) < 1e-6);
    const pa = Math.hypot(d!.P.x - d!.A.x, d!.P.y - d!.A.y);
    const pb = Math.hypot(d!.P.x - d!.B.x, d!.P.y - d!.B.y);
    assert.ok(Math.abs(pa - pb) < 1e-6);
  });

  it("derives triangle incircle touch points", () => {
    const state = withKind(DEFAULT_TANGENTS_STATE, "incircle-triangle");
    const d = deriveTri(state);
    assert.ok(d);
    const [tA, tB, tC] = tangentLengths(d!.A, d!.B, d!.C);
    assert.ok(Math.abs(d!.tA - tA) < 1e-6);
    assert.ok(Math.abs(d!.r - Math.hypot(d!.O.x - d!.Q.x, d!.O.y - d!.Q.y)) < 1e-4);
  });

  it("derives a tangential quadrilateral", () => {
    const state = withKind(DEFAULT_TANGENTS_STATE, "tangential-quad");
    const d = deriveQuad(state);
    assert.ok(d);
    const ab = Math.hypot(d!.A.x - d!.B.x, d!.A.y - d!.B.y);
    const cd = Math.hypot(d!.C.x - d!.D.x, d!.C.y - d!.D.y);
    const ad = Math.hypot(d!.A.x - d!.D.x, d!.A.y - d!.D.y);
    const bc = Math.hypot(d!.B.x - d!.C.x, d!.B.y - d!.C.y);
    assert.ok(Math.abs(ab + cd - (ad + bc)) < 1e-4);
  });

  it("derives three-tangents excircle figure", () => {
    const state = withKind(DEFAULT_TANGENTS_STATE, "three-tangents");
    const d = deriveThree(state);
    assert.ok(d);
    assert.ok(d!.r > 0.2);
    const ad = Math.hypot(d!.A.x - d!.D.x, d!.A.y - d!.D.y);
    const af = Math.hypot(d!.A.x - d!.F.x, d!.A.y - d!.F.y);
    assert.ok(Math.abs(ad - af) < 1e-4);
  });
});

describe("circle-tangents scene", () => {
  it("builds a scene for every preset", () => {
    for (const preset of TANGENT_PRESETS) {
      const scene = buildTangentsScene(normalizeState(preset.state));
      assert.ok(scene.cmds.some((c) => c.t === "circle"));
      assert.ok(scene.texts.length > 0);
    }
  });

  it("draws right angles for the pythagorean preset", () => {
    const preset = TANGENT_PRESETS.find((p) => p.id === "two-pythag-6-10");
    assert.ok(preset);
    const scene = buildTangentsScene(normalizeState(preset!.state));
    assert.ok(scene.cmds.filter((c) => c.t === "rightAngle").length >= 2);
  });

  it("keeps the circle fully inside the canvas for the pythagorean preset", () => {
    const preset = TANGENT_PRESETS.find((p) => p.id === "two-pythag-6-10");
    assert.ok(preset);
    const scene = buildTangentsScene(normalizeState(preset!.state));
    const circle = scene.cmds.find((c) => c.t === "circle");
    assert.ok(circle && circle.t === "circle");
    if (!circle || circle.t !== "circle") return;
    const margin = 1;
    assert.ok(circle.x - circle.r >= margin);
    assert.ok(circle.y - circle.r >= margin);
    assert.ok(circle.x + circle.r <= scene.width - margin);
    assert.ok(circle.y + circle.r <= scene.height - margin);
  });

  it("computes an orthonormal measureFrame for segment and handles :line suffix", () => {
    const state = DEFAULT_TANGENTS_STATE;
    const scene = buildTangentsScene(state);
    const frame = measureFrame(state, scene, "PA");
    assert.ok(frame);
    // along and outward must be unit vectors
    const lenAlong = Math.hypot(frame!.along.x, frame!.along.y);
    const lenOut = Math.hypot(frame!.outward.x, frame!.outward.y);
    assert.ok(Math.abs(lenAlong - 1) < 1e-6);
    assert.ok(Math.abs(lenOut - 1) < 1e-6);
    // along and outward must be perpendicular (dot product = 0)
    const dot = frame!.along.x * frame!.outward.x + frame!.along.y * frame!.outward.y;
    assert.ok(Math.abs(dot) < 1e-6);

    // :line suffix produces same frame
    const lineFrame = measureFrame(state, scene, "PA:line");
    assert.deepEqual(frame, lineFrame);
  });

  it("projects cursor displacement accurately onto segment frame", () => {
    const state = DEFAULT_TANGENTS_STATE;
    const scene = buildTangentsScene(state);
    const frame = measureFrame(state, scene, "PA");
    assert.ok(frame);

    // If we move 10 pixels strictly along `along`, dx should increase by 10
    const nudgedAlong = nudgeMeasureLabel(
      state,
      "PA",
      frame!.along.x * 10,
      frame!.along.y * 10,
      frame!.along,
      frame!.outward,
      frame!.halfSpan,
    );
    assert.ok(Math.abs(nudgedAlong.two.lengths.PA.label.dx - 10) < 1e-4);
    assert.ok(Math.abs(nudgedAlong.two.lengths.PA.label.dy - 0) < 1e-4);

    // If we move 15 pixels strictly along `outward`, dy should increase by 15
    const nudgedOut = nudgeMeasureLabel(
      state,
      "PA",
      frame!.outward.x * 15,
      frame!.outward.y * 15,
      frame!.along,
      frame!.outward,
      frame!.halfSpan,
    );
    assert.ok(Math.abs(nudgedOut.two.lengths.PA.label.dx - 0) < 1e-4);
    assert.ok(Math.abs(nudgedOut.two.lengths.PA.label.dy - 15) < 1e-4);

    // Dim line nudge adjusts lineDy along outward
    const nudgedLine = nudgeMeasureLine(
      state,
      "PA:line",
      frame!.outward.x * 12,
      frame!.outward.y * 12,
      frame!.along,
      frame!.outward,
    );
    assert.ok(Math.abs((nudgedLine.two.lengths.PA.label.lineDy ?? 0) - 12) < 1e-4);
  });

  it("handles view rotation correctly in measureFrame", () => {
    const state0 = DEFAULT_TANGENTS_STATE;
    const stateRot = { ...DEFAULT_TANGENTS_STATE, viewRotationDeg: 90 };
    const scene0 = buildTangentsScene(state0);
    const sceneRot = buildTangentsScene(stateRot);

    const frame0 = measureFrame(state0, scene0, "PA");
    const frameRot = measureFrame(stateRot, sceneRot, "PA");
    assert.ok(frame0 && frameRot);

    // Rotated frame must also be orthonormal
    const dotRot = frameRot!.along.x * frameRot!.outward.x + frameRot!.along.y * frameRot!.outward.y;
    assert.ok(Math.abs(dotRot) < 1e-6);

    // Projection of any canvas delta (e.g. [5, -3]) back to along/outward reconstructs the vector
    const testDx = 5;
    const testDy = -3;
    const alongAmt = testDx * frameRot!.along.x + testDy * frameRot!.along.y;
    const perpAmt = testDx * frameRot!.outward.x + testDy * frameRot!.outward.y;
    const reconstructedX = frameRot!.along.x * alongAmt + frameRot!.outward.x * perpAmt;
    const reconstructedY = frameRot!.along.y * alongAmt + frameRot!.outward.y * perpAmt;
    assert.ok(Math.abs(reconstructedX - testDx) < 1e-6);
    assert.ok(Math.abs(reconstructedY - testDy) < 1e-6);
  });

  it("returns screen identity frame for angle labels", () => {
    const state = DEFAULT_TANGENTS_STATE;
    const scene = buildTangentsScene(state);
    const frameAng = measureFrame(state, scene, "angP");
    assert.ok(frameAng);
    assert.deepEqual(frameAng!.along, { x: 1, y: 0 });
    assert.deepEqual(frameAng!.outward, { x: 0, y: 1 });
  });
});

describe("circle-tangents numeric reshape", () => {
  it("reshapes two-tangents length PA while preserving radius r", () => {
    const s0 = DEFAULT_TANGENTS_STATE; // r = 6, opDist = 10, PA = 8
    const s1 = applyLengthNumeric(s0, "PA", 12);
    assert.equal(s1.radius, 6);
    const d1 = deriveTwo(s1);
    assert.ok(d1);
    assert.ok(Math.abs(d1!.tangentLen - 12) < 1e-4);
    assert.ok(Math.abs(d1!.opDist - Math.sqrt(12 * 12 + 6 * 6)) < 1e-4);
  });

  it("reshapes two-tangents radius OA while preserving tangent length", () => {
    const s0 = DEFAULT_TANGENTS_STATE; // r = 6, opDist = 10, PA = 8
    const s1 = applyLengthNumeric(s0, "OA", 8);
    assert.equal(s1.radius, 8);
    const d1 = deriveTwo(s1);
    assert.ok(d1);
    // tangent length should be preserved at 8, so opDist = sqrt(8^2 + 8^2)
    assert.ok(Math.abs(d1!.tangentLen - 8) < 1e-4);
    assert.ok(Math.abs(d1!.opDist - Math.sqrt(8 * 8 + 8 * 8)) < 1e-4);
  });

  it("reshapes two-tangents angle angP while preserving radius r", () => {
    const s0 = DEFAULT_TANGENTS_STATE; // r = 6
    const s1 = applyAngleNumeric(s0, "angP", 60);
    assert.equal(s1.radius, 6);
    const d1 = deriveTwo(s1);
    assert.ok(d1);
    // sin(30 deg) = 0.5, opDist = 6 / 0.5 = 12
    assert.ok(Math.abs(d1!.opDist - 12) < 1e-4);
    const ang = autoAngleValue(s1, "angP");
    assert.ok(ang && Math.abs(ang - 60) < 1e-3);
  });

  it("reshapes incircle-triangle tangent piece while preserving other pieces", () => {
    const s0 = withKind(DEFAULT_TANGENTS_STATE, "incircle-triangle");
    const d0 = deriveTri(s0);
    assert.ok(d0);
    const origTB = d0!.tB;
    const origTC = d0!.tC;

    // Change AP (which is tA) to 4.5
    const s1 = applyLengthNumeric(s0, "AP", 4.5);
    const d1 = deriveTri(s1);
    assert.ok(d1);
    assert.ok(Math.abs(d1!.tA - 4.5) < 1e-4);
    assert.ok(Math.abs(d1!.tB - origTB) < 1e-4);
    assert.ok(Math.abs(d1!.tC - origTC) < 1e-4);
  });

  it("reshapes tangential-quad tangent pieces and preserves tangency condition", () => {
    const s0 = withKind(DEFAULT_TANGENTS_STATE, "tangential-quad");
    const s1 = applyLengthNumeric(s0, "AP", 5.0);
    const d1 = deriveQuad(s1);
    assert.ok(d1);
    assert.ok(Math.abs(d1!.tA - 5.0) < 1e-2);
    // AB + CD = AD + BC must still hold for tangential quad
    const ab = Math.hypot(d1!.A.x - d1!.B.x, d1!.A.y - d1!.B.y);
    const cd = Math.hypot(d1!.C.x - d1!.D.x, d1!.C.y - d1!.D.y);
    const ad = Math.hypot(d1!.A.x - d1!.D.x, d1!.A.y - d1!.D.y);
    const bc = Math.hypot(d1!.B.x - d1!.C.x, d1!.B.y - d1!.C.y);
    assert.ok(Math.abs(ab + cd - (ad + bc)) < 1e-3);
  });

  it("applies edited label with numeric strings across kinds", () => {
    const s0 = DEFAULT_TANGENTS_STATE;
    const s1 = applyEditedLabel(s0, "PA", "15 cm");
    const d1 = deriveTwo(s1);
    assert.ok(d1);
    assert.ok(Math.abs(d1!.tangentLen - 15) < 1e-4);
  });

  it("hits a segment line command with hitTestFigure", () => {
    const state = DEFAULT_TANGENTS_STATE;
    const scene = buildTangentsScene(state);
    const paLine = scene.cmds.find((c) => c.t === "line" && c.id === "PA");
    assert.ok(paLine && paLine.t === "line");
    if (!paLine || paLine.t !== "line") return;
    const midX = (paLine.x1 + paLine.x2) / 2;
    const midY = (paLine.y1 + paLine.y2) / 2;
    const hit = hitTestFigure(state, scene, midX, midY, 1);
    assert.ok(hit);
    assert.equal(hit!.kind, "seg");
    assert.equal(hit!.id, "PA");
  });

  it("strictly preserves already pinned lengths when sequentially editing tangential-quad", () => {
    // Default quad preset: AP=4 (pinned), BQ=6 (pinned), CR=5 (pinned), DS=x (unpinned)
    const s0 = withKind(DEFAULT_TANGENTS_STATE, "tangential-quad");
    assert.ok(isLengthPinned(s0, "AP"));
    assert.ok(isLengthPinned(s0, "BQ"));
    assert.ok(isLengthPinned(s0, "CR"));
    assert.ok(!isLengthPinned(s0, "DS"));

    // 1. Change AP to 5
    const s1 = applyLengthNumeric(s0, "AP", 5.0);
    const d1 = deriveQuad(s1);
    assert.ok(d1);
    assert.ok(Math.abs(d1!.tA - 5.0) < 1e-2);
    // BQ (tB=6) and CR (tC=5) MUST NOT CHANGE!
    assert.ok(Math.abs(d1!.tB - 6.0) < 1e-2);
    assert.ok(Math.abs(d1!.tC - 5.0) < 1e-2);

    // 2. Change BQ to 7
    const s2 = applyLengthNumeric(s1, "BQ", 7.0);
    const d2 = deriveQuad(s2);
    assert.ok(d2);
    assert.ok(Math.abs(d2!.tB - 7.0) < 1e-2);
    // AP (tA=5) and CR (tC=5) MUST NOT CHANGE!
    assert.ok(Math.abs(d2!.tA - 5.0) < 1e-2);
    assert.ok(Math.abs(d2!.tC - 5.0) < 1e-2);

    // 3. Change CR to 8
    const s3 = applyLengthNumeric(s2, "CR", 8.0);
    const d3 = deriveQuad(s3);
    assert.ok(d3);
    assert.ok(Math.abs(d3!.tC - 8.0) < 1e-2);
    // AP (tA=5) and BQ (tB=7) MUST NOT CHANGE!
    assert.ok(Math.abs(d3!.tA - 5.0) < 1e-2);
    assert.ok(Math.abs(d3!.tB - 7.0) < 1e-2);
  });

  it("keeps pinned AB side unchanged when adjusting BC side with unpinned CA in incircle-triangle", () => {
    const s0 = withKind(DEFAULT_TANGENTS_STATE, "incircle-triangle");
    // Default tri has AB=10 cm, BC=14 cm, CA=8 cm
    // Mark CA as unknown 'x'
    const s1 = {
      ...s0,
      tri: {
        ...s0.tri,
        sides: {
          ...s0.tri.sides,
          CA: { ...s0.tri.sides.CA, show: true, label: { ...s0.tri.sides.CA.label, mode: "x" as const } },
        },
      },
    };
    assert.ok(isLengthPinned(s1, "AB"));
    assert.ok(!isLengthPinned(s1, "CA"));

    const d1 = deriveTri(s1);
    assert.ok(d1);
    const abBefore = Math.hypot(d1!.A.x - d1!.B.x, d1!.A.y - d1!.B.y);

    // Adjust BC from 14 to 12
    const s2 = applyLengthNumeric(s1, "BC", 12.0);
    const d2 = deriveTri(s2);
    assert.ok(d2);
    const abAfter = Math.hypot(d2!.A.x - d2!.B.x, d2!.A.y - d2!.B.y);
    const bcAfter = Math.hypot(d2!.B.x - d2!.C.x, d2!.B.y - d2!.C.y);

    // BC must become 12
    assert.ok(Math.abs(bcAfter - 12.0) < 1e-2);
    // AB MUST REMAIN STRICTLY UNCHANGED!
    assert.ok(Math.abs(abAfter - abBefore) < 1e-3);
  });

  it("toggles length visibility on and off with toggleLength", () => {
    const s0 = DEFAULT_TANGENTS_STATE;
    assert.equal(s0.two.lengths.PA.show, true);
    const s1 = toggleLength(s0, "PA");
    assert.equal(s1.two.lengths.PA.show, false);
    const s2 = toggleLength(s1, "PA");
    assert.equal(s2.two.lengths.PA.show, true);
  });

  it("cycles length display with cycleLength", () => {
    const s0 = normalizeState(DEFAULT_TANGENTS_STATE);
    const s1 = cycleLength(s0, "PA");
    assert.equal(findLength(s1, "PA")?.show, true);
    assert.equal(findLength(s1, "PA")?.label.mode, "x");
    const s2 = cycleLength(s1, "PA");
    assert.equal(findLength(s2, "PA")?.show, false);
    const s3 = cycleLength(s2, "PA");
    assert.equal(findLength(s3, "PA")?.show, true);
    assert.equal(findLength(s3, "PA")?.label.mode, "auto");
  });

  it("detects sub-segment clicks in incircle-triangle and tangential-quad via hitTestFigure", () => {
    // 1. incircle-triangle: with AB shown by default, click detects shown full side AB
    const sTriDefault = withKind(DEFAULT_TANGENTS_STATE, "incircle-triangle");
    const sceneTriDefault = buildTangentsScene(sTriDefault);
    const endsTriAB = lengthEndpoints(sTriDefault, "AB");
    assert.ok(endsTriAB);
    const c1AB = mathToCanvas(endsTriAB![0], sceneTriDefault.layout);
    const c2AB = mathToCanvas(endsTriAB![1], sceneTriDefault.layout);
    const pAB = { x: c1AB.x * 0.75 + c2AB.x * 0.25, y: c1AB.y * 0.75 + c2AB.y * 0.25 };
    const hitAB = hitTestFigure(sTriDefault, sceneTriDefault, pAB.x, pAB.y);
    assert.ok(hitAB);
    assert.equal(hitAB!.kind, "seg");
    assert.equal(hitAB!.id, "AB");

    // With AP shown and AB hidden, click detects AP
    const sTriAP = toggleLength(toggleLength(sTriDefault, "AB"), "AP");
    const sceneTriAP = buildTangentsScene(sTriAP);
    const endsTriAP = lengthEndpoints(sTriAP, "AP");
    const c1AP = mathToCanvas(endsTriAP![0], sceneTriAP.layout);
    const c2AP = mathToCanvas(endsTriAP![1], sceneTriAP.layout);
    const midAP = { x: (c1AP.x + c2AP.x) / 2, y: (c1AP.y + c2AP.y) / 2 };
    const hitAP = hitTestFigure(sTriAP, sceneTriAP, midAP.x, midAP.y);
    assert.ok(hitAP);
    assert.equal(hitAP!.kind, "seg");
    assert.equal(hitAP!.id, "AP");

    // 2. tangential-quad: test click on AP midpoint (AP shown by default)
    const sQuad = withKind(DEFAULT_TANGENTS_STATE, "tangential-quad");
    const sceneQuad = buildTangentsScene(sQuad);
    const endsQuad = lengthEndpoints(sQuad, "AP");
    assert.ok(endsQuad);
    const c1Quad = mathToCanvas(endsQuad![0], sceneQuad.layout);
    const c2Quad = mathToCanvas(endsQuad![1], sceneQuad.layout);
    const midQuad = { x: (c1Quad.x + c2Quad.x) / 2, y: (c1Quad.y + c2Quad.y) / 2 };
    const hitQuad = hitTestFigure(sQuad, sceneQuad, midQuad.x, midQuad.y);
    assert.ok(hitQuad);
    assert.equal(hitQuad!.kind, "seg");
    assert.equal(hitQuad!.id, "AP");

    // 3. tangential-quad: with AD shown and DS off, click along AD detects full side AD
    const sQuadAD = toggleLength(toggleLength(sQuad, "DS"), "AD");
    const sceneQuadAD = buildTangentsScene(sQuadAD);
    const endsQuadAD = lengthEndpoints(sQuadAD, "AD");
    assert.ok(endsQuadAD);
    const c1AD = mathToCanvas(endsQuadAD![0], sceneQuadAD.layout);
    const c2AD = mathToCanvas(endsQuadAD![1], sceneQuadAD.layout);
    const pAD = { x: c1AD.x * 0.8 + c2AD.x * 0.2, y: c1AD.y * 0.8 + c2AD.y * 0.2 };
    const hitAD = hitTestFigure(sQuadAD, sceneQuadAD, pAD.x, pAD.y);
    assert.ok(hitAD);
    assert.equal(hitAD!.id, "AD");
    assert.equal(hitAD!.kind, "seg");
  });

  it("supports displaying and adjusting full side lengths AD and BC in tangential-quad", () => {
    const s0 = withKind(DEFAULT_TANGENTS_STATE, "tangential-quad");
    assert.equal(findLength(s0, "AD")?.show, false);
    assert.equal(findLength(s0, "BC")?.show, false);

    // Toggle AD and BC to shown
    const s1 = toggleLength(s0, "AD");
    assert.equal(findLength(s1, "AD")?.show, true);
    const s2 = toggleLength(s1, "BC");
    assert.equal(findLength(s2, "BC")?.show, true);

    // Adjust side BC to 11
    const s3 = applyLengthNumeric(s2, "BC", 11.0);
    const d3 = deriveQuad(s3);
    assert.ok(d3);
    const bcLen = Math.hypot(d3!.B.x - d3!.C.x, d3!.B.y - d3!.C.y);
    assert.ok(Math.abs(bcLen - 11.0) < 1e-2);

    // Adjust side AD to 8
    const s4 = applyLengthNumeric(s3, "AD", 8.0);
    const d4 = deriveQuad(s4);
    assert.ok(d4);
    const adLen = Math.hypot(d4!.A.x - d4!.D.x, d4!.A.y - d4!.D.y);
    assert.ok(Math.abs(adLen - 8.0) < 1e-2);

    // Pitot theorem AB + CD = AD + BC must hold
    const ab = Math.hypot(d4!.A.x - d4!.B.x, d4!.A.y - d4!.B.y);
    const cd = Math.hypot(d4!.C.x - d4!.D.x, d4!.C.y - d4!.D.y);
    const ad = Math.hypot(d4!.A.x - d4!.D.x, d4!.A.y - d4!.D.y);
    const bc = Math.hypot(d4!.B.x - d4!.C.x, d4!.B.y - d4!.C.y);
    assert.ok(Math.abs(ab + cd - (ad + bc)) < 1e-3);
  });
});

