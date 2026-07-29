/** Large touch contact → treat as palm eraser for this pointer session. */
export function isPalmPointer(e: Pick<PointerEvent, "pointerType" | "width" | "height">): boolean {
  if (e.pointerType === "mouse") return false;
  const w = e.width;
  const h = e.height;
  if (!w && !h) return false;
  const area = w * h;
  const minSide = Math.min(w, h);
  return area > 600 || minSide > 32;
}
