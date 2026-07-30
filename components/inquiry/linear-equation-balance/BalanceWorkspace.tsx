"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import AlgebraTile, { tileWidth } from "./AlgebraTile";
import BalanceScale, {
  BEAM_Y,
  FULCRUM_X,
  LEFT_HOOK_X,
  PAN_SURFACE_Y,
  PAN_W,
  RIGHT_HOOK_X,
  SCALE_VB_H,
  SCALE_VB_W,
  TRASH_X,
  TRASH_Y,
} from "./BalanceScale";
import ImbalanceCallout from "./ImbalanceCallout";
import TilePalette from "./TilePalette";
import TrashZone, { TRASH_HIT_R } from "./TrashZone";
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
  flipBothSides,
  formatBalanceAction,
  formatExpr,
  getPedagogicalScaleOperations,
  isBalancedWs,
  isSolved,
  multiplyBothSides,
  removeTile,
  relocateTile,
  workspaceMass,
  workspaceToBalance,
  type BalanceAction,
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

function sortTilesForDisplay(tiles: PlacedTile[]): PlacedTile[] {
  const order: Record<TileKind, number> = {
    x: 0,
    half_x: 1,
    neg_x: 2,
    neg_half_x: 3,
    one: 4,
    neg_one: 5,
  };
  return [...tiles].sort((a, b) => order[a.kind] - order[b.kind]);
}

function findTile(
  ws: TileWorkspace,
  tileId: string,
): { side: PanSide; kind: TileKind } | null {
  const left = ws.left.find((t) => t.id === tileId);
  if (left) return { side: "left", kind: left.kind };
  const right = ws.right.find((t) => t.id === tileId);
  if (right) return { side: "right", kind: right.kind };
  return null;
}

function stackOnPan(tiles: PlacedTile[]): Map<string, { x: number; y: number }> {
  const sorted = sortTilesForDisplay(tiles);
  const positions = new Map<string, { x: number; y: number }>();
  const gap = 6;
  const rowH = 36;
  const maxW = PAN_W - 16;

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
  const [flipping, setFlipping] = useState(false);
  const [imbalanceCause, setImbalanceCause] = useState<BalanceAction | null>(
    null,
  );
  const pendingRef = useRef<TileWorkspace | null>(null);

  useEffect(() => {
    setImbalanceCause(null);
  }, [problem.id]);

  const {
    drag,
    hoverTarget,
    startDrag,
    moveDrag,
    endDrag,
    cancelDrag,
  } = useTileDrag(svgRef);

  const hitTest = useCallback((x: number, y: number): DropTarget => {
    if (Math.hypot(x - TRASH_X, y - TRASH_Y) < TRASH_HIT_R) return "trash";
    const inLeft =
      x >= LEFT_HOOK_X - PAN_W / 2 - 12 &&
      x <= LEFT_HOOK_X + PAN_W / 2 + 12 &&
      y >= PAN_SURFACE_Y - 110 &&
      y <= PAN_SURFACE_Y + 30;
    const inRight =
      x >= RIGHT_HOOK_X - PAN_W / 2 - 12 &&
      x <= RIGHT_HOOK_X + PAN_W / 2 + 12 &&
      y >= PAN_SURFACE_Y - 110 &&
      y <= PAN_SURFACE_Y + 30;
    if (inLeft) return "left";
    if (inRight) return "right";
    return null;
  }, []);

  const commitWorkspace = useCallback(
    (next: TileWorkspace, action: BalanceAction) => {
      const wasBalanced = isBalancedWs(workspace, xValue);
      const pairs = findZeroPairs(next);
      const finalWs = pairs.length > 0 ? applyZeroPairs(next) : next;
      const nowBalanced = isBalancedWs(finalWs, xValue);

      if (wasBalanced && !nowBalanced) {
        setImbalanceCause(action);
      } else if (nowBalanced) {
        setImbalanceCause(null);
      }

      if (pairs.length === 0) {
        onChange(next);
        return;
      }

      const ids = new Set<string>();
      for (const p of pairs) {
        ids.add(p.tileA);
        ids.add(p.tileB);
      }
      setVanishing(ids);
      setZeroFlash(true);
      pendingRef.current = finalWs;

      window.setTimeout(() => {
        setVanishing(new Set());
        setZeroFlash(false);
        if (pendingRef.current) {
          onChange(pendingRef.current);
          pendingRef.current = null;
        }
      }, 380);
    },
    [onChange, workspace, xValue],
  );

  const handleDrop = useCallback(
    (target: DropTarget) => {
      if (!drag || locked) return;

      let next = workspace;
      let action: BalanceAction | null = null;

      if (drag.source.type === "palette") {
        const kind = drag.source.kind;
        if (target === "left" || target === "right") {
          next = addTileToPan(next, kind, target);
          action = { type: "add", kind, side: target };
        } else {
          return;
        }
      } else {
        const { tileId, from, kind } = drag.source;
        if (target === "trash") {
          const info = findTile(workspace, tileId);
          if (!info) return;
          next = removeTile(next, tileId);
          action = { type: "remove", kind: info.kind, side: info.side };
        } else if (target === "left" || target === "right") {
          if (from === target) return;
          next = relocateTile(next, tileId, target);
          action = { type: "move", kind, from, to: target };
        } else {
          return;
        }
      }

      if (action) commitWorkspace(next, action);
    },
    [drag, locked, workspace, commitWorkspace],
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
  const scaleOps = getPedagogicalScaleOperations(workspace, problem);
  const showScaleOps =
    scaleOps.flip ||
    scaleOps.multiply.length > 0 ||
    scaleOps.divide.length > 0;

  const handleFlip = useCallback(() => {
    if (locked || !scaleOps.flip || flipping) return;
    setFlipping(true);
    window.setTimeout(() => {
      setFlipping(false);
      commitWorkspace(flipBothSides(workspace), { type: "flip" });
    }, 320);
  }, [locked, scaleOps.flip, flipping, workspace, commitWorkspace]);

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
              flipping={flipping}
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
      <div className="overflow-visible rounded-2xl border-2 border-wood/12 bg-gradient-to-b from-[#f0f4f8] to-[#FEF9F0] p-2 sm:p-3">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${SCALE_VB_W} ${SCALE_VB_H}`}
          preserveAspectRatio="xMidYMid meet"
          className="mx-auto w-full max-w-full touch-none select-none"
          style={{ minHeight: 340, display: "block" }}
          role="application"
          aria-label="양팔저울 작업 공간"
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

          {!balanced && imbalanceCause ? (
            <ImbalanceCallout
              x={FULCRUM_X}
              y={BEAM_Y - 62}
              actionText={formatBalanceAction(imbalanceCause)}
            />
          ) : null}

          {!locked ? (
            <TrashZone
              uid={uid}
              x={TRASH_X}
              y={TRASH_Y}
              active={hoverTarget === "trash"}
            />
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
              y={PAN_SURFACE_Y - 40}
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

        {!readOnly && showScaleOps ? (
          <div className="mt-1 space-y-2 border-t border-wood/10 px-2 pt-3">
            {scaleOps.flip ? (
              <div className="flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  disabled={locked || flipping}
                  onClick={handleFlip}
                  className="rounded-lg bg-[#e85d4c]/15 px-4 py-2 text-xs font-bold text-[#a63a1a] shadow-sm hover:bg-[#e85d4c]/25 disabled:opacity-40"
                >
                  양변 부호 바꾸기 (−1×)
                </button>
              </div>
            ) : null}
            {scaleOps.multiply.length > 0 ? (
              <div className="flex flex-wrap justify-center gap-2">
                {scaleOps.multiply.map((n) => (
                  <button
                    key={`mul-${n}`}
                    type="button"
                    disabled={locked}
                    onClick={() =>
                      commitWorkspace(multiplyBothSides(workspace, n), {
                        type: "multiply",
                        factor: n,
                      })
                    }
                    className="rounded-lg bg-sky/50 px-4 py-2 text-xs font-bold text-wood shadow-sm hover:bg-sky/70 disabled:opacity-40"
                  >
                    양변을 {n}으로 곱하기
                  </button>
                ))}
              </div>
            ) : null}
            {scaleOps.divide.length > 0 ? (
              <div className="flex flex-wrap justify-center gap-2">
                {scaleOps.divide.map((n) => (
                  <button
                    key={`div-${n}`}
                    type="button"
                    disabled={locked}
                    onClick={() =>
                      commitWorkspace(divideBothSides(workspace, n), {
                        type: "divide",
                        divisor: n,
                      })
                    }
                    className="rounded-lg bg-lavender/60 px-4 py-2 text-xs font-bold text-wood shadow-sm hover:bg-lavender/80 disabled:opacity-40"
                  >
                    양변을 {n}으로 나누기
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
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
    </div>
  );
}
