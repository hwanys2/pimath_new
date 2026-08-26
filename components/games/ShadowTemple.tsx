"use client";

/**
 * 「그림자 신전: 여섯 개의 시련」 — 삼각비 방탈출 (중3 · 3.1 삼각비).
 *
 * Flow: title → prologue (typewriter) → six rooms
 * (enter story → investigate clue hotspots → operate the device)
 * → escape / trapped cinematic → score submit + ranking.
 */

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import type { RankingMode, RankingRow, RankingScope } from "@/lib/game-types";
import GameRankingBoard from "@/components/games/GameRankingBoard";
import RoomScene, { TitleScene } from "@/components/games/ShadowTempleScenes";
import { TempleAudio, type TempleSfx, warmSpeechVoices } from "@/components/games/shadow-temple-audio";
import {
  submitGameRun,
  fetchGameRanking,
  type GameSubmitClientResult,
} from "@/app/adventure/actions";
import { activityDetailsV1 } from "@/lib/activity-result-schemas";
import { applyScoreGain } from "@/lib/xp";
import {
  CONTENT_KEY,
  ESCAPE_STORY,
  HINT_LINE_PENALTY,
  PROLOGUE,
  TOTAL_TIME_SEC,
  TRAPPED_STORY,
  WRONG_TIME_PENALTY_SEC,
  applyHintLinePenalty,
  checkNumericAnswer,
  formatClock,
  generateRun,
  puzzleAward,
  timeBonus,
  type ChoiceInput,
  type DialInput,
  type NumericInput,
  type Puzzle,
  type TempleRun,
} from "@/lib/shadow-temple-math";

type Phase = "ready" | "prologue" | "playing" | "cinematic" | "ended";
type Stage = "enter" | "solve";
type Outcome = "escaped" | "trapped";

const MUTE_KEY = "pm_shadow_temple_mute";
const ROOM_ICONS = ["문", "용암", "다리", "방패", "제단", "별"];

type PuzzleLog = {
  room: number;
  title: string;
  attempts: number;
  hint: number;
};

/** Join lines for TTS — must match exactly what is shown on screen. */
function joinNarration(lines: readonly string[]): string {
  return lines
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ");
}

/* ------------------------------------------------------- typewriter */

function Typewriter({
  lines,
  onDone,
  speed = 26,
}: {
  lines: string[];
  onDone: () => void;
  speed?: number;
}) {
  const [lineIdx, setLineIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const doneRef = useRef(false);
  const lastLine = lines[lines.length - 1] ?? "";
  const finished = lineIdx >= lines.length - 1 && charIdx >= lastLine.length;

  useEffect(() => {
    if (finished) {
      if (!doneRef.current) {
        doneRef.current = true;
        onDone();
      }
      return;
    }
    const line = lines[lineIdx] ?? "";
    if (charIdx < line.length) {
      const t = window.setTimeout(() => setCharIdx((c) => c + 1), speed);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => {
      setLineIdx((l) => l + 1);
      setCharIdx(0);
    }, 520);
    return () => window.clearTimeout(t);
  }, [lines, lineIdx, charIdx, finished, speed, onDone]);

  const skip = () => {
    if (!finished) {
      setLineIdx(lines.length - 1);
      setCharIdx(lastLine.length);
    }
  };

  return (
    <div
      className="cursor-pointer space-y-3 text-left"
      onClick={skip}
      role="presentation"
    >
      {lines.slice(0, lineIdx + 1).map((line, i) => (
        <p
          key={i}
          className={[
            "text-sm leading-relaxed sm:text-base",
            line.startsWith("「")
              ? "font-semibold text-wood"
              : "text-foreground/80",
            i === lineIdx && !finished ? "st-caret" : "",
          ].join(" ")}
        >
          {i === lineIdx ? line.slice(0, charIdx) : line}
        </p>
      ))}
      {!finished ? (
        <p className="text-[11px] font-semibold text-wood/45">
          (누르면 빨리 감기)
        </p>
      ) : null}
    </div>
  );
}

/* --------------------------------------------------------- devices */

function StoneButton({
  children,
  onClick,
  disabled,
  variant = "stone",
  className = "",
  ariaLabel,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "stone" | "gold" | "ghost";
  className?: string;
  ariaLabel?: string;
}) {
  const base =
    variant === "gold"
      ? "bg-gold text-wood hover:bg-[#ffe08a] shadow-[0_4px_0_rgba(139,94,60,0.35)]"
      : variant === "ghost"
        ? "bg-transparent text-wood hover:bg-wood/5 border border-wood/20"
        : "bg-wood text-cream hover:bg-wood-dark shadow-[0_4px_0_rgba(91,58,34,0.55)]";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={[
        "rounded-xl px-4 py-2.5 text-sm font-bold transition active:translate-y-[2px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-40",
        base,
        className,
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function NumericPad({
  input,
  onSubmit,
  onKey,
  locked,
}: {
  input: NumericInput;
  onSubmit: (raw: string) => void;
  onKey: (sfx: TempleSfx) => void;
  locked: boolean;
}) {
  const [entry, setEntry] = useState("");
  const press = (k: string) => {
    onKey("click");
    if (k === "⌫") {
      setEntry((e) => e.slice(0, -1));
    } else if (k === "." && entry.includes(".")) {
      return;
    } else if (entry.length < 6) {
      setEntry((e) => e + k);
    }
  };
  return (
    <div className="mx-auto w-full max-w-[15rem]">
      <div className="rounded-xl border-2 border-wood/20 bg-cream px-4 py-3 text-center">
        <span className="font-display text-2xl tabular-nums tracking-widest text-wood">
          {entry || "\u00a0"}
        </span>
        <span className="ml-1 text-sm font-bold text-wood/50">
          {input.unit}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {["7", "8", "9", "4", "5", "6", "1", "2", "3", ".", "0", "⌫"].map(
          (k) => (
            <StoneButton
              key={k}
              onClick={() => press(k)}
              disabled={locked}
              className="py-2 text-base"
              ariaLabel={k === "⌫" ? "지우기" : k}
            >
              {k}
            </StoneButton>
          ),
        )}
      </div>
      <StoneButton
        variant="gold"
        onClick={() => {
          if (!entry) return;
          onSubmit(entry);
          setEntry("");
        }}
        disabled={locked || !entry}
        className="mt-2 w-full py-3 text-base"
      >
        돌 다이얼에 새기기
      </StoneButton>
    </div>
  );
}

function ChoiceBoard({
  input,
  wrongPicks,
  onPick,
  locked,
}: {
  input: ChoiceInput;
  wrongPicks: ReadonlySet<number>;
  onPick: (idx: number) => void;
  locked: boolean;
}) {
  const isShield = input.artifactLabel === "방패";
  return (
    <div
      className={[
        "mx-auto grid w-full max-w-md gap-2",
        input.options.length === 4 ? "grid-cols-2" : "grid-cols-3",
      ].join(" ")}
    >
      {input.options.map((opt, i) => {
        const wrong = wrongPicks.has(i);
        return (
          <button
            key={i}
            type="button"
            disabled={locked || wrong}
            onClick={() => onPick(i)}
            className={[
              "group relative flex flex-col items-center gap-1.5 rounded-2xl border-2 px-3 py-3 transition active:scale-[0.97]",
              wrong
                ? "cursor-not-allowed border-[#e85d4c]/40 bg-[#e85d4c]/10 opacity-50"
                : "border-wood/20 bg-white/70 hover:border-gold hover:bg-gold/20",
            ].join(" ")}
            aria-label={`${input.artifactLabel} ${opt.title}${opt.sub ? ` (${opt.sub})` : ""}`}
          >
            {isShield ? (
              <svg viewBox="0 0 40 44" className="h-11 w-10" aria-hidden>
                <path
                  d="M 20 2 L 37 9 L 37 24 C 37 34 29 40 20 43 C 11 40 3 34 3 24 L 3 9 Z"
                  fill={wrong ? "#e8d4b0" : "#c4b4e8"}
                  stroke={wrong ? "#e85d4c" : "#d4a017"}
                  strokeWidth="1.6"
                />
                <polygon
                  points="14,17 30,17 26,27 10,27"
                  fill="rgba(255,215,106,0.25)"
                  stroke="#ffd76a"
                  strokeWidth="1"
                />
              </svg>
            ) : (
              <svg viewBox="0 0 44 30" className="h-9 w-12" aria-hidden>
                <ellipse
                  cx="22"
                  cy="15"
                  rx="20"
                  ry="12"
                  fill={wrong ? "#e8d4b0" : "#c49a6c"}
                  stroke="#d4a017"
                  strokeWidth="1.6"
                />
                <ellipse cx="22" cy="13" rx="15" ry="8" fill={wrong ? "#f0e0c8" : "#ffd76a"} opacity="0.75" />
              </svg>
            )}
            <span className="font-display text-lg leading-none text-wood">
              {opt.title}
            </span>
            {opt.sub ? (
              <span className="text-[11px] font-bold text-wood/60">
                {opt.sub}
              </span>
            ) : null}
            {wrong ? (
              <span className="absolute right-2 top-1.5 text-sm font-black text-[#ff8d7a]">
                ✕
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function DialLock({
  input,
  onSubmit,
  onKey,
  locked,
}: {
  input: DialInput;
  onSubmit: (digits: [number, number]) => void;
  onKey: (sfx: TempleSfx) => void;
  locked: boolean;
}) {
  const [digits, setDigits] = useState<[number, number]>([0, 0]);
  const spin = (idx: 0 | 1, delta: number) => {
    onKey("dial");
    setDigits((d) => {
      const next: [number, number] = [...d];
      next[idx] = (next[idx] + delta + 10) % 10;
      return next;
    });
  };
  return (
    <div className="mx-auto flex w-full max-w-[15rem] flex-col items-center gap-3">
      <div className="flex gap-4">
        {([0, 1] as const).map((idx) => (
          <div key={idx} className="flex flex-col items-center gap-1">
            <StoneButton
              onClick={() => spin(idx, 1)}
              disabled={locked}
              className="px-5 py-1.5"
              ariaLabel={`${idx === 0 ? "십의 자리" : "일의 자리"} 올리기`}
            >
              ▲
            </StoneButton>
            <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-wood/25 bg-cream shadow-[inset_0_3px_10px_rgba(139,94,60,0.15)]">
              <span className="font-display text-3xl text-wood">
                {digits[idx]}
              </span>
            </div>
            <StoneButton
              onClick={() => spin(idx, -1)}
              disabled={locked}
              className="px-5 py-1.5"
              ariaLabel={`${idx === 0 ? "십의 자리" : "일의 자리"} 내리기`}
            >
              ▼
            </StoneButton>
          </div>
        ))}
      </div>
      <StoneButton
        variant="gold"
        onClick={() => onSubmit(digits)}
        disabled={locked}
        className="w-full py-3 text-base"
      >
        다이얼 맞물리기
      </StoneButton>
      <input type="hidden" value={input.code.join("")} readOnly aria-hidden />
    </div>
  );
}

/* ------------------------------------------------------------- main */

export default function ShadowTemple() {
  const [phase, setPhase] = useState<Phase>("ready");
  const [run, setRun] = useState<TempleRun | null>(null);
  const [roomIndex, setRoomIndex] = useState(0);
  const [puzzleIndex, setPuzzleIndex] = useState(0);
  const [stage, setStage] = useState<Stage>("enter");
  const [found, setFound] = useState<Set<string>>(() => new Set());
  const [wrongPicks, setWrongPicks] = useState<Set<number>>(() => new Set());
  const [attempt, setAttempt] = useState(1);
  const [hintRevealed, setHintRevealed] = useState(0);
  const [hintOpen, setHintOpen] = useState(false);
  const [solvedInfo, setSolvedInfo] = useState<{
    line: string;
    award: number;
    isLastPuzzleOfRoom: boolean;
    isFinal: boolean;
  } | null>(null);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TOTAL_TIME_SEC);
  const [statusMsg, setStatusMsg] = useState("");
  const [wrongFlash, setWrongFlash] = useState(false);
  const [storyDone, setStoryDone] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>("escaped");
  const [finalStats, setFinalStats] = useState({
    rooms: 0,
    wrong: 0,
    hints: 0,
    timeLeft: 0,
  });
  const [muted, setMuted] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(MUTE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [submitResult, setSubmitResult] =
    useState<GameSubmitClientResult | null>(null);
  const [ranking, setRanking] = useState<RankingRow[]>([]);
  const [rankingScope, setRankingScope] = useState<RankingScope>("class");
  const [rankingMode, setRankingMode] = useState<RankingMode>("best");
  const [isPending, startTransition] = useTransition();

  const audioRef = useRef<TempleAudio | null>(null);
  const deadlineRef = useRef(0);
  const scoreRef = useRef(0);
  const phaseRef = useRef<Phase>("ready");
  const heartbeatOnRef = useRef(false);
  const endingRef = useRef(false);
  const wrongTotalRef = useRef(0);
  const hintTotalRef = useRef(0);
  const cluesTotalRef = useRef(0);
  const roomsClearedRef = useRef(0);
  const puzzleLogsRef = useRef<PuzzleLog[]>([]);
  const finalTimeLeftRef = useRef(0);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const getAudio = useCallback((): TempleAudio => {
    if (!audioRef.current) {
      audioRef.current = new TempleAudio();
      audioRef.current.setMuted(muted);
    }
    return audioRef.current;
  }, [muted]);

  useEffect(() => {
    audioRef.current?.setMuted(muted);
  }, [muted]);

  useEffect(() => {
    warmSpeechVoices();
    return () => {
      audioRef.current?.dispose();
      audioRef.current = null;
    };
  }, []);

  const sfx = useCallback(
    (kind: TempleSfx) => {
      getAudio().play(kind);
    },
    [getAudio],
  );

  const toggleMute = () => {
    setMuted((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(MUTE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const room = run?.rooms[roomIndex] ?? null;
  const puzzle: Puzzle | null = room?.puzzles[puzzleIndex] ?? null;
  const cluesFound = puzzle
    ? puzzle.clues.filter((c) => found.has(c.id)).length
    : 0;
  const allCluesFound = puzzle ? cluesFound >= puzzle.clues.length : false;
  const dangerTime = timeLeft <= 60;

  /**
   * TTS only after the matching on-screen narration is fully visible
   * (storyDone / unlocked prompt), and only reads those exact lines.
   */
  useEffect(() => {
    if (phase !== "prologue" || !storyDone || PROLOGUE.length === 0) {
      return;
    }
    const audio = getAudio();
    const t = window.setTimeout(() => audio.speak(joinNarration(PROLOGUE)), 200);
    return () => {
      window.clearTimeout(t);
      audio.stopSpeak();
    };
  }, [phase, storyDone, getAudio]);

  useEffect(() => {
    if (phase !== "playing" || stage !== "enter" || !room || !storyDone) return;
    const audio = getAudio();
    // Same lines as the Typewriter body — title/objective stay as headings only.
    const t = window.setTimeout(
      () => audio.speak(joinNarration(room.enterStory)),
      200,
    );
    return () => {
      window.clearTimeout(t);
      audio.stopSpeak();
    };
  }, [phase, stage, roomIndex, room, storyDone, getAudio]);

  useEffect(() => {
    if (phase !== "playing" || stage !== "solve" || !puzzle || !allCluesFound) {
      return;
    }
    if (solvedInfo) return;
    const audio = getAudio();
    const lines = [puzzle.prompt, puzzle.approxNote].filter(
      (line): line is string => Boolean(line),
    );
    const t = window.setTimeout(() => audio.speak(joinNarration(lines)), 200);
    return () => {
      window.clearTimeout(t);
      audio.stopSpeak();
    };
  }, [
    phase,
    stage,
    roomIndex,
    puzzleIndex,
    allCluesFound,
    puzzle,
    solvedInfo,
    getAudio,
  ]);

  /* --------------------------------------------------------- ending */

  const endGame = useCallback(
    (finalOutcome: Outcome) => {
      if (endingRef.current) return;
      endingRef.current = true;
      const audio = getAudio();
      audio.stopHeartbeat();
      heartbeatOnRef.current = false;
      finalTimeLeftRef.current = Math.max(
        0,
        (deadlineRef.current - Date.now()) / 1000,
      );
      let finalScore = scoreRef.current;
      if (finalOutcome === "escaped") {
        const bonus = timeBonus(finalTimeLeftRef.current);
        finalScore = applyScoreGain(finalScore, bonus);
        scoreRef.current = finalScore;
        setScore(finalScore);
        audio.play("collapse");
        window.setTimeout(() => audio.play("fanfare"), 900);
      } else {
        audio.play("collapse");
      }
      setOutcome(finalOutcome);
      setFinalStats({
        rooms: roomsClearedRef.current,
        wrong: wrongTotalRef.current,
        hints: hintTotalRef.current,
        timeLeft: finalTimeLeftRef.current,
      });
      setStoryDone(false);
      setPhase("cinematic");
      phaseRef.current = "cinematic";

      startTransition(async () => {
        const result = await submitGameRun({
          contentKey: CONTENT_KEY,
          score: finalScore,
          details: activityDetailsV1(
            {
              escaped: finalOutcome === "escaped" ? "성공" : "시간 초과",
              roomsCleared: roomsClearedRef.current,
              wrongAttempts: wrongTotalRef.current,
              hintsUsed: hintTotalRef.current,
              timeLeftSec: Math.round(finalTimeLeftRef.current),
            },
            puzzleLogsRef.current.map((l) => ({ ...l })),
          ),
        });
        setSubmitResult(result);
        if (result.recorded) {
          const rows = await fetchGameRanking({
            contentKey: CONTENT_KEY,
            scope: "class",
            mode: "best",
          });
          setRanking(rows);
        }
      });
    },
    [getAudio, startTransition],
  );

  /* ---------------------------------------------------------- timer */

  useEffect(() => {
    if (phase !== "playing") return;
    const iv = window.setInterval(() => {
      const left = (deadlineRef.current - Date.now()) / 1000;
      setTimeLeft(Math.max(0, left));
      const audio = audioRef.current;
      if (left <= 60 && left > 0 && !heartbeatOnRef.current) {
        heartbeatOnRef.current = true;
        audio?.startHeartbeat();
      } else if (left > 60 && heartbeatOnRef.current) {
        heartbeatOnRef.current = false;
        audio?.stopHeartbeat();
      }
      if (left <= 0 && phaseRef.current === "playing") {
        endGame("trapped");
      }
    }, 250);
    return () => window.clearInterval(iv);
  }, [phase, endGame]);

  /* ----------------------------------------------------------- flow */

  const enterTemple = () => {
    setRun(generateRun());
    setRoomIndex(0);
    setPuzzleIndex(0);
    setStage("enter");
    setFound(new Set());
    setWrongPicks(new Set());
    setAttempt(1);
    setHintRevealed(0);
    setHintOpen(false);
    setSolvedInfo(null);
    setScore(0);
    scoreRef.current = 0;
    setTimeLeft(TOTAL_TIME_SEC);
    setStatusMsg("");
    setSubmitResult(null);
    setRanking([]);
    setRankingScope("class");
    setRankingMode("best");
    setStoryDone(false);
    endingRef.current = false;
    wrongTotalRef.current = 0;
    hintTotalRef.current = 0;
    cluesTotalRef.current = 0;
    roomsClearedRef.current = 0;
    puzzleLogsRef.current = [];
    heartbeatOnRef.current = false;
    const audio = getAudio();
    audio.startAmbience();
    audio.play("door");
    setPhase("prologue");
    phaseRef.current = "prologue";
  };

  const beginTrials = () => {
    deadlineRef.current = Date.now() + TOTAL_TIME_SEC * 1000;
    setTimeLeft(TOTAL_TIME_SEC);
    sfx("door");
    setStoryDone(false);
    setPhase("playing");
    phaseRef.current = "playing";
  };

  const startInvestigation = () => {
    sfx("click");
    setStage("solve");
    setStatusMsg("빛나는 곳을 눌러 단서를 모으세요.");
  };

  const onFindClue = (clueId: string) => {
    if (!puzzle) return;
    const clue = puzzle.clues.find((c) => c.id === clueId);
    if (!clue || found.has(clueId)) return;
    sfx("clue");
    cluesTotalRef.current += 1;
    setFound((prev) => {
      const next = new Set(prev);
      next.add(clueId);
      return next;
    });
    setStatusMsg(`[${clue.label}] ${clue.text}`);
  };

  const openHint = () => {
    sfx("hint");
    setHintOpen(true);
  };

  const revealNextHintLine = () => {
    if (!puzzle) return;
    const lines = [...puzzle.hintConcept, ...puzzle.hintSolve];
    if (hintRevealed >= lines.length) return;
    const nextScore = applyHintLinePenalty(scoreRef.current);
    scoreRef.current = nextScore;
    setScore(nextScore);
    setHintRevealed((n) => n + 1);
    hintTotalRef.current += 1;
    sfx("hint");
    setStatusMsg(`수첩에서 한 줄을 펼쳤다 (−${HINT_LINE_PENALTY}점).`);
  };

  const handleWrong = () => {
    if (!room || !puzzle) return;
    wrongTotalRef.current += 1;
    setAttempt((a) => a + 1);
    deadlineRef.current -= WRONG_TIME_PENALTY_SEC * 1000;
    setTimeLeft(Math.max(0, (deadlineRef.current - Date.now()) / 1000));
    sfx("wrong");
    setWrongFlash(true);
    window.setTimeout(() => setWrongFlash(false), 450);
    const flavor =
      room.kind === "lavaFloor"
        ? "바닥이 뜨거워진다! 다시 계산해 보자."
        : room.kind === "guardianShield"
          ? "방패가 홈에 맞지 않는다. 넓이를 다시 비교해 보자."
          : "장치가 꿈틀한다. 숫자를 한 번 더 살펴보자.";
    setStatusMsg(
      `${flavor} 오답 — 횃불이 ${WRONG_TIME_PENALTY_SEC}초만큼 타 버렸다.`,
    );
  };

  const handleCorrect = () => {
    if (!room || !puzzle) return;
    const award = puzzleAward(attempt, puzzle.weight);
    const next = applyScoreGain(scoreRef.current, award);
    scoreRef.current = next;
    setScore(next);
    puzzleLogsRef.current.push({
      room: room.id,
      title: room.title,
      attempts: attempt,
      hint: hintRevealed,
    });
    const isLastPuzzleOfRoom = puzzleIndex >= room.puzzles.length - 1;
    if (isLastPuzzleOfRoom) {
      roomsClearedRef.current = room.id;
    }
    const isFinal = isLastPuzzleOfRoom && roomIndex >= (run?.rooms.length ?? 6) - 1;
    sfx("correct");
    setSolvedInfo({
      line: puzzle.solvedLine,
      award,
      isLastPuzzleOfRoom,
      isFinal,
    });
    setHintOpen(false);
    setStatusMsg("");
  };

  const submitNumeric = (raw: string) => {
    if (!puzzle || puzzle.input.kind !== "numeric") return;
    if (checkNumericAnswer(raw, puzzle.input.answer)) handleCorrect();
    else handleWrong();
  };

  const submitChoice = (idx: number) => {
    if (!puzzle || puzzle.input.kind !== "choice") return;
    if (idx === puzzle.input.correctIndex) {
      handleCorrect();
    } else {
      setWrongPicks((prev) => {
        const next = new Set(prev);
        next.add(idx);
        return next;
      });
      handleWrong();
    }
  };

  const submitDial = (digits: [number, number]) => {
    if (!puzzle || puzzle.input.kind !== "dial") return;
    const [t, o] = puzzle.input.code;
    if (digits[0] === t && digits[1] === o) handleCorrect();
    else handleWrong();
  };

  const continueAfterSolved = () => {
    if (!run || !room || !solvedInfo) return;
    if (solvedInfo.isFinal) {
      endGame("escaped");
      setSolvedInfo(null);
      return;
    }
    if (!solvedInfo.isLastPuzzleOfRoom) {
      setPuzzleIndex((p) => p + 1);
      setAttempt(1);
      setHintRevealed(0);
      setFound(new Set());
      setWrongPicks(new Set());
      setSolvedInfo(null);
      sfx("click");
      setStatusMsg("빛나는 곳을 눌러 새 단서를 모으세요.");
      return;
    }
    sfx("door");
    setRoomIndex((r) => r + 1);
    setPuzzleIndex(0);
    setStage("enter");
    setFound(new Set());
    setWrongPicks(new Set());
    setAttempt(1);
    setHintRevealed(0);
    setSolvedInfo(null);
    setStoryDone(false);
    setStatusMsg("");
  };

  const finishCinematic = () => {
    getAudio().stopAmbience();
    setPhase("ended");
    phaseRef.current = "ended";
  };

  const backToTitle = () => {
    setPhase("ready");
    phaseRef.current = "ready";
    setRun(null);
  };

  const loadRanking = (next: { scope?: RankingScope; mode?: RankingMode }) => {
    const scope = next.scope ?? rankingScope;
    const mode = next.mode ?? rankingMode;
    if (next.scope) setRankingScope(next.scope);
    if (next.mode) setRankingMode(next.mode);
    startTransition(async () => {
      const rows = await fetchGameRanking({ contentKey: CONTENT_KEY, scope, mode });
      setRanking(rows);
    });
  };

  const timePct = Math.max(0, Math.min(100, (timeLeft / TOTAL_TIME_SEC) * 100));
  const revealedClues = useMemo(
    () => (puzzle ? puzzle.clues.filter((c) => found.has(c.id)) : []),
    [puzzle, found],
  );

  /* ------------------------------------------------------------- UI */

  return (
    <div className="flex flex-col gap-5">
      <section className="quest-card relative overflow-hidden bg-gradient-to-br from-lavender/45 via-sky/20 to-gold/25 p-5 sm:p-7">
        <div className="relative flex flex-wrap items-start gap-4">
          <div className="relative h-16 w-16 shrink-0 sm:h-20 sm:w-20">
            <Image
              src="/images/grade-3-v2.png"
              alt="별빛"
              fill
              className="object-contain"
              sizes="80px"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-wood">중3 · 3.1 삼각비</p>
            <h1 className="font-display mt-1 text-3xl text-foreground sm:text-4xl">
              그림자 신전: 여섯 개의 시련
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-foreground/75 sm:text-base">
              별빛과 함께 피타 박사의 흔적을 쫓아 들어간 고대 신전. 석문이 닫혔다!
              방마다 숨은 <strong>단서를 조사</strong>하고, 삼각비로 장치를 풀어
              횃불이 꺼지기 전에 탈출하세요.
            </p>
          </div>
        </div>
      </section>

      {phase === "ready" ? (
        <section className="quest-card overflow-hidden border-lavender/40 bg-gradient-to-br from-lavender/30 via-sky/20 to-gold/20 text-center">
          <TitleScene />
          <div className="px-5 pb-8 pt-2 sm:px-8">
            <p className="font-display text-2xl text-wood sm:text-3xl">
              여섯 개의 방, 하나의 탈출구
            </p>
            <ul className="mx-auto mt-4 grid max-w-lg gap-2 text-left text-sm font-semibold text-foreground/80">
              <li className="rounded-xl bg-white/55 px-4 py-2.5">
                횃불 시간 <strong>15분</strong> — 다 타면 탈출 실패. 오답은{" "}
                {WRONG_TIME_PENALTY_SEC}초를 태워요.
              </li>
              <li className="rounded-xl bg-white/55 px-4 py-2.5">
                방마다 빛나는 곳을 <strong>조사해 단서</strong>를 모아야 장치가
                깨어나요.
              </li>
              <li className="rounded-xl bg-white/55 px-4 py-2.5">
                막히면 <strong>박사의 수첩</strong>을 펴고 한 줄씩 펼치세요 — 줄마다{" "}
                −{HINT_LINE_PENALTY}점.
              </li>
              <li className="rounded-xl bg-white/55 px-4 py-2.5">
                빠르고 정확할수록 높은 점수! 남은 횃불 시간은 보너스가 돼요.
              </li>
            </ul>
            <button
              type="button"
              onClick={enterTemple}
              className="mt-7 rounded-xl bg-wood px-10 py-4 text-lg font-bold text-cream shadow-md transition hover:bg-wood-dark active:scale-[0.98]"
            >
              신전에 들어가기
            </button>
            <p className="mt-3 text-xs font-semibold text-wood/50">
              소리를 켜면 더 실감나요
            </p>
          </div>
        </section>
      ) : null}

      {phase === "prologue" ? (
        <section className="quest-card border-lavender/40 bg-gradient-to-br from-lavender/25 via-sky/15 to-gold/15 p-6 sm:p-10">
          <p className="font-display text-xl text-wood/60">— 프롤로그 —</p>
          <div className="mt-4">
            <Typewriter
              key="prologue"
              lines={PROLOGUE}
              onDone={() => setStoryDone(true)}
            />
          </div>
          {storyDone ? (
            <div className="mt-7 text-center">
              <button
                type="button"
                onClick={beginTrials}
                className="st-fade-in rounded-xl bg-wood px-8 py-3.5 text-lg font-bold text-cream shadow-md transition hover:bg-wood-dark active:scale-[0.98]"
              >
                시련 시작 — 횃불에 불을 붙인다
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {phase === "playing" && run && room && puzzle ? (
        <section
          className={[
            "quest-card-static overflow-hidden",
            wrongFlash ? "st-shake" : "",
            dangerTime ? "st-danger" : "",
          ].join(" ")}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-wood/10 px-4 py-3 sm:px-5">
            <div className="flex items-center gap-1.5" aria-label="방 진행도">
              {ROOM_ICONS.map((icon, i) => (
                <span
                  key={icon}
                  className={[
                    "flex h-7 min-w-7 items-center justify-center rounded-lg px-1 text-[11px] font-black",
                    i < roomIndex
                      ? "bg-mint/40 text-wood"
                      : i === roomIndex
                        ? "bg-gold text-wood"
                        : "bg-wood/8 text-wood/40",
                  ].join(" ")}
                >
                  {i < roomIndex ? "✓" : icon}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2 text-sm font-bold">
              <span className="rounded-xl bg-gold/50 px-3 py-1 text-wood">
                {score}점
              </span>
              <button
                type="button"
                onClick={toggleMute}
                className="rounded-lg bg-wood/8 px-3 py-1.5 text-xs font-bold text-wood"
                aria-pressed={muted}
              >
                {muted ? "소리 켜기" : "소리 끄기"}
              </button>
            </div>
          </div>

          <div className="border-b border-wood/10 px-4 py-2 sm:px-5">
            <div className="flex items-center justify-between text-xs font-semibold text-foreground/55">
              <span>횃불이 타는 중…</span>
              <span
                className={[
                  "font-display text-base tabular-nums",
                  dangerTime ? "text-[#e85d4c]" : "text-wood",
                ].join(" ")}
                aria-live="off"
              >
                {formatClock(timeLeft)}
              </span>
            </div>
            <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-wood/10">
              <div
                className={[
                  "h-full rounded-full transition-[width] duration-300",
                  dangerTime ? "bg-[#e85d4c]" : "bg-gradient-to-r from-peach to-gold",
                ].join(" ")}
                style={{ width: `${timePct}%` }}
              />
            </div>
          </div>

          {stage === "enter" ? (
            <div className="st-room-enter px-5 py-7 sm:px-8" key={`enter-${roomIndex}`}>
              <p className="text-sm font-bold text-wood/55">{room.id}번째 방</p>
              <h2 className="font-display mt-1 text-2xl text-wood sm:text-3xl">
                {room.title}
              </h2>
              <p className="mt-1 text-xs font-bold text-wood/60">{room.objective}</p>
              <div className="mt-5">
                <Typewriter
                  key={`story-${roomIndex}`}
                  lines={room.enterStory}
                  onDone={() => setStoryDone(true)}
                  speed={18}
                />
              </div>
              <div className="mt-6">
                {storyDone ? (
                  <StoneButton
                    variant="gold"
                    onClick={startInvestigation}
                    className="px-8 py-3 text-base"
                  >
                    방 조사 시작
                  </StoneButton>
                ) : (
                  <p className="text-xs font-semibold text-wood/45">
                    이야기를 끝까지 읽어야 조사할 수 있어요 (누르면 빨리 감기)
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="st-room-enter" key={`solve-${roomIndex}-${puzzleIndex}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 pt-3 sm:px-5">
                <h2 className="font-display text-xl text-wood sm:text-2xl">
                  {room.title}
                  {room.puzzles.length > 1 ? (
                    <span className="ml-2 text-sm text-wood/55">
                      ({puzzleIndex + 1}/{room.puzzles.length})
                    </span>
                  ) : null}
                </h2>
                <span className="text-xs font-bold text-wood/50">
                  단서 {cluesFound}/{puzzle.clues.length}
                </span>
              </div>

              <div className="px-3 pt-2 sm:px-4">
                <div className="overflow-hidden rounded-2xl border border-wood/15">
                  <RoomScene
                    room={room}
                    found={found}
                    onFind={onFindClue}
                    puzzleIndex={puzzleIndex}
                    solvedCount={puzzleIndex}
                  />
                </div>
              </div>

              {revealedClues.length > 0 ? (
                <ul className="mx-3 mt-2 space-y-1.5 sm:mx-4">
                  {revealedClues.map((c) => (
                    <li
                      key={c.id}
                      className="st-fade-in rounded-xl bg-mint/20 px-3 py-2 text-xs font-semibold leading-relaxed text-foreground/80 sm:text-sm"
                    >
                      <span className="mr-1.5 font-black text-wood">{c.label}</span>
                      {c.text}
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className="mx-3 my-3 rounded-2xl border border-wood/15 bg-white/50 p-4 sm:mx-4">
                {allCluesFound ? (
                  <>
                    <p className="text-center text-sm font-bold text-foreground sm:text-base">
                      {puzzle.prompt}
                    </p>
                    {puzzle.approxNote ? (
                      <p className="mt-1 text-center text-xs font-bold text-wood">
                        * {puzzle.approxNote}
                      </p>
                    ) : null}
                    <div className="mt-4">
                      {puzzle.input.kind === "numeric" ? (
                        <NumericPad
                          key={`${roomIndex}-${puzzleIndex}`}
                          input={puzzle.input}
                          onSubmit={submitNumeric}
                          onKey={sfx}
                          locked={!!solvedInfo}
                        />
                      ) : puzzle.input.kind === "choice" ? (
                        <ChoiceBoard
                          input={puzzle.input}
                          wrongPicks={wrongPicks}
                          onPick={submitChoice}
                          locked={!!solvedInfo}
                        />
                      ) : (
                        <DialLock
                          key={`${roomIndex}-${puzzleIndex}`}
                          input={puzzle.input}
                          onSubmit={submitDial}
                          onKey={sfx}
                          locked={!!solvedInfo}
                        />
                      )}
                    </div>
                  </>
                ) : (
                  <p className="py-4 text-center text-sm font-bold text-wood/50">
                    장치가 잠들어 있다 — 빛나는 곳을 모두 조사하면 깨어난다 (
                    {cluesFound}/{puzzle.clues.length})
                  </p>
                )}
              </div>

              <div className="flex items-start justify-between gap-3 border-t border-wood/10 bg-cream/60 px-4 py-3 sm:px-5">
                <p
                  className="min-h-[2.25rem] flex-1 text-xs font-semibold leading-relaxed text-foreground/70 sm:text-sm"
                  role="status"
                  aria-live="polite"
                >
                  {statusMsg}
                </p>
                <StoneButton variant="ghost" onClick={openHint} className="shrink-0">
                  박사의 수첩
                </StoneButton>
              </div>
            </div>
          )}

          {hintOpen && puzzle ? (
            <div className="border-t-2 border-gold/50 bg-gold/10 px-5 py-4 sm:px-7">
              <div className="flex items-center justify-between gap-3">
                <p className="font-display text-lg text-wood">박사의 수첩</p>
                <StoneButton
                  variant="ghost"
                  onClick={() => setHintOpen(false)}
                  className="px-3 py-1.5 text-xs"
                >
                  덮기
                </StoneButton>
              </div>
              <p className="mt-1 text-xs font-semibold text-wood/55">
                한 줄씩 펼칩니다. 줄마다 −{HINT_LINE_PENALTY}점.
              </p>
              {(() => {
                const lines = [...puzzle.hintConcept, ...puzzle.hintSolve];
                const shown = lines.slice(0, hintRevealed);
                const conceptCount = puzzle.hintConcept.length;
                return (
                  <>
                    {shown.length === 0 ? (
                      <p className="mt-3 text-sm text-foreground/55">
                        아직 펼친 줄이 없습니다. 막히면 아래 버튼으로 한 줄만 보세요.
                      </p>
                    ) : (
                      <div className="mt-3 space-y-1.5">
                        {shown.map((line, i) => (
                          <p
                            key={i}
                            className={[
                              "text-sm leading-relaxed",
                              i >= conceptCount
                                ? "rounded-lg bg-white/70 px-3 py-2 text-foreground"
                                : "text-foreground/80",
                            ].join(" ")}
                          >
                            {i >= conceptCount ? `${i - conceptCount + 1}. ` : ""}
                            {line}
                          </p>
                        ))}
                      </div>
                    )}
                    {hintRevealed < lines.length ? (
                      <StoneButton
                        variant="ghost"
                        onClick={revealNextHintLine}
                        className="mt-3 text-xs"
                      >
                        다음 줄 펼치기 (−{HINT_LINE_PENALTY}점)
                        {hintRevealed > 0
                          ? ` · ${hintRevealed}/${lines.length}`
                          : ""}
                      </StoneButton>
                    ) : (
                      <p className="mt-3 text-xs font-bold text-wood/50">
                        수첩의 이 페이지를 모두 펼쳤습니다 ({lines.length}줄).
                      </p>
                    )}
                  </>
                );
              })()}
            </div>
          ) : null}

          {solvedInfo ? (
            <div className="border-t-2 border-mint/60 bg-mint/20 px-5 py-5 text-center sm:px-8">
              <p className="font-display text-xl text-wood">
                장치가 풀렸다! +{solvedInfo.award}점
              </p>
              <p className="mt-2 text-sm leading-relaxed text-foreground/80">
                {solvedInfo.line}
              </p>
              <StoneButton
                variant="gold"
                onClick={continueAfterSolved}
                className="mt-4 px-8 py-3 text-base"
              >
                {solvedInfo.isFinal
                  ? "황금의 별을 쥐고 탈출한다!"
                  : solvedInfo.isLastPuzzleOfRoom
                    ? "다음 방으로 이동 →"
                    : "다음 장치로 →"}
              </StoneButton>
            </div>
          ) : null}
        </section>
      ) : null}

      {phase === "cinematic" ? (
        <section className="quest-card border-lavender/40 bg-gradient-to-br from-lavender/30 via-sky/15 to-gold/20 p-6 sm:p-10">
          <p className="font-display text-xl text-wood/60">
            {outcome === "escaped" ? "— 탈출 —" : "— 횃불이 꺼졌다 —"}
          </p>
          <div className="mt-4">
            <Typewriter
              lines={outcome === "escaped" ? ESCAPE_STORY : TRAPPED_STORY}
              onDone={() => setStoryDone(true)}
            />
          </div>
          {storyDone ? (
            <div className="mt-7 text-center">
              <button
                type="button"
                onClick={finishCinematic}
                className="st-fade-in rounded-xl bg-wood px-8 py-3.5 text-lg font-bold text-cream shadow-md transition hover:bg-wood-dark active:scale-[0.98]"
              >
                {outcome === "escaped" ? "탈출 성공! 결과 보기" : "결과 보기"}
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {phase === "ended" ? (
        <section
          className="quest-card border-lavender/40 bg-gradient-to-br from-lavender/40 via-sky/20 to-gold/30 p-5 text-center sm:p-7"
          role="status"
          aria-live="polite"
        >
          <p className="font-display text-2xl text-wood">
            {outcome === "escaped" ? "신전 탈출 성공!" : "다음 도전을 기다린다"}
          </p>
          <p className="font-display mt-2 text-4xl text-wood sm:text-5xl">
            {score}점
          </p>
          <p className="mt-2 text-sm font-semibold text-foreground/70">
            방 {finalStats.rooms}/6 통과
            {" · "}오답 {finalStats.wrong}회
            {" · "}수첩 {finalStats.hints}회
            {outcome === "escaped"
              ? ` · 남은 횃불 ${formatClock(finalStats.timeLeft)}`
              : ""}
          </p>

          {isPending && !submitResult ? (
            <p className="mt-4 text-sm font-bold text-wood/70">점수 반영 중…</p>
          ) : null}

          {submitResult?.error ? (
            <p className="mt-4 text-sm font-bold text-[#a63a1a]">{submitResult.error}</p>
          ) : null}

          {submitResult && !submitResult.error ? (
            submitResult.recorded ? (
              <p className="mt-4 text-sm font-bold text-wood">{submitResult.message}</p>
            ) : (
              <p className="mx-auto mt-4 max-w-md rounded-2xl bg-wood/5 px-4 py-3 text-sm font-semibold text-foreground/65">
                연습 모드 · 점수는 반영되지 않아요
                <span className="mt-1 block text-xs font-medium text-foreground/50">
                  학급에 배정·활성화된 게임을 학생 로그인으로 플레이하면 XP와
                  랭킹이 쌓여요.
                </span>
              </p>
            )
          ) : null}

          {submitResult?.recorded ? (
            <div className="mt-6 text-left">
              <GameRankingBoard
                rows={ranking}
                scope={rankingScope}
                mode={rankingMode}
                onScopeChange={(scope) => loadRanking({ scope })}
                onModeChange={(mode) => loadRanking({ mode })}
                loading={isPending}
              />
            </div>
          ) : null}

          <button
            type="button"
            onClick={backToTitle}
            className="mt-6 rounded-xl bg-wood px-8 py-3 text-base font-bold text-cream"
          >
            다시 도전하기
          </button>
        </section>
      ) : null}
    </div>
  );
}
