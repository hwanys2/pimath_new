export type IntervalId = ReturnType<typeof setInterval>;

export type VisibleIntervalDeps = {
  isHidden?: () => boolean;
  addListener?: (type: "visibilitychange", listener: () => void) => void;
  removeListener?: (type: "visibilitychange", listener: () => void) => void;
  setIntervalFn?: (handler: () => void, ms: number) => IntervalId;
  clearIntervalFn?: (id: IntervalId) => void;
};

/**
 * True when the document is not the visible tab (hidden, prerender, etc.).
 * Server / non-DOM environments are treated as visible so callers can no-op.
 */
export function isDocumentHidden(): boolean {
  if (typeof document === "undefined") return false;
  return document.visibilityState !== "visible";
}

/**
 * Run `tick` immediately and on an interval, but only while the page is
 * visible. Switching away clears the timer; coming back ticks at once.
 */
export function startVisibleInterval(
  tick: () => void,
  intervalMs: number,
  deps: VisibleIntervalDeps = {},
): () => void {
  const isHidden = deps.isHidden ?? isDocumentHidden;
  const addListener =
    deps.addListener ??
    ((type, listener) => {
      document.addEventListener(type, listener);
    });
  const removeListener =
    deps.removeListener ??
    ((type, listener) => {
      document.removeEventListener(type, listener);
    });
  const setIntervalFn = deps.setIntervalFn ?? setInterval;
  const clearIntervalFn = deps.clearIntervalFn ?? clearInterval;

  let id: IntervalId | null = null;
  let stopped = false;

  const stopTimer = () => {
    if (id == null) return;
    clearIntervalFn(id);
    id = null;
  };

  const runTick = () => {
    if (stopped || isHidden()) return;
    tick();
  };

  const startTimer = () => {
    if (stopped) return;
    stopTimer();
    runTick();
    id = setIntervalFn(runTick, intervalMs);
  };

  const onVisibility = () => {
    if (stopped) return;
    if (isHidden()) {
      stopTimer();
      return;
    }
    startTimer();
  };

  if (!isHidden()) startTimer();
  addListener("visibilitychange", onVisibility);

  return () => {
    stopped = true;
    stopTimer();
    removeListener("visibilitychange", onVisibility);
  };
}
