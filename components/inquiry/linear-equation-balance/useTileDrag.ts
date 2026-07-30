"use client";

import { useCallback, useState } from "react";
import type { TileKind } from "@/lib/linear-equation-balance-math";

export type DragSource =
  | { type: "palette"; kind: TileKind }
  | { type: "pan"; tileId: string; kind: TileKind; from: "left" | "right" };

export type DropTarget = "left" | "right" | "trash" | null;

export type ActiveDrag = {
  source: DragSource;
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
};

export function useTileDrag(svgRef: React.RefObject<SVGSVGElement | null>) {
  const [drag, setDrag] = useState<ActiveDrag | null>(null);
  const [hoverTarget, setHoverTarget] = useState<DropTarget>(null);

  const clientToSvg = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current;
      if (!svg) return { x: 0, y: 0 };
      const pt = svg.createSVGPoint();
      pt.x = clientX;
      pt.y = clientY;
      const ctm = svg.getScreenCTM();
      if (!ctm) return { x: 0, y: 0 };
      return pt.matrixTransform(ctm.inverse());
    },
    [svgRef],
  );

  const startDrag = useCallback(
    (
      e: React.PointerEvent,
      source: DragSource,
      tileW = 60,
      tileH = 28,
    ) => {
      e.preventDefault();
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      const { x, y } = clientToSvg(e.clientX, e.clientY);
      setDrag({
        source,
        x,
        y,
        offsetX: tileW / 2,
        offsetY: tileH / 2,
      });
    },
    [clientToSvg],
  );

  const moveDrag = useCallback(
    (
      e: React.PointerEvent,
      hitTest: (
        x: number,
        y: number,
        clientX: number,
        clientY: number,
      ) => DropTarget,
    ) => {
      if (!drag) return;
      const { x, y } = clientToSvg(e.clientX, e.clientY);
      setDrag((d) => (d ? { ...d, x, y } : null));
      setHoverTarget(hitTest(x, y, e.clientX, e.clientY));
    },
    [drag, clientToSvg],
  );

  const endDrag = useCallback(
    (e: React.PointerEvent): DropTarget => {
      const target = hoverTarget;
      setDrag(null);
      setHoverTarget(null);
      try {
        (e.currentTarget as Element).releasePointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
      return target;
    },
    [hoverTarget],
  );

  const cancelDrag = useCallback(() => {
    setDrag(null);
    setHoverTarget(null);
  }, []);

  return {
    drag,
    hoverTarget,
    startDrag,
    moveDrag,
    endDrag,
    cancelDrag,
    clientToSvg,
  };
}
