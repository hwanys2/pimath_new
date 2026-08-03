"use client";

import { lazy, Suspense, useCallback, useMemo } from "react";
import {
  DEFAULT_FOLD_NET_STATE,
  DEFAULT_TILE_SCALE,
  SHAPE_DEFS,
  SHAPE_PALETTE_ORDER,
  buildFoldTreeFromMatch,
  componentContaining,
  createTileId,
  describeWhyNoMatch,
  detachSelectedJoins,
  matchSolidFromSelection,
  removeJoinsForTiles,
  type FoldNetState,
  type FoldTile,
  type Join,
  type ShapeKind,
} from "../../lib/fold-net";
import FoldNetCanvas from "./FoldNetCanvas";

const FoldNetScene = lazy(() => import("./FoldNetScene"));

type Props = {
  state: Record<string, unknown>;
  setState: (patch: Record<string, unknown>) => void;
};

function readState(raw: Record<string, unknown>): FoldNetState {
  const tiles = Array.isArray(raw.tiles) ? (raw.tiles as FoldTile[]) : [];
  const joins = Array.isArray(raw.joins) ? (raw.joins as Join[]) : [];
  const selectedIds = Array.isArray(raw.selectedIds)
    ? (raw.selectedIds as string[])
    : [];
  const mode = raw.mode === "solid" ? "solid" : "edit";
  const unfoldT = Number.isFinite(Number(raw.unfoldT))
    ? Math.max(0, Math.min(1, Number(raw.unfoldT)))
    : 0;
  const orbit =
    raw.orbit &&
    typeof raw.orbit === "object" &&
    Number.isFinite((raw.orbit as { azimuth?: number }).azimuth)
      ? (raw.orbit as FoldNetState["orbit"])
      : DEFAULT_FOLD_NET_STATE.orbit;
  return {
    tiles,
    joins,
    selectedIds,
    mode,
    solidType: raw.solidType as FoldNetState["solidType"],
    solidTileIds: Array.isArray(raw.solidTileIds)
      ? (raw.solidTileIds as string[])
      : undefined,
    unfoldT,
    orbit,
  };
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

  const patch = useCallback(
    (partial: Partial<FoldNetState>) => {
      setState(partial as Record<string, unknown>);
    },
    [setState],
  );

  const connectedIds = useMemo(() => {
    if (s.selectedIds.length !== 1) return s.selectedIds;
    return componentContaining(s.tiles, s.joins, s.selectedIds[0]);
  }, [s.tiles, s.joins, s.selectedIds]);

  const match = useMemo(
    () => matchSolidFromSelection(s.tiles, s.joins, s.selectedIds),
    [s.tiles, s.joins, s.selectedIds],
  );

  const tree = useMemo(() => {
    if (s.mode !== "solid" || !s.solidType) return null;
    const m = matchSolidFromSelection(
      s.tiles,
      s.joins,
      s.solidTileIds ?? s.selectedIds,
    );
    if (!m) return null;
    return buildFoldTreeFromMatch(m);
  }, [s.mode, s.solidType, s.tiles, s.joins, s.solidTileIds, s.selectedIds]);

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
      mode: "edit",
    });
  };

  const deleteSelected = () => {
    const sel = new Set(s.selectedIds);
    if (sel.size === 0) return;
    patch({
      tiles: s.tiles.filter((t) => !sel.has(t.id)),
      joins: removeJoinsForTiles(s.joins, sel),
      selectedIds: [],
      mode: "edit",
      solidType: undefined,
    });
  };

  const detachSelected = () => {
    if (s.selectedIds.length === 0) return;
    patch({
      joins: detachSelectedJoins(s.joins, s.selectedIds),
    });
  };

  const makeSolid = () => {
    const m = matchSolidFromSelection(s.tiles, s.joins, s.selectedIds);
    if (!m) return;
    patch({
      mode: "solid",
      solidType: m.type,
      solidTileIds: m.tileIds,
      unfoldT: 0,
      selectedIds: m.tileIds,
    });
  };

  const backToEdit = () => {
    patch({ mode: "edit", solidType: undefined });
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 p-2 text-sm text-wood-dark">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs font-semibold text-wood/80">도형</span>
        {SHAPE_PALETTE_ORDER.map((kind) => (
          <button
            key={kind}
            type="button"
            title={SHAPE_DEFS[kind].label}
            className="rounded-md bg-black/5 p-1 ring-1 ring-black/10 hover:bg-black/10"
            onClick={() => addShape(kind)}
          >
            <MiniShape kind={kind} />
          </button>
        ))}
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        {s.mode === "solid" && tree ? (
          <div className="absolute inset-0 overflow-hidden rounded-xl bg-[#14201c]">
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center text-xs text-white/70">
                  3D 로딩…
                </div>
              }
            >
              <FoldNetScene
                tree={tree}
                unfoldT={s.unfoldT}
                orbit={s.orbit}
                onOrbitChange={(orbit) => patch({ orbit })}
                className="h-full w-full"
              />
            </Suspense>
          </div>
        ) : (
          <FoldNetCanvas
            tiles={s.tiles}
            joins={s.joins}
            selectedIds={s.selectedIds}
            connectedIds={connectedIds}
            onChangeTiles={(tiles) => patch({ tiles })}
            onChangeJoins={(joins) => patch({ joins })}
            onSelect={(selectedIds) => patch({ selectedIds })}
          />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {s.mode === "edit" ? (
          <>
            <button
              type="button"
              className="rounded-lg bg-black/10 px-2.5 py-1 text-xs font-medium disabled:opacity-40"
              disabled={s.selectedIds.length === 0}
              onClick={deleteSelected}
            >
              삭제
            </button>
            <button
              type="button"
              className="rounded-lg bg-black/10 px-2.5 py-1 text-xs font-medium disabled:opacity-40"
              disabled={s.selectedIds.length === 0}
              onClick={detachSelected}
            >
              접합 해제
            </button>
            <button
              type="button"
              className="rounded-lg bg-[#2a5142] px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-40"
              disabled={!match}
              onClick={makeSolid}
              title={
                match
                  ? `${match.label} 만들기`
                  : describeWhyNoMatch(s.tiles, s.joins, s.selectedIds)
              }
            >
              입체만들기{match ? ` · ${match.label}` : ""}
            </button>
            {!match && s.tiles.length > 0 && (
              <span className="text-[11px] text-wood/60">
                {describeWhyNoMatch(s.tiles, s.joins, s.selectedIds)}
              </span>
            )}
          </>
        ) : (
          <>
            <button
              type="button"
              className="rounded-lg bg-black/10 px-2.5 py-1 text-xs font-medium"
              onClick={backToEdit}
            >
              전개도로
            </button>
            <button
              type="button"
              className="rounded-lg bg-black/10 px-2.5 py-1 text-xs"
              onClick={() => patch({ unfoldT: 0 })}
            >
              펼치기
            </button>
            <button
              type="button"
              className="rounded-lg bg-black/10 px-2.5 py-1 text-xs"
              onClick={() => patch({ unfoldT: 1 })}
            >
              접기
            </button>
            <label className="flex min-w-[160px] flex-1 flex-col gap-0.5">
              <span className="text-[11px] text-wood/70">
                펼치기 ↔ 접기 ({Math.round(s.unfoldT * 100)}%)
              </span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={s.unfoldT}
                onChange={(e) => patch({ unfoldT: Number(e.target.value) })}
                className="w-full"
              />
            </label>
            <span className="text-[11px] text-wood/60">드래그로 회전</span>
          </>
        )}
      </div>
    </div>
  );
}
