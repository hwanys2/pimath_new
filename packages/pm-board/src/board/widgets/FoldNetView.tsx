"use client";

import { lazy, Suspense, useEffect, useRef, useState } from "react";
import FoldNetCanvas from "./FoldNetCanvas";
import type { FoldTile, HingeOverride, Join } from "../../lib/fold-net";

const FoldNetScene = lazy(() => import("./FoldNetScene"));

type Props = {
  tiles: FoldTile[];
  joins: Join[];
  selectedIds: string[];
  connectedIds: string[];
  foldTileIds: string[];
  foldRootId: string;
  unfoldT: number;
  hingeOverrides: HingeOverride[];
  orbit: { azimuth: number; polar: number };
  editing: boolean;
  onChangeTiles: (tiles: FoldTile[]) => void;
  onChangeJoins: (joins: Join[]) => void;
  onSelect: (ids: string[]) => void;
  onOrbitChange: (orbit: { azimuth: number; polar: number }) => void;
};

export default function FoldNetView({
  tiles,
  joins,
  selectedIds,
  connectedIds,
  foldTileIds,
  foldRootId,
  unfoldT,
  hingeOverrides,
  orbit,
  editing,
  onChangeTiles,
  onChangeJoins,
  onSelect,
  onOrbitChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ width: 640, height: 480 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setViewport({
        width: Math.max(1, Math.round(r.width)),
        height: Math.max(1, Math.round(r.height)),
      });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const folding = unfoldT > 0.005;

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden rounded-xl bg-[#f8f9fb]"
    >
      {folding ? (
        <div className="absolute inset-0">
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center text-xs text-wood/60">
                로딩…
              </div>
            }
          >
            <FoldNetScene
              tiles={tiles}
              joins={joins}
              foldTileIds={foldTileIds}
              rootTileId={foldRootId}
              unfoldT={unfoldT}
              hingeOverrides={hingeOverrides}
              orbit={orbit}
              viewportWidth={viewport.width}
              viewportHeight={viewport.height}
              onOrbitChange={onOrbitChange}
              className="h-full w-full"
            />
          </Suspense>
        </div>
      ) : (
        <FoldNetCanvas
          tiles={tiles}
          joins={joins}
          selectedIds={selectedIds}
          connectedIds={connectedIds}
          onChangeTiles={onChangeTiles}
          onChangeJoins={onChangeJoins}
          onSelect={onSelect}
        />
      )}
    </div>
  );
}
