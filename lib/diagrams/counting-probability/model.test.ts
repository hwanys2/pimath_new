import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_COUNTING_STATE,
  layoutDice,
  layoutBallsInPouch,
  normalizeState,
  pouchBallCols,
  setBallCount,
  setCardCount,
  setDiceCount,
  setEdgeCount,
} from "./model";

describe("counting-probability model", () => {
  it("keeps existing dice positions when count grows", () => {
    const base = setDiceCount(DEFAULT_COUNTING_STATE, 2);
    const x0 = base.dice[0]!.x;
    const y0 = base.dice[0]!.y;
    const next = setDiceCount(base, 3);
    assert.equal(next.dice.length, 3);
    assert.equal(next.dice[0]!.x, x0);
    assert.equal(next.dice[0]!.y, y0);
  });

  it("relayout dice assigns grid positions", () => {
    const laid = layoutDice(
      DEFAULT_COUNTING_STATE.dice.map((d) => ({ ...d, x: 0, y: 0 })),
    );
    assert.ok(laid[0]!.x > 0);
    assert.ok(laid[0]!.y > 0);
  });

  it("adds cards without removing existing text", () => {
    const two = setCardCount(DEFAULT_COUNTING_STATE, 2);
    two.cards[0]!.text = "A";
    const three = setCardCount(two, 3);
    assert.equal(three.cards[0]!.text, "A");
    assert.equal(three.cards.length, 3);
  });

  it("ball count respects pouch max", () => {
    const pouchId = DEFAULT_COUNTING_STATE.pouches[0]!.id;
    const next = setBallCount(DEFAULT_COUNTING_STATE, pouchId, 8);
    assert.equal(next.pouches[0]!.balls.length, 8);
  });

  it("lays out six balls in two columns with breathing room", () => {
    assert.equal(pouchBallCols(6), 2);
    const balls = layoutBallsInPouch(
      Array.from({ length: 6 }, (_, i) => ({
        id: `b${i}`,
        text: String(i + 1),
        color: "blue" as const,
        x: 0,
        y: 0,
      })),
    );
    const xs = [...new Set(balls.map((b) => b.x))].sort((a, b) => a - b);
    assert.equal(xs.length, 2);
    assert.ok(xs[1]! - xs[0]! >= 30);
  });

  it("edge count updates bends array", () => {
    const edgeId = DEFAULT_COUNTING_STATE.paths.edges[0]!.id;
    const next = setEdgeCount(DEFAULT_COUNTING_STATE, edgeId, 4);
    const edge = next.paths.edges.find((e) => e.id === edgeId);
    assert.equal(edge?.count, 4);
    assert.equal(edge?.bends.length, 4);
  });

  it("normalize fills missing spinner slices", () => {
    const raw = normalizeState({
      ...DEFAULT_COUNTING_STATE,
      spinner: { rotation: 0, slices: [] },
    });
    assert.ok(raw.spinner.slices.length >= 2);
  });
});
