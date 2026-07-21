import type { Answer, MathOp } from "@/lib/sign-slime-math";
import MathAnswerDisplay from "@/components/math/MathAnswerDisplay";

const OP_LABEL: Record<MathOp, string> = {
  "+": "+",
  "−": "−",
  "×": "×",
  "÷": "÷",
};

type Props = {
  left: Answer;
  op: MathOp;
  right: Answer;
  size?: "sm" | "md";
};

export default function MathExpressionDisplay({
  left,
  op,
  right,
  size = "md",
}: Props) {
  return (
    <span className="inline-flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1">
      <MathAnswerDisplay answer={left} variant="operand" size={size} />
      <span className="font-display text-lg font-black text-wood sm:text-xl">
        {OP_LABEL[op]}
      </span>
      <MathAnswerDisplay answer={right} variant="operand" size={size} />
    </span>
  );
}
