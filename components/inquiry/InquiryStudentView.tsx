"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import InquiryWaitingScreen from "@/components/inquiry/InquiryWaitingScreen";
import {
  InquiryEquationOpsStep,
  InquiryLinearEquationBalanceStep,
  InquiryRadicalFillStep,
  InquiryTangentIntroStep,
  InquirySincosIntroStep,
  balanceInitialState,
  balanceProblem,
  equationOpsInitialState,
  equationOpsProblem,
  getInquiryContent,
  isInquiryContentKey,
  radicalFillInitialState,
  radicalFillProblem,
  tangentInitialState,
  tangentScene,
  sincosInitialState,
  sincosScene,
  validateRadicalFill,
  validateTangent,
  validateSincos,
  type InquiryContentKey,
} from "@/lib/inquiry-content-registry";
import type { SoftNotice as BalanceSoftNotice } from "@/components/inquiry/linear-equation-balance/InquiryLinearEquationBalanceStep";
import { validateBalanceSubmit } from "@/lib/inquiry-linear-equation-balance";
import type { SoftNotice as RadicalSoftNotice } from "@/components/inquiry/radical-fill/InquiryRadicalFillStep";
import type { SoftNotice as TangentSoftNotice } from "@/lib/inquiry-tangent-intro";
import type { SoftNotice as SincosSoftNotice } from "@/lib/inquiry-sincos-intro";
import type { TermTexts } from "@/components/inquiry/radical-fill/InquiryRadicalFillStep";
import type { TileWorkspace } from "@/lib/linear-equation-balance-math";
import type { EquationOpsState } from "@/lib/equation-ops-math";
import type { TangentWorkspace } from "@/lib/inquiry-tangent-intro";
import { emptyTangentWorkspace } from "@/lib/inquiry-tangent-intro";
import type { SincosWorkspace } from "@/lib/inquiry-sincos-intro";
import {
  emptySincosWorkspace,
  normalizeSincosWorkspace,
} from "@/lib/inquiry-sincos-intro";
import { isStateSolved, scoreForTime } from "@/lib/equation-ops-math";
import * as radicalFillActions from "@/app/play/g3-u1-radical-fill/actions";
import * as balanceActions from "@/app/play/g1-u2-2-linear-equation-balance/actions";
import * as raceActions from "@/app/play/g1-u2-2-linear-equation-race/actions";
import * as tangentActions from "@/app/play/g3-u3-1-tangent-intro/actions";
import * as sincosActions from "@/app/play/g3-u3-1-sincos-intro/actions";
import { effectiveInquiryStepCount } from "@/lib/inquiry-step-counts";
import { extractSketchFromResponse } from "@/lib/inquiry-draft-payload";
import {
  readInquiryLocalDraft,
  writeInquiryLocalDraft,
  type InquiryStepLocalDraft,
} from "@/lib/inquiry-local-draft";
import {
  readSketchDraft,
  sketchPersistKey,
  writeSketchDraft,
} from "@/lib/inquiry-sketch-persist";
import {
  hasRestorableResponse,
  restoreInquiryStep,
} from "@/lib/inquiry-workspace-restore";
import {
  INQUIRY_POLL_MS,
  type InquiryPhase,
  type InquiryPollState,
  type InquiryResult,
} from "@/lib/inquiry-types";
import { notifySessionChanged, useSessionPoll } from "@/lib/session-sync";
import { startVisibleInterval } from "@/lib/visible-interval";

const IDLE: InquiryPollState = {
  sessionId: null,
  classId: null,
  className: null,
  contentKey: null,
  phase: "idle",
  stepIndex: 0,
  stepCount: 0,
  participants: [],
  myStepResult: null,
  myStepResponse: null,
};

type Props = {
  contentKey: string;
  studentClassId: string | null;
  studentClassName: string | null;
  studentName: string | null;
  studentId?: string | null;
  canParticipate: boolean;
  contentTitle: string;
};

function InquiryUnavailable({ message }: { message: string }) {
  return (
    <section className="quest-card p-8 text-center">
      <p className="font-display text-xl text-wood">참여할 수 없어요</p>
      <p className="mt-3 text-sm font-semibold text-foreground/70">{message}</p>
    </section>
  );
}

function getActions(contentKey: InquiryContentKey) {
  switch (contentKey) {
    case "g3-u1-radical-fill":
      return radicalFillActions;
    case "g1-u2-2-linear-equation-balance":
      return balanceActions;
    case "g1-u2-2-linear-equation-race":
      return raceActions;
    case "g3-u3-1-tangent-intro":
      return tangentActions;
    case "g3-u3-1-sincos-intro":
      return sincosActions;
  }
}

export default function InquiryStudentView({
  contentKey,
  studentClassId,
  studentClassName,
  studentName,
  studentId = null,
  canParticipate,
  contentTitle,
}: Props) {
  const config = getInquiryContent(contentKey);
  const validKey = isInquiryContentKey(contentKey) ? contentKey : null;

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [state, setState] = useState<InquiryPollState>(IDLE);
  const [waitingForSession, setWaitingForSession] = useState(true);
  const [otherActivityTitle, setOtherActivityTitle] = useState<string | null>(
    null,
  );
  const [texts, setTexts] = useState<TermTexts[]>([]);
  const [balanceWorkspace, setBalanceWorkspace] = useState<TileWorkspace>({
    left: [],
    right: [],
  });
  const [balanceMoves, setBalanceMoves] = useState(0);
  const [raceState, setRaceState] = useState<EquationOpsState>({
    balance: { left: { x: 0, unit: 0 }, right: { x: 0, unit: 0 } },
    trail: [],
    opCount: 0,
  });
  const [tangentWorkspace, setTangentWorkspace] = useState<TangentWorkspace>(
    () => emptyTangentWorkspace(0),
  );
  const sincosSeed =
    studentId ??
    (studentName && studentClassId
      ? `${studentClassId}:${studentName}`
      : null);

  const [sincosWorkspace, setSincosWorkspace] = useState<SincosWorkspace>(
    () => emptySincosWorkspace(0, { seed: sincosSeed }),
  );
  const [stepStartedAt, setStepStartedAt] = useState<number | null>(null);
  const [earnedScore, setEarnedScore] = useState<number | null>(null);
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [radicalNotice, setRadicalNotice] = useState<RadicalSoftNotice | null>(
    null,
  );
  const [balanceNotice, setBalanceNotice] = useState<BalanceSoftNotice | null>(
    null,
  );
  const [tangentNotice, setTangentNotice] = useState<TangentSoftNotice | null>(
    null,
  );
  const [sincosNotice, setSincosNotice] = useState<SincosSoftNotice | null>(
    null,
  );
  const [submitted, setSubmitted] = useState(false);
  const [submitFeedback, setSubmitFeedback] = useState<
    "correct" | "wrong" | null
  >(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const prevStepRef = useRef(-1);
  const prevPhaseRef = useRef<InquiryPhase | "idle">("idle");
  const wrongRef = useRef(0);
  const submittedRef = useRef(false);

  useEffect(() => {
    submittedRef.current = submitted;
  }, [submitted]);

  const applySubmitMeta = useCallback(
    (result: InquiryResult | null, wrongs: number) => {
      if (result) {
        setSubmitted(true);
        submittedRef.current = true;
        setSubmitFeedback(
          result === "correct" || result === "neutral" ? "correct" : "wrong",
        );
      } else {
        setSubmitted(false);
        submittedRef.current = false;
        setSubmitFeedback(null);
      }
      setWrongAttempts(wrongs);
      wrongRef.current = wrongs;
    },
    [],
  );

  const resetStep = useCallback(
    (stepIndex: number) => {
      if (!validKey) return;
      if (validKey === "g3-u1-radical-fill") {
        setTexts(radicalFillInitialState(stepIndex));
      } else if (validKey === "g1-u2-2-linear-equation-race") {
        setRaceState(equationOpsInitialState(stepIndex));
        setStepStartedAt(Date.now());
        setEarnedScore(null);
      } else if (validKey === "g3-u3-1-tangent-intro") {
        setTangentWorkspace(tangentInitialState(stepIndex));
      } else if (validKey === "g3-u3-1-sincos-intro") {
        setSincosWorkspace(sincosInitialState(stepIndex, { seed: sincosSeed }));
      } else {
        setBalanceWorkspace(balanceInitialState(stepIndex));
        setBalanceMoves(0);
      }
      setWrongAttempts(0);
      wrongRef.current = 0;
      setRadicalNotice(null);
      setBalanceNotice(null);
      setTangentNotice(null);
      setSincosNotice(null);
      setSubmitted(false);
      setSubmitFeedback(null);
      submittedRef.current = false;
      prevStepRef.current = stepIndex;
    },
    [validKey, sincosSeed],
  );

  const hydrateStep = useCallback(
    (
      stepIndex: number,
      response: Record<string, unknown>,
      result: InquiryResult | null,
      sid: string | null,
    ) => {
      if (!validKey) return;

      const sketch = extractSketchFromResponse(response);
      if (sketch && sid) {
        writeSketchDraft(
          sketchPersistKey(validKey, sid, stepIndex),
          sketch,
        );
      }

      const restored = restoreInquiryStep(validKey, stepIndex, response);
      if (!restored) {
        resetStep(stepIndex);
        return;
      }

      switch (restored.kind) {
        case "radical":
          setTexts(restored.texts);
          break;
        case "balance":
          setBalanceWorkspace(restored.workspace);
          setBalanceMoves(restored.moves);
          break;
        case "race":
          setRaceState(restored.state);
          setStepStartedAt(Date.now());
          setEarnedScore(null);
          break;
        case "tangent":
          setTangentWorkspace(restored.workspace);
          break;
        case "sincos":
          setSincosWorkspace(restored.workspace);
          break;
      }

      applySubmitMeta(result, restored.meta.wrongAttempts);
      setRadicalNotice(null);
      setBalanceNotice(null);
      setTangentNotice(null);
      setSincosNotice(null);
      prevStepRef.current = stepIndex;
    },
    [validKey, applySubmitMeta, resetStep],
  );

  const applyLocalDraft = useCallback(
    (stepIndex: number, sid: string): boolean => {
      if (!validKey) return false;
      const draft = readInquiryLocalDraft(validKey, sid, stepIndex);
      if (!draft) return false;

      wrongRef.current = draft.wrongAttempts;
      setWrongAttempts(draft.wrongAttempts);
      setSubmitted(draft.submitted);
      submittedRef.current = draft.submitted;
      setSubmitFeedback(draft.submitFeedback);

      if (validKey === "g3-u1-radical-fill" && draft.texts) {
        setTexts(draft.texts);
      } else if (validKey === "g1-u2-2-linear-equation-balance") {
        if (draft.balanceWorkspace) setBalanceWorkspace(draft.balanceWorkspace);
        if (typeof draft.balanceMoves === "number") {
          setBalanceMoves(draft.balanceMoves);
        }
      } else if (validKey === "g1-u2-2-linear-equation-race") {
        if (draft.raceState) setRaceState(draft.raceState);
        setStepStartedAt(draft.stepStartedAt ?? Date.now());
        setEarnedScore(draft.earnedScore ?? null);
      } else if (validKey === "g3-u3-1-tangent-intro") {
        if (draft.tangentWorkspace) setTangentWorkspace(draft.tangentWorkspace);
      } else if (validKey === "g3-u3-1-sincos-intro") {
        if (draft.sincosWorkspace) {
          setSincosWorkspace(
            normalizeSincosWorkspace(stepIndex, draft.sincosWorkspace, {
              seed: sincosSeed,
            }),
          );
        }
      }

      setRadicalNotice(null);
      setBalanceNotice(null);
      setTangentNotice(null);
      setSincosNotice(null);
      prevStepRef.current = stepIndex;
      return true;
    },
    [validKey, sincosSeed],
  );

  const applyPollResult = useCallback(
    (poll: InquiryPollState, sid: string) => {
      if (poll.contentKey && validKey && poll.contentKey !== validKey) {
        setOtherActivityTitle(
          getInquiryContent(poll.contentKey)?.title ?? "다른 탐구 활동",
        );
        setSessionId(null);
        setState(IDLE);
        setWaitingForSession(true);
        setSyncError(null);
        prevPhaseRef.current = "idle";
        return;
      }

      setOtherActivityTitle(null);
      setSyncError(null);
      setState(poll);

      const prevPhase = prevPhaseRef.current;
      const stepChanged = prevStepRef.current !== poll.stepIndex;
      const enteredLive = poll.phase === "live" && prevPhase !== "live";

      if (poll.phase === "live" && (enteredLive || stepChanged)) {
        if (poll.myStepResponse && hasRestorableResponse(poll.myStepResponse)) {
          hydrateStep(
            poll.stepIndex,
            poll.myStepResponse,
            poll.myStepResult,
            sid,
          );
        } else if (applyLocalDraft(poll.stepIndex, sid)) {
          // Restored from browser cache.
        } else {
          resetStep(poll.stepIndex);
        }
      } else if (poll.myStepResult && !submittedRef.current) {
        applySubmitMeta(poll.myStepResult, wrongRef.current);
      }
      prevPhaseRef.current = poll.phase;
    },
    [validKey, hydrateStep, applyLocalDraft, resetStep, applySubmitMeta],
  );

  const sessionPollTick = useCallback(async () => {
    if (!sessionId || !validKey) return;
    const actions = getActions(validKey);
    const poll = await actions.inquiryStudentPollAction({ sessionId });
    if (!poll) {
      setSyncError("수업 상태를 불러오지 못했어요. 연결을 확인해 주세요.");
      return;
    }
    if (poll.phase === "closed") {
      setSessionId(null);
      setState(IDLE);
      setWaitingForSession(true);
      setSyncError(null);
      prevPhaseRef.current = "idle";
      return;
    }
    applyPollResult(poll, sessionId);
  }, [sessionId, validKey, applyPollResult]);

  const discoverSession = useCallback(async () => {
    if (!studentClassId || !canParticipate || !validKey) return;

    const actions = getActions(validKey);
    const active = await actions.inquiryFindActiveStudentAction({
      classId: studentClassId,
    });
    if (!active.sessionId) {
      setSessionId(null);
      setState(IDLE);
      setWaitingForSession(true);
      setOtherActivityTitle(null);
      setSyncError(null);
      prevPhaseRef.current = "idle";
      return;
    }

    setWaitingForSession(false);
    const join = await actions.inquiryJoinAction({ classId: studentClassId });
    if ("error" in join) {
      if (join.error === "no_session") {
        setSessionId(null);
        setState(IDLE);
        setWaitingForSession(true);
        setOtherActivityTitle(null);
        setSyncError(null);
        prevPhaseRef.current = "idle";
      } else {
        setSyncError("수업에 접속하지 못했어요. 잠시 후 다시 시도해 주세요.");
      }
      return;
    }

    setSessionId(join.sessionId);
    void notifySessionChanged(join.sessionId);

    const poll = await actions.inquiryStudentPollAction({
      sessionId: join.sessionId,
    });
    if (!poll) {
      setSyncError("수업 상태를 불러오지 못했어요. 연결을 확인해 주세요.");
      return;
    }
    applyPollResult(poll, join.sessionId);
  }, [
    studentClassId,
    canParticipate,
    validKey,
    applyPollResult,
  ]);

  useSessionPoll(sessionId, () => {
    void sessionPollTick();
  });

  useEffect(() => {
    if (!studentClassId || !canParticipate || !validKey || sessionId) return;

    void discoverSession();
    return startVisibleInterval(() => {
      void discoverSession();
    }, INQUIRY_POLL_MS);
  }, [studentClassId, canParticipate, validKey, sessionId, discoverSession]);

  const currentSketchKey =
    sessionId && validKey
      ? sketchPersistKey(validKey, sessionId, state.stepIndex)
      : null;

  useEffect(() => {
    if (!sessionId || !validKey || state.phase !== "live") return;

    const timer = window.setTimeout(() => {
      const draft: InquiryStepLocalDraft = {
        v: 1,
        wrongAttempts: wrongRef.current,
        submitted,
        submitFeedback,
      };

      if (validKey === "g3-u1-radical-fill") {
        draft.texts = texts;
      } else if (validKey === "g1-u2-2-linear-equation-balance") {
        draft.balanceWorkspace = balanceWorkspace;
        draft.balanceMoves = balanceMoves;
      } else if (validKey === "g1-u2-2-linear-equation-race") {
        draft.raceState = raceState;
        draft.stepStartedAt = stepStartedAt;
        draft.earnedScore = earnedScore;
      } else if (validKey === "g3-u3-1-tangent-intro") {
        draft.tangentWorkspace = tangentWorkspace;
      } else if (validKey === "g3-u3-1-sincos-intro") {
        draft.sincosWorkspace = sincosWorkspace;
      }

      writeInquiryLocalDraft(validKey, sessionId, state.stepIndex, draft);

      // Server draft upsert used to wipe graded `result` to null.
      // After a submit, keep the grade and only persist locally.
      if (submitted) return;

      const sketch = currentSketchKey ? readSketchDraft(currentSketchKey) : null;

      if (validKey === "g3-u1-radical-fill") {
        void radicalFillActions.inquirySaveRadicalDraftAction({
          sessionId,
          stepIndex: state.stepIndex,
          texts,
          wrongs: wrongRef.current,
        });
      } else if (validKey === "g1-u2-2-linear-equation-balance") {
        void balanceActions.inquirySaveBalanceDraftAction({
          sessionId,
          stepIndex: state.stepIndex,
          workspace: balanceWorkspace,
          wrongs: wrongRef.current,
          moves: balanceMoves,
        });
      } else if (validKey === "g1-u2-2-linear-equation-race") {
        const elapsedMs = stepStartedAt ? Date.now() - stepStartedAt : 0;
        void raceActions.inquirySaveRaceDraftAction({
          sessionId,
          stepIndex: state.stepIndex,
          state: raceState,
          wrongs: wrongRef.current,
          elapsedMs,
        });
      } else if (validKey === "g3-u3-1-tangent-intro") {
        void tangentActions.inquirySaveTangentDraftAction({
          sessionId,
          stepIndex: state.stepIndex,
          workspace: tangentWorkspace,
          wrongs: wrongRef.current,
          sketch,
        });
      } else if (validKey === "g3-u3-1-sincos-intro") {
        void sincosActions.inquirySaveSincosDraftAction({
          sessionId,
          stepIndex: state.stepIndex,
          workspace: sincosWorkspace,
          wrongs: wrongRef.current,
          sketch,
        });
      }
    }, 900);

    return () => window.clearTimeout(timer);
  }, [
    sessionId,
    validKey,
    state.phase,
    state.stepIndex,
    texts,
    balanceWorkspace,
    balanceMoves,
    raceState,
    stepStartedAt,
    earnedScore,
    tangentWorkspace,
    sincosWorkspace,
    submitted,
    submitFeedback,
    currentSketchKey,
  ]);

  const onSubmitRadical = () => {
    if (!sessionId || state.phase !== "live" || !validKey) return;
    const problem = radicalFillProblem(state.stepIndex);
    const notice = validateRadicalFill(state.stepIndex, texts);
    if (notice) {
      if (notice.reason === "wrong") {
        const next = wrongRef.current + 1;
        wrongRef.current = next;
        setWrongAttempts(next);
      }
      setRadicalNotice(notice);
      return;
    }

    startTransition(async () => {
      const result = await radicalFillActions.inquirySubmitRadicalFillAction({
        sessionId,
        stepIndex: state.stepIndex,
        texts,
        wrongs: wrongRef.current,
        gaveUp: false,
      });
      if ("error" in result) {
        setRadicalNotice({ reason: "wrong" });
        return;
      }
      setSubmitted(true);
      submittedRef.current = true;
      setSubmitFeedback("correct");
      setRadicalNotice(null);
      void notifySessionChanged(sessionId);
    });
  };

  const onSubmitBalance = () => {
    if (!sessionId || state.phase !== "live" || !validKey) return;
    const notice = validateBalanceSubmit(state.stepIndex, balanceWorkspace);
    if (notice) {
      const next = wrongRef.current + 1;
      wrongRef.current = next;
      setWrongAttempts(next);
      setBalanceNotice(notice);
      return;
    }

    startTransition(async () => {
      const result = await balanceActions.inquirySubmitBalanceAction({
        sessionId,
        stepIndex: state.stepIndex,
        workspace: balanceWorkspace,
        moves: balanceMoves,
        wrongs: wrongRef.current,
        gaveUp: false,
      });
      if ("error" in result) {
        setBalanceNotice({ reason: "wrong" });
        return;
      }
      setSubmitted(true);
      submittedRef.current = true;
      setSubmitFeedback("correct");
      setBalanceNotice(null);
      void notifySessionChanged(sessionId);
    });
  };

  const onSubmitRace = () => {
    if (!sessionId || state.phase !== "live" || !validKey) return;
    const problem = equationOpsProblem(state.stepIndex);
    const elapsedMs = stepStartedAt ? Date.now() - stepStartedAt : 0;

    if (!isStateSolved(raceState, problem.xValue)) {
      const next = wrongRef.current + 1;
      wrongRef.current = next;
      setWrongAttempts(next);
      return;
    }

    startTransition(async () => {
      const result = await raceActions.inquirySubmitEquationOpsAction({
        sessionId,
        stepIndex: state.stepIndex,
        state: raceState,
        wrongs: wrongRef.current,
        elapsedMs,
      });
      if ("error" in result) return;
      const pts = scoreForTime(elapsedMs);
      setEarnedScore(pts);
      setSubmitted(true);
      submittedRef.current = true;
      setSubmitFeedback("correct");
      void notifySessionChanged(sessionId);
    });
  };

  const onSubmitTangent = () => {
    if (!sessionId || state.phase !== "live" || !validKey) return;
    const notice = validateTangent(state.stepIndex, tangentWorkspace);
    if (notice) {
      if (notice.reason === "wrong") {
        const next = wrongRef.current + 1;
        wrongRef.current = next;
        setWrongAttempts(next);
      }
      setTangentNotice(notice);
      return;
    }

    startTransition(async () => {
      const result = await tangentActions.inquirySubmitTangentAction({
        sessionId,
        stepIndex: state.stepIndex,
        workspace: tangentWorkspace,
        wrongs: wrongRef.current,
      });
      if ("error" in result) {
        setTangentNotice({ reason: "wrong" });
        return;
      }
      setSubmitted(true);
      submittedRef.current = true;
      setSubmitFeedback("correct");
      setTangentNotice(null);
      void notifySessionChanged(sessionId);
    });
  };

  const onSubmitSincos = () => {
    if (!sessionId || state.phase !== "live" || !validKey) return;
    const notice = validateSincos(state.stepIndex, sincosWorkspace);
    if (notice) {
      if (notice.reason === "wrong") {
        const next = wrongRef.current + 1;
        wrongRef.current = next;
        setWrongAttempts(next);
      }
      setSincosNotice(notice);
      return;
    }

    startTransition(async () => {
      const result = await sincosActions.inquirySubmitSincosAction({
        sessionId,
        stepIndex: state.stepIndex,
        workspace: sincosWorkspace,
        wrongs: wrongRef.current,
      });
      if ("error" in result) {
        setSincosNotice({ reason: "wrong" });
        return;
      }
      setSubmitted(true);
      submittedRef.current = true;
      setSubmitFeedback("correct");
      setSincosNotice(null);
      void notifySessionChanged(sessionId);
    });
  };

  if (!config || !validKey) {
    return (
      <InquiryUnavailable message="알 수 없는 탐구 콘텐츠예요." />
    );
  }

  if (!canParticipate) {
    return (
      <InquiryUnavailable message="선생님이 이 활동을 학급에 담아두고 활성화해야 참여할 수 있어요." />
    );
  }

  const stepCount = effectiveInquiryStepCount(validKey, state.stepCount);

  if (waitingForSession || state.phase === "setup" || state.phase === "idle") {
    return (
      <div className="space-y-4">
        <section
          className={`quest-card bg-gradient-to-br ${config.headerGradient} p-5 sm:p-7`}
        >
          <p className="text-sm font-bold text-wood">
            {studentClassName ?? "우리 반"} · 탐구 수업
          </p>
          <h1 className="font-display mt-1 text-2xl text-foreground sm:text-3xl">
            {contentTitle}
          </h1>
        </section>
        <InquiryWaitingScreen
          studentName={studentName}
          message={
            otherActivityTitle
              ? `선생님이 지금 「${otherActivityTitle}」 수업을 진행 중이에요. 그 활동 페이지에서 참여해 주세요.`
              : undefined
          }
        />
        <p className="text-center text-xs font-medium text-foreground/50">
          {otherActivityTitle
            ? "이 활동 수업이 시작되면 여기로 문제가 열려요."
            : sessionId
              ? "접속 확인됨 · 선생님이 수업을 시작하면 문제가 열려요."
              : "선생님이 수업을 준비할 때까지 기다려 주세요."}
        </p>
        {syncError ? (
          <p className="text-center text-xs font-bold text-[#a63a1a]" role="alert">
            {syncError}
          </p>
        ) : null}
      </div>
    );
  }

  if (state.phase === "closed") {
    return (
      <section className="quest-card p-8 text-center">
        <p className="font-display text-2xl text-wood">수업이 끝났어요</p>
        <p className="mt-3 text-sm font-semibold text-foreground/70">
          선생님이 수업을 종료했습니다.
        </p>
      </section>
    );
  }

  if (state.phase === "live") {
    return (
      <div className="space-y-4">
        <section
          className={`quest-card bg-gradient-to-br ${config.headerGradient} p-5 sm:p-7`}
        >
          <p className="text-sm font-bold text-wood">
            {studentClassName ?? "우리 반"} · 수업 중
          </p>
          <h1 className="font-display mt-1 text-2xl text-foreground sm:text-3xl">
            {contentTitle}
          </h1>
          <p className="mt-2 text-sm text-foreground/70">
            선생님 속도에 맞춰 진행돼요. 제출한 뒤에도 답을 고칠 수 있어요. 다음
            문제는 선생님이 넘길 때까지 기다려 주세요.
          </p>
        </section>

        {syncError ? (
          <p
            className="rounded-xl bg-[#e85d4c]/12 px-4 py-2 text-center text-sm font-bold text-[#a63a1a]"
            role="alert"
          >
            {syncError}
          </p>
        ) : null}

        {validKey === "g3-u1-radical-fill" ? (
          <InquiryRadicalFillStep
            problem={radicalFillProblem(state.stepIndex)}
            stepIndex={state.stepIndex}
            stepCount={stepCount}
            texts={texts}
            onTextsChange={(next) => {
              setTexts(next);
              if (radicalNotice) setRadicalNotice(null);
            }}
            disabled={isPending}
            wrongAttempts={wrongAttempts}
            softNotice={radicalNotice}
            submitted={submitted}
            submitFeedback={submitFeedback}
            onSubmit={onSubmitRadical}
          />
        ) : validKey === "g1-u2-2-linear-equation-race" ? (
          <InquiryEquationOpsStep
            problem={equationOpsProblem(state.stepIndex)}
            stepIndex={state.stepIndex}
            stepCount={stepCount}
            state={raceState}
            onStateChange={setRaceState}
            disabled={isPending}
            submitted={submitted}
            submitFeedback={submitFeedback}
            earnedScore={earnedScore}
            stepStartedAt={stepStartedAt ?? undefined}
            onSubmit={onSubmitRace}
          />
        ) : validKey === "g3-u3-1-tangent-intro" ? (
          <InquiryTangentIntroStep
            scene={tangentScene(state.stepIndex)}
            stepIndex={state.stepIndex}
            stepCount={stepCount}
            workspace={tangentWorkspace}
            onWorkspaceChange={(next) => {
              setTangentWorkspace(next);
              if (tangentNotice) setTangentNotice(null);
            }}
            disabled={isPending}
            wrongAttempts={wrongAttempts}
            softNotice={tangentNotice}
            submitted={submitted}
            submitFeedback={submitFeedback}
            onSubmit={onSubmitTangent}
            sketchPersistKey={currentSketchKey}
          />
        ) : validKey === "g3-u3-1-sincos-intro" ? (
          <InquirySincosIntroStep
            scene={sincosScene(state.stepIndex)}
            stepIndex={state.stepIndex}
            stepCount={stepCount}
            workspace={sincosWorkspace}
            onWorkspaceChange={(next) => {
              setSincosWorkspace(next);
              if (sincosNotice) setSincosNotice(null);
            }}
            disabled={isPending}
            wrongAttempts={wrongAttempts}
            softNotice={sincosNotice}
            submitted={submitted}
            submitFeedback={submitFeedback}
            onSubmit={onSubmitSincos}
            sketchPersistKey={currentSketchKey}
          />
        ) : (
          <InquiryLinearEquationBalanceStep
            problem={balanceProblem(state.stepIndex)}
            stepIndex={state.stepIndex}
            stepCount={stepCount}
            workspace={balanceWorkspace}
            onWorkspaceChange={(next) => {
              setBalanceWorkspace(next);
              setBalanceMoves((m) => m + 1);
              if (balanceNotice) setBalanceNotice(null);
            }}
            disabled={isPending}
            wrongAttempts={wrongAttempts}
            softNotice={balanceNotice}
            submitted={submitted}
            submitFeedback={submitFeedback}
            onSubmit={onSubmitBalance}
          />
        )}
      </div>
    );
  }

  return (
    <InquiryUnavailable message="수업 상태를 확인할 수 없어요. 잠시 후 다시 시도해 주세요." />
  );
}
