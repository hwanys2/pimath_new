"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import type { TeacherClassOption } from "@/components/content/AssignContentButton";
import InquiryResponsePanel from "@/components/inquiry/InquiryResponsePanel";
import InquiryLiveRanking from "@/components/inquiry/InquiryLiveRanking";
import InquirySpectatorView from "@/components/inquiry/InquirySpectatorView";
import InquiryStatusGrid from "@/components/inquiry/InquiryStatusGrid";
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
  type InquiryContentKey,
} from "@/lib/inquiry-content-registry";
import {
  type InquiryHostTab,
  type InquiryPollState,
  type InquiryResponseRow,
} from "@/lib/inquiry-types";
import * as radicalFillActions from "@/app/play/g3-u1-radical-fill/actions";
import * as balanceActions from "@/app/play/g1-u2-2-linear-equation-balance/actions";
import * as raceActions from "@/app/play/g1-u2-2-linear-equation-race/actions";
import * as tangentActions from "@/app/play/g3-u3-1-tangent-intro/actions";
import * as sincosActions from "@/app/play/g3-u3-1-sincos-intro/actions";
import { effectiveInquiryStepCount } from "@/lib/inquiry-step-counts";
import { notifySessionChanged, useSessionPoll } from "@/lib/session-sync";

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
  teacherClasses: TeacherClassOption[];
  initialClassId?: string | null;
};

function phaseLabel(phase: InquiryPollState["phase"]): string {
  switch (phase) {
    case "setup":
      return "준비 중";
    case "live":
      return "수업 중";
    case "closed":
      return "종료됨";
    default:
      return "대기";
  }
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

export default function InquiryHostDashboard({
  contentKey,
  teacherClasses,
  initialClassId,
}: Props) {
  const config = getInquiryContent(contentKey);
  const validKey = isInquiryContentKey(contentKey) ? contentKey : null;

  const resolvedInitial =
    initialClassId &&
    teacherClasses.some((c) => c.id === initialClassId)
      ? initialClassId
      : (teacherClasses[0]?.id ?? "");

  const [selectedClassId, setSelectedClassId] = useState(resolvedInitial);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [state, setState] = useState<InquiryPollState>(IDLE);
  const [responses, setResponses] = useState<InquiryResponseRow[]>([]);
  const [tab, setTab] = useState<InquiryHostTab>("problem");
  const [selectedStep, setSelectedStep] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [foreignSession, setForeignSession] = useState<{
    sessionId: string;
    contentKey: string;
    title: string;
  } | null>(null);

  const [previewTexts, setPreviewTexts] = useState(
    validKey === "g3-u1-radical-fill"
      ? radicalFillInitialState(0)
      : [],
  );
  const [previewBalance, setPreviewBalance] = useState(
    validKey === "g1-u2-2-linear-equation-balance"
      ? balanceInitialState(0)
      : { left: [], right: [] },
  );
  const [previewRace, setPreviewRace] = useState(
    validKey === "g1-u2-2-linear-equation-race"
      ? equationOpsInitialState(0)
      : { balance: { left: { x: 0, unit: 0 }, right: { x: 0, unit: 0 } }, trail: [], opCount: 0 },
  );
  const [previewTangent, setPreviewTangent] = useState(() =>
    tangentInitialState(0),
  );
  const [previewSincos, setPreviewSincos] = useState(() =>
    sincosInitialState(0),
  );

  useEffect(() => {
    const stillValid = teacherClasses.some((c) => c.id === selectedClassId);
    if (stillValid) return;
    setSelectedClassId(teacherClasses[0]?.id ?? "");
    setSessionId(null);
    setState(IDLE);
    setForeignSession(null);
  }, [teacherClasses, selectedClassId]);

  useEffect(() => {
    if (!validKey) return;
    if (validKey === "g3-u1-radical-fill") {
      setPreviewTexts(radicalFillInitialState(state.stepIndex));
    } else if (validKey === "g1-u2-2-linear-equation-race") {
      setPreviewRace(equationOpsInitialState(state.stepIndex));
    } else if (validKey === "g3-u3-1-tangent-intro") {
      setPreviewTangent(tangentInitialState(state.stepIndex));
    } else if (validKey === "g3-u3-1-sincos-intro") {
      setPreviewSincos(sincosInitialState(state.stepIndex));
    } else {
      setPreviewBalance(balanceInitialState(state.stepIndex));
    }
  }, [state.stepIndex, validKey]);

  const poll = useCallback(
    async (sid: string) => {
      if (!validKey) return;
      const actions = getActions(validKey);
      const next = await actions.inquiryTeacherPollAction({ sessionId: sid });
      setState(next);
      const { responses: rows } = await actions.inquiryListResponsesAction({
        sessionId: sid,
      });
      setResponses(rows);
    },
    [validKey],
  );

  const syncSession = useCallback(
    async (sid: string) => {
      await notifySessionChanged(sid);
      await poll(sid);
    },
    [poll],
  );

  useEffect(() => {
    if (!selectedClassId || !validKey) return;
    let cancelled = false;

    (async () => {
      const actions = getActions(validKey);
      const found = await actions.inquiryFindActiveTeacherAction({
        classId: selectedClassId,
      });
      if (cancelled) return;
      if (!found.sessionId) {
        setForeignSession(null);
        return;
      }
      const next = await actions.inquiryTeacherPollAction({
        sessionId: found.sessionId,
      });
      if (cancelled) return;
      if (next.contentKey && next.contentKey !== validKey) {
        setForeignSession({
          sessionId: found.sessionId,
          contentKey: next.contentKey,
          title: getInquiryContent(next.contentKey)?.title ?? next.contentKey,
        });
        setSessionId(null);
        setState(IDLE);
        setResponses([]);
        return;
      }
      setForeignSession(null);
      setSessionId(found.sessionId);
      await poll(found.sessionId);
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedClassId, poll, validKey]);

  useSessionPoll(sessionId, () => {
    if (sessionId) void poll(sessionId);
  });

  const startSession = () => {
    if (!sessionId || !validKey) return;
    setMessage(null);
    const actions = getActions(validKey);
    startTransition(async () => {
      const result = await actions.inquiryStartAction({ sessionId });
      if ("error" in result) {
        setMessage(result.error ?? "오류가 발생했어요.");
        return;
      }
      await syncSession(sessionId);
    });
  };

  const advance = (delta: number) => {
    if (!sessionId || !validKey) return;
    const actions = getActions(validKey);
    startTransition(async () => {
      const result = await actions.inquiryAdvanceStepAction({
        sessionId,
        delta,
      });
      if ("error" in result) {
        setMessage(result.error ?? "오류가 발생했어요.");
        return;
      }
      await syncSession(sessionId);
    });
  };

  const closeSession = () => {
    if (!sessionId || !validKey) return;
    const closingId = sessionId;
    setMessage(null);
    const actions = getActions(validKey);
    startTransition(async () => {
      const result = await actions.inquiryCloseAndScoreAction({
        sessionId: closingId,
      });
      if ("error" in result) {
        setMessage(result.error ?? "오류가 발생했어요.");
        return;
      }
      const recorded = "recorded" in result ? result.recorded : 0;
      setMessage(
        recorded > 0
          ? `수업을 종료했어요. ${recorded}명의 점수가 반영됐어요.`
          : "수업을 종료했어요.",
      );
      await notifySessionChanged(closingId);
      setSessionId(null);
      setState(IDLE);
      setResponses([]);
      setForeignSession(null);
    });
  };

  const closeForeignSession = () => {
    if (!foreignSession || !validKey) return;
    setMessage(null);
    const actions = getActions(validKey);
    startTransition(async () => {
      const result = await actions.inquiryCloseAndScoreAction({
        sessionId: foreignSession.sessionId,
      });
      if ("error" in result) {
        setMessage(result.error ?? "오류가 발생했어요.");
        return;
      }
      const recorded = "recorded" in result ? result.recorded : 0;
      setMessage(
        recorded > 0
          ? `「${foreignSession.title}」 수업을 종료했어요. ${recorded}명의 점수가 반영됐어요.`
          : `「${foreignSession.title}」 수업을 종료했어요.`,
      );
      await notifySessionChanged(foreignSession.sessionId);
      setForeignSession(null);
    });
  };

  const createSession = () => {
    if (!selectedClassId || !validKey) return;
    setMessage(null);
    const replacing = foreignSession;
    const actions = getActions(validKey);
    startTransition(async () => {
      const result = await actions.inquiryCreateSessionAction({
        classId: selectedClassId,
      });
      if ("error" in result) {
        setMessage(result.error ?? "오류가 발생했어요.");
        return;
      }
      setSessionId(result.sessionId);
      setForeignSession(null);

      if (replacing) {
        const started = await actions.inquiryStartAction({
          sessionId: result.sessionId,
        });
        if ("error" in started) {
          setMessage(
            started.error ??
              "이전 수업은 저장했지만 이 수업을 시작하지 못했어요.",
          );
          await syncSession(result.sessionId);
          return;
        }
      }

      const recorded = "recorded" in result ? result.recorded : 0;
      if (replacing) {
        setMessage(
          recorded > 0
            ? `「${replacing.title}」 점수를 ${recorded}명 저장하고 이 수업을 시작했어요.`
            : `「${replacing.title}」를 종료하고 이 수업을 시작했어요.`,
        );
      } else if (recorded > 0) {
        setMessage(
          `이전 수업 결과 ${recorded}명을 저장한 뒤 새 수업을 준비했어요.`,
        );
      }
      await syncSession(result.sessionId);
    });
  };

  const tabs: { id: InquiryHostTab; label: string }[] = [
    { id: "problem", label: "문제 화면" },
    { id: "status", label: "접속 현황" },
    { id: "responses", label: "학생 응답" },
    ...(config?.hasLiveRanking ? [{ id: "ranking" as const, label: "랭킹" }] : []),
  ];

  if (!config || !validKey) {
    return (
      <section className="quest-card p-8 text-center">
        <p className="font-display text-xl text-wood">알 수 없는 탐구 콘텐츠예요.</p>
      </section>
    );
  }

  const stepCount = effectiveInquiryStepCount(validKey, state.stepCount);

  return (
    <div className="flex flex-col gap-5">
      <section
        className={`quest-card bg-gradient-to-br ${config.headerGradient} p-5 sm:p-7`}
      >
        <p className="text-sm font-bold text-wood">교사 대시보드 · 탐구 수업</p>
        <h1 className="font-display mt-1 text-2xl text-foreground sm:text-3xl">
          {config.title}
        </h1>
        <p className="mt-2 text-sm text-foreground/70">{config.hostSubtitle}</p>
      </section>

      <section className="quest-card flex flex-wrap items-end gap-4 p-4 sm:p-5">
        {teacherClasses.length === 0 ? (
          <p className="text-sm font-semibold text-foreground/70">
            이 활동을 학급에 담아야 수업을 시작할 수 있어요. 위쪽 「배정」에서
            학급을 선택해 주세요.
          </p>
        ) : (
          <>
            <label className="flex flex-col gap-1 text-sm font-bold text-wood">
              학급
              <select
                value={selectedClassId}
                onChange={(e) => {
                  setSelectedClassId(e.target.value);
                  setSessionId(null);
                  setState(IDLE);
                  setForeignSession(null);
                }}
                className="rounded-lg border-2 border-wood/20 bg-cream px-3 py-2 font-semibold"
              >
                {teacherClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            {!sessionId ? (
              <div className="flex flex-col gap-3">
                {foreignSession ? (
                  <p className="text-sm font-semibold text-wood">
                    이 학급은 「{foreignSession.title}」 수업이 아직 진행
                    중이에요. 이 수업을 시작하면 그 수업을 종료하고 점수를
                    저장합니다.
                  </p>
                ) : null}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={createSession}
                    disabled={isPending || !selectedClassId}
                    className="rounded-xl bg-wood px-5 py-2.5 text-sm font-bold text-cream disabled:opacity-50"
                  >
                    {foreignSession ? "이 수업 시작" : "수업 준비"}
                  </button>
                  {foreignSession ? (
                    <button
                      type="button"
                      onClick={closeForeignSession}
                      disabled={isPending}
                      className="rounded-xl border-2 border-wood/20 px-4 py-2 text-sm font-bold text-wood disabled:opacity-50"
                    >
                      그 수업만 종료
                    </button>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-lg bg-lavender/40 px-3 py-1.5 text-sm font-bold text-wood">
                  {state.className ?? "학급"} · {phaseLabel(state.phase)}
                </span>
                {state.phase === "setup" ? (
                  <button
                    type="button"
                    onClick={startSession}
                    disabled={isPending}
                    className="rounded-xl bg-mint px-5 py-2.5 text-sm font-bold text-wood disabled:opacity-50"
                  >
                    수업 시작
                  </button>
                ) : null}
                {state.phase === "live" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => advance(-1)}
                      disabled={isPending || state.stepIndex <= 0}
                      className="rounded-xl border-2 border-wood/20 px-4 py-2 text-sm font-bold text-wood disabled:opacity-40"
                    >
                      이전
                    </button>
                    <button
                      type="button"
                      onClick={() => advance(1)}
                      disabled={
                        isPending || state.stepIndex >= stepCount - 1
                      }
                      className="rounded-xl border-2 border-wood/20 px-4 py-2 text-sm font-bold text-wood disabled:opacity-40"
                    >
                      다음
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  onClick={closeSession}
                  disabled={isPending}
                  className="rounded-xl bg-[#e85d4c] px-4 py-2 text-sm font-bold text-cream disabled:opacity-50"
                >
                  수업 종료
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {message ? (
        <p className="text-center text-sm font-bold text-wood" role="status">
          {message}
        </p>
      ) : null}

      {!sessionId ? (
        <section className="space-y-3">
          <p className="text-sm font-semibold text-foreground/70">
            수업 전에 문제를 직접 조작하며 설명할 수 있어요.
          </p>
          <InquirySpectatorView
            embedded
            contentKey={validKey}
            title={config.title}
          />
        </section>
      ) : null}

      {sessionId && state.phase !== "idle" ? (
        <>
          <div className="flex flex-wrap gap-2 border-b border-wood/15 pb-2">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={[
                  "rounded-lg px-4 py-2 text-sm font-bold",
                  tab === t.id
                    ? "bg-wood text-cream"
                    : "bg-wood/10 text-wood hover:bg-wood/15",
                ].join(" ")}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "problem" ? (
            validKey === "g3-u1-radical-fill" ? (
              <InquiryRadicalFillStep
                problem={radicalFillProblem(state.stepIndex)}
                stepIndex={state.stepIndex}
                stepCount={stepCount}
                texts={previewTexts}
                onTextsChange={setPreviewTexts}
                hostPreview
              />
            ) : validKey === "g1-u2-2-linear-equation-race" ? (
              <InquiryEquationOpsStep
                problem={equationOpsProblem(state.stepIndex)}
                stepIndex={state.stepIndex}
                stepCount={stepCount}
                state={previewRace}
                onStateChange={setPreviewRace}
                hostPreview
              />
            ) : validKey === "g3-u3-1-tangent-intro" ? (
              <InquiryTangentIntroStep
                scene={tangentScene(state.stepIndex)}
                stepIndex={state.stepIndex}
                stepCount={stepCount}
                workspace={previewTangent}
                onWorkspaceChange={setPreviewTangent}
                hostPreview
              />
            ) : validKey === "g3-u3-1-sincos-intro" ? (
              <InquirySincosIntroStep
                scene={sincosScene(state.stepIndex)}
                stepIndex={state.stepIndex}
                stepCount={stepCount}
                workspace={previewSincos}
                onWorkspaceChange={setPreviewSincos}
                hostPreview
              />
            ) : (
              <InquiryLinearEquationBalanceStep
                problem={balanceProblem(state.stepIndex)}
                stepIndex={state.stepIndex}
                stepCount={stepCount}
                workspace={previewBalance}
                onWorkspaceChange={setPreviewBalance}
                hostPreview
              />
            )
          ) : null}

          {tab === "status" ? (
            <section className="quest-card p-4 sm:p-5">
              <p className="mb-4 text-sm font-semibold text-foreground/70">
                O = 정답 · X = 오답 · · = 제출 · 빈칸 = 미제출
              </p>
              <InquiryStatusGrid
                participants={state.participants}
                responses={responses}
                stepCount={stepCount}
              />
            </section>
          ) : null}

          {tab === "responses" ? (
            <section className="quest-card p-4 sm:p-5">
              <InquiryResponsePanel
                responses={responses}
                stepCount={stepCount}
                selectedStep={selectedStep}
                onStepChange={setSelectedStep}
                contentKey={contentKey}
              />
            </section>
          ) : null}

          {tab === "ranking" ? (
            <section className="quest-card p-4 sm:p-5">
              <InquiryLiveRanking
                responses={responses}
                stepCount={stepCount}
                title={
                  state.phase === "closed" ? "최종 랭킹" : "실시간 랭킹"
                }
              />
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
