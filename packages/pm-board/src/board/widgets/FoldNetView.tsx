"use client";

import { lazy, Suspense, useMemo } from "react";
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
  const show3d = unfoldT > 0.005 && foldTileIds.length > 0;

  const canvasOpacity = useMemo(
    () => (show3d ? Math.max(0, 1 - unfoldT * 2) : 1),
    [show3d, unfoldT],
  );

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl bg-[#f8f9fb]">
      <div
        className="absolute inset-0"
        style={{
          opacity: canvasOpacity,
          pointerEvents: editing && !show3d ? "auto" : "none",
        }}
      >
        <FoldNetCanvas
          tiles={tiles}
          joins={joins}
          selectedIds={selectedIds}
          connectedIds={connectedIds}
          onChangeTiles={onChangeTiles}
          onChangeJoins={onChangeJoins}
          onSelect={onSelect}
        />
      </div>

      {show3d && (
        <div className="absolute inset-0">
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center text-xs text-wood/60">
                3D 로딩…
              </div>
            }
          >
            <FoldNetScene
              tiles={tiles}
              joins={joins}
              tileIds={foldTileIds}
              rootTileId={foldRootId}
              unfoldT={unfoldT}
              hingeOverrides={hingeOverrides}
              orbit={orbit}
              onOrbitChange={onOrbitChange}
              className="h-full w-full"
            />
          </Suspense>
        </div>
      )}
    </div>
  );
}
