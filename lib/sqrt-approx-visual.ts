import {
  compareDecimal,
  sideToNumber,
  squareSide,
  type DecimalValue,
} from "@/lib/sqrt-approx-math";

export const TARGET_PX = 84;
export const VB_W = 900;
export const VB_H = 280;
export const GAP = 16;
export const SYM_W = 24;

export type VisualStage = "integer" | "decimal";

export type VisualSideRole = "target" | "low" | "high" | "inner" | "wrong";

export type VisualSideItem = {
  role: VisualSideRole;
  /** Probe side; null only for target (√area). */
  side: DecimalValue | null;
  label: string;
  sublabel?: string;
};

export type LayoutRect = {
  spec: VisualSideItem;
  x: number;
  y: number;
  size: number;
};

const MAX_WINDOW_PROBES = 4;

function sortBySide(values: DecimalValue[]): DecimalValue[] {
  return [...values].sort((a, b) => compareDecimal(a, b));
}

function targetSideNumber(area: number): number {
  return Math.sqrt(area);
}

function makeTargetItem(area: number): VisualSideItem {
  return {
    role: "target",
    side: null,
    label: `넓이 ${area}`,
  };
}

function makeProbeItem(
  side: DecimalValue,
  role: VisualSideRole,
): VisualSideItem {
  return {
    role,
    side,
    label: squareSide(side),
    sublabel: side.raw,
  };
}

function splitBelowAbove(
  sorted: DecimalValue[],
  area: number,
): { below: DecimalValue[]; above: DecimalValue[] } {
  const sqrtArea = targetSideNumber(area);
  const below: DecimalValue[] = [];
  const above: DecimalValue[] = [];
  for (const probe of sorted) {
    const side = sideToNumber(probe);
    if (side < sqrtArea) below.push(probe);
    else if (side > sqrtArea) above.push(probe);
  }
  return { below, above };
}

function trimToSymmetricWindow(
  sorted: DecimalValue[],
  area: number,
  stage: VisualStage,
): DecimalValue[] {
  const { below, above } = splitBelowAbove(sorted, area);
  const kept: DecimalValue[] = [];

  if (stage === "integer") {
    if (below.length > 0) {
      kept.push(below[0]!);
      kept.push(below[below.length - 1]!);
    }
    if (above.length > 0) {
      kept.push(above[0]!);
      kept.push(above[above.length - 1]!);
    }
  } else {
    kept.push(...below.slice(-2), ...above.slice(0, 2));
  }

  const seen = new Set<string>();
  const unique: DecimalValue[] = [];
  for (const probe of sortBySide(kept)) {
    if (seen.has(probe.raw)) continue;
    seen.add(probe.raw);
    unique.push(probe);
  }

  if (unique.length >= MAX_WINDOW_PROBES) {
    return unique.slice(0, MAX_WINDOW_PROBES);
  }

  const remaining = sorted.filter((probe) => !seen.has(probe.raw));
  const sqrtArea = targetSideNumber(area);
  remaining.sort(
    (a, b) =>
      Math.abs(sideToNumber(a) - sqrtArea) -
      Math.abs(sideToNumber(b) - sqrtArea),
  );
  for (const probe of remaining) {
    if (unique.length >= MAX_WINDOW_PROBES) break;
    unique.push(probe);
    seen.add(probe.raw);
  }

  return sortBySide(unique);
}

/**
 * Insert a valid probe into the sliding window (target excluded, max 4 probes).
 * Only called on successful probe — confirm steps do not touch the window.
 */
export function insertProbeIntoWindow(
  window: DecimalValue[],
  probe: DecimalValue,
  stage: VisualStage,
  area: number,
): DecimalValue[] {
  if (window.some((item) => item.raw === probe.raw)) {
    return window;
  }

  const sorted = sortBySide([...window, probe]);
  if (sorted.length <= MAX_WINDOW_PROBES) return sorted;

  return trimToSymmetricWindow(sorted, area, stage);
}

function insertTargetIntoSorted(
  probes: DecimalValue[],
  area: number,
): VisualSideItem[] {
  const sqrtArea = targetSideNumber(area);
  const items: VisualSideItem[] = [];
  let targetInserted = false;

  for (const probe of probes) {
    if (!targetInserted && sideToNumber(probe) > sqrtArea) {
      items.push(makeTargetItem(area));
      targetInserted = true;
    }
    items.push(makeProbeItem(probe, "inner"));
  }

  if (!targetInserted) {
    items.push(makeTargetItem(area));
  }

  return items;
}

function assignPositionRoles(items: VisualSideItem[]): VisualSideItem[] {
  const probeIndices = items
    .map((item, index) =>
      item.role !== "target" && item.role !== "wrong" ? index : -1,
    )
    .filter((index) => index >= 0);

  if (probeIndices.length === 0) return items;

  const first = probeIndices[0]!;
  const last = probeIndices[probeIndices.length - 1]!;

  return items.map((item, index) => {
    if (item.role === "target" || item.role === "wrong") return item;
    if (index === first) return { ...item, role: "low" };
    if (index === last) return { ...item, role: "high" };
    return { ...item, role: "inner" };
  });
}

function insertWrongProbe(
  items: VisualSideItem[],
  wrongProbe: DecimalValue,
  area: number,
): VisualSideItem[] {
  const wrongItem = makeProbeItem(wrongProbe, "wrong");
  const sqrtArea = targetSideNumber(area);
  const withWrong: VisualSideItem[] = [];
  let inserted = false;

  for (const item of items) {
    if (
      !inserted &&
      item.role !== "target" &&
      item.side &&
      sideToNumber(item.side) > sideToNumber(wrongProbe)
    ) {
      withWrong.push(wrongItem);
      inserted = true;
    }
    if (
      !inserted &&
      item.role === "target" &&
      sqrtArea > sideToNumber(wrongProbe)
    ) {
      withWrong.push(wrongItem);
      inserted = true;
    }
    withWrong.push(item);
  }

  if (!inserted) withWrong.push(wrongItem);
  return withWrong;
}

/**
 * Build display items from the persisted sliding window (no bracket/confirm filtering).
 */
export function selectVisibleSides(input: {
  area: number;
  visibleWindow: DecimalValue[];
  wrongProbe?: DecimalValue | null;
}): VisualSideItem[] {
  const { area, visibleWindow, wrongProbe = null } = input;
  const window = sortBySide(visibleWindow);

  if (window.length === 0 && !wrongProbe) {
    return [makeTargetItem(area)];
  }

  let items = insertTargetIntoSorted(window, area);
  items = assignPositionRoles(items);

  if (wrongProbe && !window.some((probe) => probe.raw === wrongProbe.raw)) {
    items = insertWrongProbe(items, wrongProbe, area);
  }

  return items;
}

export function inequalityLabel(item: VisualSideItem, area: number): string {
  if (item.role === "target") return String(area);
  return item.side ? item.side.raw : String(area);
}

function sizePxForItem(item: VisualSideItem, area: number): number {
  if (item.role === "target") return TARGET_PX;
  if (!item.side) return TARGET_PX;
  const sqrtArea = targetSideNumber(area);
  return (sideToNumber(item.side) / sqrtArea) * TARGET_PX;
}

/** Lay out squares with the target fixed at viewport center. */
export function layoutAnchoredSquares(
  items: VisualSideItem[],
  area: number,
): LayoutRect[] {
  if (items.length === 0) return [];

  const targetIndex = items.findIndex((item) => item.role === "target");
  const idx = targetIndex >= 0 ? targetIndex : 0;
  const sizes = items.map((item) => sizePxForItem(item, area));
  const baseY = VB_H / 2;
  const targetX = VB_W / 2 - TARGET_PX / 2;
  const targetY = baseY - TARGET_PX / 2;

  const rects: LayoutRect[] = items.map((spec, i) => ({
    spec,
    x: 0,
    y: 0,
    size: sizes[i]!,
  }));

  rects[idx] = {
    spec: items[idx]!,
    x: targetX,
    y: targetIndex >= 0 ? targetY : baseY - sizes[idx]! / 2,
    size: targetIndex >= 0 ? TARGET_PX : sizes[idx]!,
  };

  let xRight = targetX + rects[idx]!.size + GAP + SYM_W;
  for (let i = idx + 1; i < items.length; i++) {
    const size = sizes[i]!;
    rects[i] = {
      spec: items[i]!,
      x: xRight,
      y: baseY - size / 2,
      size,
    };
    xRight += size + GAP + SYM_W;
  }

  let xLeft = targetX - GAP - SYM_W;
  for (let i = idx - 1; i >= 0; i--) {
    const size = sizes[i]!;
    xLeft -= size;
    rects[i] = {
      spec: items[i]!,
      x: xLeft,
      y: baseY - size / 2,
      size,
    };
    xLeft -= GAP + SYM_W;
  }

  return rects;
}

export function showInequalities(items: VisualSideItem[]): boolean {
  return items.length >= 2;
}

/** Count probes on each side of target in display order. */
export function countSidesAroundTarget(
  window: DecimalValue[],
  area: number,
): { below: number; above: number } {
  const labels = windowLabels(window, area);
  const targetIdx = labels.findIndex((l) => l === `√${area}`);
  if (targetIdx < 0) return { below: 0, above: 0 };
  return {
    below: targetIdx,
    above: labels.length - targetIdx - 1,
  };
}

/** Labels for tests: probe raws with √area marker for target. */
export function windowLabels(window: DecimalValue[], area: number): string[] {
  const items = selectVisibleSides({ area, visibleWindow: window });
  return items.map((item) =>
    item.role === "target" ? `√${area}` : item.side!.raw,
  );
}
