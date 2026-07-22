import {
  compareDecimal,
  isValidGuess,
  sideToNumber,
  squareSide,
  type Bracket,
  type DecimalValue,
} from "@/lib/sqrt-approx-math";

export const TARGET_PX = 96;
export const VB_W = 900;
export const VB_H = 280;
export const GAP = 16;
export const SYM_W = 24;

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

function dedupeByRaw(values: DecimalValue[]): DecimalValue[] {
  const seen = new Set<string>();
  const out: DecimalValue[] = [];
  for (const v of values) {
    if (seen.has(v.raw)) continue;
    seen.add(v.raw);
    out.push(v);
  }
  return out;
}

function sortBySide(values: DecimalValue[]): DecimalValue[] {
  return [...values].sort((a, b) => compareDecimal(a, b));
}

function equalsDecimal(a: DecimalValue, b: DecimalValue): boolean {
  return compareDecimal(a, b) === 0;
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
    label: side.raw,
    sublabel: squareSide(side),
  };
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

function trimToMaxCount(
  items: VisualSideItem[],
  area: number,
  maxCount: number,
  bracket: Bracket,
): VisualSideItem[] {
  if (items.length <= maxCount) return items;

  const sqrtArea = targetSideNumber(area);
  const lowBound = bracket.low;
  const highBound = bracket.high;

  const isRemovable = (item: VisualSideItem, index: number): boolean => {
    if (item.role === "target" || item.role === "wrong") return false;
    if (!item.side) return false;
    if (equalsDecimal(item.side, lowBound)) return false;
    if (equalsDecimal(item.side, highBound)) return false;
    return true;
  };

  let current = [...items];
  while (current.length > maxCount) {
    const removableIndices = current
      .map((item, index) => ({ item, index }))
      .filter(({ item, index }) => isRemovable(item, index));

    if (removableIndices.length === 0) break;

    let removeIndex = removableIndices[0]!.index;
    let maxDist = -1;
    for (const { item, index } of removableIndices) {
      const dist = Math.abs(sideToNumber(item.side!) - sqrtArea);
      if (dist > maxDist) {
        maxDist = dist;
        removeIndex = index;
      }
    }
    current = current.filter((_, i) => i !== removeIndex);
  }

  return current;
}

function assignBracketRoles(
  items: VisualSideItem[],
  bracket: Bracket,
): VisualSideItem[] {
  return items.map((item) => {
    if (item.role === "target" || item.role === "wrong" || !item.side) {
      return item;
    }
    if (equalsDecimal(item.side, bracket.low)) {
      return { ...item, role: "low" };
    }
    if (equalsDecimal(item.side, bracket.high)) {
      return { ...item, role: "high" };
    }
    return { ...item, role: "inner" };
  });
}

/**
 * Pick up to `maxCount` sides for display: fixed √area target plus probes
 * inside the current explore bracket. Confirmed integer probe is hidden.
 */
export function selectVisibleSides(input: {
  area: number;
  exploreBracket: Bracket;
  probeHistory: DecimalValue[];
  confirmed: DecimalValue | null;
  wrongProbe?: DecimalValue | null;
  maxCount?: number;
}): VisualSideItem[] {
  const {
    area,
    exploreBracket,
    probeHistory,
    confirmed,
    wrongProbe = null,
    maxCount = 5,
  } = input;

  let candidates = probeHistory.filter((p) =>
    isValidGuess(p, exploreBracket.low, exploreBracket.high),
  );

  if (confirmed && confirmed.scale === 0) {
    candidates = candidates.filter(
      (p) => !equalsDecimal(p, confirmed),
    );
  }

  candidates = dedupeByRaw(candidates);
  candidates = sortBySide(candidates);

  if (candidates.length === 0 && !wrongProbe) {
    return [makeTargetItem(area)];
  }

  let items = insertTargetIntoSorted(candidates, area);
  items = assignBracketRoles(items, exploreBracket);
  items = trimToMaxCount(items, area, maxCount, exploreBracket);

  if (wrongProbe) {
    const wrongInBracket = isValidGuess(
      wrongProbe,
      exploreBracket.low,
      exploreBracket.high,
    );
    const alreadyShown = items.some(
      (item) => item.side && equalsDecimal(item.side, wrongProbe),
    );
    if (!alreadyShown) {
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
      items = wrongInBracket
        ? trimToMaxCount(
            assignBracketRoles(withWrong, exploreBracket),
            area,
            maxCount,
            exploreBracket,
          )
        : withWrong;
    }
  }

  if (probeHistory.length > 0 && items.length < 2) {
    const nearest = sortBySide(
      probeHistory.filter((p) =>
        isValidGuess(p, exploreBracket.low, exploreBracket.high),
      ),
    ).find(
      (p) =>
        !confirmed ||
        confirmed.scale !== 0 ||
        !equalsDecimal(p, confirmed),
    );
    if (nearest) {
      return selectVisibleSides({
        ...input,
        probeHistory: [nearest, ...probeHistory],
        wrongProbe: null,
      });
    }
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
