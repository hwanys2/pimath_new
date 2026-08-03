"use client";

import { lazy, Suspense } from "react";
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
  onNetScreenBounds?: (bounds: {
    left: number;
    top: number;
    width: number;
    height: number;
  } | null) => void;
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
  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl bg-[#f8f9fb]">
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
            onOrbitChange={onOrbitChange}
            className="h-full w-full"
          />
        </Suspense>
      </div>

      {editing && (
        <div
          className="absolute inset-0"
          style={{ pointerEvents: editing ? "auto" : "none" }}
        >
          <FoldNetCanvas
            tiles={tiles}
            joins={joins}
            selectedIds={selectedIds}
            connectedIds={connectedIds}
            onChangeTiles={onChangeTiles}
            onChangeJoins={onChangeJoins}
            onSelect={onSelect}
            geometryHidden
          />
        </div>
      )}
    </div>
  );
}
