"use client";

import { useCallback, useMemo, useRef } from "react";
import {
  DEFAULT_FOLD_NET_STATE,
  DEFAULT_TILE_SCALE,
  SHAPE_DEFS,
  SHAPE_PALETTE_ORDER,
  canFoldNet,
  componentKey,
  createTileId,
  describeWhyNoMatch,
  detachSelectedJoins,
  pickFoldRoot,
  removeJoinsForTiles,
  selectedComponentIds,
  solveClosureAngles,
  tileBounds,
  type FoldNetState,
  type FoldTile,
  type HingeOverride,
  type Join,
  type NetFoldState,
  type ShapeKind,
} from "../../lib/fold-net";
import FoldNetFloatingToolbar from "./FoldNetFloatingToolbar";
import FoldNetView from "./FoldNetView";

type Props = {
  state: Record<string, unknown>;
  setState: (patch: Record<string, unknown>) => void;
};

function readNetFolds(raw: Record<string, unknown>): NetFoldState[] {
  if (!Array.isArray(raw.netFolds)) return [];
  return raw.netFolds as NetFoldState[];
}

function readState(raw: Record<string, unknown>): FoldNetState {
  const tiles = Array.isArray(raw.tiles) ? (raw.tiles as FoldTile[]) : [];
  const joins = Array.isArray(raw.joins) ? (raw.joins as Join[]) : [];
  const selectedIds = Array.isArray(raw.selectedIds)
    ? (raw.selectedIds as string[])
    : [];
  const netFolds = readNetFolds(raw);
  const unfoldT = Number.isFinite(Number(raw.unfoldT))
    ? Math.max(0, Math.min(1, Number(raw.unfoldT)))
    : 0;
  const orbit =
    raw.orbit &&
    typeof raw.orbit === "object" &&
    Number.isFinite((raw.orbit as { azimuth?: number }).azimuth)
      ? (raw.orbit as FoldNetState["orbit"])
      : DEFAULT_FOLD_NET_STATE.orbit;
  const hingeOverrides = Array.isArray(raw.hingeOverrides)
    ? (raw.hingeOverrides as HingeOverride[])
    : [];
  return {
    tiles,
    joins,
    selectedIds,
    mode: "edit",
    unfoldT,
    netFolds,
    orbit,
    hingeOverrides,
    foldRootId:
      typeof raw.foldRootId === "string" ? raw.foldRootId : undefined,
  };
}

function upsertNetFold(
  netFolds: NetFoldState[],
  entry: NetFoldState,
): NetFoldState[] {
  return [...netFolds.filter((n) => n.key !== entry.key), entry];
}

function clearNetFoldsTouching(
  netFolds: NetFoldState[],
  tileIds: Set<string>,
): NetFoldState[] {
  return netFolds.filter((n) => !n.tileIds.some((id) => tileIds.has(id)));
}

function netFoldForComponent(
  netFolds: NetFoldState[],
  tileIds: string[],
): NetFoldState | undefined {
  const key = componentKey(tileIds);
  return netFolds.find((n) => n.key === key);
}

function MiniShape({ kind }: { kind: ShapeKind }) {
  const def = SHAPE_DEFS[kind];
  const pts = def.local
    .map((p) => `${12 + p.x * 10},${12 + p.y * 10}`)
    .join(" ");
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" aria-hidden>
      <polygon points={pts} fill={def.color} stroke="#fff" strokeWidth={0.8} />
    </svg>
  );
}

export default function FoldNetWidget({ state, setState }: Props) {
  const s = readState(state);
  const canvasRef = useRef<HTMLDivElement>(null);

  const patch = useCallback(
    (partial: Partial<FoldNetState>) => {
      setState(partial as Record<string, unknown>);
    },
    [setState],
  );

  const selectedComp = useMemo(() => {
    const comps = selectedComponentIds(s.tiles, s.joins, s.selectedIds);
    return comps.length === 1 ? comps[0] : null;
  }, [s.tiles, s.joins, s.selectedIds]);

  const foldTileIds = selectedComp ?? [];

  const selectedNetFold = useMemo(
    () =>
      selectedComp
        ? netFoldForComponent(s.netFolds ?? [], selectedComp)
        : undefined,
    [selectedComp, s.netFolds],
  );

  const selectedUnfoldT = selectedNetFold?.unfoldT ?? 0;

  const foldRootId = useMemo(() => {
    if (selectedNetFold?.foldRootId && foldTileIds.includes(selectedNetFold.foldRootId)) {
      return selectedNetFold.foldRootId;
    }
    if (s.foldRootId && foldTileIds.includes(s.foldRootId)) return s.foldRootId;
    return pickFoldRoot(s.tiles, foldTileIds) ?? foldTileIds[0] ?? "";
  }, [selectedNetFold, s.foldRootId, s.tiles, foldTileIds]);

  const foldable = useMemo(
    () => canFoldNet(s.tiles, s.joins, foldTileIds),
    [s.tiles, s.joins, foldTileIds],
  );

  const effectiveHinges =
    selectedNetFold?.hingeOverrides ?? s.hingeOverrides ?? [];

  const closure = useMemo(
    () =>
      foldable && selectedUnfoldT > 0
        ? solveClosureAngles(
            s.tiles,
            s.joins,
            foldTileIds,
            effectiveHinges,
          )
        : null,
    [s.tiles, s.joins, foldTileIds, effectiveHinges, foldable, selectedUnfoldT],
  );

  const netBounds = useMemo(() => {
    if (!foldable || foldTileIds.length === 0) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const id of foldTileIds) {
      const tile = s.tiles.find((t) => t.id === id);
      if (!tile) continue;
      const b = tileBounds(tile);
      minX = Math.min(minX, b.minX);
      minY = Math.min(minY, b.minY);
      maxX = Math.max(maxX, b.maxX);
      maxY = Math.max(maxY, b.maxY);
    }
    if (!Number.isFinite(minX)) return null;
    return { minX, minY, maxX, maxY };
  }, [s.tiles, foldTileIds, foldable]);

  const editing = selectedUnfoldT < 0.005;

  const clearSelectedNetFold = useCallback(() => {
    if (!selectedComp) return;
    const key = componentKey(selectedComp);
    patch({
      netFolds: (s.netFolds ?? []).filter((n) => n.key !== key),
      unfoldT: 0,
    });
  }, [patch, selectedComp, s.netFolds]);

  const addShape = (kind: ShapeKind) => {
    const n = s.tiles.length;
    const tile: FoldTile = {
      id: createTileId(),
      kind,
      x: 160 + (n % 5) * 28,
      y: 140 + Math.floor(n / 5) * 28,
      scale: DEFAULT_TILE_SCALE,
      rotation: 0,
    };
    patch({
      tiles: [...s.tiles, tile],
      selectedIds: [tile.id],
      netFolds: s.netFolds ?? [],
      unfoldT: 0,
    });
  };

  const deleteSelected = () => {
    const sel = new Set(s.selectedIds);
    if (sel.size === 0) return;
    patch({
      tiles: s.tiles.filter((t) => !sel.has(t.id)),
      joins: removeJoinsForTiles(s.joins, sel),
      selectedIds: [],
      netFolds: clearNetFoldsTouching(s.netFolds ?? [], sel),
      unfoldT: 0,
    });
  };

  const duplicateSelected = () => {
    if (s.selectedIds.length === 0) return;
    const newTiles: FoldTile[] = [];
    for (const id of s.selectedIds) {
      const tile = s.tiles.find((t) => t.id === id);
      if (!tile) continue;
      newTiles.push({
        ...tile,
        id: createTileId(),
        x: tile.x + 24,
        y: tile.y + 24,
      });
    }
    patch({
      tiles: [...s.tiles, ...newTiles],
      selectedIds: newTiles.map((t) => t.id),
      unfoldT: 0,
    });
  };

  const handleUnfoldTChange = (unfoldT: number) => {
    if (!selectedComp) return;
    const key = componentKey(selectedComp);
    const root = pickFoldRoot(s.tiles, selectedComp) ?? selectedComp[0];

    if (unfoldT > 0 && foldable) {
      const existing = netFoldForComponent(s.netFolds ?? [], selectedComp);
      const solved = solveClosureAngles(
        s.tiles,
        s.joins,
        selectedComp,
        existing?.hingeOverrides ?? s.hingeOverrides ?? [],
      );
      patch({
        selectedIds: selectedComp,
        netFolds: upsertNetFold(s.netFolds ?? [], {
          key,
          tileIds: selectedComp,
          unfoldT,
          foldRootId: root,
          hingeOverrides: solved.angles,
        }),
        unfoldT,
      });
    } else {
      patch({
        netFolds: (s.netFolds ?? []).filter((n) => n.key !== key),
        unfoldT: 0,
        orbit: { azimuth: 0.55, polar: 1.05 },
      });
    }
  };

  const handleDetach = () => {
    if (s.selectedIds.length === 0) return;
    clearSelectedNetFold();
    patch({
      joins: detachSelectedJoins(s.joins, s.selectedIds),
    });
  };

  const handleHingeOverrideChange = (next: HingeOverride[]) => {
    if (!selectedComp) return;
    const key = componentKey(selectedComp);
    const existing = netFoldForComponent(s.netFolds ?? [], selectedComp);
    if (existing) {
      patch({
        netFolds: upsertNetFold(s.netFolds ?? [], {
          ...existing,
          hingeOverrides: next,
        }),
      });
    } else {
      patch({ hingeOverrides: next });
    }
  };

  const activeNetFolds = useMemo(
    () => (s.netFolds ?? []).filter((n) => n.unfoldT > 0.005),
    [s.netFolds],
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 p-2 text-sm text-wood-dark">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs font-semibold text-wood/80">도형</span>
        {SHAPE_PALETTE_ORDER.map((kind) => (
          <button
            key={kind}
            type="button"
            title={SHAPE_DEFS[kind].label}
            className="rounded-md bg-black/5 p-1 ring-1 ring-black/10 hover:bg-black/10 disabled:opacity-40"
            disabled={!editing}
            onClick={() => addShape(kind)}
          >
            <MiniShape kind={kind} />
          </button>
        ))}
        {!editing && selectedComp && (
          <span className="ml-2 text-[11px] text-wood/60">
            펼치려면 슬라이더를 왼쪽으로
          </span>
        )}
      </div>

      <div ref={canvasRef} className="relative min-h-0 flex-1 overflow-hidden">
        <FoldNetView
          tiles={s.tiles}
          joins={s.joins}
          selectedIds={s.selectedIds}
          netFolds={activeNetFolds}
          editing={editing}
          onChangeTiles={(tiles) => {
            const touched = new Set(foldTileIds);
            patch({
              tiles,
              netFolds: clearNetFoldsTouching(s.netFolds ?? [], touched),
              unfoldT: 0,
            });
          }}
          onChangeJoins={(joins) => {
            const touched = new Set(foldTileIds);
            patch({
              joins,
              netFolds: clearNetFoldsTouching(s.netFolds ?? [], touched),
              unfoldT: 0,
            });
          }}
          onSelect={(selectedIds) => patch({ selectedIds })}
        />
        <FoldNetFloatingToolbar
          containerRef={canvasRef}
          netBounds={netBounds}
          unfoldT={selectedUnfoldT}
          foldable={foldable && s.selectedIds.length > 0 && !!selectedComp}
          disabledHint={describeWhyNoMatch(s.tiles, s.joins, foldTileIds)}
          onUnfoldTChange={handleUnfoldTChange}
          onDuplicate={duplicateSelected}
          onDelete={deleteSelected}
        />
      </div>

      {editing && s.selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-lg bg-black/10 px-2.5 py-1 text-xs font-medium"
            onClick={handleDetach}
          >
            접합 해제
          </button>
        </div>
      )}

      {!foldable && s.tiles.length > 0 && s.selectedIds.length > 0 && (
        <p className="text-[11px] text-wood/60">
          {describeWhyNoMatch(s.tiles, s.joins, foldTileIds)}
        </p>
      )}

      {closure && selectedUnfoldT > 0 && effectiveHinges.length > 0 && (
        <details className="rounded-lg bg-black/5 px-2 py-1.5">
          <summary className="cursor-pointer text-[11px] font-medium text-wood/80">
            접힘 각도 조절 ({effectiveHinges.length}개)
          </summary>
          <div className="mt-2 flex max-h-28 flex-col gap-1.5 overflow-y-auto">
            {effectiveHinges.map((h, i) => {
              const join = s.joins.find((j) => j.id === h.joinId);
              const label = join
                ? `${join.a.tileId.slice(-4)}↔${join.b.tileId.slice(-4)}`
                : `축 ${i + 1}`;
              return (
                <label
                  key={h.joinId}
                  className="flex items-center gap-2 text-[11px]"
                >
                  <span className="w-16 shrink-0 text-wood/70">{label}</span>
                  <input
                    type="range"
                    min={0}
                    max={180}
                    step={1}
                    value={Math.round((h.targetAngle * 180) / Math.PI)}
                    onChange={(e) => {
                      const deg = Number(e.target.value);
                      const next = effectiveHinges.map((x) =>
                        x.joinId === h.joinId
                          ? { ...x, targetAngle: (deg * Math.PI) / 180 }
                          : x,
                      );
                      handleHingeOverrideChange(next);
                    }}
                    className="flex-1"
                  />
                  <span className="w-8 text-right tabular-nums">
                    {Math.round((h.targetAngle * 180) / Math.PI)}°
                  </span>
                </label>
              );
            })}
          </div>
        </details>
      )}
    </div>
  );
}
