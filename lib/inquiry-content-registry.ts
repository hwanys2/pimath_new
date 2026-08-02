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
import { radicalFillProblemAt } from "@/lib/inquiry-radical-fill";
import { balanceProblemAt } from "@/lib/inquiry-linear-equation-balance";
import { equationOpsProblemAt } from "@/lib/inquiry-equation-ops";
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

export type InquiryContentKey =
  | "g3-u1-radical-fill"
  | "g1-u2-2-linear-equation-balance"
  | "g1-u2-2-linear-equation-race";

export type InquiryResponsePayload =
  | RadicalFillResponsePayload
  | BalanceFillResponsePayload
  | EquationOpsResponsePayload;

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

export {
  InquiryRadicalFillStep,
  InquiryLinearEquationBalanceStep,
  InquiryEquationOpsStep,
};
