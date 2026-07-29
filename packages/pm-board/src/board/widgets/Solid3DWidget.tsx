"use client";

import { lazy, Suspense, useMemo } from "react";
import type { SolidWidgetState } from "../geometry-types";
import { getSolidNetTree, sceneParamsFromApi } from "../../lib/solid-nets/catalog";
import type { OrbitState } from "./SolidNetScene";

const SolidNetScene = lazy(() => import("./SolidNetScene"));

type Props = {
  state: Record<string, unknown>;
  setState: (patch: Record<string, unknown>) => void;
};

function readOrbit(state: Record<string, unknown>): OrbitState {
  const orbit = state.orbit as OrbitState | undefined;
  if (orbit && Number.isFinite(orbit.azimuth) && Number.isFinite(orbit.polar)) {
    return orbit;
  }
  const deg = Number(state.rotationDeg);
  if (Number.isFinite(deg)) {
    return { azimuth: (deg * Math.PI) / 180, polar: Math.PI / 3 };
  }
  return { azimuth: 0.6, polar: 1.05 };
}

function readState(state: Record<string, unknown>): SolidWidgetState {
  return {
    type: (state.type as SolidWidgetState["type"]) ?? "cube",
    unfoldT: Number(state.unfoldT ?? 1),
    params: (state.params as SolidWidgetState["params"]) ?? { a: 2 },
    orbit: readOrbit(state),
    rotationDeg: state.rotationDeg as number | undefined,
  };
}

export default function Solid3DWidget({ state, setState }: Props) {
  const s = readState(state);
  const a = s.params.a ?? 2;
  const sceneParams = useMemo(
    () => sceneParamsFromApi(s.params),
    [s.params],
  );
  const tree = useMemo(
    () => getSolidNetTree(s.type, sceneParams),
    [s.type, sceneParams],
  );
  const unfoldT = Math.max(0, Math.min(1, s.unfoldT));
  const orbit = readOrbit(state);

  if (!tree.hingeSupported) {
    return (
      <div className="flex h-full flex-col gap-2 p-3 text-sm text-wood-dark">
        <span className="font-semibold">{tree.label}</span>
        <p className="text-xs text-wood/80">
          곡면 전개(원기둥·원뿔) 3D 접기는 다음 업데이트 예정이에요.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-2 p-3 text-sm text-wood-dark">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">{tree.label}</span>
        <span className="text-xs text-wood/70">a={a.toFixed(1)}</span>
      </div>
      <p className="text-xs text-wood/70">드래그로 입체를 돌려보세요</p>
      <div className="relative min-h-[200px] flex-1 overflow-hidden rounded-xl bg-[#1a2e28]/90">
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center text-xs text-white/70">
              3D 로딩…
            </div>
          }
        >
          <SolidNetScene
            tree={tree}
            unfoldT={unfoldT}
            orbit={orbit}
            onOrbitChange={(next) => setState({ orbit: next, rotationDeg: undefined })}
            className="h-full w-full min-h-[200px]"
          />
        </Suspense>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          className="rounded-lg bg-black/10 px-2 py-1 text-xs"
          onClick={() => setState({ unfoldT: 0 })}
        >
          펼치기
        </button>
        <button
          type="button"
          className="rounded-lg bg-black/10 px-2 py-1 text-xs"
          onClick={() => setState({ unfoldT: 1 })}
        >
          접기
        </button>
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-wood/80">
          펼치기 ↔ 접기 ({Math.round(unfoldT * 100)}%)
        </span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.02}
          value={unfoldT}
          onChange={(e) => setState({ unfoldT: Number(e.target.value) })}
          className="w-full"
        />
      </label>
    </div>
  );
}
