import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildLongDivision,
  parseDivisionInputs,
} from "./division";

function workingInks(layout: ReturnType<typeof buildLongDivision>): string[] {
  return layout.rows
    .filter((row) => row.kind === "working")
    .map((row) =>
      row.digits
        .filter((d) => !d.gray)
        .map((d) => d.ch)
        .join(""),
    );
}

function workingGrays(layout: ReturnType<typeof buildLongDivision>): string[] {
  return layout.rows
    .filter((row) => row.kind === "working")
    .map((row) =>
      row.digits
        .filter((d) => d.gray)
        .map((d) => d.ch)
        .join(""),
    );
}

describe("long division 1÷7", () => {
  const layout = buildLongDivision(1n, 7n);

  it("finds the 142857 cycle and can mark 같다", () => {
    assert.equal(layout.kind, "repeating");
    assert.equal(layout.decimalDigits, "142857");
    assert.equal(layout.period, "142857");
    assert.equal(layout.prePeriod, "");
    assert.equal(layout.cycleRemainder, "1");
    assert.equal(layout.canShowSame, true);
    assert.equal(layout.showEllipsis, true);
  });

  it("lays out 10, 30, 20, 60, 40, 50, then remainder 1", () => {
    assert.deepEqual(workingInks(layout), [
      "1",
      "3",
      "2",
      "6",
      "4",
      "5",
      "1",
    ]);
    assert.deepEqual(workingGrays(layout), ["0", "0", "0", "0", "0", "0", ""]);
  });

  it("paints pink on the first and last remainder 1", () => {
    const workings = layout.rows.filter((row) => row.kind === "working");
    assert.equal(workings[0]!.digits[0]!.circle, "cycle-start");
    assert.equal(workings[workings.length - 1]!.digits[0]!.circle, "cycle-end");
    assert.equal(workings[1]!.digits[0]!.circle, "mid");
  });

  it("puts an overdot on the first and last period digits", () => {
    const period = layout.quotient.filter((d) => d.place > 0);
    assert.equal(period[0]!.overdot, true);
    assert.equal(period[period.length - 1]!.overdot, true);
    assert.equal(period.slice(1, -1).every((d) => !d.overdot), true);
  });
});

describe("long division mixed and terminating", () => {
  it("1÷6 starts the cycle at remainder 4", () => {
    const layout = buildLongDivision(1n, 6n);
    assert.equal(layout.prePeriod, "1");
    assert.equal(layout.period, "6");
    assert.equal(layout.cycleRemainder, "4");
    const workings = layout.rows.filter((row) => row.kind === "working");
    assert.equal(workings[0]!.digits[0]!.circle, "mid");
    assert.equal(workings[1]!.digits[0]!.circle, "cycle-start");
    assert.equal(workings[workings.length - 1]!.digits[0]!.circle, "cycle-end");
  });

  it("1÷2 terminates at 0.5 without 같다", () => {
    const layout = buildLongDivision(1n, 2n);
    assert.equal(layout.kind, "terminating");
    assert.equal(layout.decimalDigits, "5");
    assert.equal(layout.canShowSame, false);
    assert.equal(layout.showEllipsis, false);
    const last = layout.rows.filter((row) => row.kind === "working").at(-1)!;
    assert.equal(last.digits[0]!.ch, "0");
    assert.equal(last.digits[0]!.circle, null);
  });

  it("22÷7 keeps the integer 3 and does not circle 22", () => {
    const layout = buildLongDivision(22n, 7n);
    assert.equal(layout.integerPart, "3");
    assert.equal(layout.decimalDigits, "142857");
    const workings = layout.rows.filter((row) => row.kind === "working");
    assert.equal(workings[0]!.digits.map((d) => d.ch).join(""), "22");
    assert.equal(workings[0]!.digits.every((d) => d.circle == null), true);
    assert.equal(workings[1]!.digits[0]!.circle, "cycle-start");
  });
});

describe("period cap 30", () => {
  it("truncates 1÷47 whose period is 46", () => {
    const layout = buildLongDivision(1n, 47n);
    assert.equal(layout.kind, "truncated");
    assert.equal(layout.period.length, 30);
    assert.equal(layout.periodLength, 46);
    assert.equal(layout.canShowSame, false);
    assert.equal(layout.showEllipsis, true);
  });
});

describe("parseDivisionInputs", () => {
  it("rejects a zero divisor", () => {
    const parsed = parseDivisionInputs("1", "0");
    assert.equal(parsed.ok, false);
    if (!parsed.ok) assert.equal(parsed.error, "zero_divisor");
  });
});
