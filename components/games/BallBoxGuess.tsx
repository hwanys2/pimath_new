"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import type { TeacherClassOption } from "@/components/content/AssignContentButton";
import {
  BallBoxJoinQR,
  BallDrawDisplay,
  GuessInputGrid,
  GuestNameEntry,
  ObservedTally,
  RevealedComposition,
  SessionRanking,
} from "@/components/games/BallBoxGuessBoard";
import {
  ballBoxCloseAction,
  ballBoxCreateGuestSessionAction,
  ballBoxCreateSessionAction,
  ballBoxDrawAction,
  ballBoxFindActiveStudentAction,
  ballBoxFindActiveTeacherAction,
  ballBoxFindByCodeAction,
  ballBoxGuessAction,
  ballBoxGuestDrawAction,
  ballBoxGuestGuessAction,
  ballBoxGuestJoinAction,
  ballBoxGuestPollAction,
  ballBoxJoinAction,
  ballBoxNextRoundAction,
  ballBoxRevealAction,
  ballBoxStartAction,
  ballBoxStudentPollAction,
  ballBoxTeacherFindGuestAction,
  ballBoxTeacherPollAction,
} from "@/app/play/g2-u4-ball-box-guess/actions";
import type { GameSubmitClientResult } from "@/app/adventure/actions";
import { BALL_COLORS, getBallColor, type BallColorKey } from "@/lib/ball-box";
import { BALL_BOX_POLL_MS, type BallBoxPollState } from "@/lib/ball-box-types";

const DRAW_ANIM_MS = 420;
const GUEST_KEY_LS = "pm_ball_box_guest_key";
const GUEST_NAME_LS = "pm_ball_box_guest_name";

type Props = {
  actorType: "teacher" | "student" | null;
  teacherClasses: TeacherClassOption[];
  studentClassId: string | null;
  studentClassName: string | null;
  studentName: string | null;
  /** Guest (QR, no-login) mode with a join code from the URL. */
  guestMode?: boolean;
  joinCode?: string | null;
};

const IDLE_STATE: BallBoxPollState = {
  sessionId: null,
  classId: null,
  className: null,
  phase: "idle",
  roundNumber: 1,
  total: 0,
  answerColors: [],
  revealedAnswer: null,
  joinCode: null,
  players: [],
  myObserved: {},
  myDrawCount: 0,
  myWrongAttempts: 0,
  mySolved: false,
  myScore: 0,
  mySessionScore: 0,
};

type GuessFeedback = {
  correct: boolean;
  score: number;
  alreadySolved: boolean;
};

function errMsg(error: string | undefined): string {
  return error ?? "오류가 발생했어요.";
}

function phaseLabel(phase: BallBoxPollState["phase"]): string {
  switch (phase) {
    case "lobby":
      return "준비 중";
    case "playing":
      return "게임 진행 중";
    case "revealed":
      return "정답 공개";
    case "closed":
      return "종료됨";
    default:
      return "대기";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function buildCounts(
  values: Record<string, string>,
  keys: BallColorKey[],
  blankAsZero: boolean,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key of keys) {
    const raw = (values[key] ?? "").trim();
    if (raw === "") {
      if (blankAsZero) out[key] = 0;
      continue;
    }
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 0) out[key] = n;
  }
  return out;
}

export default function BallBoxGuess({
  actorType,
  teacherClasses,
  studentClassId,
  studentClassName,
  studentName,
  guestMode = false,
  joinCode = null,
}: Props) {
  const [selectedClassId, setSelectedClassId] = useState(
    teacherClasses[0]?.id ?? studentClassId ?? "",
  );
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [state, setState] = useState<BallBoxPollState>(IDLE_STATE);
  const [message, setMessage] = useState<string | null>(null);
  const [waitingForTeacher, setWaitingForTeacher] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Teacher composition inputs
  const [configValues, setConfigValues] = useState<Record<string, string>>({});

  // Player (student/guest) draw + guess
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastColor, setLastColor] = useState<string | null>(null);
  const [justDrew, setJustDrew] = useState(false);
  const [guessValues, setGuessValues] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<GuessFeedback | null>(null);
  const [xpResult, setXpResult] = useState<GameSubmitClientResult | null>(null);

  // Guest identity
  const [guestKey, setGuestKey] = useState<string | null>(null);
  const [guestName, setGuestName] = useState<string | null>(null);
  const [guestJoined, setGuestJoined] = useState(false);
  const [guestSessionMissing, setGuestSessionMissing] = useState(false);

  // Rank movement (previous poll's ranking)
  const [prevRanks, setPrevRanks] = useState<Record<string, number> | null>(
    null,
  );
  const prevRanksRef = useRef<Record<string, number> | null>(null);

  const roundRef = useRef(0);

  const isTeacher = actorType === "teacher";
  const isStudent = actorType === "student";
  const isGuest = guestMode && !isTeacher && !isStudent;
  const isPlayer = isStudent || isGuest;

  const normalizedCode = (joinCode ?? "").trim().toUpperCase();

  // Load / create the guest device key + stored name.
  useEffect(() => {
    if (!isGuest) return;
    try {
      let key = window.localStorage.getItem(GUEST_KEY_LS);
      if (!key || key.length < 8) {
        key =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `g-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        window.localStorage.setItem(GUEST_KEY_LS, key);
      }
      setGuestKey(key);
      setGuestName(window.localStorage.getItem(GUEST_NAME_LS));
    } catch {
      setGuestKey(`g-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    }
  }, [isGuest]);

  const poll = useCallback(async () => {
    if (!sessionId) return;

    let result;
    if (isTeacher) {
      result = await ballBoxTeacherPollAction({ sessionId });
    } else if (isGuest) {
      if (!guestKey) return;
      result = await ballBoxGuestPollAction({ guestKey, sessionId });
    } else {
      result = await ballBoxStudentPollAction({ sessionId });
    }

    if ("error" in result) {
      if (typeof result.error === "string") setMessage(result.error);
      return;
    }

    setState(result);

    // Rank movement vs. the previous poll.
    const newMap: Record<string, number> = {};
    result.players.forEach((p, i) => {
      newMap[p.pid] = i + 1;
    });
    setPrevRanks(prevRanksRef.current);
    prevRanksRef.current = newMap;

    return result;
  }, [isTeacher, isGuest, guestKey, sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    void poll();
    const id = window.setInterval(() => void poll(), BALL_BOX_POLL_MS);
    return () => window.clearInterval(id);
  }, [poll, sessionId]);

  // Reset per-round player UI when a new round/set starts.
  useEffect(() => {
    if (state.phase === "idle") return;
    if (roundRef.current !== state.roundNumber) {
      roundRef.current = state.roundNumber;
      setLastColor(null);
      setJustDrew(false);
      setGuessValues({});
      setFeedback(null);
      setXpResult(null);
    }
  }, [state.roundNumber, state.phase]);

  // Teacher: default class.
  useEffect(() => {
    if (isTeacher && teacherClasses.length > 0 && !selectedClassId) {
      setSelectedClassId(teacherClasses[0]!.id);
    }
  }, [isTeacher, teacherClasses, selectedClassId]);

  // Teacher: reconnect to an active guest or class session.
  useEffect(() => {
    if (!isTeacher || sessionId) return;
    startTransition(async () => {
      const guest = await ballBoxTeacherFindGuestAction();
      if (guest.sessionId) {
        setSessionId(guest.sessionId);
        return;
      }
      if (selectedClassId) {
        const active = await ballBoxFindActiveTeacherAction({
          classId: selectedClassId,
        });
        if (active.sessionId) setSessionId(active.sessionId);
      }
    });
  }, [isTeacher, selectedClassId, sessionId]);

  // Student: find + join an active class session.
  useEffect(() => {
    if (!isStudent || !studentClassId) return;
    startTransition(async () => {
      const active = await ballBoxFindActiveStudentAction({
        classId: studentClassId,
      });
      if (active.sessionId) {
        const joined = await ballBoxJoinAction({ classId: studentClassId });
        if ("sessionId" in joined && joined.sessionId) {
          setSessionId(joined.sessionId);
          setWaitingForTeacher(false);
        }
      } else {
        setWaitingForTeacher(true);
      }
    });
  }, [isStudent, studentClassId]);

  // Student: keep polling for a session until one opens.
  useEffect(() => {
    if (!isStudent || !studentClassId || sessionId) return;
    const id = window.setInterval(() => {
      startTransition(async () => {
        const active = await ballBoxFindActiveStudentAction({
          classId: studentClassId,
        });
        if (!active.sessionId) return;
        const joined = await ballBoxJoinAction({ classId: studentClassId });
        if ("sessionId" in joined && joined.sessionId) {
          setSessionId(joined.sessionId);
          setWaitingForTeacher(false);
        }
      });
    }, BALL_BOX_POLL_MS);
    return () => window.clearInterval(id);
  }, [isStudent, studentClassId, sessionId]);

  // Guest: resolve the session by code, and auto-rejoin if a name is stored.
  useEffect(() => {
    if (!isGuest || !guestKey || !normalizedCode || sessionId) return;
    startTransition(async () => {
      const found = await ballBoxFindByCodeAction({ joinCode: normalizedCode });
      if (!found.sessionId) {
        setGuestSessionMissing(true);
        return;
      }
      setGuestSessionMissing(false);
      if (guestName) {
        const joined = await ballBoxGuestJoinAction({
          joinCode: normalizedCode,
          guestKey,
          name: guestName,
        });
        if ("sessionId" in joined && joined.sessionId) {
          setSessionId(joined.sessionId);
          setGuestJoined(true);
        }
      }
    });
  }, [isGuest, guestKey, guestName, normalizedCode, sessionId]);

  const handleGuestJoin = (name: string) => {
    if (!guestKey || !normalizedCode) return;
    startTransition(async () => {
      setMessage(null);
      try {
        window.localStorage.setItem(GUEST_NAME_LS, name);
      } catch {
        /* ignore */
      }
      setGuestName(name);
      const joined = await ballBoxGuestJoinAction({
        joinCode: normalizedCode,
        guestKey,
        name,
      });
      if ("error" in joined) {
        if (joined.error === "no_session") {
          setGuestSessionMissing(true);
        } else {
          setMessage(errMsg(joined.error));
        }
        return;
      }
      if (joined.sessionId) {
        setSessionId(joined.sessionId);
        setGuestJoined(true);
      }
    });
  };

  const handleConfigChange = (key: BallColorKey, value: string) => {
    const cleaned = value.replace(/[^0-9]/g, "");
    setConfigValues((prev) => ({ ...prev, [key]: cleaned }));
  };

  const handleGuessChange = (key: BallColorKey, value: string) => {
    const cleaned = value.replace(/[^0-9]/g, "");
    setGuessValues((prev) => ({ ...prev, [key]: cleaned }));
  };

  const handleCreateSession = () => {
    if (!selectedClassId) return;
    startTransition(async () => {
      setMessage(null);
      const res = await ballBoxCreateSessionAction({ classId: selectedClassId });
      if ("error" in res) {
        setMessage(errMsg(res.error));
        return;
      }
      if (res.sessionId) {
        setSessionId(res.sessionId);
        setConfigValues({});
      }
    });
  };

  const handleCreateGuestSession = () => {
    startTransition(async () => {
      setMessage(null);
      const res = await ballBoxCreateGuestSessionAction();
      if ("error" in res) {
        setMessage(errMsg(res.error));
        return;
      }
      if (res.sessionId) {
        setSessionId(res.sessionId);
        setConfigValues({});
      }
    });
  };

  const handleStart = (mode: "start" | "next") => {
    if (!sessionId) return;
    const answer = buildCounts(
      configValues,
      BALL_COLORS.map((c) => c.key),
      false,
    );
    if (Object.keys(answer).length === 0) {
      setMessage("색을 1개 이상 입력해 주세요.");
      return;
    }
    const boxTotal = Object.values(answer).reduce((a, b) => a + b, 0);
    if (boxTotal <= 0) {
      setMessage("공이 1개 이상 들어있게 설정해 주세요 (0만 입력 불가).");
      return;
    }
    startTransition(async () => {
      setMessage(null);
      const res =
        mode === "start"
          ? await ballBoxStartAction({ sessionId, answer })
          : await ballBoxNextRoundAction({ sessionId, answer });
      if ("error" in res) setMessage(errMsg(res.error));
    });
  };

  const handleReveal = () => {
    if (!sessionId) return;
    startTransition(async () => {
      const res = await ballBoxRevealAction({ sessionId });
      if ("error" in res) setMessage(errMsg(res.error));
    });
  };

  const handleClose = () => {
    if (!sessionId) return;
    startTransition(async () => {
      const res = await ballBoxCloseAction({ sessionId });
      if ("error" in res) setMessage(errMsg(res.error));
      else {
        setSessionId(null);
        setState(IDLE_STATE);
        setConfigValues({});
      }
    });
  };

  const handleDraw = async () => {
    if (!sessionId || isDrawing) return;
    if (isGuest && !guestKey) return;
    setMessage(null);
    setFeedback(null);
    setIsDrawing(true);
    setJustDrew(false);

    const start = Date.now();
    const res = isGuest
      ? await ballBoxGuestDrawAction({ guestKey: guestKey!, sessionId })
      : await ballBoxDrawAction({ sessionId });
    const elapsed = Date.now() - start;
    if (elapsed < DRAW_ANIM_MS) await sleep(DRAW_ANIM_MS - elapsed);

    if ("error" in res) {
      setMessage(errMsg(res.error));
      setIsDrawing(false);
      return;
    }

    setLastColor(res.color);
    setIsDrawing(false);
    setJustDrew(true);
    window.setTimeout(() => setJustDrew(false), 400);
    void poll();
  };

  const handleSubmitGuess = () => {
    if (!sessionId) return;
    if (isGuest && !guestKey) return;
    const guess = buildCounts(guessValues, state.answerColors, true);
    startTransition(async () => {
      setMessage(null);
      if (isGuest) {
        const res = await ballBoxGuestGuessAction({
          guestKey: guestKey!,
          sessionId,
          guess,
        });
        if (res.error || !res.result) {
          setMessage(errMsg(res.error ?? undefined));
          return;
        }
        setFeedback({
          correct: res.result.correct,
          score: res.result.score,
          alreadySolved: res.result.alreadySolved,
        });
        void poll();
        return;
      }

      const res = await ballBoxGuessAction({ sessionId, guess });
      if (res.error || !res.result) {
        setMessage(errMsg(res.error ?? undefined));
        return;
      }
      setFeedback({
        correct: res.result.correct,
        score: res.result.score,
        alreadySolved: res.result.alreadySolved,
      });
      if (res.xp) setXpResult(res.xp);
      void poll();
    });
  };

  // --- Render guards -------------------------------------------------------

  if (!isTeacher && !isPlayer) {
    return (
      <div className="rounded-2xl border border-wood/10 bg-peach/20 p-8 text-center">
        <p className="font-display text-xl text-wood">
          교사 또는 학생 로그인이 필요해요
        </p>
        <p className="mt-2 text-sm text-foreground/60">
          교사는 상자를 설정하고, 학생은 같은 반에서 접속하거나 QR로 입장해 공을
          뽑으며 개수를 맞혀요.
        </p>
      </div>
    );
  }

  // Guest: name entry until joined.
  if (isGuest && !guestJoined) {
    return (
      <div className="space-y-4">
        {guestSessionMissing && (
          <p className="rounded-xl bg-red-50 px-4 py-2 text-center text-sm text-red-700">
            진행 중인 세션을 찾을 수 없어요. 코드를 확인하거나 교사가 시작할
            때까지 기다려 주세요.
          </p>
        )}
        {message && (
          <p className="rounded-xl bg-red-50 px-4 py-2 text-center text-sm text-red-700">
            {message}
          </p>
        )}
        <GuestNameEntry
          joinCode={normalizedCode || "----"}
          onSubmit={handleGuestJoin}
          disabled={isPending || !guestKey || !normalizedCode}
        />
      </div>
    );
  }

  if (isStudent && waitingForTeacher && !sessionId) {
    return (
      <div className="rounded-2xl border border-wood/10 bg-peach/20 p-8 text-center">
        <p className="font-display text-xl text-wood">
          교사가 시작할 때까지 기다려 주세요
        </p>
        <p className="mt-2 text-sm text-foreground/60">
          {studentClassName ?? "우리 반"} · {studentName ?? "탐험가"}
        </p>
      </div>
    );
  }

  const showConfigForm =
    isTeacher && (state.phase === "lobby" || state.phase === "revealed");
  const isGuestSession = Boolean(sessionId) && state.classId == null;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-wood/10 bg-gradient-to-br from-peach/25 to-lavender/15 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl text-wood">
              상자 속 공 개수 맞히기
            </h2>
            <p className="mt-1 text-sm text-foreground/65">
              {isTeacher
                ? "색깔 공 상자를 몰래 설정하면, 학생들이 뽑기를 반복하며 개수를 추측해요."
                : "공을 여러 번 뽑아 색깔 비율을 보고, 각 색의 개수를 맞혀 보세요!"}
            </p>
          </div>
          <span className="rounded-full bg-sky/45 px-3 py-1 text-sm font-medium text-wood">
            {phaseLabel(state.phase)} · {state.roundNumber}세트
          </span>
        </div>
      </div>

      {message && (
        <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">
          {message}
        </p>
      )}

      {/* Teacher: create session (class or guest/QR) */}
      {isTeacher && !sessionId && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-4 rounded-2xl border border-wood/10 bg-white/70 p-5">
            <div>
              <h3 className="font-display text-lg text-wood">학급으로 시작</h3>
              <p className="mt-1 text-sm text-foreground/60">
                로그인한 우리 반 학생과 함께 진행해요 (XP·랭킹 반영).
              </p>
            </div>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full rounded-xl border border-wood/15 bg-cream px-3 py-2 text-wood"
            >
              {teacherClasses.length === 0 ? (
                <option value="">학급 없음</option>
              ) : (
                teacherClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))
              )}
            </select>
            <button
              type="button"
              disabled={isPending || !selectedClassId}
              onClick={handleCreateSession}
              className="w-full rounded-xl bg-sky px-5 py-2.5 font-display text-lg text-wood hover:bg-sky/80 disabled:opacity-60"
            >
              학급으로 시작
            </button>
          </div>

          <div className="space-y-4 rounded-2xl border border-wood/10 bg-white/70 p-5">
            <div>
              <h3 className="font-display text-lg text-wood">QR로 시작 (무배정)</h3>
              <p className="mt-1 text-sm text-foreground/60">
                학급 배정 없이 QR·코드로 누구나 이름만 입력해 참여해요 (XP 없음,
                누적 순위만).
              </p>
            </div>
            <button
              type="button"
              disabled={isPending}
              onClick={handleCreateGuestSession}
              className="w-full rounded-xl bg-gold px-5 py-2.5 font-display text-lg text-wood hover:bg-gold/85 disabled:opacity-60"
            >
              QR 세션 시작
            </button>
          </div>
        </div>
      )}

      {sessionId && (
        <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
          <div className="space-y-5">
            {/* Teacher: guest QR panel */}
            {isTeacher && isGuestSession && state.joinCode && (
              <BallBoxJoinQR joinCode={state.joinCode} />
            )}

            {/* Teacher: composition config form */}
            {showConfigForm && (
              <div className="space-y-4 rounded-2xl border border-wood/10 bg-white/70 p-5">
                <div>
                  <h3 className="font-display text-lg text-wood">
                    상자 구성 설정
                  </h3>
                  <p className="mt-1 text-sm text-foreground/60">
                    비워두면 그 색은 게임에서 제외돼요. <strong>0</strong>을
                    입력하면 상자엔 없지만 학생이 답을 입력할 수 있는 함정 색이
                    됩니다.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {BALL_COLORS.map((c) => (
                    <label
                      key={c.key}
                      className="flex items-center gap-2 rounded-xl border border-wood/15 bg-cream px-3 py-2"
                    >
                      <span
                        className="h-6 w-6 shrink-0 rounded-full border-2 border-white shadow-sm"
                        style={{ backgroundColor: c.hex }}
                        aria-hidden
                      />
                      <span className="w-8 shrink-0 text-sm font-medium text-foreground/75">
                        {c.label}
                      </span>
                      <input
                        type="number"
                        min={0}
                        inputMode="numeric"
                        value={configValues[c.key] ?? ""}
                        onChange={(e) =>
                          handleConfigChange(c.key, e.target.value)
                        }
                        placeholder="비움"
                        className="w-full min-w-0 rounded-lg border border-wood/15 bg-white px-2 py-1.5 text-center text-wood outline-none focus:border-sky"
                      />
                    </label>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() =>
                      handleStart(state.phase === "revealed" ? "next" : "start")
                    }
                    className="rounded-xl bg-gold px-5 py-2.5 font-display text-lg text-wood transition hover:bg-gold/85 active:scale-95 disabled:opacity-60"
                  >
                    {state.phase === "revealed"
                      ? "새 구성으로 다음 세트"
                      : "게임 시작"}
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={handleClose}
                    className="rounded-xl border border-wood/20 px-4 py-2 text-sm text-foreground/70 transition hover:bg-wood/5"
                  >
                    세션 종료
                  </button>
                </div>
              </div>
            )}

            {/* Teacher: live game view */}
            {isTeacher && state.phase === "playing" && (
              <div className="space-y-4 rounded-2xl border border-wood/10 bg-white/70 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-display text-lg text-wood">
                    진행 상황 (총 {state.total}개)
                  </h3>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={handleReveal}
                      className="rounded-xl bg-sky px-4 py-2 font-display text-wood transition hover:bg-sky/80 active:scale-95"
                    >
                      정답 공개
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={handleClose}
                      className="rounded-xl border border-wood/20 px-4 py-2 text-sm text-foreground/70 transition hover:bg-wood/5"
                    >
                      세션 종료
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Reveal (both roles) */}
            {state.phase === "revealed" && state.revealedAnswer && (
              <RevealedComposition
                answer={state.revealedAnswer}
                answerColors={state.answerColors}
              />
            )}

            {/* Player: waiting inside a lobby session */}
            {isPlayer && state.phase === "lobby" && (
              <div className="rounded-2xl border border-wood/10 bg-peach/20 p-8 text-center">
                <p className="font-display text-xl text-wood">
                  교사가 상자를 설정하고 있어요
                </p>
                <p className="mt-2 text-sm text-foreground/60">
                  곧 시작돼요. 잠시만 기다려 주세요!
                </p>
              </div>
            )}

            {/* Player: play */}
            {isPlayer && state.phase === "playing" && (
              <>
                <div className="rounded-2xl border border-wood/10 bg-white/70 p-4 text-center">
                  <p className="text-sm text-foreground/70">
                    상자 속 공은 모두{" "}
                    <strong className="font-display text-lg text-wood">
                      {state.total}개
                    </strong>{" "}
                    · 지금까지{" "}
                    <strong className="text-wood">{state.myDrawCount}번</strong>{" "}
                    뽑음
                  </p>
                </div>

                <BallDrawDisplay
                  color={lastColor}
                  isDrawing={isDrawing}
                  justDrew={justDrew}
                />

                <div className="flex justify-center">
                  <button
                    type="button"
                    disabled={isDrawing || state.mySolved}
                    onClick={() => void handleDraw()}
                    className="rounded-xl bg-gold px-8 py-3 font-display text-xl text-wood shadow-sm transition hover:bg-gold/85 active:scale-95 disabled:opacity-60"
                  >
                    {isDrawing ? "뽑는 중…" : "공 뽑기"}
                  </button>
                </div>

                <ObservedTally
                  observed={state.myObserved}
                  answerColors={state.answerColors}
                />

                {!state.mySolved ? (
                  <div className="space-y-3 rounded-2xl border border-wood/10 bg-white/70 p-5">
                    <GuessInputGrid
                      answerColors={state.answerColors}
                      values={guessValues}
                      onChange={handleGuessChange}
                      disabled={isPending}
                    />
                    <button
                      type="button"
                      disabled={isPending || state.answerColors.length === 0}
                      onClick={handleSubmitGuess}
                      className="w-full rounded-xl bg-sky px-5 py-2.5 font-display text-lg text-wood transition hover:bg-sky/80 active:scale-95 disabled:opacity-60"
                    >
                      정답 제출
                    </button>
                    {feedback && !feedback.correct && (
                      <div className="rounded-xl bg-red-100 px-4 py-3 text-center">
                        <p className="font-display text-lg text-red-700">
                          틀렸어요! 다시 도전해 보세요
                        </p>
                        <p className="mt-1 text-sm text-red-600">
                          더 많이 뽑아 비율을 확인해 보세요. (오답마다 점수가
                          조금씩 깎여요)
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-gold/40 bg-gold/20 p-5 text-center">
                    <p className="font-display text-xl text-wood">
                      정답이에요! {state.myScore}점
                    </p>
                    {isStudent &&
                      (xpResult?.recorded ? (
                        <p className="mt-1 text-sm text-wood">
                          +{xpResult.xpAwarded ?? xpResult.score} XP 획득!
                          {xpResult.level != null
                            ? ` (Lv.${xpResult.level})`
                            : ""}
                        </p>
                      ) : (
                        <p className="mt-1 text-sm text-foreground/60">
                          {feedback?.alreadySolved
                            ? "이미 이 세트를 맞혔어요."
                            : "연습 모드 — 점수는 저장되지 않아요."}
                        </p>
                      ))}
                    <p className="mt-2 text-sm text-foreground/70">
                      누적 {state.mySessionScore}점 · {state.myDrawCount}번 만에
                      맞혔어요! 다음 세트를 기다려 주세요.
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Player: revealed summary */}
            {isPlayer && state.phase === "revealed" && (
              <div className="rounded-2xl border border-wood/10 bg-white/70 p-5 text-center">
                {state.mySolved ? (
                  <p className="font-display text-lg text-wood">
                    이번 세트 정답! {state.myScore}점 · 누적{" "}
                    {state.mySessionScore}점
                  </p>
                ) : (
                  <p className="text-sm text-foreground/70">
                    이번엔 못 맞혔어요. 위의 정답을 보고 비율과 비교해 보세요!
                  </p>
                )}
              </div>
            )}
          </div>

          <SessionRanking
            players={state.players}
            prevRanks={prevRanks}
            highlightMe={isPlayer}
          />
        </div>
      )}
    </div>
  );
}
