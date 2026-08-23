"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  graphCreateAnonSessionAction,
  graphCreateSessionAction,
} from "@/app/tools/graph/actions";
import {
  compileExpression,
  normalizeGraphExpression,
} from "@/lib/graph-explorer-math";
import { getOrCreateGuestTeacherKey } from "@/lib/graph-teacher-key";
import {
  DEFAULT_GRAPH_SETTINGS,
  type GraphSettings,
} from "@/lib/graph-explorer-types";
import InteractiveGraphPlane from "@/components/tools/graph/InteractiveGraphPlane";
import MathExpression from "@/components/tools/graph/MathExpression";
import { expressionDisplayToLatex } from "@/lib/graph-expression-latex";

type Preset = {
  label: string;
  grade: string;
  expression: string;
  settings?: Partial<GraphSettings>;
};

const PRESETS: Preset[] = [
  { label: "정비례 y = 2x", grade: "중1", expression: "y = 2x", settings: { integersOnly: true, xMin: -5, xMax: 5, yMin: -10, yMax: 10 } },
  { label: "반비례 y = 6/x", grade: "중1", expression: "y = 6/x", settings: { xMin: -8, xMax: 8, yMin: -8, yMax: 8 } },
  { label: "일차 y = 2x + 1", grade: "중2", expression: "y = 2x + 1", settings: { integersOnly: true, xMin: -5, xMax: 5, yMin: -10, yMax: 10 } },
  { label: "이차 y = x²", grade: "중3", expression: "y = x^2", settings: { xMin: -5, xMax: 5, yMin: -2, yMax: 20 } },
  { label: "이차 y = (x-1)² - 4", grade: "중3", expression: "y = (x-1)^2 - 4", settings: { xMin: -5, xMax: 7, yMin: -6, yMax: 12 } },
];

const RANGE_PRESETS = [
  { label: "-5 ~ 5", view: { xMin: -5, xMax: 5, yMin: -5, yMax: 5 } },
  { label: "-10 ~ 10", view: { xMin: -10, xMax: 10, yMin: -10, yMax: 10 } },
  { label: "-20 ~ 20", view: { xMin: -20, xMax: 20, yMin: -20, yMax: 20 } },
];

export default function CreateRoomClient({
  mode,
  activeSessionId,
  onCreated,
}: {
  mode: "auth" | "anon";
  activeSessionId?: string | null;
  onCreated?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [expressionRaw, setExpressionRaw] = useState("y = 2x + 1");
  const [settings, setSettings] = useState<GraphSettings>({ ...DEFAULT_GRAPH_SETTINGS });
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(mode === "anon");

  const normalized = normalizeGraphExpression(expressionRaw);
  const compiled = useMemo(
    () => (normalized ? compileExpression(normalized) : null),
    [normalized],
  );
  const valid = compiled != null;
  const previewLatex = valid
    ? expressionDisplayToLatex(
        /^(y\s*=|f\s*\(\s*x\s*\)\s*=)/i.test(expressionRaw.trim())
          ? expressionRaw.trim()
          : `y = ${normalized}`,
      )
    : null;

  const set = <K extends keyof GraphSettings>(key: K, value: GraphSettings[K]) =>
    setSettings((s) => ({ ...s, [key]: value }));

  const applyPreset = (preset: Preset) => {
    setExpressionRaw(preset.expression);
    setSettings((s) => ({
      ...DEFAULT_GRAPH_SETTINGS,
      ...preset.settings,
      showWrongOnBoard: s.showWrongOnBoard,
      showNames: s.showNames,
      shareBoardWithStudents: s.shareBoardWithStudents,
      hideExpression: s.hideExpression,
      pointSize: s.pointSize,
      unlimitedPoints: s.unlimitedPoints,
    }));
    setExpanded(true);
  };

  const create = () => {
    setError(null);
    if (mode === "auth" && !title.trim()) {
      setError("방 제목을 입력해 주세요.");
      return;
    }
    if (!valid) {
      setError("함수식을 확인해 주세요.");
      return;
    }
    startTransition(async () => {
      if (mode === "auth") {
        const res = await graphCreateSessionAction({ title: title.trim(), expressionRaw, settings });
        if ("error" in res) {
          setError(res.error ?? "방을 만들지 못했어요.");
          return;
        }
        onCreated?.();
        router.push(`/tools/graph/host/${res.sessionId}`);
      } else {
        const key = getOrCreateGuestTeacherKey();
        const res = await graphCreateAnonSessionAction({
          guestTeacherKey: key,
          expressionRaw,
          settings,
        });
        if ("error" in res) {
          setError(res.error ?? "방을 만들지 못했어요.");
          return;
        }
        router.push(`/tools/graph/host/${res.sessionId}`);
      }
    });
  };

  if (mode === "auth" && !expanded) {
    return (
      <div className="text-center">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="font-display rounded-2xl bg-gold px-8 py-3 text-lg text-[#6b4a00] shadow-[0_4px_0_rgba(107,74,0,0.3)] transition hover:brightness-105"
        >
          + 새 방 만들기
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {mode === "anon" && activeSessionId ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-gold/60 bg-gold/15 px-5 py-4">
          <p className="text-sm text-foreground/80">
            진행 중인 방이 있어요.{" "}
            <span className="text-foreground/60">(새 방을 만들면 기존 방은 자동으로 닫혀요)</span>
          </p>
          <Link
            href={`/tools/graph/host/${activeSessionId}`}
            className="font-display rounded-xl bg-gold px-4 py-2 text-sm text-[#6b4a00]"
          >
            이어서 →
          </Link>
        </div>
      ) : null}

      {mode === "auth" ? (
        <div className="rounded-3xl border-2 border-wood/15 bg-cream p-6">
          <h2 className="font-display text-xl text-wood-dark">방 제목</h2>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 2학년 3반 일차함수 탐구"
            maxLength={60}
            className="mt-3 w-full rounded-2xl border-2 border-wood/20 bg-white px-4 py-3 text-lg outline-none focus:border-wood/50"
          />
        </div>
      ) : null}

      <div className="rounded-3xl border-2 border-wood/15 bg-cream p-6 sm:p-8">
        <h2 className="font-display text-xl text-wood-dark">탐구할 함수식</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button key={p.label} type="button" onClick={() => applyPreset(p)} className="rounded-full border border-wood/25 bg-white px-3 py-1.5 text-sm">
              <span className="mr-1 rounded-full bg-wood/10 px-1.5 py-0.5 text-[10px] font-bold">{p.grade}</span>
              {p.label}
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row">
          <div className="flex-1">
            <input
              value={expressionRaw}
              onChange={(e) => setExpressionRaw(e.target.value)}
              className={`w-full rounded-2xl border-2 bg-white px-4 py-3 font-mono text-xl outline-none ${valid ? "border-mint" : "border-red-300"}`}
            />
            {valid && previewLatex ? (
              <div className="mt-2 rounded-xl bg-white/80 px-3 py-2">
                <MathExpression latex={previewLatex} className="text-lg" />
              </div>
            ) : null}
          </div>
          <div className="h-48 w-full shrink-0 overflow-hidden rounded-2xl border-2 border-wood/15 bg-white sm:w-56">
            <InteractiveGraphPlane
              xMin={settings.xMin}
              xMax={settings.xMax}
              yMin={settings.yMin}
              yMax={settings.yMax}
              step={settings.step}
              points={[]}
              curveExpression={valid ? normalized : null}
              pointSize="sm"
              interactive={false}
              className="h-full w-full"
            />
          </div>
        </div>
      </div>

      <div className="rounded-3xl border-2 border-wood/15 bg-cream p-6 sm:p-8">
        <h2 className="font-display text-xl text-wood-dark">활동 설정</h2>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <div>
            <p className="text-sm font-semibold text-foreground/80">좌표 범위 (초기 화면)</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {RANGE_PRESETS.map((rp) => (
                <button
                  key={rp.label}
                  type="button"
                  onClick={() => setSettings((s) => ({ ...s, ...rp.view }))}
                  className="rounded-full border border-wood/25 bg-white px-3 py-1 text-sm hover:bg-wood/10"
                >
                  {rp.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-foreground/50">
              교사 대시보드에서 드래그·줌으로 범위를 자유롭게 볼 수 있어요.
            </p>
          </div>
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={settings.unlimitedPoints} onChange={(e) => set("unlimitedPoints", e.target.checked)} className="h-4 w-4 accent-[#8b5e3c]" />
              점 개수 제한 없음
            </label>
            {!settings.unlimitedPoints ? (
              <label className="block text-sm">
                학생당 {settings.maxPointsPerStudent}개
                <input type="range" min={1} max={10} value={settings.maxPointsPerStudent} onChange={(e) => set("maxPointsPerStudent", Number(e.target.value))} className="mt-1 w-full accent-[#8b5e3c]" />
              </label>
            ) : null}
            {(
              [
                ["integersOnly", "정수만"],
                ["showWrongOnBoard", "오답도 표시"],
                ["showNames", "이름 표시"],
                ["shareBoardWithStudents", "학생에게 전체 점 공개"],
                ["hideExpression", "함수식 숨기기"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={settings[key]} onChange={(e) => set(key, e.target.checked)} className="h-4 w-4 accent-[#8b5e3c]" />
                {label}
              </label>
            ))}
          </div>
        </div>
      </div>

      {error ? <p className="text-center text-sm font-semibold text-red-500">{error}</p> : null}

      <div className="flex justify-center gap-3">
        {mode === "auth" ? (
          <button type="button" onClick={() => setExpanded(false)} className="font-display rounded-2xl bg-black/10 px-6 py-3 text-sm">
            취소
          </button>
        ) : null}
        <button
          type="button"
          onClick={create}
          disabled={pending || !valid}
          className="font-display rounded-2xl bg-gold px-10 py-4 text-lg text-[#6b4a00] shadow-[0_4px_0_rgba(107,74,0,0.3)] disabled:opacity-50"
        >
          {pending ? "만드는 중…" : "방 만들기 (QR 생성)"}
        </button>
      </div>
    </div>
  );
}
