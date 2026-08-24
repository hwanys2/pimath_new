/** Slider helpers for function-graph parameters. */

export const PARAM_SLIDER_MIN = -10;
export const PARAM_SLIDER_MAX = 10;
export const PARAM_SLIDER_STEP = 0.1;

export function paramSliderStep(integerOnly: boolean): number {
  return integerOnly ? 1 : PARAM_SLIDER_STEP;
}

export function snapParamValue(value: number, integerOnly: boolean): number {
  if (!Number.isFinite(value)) return 0;
  const snapped = integerOnly ? Math.round(value) : value;
  return Math.min(PARAM_SLIDER_MAX, Math.max(PARAM_SLIDER_MIN, snapped));
}

export function snapParamValues(
  values: Record<string, number>,
  integerOnly: boolean,
): Record<string, number> {
  if (!integerOnly) return values;
  const out: Record<string, number> = {};
  for (const [name, value] of Object.entries(values)) {
    out[name] = snapParamValue(value, true);
  }
  return out;
}

export function formatParamValue(value: number, integerOnly: boolean): string {
  const v = snapParamValue(value, integerOnly);
  if (integerOnly || Number.isInteger(v)) return String(v);
  const rounded = Math.round(v * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
