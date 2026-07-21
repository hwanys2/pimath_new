"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import type { TeacherClassOption } from "@/components/content/AssignContentButton";
import DiceSumRaceBoard, {
  DiceRaceGuestNameEntry,
  DiceRaceJoinQR,
  DiceRollDisplay,
  PickGrid,
  SessionRanking,
} from "@/components/games/DiceSumRaceBoard";
import {
  diceRaceClaimRoundXpAction,
  diceRaceCloseAction,
  diceRaceCreateGuestSessionAction,
  diceRaceCreateSessionAction,
  diceRaceFindActiveStudentAction,
  diceRaceFindActiveTeacherAction,
  diceRaceFindByCodeAction,
  diceRaceGuestJoinAction,
  diceRaceGuestPickAction,
  diceRaceGuestPollAction,
  diceRaceJoinAction,
  diceRaceNextRoundAction,
  diceRaceOpenPickingAction,
  diceRacePickAction,
  diceRaceRollAction,
  diceRaceStartRollingAction,
  diceRaceStudentPollAction,
  diceRaceTeacherFindGuestAction,
  diceRaceTeacherPollAction,
} from "@/app/play/g2-u4-dice-sum-race/actions";
import type { GameSubmitClientResult } from "@/app/adventure/actions";
import { DICE_RACE_POLL_MS, type DiceRacePollState } from "@/lib/dice-race-types";

const FAST_MODE_KEY = "pm_dice_race_fast_mode";
const GUEST_KEY_LS = "pm_dice_race_guest_key";
const GUEST_NAME_LS = "pm_dice_race_guest_name";
const ROLL_ANIM_MIN_MS = 520;
const STUDENT_ANIM_MS = 400;
const SHUFFLE_INTERVAL_MS = 80;

type Props = {
  actorType: "teacher" | "student" | null;
  teacherClasses: TeacherClassOption[];
  studentClassId: string | null;
  studentClassName: string | null;
  studentName: string | null;
  guestMode?: boolean;
  joinCode?: string | null;
};

type DisplayRoll = {
  d1: number;
  d2: number;
  sum: number | null;
};

const IDLE_STATE: DiceRacePollState = {
  sessionId: null,
  classId: null,
  className: null,
  joinCode: null,
  phase: "idle",
  roundNumber: 1,
  counts: {
    "2": 0,
    "3": 0,
    "4": 0,
    "5": 0,
    "6": 0,
    "7": 0,
    "8": 0,
    "9": 0,
    "10": 0,
    "11": 0,
    "12": 0,
  },
  winningSum: null,
  lastD1: null,
  lastD2: null,
  lastSum: null,
  rollCount: 0,
  players: [],
  myPick: null,
  mySessionScore: 0,
  myRoundScore: 0,
  myXpClaimedRound: 0,
};

function errMsg(error: string | undefined): string {
  return error ?? "오류가 발생했어요.";
}

function randomFace(): number {
  return Math.floor(Math.random() * 6) + 1;
}

function phaseLabel(phase: DiceRacePollState["phase"]): string {
  switch (phase) {
    case "lobby":
      return "준비 중";
    case "picking":
      return "숫자 선택";
    case "rolling":
      return "주사위 굴리는 중";
    case "round_end":
      return "라운드 종료";
    case "closed":
      return "종료됨";
    default:
      return "대기";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export default function DiceSumRace({
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
  const [state, setState] = useState<DiceRacePollState>(IDLE_STATE);
  const [message, setMessage] = useState<string | null>(null);
  const [waitingForTeacher, setWaitingForTeacher] = useState(false);
  const [xpResult, setXpResult] = useState<GameSubmitClientResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isRolling, setIsRolling] = useState(false);
  const [fastMode, setFastMode] = useState(false);
  const [displayRoll, setDisplayRoll] = useState<DisplayRoll | null>(null);
  const [justFilledSum, setJustFilledSum] = useState<number | null>(null);
  const [highlightSum, setHighlightSum] = useState(false);

  const [guestKey, setGuestKey] = useState<string | null>(null);
  const [guestName, setGuestName] = useState<string | null>(null);
  const [guestJoined, setGuestJoined] = useState(false);
  const [guestSessionMissing, setGuestSessionMissing] = useState(false);

  const claimedRoundRef = useRef(0);
  const prevRollCountRef = useRef(0);
  const shuffleTimerRef = useRef<number | null>(null);
  const rollSyncInitializedRef = useRef(false);

  const isTeacher = actorType === "teacher";
  const isStudent = actorType === "student";
  const isGuest = guestMode && !isTeacher && !isStudent;
  const isPlayer = isStudent || isGuest;
  const normalizedCode = (joinCode ?? "").trim().toUpperCase();
  const isGuestSession = Boolean(sessionId && state.classId == null);

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

  useEffect(() => {
    try {
      setFastMode(window.localStorage.getItem(FAST_MODE_KEY) === "1");
    } catch {
      setFastMode(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (shuffleTimerRef.current != null) {
        window.clearInterval(shuffleTimerRef.current);
      }
    };
  }, []);

  const stopShuffle = useCallback(() => {
    if (shuffleTimerRef.current != null) {
      window.clearInterval(shuffleTimerRef.current);
      shuffleTimerRef.current = null;
    }
  }, []);

  const startShuffle = useCallback(() => {
    stopShuffle();
    shuffleTimerRef.current = window.setInterval(() => {
      setDisplayRoll({ d1: randomFace(), d2: randomFace(), sum: null });
    }, SHUFFLE_INTERVAL_MS);
  }, [stopShuffle]);

  const flashFilledSum = useCallback((sum: number) => {
    setJustFilledSum(sum);
    setHighlightSum(true);
    window.setTimeout(() => {
      setJustFilledSum(null);
      setHighlightSum(false);
    }, 450);
  }, []);

  const poll = useCallback(async () => {
    if (!sessionId) return;

    let result;
    if (isTeacher) {
      result = await diceRaceTeacherPollAction({ sessionId });
    } else if (isGuest) {
      if (!guestKey) return;
      result = await diceRaceGuestPollAction({ guestKey, sessionId });
    } else {
      result = await diceRaceStudentPollAction({ sessionId });
    }

    if ("error" in result) {
      if (typeof result.error === "string") setMessage(result.error);
      return;
    }

    setState(result);

    if (
      isStudent &&
      result.phase === "round_end" &&
      result.roundNumber > claimedRoundRef.current &&
      result.myXpClaimedRound < result.roundNumber
    ) {
      claimedRoundRef.current = result.roundNumber;
      const xpRes = await diceRaceClaimRoundXpAction({ sessionId });
      if ("xp" in xpRes && xpRes.xp) {
        setXpResult(xpRes.xp);
      }
    }

    return result;
  }, [isTeacher, isGuest, isStudent, guestKey, sessionId]);

  const playStudentRollAnim = useCallback(
    async (d1: number, d2: number, sum: number) => {
      setIsRolling(true);
      startShuffle();
      await sleep(STUDENT_ANIM_MS);
      stopShuffle();
      setDisplayRoll({ d1, d2, sum });
      flashFilledSum(sum);
      await sleep(200);
      setIsRolling(false);
    },
    [flashFilledSum, startShuffle, stopShuffle],
  );

  useEffect(() => {
    if (!sessionId) return;
    void poll();
    const id = window.setInterval(() => void poll(), DICE_RACE_POLL_MS);
    return () => window.clearInterval(id);
  }, [poll, sessionId]);

  useEffect(() => {
    if (!isPlayer || isRolling) return;

    if (!rollSyncInitializedRef.current) {
      rollSyncInitializedRef.current = true;
      prevRollCountRef.current = state.rollCount;
      if (
        state.rollCount > 0 &&
        state.lastD1 != null &&
        state.lastD2 != null &&
        state.lastSum != null
      ) {
        setDisplayRoll({
          d1: state.lastD1,
          d2: state.lastD2,
          sum: state.lastSum,
        });
      }
      return;
    }

    if (
      state.rollCount > prevRollCountRef.current &&
      state.lastD1 != null &&
      state.lastD2 != null &&
      state.lastSum != null
    ) {
      prevRollCountRef.current = state.rollCount;
      void playStudentRollAnim(state.lastD1, state.lastD2, state.lastSum);
    }
  }, [
    isPlayer,
    isRolling,
    state.rollCount,
    state.lastD1,
    state.lastD2,
    state.lastSum,
    playStudentRollAnim,
  ]);

  useEffect(() => {
    if (isTeacher && teacherClasses.length > 0 && !selectedClassId) {
      setSelectedClassId(teacherClasses[0]!.id);
    }
  }, [isTeacher, teacherClasses, selectedClassId]);

  useEffect(() => {
    if (!isStudent || !studentClassId) return;

    startTransition(async () => {
      const active = await diceRaceFindActiveStudentAction({
        classId: studentClassId,
      });
      if (active.sessionId) {
        const joined = await diceRaceJoinAction({ classId: studentClassId });
        if ("sessionId" in joined && joined.sessionId) {
          setSessionId(joined.sessionId);
          setWaitingForTeacher(false);
        }
      } else {
        setWaitingForTeacher(true);
      }
    });
  }, [isStudent, studentClassId]);

  useEffect(() => {
    if (!isStudent || !studentClassId || sessionId) return;

    const id = window.setInterval(() => {
      startTransition(async () => {
        const active = await diceRaceFindActiveStudentAction({
          classId: studentClassId,
        });
        if (!active.sessionId) return;
        const joined = await diceRaceJoinAction({ classId: studentClassId });
        if ("sessionId" in joined && joined.sessionId) {
          setSessionId(joined.sessionId);
          setWaitingForTeacher(false);
        }
      });
    }, DICE_RACE_POLL_MS);

    return () => window.clearInterval(id);
  }, [isStudent, studentClassId, sessionId]);

  useEffect(() => {
    if (!isTeacher || sessionId) return;
    startTransition(async () => {
      const guest = await diceRaceTeacherFindGuestAction();
      if (guest.sessionId) {
        setSessionId(guest.sessionId);
        return;
      }
      if (selectedClassId) {
        const active = await diceRaceFindActiveTeacherAction({
          classId: selectedClassId,
        });
        if (active.sessionId) {
          setSessionId(active.sessionId);
        }
      }
    });
  }, [isTeacher, selectedClassId, sessionId]);

  useEffect(() => {
    if (!isGuest || !guestKey || !normalizedCode || sessionId) return;
    startTransition(async () => {
      const found = await diceRaceFindByCodeAction({ joinCode: normalizedCode });
      if (!found.sessionId) {
        setGuestSessionMissing(true);
        return;
      }
      setGuestSessionMissing(false);
      if (guestName) {
        const joined = await diceRaceGuestJoinAction({
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
      const joined = await diceRaceGuestJoinAction({
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

  const handleFastModeChange = (checked: boolean) => {
    setFastMode(checked);
    try {
      window.localStorage.setItem(FAST_MODE_KEY, checked ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  const handleCreateSession = () => {
    if (!selectedClassId) return;
    startTransition(async () => {
      setMessage(null);
      const res = await diceRaceCreateSessionAction({ classId: selectedClassId });
      if ("error" in res) {
        setMessage(errMsg(res.error));
        return;
      }
      if (res.sessionId) {
        setSessionId(res.sessionId);
        setXpResult(null);
        claimedRoundRef.current = 0;
        prevRollCountRef.current = 0;
        rollSyncInitializedRef.current = false;
        setDisplayRoll(null);
      }
    });
  };

  const handleCreateGuestSession = () => {
    startTransition(async () => {
      setMessage(null);
      const res = await diceRaceCreateGuestSessionAction();
      if ("error" in res) {
        setMessage(errMsg(res.error));
        return;
      }
      if (res.sessionId) {
        setSessionId(res.sessionId);
        setXpResult(null);
        claimedRoundRef.current = 0;
        prevRollCountRef.current = 0;
        rollSyncInitializedRef.current = false;
        setDisplayRoll(null);
      }
    });
  };

  const handleOpenPicking = () => {
    if (!sessionId) return;
    startTransition(async () => {
      const res = await diceRaceOpenPickingAction({ sessionId });
      if ("error" in res) setMessage(errMsg(res.error));
    });
  };

  const handleStartRolling = () => {
    if (!sessionId) return;
    startTransition(async () => {
      const res = await diceRaceStartRollingAction({ sessionId });
      if ("error" in res) setMessage(errMsg(res.error));
    });
  };

  const handleRoll = async () => {
    if (!sessionId) return;
    if (isRolling && !fastMode) return;

    setMessage(null);
    const animStart = Date.now();

    if (fastMode) {
      setIsRolling(false);
    } else {
      setIsRolling(true);
      startShuffle();
    }

    const res = await diceRaceRollAction({ sessionId });

    if (!fastMode) {
      const elapsed = Date.now() - animStart;
      if (elapsed < ROLL_ANIM_MIN_MS) {
        await sleep(ROLL_ANIM_MIN_MS - elapsed);
      }
      stopShuffle();
    }

    if ("error" in res) {
      setMessage(errMsg(res.error));
      setIsRolling(false);
      stopShuffle();
      return;
    }

    setDisplayRoll({ d1: res.d1, d2: res.d2, sum: res.sum });
    flashFilledSum(res.sum);
    await poll();
    setIsRolling(false);
  };

  const handleNextRound = () => {
    if (!sessionId) return;
    startTransition(async () => {
      setXpResult(null);
      setDisplayRoll(null);
      prevRollCountRef.current = 0;
      rollSyncInitializedRef.current = false;
      const res = await diceRaceNextRoundAction({ sessionId });
      if ("error" in res) setMessage(errMsg(res.error));
    });
  };

  const handleClose = () => {
    if (!sessionId) return;
    startTransition(async () => {
      const res = await diceRaceCloseAction({ sessionId });
      if ("error" in res) setMessage(errMsg(res.error));
      else {
        setSessionId(null);
        setState(IDLE_STATE);
        setDisplayRoll(null);
        rollSyncInitializedRef.current = false;
      }
    });
  };

  const handlePick = (pick: number) => {
    if (!sessionId) return;
    startTransition(async () => {
      const res =
        isGuest && guestKey
          ? await diceRaceGuestPickAction({ guestKey, sessionId, pick })
          : await diceRacePickAction({ sessionId, pick });
      if ("error" in res) setMessage(errMsg(res.error));
      else void poll();
    });
  };

  const showD1 = isRolling
    ? (displayRoll?.d1 ?? state.lastD1)
    : (displayRoll?.d1 ?? state.lastD1);
  const showD2 = isRolling
    ? (displayRoll?.d2 ?? state.lastD2)
    : (displayRoll?.d2 ?? state.lastD2);
  const showSum = isRolling
    ? null
    : (displayRoll?.sum ?? state.lastSum);

  if (!isTeacher && !isStudent && !isGuest) {
    return (
      <div className="rounded-2xl border border-wood/10 bg-peach/20 p-8 text-center">
        <p className="font-display text-xl text-wood">교사 또는 학생 로그인이 필요해요</p>
        <p className="mt-2 text-sm text-foreground/60">
          교사는 세션을 시작하고, 학생은 같은 반에서 숫자를 고른 뒤 함께 플레이해요.
        </p>
      </div>
    );
  }

  if (isGuest && !guestJoined) {
    return (
      <div className="space-y-4">
        {guestSessionMissing && (
          <p className="rounded-xl bg-red-50 px-4 py-2 text-center text-sm text-red-700">
            진행 중인 세션을 찾을 수 없어요. 교사에게 QR·코드를 다시 확인해 주세요.
          </p>
        )}
        <DiceRaceGuestNameEntry
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

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-wood/10 bg-gradient-to-br from-peach/25 to-lavender/15 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl text-wood">주사위 합 10번 채우기</h2>
            <p className="mt-1 text-sm text-foreground/65">
              {isTeacher
                ? "학급 또는 QR로 세션을 시작한 뒤, 주사위를 굴려 주세요."
                : "교사가 주사위를 굴릴 때마다 내 숫자가 나오면 10점!"}
            </p>
          </div>
          <span className="rounded-full bg-sky/45 px-3 py-1 text-sm font-medium text-wood">
            {phaseLabel(state.phase)} · {state.roundNumber}라운드
          </span>
        </div>
      </div>

      {message && (
        <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">{message}</p>
      )}

      {xpResult?.recorded && (
        <p className="rounded-xl bg-gold/30 px-4 py-2 text-sm text-wood">
          +{xpResult.xpAwarded ?? xpResult.score} XP 획득!
          {xpResult.level != null ? ` (Lv.${xpResult.level})` : ""}
        </p>
      )}

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
        <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
          <div className="space-y-5">
            {isTeacher && isGuestSession && state.joinCode && (
              <DiceRaceJoinQR joinCode={state.joinCode} />
            )}

            {isTeacher && (
              <div className="flex flex-wrap items-center gap-3">
                {state.phase === "lobby" && (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={handleOpenPicking}
                    className="rounded-xl bg-sky px-4 py-2 font-display text-wood transition active:scale-95 hover:bg-sky/80"
                  >
                    학생 입장 열기
                  </button>
                )}
                {state.phase === "picking" && (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={handleStartRolling}
                    className="rounded-xl bg-gold px-4 py-2 font-display text-wood transition active:scale-95 hover:bg-gold/80"
                  >
                    주사위 굴리기 시작
                  </button>
                )}
                {state.phase === "rolling" && (
                  <>
                    <button
                      type="button"
                      disabled={!fastMode && isRolling}
                      onClick={() => void handleRoll()}
                      className={[
                        "rounded-xl px-5 py-2.5 font-display text-lg text-wood shadow-sm transition",
                        !fastMode && isRolling
                          ? "scale-95 cursor-wait bg-gold/70 opacity-80"
                          : "bg-gold hover:bg-gold/85 active:scale-95",
                      ].join(" ")}
                    >
                      {!fastMode && isRolling ? "🎲 굴리는 중…" : "주사위 굴리기"}
                    </button>
                    <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-wood/15 bg-white/60 px-3 py-2 text-sm text-foreground/75">
                      <input
                        type="checkbox"
                        checked={fastMode}
                        onChange={(e) => handleFastModeChange(e.target.checked)}
                        className="h-4 w-4 accent-wood"
                      />
                      빠른 모드 (애니 없이 연속 굴리기)
                    </label>
                  </>
                )}
                {state.phase === "round_end" && (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={handleNextRound}
                    className="rounded-xl bg-sky px-4 py-2 font-display text-wood transition active:scale-95 hover:bg-sky/80"
                  >
                    다시하기
                  </button>
                )}
                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleClose}
                  className="rounded-xl border border-wood/20 px-4 py-2 text-sm text-foreground/70 transition hover:bg-wood/5"
                >
                  세션 종료
                </button>
              </div>
            )}

            {isPlayer && state.phase === "picking" && (
              <PickGrid
                selected={state.myPick}
                onPick={handlePick}
                disabled={isPending}
              />
            )}

            {isPlayer && state.phase !== "picking" && state.myPick != null && (
              <p className="rounded-xl bg-gold/25 px-4 py-2 text-sm text-wood">
                내 선택: <strong>{state.myPick}</strong> · 이번 라운드{" "}
                {state.myRoundScore}점 · 세션 누적 {state.mySessionScore}점
              </p>
            )}

            <DiceRollDisplay
              d1={showD1}
              d2={showD2}
              sum={showSum}
              displayD1={displayRoll?.d1}
              displayD2={displayRoll?.d2}
              isRolling={isRolling}
              highlightSum={highlightSum}
            />

            <DiceSumRaceBoard
              counts={state.counts}
              myPick={isPlayer ? state.myPick : null}
              winningSum={state.winningSum}
              justFilledSum={justFilledSum}
            />

            {state.phase === "round_end" && state.winningSum != null && (
              <div className="rounded-2xl border border-gold/40 bg-gold/20 p-4 text-center">
                <p className="font-display text-xl text-wood">
                  {state.winningSum}이(가) 10번 먼저 채워졌어요!
                </p>
              </div>
            )}

            {isTeacher && state.phase === "picking" && (
              <div className="rounded-2xl border border-wood/10 bg-white/70 p-4">
                <h3 className="font-display text-lg text-wood">참가 학생</h3>
                <ul className="mt-2 space-y-1 text-sm">
                  {state.players.length === 0 ? (
                    <li className="text-foreground/50">아직 아무도 접속하지 않았어요</li>
                  ) : (
                    state.players.map((p) => (
                      <li key={p.pid} className="flex justify-between">
                        <span>{p.displayName}</span>
                        <span className="text-foreground/60">
                          {p.pick != null ? `${p.pick} 선택` : "선택 중…"}
                        </span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            )}
          </div>

          <SessionRanking players={state.players} highlightMe={isPlayer} />
        </div>
      )}
    </div>
  );
}
