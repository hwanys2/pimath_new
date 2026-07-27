"use client";

type Props = {
  state: Record<string, unknown>;
  setState: (patch: Record<string, unknown>) => void;
};

const LIGHTS = [
  { id: "red", color: "#ef4444", glow: "rgba(239,68,68,0.55)", label: "조용히 집중" },
  { id: "yellow", color: "#facc15", glow: "rgba(250,204,21,0.55)", label: "짝과 소곤소곤" },
  { id: "green", color: "#22c55e", glow: "rgba(34,197,94,0.55)", label: "모둠 활동" },
] as const;

export default function TrafficLightWidget({ state, setState }: Props) {
  const active = (state.active as string) ?? "red";
  const current = LIGHTS.find((l) => l.id === active) ?? LIGHTS[0];

  return (
    <div className="flex h-full flex-col items-center gap-2 p-3">
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-3 rounded-2xl bg-[#3d3d3d] px-4 py-4 shadow-inner">
        {LIGHTS.map((light) => {
          const on = active === light.id;
          return (
            <button
              key={light.id}
              type="button"
              onClick={() => setState({ active: light.id })}
              aria-label={light.label}
              className="aspect-square w-16 rounded-full border-4 border-black/30 transition sm:w-20"
              style={{
                background: on ? light.color : "#5a5a5a",
                boxShadow: on ? `0 0 24px 6px ${light.glow}` : "none",
                opacity: on ? 1 : 0.55,
              }}
            />
          );
        })}
      </div>
      <p
        className="font-display w-full rounded-xl px-3 py-2 text-center text-lg text-white"
        style={{ background: current.color }}
      >
        {current.label}
      </p>
    </div>
  );
}
