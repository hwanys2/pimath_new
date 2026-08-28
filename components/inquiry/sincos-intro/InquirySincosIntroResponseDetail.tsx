import type { SincosResponsePayload } from "@/lib/inquiry-sincos-intro";
import { EXTREME_ANGLES, TABLE_ANGLES } from "@/lib/inquiry-sincos-intro";
import type { InquiryResult } from "@/lib/inquiry-types";

type Props = {
  response: SincosResponsePayload;
  result: InquiryResult | null;
};

function cell(
  ratios: Record<string, string> | null | undefined,
  angle: number,
): string {
  const raw = ratios?.[String(angle)];
  return typeof raw === "string" && raw.trim() ? raw : "—";
}

export default function InquirySincosIntroResponseDetail({
  response,
  result,
}: Props) {
  const wrongs =
    response && typeof response.wrongs === "number" ? response.wrongs : 0;
  const kind = response?.kind;

  return (
    <div className="text-sm">
      <p className="font-semibold text-wood">
        {result === "correct" ? "정답" : result === "wrong" ? "오답" : "제출"}
        {wrongs > 0 ? ` · 오답 ${wrongs}회` : null}
      </p>
      {kind === "scene" ? (
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
      ) : kind === "define" ? (
        <ul className="mt-2 space-y-1 font-mono text-xs text-foreground/80">
          <li>높이 수 이름 {response.sinNameText || "—"}</li>
          <li>수평거리 수 이름 {response.cosNameText || "—"}</li>
        </ul>
      ) : kind === "table" ? (
        <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-xs text-foreground/80">
          {[...TABLE_ANGLES, ...EXTREME_ANGLES].map((a) => (
            <li key={a}>
              {a}° sin {cell(response.sinRatios, a)} · cos{" "}
              {cell(response.cosRatios, a)}
            </li>
          ))}
        </ul>
      ) : (
        <pre className="mt-2 max-w-xs overflow-x-auto text-xs text-foreground/70">
          {JSON.stringify(response ?? {}, null, 2)}
        </pre>
      )}
      {kind !== "define" &&
      kind != null &&
      "methodText" in response &&
      typeof response.methodText === "string" &&
      response.methodText ? (
        <p className="mt-2 rounded-lg bg-wood/5 px-2 py-1.5 text-xs leading-relaxed text-foreground/75">
          <span className="font-bold text-wood">
            {kind === "table" ? "생각한 이유: " : "계산 방법: "}
          </span>
          {response.methodText}
        </p>
      ) : null}
    </div>
  );
}
