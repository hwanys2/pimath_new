"use client";

import {
  isDefineStep,
  isTableStep,
  scoreForAttempts,
  TABLE_ANGLES,
  type HypScene,
  type SoftNotice,
  type SincosWorkspace,
} from "@/lib/inquiry-sincos-intro";
import HypotenuseSceneView from "./HypotenuseSceneView";
import SincosDefineFigure from "./SincosDefineFigure";
import SincosSketchpad from "./SincosSketchpad";
import InquiryCalculator from "@/components/inquiry/InquiryCalculator";

function softMessage(
  notice: SoftNotice,
  kind: "table" | "define" | "scene",
): string {
  switch (notice.reason) {
    case "incomplete":
      if (kind === "table") return "열여덟 칸을 모두 채워 주세요.";
      if (kind === "define") return "두 수의 이름을 모두 적어 주세요.";
      return "수평거리와 높이를 모두 입력해 주세요.";
    case "incomplete_method":
      return "어떻게 계산했는지 적어 주세요.";
    case "invalid":
      return "양의 수를 입력해 주세요. (예: 23 또는 0.87)";
    case "wrong":
      if (kind === "table") return "색이 표시된 칸을 다시 재어 보세요.";
      if (kind === "define") return "이 페이지에서 붙인 이름을 적어 보세요.";
      return "다시 재어 보세요. 그린 삼각형의 비를 실제 빗변에 곱하면 돼요.";
  }
}

function stepKind(stepIndex: number): "table" | "define" | "scene" {
  if (isTableStep(stepIndex)) return "table";
  if (isDefineStep(stepIndex)) return "define";
  return "scene";
}

type Props = {
  scene: HypScene | null;
  stepIndex: number;
  stepCount: number;
  workspace: SincosWorkspace;
  onWorkspaceChange: (ws: SincosWorkspace) => void;
  readOnly?: boolean;
  hostPreview?: boolean;
  disabled?: boolean;
  wrongAttempts?: number;
  softNotice?: SoftNotice | null;
  submitted?: boolean;
  submitFeedback?: "correct" | "wrong" | null;
  onSubmit?: () => void;
  sketchPersistKey?: string | null;
};

export default function InquirySincosIntroStep({
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
  sketchPersistKey = null,
}: Props) {
  const kind = stepKind(stepIndex);
  const interactive = hostPreview || !readOnly;
  const locked = !interactive || disabled;
  const projected = scoreForAttempts(wrongAttempts);
  const showScoreBar = !readOnly && !hostPreview;
  const wrongSet = new Set(softNotice?.wrongKeys ?? []);
  const methodMarked = softNotice?.reason === "incomplete_method";
  const sinNameText = workspace.sinNameText ?? "";
  const cosNameText = workspace.cosNameText ?? "";
  const sinNameMarked =
    kind === "define" &&
    (softNotice?.reason === "incomplete" ||
      softNotice?.reason === "wrong") &&
    (wrongSet.has("sinName") ||
      (softNotice?.reason === "incomplete" && !sinNameText.trim()));
  const cosNameMarked =
    kind === "define" &&
    (softNotice?.reason === "incomplete" ||
      softNotice?.reason === "wrong") &&
    (wrongSet.has("cosName") ||
      (softNotice?.reason === "incomplete" && !cosNameText.trim()));
  const unit = scene?.unit ?? "m";

  const badge =
    kind === "define"
      ? "이름 붙이기"
      : kind === "table"
        ? "표로 정리"
        : scene?.title;

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
            이런 것을 사인·코사인이라고 한다
          </h2>
          <p>
            연·사다리·거치대를 잴 때마다 비슷한 직각삼각형을 그렸던 까닭은, 각이
            같으면 삼각형의 모양이 같기 때문입니다. 모양이 같으면 빗변에 곱하는{" "}
            <span className="font-bold text-wood">마법의 수</span>도 늘 같습니다.
          </p>
          <p>
            표에 모은 첫 번째 수는{" "}
            <span className="font-bold text-wood">높이 = 빗변 × □</span>, 두
            번째 수는{" "}
            <span className="font-bold text-wood">밑변 = 빗변 × □</span>로
            바로 구할 수 있게 해 줍니다. 이 두 수를{" "}
            <span className="font-bold text-[#6b4a9e]">사인(sine)</span>과{" "}
            <span className="font-bold text-[#6b4a9e]">코사인(cosine)</span>
            이라고 합니다.
          </p>
        </div>
      ) : (
        <p className="mt-3 text-sm font-semibold text-foreground/75">
          {kind === "table"
            ? "같은 일을 여러 번 하니 번거롭지요. 각마다 정해 둔 수만 있으면, 빗변에 그 수를 곱해 높이와 수평거리를 바로 구할 수 있습니다. 오른쪽에서 빗변을 먼저 그리면 점선 원이 생깁니다. 빗변을 10칸으로 두면 높이와 밑변이 곧 (이 수)×10이라 계산이 편해요. 45°는 두 변의 길이가 같은 이등변 직각삼각형이라, 두 수가 같습니다."
            : scene?.prompt}
        </p>
      )}

      <div
        className={[
          "mt-4 grid gap-4",
          kind === "define"
            ? "lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]"
            : "lg:grid-cols-2",
        ].join(" ")}
      >
        <div className="relative min-w-0">
          {kind !== "define" ? (
            <div className="mb-2 flex justify-end">
              <InquiryCalculator />
            </div>
          ) : null}
          {kind === "table" ? (
            <div className="overflow-x-auto overflow-hidden rounded-2xl border-2 border-wood/15 bg-cream/70">
              <table className="w-full min-w-[20rem] text-sm">
                <thead>
                  <tr className="border-b border-wood/15 bg-lavender/30 text-wood">
                    <th className="px-3 py-2 text-left font-bold">각</th>
                    <th className="px-3 py-2 text-left font-bold">
                      <span className="block">
                        빗변과 각만 알면 높이를 바로 구하는 수
                      </span>
                      <span className="mt-0.5 block text-xs font-semibold text-wood/65">
                        높이 = 빗변 × (이 수)
                      </span>
                    </th>
                    <th className="px-3 py-2 text-left font-bold">
                      <span className="block">
                        빗변과 각만 알면 수평거리를 바로 구하는 수
                      </span>
                      <span className="mt-0.5 block text-xs font-semibold text-wood/65">
                        수평거리 = 빗변 × (이 수)
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {TABLE_ANGLES.map((angle) => {
                    const sinVal = workspace.sinRatios?.[String(angle)] ?? "";
                    const cosVal = workspace.cosRatios?.[String(angle)] ?? "";
                    const sinMarked =
                      (softNotice?.reason === "incomplete" &&
                        !sinVal.trim()) ||
                      wrongSet.has(`sin:${angle}`);
                    const cosMarked =
                      (softNotice?.reason === "incomplete" &&
                        !cosVal.trim()) ||
                      wrongSet.has(`cos:${angle}`);
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
                        <td className="px-2 py-1.5">
                          <input
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            spellCheck={false}
                            disabled={locked}
                            aria-label={`${angle}도에서 빗변에 곱해 높이를 구하는 수`}
                            value={sinVal}
                            onChange={(e) =>
                              onWorkspaceChange({
                                ...workspace,
                                sinRatios: {
                                  ...(workspace.sinRatios ?? {}),
                                  [String(angle)]: e.target.value,
                                },
                              })
                            }
                            className={[
                              "w-full max-w-[7.5rem] rounded-lg border-2 bg-white px-2 py-1 font-mono text-sm font-semibold tabular-nums outline-none",
                              sinMarked
                                ? "border-[#e85d4c] bg-[#e85d4c]/8"
                                : "border-wood/20 focus:border-wood/45",
                            ].join(" ")}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            spellCheck={false}
                            disabled={locked}
                            aria-label={`${angle}도에서 빗변에 곱해 수평거리를 구하는 수`}
                            value={cosVal}
                            onChange={(e) =>
                              onWorkspaceChange({
                                ...workspace,
                                cosRatios: {
                                  ...(workspace.cosRatios ?? {}),
                                  [String(angle)]: e.target.value,
                                },
                              })
                            }
                            className={[
                              "w-full max-w-[7.5rem] rounded-lg border-2 bg-white px-2 py-1 font-mono text-sm font-semibold tabular-nums outline-none",
                              cosMarked
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
            <SincosDefineFigure />
          ) : scene ? (
            <HypotenuseSceneView
              scene={scene}
              angleDeg={workspace.angleDeg}
              baseT={workspace.baseT}
              onChange={({ angleDeg, baseT }) =>
                onWorkspaceChange({ ...workspace, angleDeg, baseT })
              }
              locked={locked}
            />
          ) : null}

          {kind === "scene" && scene ? (
            <div className="mt-3 flex flex-col gap-2">
              <label className="flex flex-wrap items-center gap-2 text-sm font-bold text-wood">
                수평거리
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  spellCheck={false}
                  disabled={locked}
                  aria-label="수평거리"
                  value={workspace.adjText}
                  onChange={(e) =>
                    onWorkspaceChange({ ...workspace, adjText: e.target.value })
                  }
                  className={[
                    "w-24 rounded-lg border-2 bg-white px-2 py-1.5 font-mono tabular-nums outline-none focus:border-wood/45",
                    wrongSet.has("adj")
                      ? "border-[#e85d4c] bg-[#e85d4c]/8"
                      : "border-wood/20",
                  ].join(" ")}
                />
                {unit}
              </label>
              <label className="flex flex-wrap items-center gap-2 text-sm font-bold text-wood">
                높이
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  spellCheck={false}
                  disabled={locked}
                  aria-label="높이"
                  value={workspace.oppText}
                  onChange={(e) =>
                    onWorkspaceChange({ ...workspace, oppText: e.target.value })
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && onSubmit && !locked) onSubmit();
                  }}
                  className={[
                    "w-24 rounded-lg border-2 bg-white px-2 py-1.5 font-mono tabular-nums outline-none focus:border-wood/45",
                    wrongSet.has("opp")
                      ? "border-[#e85d4c] bg-[#e85d4c]/8"
                      : "border-wood/20",
                  ].join(" ")}
                />
                {unit}
              </label>
            </div>
          ) : null}

          {kind === "define" ? (
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="text-sm font-bold text-wood">
                  빗변에 곱하면 높이를 구하는 수의 이름은?
                </span>
                <input
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  disabled={locked}
                  aria-label="높이를 구하는 수의 이름"
                  placeholder="예: 사인"
                  value={sinNameText}
                  onChange={(e) =>
                    onWorkspaceChange({
                      ...workspace,
                      sinNameText: e.target.value,
                    })
                  }
                  className={[
                    "mt-1.5 w-full max-w-xs rounded-xl border-2 bg-white px-3 py-2 text-sm font-semibold outline-none placeholder:text-foreground/40",
                    sinNameMarked
                      ? "border-[#e85d4c] bg-[#e85d4c]/8"
                      : "border-wood/20 focus:border-wood/45",
                  ].join(" ")}
                />
              </label>
              <label className="block">
                <span className="text-sm font-bold text-wood">
                  빗변에 곱하면 수평거리를 구하는 수의 이름은?
                </span>
                <input
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  disabled={locked}
                  aria-label="수평거리를 구하는 수의 이름"
                  placeholder="예: 코사인"
                  value={cosNameText}
                  onChange={(e) =>
                    onWorkspaceChange({
                      ...workspace,
                      cosNameText: e.target.value,
                    })
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && onSubmit && !locked) onSubmit();
                  }}
                  className={[
                    "mt-1.5 w-full max-w-xs rounded-xl border-2 bg-white px-3 py-2 text-sm font-semibold outline-none placeholder:text-foreground/40",
                    cosNameMarked
                      ? "border-[#e85d4c] bg-[#e85d4c]/8"
                      : "border-wood/20 focus:border-wood/45",
                  ].join(" ")}
                />
              </label>
            </div>
          ) : (
            <label className="mt-4 block">
              <span className="text-sm font-bold text-wood">어떻게 계산했나요?</span>
              <textarea
                rows={3}
                disabled={locked}
                aria-label="계산 방법 설명"
                placeholder={
                  kind === "table"
                    ? "예: 각도마다 빗변 10칸 직각삼각형을 그려, 빗변에 곱하면 높이·수평거리가 되는 수를 구했어요."
                    : "예: 오른쪽에 비슷한 직각삼각형을 그려 비를 구한 뒤, 실제 빗변에 곱했어요."
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
              앞선 활동에서 빗변 × □로 높이와 수평거리를 구했고, 표의 첫 번째
              수가 <span className="font-bold text-[#6b4a9e]">사인</span>, 두
              번째 수가 <span className="font-bold text-[#6b4a9e]">코사인</span>
              입니다. 각 A에서 높이 쪽 변은{" "}
              <span className="font-bold text-wood">선분 BC</span>, 밑변은{" "}
              <span className="font-bold text-wood">선분 AC</span>, 빗변은{" "}
              <span className="font-bold text-wood">선분 AB</span>입니다.
            </p>
            <p className="mt-3">
              이제 각만 알면 사인·코사인 값을 찾아 높이와 거리를 구할 수
              있습니다. 작도판으로 매번 비슷한 삼각형을 그리지 않아도 됩니다.
            </p>
          </div>
        ) : (
          <div className="min-h-[22rem] min-w-0">
            <SincosSketchpad
              key={stepIndex}
              locked={disabled && !hostPreview}
              persistKey={sketchPersistKey}
            />
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
              각마다 정해 둔 수가 있으면, 빗변만 재어도 높이와 수평거리를 바로
              곱해서 구할 수 있어요. 다음 장에서 이 수들에 이름을 붙입니다.
            </p>
          ) : kind === "define" && submitFeedback === "correct" ? (
            <p className="mt-2 text-sm font-bold leading-relaxed">
              사인은 높이 = 빗변 × sin(각), 코사인은 밑변 = 빗변 × cos(각)으로
              거리와 높이를 구할 수 있어요.
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
