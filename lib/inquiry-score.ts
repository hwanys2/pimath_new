/**
 * Inquiry session scoring helpers.
 * Draft autosave used to wipe `result` to null — always re-grade from
 * the stored payload when the row is a draft or ungraded.
 */

import type { InquiryContentKey } from "@/lib/inquiry-content-registry";
import { gradeEquationOpsStep } from "@/lib/inquiry-equation-ops";
import { gradeBalanceStep } from "@/lib/inquiry-linear-equation-balance";
import { gradeRadicalFillStep } from "@/lib/inquiry-radical-fill";
import { gradeSincosStep } from "@/lib/inquiry-sincos-intro";
import { gradeTangentStep } from "@/lib/inquiry-tangent-intro";
import type { InquiryResult } from "@/lib/inquiry-types";
import {
  balanceWorkspaceFromResponse,
  equationOpsStateFromResponse,
  radicalTextsFromResponse,
  sincosWorkspaceFromResponse,
  tangentWorkspaceFromResponse,
} from "@/lib/inquiry-workspace-restore";

export type InquiryScoreRow = {
  studentId: string;
  stepIndex: number;
  result: InquiryResult | null;
  response: Record<string, unknown>;
};

function wrongsOf(response: Record<string, unknown>): number {
  const w = response.wrongs;
  return typeof w === "number" && Number.isFinite(w)
    ? Math.max(0, Math.floor(w))
    : 0;
}

function isDraftResponse(response: Record<string, unknown>): boolean {
  return response.draft === true;
}

function looksSincos(response: Record<string, unknown>): boolean {
  const kind = response.kind;
  if (kind === "scene") return true;
  if (response.sinRatios || response.cosRatios || response.sinNameText) {
    return true;
  }
  return kind !== "height" && typeof response.adj === "string";
}

function looksTangent(response: Record<string, unknown>): boolean {
  const kind = response.kind;
  if (kind === "height") return true;
  if (kind === "table" && response.ratios && !response.sinRatios) return true;
  if (
    kind === "define" &&
    typeof response.nameText === "string" &&
    !("sinNameText" in response)
  ) {
    return true;
  }
  return false;
}

/** Prefer payload shape over a stale session content_key. */
export function inferInquiryScoringKey(
  sessionKey: string | null | undefined,
  responses: Array<{ response: Record<string, unknown> }>,
): InquiryContentKey | null {
  let sincos = 0;
  let tangent = 0;
  for (const row of responses) {
    if (looksSincos(responseOf(row))) sincos += 1;
    if (looksTangent(responseOf(row))) tangent += 1;
  }
  if (sincos > tangent && sincos > 0) return "g3-u3-1-sincos-intro";
  if (tangent > sincos && tangent > 0) return "g3-u3-1-tangent-intro";
  if (sessionKey && isScoringKey(sessionKey)) return sessionKey;
  return null;
}

function isScoringKey(key: string): key is InquiryContentKey {
  return (
    key === "g3-u1-radical-fill" ||
    key === "g1-u2-2-linear-equation-balance" ||
    key === "g1-u2-2-linear-equation-race" ||
    key === "g3-u3-1-tangent-intro" ||
    key === "g3-u3-1-sincos-intro"
  );
}

function responseOf(row: { response: Record<string, unknown> }) {
  return row.response ?? {};
}

export function resolveInquiryResult(
  contentKey: InquiryContentKey,
  stepIndex: number,
  result: InquiryResult | null,
  response: Record<string, unknown>,
): InquiryResult | null {
  if (result && !isDraftResponse(response)) return result;

  const wrongs = wrongsOf(response);
  switch (contentKey) {
    case "g3-u3-1-sincos-intro": {
      const { workspace } = sincosWorkspaceFromResponse(stepIndex, response);
      return gradeSincosStep(stepIndex, workspace, wrongs).result;
    }
    case "g3-u3-1-tangent-intro": {
      const { workspace } = tangentWorkspaceFromResponse(stepIndex, response);
      return gradeTangentStep(stepIndex, workspace, wrongs).result;
    }
    case "g3-u1-radical-fill": {
      const { texts } = radicalTextsFromResponse(stepIndex, response);
      const gaveUp = response.gaveUp === true;
      return gradeRadicalFillStep(stepIndex, texts, wrongs, gaveUp).result;
    }
    case "g1-u2-2-linear-equation-balance": {
      const { workspace, moves } = balanceWorkspaceFromResponse(
        stepIndex,
        response,
      );
      const gaveUp = response.gaveUp === true;
      return gradeBalanceStep(stepIndex, workspace, wrongs, gaveUp, moves)
        .result;
    }
    case "g1-u2-2-linear-equation-race": {
      const { state } = equationOpsStateFromResponse(stepIndex, response);
      const elapsedMs =
        typeof response.elapsedMs === "number" ? response.elapsedMs : 0;
      return gradeEquationOpsStep(stepIndex, state, wrongs, elapsedMs).result;
    }
  }
}

export function withResolvedInquiryResults(
  contentKey: InquiryContentKey,
  responses: InquiryScoreRow[],
): InquiryScoreRow[] {
  return responses.map((row) => ({
    ...row,
    result: resolveInquiryResult(
      contentKey,
      row.stepIndex,
      row.result,
      row.response,
    ),
  }));
}
