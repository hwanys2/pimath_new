/** Board coordinate background: 40px per unit, origin at viewport center. */

export const COORD_UNIT_PX = 40;

export function visibleIntegerRange(
  centerPx: number,
  viewportPx: number,
  unitPx: number,
): { min: number; max: number } {
  const half = viewportPx / 2;
  const min = Math.floor((centerPx - half) / unitPx) - 1;
  const max = Math.ceil((centerPx + half) / unitPx) + 1;
  return { min, max };
}
