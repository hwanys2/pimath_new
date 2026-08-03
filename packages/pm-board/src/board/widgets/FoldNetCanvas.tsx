"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  SHAPE_DEFS,
  applyMagnetSnap,
  componentContaining,
  findMagnetCandidates,
  pointInPolygon,
  tileBounds,
  worldEdges,
  worldVertices,
  type FoldTile,
  type Join,
  type MagnetCandidate,
} from "../../lib/fold-net";

type DragMode =
  | {
      type: "move";
      ids: string[];
      ox: number;
      oy: number;
      origins: Record<string, { x: number; y: number }>;
    }
  | {
      type: "rotate";
      id: string;
      cx: number;
      cy: number;
      startAngle: number;
      baseRot: number;
    }
  | { type: "scale"; id: string; startDist: number; baseScale: number }
  | { type: "marquee"; x0: number; y0: number; x1: number; y1: number };

type Props = {
  tiles: FoldTile[];
  joins: Join[];
  selectedIds: string[];
  connectedIds: string[];
  onChangeTiles: (tiles: FoldTile[]) => void;
  onChangeJoins: (joins: Join[]) => void;
  onSelect: (ids: string[]) => void;
};

export default function FoldNetCanvas({
  tiles,
  joins,
  selectedIds,
  connectedIds,
  onChangeTiles,
  onChangeJoins,
  onSelect,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<DragMode | null>(null);
  const [preview, setPreview] = useState<MagnetCandidate | null>(null);
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);

  const toLocal = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: clientX, y: clientY };
    const rect = svg.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  const hitTile = useCallback(
    (p: { x: number; y: number }) => {
      for (let i = tiles.length - 1; i >= 0; i--) {
        if (pointInPolygon(p, worldVertices(tiles[i]))) return tiles[i];
      }
      return null;
    },
    [tiles],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      const p = toLocal(e.clientX, e.clientY);
      const target = e.target as SVGElement;
      const handle = target.dataset.handle;
      const tileId = target.dataset.tileId;

      if (handle === "rotate" && tileId) {
        const tile = tiles.find((t) => t.id === tileId);
        if (!tile) return;
        e.stopPropagation();
        (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
        setDrag({
          type: "rotate",
          id: tileId,
          cx: tile.x,
          cy: tile.y,
          startAngle: Math.atan2(p.y - tile.y, p.x - tile.x),
          baseRot: tile.rotation,
        });
        return;
      }
      if (handle === "scale" && tileId) {
        const tile = tiles.find((t) => t.id === tileId);
        if (!tile) return;
        e.stopPropagation();
        setDrag({
          type: "scale",
          id: tileId,
          startDist: Math.hypot(p.x - tile.x, p.y - tile.y) || 1,
          baseScale: tile.scale,
        });
        return;
      }

      const hit = hitTile(p);
      if (!hit) {
        setDrag({ type: "marquee", x0: p.x, y0: p.y, x1: p.x, y1: p.y });
        if (!e.shiftKey) onSelect([]);
        return;
      }

      let nextSelection: string[];
      if (e.shiftKey) {
        nextSelection = selected.has(hit.id)
          ? selectedIds.filter((id) => id !== hit.id)
          : [...selectedIds, hit.id];
        onSelect(nextSelection);
        if (!nextSelection.includes(hit.id)) return;
      } else if (selected.has(hit.id) && selectedIds.length > 1) {
        nextSelection = selectedIds;
      } else {
        nextSelection = [hit.id];
        onSelect(nextSelection);
      }

      // Drag whole joined component when moving a single selection that is joined
      const dragIds =
        nextSelection.length > 1
          ? nextSelection
          : componentContaining(tiles, joins, hit.id);

      const origins: Record<string, { x: number; y: number }> = {};
      for (const id of dragIds) {
        const t = tiles.find((x) => x.id === id);
        if (t) origins[id] = { x: t.x, y: t.y };
      }
      setDrag({ type: "move", ids: dragIds, ox: p.x, oy: p.y, origins });
    },
    [tiles, joins, selected, selectedIds, hitTile, toLocal, onSelect],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!drag) return;
      const p = toLocal(e.clientX, e.clientY);
      if (drag.type === "marquee") {
        setDrag({ ...drag, x1: p.x, y1: p.y });
        return;
      }
      if (drag.type === "rotate") {
        const ang = Math.atan2(p.y - drag.cy, p.x - drag.cx);
        const next = tiles.map((t) =>
          t.id === drag.id
            ? { ...t, rotation: drag.baseRot + (ang - drag.startAngle) }
            : t,
        );
        onChangeTiles(next);
        setPreview(
          findMagnetCandidates(next, joins, {
            movingTileIds: new Set([drag.id]),
          })[0] ?? null,
        );
        return;
      }
      if (drag.type === "scale") {
        const tile = tiles.find((t) => t.id === drag.id);
        if (!tile) return;
        const distNow = Math.hypot(p.x - tile.x, p.y - tile.y) || 1;
        const scale = Math.max(
          24,
          Math.min(160, drag.baseScale * (distNow / drag.startDist)),
        );
        const next = tiles.map((t) =>
          t.id === drag.id ? { ...t, scale } : t,
        );
        onChangeTiles(next);
        setPreview(
          findMagnetCandidates(next, joins, {
            movingTileIds: new Set([drag.id]),
          })[0] ?? null,
        );
        return;
      }
      if (drag.type === "move") {
        const dx = p.x - drag.ox;
        const dy = p.y - drag.oy;
        const next = tiles.map((t) => {
          const o = drag.origins[t.id];
          if (!o) return t;
          return { ...t, x: o.x + dx, y: o.y + dy };
        });
        onChangeTiles(next);
        setPreview(
          findMagnetCandidates(next, joins, {
            movingTileIds: new Set(drag.ids),
          })[0] ?? null,
        );
      }
    },
    [drag, tiles, joins, toLocal, onChangeTiles],
  );

  const onPointerUp = useCallback(() => {
    if (!drag) return;
    if (drag.type === "marquee") {
      const minX = Math.min(drag.x0, drag.x1);
      const maxX = Math.max(drag.x0, drag.x1);
      const minY = Math.min(drag.y0, drag.y1);
      const maxY = Math.max(drag.y0, drag.y1);
      onSelect(
        tiles
          .filter((t) => {
            const b = tileBounds(t);
            return (
              b.maxX >= minX &&
              b.minX <= maxX &&
              b.maxY >= minY &&
              b.minY <= maxY
            );
          })
          .map((t) => t.id),
      );
      setDrag(null);
      setPreview(null);
      return;
    }

    const movingIds =
      drag.type === "move"
        ? drag.ids
        : drag.type === "rotate" || drag.type === "scale"
          ? [drag.id]
          : [];
    if (movingIds.length) {
      const { tiles: snapped, join } = applyMagnetSnap(tiles, joins, movingIds);
      onChangeTiles(snapped);
      if (join) onChangeJoins([...joins, join]);
    }
    setDrag(null);
    setPreview(null);
  }, [drag, tiles, joins, onChangeTiles, onChangeJoins, onSelect]);

  const joinSegments = useMemo(() => {
    const segs: { x1: number; y1: number; x2: number; y2: number; key: string }[] =
      [];
    for (const j of joins) {
      const ta = tiles.find((t) => t.id === j.a.tileId);
      const tb = tiles.find((t) => t.id === j.b.tileId);
      if (!ta || !tb) continue;
      const ea = worldEdges(ta)[j.a.edgeIndex];
      const eb = worldEdges(tb)[j.b.edgeIndex];
      if (!ea || !eb) continue;
      segs.push({
        key: j.id,
        x1: ea.mid.x,
        y1: ea.mid.y,
        x2: eb.mid.x,
        y2: eb.mid.y,
      });
    }
    return segs;
  }, [tiles, joins]);

  const previewEdges = useMemo(() => {
    if (!preview) return null;
    const ta = tiles.find((t) => t.id === preview.a.tileId);
    const tb = tiles.find((t) => t.id === preview.b.tileId);
    if (!ta || !tb) return null;
    return {
      a: worldEdges(ta)[preview.a.edgeIndex],
      b: worldEdges(tb)[preview.b.edgeIndex],
    };
  }, [preview, tiles]);

  void connectedIds;

  return (
    <svg
      ref={svgRef}
      className="h-full w-full touch-none select-none rounded-xl bg-[#1e2430]"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      <defs>
        <pattern
          id="fn-grid"
          width="24"
          height="24"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M 24 0 L 0 0 0 24"
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="1"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#fn-grid)" />

      {joinSegments.map((s) => (
        <line
          key={s.key}
          x1={s.x1}
          y1={s.y1}
          x2={s.x2}
          y2={s.y2}
          stroke="#fbbf24"
          strokeWidth={3}
          strokeLinecap="round"
          opacity={0.85}
        />
      ))}

      {previewEdges && (
        <>
          <line
            x1={previewEdges.a.a.x}
            y1={previewEdges.a.a.y}
            x2={previewEdges.a.b.x}
            y2={previewEdges.a.b.y}
            stroke="#34d399"
            strokeWidth={4}
            strokeLinecap="round"
          />
          <line
            x1={previewEdges.b.a.x}
            y1={previewEdges.b.a.y}
            x2={previewEdges.b.b.x}
            y2={previewEdges.b.b.y}
            stroke="#34d399"
            strokeWidth={4}
            strokeLinecap="round"
          />
        </>
      )}

      {tiles.map((tile) => {
        const verts = worldVertices(tile);
        const points = verts.map((v) => `${v.x},${v.y}`).join(" ");
        const def = SHAPE_DEFS[tile.kind];
        const isSel = selected.has(tile.id);
        const b = tileBounds(tile);
        const handleX = (b.minX + b.maxX) / 2;
        const handleY = b.minY - 14;
        const scaleX = b.maxX + 6;
        const scaleY = b.maxY + 6;
        return (
          <g key={tile.id}>
            <polygon
              points={points}
              fill={def.color}
              stroke={isSel ? "#fff" : "rgba(255,255,255,0.7)"}
              strokeWidth={isSel ? 3 : 1.5}
              opacity={0.95}
            />
            {isSel && (
              <>
                <circle
                  data-handle="rotate"
                  data-tile-id={tile.id}
                  cx={handleX}
                  cy={handleY}
                  r={7}
                  fill="#fbbf24"
                  stroke="#fff"
                  strokeWidth={1.5}
                  className="cursor-grab"
                />
                <line
                  x1={tile.x}
                  y1={tile.y}
                  x2={handleX}
                  y2={handleY}
                  stroke="#fbbf24"
                  strokeWidth={1}
                  opacity={0.7}
                />
                <rect
                  data-handle="scale"
                  data-tile-id={tile.id}
                  x={scaleX - 5}
                  y={scaleY - 5}
                  width={10}
                  height={10}
                  rx={2}
                  fill="#94a3b8"
                  stroke="#fff"
                  strokeWidth={1}
                  className="cursor-nwse-resize"
                />
              </>
            )}
          </g>
        );
      })}

      {drag?.type === "marquee" && (
        <rect
          x={Math.min(drag.x0, drag.x1)}
          y={Math.min(drag.y0, drag.y1)}
          width={Math.abs(drag.x1 - drag.x0)}
          height={Math.abs(drag.y1 - drag.y0)}
          fill="rgba(96,165,250,0.15)"
          stroke="#60a5fa"
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />
      )}
    </svg>
  );
}
