import type { TermTexts } from "@/components/inquiry/radical-fill/InquiryRadicalFillStep";
import type { EquationOpsState } from "@/lib/equation-ops-math";
import type { BalanceFillResponsePayload } from "@/lib/inquiry-linear-equation-balance";
import type { EquationOpsResponsePayload } from "@/lib/inquiry-equation-ops";
import type { RadicalFillResponsePayload } from "@/lib/inquiry-radical-fill";
import type { SketchpadPersisted } from "@/lib/inquiry-sketch-persist";
import {
  clampDistance,
  elevationAngleDeg,
  heightSceneAt,
  isDefineStep,
  isTableStep,
  type TangentWorkspace,
} from "@/lib/inquiry-tangent-intro";
import {
  hypSceneAt,
  type SincosWorkspace,
} from "@/lib/inquiry-sincos-intro";
import { workspaceToBalance, type TileWorkspace } from "@/lib/linear-equation-balance-math";

export type DraftResponsePayload = Record<string, unknown> & { draft?: true };

export function buildRadicalDraftPayload(
  stepIndex: number,
  texts: TermTexts[],
  wrongs: number,
): RadicalFillResponsePayload & { draft: true } {
  return {
    draft: true,
    fills: texts.map((t) => ({
      coeff: t.coeff,
      radicand: t.radicand,
    })),
    wrongs,
    gaveUp: false,
  };
}

export function buildBalanceDraftPayload(
  stepIndex: number,
  workspace: TileWorkspace,
  wrongs: number,
  moves: number,
): BalanceFillResponsePayload & { draft: true } {
  const state = workspaceToBalance(workspace);
  return {
    draft: true,
    left: { ...state.left },
    right: { ...state.right },
    solved: false,
    balanced: false,
    moves,
    gaveUp: false,
    wrongs,
  };
}

export function buildRaceDraftPayload(
  state: EquationOpsState,
  wrongs: number,
  elapsedMs: number,
): EquationOpsResponsePayload & { draft: true } {
  return {
    draft: true,
    trail: state.trail,
    opCount: state.opCount,
    elapsedMs,
    wrongs,
    balance: {
      left: { ...state.balance.left },
      right: { ...state.balance.right },
    },
  };
}

export function buildTangentDraftPayload(
  stepIndex: number,
  workspace: TangentWorkspace,
  wrongs: number,
  sketch?: SketchpadPersisted | null,
): DraftResponsePayload {
  if (isDefineStep(stepIndex)) {
    return {
      draft: true,
      kind: "define",
      nameText: workspace.nameText.trim(),
      wrongs,
      ...(sketch ? { sketch } : {}),
    };
  }

  if (isTableStep(stepIndex)) {
    return {
      draft: true,
      kind: "table",
      ratios: { ...workspace.ratios },
      methodText: workspace.methodText.trim(),
      wrongs,
      ...(sketch ? { sketch } : {}),
    };
  }

  const scene = heightSceneAt(stepIndex) ?? heightSceneAt(0)!;
  const distanceM = clampDistance(scene, workspace.distanceM);
  return {
    draft: true,
    kind: "height",
    sceneId: scene.id,
    distanceM,
    angleDeg: elevationAngleDeg(scene.heightM, distanceM),
    heightM: workspace.heightText,
    methodText: workspace.methodText.trim(),
    wrongs,
    ...(sketch ? { sketch } : {}),
  };
}

export function buildSincosDraftPayload(
  stepIndex: number,
  workspace: SincosWorkspace,
  wrongs: number,
  sketch?: SketchpadPersisted | null,
): DraftResponsePayload {
  if (isDefineStep(stepIndex)) {
    return {
      draft: true,
      kind: "define",
      sinNameText: (workspace.sinNameText ?? "").trim(),
      cosNameText: (workspace.cosNameText ?? "").trim(),
      wrongs,
      ...(sketch ? { sketch } : {}),
    };
  }

  if (isTableStep(stepIndex)) {
    return {
      draft: true,
      kind: "table",
      sinRatios: { ...(workspace.sinRatios ?? {}) },
      cosRatios: { ...(workspace.cosRatios ?? {}) },
      methodText: (workspace.methodText ?? "").trim(),
      wrongs,
      ...(sketch ? { sketch } : {}),
    };
  }

  const scene = hypSceneAt(stepIndex) ?? hypSceneAt(0)!;
  return {
    draft: true,
    kind: "scene",
    sceneId: scene.id,
    hyp: scene.hyp,
    unit: scene.unit,
    angleDeg: workspace.angleDeg,
    baseT: workspace.baseT,
    adj: workspace.adjText,
    opp: workspace.oppText,
    methodText: (workspace.methodText ?? "").trim(),
    wrongs,
    ...(sketch ? { sketch } : {}),
  };
}

export function extractSketchFromResponse(
  raw: Record<string, unknown>,
): SketchpadPersisted | null {
  const sketch = raw.sketch;
  if (!sketch || typeof sketch !== "object") return null;
  const s = sketch as SketchpadPersisted;
  if (s.v !== 1 || !Array.isArray(s.segs)) return null;
  return s;
}
