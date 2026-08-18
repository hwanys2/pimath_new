import type { TangentResponsePayload } from "@/lib/inquiry-tangent-intro";
import { TABLE_ANGLES } from "@/lib/inquiry-tangent-intro";
import type { InquiryResult } from "@/lib/inquiry-types";

type Props = {
  response: TangentResponsePayload;
  result: InquiryResult | null;
};

export default function InquiryTangentIntroResponseDetail({
  response,
  result,
}: Props) {
  return (
    <div className="text-sm">
      <p className="font-semibold text-wood">
        {result === "correct" ? "정답" : result === "wrong" ? "오답" : "제출"}
        {response.wrongs > 0 ? ` · 오답 ${response.wrongs}회` : null}
      </p>
      {response.kind === "height" ? (
        <ul className="mt-2 space-y-1 font-mono text-xs text-foreground/80">
          <li>거리 {response.distanceM} m</li>
          <li>각 {response.angleDeg}°</li>
          <li>높이 {response.heightM || "—"} m</li>
        </ul>
      ) : (
        <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-xs text-foreground/80">
          {TABLE_ANGLES.map((a) => (
            <li key={a}>
              {a}° → {response.ratios[String(a)] || "—"}
            </li>
          ))}
        </ul>
      )}
      {response.methodText ? (
        <p className="mt-2 rounded-lg bg-wood/5 px-2 py-1.5 text-xs leading-relaxed text-foreground/75">
          <span className="font-bold text-wood">계산 방법: </span>
          {response.methodText}
        </p>
      ) : null}
    </div>
  );
}
