/** Map a pointer into SVG user space, including preserveAspectRatio letterboxing. */
export function clientToSvgUser(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } | null {
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const local = pt.matrixTransform(ctm.inverse());
  if (!Number.isFinite(local.x) || !Number.isFinite(local.y)) return null;
  return { x: local.x, y: local.y };
}
