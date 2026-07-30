import type { RadicalFillResponsePayload } from "@/lib/inquiry-radical-fill";

type Props = {
  response: RadicalFillResponsePayload;
  result: string | null;
};

export default function InquiryRadicalFillResponseDetail({
  response,
  result,
}: Props) {
  const { fills, gaveUp, wrongs } = response;

  return (
    <div className="text-sm">
      <p className="font-semibold text-wood">
        {result === "correct" ? "정답" : result === "wrong" ? "오답" : "제출"}
        {gaveUp ? " (포기)" : null}
        {wrongs > 0 ? ` · 오답 ${wrongs}회` : null}
      </p>
      <ul className="mt-2 space-y-1 font-mono text-xs text-foreground/80">
        {fills.map((fill, i) => (
          <li key={i}>
            항 {i + 1}:{" "}
            {fill.coeff ? `계수 ${fill.coeff || "—"}` : null}
            {fill.coeff && fill.radicand ? " · " : null}
            {fill.radicand ? `근호 안 ${fill.radicand}` : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
