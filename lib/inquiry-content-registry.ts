import type { ComponentType } from "react";
import InquiryRadicalFillStep, {
  emptyTexts,
  validateRadicalFillSubmit,
  type SoftNotice as RadicalSoftNotice,
  type TermTexts,
} from "@/components/inquiry/radical-fill/InquiryRadicalFillStep";
import InquiryRadicalFillResponseDetail from "@/components/inquiry/radical-fill/InquiryRadicalFillResponseDetail";
import InquiryLinearEquationBalanceStep, {
  emptyBalanceWorkspace,
  type SoftNotice as BalanceSoftNotice,
} from "@/components/inquiry/linear-equation-balance/InquiryLinearEquationBalanceStep";
import InquiryLinearEquationBalanceResponseDetail from "@/components/inquiry/linear-equation-balance/InquiryLinearEquationBalanceResponseDetail";
import InquiryEquationOpsStep from "@/components/inquiry/equation-ops/EquationOpsStep";
import InquiryEquationOpsResponseDetail from "@/components/inquiry/equation-ops/InquiryEquationOpsResponseDetail";
import InquiryTangentIntroStep from "@/components/inquiry/tangent-intro/InquiryTangentIntroStep";
import InquiryTangentIntroResponseDetail from "@/components/inquiry/tangent-intro/InquiryTangentIntroResponseDetail";
import InquirySincosIntroStep from "@/components/inquiry/sincos-intro/InquirySincosIntroStep";
import InquirySincosIntroResponseDetail from "@/components/inquiry/sincos-intro/InquirySincosIntroResponseDetail";
import { radicalFillProblemAt } from "@/lib/inquiry-radical-fill";
import { balanceProblemAt } from "@/lib/inquiry-linear-equation-balance";
import { equationOpsProblemAt } from "@/lib/inquiry-equation-ops";
import {
  emptyTangentWorkspace,
  heightSceneAt,
  PROBLEM_COUNT as TANGENT_COUNT,
  validateTangentSubmit,
} from "@/lib/inquiry-tangent-intro";
import {
  emptySincosWorkspace,
  hypSceneAt,
  PROBLEM_COUNT as SINCOS_COUNT,
  validateSincosSubmit,
} from "@/lib/inquiry-sincos-intro";
import { PROBLEM_COUNT as RADICAL_COUNT } from "@/lib/radical-fill-math";
import { PROBLEM_COUNT as BALANCE_COUNT } from "@/lib/linear-equation-balance-math";
import { PROBLEM_COUNT as RACE_COUNT } from "@/lib/equation-ops-math";
import { initialState as equationOpsInitialStateFromMath } from "@/lib/equation-ops-math";
import type { TileWorkspace } from "@/lib/linear-equation-balance-math";
import type { EquationOpsState } from "@/lib/equation-ops-math";
import type { RadicalProblem } from "@/lib/radical-fill-math";
import type { InquiryResult } from "@/lib/inquiry-types";
import type { RadicalFillResponsePayload } from "@/lib/inquiry-radical-fill";
import type { BalanceFillResponsePayload } from "@/lib/inquiry-linear-equation-balance";
import type { EquationOpsResponsePayload } from "@/lib/inquiry-equation-ops";
import type { TangentResponsePayload } from "@/lib/inquiry-tangent-intro";
import type { SincosResponsePayload } from "@/lib/inquiry-sincos-intro";

export type InquiryContentKey =
  | "g3-u1-radical-fill"
  | "g1-u2-2-linear-equation-balance"
  | "g1-u2-2-linear-equation-race"
  | "g3-u3-1-tangent-intro"
  | "g3-u3-1-sincos-intro";

export type InquiryResponsePayload =
  | RadicalFillResponsePayload
  | BalanceFillResponsePayload
  | EquationOpsResponsePayload
  | TangentResponsePayload
  | SincosResponsePayload;

type ResponseDetailProps = {
  response: InquiryResponsePayload;
  result: InquiryResult | null;
};

export type InquiryContentDef = {
  contentKey: InquiryContentKey;
  title: string;
  stepCount: number;
  hostSubtitle: string;
  spectatorSubtitle: string;
  headerGradient: string;
  hasLiveRanking?: boolean;
  ResponseDetail: ComponentType<ResponseDetailProps>;
};

export const INQUIRY_CONTENTS: Record<InquiryContentKey, InquiryContentDef> = {
  "g3-u1-radical-fill": {
    contentKey: "g3-u1-radical-fill",
    title: "근호 빈칸 채우기",
    stepCount: RADICAL_COUNT,
    hostSubtitle:
      "학생 화면과 같은 문제를 보며 페이지를 넘깁니다. 학생 응답은 접속 현황·학생 응답 탭에서 확인하세요.",
    spectatorSubtitle:
      "문제를 직접 조작해 볼 수 있어요. 학생은 선생님이 수업을 시작할 때만 참여할 수 있습니다.",
    headerGradient: "from-lavender/50 via-sky/25 to-mint/30",
    ResponseDetail: InquiryRadicalFillResponseDetail as ComponentType<ResponseDetailProps>,
  },
  "g1-u2-2-linear-equation-balance": {
    contentKey: "g1-u2-2-linear-equation-balance",
    title: "대수막대와 저울로 일차방정식",
    stepCount: BALANCE_COUNT,
    hostSubtitle:
      "양팔저울과 대수막대로 등식의 성질을 탐구합니다. 학생 응답은 접속 현황·학생 응답 탭에서 확인하세요.",
    spectatorSubtitle:
      "저울과 막대를 직접 조작해 볼 수 있어요. 학생은 선생님이 수업을 시작할 때만 참여할 수 있습니다.",
    headerGradient: "from-mint/50 via-sky/25 to-mint/30",
    ResponseDetail:
      InquiryLinearEquationBalanceResponseDetail as ComponentType<ResponseDetailProps>,
  },
  "g1-u2-2-linear-equation-race": {
    contentKey: "g1-u2-2-linear-equation-race",
    title: "일차방정식 레이스",
    stepCount: RACE_COUNT,
    hostSubtitle:
      "연산을 선택해 일차방정식을 푸는 속도 경쟁 수업입니다. 랭킹 탭에서 실시간 순위를 확인하세요.",
    spectatorSubtitle:
      "연산을 골라 식을 풀어 볼 수 있어요. 학생은 선생님이 수업을 시작할 때만 참여할 수 있습니다.",
    headerGradient: "from-gold/45 via-sky/25 to-mint/30",
    hasLiveRanking: true,
    ResponseDetail:
      InquiryEquationOpsResponseDetail as ComponentType<ResponseDetailProps>,
  },
  "g3-u3-1-tangent-intro": {
    contentKey: "g3-u3-1-tangent-intro",
    title: "높이 재기 탐구",
    stepCount: TANGENT_COUNT,
    hostSubtitle:
      "거리와 각만 보여 주고, 학생이 작도판에서 비슷한 직각삼각형을 그려 높이를 구합니다. 네 번째 페이지에서 표를 채우고, 마지막 페이지에서 그 수에 탄젠트라는 이름을 붙입니다.",
    spectatorSubtitle:
      "장면과 작도판을 직접 조작해 볼 수 있어요. 학생은 선생님이 수업을 시작할 때만 참여할 수 있습니다.",
    headerGradient: "from-lavender/55 via-sky/20 to-gold/25",
    ResponseDetail:
      InquiryTangentIntroResponseDetail as ComponentType<ResponseDetailProps>,
  },
  "g3-u3-1-sincos-intro": {
    contentKey: "g3-u3-1-sincos-intro",
    title: "사인·코사인 탐구",
    stepCount: SINCOS_COUNT,
    hostSubtitle:
      "빗변과 각만 보여 주고, 학생이 작도판에서 비슷한 직각삼각형을 그려 수평거리와 높이를 구합니다. 네 번째 페이지에서 표를 채우고, 마지막 페이지에서 그 수에 사인·코사인이라는 이름을 붙입니다.",
    spectatorSubtitle:
      "장면과 작도판을 직접 조작해 볼 수 있어요. 학생은 선생님이 수업을 시작할 때만 참여할 수 있습니다.",
    headerGradient: "from-sky/45 via-lavender/25 to-mint/30",
    ResponseDetail:
      InquirySincosIntroResponseDetail as ComponentType<ResponseDetailProps>,
  },
};

export function getInquiryContent(
  contentKey: string,
): InquiryContentDef | undefined {
  return INQUIRY_CONTENTS[contentKey as InquiryContentKey];
}

export function isInquiryContentKey(
  contentKey: string,
): contentKey is InquiryContentKey {
  return contentKey in INQUIRY_CONTENTS;
}

// --- Radical fill helpers ---

export function radicalFillInitialState(stepIndex: number): TermTexts[] {
  return emptyTexts(radicalFillProblemAt(stepIndex));
}

export function radicalFillProblem(stepIndex: number): RadicalProblem {
  return radicalFillProblemAt(stepIndex);
}

export function validateRadicalFill(
  stepIndex: number,
  texts: TermTexts[],
): RadicalSoftNotice | null {
  return validateRadicalFillSubmit(radicalFillProblemAt(stepIndex), texts);
}

// --- Balance helpers ---

export function balanceInitialState(stepIndex: number): TileWorkspace {
  return emptyBalanceWorkspace(stepIndex, `s${stepIndex}-`);
}

export function balanceProblem(stepIndex: number) {
  return balanceProblemAt(stepIndex);
}

// --- Equation ops race helpers ---

export function equationOpsInitialState(stepIndex: number): EquationOpsState {
  return equationOpsInitialStateFromMath(stepIndex);
}

export function equationOpsProblem(stepIndex: number) {
  return equationOpsProblemAt(stepIndex);
}

// --- Tangent intro helpers ---

export function tangentInitialState(stepIndex: number) {
  return emptyTangentWorkspace(stepIndex);
}

export function tangentScene(stepIndex: number) {
  return heightSceneAt(stepIndex);
}

export function validateTangent(
  stepIndex: number,
  workspace: ReturnType<typeof emptyTangentWorkspace>,
) {
  return validateTangentSubmit(stepIndex, workspace);
}

// --- Sincos intro helpers ---

export function sincosInitialState(
  stepIndex: number,
  opts?: { seed?: string | null },
) {
  return emptySincosWorkspace(stepIndex, opts);
}

export function sincosScene(stepIndex: number) {
  return hypSceneAt(stepIndex);
}

export function validateSincos(
  stepIndex: number,
  workspace: ReturnType<typeof emptySincosWorkspace>,
) {
  return validateSincosSubmit(stepIndex, workspace);
}

export {
  InquiryRadicalFillStep,
  InquiryLinearEquationBalanceStep,
  InquiryEquationOpsStep,
  InquiryTangentIntroStep,
  InquirySincosIntroStep,
};
