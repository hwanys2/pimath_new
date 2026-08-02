"use client";

import { useState } from "react";
import {
  canScaleDivide,
  canScaleMultiply,
  parseScaleInput,
  scaleDivideBothSides,
  scaleMultiplyBothSides,
  scaleValidationMessage,
  type BalanceAction,
  type TileWorkspace,
} from "@/lib/linear-equation-balance-math";

type Props = {
  workspace: TileWorkspace;
  disabled?: boolean;
  onApply: (next: TileWorkspace, action: BalanceAction) => void;
};

export default function FreeScaleControls({
  workspace,
  disabled = false,
  onApply,
}: Props) {
  const [multiplyInput, setMultiplyInput] = useState("2");
  const [divideInput, setDivideInput] = useState("2");
  const [multiplyError, setMultiplyError] = useState<string | null>(null);
  const [divideError, setDivideError] = useState<string | null>(null);

  const applyMultiply = () => {
    setMultiplyError(null);
    const n = parseScaleInput(multiplyInput);
    if (n === null) {
      setMultiplyError("숫자를 입력해 주세요.");
      return;
    }
    const check = canScaleMultiply(workspace, n);
    if (!check.ok) {
      setMultiplyError(scaleValidationMessage(check.reason));
      return;
    }
    onApply(scaleMultiplyBothSides(workspace, n), {
      type: "multiply",
      factor: n,
    });
  };

  const applyDivide = () => {
    setDivideError(null);
    const n = parseScaleInput(divideInput);
    if (n === null) {
      setDivideError("숫자를 입력해 주세요.");
      return;
    }
    const check = canScaleDivide(workspace, n);
    if (!check.ok) {
      setDivideError(scaleValidationMessage(check.reason));
      return;
    }
    onApply(scaleDivideBothSides(workspace, n), {
      type: "divide",
      divisor: n,
    });
  };

  const inputClass =
    "w-16 rounded-lg border-2 border-wood/20 bg-cream px-2 py-1.5 text-center text-sm font-bold text-wood tabular-nums";
  const buttonClass =
    "rounded-lg bg-wood px-4 py-2 text-xs font-bold text-cream shadow-sm hover:bg-wood/90 disabled:opacity-40";

  return (
    <div className="mt-1 space-y-3 border-t border-wood/10 px-2 pt-3">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className="text-xs font-bold text-wood">양변에</span>
        <input
          type="text"
          inputMode="numeric"
          value={multiplyInput}
          onChange={(e) => {
            setMultiplyInput(e.target.value);
            setMultiplyError(null);
          }}
          disabled={disabled}
          className={inputClass}
          aria-label="곱할 수"
        />
        <span className="text-xs font-bold text-wood">곱하기</span>
        <button
          type="button"
          disabled={disabled}
          onClick={applyMultiply}
          className={buttonClass}
        >
          적용
        </button>
      </div>
      {multiplyError ? (
        <p className="text-center text-xs font-bold text-[#a63a1a]" role="status">
          {multiplyError}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className="text-xs font-bold text-wood">양변을</span>
        <input
          type="text"
          inputMode="numeric"
          value={divideInput}
          onChange={(e) => {
            setDivideInput(e.target.value);
            setDivideError(null);
          }}
          disabled={disabled}
          className={inputClass}
          aria-label="나눌 수"
        />
        <span className="text-xs font-bold text-wood">나누기</span>
        <button
          type="button"
          disabled={disabled}
          onClick={applyDivide}
          className={buttonClass}
        >
          적용
        </button>
      </div>
      {divideError ? (
        <p className="text-center text-xs font-bold text-[#a63a1a]" role="status">
          {divideError}
        </p>
      ) : null}
    </div>
  );
}
