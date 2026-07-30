"use client";

import {
  useCallback,
  useId,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import AlgebraTile, { tileWidth } from "./AlgebraTile";
import {
  addTileToPan,
  balanceTiltFromWorkspace,
  formatExpr,
  isBalanced,
  relocateTile,
  tileMass,
  workspaceMass,
  workspaceToBalance,
  type PanSide,
  type PlacedTile,
  type TileKind,
  type TileWorkspace,
} from "@/lib/linear-equation-balance-math";

const VB_W = 800;
const VB_H = 500;
const BEAM_Y = 110;
const FULCRUM_X = VB_W / 2;
const PAN_W = 250;
const CHAIN_LEN = 52;
const LEFT_HOOK_X = 120;
const RIGHT_HOOK_X = VB_W - 120;

type DragState = {
  tileId: string;
  from: PanSide;
  kind: TileKind;
  offsetX: number;
  offsetY: number;
  x: number;
  y: number;
};

type DropZone = PanSide | "off";

type Props = {
  workspace: TileWorkspace;
  onChange: (ws: TileWorkspace) => void;
  allowNegatives: boolean;
  readOnly?: boolean;
  disabled?: boolean;
};

function stackPositions(
  tiles: PlacedTile[],
  centerX: number,
  surfaceY: number,
): Map<string, { x: number; y: number }> {
  const out = new Map<string, { x: number; y: number }>();
  const gap = 5;
  const rowH = 34;
  const maxW = PAN_W - 16;

  const widths = tiles.map((t) => tileWidth(t.kind, 0.9));
  const rows: PlacedTile[][] = [];
  let current: PlacedTile[] = [];
  let rowW = 0;

  for (let i = 0; i < tiles.length; i++) {
    const w = widths[i]! + gap;
    if (rowW + w > maxW && current.length > 0) {
      rows.push(current);
      current = [];
      rowW = 0;
    }
    current.push(tiles[i]!);
    rowW += w;
  }
  if (current.length) rows.push(current);

  rows.forEach((rowTiles, row) => {
    const rowWidth =
      rowTiles.reduce((s, t) => s + tileWidth(t.kind, 0.9) + gap, 0) - gap;
    let x = centerX - rowWidth / 2;
    const y = surfaceY - (rows.length - row) * rowH;
    for (const tile of rowTiles) {
      out.set(tile.id, { x, y });
      x += tileWidth(tile.kind, 0.9) + gap;
    }
  });

  return out;
}

function hitDropZone(x: number, y: number): DropZone {
  const test = (cx: number) =>
    x >= cx - PAN_W / 2 - 10 &&
    x <= cx + PAN_W / 2 + 10 &&
    y >= BEAM_Y + CHAIN_LEN - 30 &&
    y <= BEAM_Y + CHAIN_LEN + 100;
  if (test(LEFT_HOOK_X)) return "left";
  if (test(RIGHT_HOOK_X)) return "right";
  return "off";
}

function applyDrop(ws: TileWorkspace, tileId: string, zone: DropZone): TileWorkspace {
  return relocateTile(ws, tileId, zone);
}

function previewWs(
  ws: TileWorkspace,
  drag: DragState,
  zone: DropZone,
): TileWorkspace {
  return relocateTile(ws, drag.tileId, zone);
}

export default function BalanceWorkspace({
  workspace,
  onChange,
  allowNegatives,
  readOnly = false,
  disabled = false,
}: Props) {
  const uid = useId().replace(/:/g, "");
  const svgRef = useRef<SVGSVGElement>(null);
  const locked = readOnly || disabled;

  const [drag, setDrag] = useState<DragState | null>(null);
  const [hoverZone, setHoverZone] = useState<DropZone | null>(null);

  const clientToSvg = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    return pt.matrixTransform(ctm.inverse());
  }, []);

  const activeZone = drag
    ? hoverZone ?? hitDropZone(drag.x, drag.y)
    : null;

  const displayWs =
    drag && activeZone ? previewWs(workspace, drag, activeZone) : workspace;

  const tilt = balanceTiltFromWorkspace(displayWs);
  const balance = workspaceToBalance(displayWs);
  const mass = workspaceMass(displayWs);
  const balanced = isBalanced(balance);

  const panSurfaceY = BEAM_Y + CHAIN_LEN + 8;

  const startDrag = (
    e: ReactPointerEvent,
    tile: PlacedTile,
    from: PanSide,
  ) => {
    if (locked) return;
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const { x, y } = clientToSvg(e.clientX, e.clientY);
    const w = tileWidth(tile.kind, 0.9);
    setDrag({
      tileId: tile.id,
      from,
      kind: tile.kind,
      offsetX: w / 2,
      offsetY: 16,
      x,
      y,
    });
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    if (!drag) return;
    const p = clientToSvg(e.clientX, e.clientY);
    setDrag((d) => (d ? { ...d, x: p.x, y: p.y } : null));
    setHoverZone(hitDropZone(p.x, p.y));
  };

  const endDrag = (e: ReactPointerEvent) => {
    if (!drag) return;
    const p = clientToSvg(e.clientX, e.clientY);
    const zone = hitDropZone(p.x, p.y);
    onChange(applyDrop(workspace, drag.tileId, zone));
    setDrag(null);
    setHoverZone(null);
    try {
      (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
  };

  const paletteKinds: TileKind[] = allowNegatives
    ? ["x", "neg_x", "one", "neg_one"]
    : ["x", "one"];

  const beamId = `beam-${uid}`;
  const panId = `pan-${uid}`;

  const renderPanAssembly = (side: PanSide, hookX: number) => {
    const tiles = displayWs[side];
    const panLocal = stackPositions(tiles, 0, -32);
    const highlighted = Boolean(drag && activeZone === side);

    return (
      <g key={side} transform={`translate(${hookX}, ${BEAM_Y + 6})`}>
        {/* chains */}
        <line x1={0} y1={0} x2={-16} y2={CHAIN_LEN} stroke="#7a5c3a" strokeWidth={2.2} />
        <line x1={0} y1={0} x2={0} y2={CHAIN_LEN} stroke="#8B5E3C" strokeWidth={2.5} />
        <line x1={0} y1={0} x2={16} y2={CHAIN_LEN} stroke="#7a5c3a" strokeWidth={2.2} />

        {/* pan stays level while beam tilts */}
        <g transform={`translate(0, ${CHAIN_LEN}) rotate(${-tilt})`}>
          <ellipse
            cx={0}
            cy={14}
            rx={PAN_W / 2 + 6}
            ry={9}
            fill="rgba(61,44,30,0.1)"
          />
          <path
            d={`M ${-PAN_W / 2} 4 Q ${-PAN_W / 2} -6 0 -6 Q ${PAN_W / 2} -6 ${PAN_W / 2} 4
               L ${PAN_W / 2 - 6} 12 Q 0 20 ${-PAN_W / 2 + 6} 12 Z`}
            fill={`url(#${panId})`}
            stroke={highlighted ? "#2A9D8F" : "#8B5E3C"}
            strokeWidth={highlighted ? 2.5 : 2}
          />
          <ellipse
            cx={0}
            cy={-4}
            rx={PAN_W / 2}
            ry={6}
            fill="none"
            stroke="#b8956a"
            strokeWidth={2.5}
          />

          {tiles.map((tile) => {
            if (drag?.tileId === tile.id) return null;
            const pos = panLocal.get(tile.id);
            if (!pos) return null;
            return (
              <AlgebraTile
                key={tile.id}
                kind={tile.kind}
                x={pos.x}
                y={pos.y}
                scale={0.9}
                lifted={highlighted}
                onPointerDown={(ev) => startDrag(ev, tile, side)}
              />
            );
          })}
        </g>
      </g>
    );
  };

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-2xl border-2 border-wood/15 bg-gradient-to-b from-[#e8f4fc] to-[#FEF9F0]">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className="mx-auto w-full max-w-4xl touch-none select-none"
          role="application"
          aria-label="양팔저울"
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <defs>
            <linearGradient id={beamId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d4b896" />
              <stop offset="100%" stopColor="#8B5E3C" />
            </linearGradient>
            <linearGradient id={panId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fffdf8" />
              <stop offset="100%" stopColor="#e5d9c5" />
            </linearGradient>
          </defs>

          {/* lab bench */}
          <rect x={0} y={VB_H - 40} width={VB_W} height={40} fill="#ddd0bc" />
          <rect x={0} y={VB_H - 42} width={VB_W} height={3} fill="#c4b5a0" />

          {/* stand */}
          <rect
            x={FULCRUM_X - 50}
            y={VB_H - 36}
            width={100}
            height={12}
            rx={3}
            fill="#6B4423"
          />
          <rect
            x={FULCRUM_X - 8}
            y={BEAM_Y + 20}
            width={16}
            height={VB_H - 36 - BEAM_Y - 20}
            fill="#a67c52"
            stroke="#6B4423"
            strokeWidth={1}
          />

          {/* tilting beam + pans */}
          <g transform={`rotate(${tilt}, ${FULCRUM_X}, ${BEAM_Y})`}>
            <rect
              x={70}
              y={BEAM_Y - 6}
              width={VB_W - 140}
              height={12}
              rx={6}
              fill={`url(#${beamId})`}
              stroke="#6B4423"
              strokeWidth={1.5}
            />
            <circle
              cx={LEFT_HOOK_X}
              cy={BEAM_Y + 5}
              r={4.5}
              fill="#FFD76A"
              stroke="#C9A227"
              strokeWidth={1.5}
            />
            <circle
              cx={RIGHT_HOOK_X}
              cy={BEAM_Y + 5}
              r={4.5}
              fill="#FFD76A"
              stroke="#C9A227"
              strokeWidth={1.5}
            />
            {renderPanAssembly("left", LEFT_HOOK_X)}
            {renderPanAssembly("right", RIGHT_HOOK_X)}
          </g>

          {/* fulcrum */}
          <circle
            cx={FULCRUM_X}
            cy={BEAM_Y}
            r={11}
            fill="#FFD76A"
            stroke="#C9A227"
            strokeWidth={2}
          />

          {/* floating drag ghost */}
          {drag ? (
            <AlgebraTile
              kind={drag.kind}
              x={drag.x - drag.offsetX}
              y={drag.y - drag.offsetY}
              scale={0.95}
              dragging
            />
          ) : null}

          {drag && activeZone === "off" ? (
            <g opacity={0.9}>
              <rect
                x={FULCRUM_X - 110}
                y={VB_H - 95}
                width={220}
                height={48}
                rx={10}
                fill="rgba(232,93,76,0.1)"
                stroke="#e85d4c"
                strokeWidth={2}
                strokeDasharray="5 4"
              />
              <text
                x={FULCRUM_X}
                y={VB_H - 66}
                textAnchor="middle"
                fontSize={12}
                fontWeight="bold"
                fill="#a63a1a"
              >
                여기에 놓으면 팬에서 치워져요
              </text>
            </g>
          ) : null}

          {/* expression labels */}
          <text
            x={LEFT_HOOK_X}
            y={panSurfaceY + 72}
            textAnchor="middle"
            fontSize={12}
            fontWeight="bold"
            fill="#8B5E3C"
          >
            왼쪽: {formatExpr(balance.left)}
          </text>
          <text
            x={RIGHT_HOOK_X}
            y={panSurfaceY + 72}
            textAnchor="middle"
            fontSize={12}
            fontWeight="bold"
            fill="#8B5E3C"
          >
            오른쪽: {formatExpr(balance.right)}
          </text>
        </svg>
      </div>

      <div
        className={[
          "rounded-xl px-4 py-2.5 text-center text-sm font-bold",
          balanced ? "bg-mint/35 text-wood" : "bg-[#e85d4c]/12 text-[#a63a1a]",
        ].join(" ")}
        role="status"
      >
        {balanced ? (
          <>⚖ 저울이 균형을 이뤄요!</>
        ) : (
          <>
            저울이 기울어 있어요 (왼쪽 {mass.left} · 오른쪽 {mass.right}) — 막대를
            드래그해서 맞춰 보세요
          </>
        )}
      </div>

      {!readOnly && !locked ? (
        <div className="rounded-xl border-2 border-wood/12 bg-cream/90 p-3">
          <p className="mb-2 text-center text-xs font-bold text-wood/65">
            막대를 길게 눌러 드래그하세요 · 필요하면 아래에서 막대를 추가할 수 있어요
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            {paletteKinds.map((kind) => (
              <div key={kind} className="flex flex-col items-center gap-1">
                <svg
                  width={kind.includes("x") ? 100 : 44}
                  height={38}
                  className="overflow-visible"
                >
                  <AlgebraTile kind={kind} scale={0.78} />
                </svg>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => onChange(addTileToPan(workspace, kind, "left"))}
                    className="rounded-md bg-mint/45 px-2 py-0.5 text-[10px] font-bold text-wood"
                  >
                    왼쪽
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange(addTileToPan(workspace, kind, "right"))}
                    className="rounded-md bg-sky/45 px-2 py-0.5 text-[10px] font-bold text-wood"
                  >
                    오른쪽
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
