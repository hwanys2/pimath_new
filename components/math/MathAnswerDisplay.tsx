import type { Answer } from "@/lib/sign-slime-math";
import { simplifyAnswer } from "@/lib/sign-slime-math";

type Props = {
  answer: Answer;
  variant: "operand" | "answer";
  size?: "sm" | "md";
};

const sizeClass = {
  sm: { int: "text-base", frac: "text-xs", bar: "min-w-[1.1rem]" },
  md: { int: "text-lg sm:text-xl", frac: "text-sm", bar: "min-w-[1.35rem]" },
} as const;

function StackedFraction({
  num,
  den,
  size,
}: {
  num: number;
  den: number;
  size: "sm" | "md";
}) {
  const cls = sizeClass[size];
  return (
    <span className="inline-flex flex-col items-center leading-none">
      <span className={`font-black tabular-nums ${cls.frac}`}>{num}</span>
      <span className={`my-px w-full border-t-2 border-wood ${cls.bar}`} />
      <span className={`font-black tabular-nums ${cls.frac}`}>{den}</span>
    </span>
  );
}

function SignedValue({
  answer,
  variant,
  size,
}: {
  answer: Answer;
  variant: "operand" | "answer";
  size: "sm" | "md";
}) {
  const s = simplifyAnswer(answer);
  const cls = sizeClass[size];

  if (s.kind === "int") {
    let text: string;
    if (variant === "operand") {
      if (s.value > 0) text = `(+${s.value})`;
      else if (s.value < 0) text = `(−${Math.abs(s.value)})`;
      else text = "(0)";
    } else if (s.value > 0) {
      text = `+${s.value}`;
    } else if (s.value < 0) {
      text = `−${Math.abs(s.value)}`;
    } else {
      text = "0";
    }
    return (
      <span className={`font-display font-black tabular-nums ${cls.int}`}>
        {text}
      </span>
    );
  }

  const sign = s.num >= 0 ? (variant === "operand" ? "+" : "") : "−";
  const absNum = Math.abs(s.num);

  if (variant === "operand") {
    return (
      <span className={`inline-flex items-center font-display font-black ${cls.int}`}>
        <span>(</span>
        <span className="inline-flex items-center gap-px">
          <span>{sign}</span>
          <StackedFraction num={absNum} den={s.den} size={size} />
        </span>
        <span>)</span>
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-px font-display font-black ${cls.int}`}>
      {sign ? <span>{sign}</span> : null}
      <StackedFraction num={absNum} den={s.den} size={size} />
    </span>
  );
}

export default function MathAnswerDisplay({ answer, variant, size = "md" }: Props) {
  return <SignedValue answer={answer} variant={variant} size={size} />;
}
