"use client";

import type { GraphSettings } from "./graph-types";
import { DEFAULT_GRAPH_SETTINGS } from "./graph-types";

type Props = {
  settings: GraphSettings;
  onChange: (next: GraphSettings) => void;
  onClose: () => void;
  compact?: boolean;
};

export default function GraphSettingsPanel({
  settings,
  onChange,
  onClose,
  compact = false,
}: Props) {
  const patch = (p: Partial<GraphSettings>) =>
    onChange({ ...settings, ...p });

  const patchView = (key: keyof GraphSettings["view"], value: number) =>
    onChange({
      ...settings,
      view: { ...settings.view, [key]: value },
    });

  return (
    <div
      className="absolute top-2 right-2 z-20 w-56 rounded-xl border-2 border-wood/20 bg-cream p-3 text-xs text-wood shadow-lg"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="font-display font-semibold">그래프 설정</span>
        <button
          type="button"
          className="rounded px-1 hover:bg-black/10"
          onClick={onClose}
        >
          ×
        </button>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <label>
          x 최소
          <input
            type="number"
            className="w-full rounded border border-black/10 px-1 py-0.5"
            value={settings.view.xMin}
            onChange={(e) => patchView("xMin", Number(e.target.value))}
          />
        </label>
        <label>
          x 최대
          <input
            type="number"
            className="w-full rounded border border-black/10 px-1 py-0.5"
            value={settings.view.xMax}
            onChange={(e) => patchView("xMax", Number(e.target.value))}
          />
        </label>
        <label>
          y 최소
          <input
            type="number"
            className="w-full rounded border border-black/10 px-1 py-0.5"
            value={settings.view.yMin}
            onChange={(e) => patchView("yMin", Number(e.target.value))}
          />
        </label>
        <label>
          y 최대
          <input
            type="number"
            className="w-full rounded border border-black/10 px-1 py-0.5"
            value={settings.view.yMax}
            onChange={(e) => patchView("yMax", Number(e.target.value))}
          />
        </label>
      </div>

      {!compact ? (
        <label className="mt-2 flex items-center gap-2">
          소격자 밀도
          <input
            type="range"
            min={2}
            max={10}
            disabled={!settings.showMinorGrid}
            value={settings.subdivisions}
            onChange={(e) =>
              patch({ subdivisions: Number(e.target.value) })
            }
          />
          <span>{settings.subdivisions}</span>
        </label>
      ) : null}

      <div className="mt-2 flex flex-col gap-1">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.showMajorGrid}
            onChange={(e) => patch({ showMajorGrid: e.target.checked })}
          />
          대격자
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.showMinorGrid}
            onChange={(e) => patch({ showMinorGrid: e.target.checked })}
          />
          소격자
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.showAxes}
            onChange={(e) => patch({ showAxes: e.target.checked })}
          />
          축
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.showNumbers}
            onChange={(e) => patch({ showNumbers: e.target.checked })}
          />
          눈금 숫자
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.panZoom}
            onChange={(e) => patch({ panZoom: e.target.checked })}
          />
          이동·확대
        </label>
      </div>

      <button
        type="button"
        className="font-display mt-2 w-full rounded-lg bg-wood/15 py-1 text-[11px]"
        onClick={() => onChange({ ...DEFAULT_GRAPH_SETTINGS })}
      >
        범위 초기화
      </button>
    </div>
  );
}
