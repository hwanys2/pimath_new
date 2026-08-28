/** Mouse left-click, or a primary touch/pen. Safari iOS often reports button as -1. */
export function isPrimaryDrawPointer(
  e: Pick<PointerEvent, "button" | "pointerType" | "isPrimary">,
): boolean {
  if (e.pointerType === "mouse") return e.button === 0;
  if (e.isPrimary === false) return false;
  return e.button === 0 || e.button === -1;
}

export function capturePointer(target: EventTarget | null, pointerId: number) {
  if (!target || !("setPointerCapture" in target)) return;
  try {
    (target as HTMLElement).setPointerCapture(pointerId);
  } catch {
    // Safari can throw NotFoundError if the pointer already ended.
  }
}
