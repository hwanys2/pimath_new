import type { Hinge } from "./types";

export function hingeAngleRad(hinge: Hinge, unfoldT: number): number {
  const t = Math.max(0, Math.min(1, unfoldT));
  return hinge.angleFolded * t;
}
