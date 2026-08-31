"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  graphDeleteOwnPointAction,
  graphGuestJoinAction,
  graphGuestPollAction,
  graphSubmitPointAction,
} from "@/app/tools/graph/actions";
import { formatCoord, parseCoordinate } from "@/lib/graph-explorer-math";
import {
  sameGraphCoordinate,
  type GraphStudentState,
} from "@/lib/graph-explorer-types";
import InteractiveGraphPlane, {
  type PlanePoint,
} from "@/components/tools/graph/InteractiveGraphPlane";
import MathExpression from "@/components/tools/graph/MathExpression";
import {
  colorForParticipant,
  WRONG_POINT_COLOR,
} from "@/components/tools/graph/participant-colors";
import { notifySessionChanged, useSessionPoll } from "@/lib/session-sync";

const GUEST_KEY_STORAGE = "pm_graph_guest_key";
const NAME_STORAGE = "pm_graph_name";

function getGuestKey(): string {
  let key = localStorage.getItem(GUEST_KEY_STORAGE);
  if (!key || key.length < 8) {
    key =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `g${Date.now()}${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(GUEST_KEY_STORAGE, key);
  }
  return key;
}

type Feedback = {
  tone: "success" | "warn" | "error";
  text: string;
};

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-sky/35 px-2.5 py-0.5 text-[11px] font-semibold text-wood-dark sm:text-xs">
      {children}
    </span>
  );
}

export default function JoinClient({ initialCode }: { initialCode: string }) {
  const [code, setCode] = useState(initialCode.toUpperCase());
  const [name, setName] = useState("");
  const [guestKey, setGuestKey] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [state, setState] = useState<GraphStudentState | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [xRaw, setXRaw] = useState("");
  const [yRaw, setYRaw] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const pollingRef = useRef(false);
  const xInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedName = localStorage.getItem(NAME_STORAGE);
    if (!savedName) return;
    const raf = requestAnimationFrame(() => {
      setName((current) => (current ? current : savedName));
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  const join = async () => {
    const key = getGuestKey();
    const trimmedCode = code.trim().toUpperCase();
    const trimmedName = name.trim();
    if (trimmedCode.length !== 6) {
      setJoinError("참가코드 6자리를 입력해 주세요.");
      return;
    }
    if (!trimmedName) {
      setJoinError("이름을 입력해 주세요.");
      return;
    }

    setJoining(true);
    setJoinError(null);
    const res = await graphGuestJoinAction({
      joinCode: trimmedCode,
      guestKey: key,
      name: trimmedName,
    });
    setJoining(false);

    if ("error" in res) {
      setJoinError(
        res.error === "no_session"
          ? "그 코드로 열린 방이 없어요. 코드를 다시 확인해 주세요."
          : (res.error ?? "입장하지 못했어요."),
      );
      return;
    }

    localStorage.setItem(NAME_STORAGE, trimmedName);
    setGuestKey(key);
    setSessionId(res.sessionId);
    void notifySessionChanged(res.sessionId);
  };

  const refresh = useCallback(async () => {
    if (!sessionId || !guestKey || pollingRef.current) return;
    pollingRef.current = true;
    try {
      const res = await graphGuestPollAction({ sessionId, guestKey });
      if (!("error" in res)) setState(res);
    } finally {
      pollingRef.current = false;
    }
  }, [sessionId, guestKey]);

  const syncSession = useCallback(async () => {
    if (!sessionId) return;
    await notifySessionChanged(sessionId);
    await refresh();
  }, [sessionId, refresh]);

  useSessionPoll(sessionId, () => {
    void refresh();
  });

  const myPoints = useMemo(
    () => state?.points.filter((p) => p.isMe) ?? [],
    [state],
  );
  const unlimited = state?.settings.unlimitedPoints ?? false;
  const remaining =
    state && !unlimited
      ? Math.max(0, state.settings.maxPointsPerStudent - myPoints.length)
      : unlimited
        ? Infinity
        : 0;
  const canSubmit = unlimited || remaining > 0;

  const planePoints: PlanePoint[] = useMemo(() => {
    if (!state) return [];
    return state.points.map((p) => ({
      id: p.id,
      x: p.x,
      y: p.y,
      color: p.isMe
        ? "#e74c3c"
        : p.isCorrect
          ? colorForParticipant(p.participantName)
          : WRONG_POINT_COLOR,
      label: p.isMe
        ? "나"
        : state.settings.showNames
          ? p.participantName
          : null,
      isCorrect: p.isCorrect,
      emphasized: p.isMe,
    }));
  }, [state]);

  const submit = async () => {
    if (!sessionId || !guestKey || submitting) return;
    if (!xRaw.trim() || !yRaw.trim()) {
      setFeedback({ tone: "error", text: "x와 y를 모두 입력해 주세요." });
      return;
    }

    if (state && !state.settings.allowDuplicatePoints) {
      const x = parseCoordinate(xRaw);
      const y = parseCoordinate(yRaw);
      if (x != null && y != null) {
        const taken = state.points.some((p) =>
          sameGraphCoordinate(p.x, p.y, x, y),
        );
        if (taken) {
          const mine = state.points.some(
            (p) => p.isMe && sameGraphCoordinate(p.x, p.y, x, y),
          );
          setFeedback({
            tone: "error",
            text: mine
              ? "이미 내가 찍은 점이에요. 다른 점을 찾아보세요!"
              : "이미 다른 친구가 찍은 점이에요. 다른 점을 찾아보세요!",
          });
          return;
        }
      }
    }

    setSubmitting(true);
    const res = await graphSubmitPointAction({
      sessionId,
      guestKey,
      xRaw,
      yRaw,
    });
    setSubmitting(false);

    if (!res.ok) {
      setFeedback({ tone: "error", text: res.error });
      return;
    }

    if (res.verdict === "correct") {
      setFeedback({
        tone: "success",
        text: "정답이에요! 칠판에 점이 찍혔어요. 다른 점도 찾아볼까요?",
      });
      setXRaw("");
      setYRaw("");
      xInputRef.current?.focus();
    } else if (res.verdict === "undefined_at_x") {
      setFeedback({
        tone: "warn",
        text: "그 x에서는 y값이 정해지지 않아요! (분모가 0이 되는지 살펴보세요)",
      });
    } else if (res.stored) {
      setFeedback({
        tone: "warn",
        text: "식을 만족하지 않는 점이에요. 칠판에는 회색 ×로 표시돼요. 다시 계산해 볼까요?",
      });
      setXRaw("");
      setYRaw("");
    } else {
      setFeedback({
        tone: "warn",
        text: "아직 식을 만족하지 않아요. 기회는 그대로! 다시 도전해 보세요.",
      });
    }
    await syncSession();
  };

  // ── 입장 전 화면 ──────────────────────────────────────────────
  if (!sessionId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6">
        <div className="w-full max-w-md space-y-6 sm:max-w-lg">
          <header className="text-center">
            <p
              className="font-display text-4xl text-wood-dark sm:text-5xl"
              aria-hidden
            >
              그래프 탐구
            </p>
            <h1 className="font-display mt-2 text-2xl text-wood-dark sm:text-3xl">
              참여하기
            </h1>
            <p className="mt-2 text-sm text-foreground/60 sm:text-base">
              로그인 없이 이름만 적고 바로 들어와요
            </p>
          </header>

          <div className="space-y-4 rounded-[1.75rem] border-2 border-wood/15 bg-cream/90 p-6 shadow-[0_12px_40px_-24px_rgba(107,68,35,0.35)] sm:p-8">
            <label className="block">
              <span className="text-sm font-semibold text-foreground/80">
                참가코드
              </span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={6}
                placeholder="ABC123"
                autoCapitalize="characters"
                autoComplete="off"
                className="mt-1.5 w-full rounded-2xl border-2 border-wood/20 bg-white px-4 py-3.5 text-center font-mono text-2xl tracking-[0.35em] uppercase outline-none transition focus:border-wood/50 sm:py-4 sm:text-3xl"
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-foreground/80">
                이름
              </span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={20}
                placeholder="이름을 입력하세요"
                className="mt-1.5 w-full rounded-2xl border-2 border-wood/20 bg-white px-4 py-3.5 text-lg outline-none transition focus:border-wood/50 sm:py-4 sm:text-xl"
                onKeyDown={(e) => {
                  if (e.key === "Enter") join();
                }}
              />
            </label>

            {joinError ? (
              <p className="text-center text-sm font-semibold text-red-500">
                {joinError}
              </p>
            ) : null}

            <button
              type="button"
              onClick={join}
              disabled={joining}
              className="font-display w-full rounded-2xl bg-gold px-4 py-3.5 text-lg text-[#6b4a00] shadow-[0_4px_0_rgba(107,74,0,0.3)] transition hover:brightness-105 active:translate-y-0.5 disabled:opacity-50 sm:py-4 sm:text-xl"
            >
              {joining ? "입장 중…" : "입장하기"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── 활동 화면 ────────────────────────────────────────────────
  if (!state) {
    return (
      <div className="flex flex-1 items-center justify-center text-foreground/50">
        불러오는 중…
      </div>
    );
  }

  const closed = state.status === "closed";
  const boardTitle = state.settings.shareBoardWithStudents
    ? "우리 반 좌표평면"
    : "내 점만 보여요";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 px-3 py-3 sm:gap-4 sm:px-5 sm:py-4 lg:px-6">
      {/* 상단: 식 · 상태 */}
      <header className="shrink-0 rounded-2xl border-2 border-wood/15 bg-cream/95 px-4 py-3 sm:px-5 sm:py-3.5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0 text-center sm:text-left">
            <p className="text-[11px] text-foreground/55 sm:text-xs">
              <span className="font-semibold text-wood-dark">
                {state.myName ?? name}
              </span>
              <span className="mx-1.5 text-foreground/30">·</span>
              함께 {state.participantCount}명
              {closed ? (
                <>
                  <span className="mx-1.5 text-foreground/30">·</span>
                  <span className="font-semibold text-foreground/70">종료됨</span>
                </>
              ) : null}
            </p>
            {state.expressionDisplay ? (
              <div className="mt-0.5 flex justify-center sm:justify-start">
                <MathExpression
                  display={state.expressionDisplay}
                  latex={state.expressionLatex}
                  className="text-xl sm:text-2xl md:text-[1.65rem]"
                />
              </div>
            ) : (
              <p className="font-display mt-0.5 text-lg text-wood-dark sm:text-xl">
                y = ❓
                <span className="ml-2 text-sm font-normal text-foreground/60">
                  식이 숨겨져 있어요
                </span>
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-1.5 sm:justify-end">
            {state.settings.integersOnly ? <Badge>정수만</Badge> : null}
            {!state.settings.allowDuplicatePoints ? (
              <Badge>같은 점 한 명만</Badge>
            ) : null}
            {state.reveal ? <Badge>개형 공개</Badge> : null}
            <p className="hidden text-xs text-foreground/55 md:block md:max-w-[14rem] md:text-right">
              식을 만족하는 순서쌍 (x, y)를 찾아 제출하세요
            </p>
          </div>
        </div>
        <p className="mt-1.5 text-center text-xs text-foreground/60 md:hidden">
          식을 만족하는 순서쌍 (x, y)를 찾아 제출하세요
        </p>
      </header>

      {/* 본문: 모바일=제출→그래프 / 패드+=그래프 주인공 + 옆 패널 */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(17.5rem,22rem)] md:gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)] lg:gap-5">
        {/* 조작 패널 */}
        <aside className="order-1 flex min-h-0 flex-col gap-3 md:order-2 md:overflow-y-auto md:pr-0.5">
          {closed ? (
            <div className="rounded-2xl border-2 border-wood/15 bg-black/[0.03] px-5 py-6 text-center">
              <p className="font-display text-lg text-wood-dark">
                활동이 끝났어요
              </p>
              <p className="mt-1 text-sm text-foreground/60">
                함께 탐구해줘서 고마워요!
              </p>
            </div>
          ) : (
            <div className="space-y-3 rounded-2xl border-2 border-wood/15 bg-cream p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2">
                <p className="font-display text-sm text-wood-dark sm:text-base">
                  순서쌍 제출
                </p>
                <p className="text-xs text-foreground/60 sm:text-sm">
                  {unlimited ? (
                    <>
                      제출{" "}
                      <b className="text-wood-dark">무제한</b>
                    </>
                  ) : (
                    <>
                      남은 기회{" "}
                      <b className="text-wood-dark">{remaining}</b>개
                    </>
                  )}
                </p>
              </div>

              <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                <span className="font-display text-2xl text-wood-dark sm:text-3xl">
                  (
                </span>
                <input
                  ref={xInputRef}
                  value={xRaw}
                  onChange={(e) => setXRaw(e.target.value)}
                  placeholder="x"
                  inputMode="text"
                  autoComplete="off"
                  aria-label="x 좌표"
                  className="h-12 w-[4.75rem] rounded-xl border-2 border-wood/20 bg-white px-2 text-center font-mono text-xl outline-none transition focus:border-wood/50 sm:h-14 sm:w-24 sm:text-2xl md:w-[5.5rem]"
                />
                <span className="font-display text-2xl text-wood-dark sm:text-3xl">
                  ,
                </span>
                <input
                  value={yRaw}
                  onChange={(e) => setYRaw(e.target.value)}
                  placeholder="y"
                  inputMode="text"
                  autoComplete="off"
                  aria-label="y 좌표"
                  className="h-12 w-[4.75rem] rounded-xl border-2 border-wood/20 bg-white px-2 text-center font-mono text-xl outline-none transition focus:border-wood/50 sm:h-14 sm:w-24 sm:text-2xl md:w-[5.5rem]"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submit();
                  }}
                />
                <span className="font-display text-2xl text-wood-dark sm:text-3xl">
                  )
                </span>
              </div>
              <p className="text-center text-[11px] text-foreground/50 sm:text-xs">
                분수는 3/2 처럼 입력할 수 있어요
              </p>

              {feedback ? (
                <p
                  role="status"
                  className={`rounded-xl px-3 py-2.5 text-center text-sm font-semibold sm:text-[0.95rem] ${
                    feedback.tone === "success"
                      ? "bg-emerald-50 text-emerald-700"
                      : feedback.tone === "warn"
                        ? "bg-amber-50 text-amber-800"
                        : "bg-red-50 text-red-600"
                  }`}
                >
                  {feedback.text}
                </p>
              ) : null}

              <button
                type="button"
                onClick={submit}
                disabled={submitting || !canSubmit}
                className="font-display w-full rounded-2xl bg-gold px-4 py-3.5 text-lg text-[#6b4a00] shadow-[0_4px_0_rgba(107,74,0,0.3)] transition hover:brightness-105 active:translate-y-0.5 disabled:opacity-50 sm:py-4 sm:text-xl"
              >
                {submitting
                  ? "확인 중…"
                  : !canSubmit
                    ? "제출 기회를 모두 사용했어요"
                    : "점 제출하기"}
              </button>
            </div>
          )}

          {myPoints.length > 0 ? (
            <div className="rounded-2xl border-2 border-wood/15 bg-cream p-4 sm:p-5">
              <p className="font-display text-sm text-wood-dark sm:text-base">
                내가 찍은 점
              </p>
              <ul className="mt-2 max-h-36 space-y-1.5 overflow-y-auto sm:max-h-48 md:max-h-[min(40vh,16rem)]">
                {myPoints.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-2 text-sm sm:text-[0.95rem]"
                  >
                    <span>
                      ({formatCoord(p.x)}, {formatCoord(p.y)}){" "}
                      {p.isCorrect ? (
                        <span className="text-emerald-600">정답</span>
                      ) : (
                        <span className="text-red-500">오답</span>
                      )}
                    </span>
                    {!closed ? (
                      <button
                        type="button"
                        onClick={async () => {
                          if (!guestKey) return;
                          await graphDeleteOwnPointAction({
                            sessionId,
                            guestKey,
                            pointId: p.id,
                          });
                          void syncSession();
                        }}
                        className="shrink-0 rounded-lg px-2 py-1 text-xs text-foreground/40 transition hover:bg-red-50 hover:text-red-500"
                      >
                        지우기
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>

        {/* 좌표평면 — 패드/데스크톱에서 화면의 주인공 */}
        <section className="order-2 flex min-h-[min(52dvh,26rem)] flex-col overflow-hidden rounded-2xl border-2 border-wood/15 bg-cream md:order-1 md:h-full md:min-h-[20rem]">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-wood/10 px-3 py-2 sm:px-4">
            <p className="text-xs font-semibold text-foreground/65 sm:text-sm">
              {boardTitle}
              {state.reveal ? (
                <span className="ml-1.5 font-normal text-wood/80">
                  · 개형 공개
                </span>
              ) : null}
            </p>
            <p className="text-[10px] text-foreground/40 sm:text-xs">
              드래그·줌 가능
            </p>
          </div>
          <div className="relative min-h-0 flex-1">
            <InteractiveGraphPlane
              xMin={state.settings.xMin}
              xMax={state.settings.xMax}
              yMin={state.settings.yMin}
              yMax={state.settings.yMax}
              step={state.settings.step}
              points={planePoints}
              curveExpression={state.reveal ? state.expression : null}
              pointSize={state.settings.pointSize}
              showNames={state.settings.showNames}
              interactive
              className="absolute inset-0 h-full w-full"
            />
          </div>
        </section>
      </div>
    </div>
  );
}
