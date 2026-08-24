"use client";

import {
  isTableStep,
  scoreForAttempts,
  TABLE_ANGLES,
  type HeightScene,
  type SoftNotice,
  type TangentWorkspace,
} from "@/lib/inquiry-tangent-intro";
import GeometrySketchpad from "./GeometrySketchpad";
import HeightSceneView from "./HeightSceneView";
import InquiryCalculator from "@/components/inquiry/InquiryCalculator";

function softMessage(notice: SoftNotice, table: boolean): string {
  switch (notice.reason) {
    case "incomplete":
      return table
        ? "여덟 칸을 모두 채워 주세요."
        : "높이를 입력해 주세요.";
    case "incomplete_method":
      return "어떻게 계산했는지 적어 주세요.";
    case "invalid":
      return "양의 수를 입력해 주세요. (예: 24 또는 1.73)";
    case "wrong":
      return table
        ? "색이 표시된 칸을 다시 재어 보세요."
        : "다시 재어 보세요. 그린 삼각형의 비를 실제 거리에 곱하면 돼요.";
  }
}

type Props = {
  scene: HeightScene | null;
  stepIndex: number;
  stepCount: number;
  workspace: TangentWorkspace;
  onWorkspaceChange: (ws: TangentWorkspace) => void;
  readOnly?: boolean;
  hostPreview?: boolean;
  disabled?: boolean;
  wrongAttempts?: number;
  softNotice?: SoftNotice | null;
  submitted?: boolean;
  submitFeedback?: "correct" | "wrong" | null;
  onSubmit?: () => void;
};

export default function InquiryTangentIntroStep({
  scene,
  stepIndex,
  stepCount,
  workspace,
  onWorkspaceChange,
  readOnly = false,
  hostPreview = false,
  disabled = false,
  wrongAttempts = 0,
  softNotice = null,
  submitted = false,
  submitFeedback = null,
  onSubmit,
}: Props) {
  const table = isTableStep(stepIndex);
  const interactive = hostPreview || !readOnly;
  const locked = !interactive || disabled;
  const projected = scoreForAttempts(wrongAttempts);
  const showScoreBar = !readOnly && !hostPreview;
  const wrongSet = new Set(softNotice?.wrongAngles ?? []);
  const methodMarked = softNotice?.reason === "incomplete_method";

  return (
    <section className="quest-card-static p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm font-bold text-wood">
        <span className="rounded-xl bg-lavender/40 px-3 py-1 tabular-nums">
          {table ? "표로 정리" : scene?.title} · {stepIndex + 1}/{stepCount}
        </span>
        {hostPreview ? (
          <span className="rounded-xl bg-lavender/45 px-3 py-1 text-xs font-bold text-wood">
            시연 모드 — 장면과 작도판을 조작하며 설명할 수 있어요
          </span>
        ) : null}
        {showScoreBar ? (
          <span className="rounded-xl bg-sky/40 px-3 py-1 tabular-nums">
            오답 {wrongAttempts}회
            <span className="ml-1 font-semibold text-wood/55">
              · 맞히면 {projected}점
            </span>
          </span>
        ) : null}
      </div>

      <p className="mt-3 text-sm font-semibold text-foreground/75">
        {table
          ? "같은 일을 여러 번 하니 번거롭지요. 각마다 높이÷밑변을 표로 모아 봅시다. 오른쪽에서 직각삼각형을 그려 값을 채워 보세요. 밑변을 10칸으로 두면 높이가 곧 (비)×10이라 계산이 편하고, 각이 크면 밑변을 짧게 그리세요."
          : scene?.prompt}
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="relative min-w-0">
          <div className="mb-2 flex justify-end">
            <InquiryCalculator />
          </div>
          {table ? (
            <div className="overflow-hidden rounded-2xl border-2 border-wood/15 bg-cream/70">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-wood/15 bg-lavender/30 text-wood">
                    <th className="px-3 py-2 text-left font-bold">각</th>
                    <th className="px-3 py-2 text-left font-bold">높이 ÷ 밑변</th>
                  </tr>
                </thead>
                <tbody>
                  {TABLE_ANGLES.map((angle) => {
                    const marked =
                      (softNotice?.reason === "incomplete" &&
                        !(workspace.ratios[String(angle)] ?? "").trim()) ||
                      wrongSet.has(angle);
                    return (
                      <tr key={angle} className="border-b border-wood/8">
                        <td className="px-3 py-1.5 font-bold tabular-nums text-wood">
                          {angle}°
                        </td>
                        <td className="px-3 py-1.5">
                          <input
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            spellCheck={false}
                            disabled={locked}
                            aria-label={`${angle}도에서 높이 나누기 밑변`}
                            value={workspace.ratios[String(angle)] ?? ""}
                            onChange={(e) =>
                              onWorkspaceChange({
                                ...workspace,
                                ratios: {
                                  ...workspace.ratios,
                                  [String(angle)]: e.target.value,
                                },
                              })
                            }
                            className={[
                              "w-full max-w-[9rem] rounded-lg border-2 bg-white px-2 py-1 font-mono text-sm font-semibold tabular-nums outline-none",
                              marked
                                ? "border-[#e85d4c] bg-[#e85d4c]/8"
                                : "border-wood/20 focus:border-wood/45",
                            ].join(" ")}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : scene ? (
            <HeightSceneView
              scene={scene}
              distanceM={workspace.distanceM}
              onDistanceChange={(distanceM) =>
                onWorkspaceChange({ ...workspace, distanceM })
              }
              locked={locked}
            />
          ) : null}

          {!table && scene ? (
            <label className="mt-3 flex flex-wrap items-center gap-2 text-sm font-bold text-wood">
              이 {scene.objectLabel}의 높이는
              <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                spellCheck={false}
                disabled={locked}
                aria-label={`${scene.objectLabel} 높이`}
                value={workspace.heightText}
                onChange={(e) =>
                  onWorkspaceChange({ ...workspace, heightText: e.target.value })
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" && onSubmit && !locked) onSubmit();
                }}
                className="w-24 rounded-lg border-2 border-wood/20 bg-white px-2 py-1.5 font-mono tabular-nums outline-none focus:border-wood/45"
              />
              m
            </label>
          ) : null}

          <label className="mt-4 block">
            <span className="text-sm font-bold text-wood">어떻게 계산했나요?</span>
            <textarea
              rows={3}
              disabled={locked}
              aria-label="계산 방법 설명"
              placeholder={
                table
                  ? "예: 각도마다 직각삼각형을 그려 높이÷밑변을 구했어요."
                  : "예: 오른쪽에 비슷한 직각삼각형을 그려 비를 구한 뒤, 실제 거리에 곱했어요."
              }
              value={workspace.methodText}
              onChange={(e) =>
                onWorkspaceChange({ ...workspace, methodText: e.target.value })
              }
              className={[
                "mt-1.5 w-full resize-y rounded-xl border-2 bg-white px-3 py-2 text-sm font-semibold leading-relaxed text-foreground/85 outline-none placeholder:text-foreground/40",
                methodMarked
                  ? "border-[#e85d4c] bg-[#e85d4c]/8"
                  : "border-wood/20 focus:border-wood/45",
              ].join(" ")}
            />
          </label>
        </div>

        <div className="min-h-[22rem] min-w-0">
          <GeometrySketchpad key={stepIndex} locked={disabled && !hostPreview} />
        </div>
      </div>

      {softNotice && !readOnly && !hostPreview ? (
        <p className="mt-4 text-center text-sm font-bold text-[#a63a1a]" role="status">
          {softMessage(softNotice, table)}
          {softNotice.reason === "wrong" ? (
            <span className="mt-1 block text-xs font-semibold text-wood/60">
              지금 맞히면 {scoreForAttempts(wrongAttempts)}점이에요.
            </span>
          ) : null}
        </p>
      ) : null}

      {submitted && submitFeedback ? (
        <div
          className={[
            "mt-5 rounded-2xl px-4 py-3 text-center",
            submitFeedback === "correct"
              ? "bg-mint/40 text-wood"
              : "bg-[#e85d4c]/15 text-[#a63a1a]",
          ].join(" ")}
          role="status"
          aria-live="polite"
        >
          <p className="font-display text-2xl">
            {submitFeedback === "correct" ? "O" : "X"}
          </p>
          {table && submitFeedback === "correct" ? (
            <p className="mt-2 text-sm font-bold leading-relaxed">
              이 표의 값이 바로 <span className="text-[#6b4a9e]">tan(각)</span>
              입니다. 각마다 높이÷밑변을 모아 두면, 매번 삼각형을 그리지 않아도
              높이를 구할 수 있어요.
            </p>
          ) : (
            <p className="mt-1 text-sm font-bold">
              {submitFeedback === "correct"
                ? "제출 완료! 답을 고칠 수 있어요. 선생님이 다음 문제로 넘길 때까지 기다려 주세요."
                : "다시 생각해 보세요. 답을 고친 뒤 다시 확인할 수 있어요."}
            </p>
          )}
        </div>
      ) : null}

      {!readOnly && !hostPreview && onSubmit ? (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={onSubmit}
            disabled={disabled}
            className="rounded-xl bg-wood px-8 py-3 text-base font-bold text-cream disabled:opacity-50"
          >
            {submitted ? "다시 확인" : "확인"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
