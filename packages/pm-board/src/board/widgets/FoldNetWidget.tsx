"use client";

import { useCallback, useMemo } from "react";
import {
  DEFAULT_FOLD_NET_STATE,
  DEFAULT_TILE_SCALE,
  SHAPE_DEFS,
  SHAPE_PALETTE_ORDER,
  canFoldNet,
  componentContaining,
  createTileId,
  describeWhyNoMatch,
  detachSelectedJoins,
  matchSolidFromSelection,
  pickFoldRoot,
  removeJoinsForTiles,
  solveClosureAngles,
  type FoldNetState,
  type FoldTile,
  type HingeOverride,
  type Join,
  type ShapeKind,
} from "../../lib/fold-net";
import FoldNetView from "./FoldNetView";

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
  const hingeOverrides = Array.isArray(raw.hingeOverrides)
    ? (raw.hingeOverrides as HingeOverride[])
    : [];
  return {
    tiles,
    joins,
    selectedIds,
    mode,
    solidType: raw.solidType as FoldNetState["solidType"],
    solidTileIds: Array.isArray(raw.solidTileIds)
      ? (raw.solidTileIds as string[])
      : undefined,
    foldRootId:
      typeof raw.foldRootId === "string" ? raw.foldRootId : undefined,
    hingeOverrides,
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

  const foldTileIds = useMemo(() => {
    if (s.solidTileIds && s.solidTileIds.length > 0) return s.solidTileIds;
    if (s.selectedIds.length > 0) return connectedIds;
    return s.tiles.map((t) => t.id);
  }, [s.solidTileIds, s.selectedIds, connectedIds, s.tiles]);

  const foldRootId = useMemo(() => {
    if (s.foldRootId && foldTileIds.includes(s.foldRootId)) return s.foldRootId;
    return pickFoldRoot(s.tiles, foldTileIds) ?? foldTileIds[0] ?? "";
  }, [s.foldRootId, s.tiles, foldTileIds]);

  const match = useMemo(
    () => matchSolidFromSelection(s.tiles, s.joins, foldTileIds),
    [s.tiles, s.joins, foldTileIds],
  );

  const foldable = useMemo(
    () => canFoldNet(s.tiles, s.joins, foldTileIds),
    [s.tiles, s.joins, foldTileIds],
  );

  const closure = useMemo(
    () =>
      foldable
        ? solveClosureAngles(
            s.tiles,
            s.joins,
            foldTileIds,
            s.hingeOverrides ?? [],
          )
        : null,
    [s.tiles, s.joins, foldTileIds, s.hingeOverrides, foldable],
  );

  const effectiveHinges = closure?.angles ?? s.hingeOverrides ?? [];

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
      mode: "edit",
      solidType: undefined,
      solidTileIds: undefined,
      unfoldT: 0,
    });
  };

  const detachSelected = () => {
    if (s.selectedIds.length === 0) return;
    patch({ joins: detachSelectedJoins(s.joins, s.selectedIds), unfoldT: 0 });
  };

  const enableFold = () => {
    if (!foldable) return;
    const solved = solveClosureAngles(
      s.tiles,
      s.joins,
      foldTileIds,
      s.hingeOverrides ?? [],
    );
    patch({
      mode: "solid",
      solidType: match?.type,
      solidTileIds: foldTileIds,
      foldRootId,
      hingeOverrides: solved.angles,
      unfoldT: s.unfoldT > 0 ? s.unfoldT : 0,
      selectedIds: foldTileIds,
    });
  };

  const editing = s.mode === "edit" && s.unfoldT < 0.005;

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
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <FoldNetView
          tiles={s.tiles}
          joins={s.joins}
          selectedIds={s.selectedIds}
          connectedIds={connectedIds}
          foldTileIds={foldTileIds}
          foldRootId={foldRootId}
          unfoldT={s.unfoldT}
          hingeOverrides={effectiveHinges}
          orbit={s.orbit}
          editing={editing}
          onChangeTiles={(tiles) => patch({ tiles, unfoldT: 0 })}
          onChangeJoins={(joins) => patch({ joins, unfoldT: 0 })}
          onSelect={(selectedIds) => patch({ selectedIds })}
          onOrbitChange={(orbit) => patch({ orbit })}
        />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-lg bg-black/10 px-2.5 py-1 text-xs font-medium disabled:opacity-40"
            disabled={!editing || s.selectedIds.length === 0}
            onClick={deleteSelected}
          >
            삭제
          </button>
          <button
            type="button"
            className="rounded-lg bg-black/10 px-2.5 py-1 text-xs font-medium disabled:opacity-40"
            disabled={!editing || s.selectedIds.length === 0}
            onClick={detachSelected}
          >
            접합 해제
          </button>
          <button
            type="button"
            className="rounded-lg bg-[#2a5142] px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-40"
            disabled={!foldable}
            onClick={enableFold}
            title={
              foldable
                ? match
                  ? `${match.label} 접기`
                  : "전개도 접기"
                : describeWhyNoMatch(s.tiles, s.joins, foldTileIds)
            }
          >
            입체만들기{match ? ` · ${match.label}` : ""}
          </button>
          {!foldable && s.tiles.length > 0 && (
            <span className="text-[11px] text-wood/60">
              {describeWhyNoMatch(s.tiles, s.joins, foldTileIds)}
            </span>
          )}
          {closure && s.mode === "solid" && (
            <span className="text-[11px] text-wood/60">{closure.message}</span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-lg bg-black/10 px-2.5 py-1 text-xs"
            onClick={() => patch({ unfoldT: 0, mode: "edit" })}
          >
            펼치기
          </button>
          <button
            type="button"
            className="rounded-lg bg-black/10 px-2.5 py-1 text-xs"
            onClick={() => {
              if (s.mode !== "solid") enableFold();
              patch({ unfoldT: 1 });
            }}
            disabled={!foldable}
          >
            접기
          </button>
          <label className="flex min-w-[180px] flex-1 flex-col gap-0.5">
            <span className="text-[11px] text-wood/70">
              펼치기 ↔ 접기 ({Math.round(s.unfoldT * 100)}%)
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.02}
              value={s.unfoldT}
              disabled={!foldable}
              onChange={(e) => {
                const unfoldT = Number(e.target.value);
                if (unfoldT > 0 && s.mode !== "solid") {
                  const solved = solveClosureAngles(
                    s.tiles,
                    s.joins,
                    foldTileIds,
                    s.hingeOverrides ?? [],
                  );
                  patch({
                    mode: "solid",
                    solidTileIds: foldTileIds,
                    foldRootId,
                    hingeOverrides: solved.angles,
                    unfoldT,
                  });
                } else {
                  patch({ unfoldT });
                }
              }}
              className="w-full"
            />
          </label>
          {s.unfoldT > 0.02 && (
            <span className="text-[11px] text-wood/60">드래그로 회전</span>
          )}
        </div>

        {s.mode === "solid" && effectiveHinges.length > 0 && (
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
                        patch({ hingeOverrides: next });
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
    </div>
  );
}
