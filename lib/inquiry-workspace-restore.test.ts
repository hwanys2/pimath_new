import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  balanceWorkspaceFromResponse,
  equationOpsStateFromResponse,
  hasRestorableResponse,
  restoreInquiryStep,
  sincosWorkspaceFromResponse,
  tangentWorkspaceFromResponse,
} from "@/lib/inquiry-workspace-restore";
import { gradeTangentStep, emptyTangentWorkspace } from "@/lib/inquiry-tangent-intro";
import { gradeSincosStep, emptySincosWorkspace } from "@/lib/inquiry-sincos-intro";

describe("inquiry workspace restore", () => {
  it("detects restorable tangent height response", () => {
    const ws = emptyTangentWorkspace(0);
    ws.heightText = "24";
    ws.methodText = "비슷한 삼각형";
    const graded = gradeTangentStep(0, ws, 2);
    assert.equal(hasRestorableResponse(graded.response), true);

    const { workspace, meta } = tangentWorkspaceFromResponse(
      0,
      graded.response as unknown as Record<string, unknown>,
    );
    assert.equal(workspace.heightText, "24");
    assert.equal(workspace.methodText, "비슷한 삼각형");
    assert.equal(meta.wrongAttempts, 2);
    assert.equal(meta.submitted, true);
  });

  it("restores tangent table ratios", () => {
    const ws = emptyTangentWorkspace(3);
    ws.ratios["45"] = "1";
    ws.methodText = "표 작성";
    const graded = gradeTangentStep(3, ws, 0);
    const { workspace } = tangentWorkspaceFromResponse(
      3,
      graded.response as unknown as Record<string, unknown>,
    );
    assert.equal(workspace.ratios["45"], "1");
    assert.equal(workspace.methodText, "표 작성");
  });

  it("restores tangent naming step", () => {
    const ws = emptyTangentWorkspace(4);
    ws.nameText = "tangent";
    const graded = gradeTangentStep(4, ws, 1);
    assert.equal(hasRestorableResponse(graded.response as unknown as Record<string, unknown>), true);
    const { workspace, meta } = tangentWorkspaceFromResponse(
      4,
      graded.response as unknown as Record<string, unknown>,
    );
    assert.equal(workspace.nameText, "tangent");
    assert.equal(meta.wrongAttempts, 1);
    assert.equal(meta.submitted, true);
  });

  it("restores sincos scene with baseT", () => {
    const ws = emptySincosWorkspace(0);
    ws.adjText = "23";
    ws.oppText = "19";
    ws.baseT = 0.55;
    ws.methodText = "작도";
    const graded = gradeSincosStep(0, ws, 1);
    const { workspace, meta } = sincosWorkspaceFromResponse(
      0,
      graded.response as unknown as Record<string, unknown>,
    );
    assert.equal(workspace.adjText, "23");
    assert.equal(workspace.oppText, "19");
    assert.equal(workspace.baseT, 0.55);
    assert.equal(meta.wrongAttempts, 1);
  });

  it("routes through restoreInquiryStep", () => {
    const ws = emptyTangentWorkspace(0);
    ws.heightText = "24";
    ws.methodText = "계산";
    const graded = gradeTangentStep(0, ws, 0);
    const restored = restoreInquiryStep(
      "g3-u3-1-tangent-intro",
      0,
      graded.response as unknown as Record<string, unknown>,
    );
    assert.ok(restored);
    assert.equal(restored?.kind, "tangent");
    if (restored?.kind !== "tangent") throw new Error("expected tangent");
    assert.equal(restored.workspace.heightText, "24");
  });

  it("restores balance workspace from pan counts", () => {
    const { workspace, moves } = balanceWorkspaceFromResponse(0, {
      left: { x: 1, unit: 3 },
      right: { x: 0, unit: 8 },
      moves: 4,
      wrongs: 2,
    });
    assert.equal(workspace.left.length, 4);
    assert.equal(moves, 4);
  });

  it("restores equation race state when balance is stored", () => {
    const { state } = equationOpsStateFromResponse(0, {
      trail: [{ latex: "x+3=8", label: "시작" }],
      opCount: 2,
      elapsedMs: 1000,
      wrongs: 0,
      balance: {
        left: { x: 1, unit: 0 },
        right: { x: 0, unit: 5 },
      },
    });
    assert.equal(state.balance.left.x, 1);
    assert.equal(state.balance.right.unit, 5);
    assert.equal(state.opCount, 2);
  });
});
