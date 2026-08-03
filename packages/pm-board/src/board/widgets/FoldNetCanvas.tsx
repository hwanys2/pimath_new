"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  SHAPE_DEFS,
  applyMagnetSnap,
  componentContaining,
  detachMovingJoins,
  edgeCount,
  joinEdgesAligned,
  pointInPolygon,
  previewSnapTiles,
  pruneSeparatedJoins,
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
      origins: Record<string, { x: number; y: number; rotation: number }>;
    }
  | {
      type: "rotate";
      ids: string[];
      cx: number;
      cy: number;
      startAngle: number;
      baseRots: Record<string, number>;
      origins: Record<string, { x: number; y: number }>;
    }
  | {
      type: "scale";
      ids: string[];
      cx: number;
      cy: number;
      startDist: number;
      baseScales: Record<string, number>;
      baseEdgeScales: Record<string, number[] | undefined>;
    }
  | {
      type: "scaleX";
      id: string;
      cx: number;
      startDist: number;
      baseScaleX: number;
    }
  | {
      type: "scaleY";
      id: string;
      cy: number;
      startDist: number;
      baseScaleY: number;
    }
  | { type: "marquee"; x0: number; y0: number; x1: number; y1: number };

type Props = {
  tiles: FoldTile[];
  joins: Join[];
  selectedIds: string[];
  connectedIds: string[];
  onChangeTiles: (tiles: FoldTile[]) => void;
  onChangeJoins: (joins: Join[]) => void;
  onSelect: (ids: string[]) => void;
  /** When true, polygons are invisible but still hit-testable (R3F renders geometry). */
  geometryHidden?: boolean;
};

function supportsAxisScale(kind: FoldTile["kind"]): boolean {
  return kind === "rectangle" || kind === "square";
}

function ensureEdgeScale(tile: FoldTile): number[] {
  const n = edgeCount(tile.kind);
  if (tile.edgeScale && tile.edgeScale.length === n) return [...tile.edgeScale];
  return Array.from({ length: n }, () => 1);
}

export default function FoldNetCanvas({
  tiles,
  joins,
  selectedIds,
  connectedIds,
  onChangeTiles,
  onChangeJoins,
  onSelect,
  geometryHidden = false,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragTilesRef = useRef<FoldTile[]>(tiles);
  const joinsRef = useRef(joins);
  const [drag, setDrag] = useState<DragMode | null>(null);
  const [preview, setPreview] = useState<MagnetCandidate | null>(null);
  const [snapPreviewTiles, setSnapPreviewTiles] = useState<FoldTile[] | null>(
    null,
  );
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const connected = useMemo(() => new Set(connectedIds), [connectedIds]);

  dragTilesRef.current = tiles;
  joinsRef.current = joins;

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

  const updateSnapPreview = useCallback(
    (
      nextTiles: FoldTile[],
      movingIds: string[],
      pointer?: { x: number; y: number },
    ) => {
      dragTilesRef.current = nextTiles;
      const { tiles: snapped, candidate } = previewSnapTiles(
        nextTiles,
        joins,
        movingIds,
        pointer,
      );
      setPreview(candidate);
      setSnapPreviewTiles(candidate ? snapped : null);
    },
    [joins],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      const p = toLocal(e.clientX, e.clientY);
      const target = e.target as SVGElement;
      const handle = target.dataset.handle;
      const tileId = target.dataset.tileId;

      if (handle && tileId) {
        const tile = tiles.find((t) => t.id === tileId);
        if (!tile) return;
        e.stopPropagation();
        (e.currentTarget as Element).setPointerCapture?.(e.pointerId);

        const dragIds =
          selectedIds.includes(tileId) && selectedIds.length > 0
            ? selectedIds
            : [tileId];

        const brokenJoins = detachMovingJoins(joinsRef.current, dragIds);
        if (brokenJoins.length !== joinsRef.current.length) {
          onChangeJoins(brokenJoins);
        }

        if (handle === "rotate") {
          const baseRots: Record<string, number> = {};
          const origins: Record<string, { x: number; y: number }> = {};
          for (const id of dragIds) {
            const t = tiles.find((x) => x.id === id);
            if (t) {
              baseRots[id] = t.rotation;
              origins[id] = { x: t.x, y: t.y };
            }
          }
          setDrag({
            type: "rotate",
            ids: dragIds,
            cx: tile.x,
            cy: tile.y,
            startAngle: Math.atan2(p.y - tile.y, p.x - tile.x),
            baseRots,
            origins,
          });
          return;
        }

        if (handle === "scale") {
          const baseScales: Record<string, number> = {};
          const baseEdgeScales: Record<string, number[] | undefined> = {};
          for (const id of dragIds) {
            const t = tiles.find((x) => x.id === id);
            if (t) {
              baseScales[id] = t.scale;
              baseEdgeScales[id] = t.edgeScale;
            }
          }
          setDrag({
            type: "scale",
            ids: dragIds,
            cx: tile.x,
            cy: tile.y,
            startDist: Math.hypot(p.x - tile.x, p.y - tile.y) || 1,
            baseScales,
            baseEdgeScales,
          });
          return;
        }

        if (handle === "scaleX" && supportsAxisScale(tile.kind)) {
          const es = ensureEdgeScale(tile);
          setDrag({
            type: "scaleX",
            id: tileId,
            cx: tile.x,
            startDist: Math.abs(p.x - tile.x) || 1,
            baseScaleX: es[1] ?? 1,
          });
          return;
        }

        if (handle === "scaleY" && supportsAxisScale(tile.kind)) {
          const es = ensureEdgeScale(tile);
          setDrag({
            type: "scaleY",
            id: tileId,
            cy: tile.y,
            startDist: Math.abs(p.y - tile.y) || 1,
            baseScaleY: es[0] ?? 1,
          });
        }
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

      const dragIds = nextSelection;

      const brokenJoins = detachMovingJoins(joinsRef.current, dragIds);
      if (brokenJoins.length !== joinsRef.current.length) {
        onChangeJoins(brokenJoins);
      }

      const origins: Record<string, { x: number; y: number; rotation: number }> =
        {};
      for (const id of dragIds) {
        const t = tiles.find((x) => x.id === id);
        if (t) origins[id] = { x: t.x, y: t.y, rotation: t.rotation };
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
        const dAng = ang - drag.startAngle;
        const cos = Math.cos(dAng);
        const sin = Math.sin(dAng);
        const next = tiles.map((t) => {
          const o = drag.origins[t.id];
          if (!o) return t;
          const rx = o.x - drag.cx;
          const ry = o.y - drag.cy;
          return {
            ...t,
            x: drag.cx + rx * cos - ry * sin,
            y: drag.cy + rx * sin + ry * cos,
            rotation: (drag.baseRots[t.id] ?? t.rotation) + dAng,
          };
        });
        onChangeTiles(next);
        updateSnapPreview(next, drag.ids, p);
        return;
      }
      if (drag.type === "scale") {
        const distNow = Math.hypot(p.x - drag.cx, p.y - drag.cy) || 1;
        const ratio = distNow / drag.startDist;
        const next = tiles.map((t) => {
          if (!drag.ids.includes(t.id)) return t;
          const base = drag.baseScales[t.id] ?? t.scale;
          return {
            ...t,
            scale: Math.max(24, Math.min(200, base * ratio)),
          };
        });
        onChangeTiles(next);
        updateSnapPreview(next, drag.ids, p);
        return;
      }
      if (drag.type === "scaleX") {
        const distNow = Math.abs(p.x - drag.cx) || 1;
        const ratio = distNow / drag.startDist;
        const next = tiles.map((t) => {
          if (t.id !== drag.id) return t;
          const es = ensureEdgeScale(t);
          es[1] = Math.max(0.4, Math.min(2.5, drag.baseScaleX * ratio));
          es[3] = es[1];
          return { ...t, edgeScale: es };
        });
        onChangeTiles(next);
        updateSnapPreview(next, [drag.id], p);
        return;
      }
      if (drag.type === "scaleY") {
        const distNow = Math.abs(p.y - drag.cy) || 1;
        const ratio = distNow / drag.startDist;
        const next = tiles.map((t) => {
          if (t.id !== drag.id) return t;
          const es = ensureEdgeScale(t);
          es[0] = Math.max(0.4, Math.min(2.5, drag.baseScaleY * ratio));
          es[2] = es[0];
          return { ...t, edgeScale: es };
        });
        onChangeTiles(next);
        updateSnapPreview(next, [drag.id], p);
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
        updateSnapPreview(next, drag.ids, p);
      }
    },
    [drag, tiles, toLocal, onChangeTiles, updateSnapPreview],
  );

  const onPointerUp = useCallback(() => {
    if (!drag) return;
    const currentTiles = dragTilesRef.current;

    if (drag.type === "marquee") {
      const minX = Math.min(drag.x0, drag.x1);
      const maxX = Math.max(drag.x0, drag.x1);
      const minY = Math.min(drag.y0, drag.y1);
      const maxY = Math.max(drag.y0, drag.y1);
      onSelect(
        currentTiles
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
      setSnapPreviewTiles(null);
      return;
    }

    const movingIds =
      drag.type === "move" || drag.type === "rotate" || drag.type === "scale"
        ? drag.ids
        : drag.type === "scaleX" || drag.type === "scaleY"
          ? [drag.id]
          : [];

    if (movingIds.length) {
      const primary = currentTiles.find((t) => t.id === movingIds[0]);
      const prefer = primary ? { x: primary.x, y: primary.y } : undefined;
      const { tiles: snapped, join } = applyMagnetSnap(
        currentTiles,
        joinsRef.current,
        movingIds,
        prefer,
      );
      let nextJoins = join ? [...joinsRef.current, join] : joinsRef.current;
      nextJoins = pruneSeparatedJoins(snapped, nextJoins);
      onChangeTiles(snapped);
      onChangeJoins(nextJoins);
    }
    setDrag(null);
    setPreview(null);
    setSnapPreviewTiles(null);
  }, [drag, joins, onChangeTiles, onChangeJoins, onSelect]);

  const joinSegments = useMemo(() => {
    const segs: { x1: number; y1: number; x2: number; y2: number; key: string }[] =
      [];
    for (const j of joins) {
      if (!joinEdgesAligned(tiles, j)) continue;
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
    if (!preview || !snapPreviewTiles) return null;
    const ta = snapPreviewTiles.find((t) => t.id === preview.a.tileId);
    const tb = snapPreviewTiles.find((t) => t.id === preview.b.tileId);
    if (!ta || !tb) return null;
    return {
      a: worldEdges(ta)[preview.a.edgeIndex],
      b: worldEdges(tb)[preview.b.edgeIndex],
    };
  }, [preview, snapPreviewTiles]);

  const movingIdSet = useMemo(() => {
    if (!snapPreviewTiles || !drag) return new Set<string>();
    if (drag.type === "move" || drag.type === "rotate" || drag.type === "scale")
      return new Set(drag.ids);
    if (drag.type === "scaleX" || drag.type === "scaleY")
      return new Set([drag.id]);
    return new Set<string>();
  }, [snapPreviewTiles, drag]);

  return (
    <svg
      ref={svgRef}
      className={`h-full w-full touch-none select-none rounded-xl ${geometryHidden ? "bg-transparent" : "bg-[#f8f9fb]"}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      {!geometryHidden && (
        <>
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
                stroke="rgba(0,0,0,0.06)"
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#fn-grid)" />
        </>
      )}

      {joinSegments.map((s) => (
        <line
          key={s.key}
          x1={s.x1}
          y1={s.y1}
          x2={s.x2}
          y2={s.y2}
          stroke="#d97706"
          strokeWidth={3}
          strokeLinecap="round"
          opacity={0.9}
        />
      ))}

      {previewEdges && (
        <>
          <line
            x1={previewEdges.a.a.x}
            y1={previewEdges.a.a.y}
            x2={previewEdges.a.b.x}
            y2={previewEdges.a.b.y}
            stroke="#059669"
            strokeWidth={5}
            strokeLinecap="round"
          />
          <line
            x1={previewEdges.b.a.x}
            y1={previewEdges.b.a.y}
            x2={previewEdges.b.b.x}
            y2={previewEdges.b.b.y}
            stroke="#059669"
            strokeWidth={5}
            strokeLinecap="round"
          />
        </>
      )}

      {tiles.map((tile) => {
        const isGhost = snapPreviewTiles && movingIdSet.has(tile.id);
        const displayTile =
          isGhost && snapPreviewTiles
            ? snapPreviewTiles.find((t) => t.id === tile.id) ?? tile
            : tile;
        const verts = worldVertices(isGhost ? tile : displayTile);
        const points = verts.map((v) => `${v.x},${v.y}`).join(" ");
        const def = SHAPE_DEFS[tile.kind];
        const isSel = selected.has(tile.id);
        const isConnected = connected.has(tile.id) && !isSel;
        const b = tileBounds(isGhost ? tile : displayTile);
        const handleX = (b.minX + b.maxX) / 2;
        const handleY = b.minY - 14;
        const scaleX = b.maxX + 6;
        const scaleY = b.maxY + 6;
        const scaleXHandle = b.maxX + 6;
        const scaleYHandle = b.minY - 6;

        if (isGhost) {
          const ghostVerts = worldVertices(displayTile);
          const ghostPoints = ghostVerts.map((v) => `${v.x},${v.y}`).join(" ");
          return (
            <g key={tile.id}>
              {!geometryHidden && (
                <polygon
                  points={points}
                  fill={def.color}
                  stroke="rgba(0,0,0,0.15)"
                  strokeWidth={1.5}
                  opacity={0.35}
                />
              )}
              <polygon
                points={ghostPoints}
                fill={geometryHidden ? "transparent" : def.color}
                stroke="#059669"
                strokeWidth={2.5}
                strokeDasharray="6 4"
                opacity={geometryHidden ? 1 : 0.75}
              />
            </g>
          );
        }

        return (
          <g key={tile.id}>
            <polygon
              points={points}
              fill={def.color}
              stroke={
                geometryHidden
                  ? "#1e3a5f"
                  : isSel
                    ? "#1e40af"
                    : isConnected
                      ? "#059669"
                      : "rgba(0,0,0,0.35)"
              }
              strokeWidth={
                geometryHidden ? 1.8 : isSel ? 2.5 : isConnected ? 2 : 1.5
              }
              strokeLinejoin="round"
              opacity={0.92}
            />
            {isSel && (
              <>
                <circle
                  data-handle="rotate"
                  data-tile-id={tile.id}
                  cx={handleX}
                  cy={handleY}
                  r={7}
                  fill="#d97706"
                  stroke="#fff"
                  strokeWidth={1.5}
                  className="cursor-grab"
                />
                <line
                  x1={tile.x}
                  y1={tile.y}
                  x2={handleX}
                  y2={handleY}
                  stroke="#d97706"
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
                  fill="#64748b"
                  stroke="#fff"
                  strokeWidth={1}
                  className="cursor-nwse-resize"
                />
                {supportsAxisScale(tile.kind) && (
                  <>
                    <rect
                      data-handle="scaleX"
                      data-tile-id={tile.id}
                      x={scaleXHandle - 4}
                      y={tile.y - 4}
                      width={8}
                      height={8}
                      rx={2}
                      fill="#3b82f6"
                      stroke="#fff"
                      strokeWidth={1}
                      className="cursor-ew-resize"
                    />
                    <rect
                      data-handle="scaleY"
                      data-tile-id={tile.id}
                      x={tile.x - 4}
                      y={scaleYHandle - 4}
                      width={8}
                      height={8}
                      rx={2}
                      fill="#8b5cf6"
                      stroke="#fff"
                      strokeWidth={1}
                      className="cursor-ns-resize"
                    />
                  </>
                )}
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
          fill="rgba(37,99,235,0.08)"
          stroke="#2563eb"
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />
      )}
    </svg>
  );
}
