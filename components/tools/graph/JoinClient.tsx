"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  graphDeleteOwnPointAction,
  graphGuestJoinAction,
  graphGuestPollAction,
  graphSubmitPointAction,
} from "@/app/tools/graph/actions";
import { formatCoord } from "@/lib/graph-explorer-math";
import type { GraphStudentState } from "@/lib/graph-explorer-types";
import InteractiveGraphPlane, {
  type PlanePoint,
} from "@/components/tools/graph/InteractiveGraphPlane";
import MathExpression from "@/components/tools/graph/MathExpression";
import {
  colorForParticipant,
  WRONG_POINT_COLOR,
} from "@/components/tools/graph/participant-colors";

const POLL_MS = 1200;
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

  useEffect(() => {
    if (!sessionId) return;
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [sessionId, refresh]);

  const myPoints = useMemo(
    () => state?.points.filter((p) => p.isMe) ?? [],
    [state],
  );
  const unlimited = state?.settings.unlimitedPoints ?? false;
  const remaining = state && !unlimited
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
      label: p.isMe ? "나" : state.settings.showNames ? p.participantName : null,
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
        text: "정답이에요! 칠판에 점이 찍혔어요 🎉 다른 점도 찾아볼까요?",
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
        text: "아직 식을 만족하지 않아요. 기회는 그대로! 다시 도전해 보세요 💪",
      });
    }
    refresh();
  };

  // ── 입장 전 화면 ──────────────────────────────────────────────
  if (!sessionId) {
    return (
      <div className="mx-auto max-w-sm space-y-5 py-6">
        <header className="text-center">
          <p className="text-4xl" aria-hidden>
            📈
          </p>
          <h1 className="font-display mt-2 text-2xl text-wood-dark">
            그래프 탐구 참여하기
          </h1>
          <p className="mt-1 text-sm text-foreground/60">
            로그인 없이 이름만 적고 바로 들어와요
          </p>
        </header>

        <div className="space-y-4 rounded-3xl border-2 border-wood/15 bg-cream p-6">
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
              className="mt-1 w-full rounded-2xl border-2 border-wood/20 bg-white px-4 py-3 text-center font-mono text-2xl tracking-[0.35em] uppercase outline-none focus:border-wood/50"
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
              className="mt-1 w-full rounded-2xl border-2 border-wood/20 bg-white px-4 py-3 text-lg outline-none focus:border-wood/50"
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
            className="font-display w-full rounded-2xl bg-gold px-4 py-3.5 text-lg text-[#6b4a00] shadow-[0_4px_0_rgba(107,74,0,0.3)] transition hover:brightness-105 active:translate-y-0.5 disabled:opacity-50"
          >
            {joining ? "입장 중…" : "입장하기"}
          </button>
        </div>
      </div>
    );
  }

  // ── 활동 화면 ────────────────────────────────────────────────
  if (!state) {
    return (
      <div className="py-20 text-center text-foreground/50">불러오는 중…</div>
    );
  }

  const closed = state.status === "closed";

  return (
    <div className="mx-auto max-w-md space-y-4 py-2">
      <header className="rounded-2xl border-2 border-wood/15 bg-cream px-5 py-4 text-center">
        <p className="text-xs text-foreground/55">
          {state.myName ?? name} · 함께 탐구 중 {state.participantCount}명
        </p>
        {state.expressionDisplay ? (
          <div className="mt-1 flex justify-center">
            <MathExpression
              display={state.expressionDisplay}
              latex={state.expressionLatex}
              className="text-2xl"
            />
          </div>
        ) : (
          <p className="font-display mt-1 text-xl text-wood-dark">
            y = ❓{" "}
            <span className="block text-sm font-normal text-foreground/60">
              선생님이 식을 숨겼어요. 규칙을 만족하는 점을 찾아보세요!
            </span>
          </p>
        )}
        <p className="mt-1 text-sm text-foreground/70">
          이 식을 만족하는 순서쌍 (x, y)를 찾아 제출하세요
          {state.settings.integersOnly ? (
            <span className="ml-1 rounded-full bg-sky/40 px-2 py-0.5 text-xs font-semibold">
              정수만
            </span>
          ) : null}
        </p>
      </header>

      {closed ? (
        <div className="rounded-2xl border-2 border-wood/15 bg-black/5 px-5 py-6 text-center">
          <p className="font-display text-lg text-wood-dark">
            활동이 끝났어요
          </p>
          <p className="mt-1 text-sm text-foreground/60">
            함께 탐구해줘서 고마워요! 👏
          </p>
        </div>
      ) : (
        <div className="space-y-3 rounded-2xl border-2 border-wood/15 bg-cream p-5">
          <div className="flex items-center justify-between">
            <p className="font-display text-sm text-wood-dark">순서쌍 제출</p>
            <p className="text-xs text-foreground/60">
              {unlimited ? (
                <>제출 <b className="text-wood-dark">무제한</b></>
              ) : (
                <>
                  남은 기회 <b className="text-wood-dark">{remaining}</b>개
                </>
              )}
            </p>
          </div>

          <div className="flex items-center justify-center gap-1 text-2xl">
            <span className="font-display text-wood-dark">(</span>
            <input
              ref={xInputRef}
              value={xRaw}
              onChange={(e) => setXRaw(e.target.value)}
              placeholder="x"
              inputMode="text"
              autoComplete="off"
              className="w-24 rounded-xl border-2 border-wood/20 bg-white px-2 py-2.5 text-center font-mono text-xl outline-none focus:border-wood/50"
            />
            <span className="font-display text-wood-dark">,</span>
            <input
              value={yRaw}
              onChange={(e) => setYRaw(e.target.value)}
              placeholder="y"
              inputMode="text"
              autoComplete="off"
              className="w-24 rounded-xl border-2 border-wood/20 bg-white px-2 py-2.5 text-center font-mono text-xl outline-none focus:border-wood/50"
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
            />
            <span className="font-display text-wood-dark">)</span>
          </div>
          <p className="text-center text-[11px] text-foreground/50">
            분수는 3/2 처럼 입력할 수 있어요
          </p>

          {feedback ? (
            <p
              className={`rounded-xl px-3 py-2 text-center text-sm font-semibold ${
                feedback.tone === "success"
                  ? "bg-emerald-50 text-emerald-700"
                  : feedback.tone === "warn"
                    ? "bg-amber-50 text-amber-700"
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
            className="font-display w-full rounded-2xl bg-gold px-4 py-3 text-lg text-[#6b4a00] shadow-[0_4px_0_rgba(107,74,0,0.3)] transition hover:brightness-105 active:translate-y-0.5 disabled:opacity-50"
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
        <div className="rounded-2xl border-2 border-wood/15 bg-cream p-4">
          <p className="font-display text-sm text-wood-dark">내가 찍은 점</p>
          <ul className="mt-2 space-y-1">
            {myPoints.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between text-sm"
              >
                <span>
                  ({formatCoord(p.x)}, {formatCoord(p.y)}){" "}
                  {p.isCorrect ? (
                    <span className="text-emerald-600">✓ 정답</span>
                  ) : (
                    <span className="text-red-500">✗ 오답</span>
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
                      refresh();
                    }}
                    className="rounded px-1.5 py-0.5 text-xs text-foreground/40 transition hover:bg-red-50 hover:text-red-500"
                  >
                    지우기
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border-2 border-wood/15 bg-white">
        <p className="border-b border-wood/10 px-4 py-2 text-xs font-semibold text-foreground/60">
          {state.settings.shareBoardWithStudents
            ? "우리 반 좌표평면 (실시간)"
            : "내 점만 보여요"}
          {state.reveal ? " · ✨ 그래프 개형 공개!" : ""}
        </p>
        <div className="h-64">
          <InteractiveGraphPlane
            xMin={state.settings.xMin}
            xMax={state.settings.xMax}
            yMin={state.settings.yMin}
            yMax={state.settings.yMax}
            step={state.settings.step}
            points={planePoints}
            curveExpression={state.reveal ? state.expression : null}
            pointSize="sm"
            showNames={false}
            interactive
            className="h-full w-full"
          />
        </div>
      </div>
    </div>
  );
}
