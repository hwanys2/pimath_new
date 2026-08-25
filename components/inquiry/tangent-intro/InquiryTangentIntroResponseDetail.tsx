import type { TangentResponsePayload } from "@/lib/inquiry-tangent-intro";
import { TABLE_ANGLES } from "@/lib/inquiry-tangent-intro";
import type { InquiryResult } from "@/lib/inquiry-types";

type Props = {
  response: TangentResponsePayload;
  result: InquiryResult | null;
};

function cell(
  ratios: Record<string, string> | null | undefined,
  angle: number,
): string {
  const raw = ratios?.[String(angle)];
  return typeof raw === "string" && raw.trim() ? raw : "—";
}

export default function InquiryTangentIntroResponseDetail({
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
      {kind === "height" ? (
        <ul className="mt-2 space-y-1 font-mono text-xs text-foreground/80">
          <li>거리 {response.distanceM} m</li>
          <li>각 {response.angleDeg}°</li>
          <li>높이 {response.heightM || "—"} m</li>
        </ul>
      ) : kind === "define" ? (
        <p className="mt-2 font-mono text-xs text-foreground/80">
          이름 {response.nameText || "—"}
        </p>
      ) : kind === "table" ? (
        <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-xs text-foreground/80">
          {TABLE_ANGLES.map((a) => (
            <li key={a}>
              {a}° → {cell(response.ratios, a)}
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
          <span className="font-bold text-wood">계산 방법: </span>
          {response.methodText}
        </p>
      ) : null}
    </div>
  );
}
