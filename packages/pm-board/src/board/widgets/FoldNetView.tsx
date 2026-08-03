"use client";

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import FoldNetCanvas from "./FoldNetCanvas";
import {
  componentContaining,
  componentKey,
  type FoldTile,
  type Join,
  type NetFoldState,
  type OrbitState,
} from "../../lib/fold-net";

const FoldNetScene = lazy(() => import("./FoldNetScene"));

type Props = {
  tiles: FoldTile[];
  joins: Join[];
  selectedIds: string[];
  selectedComp: string[] | null;
  selectedUnfoldT: number;
  netFolds: NetFoldState[];
  orbit: OrbitState;
  onChangeTiles: (tiles: FoldTile[]) => void;
  onChangeJoins: (joins: Join[]) => void;
  onSelect: (ids: string[]) => void;
  onOrbitChange: (orbit: OrbitState) => void;
};

export default function FoldNetView({
  tiles,
  joins,
  selectedIds,
  selectedComp,
  selectedUnfoldT,
  netFolds,
  orbit,
  onChangeTiles,
  onChangeJoins,
  onSelect,
  onOrbitChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const orbitDragRef = useRef<{ x: number; y: number } | null>(null);
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

  const editing = selectedUnfoldT < 0.005;
  const orbitEnabled = selectedUnfoldT > 0.05 && !!selectedComp;
  const orbitTargetKey = selectedComp ? componentKey(selectedComp) : null;

  const onOrbitPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!orbitEnabled) return;
      orbitDragRef.current = { x: e.clientX, y: e.clientY };
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    },
    [orbitEnabled],
  );

  const onOrbitPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!orbitDragRef.current) return;
      const dx = e.clientX - orbitDragRef.current.x;
      const dy = e.clientY - orbitDragRef.current.y;
      orbitDragRef.current = { x: e.clientX, y: e.clientY };
      onOrbitChange({
        azimuth: orbit.azimuth - dx * 0.012,
        polar: Math.max(0.25, Math.min(Math.PI - 0.25, orbit.polar + dy * 0.012)),
      });
    },
    [orbit, onOrbitChange],
  );

  const onOrbitPointerUp = useCallback(() => {
    orbitDragRef.current = null;
  }, []);

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
            orbitEnabled={orbitEnabled}
            orbit={orbit}
            orbitTargetKey={orbitTargetKey}
            renderFlatGeometry={!editing}
            onOrbitChange={onOrbitChange}
            className="h-full w-full"
          />
        </Suspense>
      </div>
      {editing && (
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
      {orbitEnabled && (
        <div
          className="absolute inset-0 z-10 cursor-grab touch-none active:cursor-grabbing"
          onPointerDown={onOrbitPointerDown}
          onPointerMove={onOrbitPointerMove}
          onPointerUp={onOrbitPointerUp}
          onPointerLeave={onOrbitPointerUp}
        />
      )}
      {orbitEnabled && (
        <div className="pointer-events-none absolute bottom-2 left-2 z-20 rounded-md bg-black/50 px-2 py-1 text-[10px] text-white/90">
          드래그로 회전
        </div>
      )}
    </div>
  );
}
