"use client";

import {
  clampDistance,
  isDefineStep,
  isTableStep,
  scoreForAttempts,
  TABLE_ANGLES,
  type HeightScene,
  type SoftNotice,
  type TangentWorkspace,
} from "@/lib/inquiry-tangent-intro";
import GeometrySketchpad from "./GeometrySketchpad";
import HeightSceneView from "./HeightSceneView";
import TangentDefineFigure from "./TangentDefineFigure";
import InquiryCalculator from "@/components/inquiry/InquiryCalculator";

function softMessage(notice: SoftNotice, kind: "table" | "define" | "height"): string {
  switch (notice.reason) {
    case "incomplete":
      if (kind === "table") return "아홉 칸을 모두 채워 주세요.";
      if (kind === "define") return "이 수의 이름을 적어 주세요.";
      return "높이를 입력해 주세요.";
    case "incomplete_method":
      return "어떻게 계산했는지 적어 주세요.";
    case "invalid":
      return "양의 수를 입력해 주세요. (예: 24 또는 1.73)";
    case "wrong":
      if (kind === "table") return "색이 표시된 칸을 다시 재어 보세요.";
      if (kind === "define")
        return "이 페이지에서 붙인 이름을 적어 보세요.";
      return "다시 재어 보세요. 그린 삼각형의 비를 실제 거리에 곱하면 돼요.";
  }
}

function stepKind(stepIndex: number): "table" | "define" | "height" {
  if (isTableStep(stepIndex)) return "table";
  if (isDefineStep(stepIndex)) return "define";
  return "height";
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
  const kind = stepKind(stepIndex);
  const interactive = hostPreview || !readOnly;
  const locked = !interactive || disabled;
  const projected = scoreForAttempts(wrongAttempts);
  const showScoreBar = !readOnly && !hostPreview;
  const wrongSet = new Set(softNotice?.wrongAngles ?? []);
  const methodMarked = softNotice?.reason === "incomplete_method";
  const nameMarked =
    kind === "define" &&
    (softNotice?.reason === "incomplete" || softNotice?.reason === "wrong");

  const badge =
    kind === "define" ? "이름 붙이기" : kind === "table" ? "표로 정리" : scene?.title;

  return (
    <section className="quest-card-static p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm font-bold text-wood">
        <span className="rounded-xl bg-lavender/40 px-3 py-1 tabular-nums">
          {badge} · {stepIndex + 1}/{stepCount}
        </span>
        {hostPreview ? (
          <span className="rounded-xl bg-lavender/45 px-3 py-1 text-xs font-bold text-wood">
            {kind === "define"
              ? "시연 모드 — 정의와 그림을 가리키며 설명할 수 있어요"
              : "시연 모드 — 장면과 작도판을 조작하며 설명할 수 있어요"}
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

      {kind === "define" ? (
        <div className="mt-3 space-y-3 text-sm font-semibold leading-relaxed text-foreground/80">
          <h2 className="font-display text-2xl text-wood sm:text-3xl">
            이런 것을 탄젠트라고 한다
          </h2>
          <p>
            건물·나무·등대를 잴 때마다 비슷한 직각삼각형을 그렸던 까닭은, 올려다본
            각이 같으면 삼각형의 모양이 같기 때문입니다. 모양이 같으면{" "}
            <span className="font-bold text-wood">높이 ÷ 밑변</span>도 늘 같습니다.
          </p>
          <p>
            그래서 각마다 그 비를 하나의 수 □로 적어 두면,{" "}
            <span className="font-bold text-wood">높이 = 밑변 × □</span>로 높이를
            바로 구할 수 있습니다. 표에 모은 그 수를{" "}
            <span className="font-bold text-[#6b4a9e]">탄젠트(tangent)</span>라고
            합니다.
          </p>
        </div>
      ) : (
        <p className="mt-3 text-sm font-semibold text-foreground/75">
          {kind === "table"
            ? "같은 일을 여러 번 하니 번거롭지요. 각마다 정해 둔 수만 있으면, 밑변에 그 수를 곱해 높이를 바로 구할 수 있습니다. 오른쪽에서 직각삼각형을 그려 아홉 칸을 채워 보세요. 밑변을 10칸으로 두면 높이가 곧 (이 수)×10이라 계산이 편하고, 각이 크면 밑변을 짧게 그리세요. 45°는 두 변의 길이가 같은 이등변 직각삼각형이라, 이 수가 1이 됩니다."
            : scene?.prompt}
        </p>
      )}

      <div
        className={[
          "mt-4 grid gap-4",
          kind === "define" ? "lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]" : "lg:grid-cols-2",
        ].join(" ")}
      >
        <div className="relative min-w-0">
          {kind !== "define" ? (
            <div className="mb-2 flex justify-end">
              <InquiryCalculator />
            </div>
          ) : null}
          {kind === "table" ? (
            <div className="overflow-hidden rounded-2xl border-2 border-wood/15 bg-cream/70">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-wood/15 bg-lavender/30 text-wood">
                    <th className="px-3 py-2 text-left font-bold">각</th>
                    <th className="px-3 py-2 text-left font-bold">
                      <span className="block">밑변과 각만 알면 높이를 바로 구하는 수</span>
                      <span className="mt-0.5 block text-xs font-semibold text-wood/65">
                        높이 = 밑변 × (이 수)
                      </span>
                    </th>
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
                          {angle === 45 ? (
                            <span className="ml-1.5 text-[11px] font-semibold text-wood/50">
                              이등변
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-1.5">
                          <input
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            spellCheck={false}
                            disabled={locked}
                            aria-label={`${angle}도에서 밑변에 곱해 높이를 구하는 수`}
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
          ) : kind === "define" ? (
            <TangentDefineFigure />
          ) : scene ? (
            <HeightSceneView
              scene={scene}
              distanceM={clampDistance(scene, workspace.distanceM)}
              onDistanceChange={(distanceM) =>
                onWorkspaceChange({ ...workspace, distanceM })
              }
              locked={locked}
            />
          ) : null}

          {kind === "height" && scene ? (
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

          {kind === "define" ? (
            <label className="mt-4 block">
              <span className="text-sm font-bold text-wood">이 수의 이름은?</span>
              <input
                type="text"
                autoComplete="off"
                spellCheck={false}
                disabled={locked}
                aria-label="탄젠트라는 수의 이름"
                placeholder="예: 탄젠트"
                value={workspace.nameText}
                onChange={(e) =>
                  onWorkspaceChange({ ...workspace, nameText: e.target.value })
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" && onSubmit && !locked) onSubmit();
                }}
                className={[
                  "mt-1.5 w-full max-w-xs rounded-xl border-2 bg-white px-3 py-2 text-sm font-semibold outline-none placeholder:text-foreground/40",
                  nameMarked
                    ? "border-[#e85d4c] bg-[#e85d4c]/8"
                    : "border-wood/20 focus:border-wood/45",
                ].join(" ")}
              />
            </label>
          ) : (
            <label className="mt-4 block">
              <span className="text-sm font-bold text-wood">어떻게 계산했나요?</span>
              <textarea
                rows={3}
                disabled={locked}
                aria-label="계산 방법 설명"
                placeholder={
                  kind === "table"
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
          )}
        </div>

        {kind === "define" ? (
          <div className="flex min-w-0 flex-col justify-center rounded-2xl border-2 border-wood/10 bg-lavender/20 px-4 py-5 text-sm font-semibold leading-relaxed text-foreground/80">
            <p>
              앞선 활동에서 밑변 × □로 높이를 구했고, 표의 그 수가 바로 탄젠트입니다.
              각 C에서 높이 쪽 변은 <span className="font-bold text-wood">선분 AB</span>
              , 밑변은 <span className="font-bold text-wood">선분 AC</span>입니다.
            </p>
            <p className="mt-3">
              이제 각만 알면 탄젠트 값을 찾아 높이를 구할 수 있습니다. 작도판으로
              매번 비슷한 삼각형을 그리지 않아도 됩니다.
            </p>
          </div>
        ) : (
          <div className="min-h-[22rem] min-w-0">
            <GeometrySketchpad key={stepIndex} locked={disabled && !hostPreview} />
          </div>
        )}
      </div>

      {softNotice && !readOnly && !hostPreview ? (
        <p className="mt-4 text-center text-sm font-bold text-[#a63a1a]" role="status">
          {softMessage(softNotice, kind)}
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
          {kind === "table" && submitFeedback === "correct" ? (
            <p className="mt-2 text-sm font-bold leading-relaxed">
              각마다 정해 둔 수가 있으면, 밑변만 재어도 높이를 바로 곱해서 구할 수
              있어요. 다음 장에서 이 수에 이름을 붙입니다.
            </p>
          ) : kind === "define" && submitFeedback === "correct" ? (
            <p className="mt-2 text-sm font-bold leading-relaxed">
              탄젠트는 각마다 정해진 비입니다. 높이 = 밑변 × tan(각)으로 높이를
              구할 수 있어요.
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
