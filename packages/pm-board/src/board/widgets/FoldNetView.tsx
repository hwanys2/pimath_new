"use client";

import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import FoldNetCanvas from "./FoldNetCanvas";
import { componentContaining, type FoldTile, type Join, type NetFoldState } from "../../lib/fold-net";

const FoldNetScene = lazy(() => import("./FoldNetScene"));

type Props = {
  tiles: FoldTile[];
  joins: Join[];
  selectedIds: string[];
  netFolds: NetFoldState[];
  editing: boolean;
  onChangeTiles: (tiles: FoldTile[]) => void;
  onChangeJoins: (joins: Join[]) => void;
  onSelect: (ids: string[]) => void;
};

export default function FoldNetView({
  tiles,
  joins,
  selectedIds,
  netFolds,
  editing,
  onChangeTiles,
  onChangeJoins,
  onSelect,
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

  const connectedIds = useMemo(() => {
    if (selectedIds.length === 0) return [];
    const set = new Set<string>();
    for (const id of selectedIds) {
      for (const cid of componentContaining(tiles, joins, id)) {
        set.add(cid);
      }
    }
    return [...set];
  }, [tiles, joins, selectedIds]);

  const showEditOverlay = editing && selectedIds.length > 0;

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden rounded-xl bg-[#f8f9fb]"
    >
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
            netFolds={netFolds}
            viewportWidth={viewport.width}
            viewportHeight={viewport.height}
            className="h-full w-full"
          />
        </Suspense>
      </div>
      {showEditOverlay && (
        <div className="absolute inset-0 z-10">
          <FoldNetCanvas
            tiles={tiles}
            joins={joins}
            selectedIds={selectedIds}
            connectedIds={connectedIds}
            geometryHidden
            onChangeTiles={onChangeTiles}
            onChangeJoins={onChangeJoins}
            onSelect={onSelect}
          />
        </div>
      )}
    </div>
  );
}
