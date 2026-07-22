import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  intToDecimal,
  parseSideInput,
  type Bracket,
  type DecimalValue,
} from "@/lib/sqrt-approx-math";
import { selectVisibleSides } from "@/lib/sqrt-approx-visual";

function probe(raw: string): DecimalValue {
  const parsed = parseSideInput(raw);
  if (!parsed.ok) throw new Error(`bad probe: ${raw}`);
  return parsed.value;
}

function labels(
  items: ReturnType<typeof selectVisibleSides>,
  area: number,
): string[] {
  return items.map((item) =>
    item.role === "target" ? `√${area}` : item.side!.raw,
  );
}

describe("selectVisibleSides (area=2)", () => {
  const area = 2;
  const wideBracket: Bracket = { low: intToDecimal(1), high: intToDecimal(5) };

  it("shows only target before any probe", () => {
    const items = selectVisibleSides({
      area,
      exploreBracket: wideBracket,
      probeHistory: [],
      confirmed: null,
    });
    assert.equal(items.length, 1);
    assert.equal(items[0]!.role, "target");
  });

  it("shows 1, √2, 2 after probing 1 and 2", () => {
    const bracket: Bracket = { low: intToDecimal(1), high: intToDecimal(2) };
    const items = selectVisibleSides({
      area,
      exploreBracket: bracket,
      probeHistory: [probe("1"), probe("2")],
      confirmed: null,
    });
    assert.deepEqual(labels(items, area), ["1", "√2", "2"]);
  });

  it("shows five squares with inner probes", () => {
    const bracket: Bracket = { low: intToDecimal(1), high: intToDecimal(2) };
    const items = selectVisibleSides({
      area,
      exploreBracket: bracket,
      probeHistory: [
        probe("1"),
        probe("1.2"),
        probe("1.4"),
        probe("1.5"),
        probe("2"),
      ],
      confirmed: null,
    });
    assert.equal(items.length, 5);
    assert.deepEqual(labels(items, area), ["1", "1.4", "√2", "1.5", "2"]);
  });

  it("hides confirmed integer probe 1", () => {
    const bracket: Bracket = { low: intToDecimal(1), high: intToDecimal(2) };
    const confirmed = intToDecimal(1);
    const items = selectVisibleSides({
      area,
      exploreBracket: bracket,
      probeHistory: [probe("1"), probe("1.4"), probe("1.5"), probe("2")],
      confirmed,
    });
    assert.ok(!labels(items, area).includes("1"));
    assert.ok(labels(items, area).includes("2"));
    assert.equal(items.length, 4);
    assert.deepEqual(labels(items, area), ["1.4", "√2", "1.5", "2"]);
  });

  it("drops probe 2 when outside narrowed bracket", () => {
    const bracket: Bracket = { low: probe("1.4"), high: probe("1.5") };
    const items = selectVisibleSides({
      area,
      exploreBracket: bracket,
      probeHistory: [
        probe("1"),
        probe("1.4"),
        probe("1.44"),
        probe("1.5"),
        probe("2"),
      ],
      confirmed: intToDecimal(1),
    });
    assert.deepEqual(labels(items, area), ["1.4", "√2", "1.44", "1.5"]);
    assert.ok(!labels(items, area).includes("2"));
  });

  it("keeps at least two items after probing", () => {
    const bracket: Bracket = { low: intToDecimal(1), high: intToDecimal(2) };
    const items = selectVisibleSides({
      area,
      exploreBracket: bracket,
      probeHistory: [probe("1")],
      confirmed: null,
    });
    assert.ok(items.length >= 2);
  });
});
