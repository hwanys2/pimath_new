/**
 * Restore inquiry student workspace from saved step response jsonb.
 * Used after refresh and when re-entering a live step.
 */

import type { TermTexts } from "@/components/inquiry/radical-fill/InquiryRadicalFillStep";
import {
  initialState as equationOpsInitialState,
  type EquationOpsState,
} from "@/lib/equation-ops-math";
import type { BalanceFillResponsePayload } from "@/lib/inquiry-linear-equation-balance";
import type { EquationOpsResponsePayload } from "@/lib/inquiry-equation-ops";
import type { InquiryContentKey } from "@/lib/inquiry-content-registry";
import type { RadicalFillResponsePayload } from "@/lib/inquiry-radical-fill";
import {
  emptyTangentWorkspace,
  type TangentResponsePayload,
  type TangentWorkspace,
} from "@/lib/inquiry-tangent-intro";
import {
  emptySincosWorkspace,
  type SincosResponsePayload,
  type SincosWorkspace,
} from "@/lib/inquiry-sincos-intro";
import {
  emptyTileWorkspace,
  problemAt,
  workspaceFromBalance,
  type TileWorkspace,
} from "@/lib/linear-equation-balance-math";

export type RestoredInquiryStep = {
  wrongAttempts: number;
  submitted: boolean;
};

function wrongsFromResponse(response: Record<string, unknown>): number {
  const w = response.wrongs;
  return typeof w === "number" && Number.isFinite(w) ? Math.max(0, Math.floor(w)) : 0;
}

export function tangentWorkspaceFromResponse(
  stepIndex: number,
  raw: Record<string, unknown>,
): { workspace: TangentWorkspace; meta: RestoredInquiryStep } {
  const base = emptyTangentWorkspace(stepIndex);
  const response = raw as TangentResponsePayload;
  const meta: RestoredInquiryStep = {
    wrongAttempts: wrongsFromResponse(raw),
    submitted: true,
  };

  if (response.kind === "height") {
    return {
      workspace: {
        ...base,
        distanceM:
          typeof response.distanceM === "number"
            ? response.distanceM
            : base.distanceM,
        heightText:
          typeof response.heightM === "string" ? response.heightM : "",
        methodText:
          typeof response.methodText === "string" ? response.methodText : "",
      },
      meta,
    };
  }

  if (response.kind === "table") {
    return {
      workspace: {
        ...base,
        ratios: { ...base.ratios, ...(response.ratios ?? {}) },
        methodText:
          typeof response.methodText === "string" ? response.methodText : "",
      },
      meta,
    };
  }

  return { workspace: base, meta: { wrongAttempts: 0, submitted: false } };
}

export function sincosWorkspaceFromResponse(
  stepIndex: number,
  raw: Record<string, unknown>,
): { workspace: SincosWorkspace; meta: RestoredInquiryStep } {
  const base = emptySincosWorkspace(stepIndex);
  const response = raw as SincosResponsePayload & { baseT?: number };
  const meta: RestoredInquiryStep = {
    wrongAttempts: wrongsFromResponse(raw),
    submitted: true,
  };

  if (response.kind === "scene") {
    return {
      workspace: {
        ...base,
        angleDeg:
          typeof response.angleDeg === "number"
            ? response.angleDeg
            : base.angleDeg,
        baseT:
          typeof response.baseT === "number" ? response.baseT : base.baseT,
        adjText: typeof response.adj === "string" ? response.adj : "",
        oppText: typeof response.opp === "string" ? response.opp : "",
        methodText:
          typeof response.methodText === "string" ? response.methodText : "",
      },
      meta,
    };
  }

  if (response.kind === "table") {
    return {
      workspace: {
        ...base,
        sinRatios: { ...base.sinRatios, ...(response.sinRatios ?? {}) },
        cosRatios: { ...base.cosRatios, ...(response.cosRatios ?? {}) },
        methodText:
          typeof response.methodText === "string" ? response.methodText : "",
      },
      meta,
    };
  }

  return { workspace: base, meta: { wrongAttempts: 0, submitted: false } };
}

export function radicalTextsFromResponse(
  stepIndex: number,
  raw: Record<string, unknown>,
): { texts: TermTexts[]; meta: RestoredInquiryStep } {
  const response = raw as RadicalFillResponsePayload;
  const meta: RestoredInquiryStep = {
    wrongAttempts: wrongsFromResponse(raw),
    submitted: true,
  };
  if (!Array.isArray(response.fills)) {
    return { texts: [], meta: { wrongAttempts: 0, submitted: false } };
  }
  const texts = response.fills.map((f) => ({
    coeff: typeof f.coeff === "string" ? f.coeff : "",
    radicand: typeof f.radicand === "string" ? f.radicand : "",
  }));
  return { texts, meta };
}

export function balanceWorkspaceFromResponse(
  stepIndex: number,
  raw: Record<string, unknown>,
): { workspace: TileWorkspace; moves: number; meta: RestoredInquiryStep } {
  const response = raw as BalanceFillResponsePayload;
  const meta: RestoredInquiryStep = {
    wrongAttempts: wrongsFromResponse(raw),
    submitted: true,
  };
  if (
    response.left &&
    response.right &&
    typeof response.left.x === "number" &&
    typeof response.left.unit === "number" &&
    typeof response.right.x === "number" &&
    typeof response.right.unit === "number"
  ) {
    return {
      workspace: workspaceFromBalance(
        { left: response.left, right: response.right },
        "restore",
      ),
      moves: typeof response.moves === "number" ? response.moves : 0,
      meta,
    };
  }
  return {
    workspace: emptyTileWorkspace(problemAt(stepIndex), "restore"),
    moves: 0,
    meta: { wrongAttempts: 0, submitted: false },
  };
}

export function equationOpsStateFromResponse(
  stepIndex: number,
  raw: Record<string, unknown>,
): { state: EquationOpsState; meta: RestoredInquiryStep } {
  const response = raw as EquationOpsResponsePayload;
  const meta: RestoredInquiryStep = {
    wrongAttempts: wrongsFromResponse(raw),
    submitted: true,
  };
  const base = equationOpsInitialState(stepIndex);

  if (
    response.balance &&
    typeof response.balance.left === "object" &&
    typeof response.balance.right === "object"
  ) {
    return {
      state: {
        balance: {
          left: { ...response.balance.left },
          right: { ...response.balance.right },
        },
        trail: Array.isArray(response.trail) ? response.trail : base.trail,
        opCount: typeof response.opCount === "number" ? response.opCount : 0,
      },
      meta,
    };
  }

  if (Array.isArray(response.trail) && response.trail.length > 0) {
    return {
      state: {
        ...base,
        trail: response.trail,
        opCount: typeof response.opCount === "number" ? response.opCount : 0,
      },
      meta,
    };
  }

  return { state: base, meta: { wrongAttempts: 0, submitted: false } };
}

export function hasRestorableResponse(raw: Record<string, unknown> | null): boolean {
  if (!raw || Object.keys(raw).length === 0) return false;
  if ("fills" in raw && Array.isArray(raw.fills)) return true;
  if ("left" in raw && "right" in raw) return true;
  if ("trail" in raw && Array.isArray(raw.trail)) return true;
  if ("kind" in raw && (raw.kind === "height" || raw.kind === "table" || raw.kind === "scene")) {
    return true;
  }
  return false;
}

export type RestoreResult =
  | { kind: "radical"; texts: TermTexts[]; meta: RestoredInquiryStep }
  | {
      kind: "balance";
      workspace: TileWorkspace;
      moves: number;
      meta: RestoredInquiryStep;
    }
  | { kind: "race"; state: EquationOpsState; meta: RestoredInquiryStep }
  | { kind: "tangent"; workspace: TangentWorkspace; meta: RestoredInquiryStep }
  | { kind: "sincos"; workspace: SincosWorkspace; meta: RestoredInquiryStep }
  | null;

export function restoreInquiryStep(
  contentKey: InquiryContentKey,
  stepIndex: number,
  raw: Record<string, unknown> | null,
): RestoreResult {
  if (!raw || !hasRestorableResponse(raw)) return null;

  switch (contentKey) {
    case "g3-u1-radical-fill": {
      const { texts, meta } = radicalTextsFromResponse(stepIndex, raw);
      return texts.length > 0 ? { kind: "radical", texts, meta } : null;
    }
    case "g1-u2-2-linear-equation-balance": {
      const { workspace, moves, meta } = balanceWorkspaceFromResponse(
        stepIndex,
        raw,
      );
      return { kind: "balance", workspace, moves, meta };
    }
    case "g1-u2-2-linear-equation-race": {
      const { state, meta } = equationOpsStateFromResponse(stepIndex, raw);
      return { kind: "race", state, meta };
    }
    case "g3-u3-1-tangent-intro": {
      const { workspace, meta } = tangentWorkspaceFromResponse(stepIndex, raw);
      return { kind: "tangent", workspace, meta };
    }
    case "g3-u3-1-sincos-intro": {
      const { workspace, meta } = sincosWorkspaceFromResponse(stepIndex, raw);
      return { kind: "sincos", workspace, meta };
    }
  }
}
