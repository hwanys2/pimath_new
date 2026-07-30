"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import AlgebraTile, { tileWidth } from "./AlgebraTile";
import BalanceScale, {
  BEAM_Y,
  LEFT_HOOK_X,
  PAN_H,
  PAN_RISE,
  PAN_SURFACE_Y,
  PAN_W,
  RIGHT_HOOK_X,
  SCALE_VB_H,
  SCALE_VB_W,
} from "./BalanceScale";
import TilePalette from "./TilePalette";
import TrashZone from "./TrashZone";
import {
  type DropTarget,
  useTileDrag,
} from "./useTileDrag";
import {
  addTileToPan,
  applyZeroPairs,
  balanceTiltDeg,
  divideBothSides,
  findZeroPairs,
  formatExpr,
  getAvailableDivisors,
  isBalancedWs,
  isSolved,
  removeTile,
  relocateTile,
  workspaceMass,
  workspaceToBalance,
  type BalanceProblem,
  type PanSide,
  type PlacedTile,
  type TileKind,
  type TileWorkspace,
} from "@/lib/linear-equation-balance-math";

type Props = {
  problem: BalanceProblem;
  workspace: TileWorkspace;
  onChange: (ws: TileWorkspace) => void;
  readOnly?: boolean;
  disabled?: boolean;
};

const TRASH_X = SCALE_VB_W - 52;
const TRASH_Y = SCALE_VB_H - 30;

function sortTilesForDisplay(tiles: PlacedTile[]): PlacedTile[] {
  const order: Record<TileKind, number> = {
    x: 0,
    neg_x: 1,
    one: 2,
    neg_one: 3,
  };
  return [...tiles].sort((a, b) => order[a.kind] - order[b.kind]);
}

function stackOnPan(tiles: PlacedTile[]): Map<string, { x: number; y: number }> {
  const sorted = sortTilesForDisplay(tiles);
  const positions = new Map<string, { x: number; y: number }>();
  const gap = 6;
  const rowH = 36;
  const maxW = PAN_W - 20;

  const rows: PlacedTile[][] = [];
  let row: PlacedTile[] = [];
  let rowW = 0;

  for (const tile of sorted) {
    const w = tileWidth(tile.kind, 0.88) + gap;
    if (rowW + w > maxW && row.length > 0) {
      rows.push(row);
      row = [];
      rowW = 0;
    }
    row.push(tile);
    rowW += w;
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

export default function BalanceWorkspace({
  problem,
  workspace,
  onChange,
  readOnly = false,
  disabled = false,
}: Props) {
  const uid = useId().replace(/:/g, "");
  const svgRef = useRef<SVGSVGElement>(null);
  const locked = readOnly || disabled;
  const xValue = problem.xValue;

  const [vanishing, setVanishing] = useState<Set<string>>(new Set());
  const [zeroFlash, setZeroFlash] = useState(false);
  const pendingRef = useRef<TileWorkspace | null>(null);

  const {
    drag,
    hoverTarget,
    startDrag,
    moveDrag,
    endDrag,
    cancelDrag,
  } = useTileDrag(svgRef);

  const hitTest = useCallback((x: number, y: number): DropTarget => {
    if (Math.hypot(x - TRASH_X, y - TRASH_Y) < 42) return "trash";
    const inLeft =
      x >= LEFT_HOOK_X - PAN_W / 2 - 10 &&
      x <= LEFT_HOOK_X + PAN_W / 2 + 10 &&
      y >= PAN_SURFACE_Y - 50 &&
      y <= PAN_SURFACE_Y + 40;
    const inRight =
      x >= RIGHT_HOOK_X - PAN_W / 2 - 10 &&
      x <= RIGHT_HOOK_X + PAN_W / 2 + 10 &&
      y >= PAN_SURFACE_Y - 50 &&
      y <= PAN_SURFACE_Y + 40;
    if (inLeft) return "left";
    if (inRight) return "right";
    return null;
  }, []);

  const applyWithZeroPairs = useCallback(
    (ws: TileWorkspace) => {
      const pairs = findZeroPairs(ws);
      if (pairs.length === 0) {
        onChange(ws);
        return;
      }

      const ids = new Set<string>();
      for (const p of pairs) {
        ids.add(p.tileA);
        ids.add(p.tileB);
      }
      setVanishing(ids);
      setZeroFlash(true);
      pendingRef.current = applyZeroPairs(ws);

      window.setTimeout(() => {
        setVanishing(new Set());
        setZeroFlash(false);
        if (pendingRef.current) {
          onChange(pendingRef.current);
          pendingRef.current = null;
        }
      }, 380);
    },
    [onChange],
  );

  const handleDrop = useCallback(
    (target: DropTarget) => {
      if (!drag || locked) return;

      let next = workspace;

      if (drag.source.type === "palette") {
        const kind = drag.source.kind;
        if (target === "left") next = addTileToPan(next, kind, "left");
        else if (target === "right") next = addTileToPan(next, kind, "right");
        else return;
      } else {
        const { tileId, from } = drag.source;
        if (target === "trash") {
          next = removeTile(next, tileId);
        } else if (target === "left" || target === "right") {
          if (from === target) return;
          next = relocateTile(next, tileId, target);
        } else {
          return;
        }
      }

      applyWithZeroPairs(next);
    },
    [drag, locked, workspace, applyWithZeroPairs],
  );

  const onPointerMove = (e: React.PointerEvent) => {
    moveDrag(e, hitTest);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const target = endDrag(e);
    if (target) handleDrop(target);
    else cancelDrag();
  };

  const tilt = balanceTiltDeg(workspace, xValue);
  const balanced = isBalancedWs(workspace, xValue);
  const solved = isSolved(workspace, xValue);
  const mass = workspaceMass(workspace, xValue);
  const expr = workspaceToBalance(workspace);
  const divisors = getAvailableDivisors(workspace);

  const leftPos = stackOnPan(workspace.left);
  const rightPos = stackOnPan(workspace.right);

  const renderPanTiles = (side: PanSide) => {
    const tiles = workspace[side];
    const positions = side === "left" ? leftPos : rightPos;

    return (
      <>
        {tiles.map((tile) => {
          const pos = positions.get(tile.id);
          if (!pos) return null;
          const isDragging =
            drag?.source.type === "pan" && drag.source.tileId === tile.id;
          if (isDragging) return null;

          return (
            <AlgebraTile
              key={tile.id}
              kind={tile.kind}
              x={pos.x}
              y={pos.y}
              scale={0.88}
              vanishing={vanishing.has(tile.id)}
              onPointerDown={
                locked
                  ? undefined
                  : (ev) => {
                      const w = tileWidth(tile.kind, 0.88);
                      startDrag(
                        ev,
                        {
                          type: "pan",
                          tileId: tile.id,
                          kind: tile.kind,
                          from: side,
                        },
                        w,
                        28,
                      );
                    }
              }
            />
          );
        })}
      </>
    );
  };

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-2xl border-2 border-wood/12 bg-gradient-to-b from-[#f0f4f8] to-[#FEF9F0]">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${SCALE_VB_W} ${SCALE_VB_H}`}
          className="mx-auto w-full max-w-4xl touch-none select-none"
          role="application"
          aria-label="양팔저울"
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <BalanceScale
            uid={uid}
            tilt={tilt}
            leftHighlight={hoverTarget === "left"}
            rightHighlight={hoverTarget === "right"}
            leftTiles={renderPanTiles("left")}
            rightTiles={renderPanTiles("right")}
          />

          {!locked ? (
            <TrashZone
              uid={uid}
              x={TRASH_X}
              y={TRASH_Y}
              active={hoverTarget === "trash"}
            />
          ) : null}

          {drag ? (
            <AlgebraTile
              kind={
                drag.source.type === "palette"
                  ? drag.source.kind
                  : drag.source.kind
              }
              x={drag.x - drag.offsetX}
              y={drag.y - drag.offsetY}
              scale={0.92}
              dragging
            />
          ) : null}

          {zeroFlash ? (
            <text
              x={SCALE_VB_W / 2}
              y={PAN_SURFACE_Y - 20}
              textAnchor="middle"
              fontSize={28}
              fontWeight="bold"
              fill="#2A9D8F"
              opacity={0.85}
            >
              0
            </text>
          ) : null}
        </svg>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-4 text-center text-xs font-bold text-wood">
        <span>
          왼쪽: {formatExpr(expr.left)} ({mass.left})
        </span>
        <span className="text-wood/40">|</span>
        <span>
          오른쪽: {formatExpr(expr.right)} ({mass.right})
        </span>
      </div>

      <div
        className={[
          "rounded-xl px-4 py-2.5 text-center text-sm font-bold",
          balanced
            ? solved
              ? "bg-mint/40 text-wood"
              : "bg-sky/30 text-wood"
            : "bg-[#e85d4c]/12 text-[#a63a1a]",
        ].join(" ")}
        role="status"
      >
        {!balanced
          ? "저울이 기울었어요. 양변에 똑같이 해야 등식이 유지돼요."
          : solved
            ? "⚖ 균형을 유지하며 x를 구했어요! 확인을 눌러 보세요."
            : "⚖ 균형을 유지하고 있어요. x 막대만 한쪽에 남겨 보세요."}
      </div>

      {!readOnly && divisors.length > 0 ? (
        <div className="flex flex-wrap justify-center gap-2">
          {divisors.map((n) => (
            <button
              key={n}
              type="button"
              disabled={locked}
              onClick={() => applyWithZeroPairs(divideBothSides(workspace, n))}
              className="rounded-lg bg-lavender/50 px-4 py-2 text-xs font-bold text-wood hover:bg-lavender/70 disabled:opacity-40"
            >
              양변을 {n}으로 나누기
            </button>
          ))}
        </div>
      ) : null}

      {!readOnly ? (
        <TilePalette
          allowNegatives={problem.allowNegatives}
          disabled={locked}
          onPalettePointerDown={(e, kind) => {
            const w = tileWidth(kind, 0.82);
            startDrag(e, { type: "palette", kind }, w, 28);
          }}
        />
      ) : null}
    </div>
  );
}
