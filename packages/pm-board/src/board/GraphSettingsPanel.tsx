"use client";

import type { GraphSettings } from "./graph-types";
import { DEFAULT_GRAPH_SETTINGS, mergeGraphSettings } from "./graph-types";
import { STANDARD_PLOT_VIEW } from "../lib/graph-plot";

type Props = {
  settings: GraphSettings;
  onChange: (next: GraphSettings) => void;
  onClose: () => void;
  compact?: boolean;
};

function parseNum(raw: string, fallback: number): number {
  if (raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function ScaleInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="block">
      {label}
      <input
        type="number"
        min={0}
        step="any"
        className="w-full rounded border border-black/10 px-1 py-0.5"
        value={value === 0 ? "" : value}
        placeholder="자동"
        onChange={(e) => {
          const raw = e.target.value;
          if (raw.trim() === "") {
            onChange(0);
            return;
          }
          const n = Number(raw);
          onChange(Number.isFinite(n) && n > 0 ? n : 0);
        }}
      />
    </label>
  );
}

export default function GraphSettingsPanel({
  settings,
  onChange,
  onClose,
  compact = false,
}: Props) {
  const patch = (p: Partial<GraphSettings>) =>
    onChange(mergeGraphSettings({ ...settings, ...p }));

  const patchView = (key: keyof GraphSettings["view"], value: number) =>
    onChange(
      mergeGraphSettings({
        ...settings,
        view: { ...settings.view, [key]: value },
      }),
    );

  return (
    <div
      className={`absolute top-2 right-2 z-20 overflow-y-auto rounded-xl border-2 border-wood/20 bg-cream p-3 text-xs text-wood shadow-lg ${
        compact ? "w-[17.5rem] max-h-[min(22rem,calc(100%-0.75rem))]" : "w-64 max-h-[min(28rem,calc(100%-0.75rem))]"
      }`}
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

      <p className="mb-1 text-[10px] font-semibold tracking-wide text-wood/55 uppercase">
        창
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        <label>
          x 최소
          <input
            type="number"
            step="any"
            className="w-full rounded border border-black/10 px-1 py-0.5"
            value={settings.view.xMin}
            onChange={(e) =>
              patchView("xMin", parseNum(e.target.value, settings.view.xMin))
            }
          />
        </label>
        <label>
          x 최대
          <input
            type="number"
            step="any"
            className="w-full rounded border border-black/10 px-1 py-0.5"
            value={settings.view.xMax}
            onChange={(e) =>
              patchView("xMax", parseNum(e.target.value, settings.view.xMax))
            }
          />
        </label>
        <label>
          y 최소
          <input
            type="number"
            step="any"
            className="w-full rounded border border-black/10 px-1 py-0.5"
            value={settings.view.yMin}
            onChange={(e) =>
              patchView("yMin", parseNum(e.target.value, settings.view.yMin))
            }
          />
        </label>
        <label>
          y 최대
          <input
            type="number"
            step="any"
            className="w-full rounded border border-black/10 px-1 py-0.5"
            value={settings.view.yMax}
            onChange={(e) =>
              patchView("yMax", parseNum(e.target.value, settings.view.yMax))
            }
          />
        </label>
        <ScaleInput
          label="x 눈금간격"
          value={settings.xScale}
          onChange={(xScale) => patch({ xScale })}
        />
        <ScaleInput
          label="y 눈금간격"
          value={settings.yScale}
          onChange={(yScale) => patch({ yScale })}
        />
      </div>

      <label className="mt-1.5 flex items-center gap-2">
        <input
          type="checkbox"
          checked={settings.equalAxes}
          onChange={(e) => patch({ equalAxes: e.target.checked })}
        />
        정사각 축 (1칸 = 1칸)
      </label>

      <p className="mt-2 mb-1 text-[10px] font-semibold tracking-wide text-wood/55 uppercase">
        표시
      </p>
      <div className="flex flex-col gap-1">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.showXAxis}
            onChange={(e) => patch({ showXAxis: e.target.checked })}
          />
          x축
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.showYAxis}
            onChange={(e) => patch({ showYAxis: e.target.checked })}
          />
          y축
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.showAxisNames}
            onChange={(e) => patch({ showAxisNames: e.target.checked })}
          />
          축 이름
        </label>
        {settings.showAxisNames ? (
          <div className="ml-5 grid grid-cols-2 gap-1.5">
            <label>
              x
              <input
                type="text"
                className="w-full rounded border border-black/10 px-1 py-0.5"
                value={settings.xAxisName}
                maxLength={12}
                onChange={(e) => patch({ xAxisName: e.target.value })}
              />
            </label>
            <label>
              y
              <input
                type="text"
                className="w-full rounded border border-black/10 px-1 py-0.5"
                value={settings.yAxisName}
                maxLength={12}
                onChange={(e) => patch({ yAxisName: e.target.value })}
              />
            </label>
          </div>
        ) : null}
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
            checked={settings.showTicks}
            onChange={(e) => patch({ showTicks: e.target.checked })}
          />
          눈금
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.showArrows}
            onChange={(e) => patch({ showArrows: e.target.checked })}
          />
          화살표
        </label>
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
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.panZoom}
            onChange={(e) => patch({ panZoom: e.target.checked })}
          />
          이동·확대
        </label>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <button
          type="button"
          className="font-display rounded-lg bg-wood/10 py-1 text-[11px]"
          onClick={() =>
            onChange(
              mergeGraphSettings({
                ...settings,
                view: { ...STANDARD_PLOT_VIEW },
                xScale: 1,
                yScale: 1,
                equalAxes: true,
              }),
            )
          }
        >
          표준 창
        </button>
        <button
          type="button"
          className="font-display rounded-lg bg-wood/15 py-1 text-[11px]"
          onClick={() => onChange(mergeGraphSettings({ ...DEFAULT_GRAPH_SETTINGS }))}
        >
          초기화
        </button>
      </div>
    </div>
  );
}
