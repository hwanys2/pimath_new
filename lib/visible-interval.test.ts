import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { startVisibleInterval } from "./visible-interval";

function harness() {
  let hidden = false;
  let listener: (() => void) | null = null;
  const scheduled: Array<() => void> = [];
  const ticks: number[] = [];

  const stop = startVisibleInterval(
    () => {
      ticks.push(Date.now());
    },
    1200,
    {
      isHidden: () => hidden,
      addListener: (_type, next) => {
        listener = next;
      },
      removeListener: () => {
        listener = null;
      },
      setIntervalFn: (handler) => {
        scheduled.push(handler);
        return scheduled.length as unknown as ReturnType<typeof setInterval>;
      },
      clearIntervalFn: () => {
        scheduled.length = 0;
      },
    },
  );

  return {
    ticks,
    scheduled,
    get listener() {
      return listener;
    },
    hide() {
      hidden = true;
      listener?.();
    },
    show() {
      hidden = false;
      listener?.();
    },
    fireInterval() {
      for (const handler of [...scheduled]) handler();
    },
    startHidden() {
      hidden = true;
    },
    stop,
  };
}

describe("startVisibleInterval", () => {
  it("ticks immediately and on the interval while visible", () => {
    const h = harness();
    assert.equal(h.ticks.length, 1);
    h.fireInterval();
    h.fireInterval();
    assert.equal(h.ticks.length, 3);
    h.stop();
  });

  it("does not tick while the tab is hidden", () => {
    const h = harness();
    h.hide();
    assert.equal(h.scheduled.length, 0);
    h.fireInterval();
    assert.equal(h.ticks.length, 1);
    h.stop();
  });

  it("ticks once as soon as the tab is visible again", () => {
    const h = harness();
    h.hide();
    const before = h.ticks.length;
    h.show();
    assert.equal(h.ticks.length, before + 1);
    h.fireInterval();
    assert.equal(h.ticks.length, before + 2);
    h.stop();
  });

  it("waits to start if the tab is already hidden", () => {
    let hidden = true;
    let listener: (() => void) | null = null;
    const ticks: number[] = [];
    const stop = startVisibleInterval(() => ticks.push(1), 1200, {
      isHidden: () => hidden,
      addListener: (_type, next) => {
        listener = next;
      },
      removeListener: () => {
        listener = null;
      },
      setIntervalFn: (handler) => {
        void handler;
        return 1 as unknown as ReturnType<typeof setInterval>;
      },
      clearIntervalFn: () => {},
    });
    assert.equal(ticks.length, 0);
    hidden = false;
    listener?.();
    assert.equal(ticks.length, 1);
    stop();
  });

  it("stop() prevents later ticks and unsubscribes", () => {
    const h = harness();
    h.stop();
    assert.equal(h.listener, null);
    h.show();
    h.fireInterval();
    assert.equal(h.ticks.length, 1);
  });
});
