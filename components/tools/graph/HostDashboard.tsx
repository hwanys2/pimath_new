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
import type {
  GraphSettings,
  GraphTeacherState,
} from "@/lib/graph-explorer-types";
import GraphPlane, {
  type PlanePoint,
} from "@/components/tools/graph/GraphPlane";
import {
  colorForParticipant,
  WRONG_POINT_COLOR,
} from "@/components/tools/graph/participant-colors";

const POLL_MS = 1200;

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
      <p className="text-xs font-semibold text-foreground/60">
        QR을 찍고 입장하세요
      </p>
      {dataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={dataUrl}
          alt={`참가 QR코드 (코드 ${joinCode})`}
          className="mx-auto mt-2 w-full max-w-56 rounded-xl"
        />
      ) : (
        <div className="mx-auto mt-2 aspect-square w-full max-w-56 animate-pulse rounded-xl bg-wood/10" />
      )}
      <p className="mt-3 text-xs text-foreground/60">참가코드</p>
      <p className="font-display text-4xl tracking-[0.3em] text-wood-dark">
        {joinCode}
      </p>
      {joinUrl ? (
        <p className="mt-2 break-all text-[11px] text-foreground/50">
          {joinUrl}
        </p>
      ) : null}
    </div>
  );
}

function SettingsPanel({
  state,
  onSaved,
}: {
  state: GraphTeacherState;
  onSaved: () => void;
}) {
  // 설정 편집은 이 패널이 유일한 진입점이므로 최초 상태로만 초기화한다.
  const [draft, setDraft] = useState<GraphSettings>(state.settings);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof GraphSettings>(
    key: K,
    value: GraphSettings[K],
  ) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    await graphUpdateSettingsAction({
      sessionId: state.sessionId,
      settings: draft,
    });
    setSaving(false);
    setDirty(false);
    onSaved();
  };

  return (
    <div className="space-y-3 rounded-2xl border-2 border-wood/15 bg-white p-4">
      <p className="font-display text-sm text-wood-dark">활동 설정</p>

      <div className="grid grid-cols-4 gap-1.5">
        {(
          [
            ["xMin", "x 최소"],
            ["xMax", "x 최대"],
            ["yMin", "y 최소"],
            ["yMax", "y 최대"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="text-[11px] text-foreground/60">
            {label}
            <input
              type="number"
              value={draft[key]}
              onChange={(e) => set(key, Number(e.target.value))}
              className="mt-0.5 w-full rounded-lg border border-wood/20 px-1.5 py-1 text-sm"
            />
          </label>
        ))}
      </div>

      <label className="block text-xs text-foreground/70">
        학생당 점 개수: <b>{draft.maxPointsPerStudent}개</b>
        <input
          type="range"
          min={1}
          max={10}
          value={draft.maxPointsPerStudent}
          onChange={(e) => set("maxPointsPerStudent", Number(e.target.value))}
          className="mt-1 w-full accent-[#8b5e3c]"
        />
      </label>

      <label className="block text-xs text-foreground/70">
        점 크기
        <div className="mt-1 flex gap-1.5">
          {(
            [
              ["sm", "작게"],
              ["md", "보통"],
              ["lg", "크게"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => set("pointSize", v)}
              className={`flex-1 rounded-lg border px-2 py-1 text-xs transition ${
                draft.pointSize === v
                  ? "border-wood bg-wood text-cream"
                  : "border-wood/20 bg-white text-wood-dark hover:bg-wood/10"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </label>

      {(
        [
          ["integersOnly", "정수 순서쌍만 허용"],
          ["showWrongOnBoard", "오답 점도 칠판에 표시"],
          ["showNames", "점 옆에 이름 표시"],
          ["shareBoardWithStudents", "학생 화면에 전체 점 공개"],
          ["hideExpression", "학생에게 함수식 숨기기"],
        ] as const
      ).map(([key, label]) => (
        <label
          key={key}
          className="flex items-center gap-2 text-xs text-foreground/70"
        >
          <input
            type="checkbox"
            checked={draft[key]}
            onChange={(e) => set(key, e.target.checked)}
            className="h-3.5 w-3.5 accent-[#8b5e3c]"
          />
          {label}
        </label>
      ))}

      <button
        type="button"
        onClick={save}
        disabled={!dirty || saving}
        className="font-display w-full rounded-xl bg-wood px-3 py-2 text-sm text-cream transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {saving ? "저장 중…" : dirty ? "설정 적용" : "적용됨"}
      </button>
    </div>
  );
}

export default function HostDashboard({ sessionId }: { sessionId: string }) {
  const [state, setState] = useState<GraphTeacherState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exprDraft, setExprDraft] = useState("");
  const [exprEditing, setExprEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const pollingRef = useRef(false);

  const refresh = useCallback(async () => {
    if (pollingRef.current) return;
    pollingRef.current = true;
    try {
      const res = await graphTeacherPollAction({ sessionId });
      if ("error" in res) {
        setError(res.error);
      } else {
        setError(null);
        setState(res);
      }
    } finally {
      pollingRef.current = false;
    }
  }, [sessionId]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

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
      <div className="mx-auto max-w-md space-y-4 rounded-3xl border-2 border-wood/15 bg-cream p-8 text-center">
        <p className="font-display text-lg text-wood-dark">{error}</p>
        <Link
          href="/tools/graph"
          className="font-display inline-block rounded-xl bg-gold px-4 py-2 text-sm text-[#6b4a00]"
        >
          그래프 탐구 홈으로
        </Link>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="py-20 text-center text-foreground/50">
        불러오는 중…
      </div>
    );
  }

  const correctCount = state.points.filter((p) => p.isCorrect).length;
  const closed = state.status === "closed";

  const toggleReveal = async () => {
    setBusy(true);
    await graphSetRevealAction({ sessionId, reveal: !state.reveal });
    await refresh();
    setBusy(false);
  };

  const clearPoints = async () => {
    if (!window.confirm("모든 점을 지울까요?")) return;
    setBusy(true);
    await graphClearPointsAction({ sessionId });
    await refresh();
    setBusy(false);
  };

  const closeRoom = async () => {
    if (!window.confirm("방을 닫을까요? 학생들은 더 이상 제출할 수 없어요."))
      return;
    setBusy(true);
    await graphCloseAction({ sessionId });
    await refresh();
    setBusy(false);
  };

  const changeExpression = async () => {
    if (!exprValid) return;
    if (
      state.points.length > 0 &&
      !window.confirm(
        "함수식을 바꾸면 지금까지 모인 점이 모두 지워져요. 계속할까요?",
      )
    ) {
      return;
    }
    setBusy(true);
    const res = await graphUpdateExpressionAction({
      sessionId,
      expressionRaw: exprDraft,
    });
    setBusy(false);
    if (!("error" in res)) {
      setExprEditing(false);
      await refresh();
    }
  };

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-wood/15 bg-cream px-5 py-4">
        <div className="flex items-center gap-3">
          {exprEditing ? (
            <div className="flex items-center gap-2">
              <input
                value={exprDraft}
                onChange={(e) => setExprDraft(e.target.value)}
                className={`rounded-xl border-2 bg-white px-3 py-2 font-mono text-lg outline-none ${
                  exprValid ? "border-mint" : "border-red-300"
                }`}
                placeholder="예: y = x^2"
              />
              <button
                type="button"
                onClick={changeExpression}
                disabled={!exprValid || busy}
                className="font-display rounded-xl bg-wood px-3 py-2 text-sm text-cream disabled:opacity-40"
              >
                바꾸기
              </button>
              <button
                type="button"
                onClick={() => setExprEditing(false)}
                className="rounded-xl px-2 py-2 text-sm text-foreground/60"
              >
                취소
              </button>
            </div>
          ) : (
            <>
              <p className="font-display text-2xl text-wood-dark sm:text-3xl">
                {state.settings.hideExpression ? (
                  <span title={state.expressionDisplay}>
                    y = ❓{" "}
                    <span className="text-base text-foreground/50">
                      (학생에게 숨김: {state.expressionDisplay})
                    </span>
                  </span>
                ) : (
                  state.expressionDisplay
                )}
              </p>
              {!closed ? (
                <button
                  type="button"
                  onClick={() => {
                    setExprDraft(state.expressionDisplay);
                    setExprEditing(true);
                  }}
                  className="rounded-lg bg-black/5 px-2 py-1 text-xs text-foreground/60 transition hover:bg-black/10"
                >
                  ✏️ 식 바꾸기
                </button>
              ) : null}
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {closed ? (
            <span className="rounded-full bg-black/10 px-3 py-1.5 text-sm font-semibold text-foreground/60">
              닫힌 방
            </span>
          ) : (
            <>
              <button
                type="button"
                onClick={toggleReveal}
                disabled={busy}
                className={`font-display rounded-xl px-4 py-2.5 text-sm shadow-[0_3px_0_rgba(0,0,0,0.15)] transition active:translate-y-0.5 ${
                  state.reveal
                    ? "bg-black/15 text-foreground/70 hover:bg-black/25"
                    : "bg-gold text-[#6b4a00] hover:brightness-105"
                }`}
              >
                {state.reveal ? "개형 숨기기" : "✨ 그래프 개형 공개"}
              </button>
              <button
                type="button"
                onClick={clearPoints}
                disabled={busy}
                className="font-display rounded-xl bg-black/10 px-3 py-2.5 text-sm text-foreground/70 transition hover:bg-black/20"
              >
                점 지우기
              </button>
              <button
                type="button"
                onClick={closeRoom}
                disabled={busy}
                className="font-display rounded-xl bg-red-100 px-3 py-2.5 text-sm text-red-700 transition hover:bg-red-200"
              >
                방 닫기
              </button>
            </>
          )}
          <Link
            href="/tools/graph"
            className="font-display rounded-xl bg-black/10 px-3 py-2.5 text-sm text-foreground/70 transition hover:bg-black/20"
          >
            새 방
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* 좌표평면 (메인) */}
        <div className="min-w-0 flex-1">
          <div className="overflow-hidden rounded-3xl border-2 border-wood/15 bg-white shadow-sm">
            <GraphPlane
              xMin={state.settings.xMin}
              xMax={state.settings.xMax}
              yMin={state.settings.yMin}
              yMax={state.settings.yMax}
              step={state.settings.step}
              points={planePoints}
              curveExpression={state.reveal ? state.expression : null}
              pointSize={state.settings.pointSize}
              showNames={state.settings.showNames}
              className="block w-full"
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-4 text-sm text-foreground/70">
            <span>
              👥 참가 <b>{state.participants.length}</b>명
            </span>
            <span>
              📍 점 <b>{state.points.length}</b>개
            </span>
            <span>
              ✅ 정답 <b className="text-emerald-600">{correctCount}</b>개
            </span>
            {state.settings.showWrongOnBoard ? (
              <span>
                ❌ 오답{" "}
                <b className="text-red-500">
                  {state.points.length - correctCount}
                </b>
                개
              </span>
            ) : null}
            {state.reveal ? (
              <span className="font-semibold text-amber-600">
                ✨ 개형 공개 중
              </span>
            ) : null}
          </div>
        </div>

        {/* 사이드 패널 */}
        <div className="w-full shrink-0 space-y-4 lg:w-72">
          {!closed && state.joinCode ? (
            <QrCard joinCode={state.joinCode} />
          ) : null}

          <div className="rounded-2xl border-2 border-wood/15 bg-white p-4">
            <p className="font-display text-sm text-wood-dark">
              참가자 ({state.participants.length})
            </p>
            {state.participants.length === 0 ? (
              <p className="mt-2 text-xs text-foreground/50">
                아직 아무도 없어요. QR을 보여주세요!
              </p>
            ) : (
              <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                {state.participants.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: colorForParticipant(p.id) }}
                      />
                      <span className="truncate">{p.name}</span>
                    </span>
                    <span className="shrink-0 text-xs text-foreground/50">
                      {p.correctCount}/{p.pointCount}점
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {state.points.length > 0 ? (
            <div className="rounded-2xl border-2 border-wood/15 bg-white p-4">
              <p className="font-display text-sm text-wood-dark">최근 점</p>
              <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                {[...state.points]
                  .reverse()
                  .slice(0, 12)
                  .map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between gap-2 text-xs"
                    >
                      <span className="min-w-0 truncate">
                        <b>{p.participantName}</b> ({formatCoord(p.x)},{" "}
                        {formatCoord(p.y)}){" "}
                        {p.isCorrect ? (
                          <span className="text-emerald-600">✓</span>
                        ) : (
                          <span className="text-red-500">✗</span>
                        )}
                      </span>
                      {!closed ? (
                        <button
                          type="button"
                          onClick={async () => {
                            await graphRemovePointAction({
                              sessionId,
                              pointId: p.id,
                            });
                            refresh();
                          }}
                          className="shrink-0 rounded px-1.5 py-0.5 text-foreground/40 transition hover:bg-red-50 hover:text-red-500"
                          aria-label="점 삭제"
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
            <SettingsPanel state={state} onSaved={refresh} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
