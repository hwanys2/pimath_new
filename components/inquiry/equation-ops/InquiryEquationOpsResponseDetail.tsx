import type { EquationOpsResponsePayload } from "@/lib/inquiry-equation-ops";
import type { InquiryResult } from "@/lib/inquiry-types";
import { scoreForTime } from "@/lib/equation-ops-math";

type Props = {
  response: EquationOpsResponsePayload;
  result: InquiryResult | null;
};

function formatMs(ms: number): string {
  const sec = ms / 1000;
  return sec < 10 ? `${sec.toFixed(1)}초` : `${Math.round(sec)}초`;
}

export default function InquiryEquationOpsResponseDetail({
  response,
  result,
}: Props) {
  const stepScore =
    result === "correct" ? scoreForTime(response.elapsedMs ?? 0) : 0;

  return (
    <div className="space-y-2 text-sm">
      <p className="font-bold text-wood">
        {result === "correct" ? "O" : "X"} · {stepScore}점 ·{" "}
        {formatMs(response.elapsedMs ?? 0)} · 연산 {response.opCount}회
        {response.wrongs > 0 ? ` · 오답 ${response.wrongs}회` : ""}
      </p>
      <ol className="space-y-1 text-xs text-foreground/70">
        {response.trail.map((entry, i) => (
          <li key={`${entry.label}-${i}`}>
            {i > 0 ? `${entry.label}: ` : "시작: "}
            <span className="font-mono">{entry.latex}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
