"use client";

import {
  type Cardinal,
  type ChordDraft,
  type ChordLock,
  type LabelMode,
} from "@/lib/diagrams/circle-chords/model";
import { formatNiceNumber } from "@/lib/diagrams/math-label";
import {
  ChipToggle,
  LabelModeRow,
  NumberField,
  Segmented,
  SliderField,
  TextField,
} from "./controls";

const CARDINALS: { id: Cardinal; label: string }[] = [
  { id: "up", label: "위" },
  { id: "down", label: "아래" },
  { id: "left", label: "왼쪽" },
  { id: "right", label: "오른쪽" },
];

type Props = {
  index: number;
  chord: ChordDraft;
  radius: number;
  unit: string;
  unknownLetter: string;
  canDelete: boolean;
  onChange: (patch: Partial<ChordDraft>) => void;
  onDelete: () => void;
};

export default function ChordCard({
  index,
  chord,
  radius,
  unit,
  unknownLetter,
  canDelete,
  onChange,
  onDelete,
}: Props) {
  const half = chord.length / 2;
  const check =
    Math.abs(radius * radius - (chord.distance * chord.distance + half * half)) <
    0.05;

  function setLabel(
    key: "chordLabel" | "distLabel" | "halfLabel" | "radiusStartLabel" | "radiusEndLabel",
    patch: Partial<ChordDraft["chordLabel"]>,
  ) {
    onChange({ [key]: { ...chord[key], ...patch } });
  }

  return (
    <div className="rounded-2xl border-2 border-wood/10 bg-cream/40 p-3.5">
      <div className="flex items-start justify-between gap-2">
        <p className="font-display text-sm text-wood-dark">
          현 {index + 1}
          {chord.showPoints
            ? ` · ${chord.startName}${chord.endName}`
            : ""}
        </p>
        {canDelete ? (
          <button
            type="button"
            onClick={onDelete}
            className="text-xs font-semibold text-foreground/45 hover:text-foreground"
          >
            삭제
          </button>
        ) : null}
      </div>

      <div className="mt-3">
        <p className="mb-1 text-[11px] font-semibold text-foreground/50">
          이 현을 정하는 값
        </p>
        <Segmented<ChordLock>
          value={chord.lock}
          onChange={(lock) => onChange({ lock })}
          options={[
            { id: "length", label: "현의 길이" },
            { id: "distance", label: "중심 거리" },
          ]}
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <NumberField
          label="현의 길이"
          value={roundInput(chord.length)}
          onChange={(length) => onChange({ lock: "length", length })}
          min={0.5}
          max={radius * 2}
          step={0.5}
          suffix={unit}
          disabled={chord.lock !== "length"}
          hint={
            chord.lock === "distance"
              ? `자동 ${formatNiceNumber(chord.length)}`
              : undefined
          }
        />
        <NumberField
          label="중심까지의 거리"
          value={roundInput(chord.distance)}
          onChange={(distance) => onChange({ lock: "distance", distance })}
          min={0}
          max={radius}
          step={0.5}
          suffix={unit}
          disabled={chord.lock !== "distance"}
          hint={
            chord.lock === "length"
              ? `자동 ${formatNiceNumber(chord.distance)}`
              : undefined
          }
        />
      </div>

      <p className="mt-2 text-[11px] tabular-nums text-foreground/45">
        r² = d² + (ℓ/2)² → {formatNiceNumber(radius)}² ={" "}
        {formatNiceNumber(chord.distance)}² + {formatNiceNumber(half)}²
        {check ? "  ✓" : ""}
      </p>

      <div className="mt-3">
        <p className="mb-1 text-[11px] font-semibold text-foreground/50">
          위치
        </p>
        <div className="flex flex-wrap gap-1">
          {CARDINALS.map((c) => (
            <ChipToggle
              key={c.id}
              on={chord.cardinal === c.id}
              onClick={() => onChange({ cardinal: c.id })}
            >
              {c.label}
            </ChipToggle>
          ))}
        </div>
        <div className="mt-2">
          <SliderField
            label="기울기"
            value={chord.tiltDeg}
            onChange={(tiltDeg) => onChange({ tiltDeg })}
            min={-60}
            max={60}
            step={1}
            display={`${chord.tiltDeg}°`}
          />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <TextField
          label="왼쪽 점"
          value={chord.startName}
          onChange={(startName) => onChange({ startName })}
        />
        <TextField
          label="오른쪽 점"
          value={chord.endName}
          onChange={(endName) => onChange({ endName })}
        />
        <TextField
          label="중점"
          value={chord.midName}
          onChange={(midName) => onChange({ midName })}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <ChipToggle
          on={chord.showPoints}
          onClick={() => onChange({ showPoints: !chord.showPoints })}
        >
          점 이름
        </ChipToggle>
        <ChipToggle
          on={chord.showMidpoint}
          onClick={() => onChange({ showMidpoint: !chord.showMidpoint })}
        >
          중점
        </ChipToggle>
        <ChipToggle
          on={chord.showPerp}
          onClick={() => onChange({ showPerp: !chord.showPerp })}
        >
          수선
        </ChipToggle>
        <ChipToggle
          on={chord.showRightAngle}
          onClick={() => onChange({ showRightAngle: !chord.showRightAngle })}
        >
          직각
        </ChipToggle>
        <ChipToggle
          on={chord.showRadiusEnd}
          onClick={() => onChange({ showRadiusEnd: !chord.showRadiusEnd })}
        >
          반지름→끝
        </ChipToggle>
        <ChipToggle
          on={chord.showRadiusStart}
          onClick={() => onChange({ showRadiusStart: !chord.showRadiusStart })}
        >
          반지름→시작
        </ChipToggle>
        <ChipToggle
          on={chord.showHalf}
          onClick={() => onChange({ showHalf: !chord.showHalf })}
        >
          반길이
        </ChipToggle>
        <ChipToggle
          on={chord.equalTicks > 0}
          onClick={() =>
            onChange({
              equalTicks: chord.equalTicks === 0 ? 1 : chord.equalTicks === 1 ? 2 : 0,
            })
          }
        >
          같은 길이 빗금{chord.equalTicks ? ` ${chord.equalTicks}` : ""}
        </ChipToggle>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <LabelModeRow
          title="현의 길이"
          mode={chord.chordLabel.mode}
          custom={chord.chordLabel.custom}
          unknownLetter={unknownLetter}
          onMode={(mode: LabelMode) => setLabel("chordLabel", { mode })}
          onCustom={(custom) => setLabel("chordLabel", { custom })}
        />
        <LabelModeRow
          title="중심 거리"
          mode={chord.distLabel.mode}
          custom={chord.distLabel.custom}
          unknownLetter={unknownLetter}
          onMode={(mode) => setLabel("distLabel", { mode })}
          onCustom={(custom) => setLabel("distLabel", { custom })}
        />
        {chord.showHalf ? (
          <LabelModeRow
            title="반길이"
            mode={chord.halfLabel.mode}
            custom={chord.halfLabel.custom}
            unknownLetter={unknownLetter}
            onMode={(mode) => setLabel("halfLabel", { mode })}
            onCustom={(custom) => setLabel("halfLabel", { custom })}
          />
        ) : null}
        {chord.showRadiusStart ? (
          <LabelModeRow
            title={`${chord.startName} 반지름`}
            mode={chord.radiusStartLabel.mode}
            custom={chord.radiusStartLabel.custom}
            unknownLetter={unknownLetter}
            onMode={(mode) => setLabel("radiusStartLabel", { mode })}
            onCustom={(custom) => setLabel("radiusStartLabel", { custom })}
          />
        ) : null}
        {chord.showRadiusEnd ? (
          <LabelModeRow
            title={`${chord.endName} 반지름`}
            mode={chord.radiusEndLabel.mode}
            custom={chord.radiusEndLabel.custom}
            unknownLetter={unknownLetter}
            onMode={(mode) => setLabel("radiusEndLabel", { mode })}
            onCustom={(custom) => setLabel("radiusEndLabel", { custom })}
          />
        ) : null}
      </div>
    </div>
  );
}

function roundInput(n: number): number {
  return Math.round(n * 1000) / 1000;
}
