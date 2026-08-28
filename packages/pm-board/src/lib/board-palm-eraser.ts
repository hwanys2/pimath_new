/**
 * Treat a contact as palm-eraser only when it is clearly a whole hand.
 * iPhone fingers/thumbs often report 20–55 CSS px; a 32px / 600-area
 * threshold converted every phone stroke into an invisible eraser.
 */
const PALM_MIN_SIDE = 72;
const PALM_MIN_AREA = 4800;

export function isPalmPointer(
  e: Pick<PointerEvent, "pointerType" | "width" | "height">,
): boolean {
  if (e.pointerType === "mouse" || e.pointerType === "pen") return false;
  const w = e.width || 0;
  const h = e.height || 0;
  if (!w && !h) return false;
  return w * h > PALM_MIN_AREA || Math.min(w, h) > PALM_MIN_SIDE;
}
