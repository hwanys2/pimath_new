"use client";

import { useMemo } from "react";
import type { SolidWidgetState } from "../geometry-types";
import { getSolidNet } from "../../lib/solid-nets/catalog";

type Props = {
  state: Record<string, unknown>;
  setState: (patch: Record<string, unknown>) => void;
};

function readState(state: Record<string, unknown>): SolidWidgetState {
  return {
    type: (state.type as SolidWidgetState["type"]) ?? "cube",
    unfoldT: Number(state.unfoldT ?? 1),
    params: (state.params as SolidWidgetState["params"]) ?? { a: 72 },
    rotationDeg: Number(state.rotationDeg ?? 0),
  };
}

export default function Solid3DWidget({ state, setState }: Props) {
  const s = readState(state);
  const a = s.params.a ?? 72;
  const net = useMemo(() => getSolidNet(s.type, s.params), [s.type, s.params]);

  const bounds = useMemo(() => {
    let maxX = 0;
    let maxY = 0;
    for (const f of net.faces) {
      maxX = Math.max(maxX, f.ux + f.w);
      maxY = Math.max(maxY, f.uy + f.h);
    }
    return { w: maxX, h: maxY };
  }, [net]);

  const unfoldT = Math.max(0, Math.min(1, s.unfoldT));

  return (
    <div className="flex h-full flex-col gap-2 p-3 text-sm text-wood-dark">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">{net.label}</span>
        <span className="text-xs text-wood/70">a={Math.round(a)}</span>
      </div>
      <div className="relative min-h-[200px] flex-1 overflow-hidden rounded-xl bg-[#1a2e28]/90">
        <div
          className="absolute left-1/2 top-1/2"
          style={{
            width: bounds.w,
            height: bounds.h,
            transform: `translate(-50%, -50%) rotateY(${s.rotationDeg}deg)`,
            transformStyle: "preserve-3d",
            perspective: 900,
          }}
        >
          {net.faces.map((face) => {
            const angle = face.foldAngle * unfoldT;
            const origin =
              face.foldAxis === "x"
                ? "center bottom"
                : "left center";
            return (
              <div
                key={face.id}
                className="absolute border-2 border-sky/80 bg-sky/15"
                style={{
                  left: face.ux,
                  top: face.uy,
                  width: face.w,
                  height: face.h,
                  transformStyle: "preserve-3d",
                  transform: `rotate${face.foldAxis.toUpperCase()}(${angle}deg)`,
                  transformOrigin: origin,
                  backfaceVisibility: "hidden",
                }}
              />
            );
          })}
        </div>
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
          onChange={(e) =>
            setState({ unfoldT: Number(e.target.value) })
          }
          className="w-full"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-wood/80">회전</span>
        <input
          type="range"
          min={-180}
          max={180}
          value={s.rotationDeg}
          onChange={(e) =>
            setState({ rotationDeg: Number(e.target.value) })
          }
          className="w-full"
        />
      </label>
    </div>
  );
}
