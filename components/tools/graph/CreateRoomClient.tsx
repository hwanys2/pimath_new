"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { graphCreateSessionAction } from "@/app/tools/graph/actions";
import {
  compileExpression,
  normalizeGraphExpression,
} from "@/lib/graph-explorer-math";
import {
  DEFAULT_GRAPH_SETTINGS,
  type GraphSettings,
} from "@/lib/graph-explorer-types";
import GraphPlane from "@/components/tools/graph/GraphPlane";

type Preset = {
  label: string;
  grade: string;
  expression: string;
  settings?: Partial<GraphSettings>;
};

const PRESETS: Preset[] = [
  {
    label: "정비례 y = 2x",
    grade: "중1",
    expression: "y = 2x",
    settings: { integersOnly: true, xMin: -5, xMax: 5, yMin: -10, yMax: 10 },
  },
  {
    label: "반비례 y = 6/x",
    grade: "중1",
    expression: "y = 6/x",
    settings: { xMin: -8, xMax: 8, yMin: -8, yMax: 8 },
  },
  {
    label: "일차함수 y = 2x + 1",
    grade: "중2",
    expression: "y = 2x + 1",
    settings: { integersOnly: true, xMin: -5, xMax: 5, yMin: -10, yMax: 10 },
  },
  {
    label: "이차함수 y = x²",
    grade: "중3",
    expression: "y = x^2",
    settings: { xMin: -5, xMax: 5, yMin: -2, yMax: 20 },
  },
  {
    label: "이차함수 y = (x-1)² - 4",
    grade: "중3",
    expression: "y = (x-1)^2 - 4",
    settings: { xMin: -5, xMax: 7, yMin: -6, yMax: 12 },
  },
];

const RANGE_PRESETS: {
  label: string;
  view: Pick<GraphSettings, "xMin" | "xMax" | "yMin" | "yMax">;
}[] = [
  { label: "-5 ~ 5", view: { xMin: -5, xMax: 5, yMin: -5, yMax: 5 } },
  { label: "-10 ~ 10", view: { xMin: -10, xMax: 10, yMin: -10, yMax: 10 } },
  { label: "-20 ~ 20", view: { xMin: -20, xMax: 20, yMin: -20, yMax: 20 } },
];

export default function CreateRoomClient({
  activeSessionId,
}: {
  activeSessionId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [expressionRaw, setExpressionRaw] = useState("y = 2x + 1");
  const [settings, setSettings] = useState<GraphSettings>({
    ...DEFAULT_GRAPH_SETTINGS,
  });
  const [error, setError] = useState<string | null>(null);

  const normalized = normalizeGraphExpression(expressionRaw);
  const compiled = useMemo(
    () => (normalized ? compileExpression(normalized) : null),
    [normalized],
  );
  const valid = compiled != null;

  const applyPreset = (preset: Preset) => {
    setExpressionRaw(preset.expression);
    setSettings((s) => ({
      ...DEFAULT_GRAPH_SETTINGS,
      ...preset.settings,
      // 표시/공유 관련 기존 선택은 유지
      showWrongOnBoard: s.showWrongOnBoard,
      showNames: s.showNames,
      shareBoardWithStudents: s.shareBoardWithStudents,
      hideExpression: s.hideExpression,
      pointSize: s.pointSize,
    }));
  };

  const set = <K extends keyof GraphSettings>(
    key: K,
    value: GraphSettings[K],
  ) => setSettings((s) => ({ ...s, [key]: value }));

  const create = () => {
    setError(null);
    if (!valid) {
      setError("함수식을 확인해 주세요. 예: y = 2x + 1, y = x^2, y = 6/x");
      return;
    }
    startTransition(async () => {
      const res = await graphCreateSessionAction({
        expressionRaw,
        settings,
      });
      if ("error" in res) {
        setError(res.error ?? "방을 만들지 못했어요.");
        return;
      }
      router.push(`/tools/graph/host/${res.sessionId}`);
    });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {activeSessionId ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-gold/60 bg-gold/15 px-5 py-4">
          <p className="text-sm text-foreground/80">
            진행 중인 방이 있어요. 이어서 진행할까요?{" "}
            <span className="text-foreground/60">
              (새 방을 만들면 기존 방은 자동으로 닫혀요)
            </span>
          </p>
          <Link
            href={`/tools/graph/host/${activeSessionId}`}
            className="font-display rounded-xl bg-gold px-4 py-2 text-sm text-[#6b4a00] shadow-[0_3px_0_rgba(107,74,0,0.3)] transition hover:brightness-105"
          >
            이어서 진행 →
          </Link>
        </div>
      ) : null}

      <div className="rounded-3xl border-2 border-wood/15 bg-cream p-6 sm:p-8">
        <h2 className="font-display text-xl text-wood-dark">
          1. 탐구할 함수식
        </h2>

        <div className="mt-3 flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => applyPreset(p)}
              className="rounded-full border border-wood/25 bg-white px-3 py-1.5 text-sm text-wood-dark transition hover:bg-wood/10"
            >
              <span className="mr-1.5 rounded-full bg-wood/10 px-1.5 py-0.5 text-[10px] font-bold text-wood">
                {p.grade}
              </span>
              {p.label}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-4 sm:flex-row">
          <div className="flex-1">
            <input
              value={expressionRaw}
              onChange={(e) => setExpressionRaw(e.target.value)}
              placeholder="예: y = 2x + 1"
              className={`w-full rounded-2xl border-2 bg-white px-4 py-3 font-mono text-xl outline-none transition ${
                valid
                  ? "border-mint focus:border-emerald-400"
                  : "border-red-300 focus:border-red-400"
              }`}
            />
            <p className="mt-2 text-xs text-foreground/60">
              사용 가능: + − × ÷ ^ 괄호, 분수(6/x), 제곱(x^2), sqrt, abs 등
              {!valid ? (
                <span className="ml-2 font-semibold text-red-500">
                  식을 이해하지 못했어요
                </span>
              ) : null}
            </p>
          </div>
          <div className="w-full shrink-0 overflow-hidden rounded-2xl border-2 border-wood/15 bg-white sm:w-56">
            <p className="border-b border-wood/10 px-3 py-1.5 text-xs font-semibold text-foreground/60">
              미리보기 (교사만 보여요)
            </p>
            <GraphPlane
              xMin={settings.xMin}
              xMax={settings.xMax}
              yMin={settings.yMin}
              yMax={settings.yMax}
              step={settings.step}
              points={[]}
              curveExpression={valid ? normalized : null}
              pointSize="sm"
              className="block w-full"
            />
          </div>
        </div>
      </div>

      <div className="rounded-3xl border-2 border-wood/15 bg-cream p-6 sm:p-8">
        <h2 className="font-display text-xl text-wood-dark">2. 활동 설정</h2>

        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <div>
            <p className="text-sm font-semibold text-foreground/80">
              좌표 범위
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {RANGE_PRESETS.map((rp) => (
                <button
                  key={rp.label}
                  type="button"
                  onClick={() => setSettings((s) => ({ ...s, ...rp.view }))}
                  className={`rounded-full border px-3 py-1 text-sm transition ${
                    settings.xMin === rp.view.xMin &&
                    settings.xMax === rp.view.xMax &&
                    settings.yMin === rp.view.yMin &&
                    settings.yMax === rp.view.yMax
                      ? "border-wood bg-wood text-cream"
                      : "border-wood/25 bg-white text-wood-dark hover:bg-wood/10"
                  }`}
                >
                  {rp.label}
                </button>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {(
                [
                  ["xMin", "x 최소"],
                  ["xMax", "x 최대"],
                  ["yMin", "y 최소"],
                  ["yMax", "y 최대"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="text-xs text-foreground/60">
                  {label}
                  <input
                    type="number"
                    value={settings[key]}
                    onChange={(e) => set(key, Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-wood/20 bg-white px-2 py-1.5 text-sm"
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-semibold text-foreground/80">
              학생당 제출 점 개수:{" "}
              <span className="font-display text-wood-dark">
                {settings.maxPointsPerStudent}개
              </span>
              <input
                type="range"
                min={1}
                max={10}
                value={settings.maxPointsPerStudent}
                onChange={(e) =>
                  set("maxPointsPerStudent", Number(e.target.value))
                }
                className="mt-1 w-full accent-[#8b5e3c]"
              />
            </label>

            <label className="flex items-center gap-2 text-sm text-foreground/80">
              <input
                type="checkbox"
                checked={settings.integersOnly}
                onChange={(e) => set("integersOnly", e.target.checked)}
                className="h-4 w-4 accent-[#8b5e3c]"
              />
              정수 순서쌍만 허용 (순서쌍 도입 단계 추천)
            </label>

            <label className="flex items-center gap-2 text-sm text-foreground/80">
              <input
                type="checkbox"
                checked={settings.showWrongOnBoard}
                onChange={(e) => set("showWrongOnBoard", e.target.checked)}
                className="h-4 w-4 accent-[#8b5e3c]"
              />
              오답 점도 칠판에 표시 (오개념 토론 재료로 활용)
            </label>

            <label className="flex items-center gap-2 text-sm text-foreground/80">
              <input
                type="checkbox"
                checked={settings.showNames}
                onChange={(e) => set("showNames", e.target.checked)}
                className="h-4 w-4 accent-[#8b5e3c]"
              />
              점 옆에 학생 이름 표시
            </label>

            <label className="flex items-center gap-2 text-sm text-foreground/80">
              <input
                type="checkbox"
                checked={settings.shareBoardWithStudents}
                onChange={(e) =>
                  set("shareBoardWithStudents", e.target.checked)
                }
                className="h-4 w-4 accent-[#8b5e3c]"
              />
              학생 화면에도 전체 점 공개
            </label>

            <label className="flex items-center gap-2 text-sm text-foreground/80">
              <input
                type="checkbox"
                checked={settings.hideExpression}
                onChange={(e) => set("hideExpression", e.target.checked)}
                className="h-4 w-4 accent-[#8b5e3c]"
              />
              학생에게 함수식 숨기기 (규칙 추측 역탐구 모드)
            </label>
          </div>
        </div>
      </div>

      {error ? (
        <p className="text-center text-sm font-semibold text-red-500">
          {error}
        </p>
      ) : null}

      <div className="text-center">
        <button
          type="button"
          onClick={create}
          disabled={pending || !valid}
          className="font-display rounded-2xl bg-gold px-10 py-4 text-lg text-[#6b4a00] shadow-[0_4px_0_rgba(107,74,0,0.3)] transition hover:brightness-105 active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "방 만드는 중…" : "🚀 방 만들기 (QR 생성)"}
        </button>
      </div>
    </div>
  );
}
