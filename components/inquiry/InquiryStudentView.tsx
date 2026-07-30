"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import RadicalFillQuiz from "@/components/games/RadicalFillQuiz";
import InquiryWaitingScreen from "@/components/inquiry/InquiryWaitingScreen";
import InquiryRadicalFillStep, {
  emptyTexts,
  validateRadicalFillSubmit,
  type SoftNotice,
  type TermTexts,
} from "@/components/inquiry/radical-fill/InquiryRadicalFillStep";
import {
  inquiryFindActiveStudentAction,
  inquiryJoinAction,
  inquiryStudentPollAction,
  inquirySubmitRadicalFillAction,
} from "@/app/play/g3-u1-radical-fill/actions";
import { radicalFillProblemAt } from "@/lib/inquiry-radical-fill";
import { INQUIRY_POLL_MS, type InquiryPollState } from "@/lib/inquiry-types";

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
  studentClassId: string | null;
  studentClassName: string | null;
  studentName: string | null;
};

export default function InquiryStudentView({
  studentClassId,
  studentClassName,
  studentName,
}: Props) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [state, setState] = useState<InquiryPollState>(IDLE);
  const [noSession, setNoSession] = useState(false);
  const [texts, setTexts] = useState<TermTexts[]>([]);
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [softNotice, setSoftNotice] = useState<SoftNotice | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitFeedback, setSubmitFeedback] = useState<
    "correct" | "wrong" | null
  >(null);
  const [isPending, startTransition] = useTransition();

  const prevStepRef = useRef(-1);
  const wrongRef = useRef(0);

  const resetStep = useCallback((stepIndex: number) => {
    const problem = radicalFillProblemAt(stepIndex);
    setTexts(emptyTexts(problem));
    setWrongAttempts(0);
    wrongRef.current = 0;
    setSoftNotice(null);
    setSubmitted(false);
    setSubmitFeedback(null);
    prevStepRef.current = stepIndex;
  }, []);

  const joinAndPoll = useCallback(
    async (classId: string) => {
      const active = await inquiryFindActiveStudentAction({ classId });
      if (!active.sessionId) {
        setNoSession(true);
        setSessionId(null);
        setState(IDLE);
        return;
      }

      setNoSession(false);
      const join = await inquiryJoinAction({ classId });
      if ("error" in join) {
        if (join.error === "no_session") {
          setNoSession(true);
          return;
        }
        return;
      }

      setSessionId(join.sessionId);
      const poll = await inquiryStudentPollAction({
        sessionId: join.sessionId,
      });
      setState(poll);
      if (poll.phase === "live" && prevStepRef.current !== poll.stepIndex) {
        resetStep(poll.stepIndex);
      }
    },
    [resetStep],
  );

  useEffect(() => {
    if (!studentClassId) {
      setNoSession(true);
      return;
    }
    void joinAndPoll(studentClassId);
  }, [studentClassId, joinAndPoll]);

  useEffect(() => {
    if (!sessionId) return;
    const id = window.setInterval(async () => {
      const poll = await inquiryStudentPollAction({ sessionId });
      setState(poll);

      if (poll.phase === "live" && prevStepRef.current !== poll.stepIndex) {
        resetStep(poll.stepIndex);
      }

      if (poll.myStepResult && !submitted) {
        setSubmitted(true);
        setSubmitFeedback(
          poll.myStepResult === "correct" ? "correct" : "wrong",
        );
      }
    }, INQUIRY_POLL_MS);
    return () => window.clearInterval(id);
  }, [sessionId, resetStep, submitted]);

  const problem = radicalFillProblemAt(state.stepIndex);

  const onSubmit = () => {
    if (!sessionId || submitted || state.phase !== "live") return;
    const notice = validateRadicalFillSubmit(problem, texts);
    if (notice) {
      if (notice.reason === "wrong") {
        const next = wrongRef.current + 1;
        wrongRef.current = next;
        setWrongAttempts(next);
      }
      setSoftNotice(notice);
      return;
    }

    startTransition(async () => {
      const result = await inquirySubmitRadicalFillAction({
        sessionId,
        stepIndex: state.stepIndex,
        texts,
        wrongs: wrongRef.current,
        gaveUp: false,
      });
      if ("error" in result) {
        setSoftNotice({ reason: "wrong" });
        return;
      }
      setSubmitted(true);
      setSubmitFeedback("correct");
      setSoftNotice(null);
    });
  };

  const onGiveUp = () => {
    if (!sessionId || submitted || state.phase !== "live") return;
    startTransition(async () => {
      await inquirySubmitRadicalFillAction({
        sessionId,
        stepIndex: state.stepIndex,
        texts,
        wrongs: wrongRef.current,
        gaveUp: true,
      });
      setSubmitted(true);
      setSubmitFeedback("wrong");
      setSoftNotice(null);
    });
  };

  if (!studentClassId || noSession) {
    return <RadicalFillQuiz />;
  }

  if (state.phase === "setup" || (sessionId && state.phase === "idle")) {
    return (
      <div className="space-y-4">
        <section className="quest-card bg-gradient-to-br from-lavender/50 via-sky/25 to-mint/30 p-5 sm:p-7">
          <p className="text-sm font-bold text-wood">
            {studentClassName ?? "우리 반"} · 탐구 수업
          </p>
          <h1 className="font-display mt-1 text-2xl text-foreground sm:text-3xl">
            근호 빈칸 채우기
          </h1>
        </section>
        <InquiryWaitingScreen studentName={studentName} />
        <p className="text-center text-xs font-medium text-foreground/50">
          접속 확인됨 · 선생님이 수업을 시작하면 문제가 열려요.
        </p>
      </div>
    );
  }

  if (state.phase === "closed") {
    return (
      <section className="quest-card p-8 text-center">
        <p className="font-display text-2xl text-wood">수업이 끝났어요</p>
        <p className="mt-3 text-sm font-semibold text-foreground/70">
          선생님이 수업을 종료했습니다. 혼자 연습하려면 페이지를 새로고침하세요.
        </p>
      </section>
    );
  }

  if (state.phase === "live") {
    return (
      <div className="space-y-4">
        <section className="quest-card bg-gradient-to-br from-lavender/50 via-sky/25 to-mint/30 p-5 sm:p-7">
          <p className="text-sm font-bold text-wood">
            {studentClassName ?? "우리 반"} · 수업 중
          </p>
          <h1 className="font-display mt-1 text-2xl text-foreground sm:text-3xl">
            근호 빈칸 채우기
          </h1>
          <p className="mt-2 text-sm text-foreground/70">
            선생님 속도에 맞춰 진행돼요. 제출 후 다음 문제는 선생님이 넘길 때까지
            기다려 주세요.
          </p>
        </section>

        <InquiryRadicalFillStep
          problem={problem}
          stepIndex={state.stepIndex}
          stepCount={state.stepCount}
          texts={texts}
          onTextsChange={(next) => {
            setTexts(next);
            if (softNotice) setSoftNotice(null);
          }}
          disabled={isPending}
          wrongAttempts={wrongAttempts}
          softNotice={softNotice}
          submitted={submitted}
          submitFeedback={submitFeedback}
          onSubmit={onSubmit}
          onGiveUp={onGiveUp}
        />
      </div>
    );
  }

  return <RadicalFillQuiz />;
}
