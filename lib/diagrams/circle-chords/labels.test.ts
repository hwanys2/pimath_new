import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyEditedLabel } from "./geometry";
import {
  CIRCLE_CHORD_PRESETS,
  cloneState,
  resolveLabelText,
} from "./model";

describe("circle chord measure labels", () => {
  it("keeps independently typed unknown letters on different lengths", () => {
    let state = cloneState(CIRCLE_CHORD_PRESETS[0]!.state);
    const ab = state.chords[0]!.id;
    const cd = state.chords[1]!.id;
    state = applyEditedLabel(state, `${ab}:distLabel`, "x");
    state = applyEditedLabel(state, `${cd}:distLabel`, "y");

    assert.equal(state.unknownLetter, "x");
    assert.equal(
      resolveLabelText(state.chords[0]!.distLabel, 6, "cm", state.unknownLetter),
      "$x$ cm",
    );
    assert.equal(
      resolveLabelText(state.chords[1]!.distLabel, 6, "cm", state.unknownLetter),
      "$y$ cm",
    );
  });
});
