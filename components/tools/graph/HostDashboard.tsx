"use client";

import Link from "next/link";
import QRCode from "qrcode";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  graphClearPointsAction,
  graphCloseAction,
  graphRemovePointAction,
  graphSetRevealAction,
  graphTeacherPollAction,
  graphUpdateExpressionAction,
  graphUpdateSettingsAction,
} from "@/app/tools/graph/actions";
import {
  compileExpression,
  formatCoord,
  normalizeGraphExpression,
} from "@/lib/graph-explorer-math";
import { getOrCreateGuestTeacherKey } from "@/lib/graph-teacher-key";
import type {
  GraphSettings,
  GraphTeacherState,
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

function QrCard({ joinCode }: { joinCode: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [joinUrl, setJoinUrl] = useState("");

  useEffect(() => {
    const url = `${window.location.origin}/tools/graph/join?code=${joinCode}`;
    let cancelled = false;
    QRCode.toDataURL(url, { width: 480, margin: 1 })
      .then((d) => {
        if (cancelled) return;
        setJoinUrl(url);
        setDataUrl(d);
      })
      .catch(() => {
        if (cancelled) return;
        setJoinUrl(url);
        setDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [joinCode]);

  return (
    <div className="rounded-2xl border-2 border-wood/15 bg-white p-4 text-center">
      <p className="text-xs font-semibold text-foreground/60">QR을 찍고 입장</p>
      {dataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={dataUrl}
          alt={`참가 QR (코드 ${joinCode})`}
          className="mx-auto mt-2 w-full max-w-48 rounded-xl"
        />
      ) : (
        <div className="mx-auto mt-2 aspect-square w-full max-w-48 animate-pulse rounded-xl bg-wood/10" />
      )}
      <p className="mt-3 text-xs text-foreground/60">참가코드</p>
      <p className="font-display text-3xl tracking-[0.3em] text-wood-dark">
        {joinCode}
      </p>
      {joinUrl ? (
        <p className="mt-2 break-all text-[10px] text-foreground/50">{joinUrl}</p>
      ) : null}
    </div>
  );
}

function SettingsPanel({
  state,
  guestTeacherKey,
  onSaved,
}: {
  state: GraphTeacherState;
  guestTeacherKey: string | null;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<GraphSettings>(state.settings);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!dirty) setDraft(state.settings);
  }, [state.settings, dirty]);

  const set = <K extends keyof GraphSettings>(key: K, value: GraphSettings[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    await graphUpdateSettingsAction({
      sessionId: state.sessionId,
      settings: draft,
      guestTeacherKey,
    });
    setSaving(false);
    setDirty(false);
    onSaved();
  };

  return (
    <div className="space-y-3 rounded-2xl border-2 border-wood/15 bg-white p-4">
      <p className="font-display text-sm text-wood-dark">활동 설정</p>

      <label className="flex items-center gap-2 text-xs text-foreground/70">
        <input
          type="checkbox"
          checked={draft.unlimitedPoints}
          onChange={(e) => set("unlimitedPoints", e.target.checked)}
          className="h-3.5 w-3.5 accent-[#8b5e3c]"
        />
        점 개수 제한 없음
      </label>

      {!draft.unlimitedPoints ? (
        <label className="block text-xs text-foreground/70">
          학생당 점: <b>{draft.maxPointsPerStudent}개</b>
          <input
            type="range"
            min={1}
            max={10}
            value={draft.maxPointsPerStudent}
            onChange={(e) => set("maxPointsPerStudent", Number(e.target.value))}
            className="mt-1 w-full accent-[#8b5e3c]"
          />
        </label>
      ) : null}

      {(
        [
          ["integersOnly", "정수만"],
          ["showWrongOnBoard", "오답도 표시"],
          ["showNames", "이름 표시"],
          ["shareBoardWithStudents", "학생에게 전체 점 공개"],
          ["hideExpression", "함수식 숨기기"],
          ["allowDuplicatePoints", "중복 점 허용"],
        ] as const
      ).map(([key, label]) => (
        <label key={key} className="flex items-center gap-2 text-xs text-foreground/70">
          <input
            type="checkbox"
            checked={draft[key]}
            onChange={(e) => set(key, e.target.checked)}
            className="h-3.5 w-3.5 accent-[#8b5e3c]"
          />
          {label}
        </label>
      ))}
      {!draft.allowDuplicatePoints ? (
        <p className="text-[11px] leading-snug text-foreground/50">
          꺼 두면 이미 칠판에 찍힌 좌표는 다른 학생이 다시 제출할 수 없어요.
        </p>
      ) : null}

      <button
        type="button"
        onClick={save}
        disabled={!dirty || saving}
        className="font-display w-full rounded-xl bg-wood px-3 py-2 text-sm text-cream disabled:opacity-40"
      >
        {saving ? "저장 중…" : dirty ? "설정 적용" : "적용됨"}
      </button>
    </div>
  );
}

export default function HostDashboard({
  sessionId,
  isLoggedInTeacher,
}: {
  sessionId: string;
  isLoggedInTeacher: boolean;
}) {
  const [guestTeacherKey, setGuestTeacherKey] = useState<string | null>(null);
  const [state, setState] = useState<GraphTeacherState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exprDraft, setExprDraft] = useState("");
  const [exprEditing, setExprEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const pollingRef = useRef(false);

  useEffect(() => {
    if (!isLoggedInTeacher) {
      setGuestTeacherKey(getOrCreateGuestTeacherKey());
    }
  }, [isLoggedInTeacher]);

  const ownerKey = isLoggedInTeacher ? null : guestTeacherKey;

  const refresh = useCallback(async () => {
    if (!isLoggedInTeacher && !guestTeacherKey) return;
    if (pollingRef.current) return;
    pollingRef.current = true;
    try {
      const res = await graphTeacherPollAction({
        sessionId,
        guestTeacherKey: ownerKey,
      });
      if ("error" in res) setError(res.error);
      else {
        setError(null);
        setState(res);
      }
    } finally {
      pollingRef.current = false;
    }
  }, [sessionId, ownerKey, isLoggedInTeacher, guestTeacherKey]);

  const syncSession = useCallback(async () => {
    await notifySessionChanged(sessionId);
    await refresh();
  }, [sessionId, refresh]);

  useSessionPoll(sessionId, () => {
    void refresh();
  });

  const planePoints: PlanePoint[] = useMemo(() => {
    if (!state) return [];
    return state.points
      .filter((p) => p.isCorrect || state.settings.showWrongOnBoard)
      .map((p) => ({
        id: p.id,
        x: p.x,
        y: p.y,
        color: p.isCorrect
          ? colorForParticipant(p.participantId)
          : WRONG_POINT_COLOR,
        label: p.participantName,
        isCorrect: p.isCorrect,
      }));
  }, [state]);

  const exprValid = useMemo(() => {
    const n = normalizeGraphExpression(exprDraft);
    return n.length > 0 && compileExpression(n) != null;
  }, [exprDraft]);

  if (error && !state) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="max-w-md space-y-4 rounded-3xl border-2 border-wood/15 bg-cream p-8 text-center">
          <p className="font-display text-lg text-wood-dark">{error}</p>
          <Link href="/tools/graph" className="font-display inline-block rounded-xl bg-gold px-4 py-2 text-sm text-[#6b4a00]">
            그래프 탐구 홈
          </Link>
        </div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="flex flex-1 items-center justify-center text-foreground/50">
        불러오는 중…
      </div>
    );
  }

  const closed = state.status === "closed";
  const correctCount = state.points.filter((p) => p.isCorrect).length;

  const withGuest = { guestTeacherKey: ownerKey };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* toolbar */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-wood/15 bg-cream px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="font-display truncate text-lg text-wood-dark sm:text-xl">
            {state.title}
          </p>
          {exprEditing && !closed ? (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <input
                value={exprDraft}
                onChange={(e) => setExprDraft(e.target.value)}
                className={`rounded-lg border-2 bg-white px-2 py-1 font-mono text-sm ${exprValid ? "border-mint" : "border-red-300"}`}
              />
              <button
                type="button"
                disabled={!exprValid || busy}
                onClick={async () => {
                  setBusy(true);
                  await graphUpdateExpressionAction({
                    sessionId,
                    expressionRaw: exprDraft,
                    ...withGuest,
                  });
                  setBusy(false);
                  setExprEditing(false);
                  void syncSession();
                }}
                className="rounded-lg bg-wood px-2 py-1 text-xs text-cream disabled:opacity-40"
              >
                적용
              </button>
              <button type="button" onClick={() => setExprEditing(false)} className="text-xs text-foreground/50">
                취소
              </button>
            </div>
          ) : (
            <div className="mt-0.5 flex items-center gap-2">
              {state.settings.hideExpression && !state.reveal ? (
                <span className="font-display text-xl text-wood-dark">y = ❓</span>
              ) : (
                <MathExpression
                  display={state.expressionDisplay}
                  latex={state.expressionLatex}
                  className="text-xl sm:text-2xl"
                />
              )}
              {!closed ? (
                <button
                  type="button"
                  onClick={() => {
                    setExprDraft(state.expressionDisplay);
                    setExprEditing(true);
                  }}
                  className="rounded bg-black/5 px-1.5 py-0.5 text-[10px] text-foreground/60"
                >
                  ✏️
                </button>
              ) : null}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {closed ? (
            <span className="rounded-full bg-black/10 px-3 py-1 text-xs font-semibold">기록 (닫힘)</span>
          ) : (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  await graphSetRevealAction({ sessionId, reveal: !state.reveal, ...withGuest });
                  setBusy(false);
                  void syncSession();
                }}
                className={`font-display rounded-xl px-3 py-2 text-xs sm:text-sm ${state.reveal ? "bg-black/15 text-foreground/70" : "bg-gold text-[#6b4a00]"}`}
              >
                {state.reveal ? "개형 숨기기" : "✨ 개형 공개"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  if (!window.confirm("모든 점을 지울까요?")) return;
                  setBusy(true);
                  await graphClearPointsAction({ sessionId, ...withGuest });
                  setBusy(false);
                  void syncSession();
                }}
                className="rounded-xl bg-black/10 px-2 py-2 text-xs text-foreground/70"
              >
                점 지우기
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  if (!window.confirm("방을 닫을까요?")) return;
                  setBusy(true);
                  await graphCloseAction({ sessionId, ...withGuest });
                  setBusy(false);
                  void syncSession();
                }}
                className="rounded-xl bg-red-100 px-2 py-2 text-xs text-red-700"
              >
                방 닫기
              </button>
            </>
          )}
          <Link href="/tools/graph" className="rounded-xl bg-black/10 px-2 py-2 text-xs text-foreground/70">
            목록
          </Link>
        </div>
      </div>

      {/* body */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="relative min-h-0 min-w-0 flex-1 bg-cream">
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
          <div className="pointer-events-none absolute bottom-2 left-0 right-0 flex flex-wrap justify-center gap-3 text-xs text-foreground/70">
            <span>👥 {state.participants.length}명</span>
            <span>📍 {state.points.length}점</span>
            <span>✅ {correctCount}</span>
            {state.reveal ? <span className="font-semibold text-amber-600">개형 공개</span> : null}
          </div>
          <p className="pointer-events-none absolute left-2 top-2 rounded bg-black/5 px-2 py-0.5 text-[10px] text-foreground/50">
            드래그 이동 · 휠 확대/축소
          </p>
        </div>

        <aside className="w-full shrink-0 overflow-y-auto border-t border-wood/15 bg-cream/80 p-3 lg:w-72 lg:border-l lg:border-t-0">
          {!closed && state.joinCode ? <QrCard joinCode={state.joinCode} /> : null}

          <div className="mt-3 rounded-2xl border-2 border-wood/15 bg-white p-3">
            <p className="font-display text-sm text-wood-dark">
              참가자 ({state.participants.length})
            </p>
            <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto text-sm">
              {state.participants.map((p) => (
                <li key={p.id} className="flex justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1.5 truncate">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: colorForParticipant(p.id) }} />
                    {p.name}
                  </span>
                  <span className="shrink-0 text-xs text-foreground/50">
                    {p.correctCount}/{p.pointCount}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {state.points.length > 0 ? (
            <div className="mt-3 rounded-2xl border-2 border-wood/15 bg-white p-3">
              <p className="font-display text-sm text-wood-dark">
                {closed ? "전체 점 기록" : "최근 점"}
              </p>
              <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs">
                {(closed ? state.points : [...state.points].reverse().slice(0, 15)).map((p) => (
                  <li key={p.id} className="flex justify-between gap-2">
                    <span className="min-w-0 truncate">
                      <b>{p.participantName}</b> ({formatCoord(p.x)}, {formatCoord(p.y)}){" "}
                      {p.isCorrect ? "✓" : "✗"}
                    </span>
                    {!closed ? (
                      <button
                        type="button"
                        onClick={async () => {
                          await graphRemovePointAction({
                            sessionId,
                            pointId: p.id,
                            ...withGuest,
                          });
                          void syncSession();
                        }}
                        className="shrink-0 text-foreground/40 hover:text-red-500"
                      >
                        삭제
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {!closed ? (
            <div className="mt-3">
              <SettingsPanel state={state} guestTeacherKey={ownerKey} onSaved={() => void syncSession()} />
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
