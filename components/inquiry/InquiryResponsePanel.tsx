import type { InquiryResponseRow } from "@/lib/inquiry-types";
import type { RadicalFillResponsePayload } from "@/lib/inquiry-radical-fill";
import InquiryRadicalFillResponseDetail from "@/components/inquiry/radical-fill/InquiryRadicalFillResponseDetail";

type Props = {
  responses: InquiryResponseRow[];
  stepCount: number;
  selectedStep: number;
  onStepChange: (step: number) => void;
  contentKey: string;
};

export default function InquiryResponsePanel({
  responses,
  stepCount,
  selectedStep,
  onStepChange,
  contentKey,
}: Props) {
  const stepResponses = responses.filter((r) => r.stepIndex === selectedStep);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: stepCount }, (_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onStepChange(i)}
            className={[
              "rounded-lg px-3 py-1.5 text-sm font-bold tabular-nums",
              selectedStep === i
                ? "bg-wood text-cream"
                : "bg-wood/10 text-wood hover:bg-wood/15",
            ].join(" ")}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {stepResponses.length === 0 ? (
        <p className="text-sm font-semibold text-foreground/60">
          이 문제에 대한 제출이 아직 없어요.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[24rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-wood/15">
                <th className="px-3 py-2 text-left font-bold text-wood">학생</th>
                <th className="px-3 py-2 text-left font-bold text-wood">결과</th>
                <th className="px-3 py-2 text-left font-bold text-wood">응답</th>
              </tr>
            </thead>
            <tbody>
              {stepResponses.map((r) => (
                <tr key={r.studentId} className="border-b border-wood/10 align-top">
                  <td className="px-3 py-3 font-semibold text-foreground">
                    {r.displayName}
                  </td>
                  <td className="px-3 py-3 font-bold text-wood">
                    {r.result === "correct"
                      ? "O"
                      : r.result === "wrong"
                        ? "X"
                        : r.result === "neutral"
                          ? "·"
                          : "—"}
                  </td>
                  <td className="px-3 py-3">
                    {contentKey === "g3-u1-radical-fill" ? (
                      <InquiryRadicalFillResponseDetail
                        response={r.response as RadicalFillResponsePayload}
                        result={r.result}
                      />
                    ) : (
                      <pre className="max-w-xs overflow-x-auto text-xs text-foreground/70">
                        {JSON.stringify(r.response, null, 2)}
                      </pre>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
