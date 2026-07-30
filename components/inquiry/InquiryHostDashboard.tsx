"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import type { TeacherClassOption } from "@/components/content/AssignContentButton";
import InquiryResponsePanel from "@/components/inquiry/InquiryResponsePanel";
import InquiryStatusGrid from "@/components/inquiry/InquiryStatusGrid";
import InquiryRadicalFillStep, {
  emptyTexts,
} from "@/components/inquiry/radical-fill/InquiryRadicalFillStep";
import { radicalFillProblemAt } from "@/lib/inquiry-radical-fill";
import {
  INQUIRY_POLL_MS,
  type InquiryHostTab,
  type InquiryPollState,
  type InquiryResponseRow,
} from "@/lib/inquiry-types";
import {
  inquiryAdvanceStepAction,
  inquiryCloseAndScoreAction,
  inquiryCreateSessionAction,
  inquiryFindActiveTeacherAction,
  inquiryListResponsesAction,
  inquiryStartAction,
  inquiryTeacherPollAction,
} from "@/app/play/g3-u1-radical-fill/actions";

const CONTENT_KEY = "g3-u1-radical-fill";

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
};

type Props = {
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

export default function InquiryHostDashboard({
  teacherClasses,
  initialClassId,
}: Props) {
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

  const problem = radicalFillProblemAt(state.stepIndex);
  const [previewTexts, setPreviewTexts] = useState(emptyTexts(problem));

  useEffect(() => {
    setPreviewTexts(emptyTexts(radicalFillProblemAt(state.stepIndex)));
  }, [state.stepIndex]);

  const poll = useCallback(async (sid: string) => {
    const next = await inquiryTeacherPollAction({ sessionId: sid });
    setState(next);
    const { responses: rows } = await inquiryListResponsesAction({
      sessionId: sid,
    });
    setResponses(rows);
  }, []);

  useEffect(() => {
    if (!selectedClassId) return;
    let cancelled = false;

    (async () => {
      const found = await inquiryFindActiveTeacherAction({
        classId: selectedClassId,
      });
      if (cancelled) return;
      if (found.sessionId) {
        setSessionId(found.sessionId);
        await poll(found.sessionId);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedClassId, poll]);

  useEffect(() => {
    if (!sessionId) return;
    const id = window.setInterval(() => {
      void poll(sessionId);
    }, INQUIRY_POLL_MS);
    return () => window.clearInterval(id);
  }, [sessionId, poll]);

  const createSession = () => {
    if (!selectedClassId) return;
    setMessage(null);
    startTransition(async () => {
      const result = await inquiryCreateSessionAction({
        classId: selectedClassId,
      });
      if ("error" in result) {
        setMessage(result.error ?? "오류가 발생했어요.");
        return;
      }
      setSessionId(result.sessionId);
      await poll(result.sessionId);
    });
  };

  const startSession = () => {
    if (!sessionId) return;
    setMessage(null);
    startTransition(async () => {
      const result = await inquiryStartAction({ sessionId });
      if ("error" in result) {
        setMessage(result.error ?? "오류가 발생했어요.");
        return;
      }
      await poll(sessionId);
    });
  };

  const advance = (delta: number) => {
    if (!sessionId) return;
    startTransition(async () => {
      const result = await inquiryAdvanceStepAction({ sessionId, delta });
      if ("error" in result) {
        setMessage(result.error ?? "오류가 발생했어요.");
        return;
      }
      await poll(sessionId);
    });
  };

  const closeSession = () => {
    if (!sessionId) return;
    setMessage(null);
    startTransition(async () => {
      const result = await inquiryCloseAndScoreAction({ sessionId });
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
      setSessionId(null);
      setState(IDLE);
      setResponses([]);
    });
  };

  const tabs: { id: InquiryHostTab; label: string }[] = [
    { id: "problem", label: "문제 화면" },
    { id: "status", label: "접속 현황" },
    { id: "responses", label: "학생 응답" },
  ];

  return (
    <div className="flex flex-col gap-5">
      <section className="quest-card bg-gradient-to-br from-lavender/50 via-sky/25 to-mint/30 p-5 sm:p-7">
        <p className="text-sm font-bold text-wood">교사 대시보드 · 탐구 수업</p>
        <h1 className="font-display mt-1 text-2xl text-foreground sm:text-3xl">
          근호 빈칸 채우기
        </h1>
        <p className="mt-2 text-sm text-foreground/70">
          학생 화면과 같은 문제를 보며 페이지를 넘깁니다. 학생 응답은 접속
          현황·학생 응답 탭에서 확인하세요.
        </p>
      </section>

      <section className="quest-card flex flex-wrap items-end gap-4 p-4 sm:p-5">
        <label className="flex flex-col gap-1 text-sm font-bold text-wood">
          학급
          <select
            value={selectedClassId}
            onChange={(e) => {
              setSelectedClassId(e.target.value);
              setSessionId(null);
              setState(IDLE);
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
          <button
            type="button"
            onClick={createSession}
            disabled={isPending || !selectedClassId}
            className="rounded-xl bg-wood px-5 py-2.5 text-sm font-bold text-cream disabled:opacity-50"
          >
            수업 준비
          </button>
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
                    isPending || state.stepIndex >= state.stepCount - 1
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
      </section>

      {message ? (
        <p className="text-center text-sm font-bold text-wood" role="status">
          {message}
        </p>
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
            <InquiryRadicalFillStep
              problem={problem}
              stepIndex={state.stepIndex}
              stepCount={state.stepCount}
              texts={previewTexts}
              onTextsChange={setPreviewTexts}
              readOnly
            />
          ) : null}

          {tab === "status" ? (
            <section className="quest-card p-4 sm:p-5">
              <p className="mb-4 text-sm font-semibold text-foreground/70">
                O = 정답 · X = 오답 · · = 제출 · 빈칸 = 미제출
              </p>
              <InquiryStatusGrid
                participants={state.participants}
                responses={responses}
                stepCount={state.stepCount}
              />
            </section>
          ) : null}

          {tab === "responses" ? (
            <section className="quest-card p-4 sm:p-5">
              <InquiryResponsePanel
                responses={responses}
                stepCount={state.stepCount}
                selectedStep={selectedStep}
                onStepChange={setSelectedStep}
                contentKey={CONTENT_KEY}
              />
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
