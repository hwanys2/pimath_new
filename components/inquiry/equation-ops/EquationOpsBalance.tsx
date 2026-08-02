"use client";

import { useId, useMemo } from "react";
import AlgebraTile, { tileWidth } from "@/components/inquiry/linear-equation-balance/AlgebraTile";
import BalanceScale, {
  BEAM_Y,
  FULCRUM_X,
  LEFT_HOOK_X,
  PAN_SURFACE_Y,
  PAN_W,
  RIGHT_HOOK_X,
  SCALE_VB_H,
  SCALE_VB_W,
} from "@/components/inquiry/linear-equation-balance/BalanceScale";
import {
  type EquationOpsState,
  workspaceFromState,
} from "@/lib/equation-ops-math";
import {
  balanceTiltDeg,
  type PlacedTile,
} from "@/lib/linear-equation-balance-math";

type Props = {
  state: EquationOpsState;
  xValue: number;
};

function stackOnPan(tiles: PlacedTile[]): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const gap = 4;
  const rowH = 34;
  const rows: PlacedTile[][] = [];
  let row: PlacedTile[] = [];
  let rowW = 0;

  for (const tile of tiles) {
    const w = tileWidth(tile.kind, 0.88);
    if (row.length > 0 && rowW + gap + w > PAN_W - 16) {
      rows.push(row);
      row = [];
      rowW = 0;
    }
    row.push(tile);
    rowW += w + gap;
  }
  if (row.length) rows.push(row);

  rows.forEach((rowTiles, ri) => {
    const rowWidth =
      rowTiles.reduce((s, t) => s + tileWidth(t.kind, 0.88) + gap, 0) - gap;
    let x = -rowWidth / 2;
    const y = -(rows.length - ri) * rowH;
    for (const tile of rowTiles) {
      positions.set(tile.id, { x, y });
      x += tileWidth(tile.kind, 0.88) + gap;
    }
  });

  return positions;
}

export default function EquationOpsBalance({ state, xValue }: Props) {
  const uid = useId().replace(/:/g, "");
  const workspace = useMemo(
    () => workspaceFromState(state, uid),
    [state, uid],
  );
  const tilt = balanceTiltDeg(workspace, xValue);
  const leftPos = stackOnPan(workspace.left);
  const rightPos = stackOnPan(workspace.right);

  const renderPanTiles = (side: "left" | "right") => {
    const tiles = workspace[side];
    const positions = side === "left" ? leftPos : rightPos;
    return tiles.map((tile) => {
      const pos = positions.get(tile.id);
      if (!pos) return null;
      return (
        <AlgebraTile
          key={tile.id}
          kind={tile.kind}
          x={pos.x}
          y={pos.y}
          scale={0.88}
        />
      );
    });
  };

  return (
    <div className="overflow-visible rounded-2xl border-2 border-wood/12 bg-gradient-to-b from-[#f0f4f8] to-[#FEF9F0] p-2 sm:p-3">
      <svg
        viewBox={`0 0 ${SCALE_VB_W} ${SCALE_VB_H}`}
        preserveAspectRatio="xMidYMid meet"
        className="mx-auto w-full max-w-full select-none"
        style={{ minHeight: 280, display: "block" }}
        role="img"
        aria-label="양팔저울"
      >
        <BalanceScale
          uid={uid}
          tilt={tilt}
          leftTiles={renderPanTiles("left")}
          rightTiles={renderPanTiles("right")}
        />
      </svg>
    </div>
  );
}
