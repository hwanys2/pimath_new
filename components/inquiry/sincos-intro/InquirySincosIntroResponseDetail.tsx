import type { SincosResponsePayload } from "@/lib/inquiry-sincos-intro";
import { TABLE_ANGLES } from "@/lib/inquiry-sincos-intro";
import type { InquiryResult } from "@/lib/inquiry-types";

type Props = {
  response: SincosResponsePayload;
  result: InquiryResult | null;
};

export default function InquirySincosIntroResponseDetail({
  response,
  result,
}: Props) {
  return (
    <div className="text-sm">
      <p className="font-semibold text-wood">
        {result === "correct" ? "정답" : result === "wrong" ? "오답" : "제출"}
        {response.wrongs > 0 ? ` · 오답 ${response.wrongs}회` : null}
      </p>
      {response.kind === "scene" ? (
        <ul className="mt-2 space-y-1 font-mono text-xs text-foreground/80">
          <li>
            빗변 {response.hyp} {response.unit}
          </li>
          <li>각 {response.angleDeg}°</li>
          <li>
            수평거리 {response.adj || "—"} {response.unit}
          </li>
          <li>
            높이 {response.opp || "—"} {response.unit}
          </li>
        </ul>
      ) : response.kind === "define" ? (
        <ul className="mt-2 space-y-1 font-mono text-xs text-foreground/80">
          <li>높이 수 이름 {response.sinNameText || "—"}</li>
          <li>수평거리 수 이름 {response.cosNameText || "—"}</li>
        </ul>
      ) : (
        <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-xs text-foreground/80">
          {TABLE_ANGLES.map((a) => (
            <li key={a}>
              {a}° sin {response.sinRatios[String(a)] || "—"} · cos{" "}
              {response.cosRatios[String(a)] || "—"}
            </li>
          ))}
        </ul>
      )}
      {response.kind !== "define" && response.methodText ? (
        <p className="mt-2 rounded-lg bg-wood/5 px-2 py-1.5 text-xs leading-relaxed text-foreground/75">
          <span className="font-bold text-wood">계산 방법: </span>
          {response.methodText}
        </p>
      ) : null}
    </div>
  );
}
