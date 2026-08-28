import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  inferInquiryScoringKey,
  resolveInquiryResult,
  withResolvedInquiryResults,
} from "@/lib/inquiry-score";
import {
  expectedAdj,
  expectedOpp,
  HYP_SCENES,
  PROBLEM_COUNT,
  aggregateSincosScore,
  gradeSincosStep,
  emptySincosWorkspace,
  type SincosResponsePayload,
} from "@/lib/inquiry-sincos-intro";

describe("inferInquiryScoringKey", () => {
  it("picks sincos when scene payloads outnumber height rows", () => {
    const key = inferInquiryScoringKey("g3-u3-1-tangent-intro", [
      { response: { kind: "scene", adj: "23.7", opp: "19.9" } },
      { response: { kind: "scene", adj: "21", opp: "18" } },
      { response: { kind: "height", heightM: "24" } },
      {
        response: {
          kind: "table",
          sinRatios: { "30": "0.5" },
          cosRatios: {},
        },
      },
    ]);
    assert.equal(key, "g3-u3-1-sincos-intro");
  });

  it("falls back to the session key when payloads are ambiguous", () => {
    const key = inferInquiryScoringKey("g3-u1-radical-fill", [
      { response: { fills: [] } },
    ]);
    assert.equal(key, "g3-u1-radical-fill");
  });
});

describe("resolveInquiryResult", () => {
  it("keeps a stored grade when the row is not a draft", () => {
    const result = resolveInquiryResult(
      "g3-u3-1-sincos-intro",
      0,
      "correct",
      { kind: "scene", adj: "", opp: "", methodText: "", wrongs: 0 },
    );
    assert.equal(result, "correct");
  });

  it("re-grades a draft that still has the correct kite answer", () => {
    const kite = HYP_SCENES[0]!;
    const ws = emptySincosWorkspace(0);
    ws.adjText = String(expectedAdj(kite, 40));
    ws.oppText = String(expectedOpp(kite, 40));
    ws.methodText = "비슷한 삼각형을 그려 비를 구했어요.";
    const graded = gradeSincosStep(0, ws, 0);
    assert.equal(graded.result, "correct");

    const result = resolveInquiryResult("g3-u3-1-sincos-intro", 0, null, {
      ...graded.response,
      draft: true,
    });
    assert.equal(result, "correct");
  });

  it("does not award points for an empty draft", () => {
    const result = resolveInquiryResult("g3-u3-1-sincos-intro", 0, null, {
      kind: "scene",
      draft: true,
      adj: "",
      opp: "",
      methodText: "",
      wrongs: 0,
    });
    assert.equal(result, "wrong");
  });
});

describe("withResolvedInquiryResults", () => {
  it("scores wiped sincos drafts instead of storing 0", () => {
    const kite = HYP_SCENES[0]!;
    const ws = emptySincosWorkspace(0);
    ws.adjText = String(expectedAdj(kite, 40));
    ws.oppText = String(expectedOpp(kite, 40));
    ws.methodText = "작도해서 구했어요.";
    const graded = gradeSincosStep(0, ws, 1);

    const resolved = withResolvedInquiryResults("g3-u3-1-sincos-intro", [
      {
        studentId: "11111111-1111-1111-1111-111111111111",
        stepIndex: 0,
        result: null,
        response: { ...graded.response, draft: true },
      },
    ]);
    const agg = aggregateSincosScore(
      resolved.map((r) => ({
        stepIndex: r.stepIndex,
        result: r.result,
        response: r.response as SincosResponsePayload,
      })),
      PROBLEM_COUNT,
    );
    assert.equal(agg.correctCount, 1);
    assert.equal(agg.score, 85);
  });
});
