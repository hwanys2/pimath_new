"use client";

import {
  formatParamValue,
  PARAM_SLIDER_MAX,
  PARAM_SLIDER_MIN,
  paramSliderStep,
  snapParamValue,
} from "../lib/graph-param-slider";

type Props = {
  names: string[];
  values: Record<string, number>;
  integerOnly: boolean;
  onIntegerOnlyChange: (next: boolean) => void;
  onChange: (name: string, value: number) => void;
  compact?: boolean;
};

export default function GraphParamSliders({
  names,
  values,
  integerOnly,
  onIntegerOnlyChange,
  onChange,
  compact = false,
}: Props) {
  if (names.length === 0) return null;
  const step = paramSliderStep(integerOnly);
  return (
    <div className={`flex flex-col ${compact ? "gap-1" : "gap-1.5"}`}>
      <label
        className={`flex items-center gap-2 font-semibold text-wood ${
          compact ? "text-[10px]" : "text-xs"
        }`}
      >
        <input
          type="checkbox"
          checked={integerOnly}
          onChange={(e) => onIntegerOnlyChange(e.target.checked)}
        />
        정수만
      </label>
      {names.map((name) => {
        const raw = values[name] ?? 0;
        const value = snapParamValue(raw, integerOnly);
        return (
          <label
            key={name}
            className={`flex items-center gap-2 font-semibold text-wood ${
              compact ? "text-[10px]" : "text-xs"
            }`}
          >
            <span className={compact ? "w-4" : "w-5"}>{name}</span>
            <input
              type="range"
              min={PARAM_SLIDER_MIN}
              max={PARAM_SLIDER_MAX}
              step={step}
              value={value}
              onChange={(e) =>
                onChange(name, snapParamValue(Number(e.target.value), integerOnly))
              }
              className="flex-1"
            />
            <span className="w-8 text-right tabular-nums">
              {formatParamValue(value, integerOnly)}
            </span>
          </label>
        );
      })}
    </div>
  );
}
