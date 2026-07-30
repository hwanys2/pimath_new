import type { BalanceFillResponsePayload } from "@/lib/inquiry-linear-equation-balance";
import type { InquiryResult } from "@/lib/inquiry-types";
import { formatExpr } from "@/lib/linear-equation-balance-math";

type Props = {
  response: BalanceFillResponsePayload;
  result: InquiryResult | null;
};

export default function InquiryLinearEquationBalanceResponseDetail({
  response,
  result,
}: Props) {
  const left = formatExpr(response.left);
  const right = formatExpr(response.right);

  return (
    <div className="text-xs font-semibold text-foreground/80">
      <p>
        왼쪽: <span className="font-mono">{left}</span>
      </p>
      <p>
        오른쪽: <span className="font-mono">{right}</span>
      </p>
      {response.wrongs > 0 ? (
        <p className="mt-1 text-wood/60">오답 시도 {response.wrongs}회</p>
      ) : null}
      {result === "neutral" ? (
        <p className="mt-1 text-wood/60">관찰 단계</p>
      ) : null}
    </div>
  );
}
